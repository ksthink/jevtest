/**
 * 게시글 100건과 정답표의 단일 원본.
 *
 * 페이지 HTML과 정답표를 같은 자료에서 만들기 때문에 둘이 어긋날 수 없다.
 * 모든 값은 고정이다(난수·현재시각 없음) -> 배포해도 매번 같은 사이트가 나온다.
 */
const {
  AD_COPY, AD_COPY_LATIN, NORMAL_BODY, NORMAL_TITLES, TRAP_LINES,
  COMMENT_AUTHORS, NORMAL_COMMENTS, OFFICIAL_REPLIES, TRAP_COMMENTS,
} = require('./copy');
const { circled, cyrillic, entities, fullwidth, jamo, jamoLatin, leet, mathBold, nfd, spaced, zeroWidth } = require('../lib/disguise');

const MAIN_CODES = ['HOMOGLYPH', 'JAMO', 'TRANSPARENT', 'OFFSCREEN'];
const EXTRA_CODES = ['ZERO_WIDTH', 'CLIPPED', 'VISIBILITY_HIDDEN', 'HTML_COMMENT', 'VISIBLE_AD'];



const POSTS_PER_PAGE = 10;
const TOTAL_POSTS = 100;
const TOTAL_PAGES = TOTAL_POSTS / POSTS_PER_PAGE;

// ---------------------------------------------------------------- 위장 변형

/** HOMOGLYPH 변형: 닮은꼴 글자로 바꾼다. 내용은 화면에 그대로 보인다. */
const HOMOGLYPH_V = [
  { name: '전각', enc: fullwidth },
  { name: '키릴·그리스', enc: (s) => cyrillic(s) },
  { name: '숫자 치환', enc: (s) => leet(s, ['o', 'O', 'i', 'I', 's', 'S']) },
  { name: '원문자', enc: circled },
  { name: '수학용 영문', enc: mathBold },
];

/** JAMO 변형: 한글을 자모로 흩는다. */
const JAMO_V = [
  { name: '호환 자모 분해', enc: jamo },
  { name: 'NFD 조합형 자모', enc: nfd },
  { name: '모음을 라틴 글자로', enc: jamoLatin },
];

/** TRANSPARENT 변형: 글자를 안 보이게 만드는 색·투명도. */
const TRANSPARENT_V = [
  { name: 'color:transparent', attr: 'style="color:transparent"' },
  { name: 'opacity:0', attr: 'style="opacity:0"' },
  { name: '흰 배경에 흰 글자', attr: 'style="color:#ffffff"' },
  { name: 'rgba 알파 0', attr: 'style="color:rgba(0,0,0,0)"' },
  { name: '조상 요소 배경과 같은 색', attr: '', cls: 'same' },
  { name: '명암비 1.05 저대비', attr: 'style="color:#fafbfc"' },
];

/** OFFSCREEN 변형: 화면 밖으로 밀거나 크기를 없앤다. */
const OFFSCREEN_V = [
  { name: 'display:none', attr: 'style="display:none"' },
  { name: 'font-size:0', attr: 'style="font-size:0"' },
  { name: 'font-size:1px', attr: 'style="font-size:1px;line-height:0"' },
  { name: 'left:-9999px', attr: 'style="position:absolute;left:-9999px"' },
  { name: 'top:-10000px', attr: 'style="position:absolute;top:-10000px"' },
  { name: 'text-indent:-9999px', attr: 'style="display:block;text-indent:-9999px;overflow:hidden;white-space:nowrap"' },
  { name: 'transform 이동', attr: 'style="position:absolute;transform:translateX(-9999px)"' },
];

// ---------------------------------------------------------------- 삽입 만들기


/**
 * 삽입 계획. 쪽마다 5건이 들어가도록 골라 두었다.
 * 쪽별로 검출이 고르게 퍼져 있어야 "쪽 구간 선택"이나 중복 합치기를 시험할 수 있다.
 */
const PLAN = [
  // 1쪽
  { i: 0, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 0, v: 0, where: 'title' },
  { i: 2, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 1, v: 0, where: 'body' },
  { i: 2, codes: ['OFFSCREEN'], dom: 'LOAN', c: 0, v: 0, where: 'body' },
  { i: 4, codes: ['OFFSCREEN'], dom: 'ADULT', c: 0, v: 3, where: 'body' },
  { i: 6, codes: ['JAMO'], dom: 'GAMBLE', c: 2, v: 0, where: 'body' },
  { i: 9, codes: ['VISIBLE_AD'], dom: 'LOAN', c: 1, where: 'comment' },
  // 2쪽
  { i: 10, codes: ['JAMO'], dom: 'GAMBLE', c: 0, v: 2, where: 'title' },
  { i: 12, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 3, v: 1, where: 'body' },
  { i: 14, codes: ['TRANSPARENT'], dom: 'DRUG', c: 0, v: 1, where: 'body' },
  { i: 16, codes: ['OFFSCREEN'], dom: 'TRADE', c: 0, v: 1, where: 'body' },
  { i: 18, codes: ['CLIPPED'], dom: 'GAMBLE', c: 4, where: 'body' },
  // 3쪽
  { i: 20, codes: ['OFFSCREEN'], dom: 'ADULT', c: 1, v: 2, where: 'body' },
  { i: 22, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 5, v: 2, where: 'body' },
  { i: 24, codes: ['TRANSPARENT'], dom: 'LOAN', c: 2, v: 2, where: 'body' },
  { i: 26, codes: ['OFFSCREEN'], dom: 'GAMBLE', c: 6, v: 0, where: 'iframe' },
  { i: 28, codes: ['ZERO_WIDTH'], dom: 'GAMBLE', c: 1, where: 'body' },
  // 4쪽
  { i: 30, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 7, v: 3, where: 'title' },
  { i: 32, codes: ['JAMO'], dom: 'ADULT', c: 1, v: 0, where: 'body' },
  { i: 34, codes: ['TRANSPARENT'], dom: 'TRADE', c: 1, v: 3, where: 'body' },
  { i: 36, codes: ['OFFSCREEN'], dom: 'DRUG', c: 1, v: 4, where: 'body' },
  { i: 36, codes: ['VISIBILITY_HIDDEN'], dom: 'ADULT', c: 2, where: 'comment' },
  { i: 38, codes: ['HTML_COMMENT'], dom: 'GAMBLE', c: 2, where: 'body' },
  // 5쪽
  { i: 40, codes: ['OFFSCREEN'], dom: 'LOAN', c: 3, v: 5, where: 'body' },
  { i: 42, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 4, v: 4, where: 'body' },
  // 한 요소에 두 기법이 겹친 경우 -> 기법별로 따로 1건씩 센다.
  { i: 44, codes: ['TRANSPARENT', 'OFFSCREEN'], dom: 'GAMBLE', c: 0, v: 1, where: 'body' },
  { i: 46, codes: ['JAMO'], dom: 'DRUG', c: 2, v: 1, where: 'body' },
  { i: 48, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 3, v: 4, where: 'body' },
  // 6쪽
  { i: 50, codes: ['TRANSPARENT'], dom: 'ADULT', c: 3, v: 5, where: 'body' },
  { i: 52, codes: ['OFFSCREEN'], dom: 'TRADE', c: 2, v: 6, where: 'body' },
  { i: 54, codes: ['JAMO'], dom: 'GAMBLE', c: 1, v: 0, where: 'title' },
  { i: 56, codes: ['HOMOGLYPH'], dom: 'ADULT', c: 0, v: 0, where: 'body' },
  { i: 58, codes: ['VISIBLE_AD'], dom: 'GAMBLE', c: 6, where: 'body' },
  // 7쪽
  { i: 60, codes: ['OFFSCREEN'], dom: 'DRUG', c: 3, v: 2, where: 'body' },
  { i: 62, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 2, v: 1, where: 'body' },
  { i: 64, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 5, v: 0, where: 'body' },
  { i: 66, codes: ['JAMO'], dom: 'GAMBLE', c: 6, v: 0, where: 'comment' },
  { i: 68, codes: ['ZERO_WIDTH'], dom: 'TRADE', c: 3, where: 'body' },
  // 8쪽
  { i: 70, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 7, v: 0, where: 'iframe' },
  { i: 72, codes: ['OFFSCREEN'], dom: 'LOAN', c: 1, v: 0, where: 'body' },
  { i: 74, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 1, v: 2, where: 'body' },
  { i: 74, codes: ['CLIPPED'], dom: 'TRADE', c: 4, where: 'body' },
  { i: 76, codes: ['JAMO'], dom: 'GAMBLE', c: 3, v: 2, where: 'body' },
  { i: 78, codes: ['CLIPPED'], dom: 'ADULT', c: 2, where: 'body' },
  // 9쪽
  { i: 80, codes: ['TRANSPARENT'], dom: 'DRUG', c: 1, v: 1, where: 'body' },
  { i: 82, codes: ['OFFSCREEN'], dom: 'GAMBLE', c: 0, v: 1, where: 'body' },
  { i: 84, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 6, v: 3, where: 'body' },
  { i: 86, codes: ['JAMO'], dom: 'TRADE', c: 0, v: 1, where: 'body' },
  { i: 88, codes: ['VISIBILITY_HIDDEN'], dom: 'LOAN', c: 2, where: 'body' },
  // 10쪽
  { i: 90, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 5, v: 0, where: 'title' },
  { i: 92, codes: ['TRANSPARENT'], dom: 'TRADE', c: 4, v: 2, where: 'body' },
  { i: 94, codes: ['OFFSCREEN'], dom: 'GAMBLE', c: 4, v: 1, where: 'body' },
  { i: 96, codes: ['JAMO'], dom: 'ADULT', c: 3, v: 0, where: 'body' },
  { i: 98, codes: ['VISIBLE_AD'], dom: 'DRUG', c: 0, where: 'body' },
  { i: 99, codes: ['HTML_COMMENT'], dom: 'GAMBLE', c: 7, where: 'iframe' },

  // --- 댓글 ---------------------------------------------------------------
  // 댓글은 실제 공공기관 게시판에서 광고가 가장 많이 붙는 자리다. 본문과 같은 9종을
  // 쪽마다 고르게 깔아, 상세 페이지를 열어 댓글 영역까지 읽는지 확인한다.
  // 글에 본문 검출이 없는 번호를 골라 검출이 더 많은 글에 퍼지게 했다.
  { i: 5, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 1, v: 2, where: 'comment' },
  { i: 7, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 1, v: 0, where: 'comment' },
  { i: 15, codes: ['OFFSCREEN'], dom: 'LOAN', c: 0, v: 3, where: 'comment' },
  { i: 17, codes: ['ZERO_WIDTH'], dom: 'ADULT', c: 1, where: 'comment' },
  { i: 25, codes: ['VISIBLE_AD'], dom: 'GAMBLE', c: 2, where: 'comment' },
  { i: 27, codes: ['TRANSPARENT'], dom: 'TRADE', c: 0, v: 0, where: 'comment' },
  // 35·75는 '댓글 더보기'로 접힌 댓글 안에 둔다. 접힌 것 자체가 기법이 되면 정답이
  // 흐려지므로, 글자 자체를 바꾸는 기법(닮은꼴·자모)만 넣는다.
  { i: 35, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 2, v: 1, where: 'comment' },
  { i: 37, codes: ['CLIPPED'], dom: 'DRUG', c: 0, where: 'comment' },
  { i: 47, codes: ['OFFSCREEN'], dom: 'GAMBLE', c: 5, v: 0, where: 'comment' },
  { i: 55, codes: ['JAMO'], dom: 'GAMBLE', c: 4, v: 0, where: 'comment' },
  { i: 57, codes: ['HTML_COMMENT'], dom: 'LOAN', c: 2, where: 'comment' },
  { i: 65, codes: ['TRANSPARENT'], dom: 'ADULT', c: 0, v: 1, where: 'comment' },
  { i: 67, codes: ['OFFSCREEN'], dom: 'DRUG', c: 2, v: 1, where: 'comment' },
  { i: 75, codes: ['JAMO'], dom: 'TRADE', c: 1, v: 0, where: 'comment' },
  { i: 77, codes: ['HOMOGLYPH'], dom: 'ADULT', c: 0, v: 2, where: 'comment' },
  { i: 87, codes: ['VISIBLE_AD'], dom: 'TRADE', c: 4, where: 'comment' },
  { i: 95, codes: ['ZERO_WIDTH'], dom: 'GAMBLE', c: 3, where: 'comment' },
];

/** '댓글 더보기'로 접어 둘 글: 번호 -> 접기 시작 위치(그 앞까지만 바로 보인다). */
const COMMENT_MORE_AT = new Map([
  [35, 2],
  [75, 2],
]);

/** 함정 댓글을 달 글 번호. TRAP_COMMENTS를 차례로 쓴다. */
const COMMENT_TRAP_AT = [4, 14, 22, 24, 34, 44, 54, 64, 74, 84, 94, 35];

/** 함정을 심을 글 번호. PLAN이 쓰지 않는 번호만 고른다. */
const TRAP_AT = [1, 3, 8, 11, 13, 19, 21, 23, 29, 31, 33, 39, 41, 43, 49, 51, 53, 59, 61, 63, 69, 71, 73, 79, 81, 83, 89, 91, 93, 97];

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s) {
  return s.replace(/[&<>"]/g, (ch) => ESCAPE[ch]);
}

/** 삽입 하나를 HTML과 증거 문구로 만든다. */
function build(spec, gt) {
  // 닮은꼴 위장은 라틴 글자에만 걸리므로 키워드가 라틴인 문구를 쓴다.
  const pool = spec.codes.includes('HOMOGLYPH') ? AD_COPY_LATIN : AD_COPY;
  const raw = pool[spec.dom][spec.c % pool[spec.dom].length];
  const v = spec.v === undefined ? 0 : spec.v;
  const tag = spec.where === 'title' ? 'span' : 'p';
  const codes = spec.codes;
  const notes = [];

  // 1) 글자 자체를 바꾸는 기법
  let text = raw;
  if (codes.includes('HOMOGLYPH')) {
    const hv = HOMOGLYPH_V[v % HOMOGLYPH_V.length];
    text = hv.enc(raw);
    notes.push(`닮은꼴: ${hv.name}`);
  } else if (codes.includes('JAMO')) {
    const jv = JAMO_V[v % JAMO_V.length];
    text = jv.enc(raw);
    notes.push(`자모: ${jv.name}`);
  } else if (codes.includes('ZERO_WIDTH')) {
    text = zeroWidth(raw);
    notes.push('폭 0 문자(U+200B) 삽입');
  } else if (codes.includes('VISIBLE_AD') && spec.where === 'body') {
    text = spaced(raw.split(' ')[0]) + ' ' + raw.split(' ').slice(1).join(' ');
    notes.push('숨기지 않고 노출 (띄어쓰기 위장)');
  }

  // 2) 요소를 안 보이게 하는 기법
  let attr = '';
  let cls = '';
  if (codes.includes('TRANSPARENT')) {
    const tv = TRANSPARENT_V[v % TRANSPARENT_V.length];
    attr = tv.attr;
    cls = tv.cls || '';
    notes.push(`투명: ${tv.name}`);
  }
  if (codes.includes('OFFSCREEN')) {
    const ov = OFFSCREEN_V[v % OFFSCREEN_V.length];
    // 두 기법이 겹치면 style을 합친다(같은 요소에 투명 + 화면 밖).
    const inner = ov.attr.replace(/^style="|"$/g, '');
    attr = attr ? attr.replace(/"$/, ';' + inner + '"') : ov.attr;
    notes.push(`화면 밖: ${ov.name}`);
  }
  if (codes.includes('CLIPPED')) {
    cls = 'sr-only';
    notes.push('클립 영역(sr-only)에 가림');
  }
  if (codes.includes('VISIBILITY_HIDDEN')) {
    attr = 'style="visibility:hidden"';
    notes.push('visibility:hidden');
  }

  const marker = `data-gt="${gt}"`;
  const clsAttr = cls ? ` class="${cls}"` : '';
  const attrPart = attr ? ' ' + attr : '';

  if (codes.includes('HTML_COMMENT')) {
    notes.push('HTML 주석 속');
    return { gt, codes, where: spec.where, evidence: raw, note: notes.join(' / '),
      html: `<span ${marker}><!-- ${esc(raw)} --></span>` };
  }

  // 숫자 치환형 한 건은 HTML 엔티티까지 겹쳐 둔다(엔티티 해제 처리 확인용).
  const inner = codes.includes('OFFSCREEN') && v === 0 && spec.i === 72 ? entities(text) : esc(text);
  if (codes.includes('OFFSCREEN') && v === 0 && spec.i === 72) notes.push('HTML 엔티티 인코딩');

  // 제목은 목록에서 이미 <a> 안에 들어가므로 링크를 또 감싸지 않는다(중첩 <a>는 잘못된 HTML이다).
  const href = spec.where !== 'title' && (codes.includes('VISIBLE_AD') || codes.includes('HOMOGLYPH'))
    ? `<a href="http://ad-${gt.toLowerCase()}.example.test/" rel="nofollow">${inner}</a>`
    : inner;

  return {
    gt,
    codes,
    where: spec.where,
    evidence: text,
    note: notes.join(' / '),
    html: `<${tag} ${marker}${clsAttr}${attrPart}>${href}</${tag}>`,
  };
}

function trapHtml(t, gt) {
  if (!t.hidden) return `<p data-gt="${gt}">${esc(t.text)}</p>`;
  const style = gt.endsWith('2') ? 'style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"' : 'style="display:none"';
  return `<p data-gt="${gt}" ${style}>${esc(t.text)}</p>`;
}

// ---------------------------------------------------------------- 글 100건

const AUTHORS = ['민원봉사과', '기획예산과', '복지정책과', '도시교통과', '환경관리과', '문화체육과', '안전총괄과', '세무과', '농업기술센터', '보건소'];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 2026-01-02 ~ 2026-10-12 사이로 고정 날짜를 만든다. */
function dateFor(i) {
  const day = 2 + ((i * 3) % 280);
  const d = new Date(Date.UTC(2026, 0, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const POSTS = [];

{
  const byIndex = new Map();
  for (const s of PLAN) {
    const arr = byIndex.get(s.i) || [];
    arr.push(s);
    byIndex.set(s.i, arr);
  }

  let seq = 0;
  for (let i = 0; i < TOTAL_POSTS; i++) {
    const specs = byIndex.get(i) || [];
    const injections = specs.map((s) => build(s, `G${pad(++seq)}`));

    const trapPos = TRAP_AT.indexOf(i);
    const traps =
      trapPos < 0
        ? []
        : (() => {
            const t = TRAP_LINES[trapPos % TRAP_LINES.length];
            const gt = `N${pad(trapPos + 1)}`;
            return [{ gt, text: t.text, hidden: t.hidden, note: t.note, html: trapHtml(t, gt) }];
          })();

    const titleInj = injections.find((x) => x.where === 'title');
    const plainTitle = NORMAL_TITLES[i % NORMAL_TITLES.length];
    const title = titleInj ? titleInj.evidence : plainTitle;
    const titleHtml = titleInj ? titleInj.html : esc(plainTitle);

    const commentInj = injections.filter((x) => x.where === 'comment');
    const moreFrom = COMMENT_MORE_AT.get(i);
    const trapPosC = COMMENT_TRAP_AT.indexOf(i);

    // 정상 댓글 수. '댓글 더보기'가 있는 글은 접히는 부분이 생기게 3건으로 맞춘다.
    const normalCount = moreFrom === undefined ? [0, 1, 2, 3, 2, 1, 4, 2, 1, 3][i % 10] : 3;

    const commentTraps = [];
    const comments = [];

    for (let k = 0; k < normalCount; k++) {
      comments.push({
        author: COMMENT_AUTHORS[(i + k) % COMMENT_AUTHORS.length],
        date: dateFor(i + 1 + k),
        html: esc(NORMAL_COMMENTS[(i * 3 + k) % NORMAL_COMMENTS.length]),
      });
    }

    if (trapPosC >= 0) {
      const t = TRAP_COMMENTS[trapPosC % TRAP_COMMENTS.length];
      const gt = `C${pad(trapPosC + 1)}`;
      commentTraps.push({ gt, text: t.text, hidden: t.hidden, note: t.note, html: '' });
      comments.push({
        author: COMMENT_AUTHORS[(i + 5) % COMMENT_AUTHORS.length],
        date: dateFor(i + 5),
        html: `<span data-gt="${gt}">${esc(t.text)}</span>`,
      });
    }

    // 광고 댓글은 맨 뒤에 붙인다(실제 스팸도 최근 댓글로 달린다).
    for (const x of commentInj) {
      comments.push({ author: COMMENT_AUTHORS[(i + 7) % COMMENT_AUTHORS.length], date: dateFor(i + 7), html: x.html });
    }

    if (i % 5 === 0 && normalCount > 0) {
      comments.push({
        author: '담당자',
        date: dateFor(i + 9),
        html: esc(OFFICIAL_REPLIES[i % OFFICIAL_REPLIES.length]),
        official: true,
      });
    }

    const iframeInj = injections.filter((x) => x.where === 'iframe');

    POSTS.push({
      id: 1001 + i,
      no: TOTAL_POSTS - i,
      page: Math.floor(i / POSTS_PER_PAGE) + 1,
      title,
      titleHtml,
      author: AUTHORS[i % AUTHORS.length],
      date: dateFor(i),
      hits: 37 + ((i * 17) % 900),
      body: [NORMAL_BODY[i % NORMAL_BODY.length], NORMAL_BODY[(i + 3) % NORMAL_BODY.length]],
      injections,
      traps,
      comments,
      commentTraps,
      // 이 위치부터는 '댓글 더보기'를 눌러야 보인다(없으면 null).
      // 접힌 댓글은 처음 HTML에 없고, 더보기를 누르면 서버에서 받아 와 붙는다.
      commentsMoreFrom: moreFrom === undefined || comments.length <= moreFrom ? null : moreFrom,
      // 접힌 쪽에 들어 있는 채점 표식. 처음 HTML에는 없으므로 따로 적어 둔다.
      collapsedGts:
        moreFrom === undefined || comments.length <= moreFrom
          ? []
          : comments
              .slice(moreFrom)
              .flatMap((c) => [...String(c.html).matchAll(/data-gt="([^"]+)"/g)].map((m) => m[1])),
      iframeId: iframeInj.length ? 1001 + i : null,
      // 목록에 자물쇠로 표시하고 열지 않아야 하는 비밀글. 안에는 아무 광고도 없다.
      secret: i === 45 || i === 85,
    });
  }
}

const POST_BY_ID = new Map(POSTS.map((p) => [p.id, p]));

function postsOnPage(page) {
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), TOTAL_PAGES);
  return POSTS.slice((p - 1) * POSTS_PER_PAGE, p * POSTS_PER_PAGE);
}

function clampPage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.trunc(n)), TOTAL_PAGES);
}

/** iframe 문서에 들어갈 삽입(해당 글의 where==='iframe') */
function iframeInjections(post) {
  return post.injections.filter((x) => x.where === 'iframe');
}

/** 댓글에 들어갈 삽입 */
function commentInjections(post) {
  return post.injections.filter((x) => x.where === 'comment');
}

/** 본문에 들어갈 삽입 */
function bodyInjections(post) {
  return post.injections.filter((x) => x.where === 'body');
}

module.exports = {
  MAIN_CODES, EXTRA_CODES, POSTS_PER_PAGE, TOTAL_POSTS, TOTAL_PAGES,
  POSTS, POST_BY_ID, postsOnPage, clampPage, iframeInjections, bodyInjections,
  commentInjections,
};
