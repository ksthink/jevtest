/**
 * 게시글 300건과 정답표의 단일 원본.
 *
 * 페이지 HTML과 정답표를 같은 자료에서 만들기 때문에 둘이 어긋날 수 없다.
 * 모든 값은 고정이다(난수·현재시각 없음) -> 배포해도 매번 같은 사이트가 나온다.
 */
const {
  DOMAINS, DOMAIN_SCOPE, AD_COPY, AD_COPY_LATIN, NORMAL_BODY, NORMAL_TITLES, TRAP_LINES,
  COMMENT_AUTHORS, NORMAL_COMMENTS, OFFICIAL_REPLIES, TRAP_COMMENTS,
} = require('./copy');
const { circled, cyrillic, entities, fullwidth, jamo, jamoLatin, leet, mathBold, nfd, spaced, zeroWidth } = require('../lib/disguise');

const MAIN_CODES = ['HOMOGLYPH', 'JAMO', 'TRANSPARENT', 'OFFSCREEN'];
const EXTRA_CODES = ['ZERO_WIDTH', 'CLIPPED', 'VISIBILITY_HIDDEN', 'HTML_COMMENT', 'VISIBLE_AD'];
/** 글자 자체를 바꾸는 기법. 이쪽은 위장이 실제로 걸렸는지 만들 때 확인한다. */
const TEXT_CODES = ['HOMOGLYPH', 'JAMO', 'ZERO_WIDTH'];

const POSTS_PER_PAGE = 10;
const TOTAL_POSTS = 500;
const TOTAL_PAGES = TOTAL_POSTS / POSTS_PER_PAGE;

// ---------------------------------------------------------------- 위장 변형

/** HOMOGLYPH 변형: 닮은꼴 글자로 바꾼다. 내용은 화면에 그대로 보인다. */
const HOMOGLYPH_V = [
  { name: '전각', enc: fullwidth },
  { name: '키릴·그리스', enc: cyrillic },
  { name: '숫자 치환', enc: (s) => leet(s) },
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

/**
 * 분야 회전 순서. 검출마다 한 칸씩 돌린다.
 *
 * 요강 5개 분야가 15칸, 요강 밖 유형이 3칸이라 약 83% : 17%가 된다. 요강 밖 유형도
 * 실제로 올라오므로 넣어 두되, 적격평가 점수를 재는 숫자가 거기에 휘둘리지 않게 한다.
 */
const DOMAIN_CYCLE = [
  'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
  'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
  'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
  'INVEST', 'JOB', 'HACK',
];

/**
 * 기법·변형을 모두 훑는 조합표(26가지).
 * 검출을 이 표 순서대로 돌려 쓰므로 모든 변형이 고르게 나온다.
 */
const VARIANTS = [
  ...HOMOGLYPH_V.map((x, v) => ({ codes: ['HOMOGLYPH'], v })),
  ...JAMO_V.map((x, v) => ({ codes: ['JAMO'], v })),
  ...TRANSPARENT_V.map((x, v) => ({ codes: ['TRANSPARENT'], v })),
  ...OFFSCREEN_V.map((x, v) => ({ codes: ['OFFSCREEN'], v })),
  ...EXTRA_CODES.map((c) => ({ codes: [c], v: 0 })),
];

// ---------------------------------------------------------------- 삽입 만들기

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ESCAPE[ch]);
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
  } else if (codes.includes('VISIBLE_AD')) {
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

  // 글자를 바꾸는 기법인데 실제로 안 바뀌었으면 정답표가 거짓이 된다. 만들 때 막는다.
  if (codes.some((c) => TEXT_CODES.includes(c)) && text === raw) {
    throw new Error(`${gt}: ${codes.join('+')} 인데 위장이 걸리지 않았다 -> "${raw}"`);
  }

  const marker = `data-gt="${gt}"`;
  const clsAttr = cls ? ` class="${cls}"` : '';
  const attrPart = attr ? ' ' + attr : '';

  if (codes.includes('HTML_COMMENT')) {
    notes.push('HTML 주석 속');
    return {
      gt, codes, where: spec.where, dom: spec.dom, scope: DOMAIN_SCOPE[spec.dom] || 'spec',
      evidence: raw, note: notes.join(' / '),
      html: `<span ${marker}><!-- ${esc(raw)} --></span>`,
    };
  }

  // HTML 엔티티까지 겹쳐 둔 건(엔티티 해제 처리 확인용)
  const useEntities = !!spec.entities;
  if (useEntities) notes.push('HTML 엔티티 인코딩');
  const inner = useEntities ? entities(text) : esc(text);

  // 제목은 목록에서 이미 <a> 안에 들어가므로 링크를 또 감싸지 않는다(중첩 <a>는 잘못된 HTML이다).
  const href = spec.where !== 'title' && (codes.includes('VISIBLE_AD') || codes.includes('HOMOGLYPH'))
    ? `<a href="http://ad-${gt.toLowerCase()}.example.test/" rel="nofollow">${inner}</a>`
    : inner;

  return {
    gt,
    codes,
    where: spec.where,
    dom: spec.dom,
    // 'spec' = 요강 5개 분야, 'extra' = 요강 밖이지만 실제로 올라오는 유형
    scope: DOMAIN_SCOPE[spec.dom] || 'spec',
    evidence: text,
    note: notes.join(' / '),
    html: `<${tag} ${marker}${clsAttr}${attrPart}>${href}</${tag}>`,
  };
}

// ---------------------------------------------------------------- 배치 계획

/**
 * 쪽마다 글 10건 가운데 앞 7자리에 검출을, 뒤 3자리에 함정을 둔다.
 * 자리는 쪽마다 돌려서 모든 쪽이 똑같은 모양이 되지 않게 한다.
 */
const SLOT_ORDER = [0, 1, 3, 4, 6, 7, 9, 2, 5, 8];
const FINDING_SLOTS = 7;
/** 검출 자리마다 어디에 심을지. 마지막 자리는 짝수 쪽에서만 iframe. */
const SLOT_WHERE = ['title', 'body', 'comment', 'body', 'comment', 'comment', 'iframe'];

/** 비밀글. 목록에 자물쇠로 표시하고 열지 않아야 한다. 안에는 아무것도 심지 않는다. */
const SECRET = new Set([47, 88, 134, 189, 231, 276, 318, 365, 412, 468]);

function pageSlots(page) {
  return SLOT_ORDER.map((x) => (x + page) % POSTS_PER_PAGE);
}

/** 검출 계획을 만든다. 쪽마다 7건 -> 30쪽 210건. */
function buildPlan() {
  const plan = [];
  let k = 0;
  for (let page = 0; page < TOTAL_PAGES; page++) {
    const slots = pageSlots(page);
    for (let s = 0; s < FINDING_SLOTS; s++) {
      const i = page * POSTS_PER_PAGE + slots[s];
      if (SECRET.has(i)) continue; // 비밀글에는 심지 않는다
      const variant = VARIANTS[k % VARIANTS.length];
      // 26가지 변형을 한 바퀴 돌 때마다 분야를 옮긴다 -> (변형 x 분야) 조합을 모두 덮는다.
      // 변형(26가지)과 분야(18칸)의 길이가 서로 나누어떨어지지 않아, 검출마다 한 칸씩
      // 돌리면 (변형 x 분야) 조합이 고르게 섞인다.
      const dom = DOMAIN_CYCLE[k % DOMAIN_CYCLE.length];
      let where = SLOT_WHERE[s];
      if (where === 'iframe' && page % 2 === 1) where = 'body';
      plan.push({ i, codes: variant.codes, v: variant.v, dom, c: k, where });
      k++;
    }
  }

  // 한 요소에 기법이 겹친 경우: 기법별로 따로 1건씩 세야 한다.
  for (const page of [1, 6, 11, 16, 21, 26, 31, 36, 41, 46]) {
    plan.push({
      i: page * POSTS_PER_PAGE + ((page + 2) % POSTS_PER_PAGE),
      codes: ['TRANSPARENT', 'OFFSCREEN'], v: page % 6, dom: DOMAIN_CYCLE[page % DOMAIN_CYCLE.length], c: page, where: 'body',
    });
  }
  // HTML 엔티티로 한 번 더 감싼 경우
  for (const page of [4, 19, 34, 49]) {
    plan.push({
      i: page * POSTS_PER_PAGE + ((page + 5) % POSTS_PER_PAGE),
      codes: ['OFFSCREEN'], v: 0, dom: DOMAIN_CYCLE[(page + 1) % DOMAIN_CYCLE.length], c: page, where: 'body', entities: true,
    });
  }
  return plan.filter((x) => !SECRET.has(x.i));
}

const PLAN = buildPlan();

/** 함정을 심을 자리: 쪽마다 뒤 3자리. */
function buildTrapPlan() {
  const body = [];
  const comment = [];
  let a = 0;
  let b = 0;
  for (let page = 0; page < TOTAL_PAGES; page++) {
    const slots = pageSlots(page);
    for (let s = FINDING_SLOTS; s < POSTS_PER_PAGE; s++) {
      const i = page * POSTS_PER_PAGE + slots[s];
      if (SECRET.has(i)) continue; // 비밀글은 본문이 안 보이므로 함정도 넣지 않는다
      // 자리 7·9는 본문 함정, 자리 8은 댓글 함정 -> 본문 60건·댓글 30건으로 문구 풀과 맞춘다.
      if (s === 8) comment.push({ i, t: b++ });
      else body.push({ i, t: a++ });
    }
  }
  return { body, comment };
}

const TRAP_PLAN = buildTrapPlan();

// ---------------------------------------------------------------- 글 300건

const AUTHORS = ['민원봉사과', '기획예산과', '복지정책과', '도시교통과', '환경관리과', '문화체육과',
  '안전총괄과', '세무과', '농업기술센터', '보건소', '건축과', '청소행정과'];

function pad(n, w = 3) {
  return String(n).padStart(w, '0');
}

/** 2026-01-02 ~ 2026-10-12 사이로 고정 날짜를 만든다. */
function dateFor(i) {
  const day = 2 + ((i * 3) % 280);
  const d = new Date(Date.UTC(2026, 0, day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function trapHtml(t, gt) {
  if (!t.hidden) return `<p data-gt="${gt}">${esc(t.text)}</p>`;
  // 숨기는 방식도 돌려 쓴다(화면낭독기용 숨김·접힌 메뉴·IR 텍스트).
  const n = Number(gt.slice(1)) % 3;
  const style = n === 0 ? 'style="display:none"'
    : n === 1 ? 'style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"'
      : 'style="font-size:0;line-height:0"';
  return `<p data-gt="${gt}" ${style}>${esc(t.text)}</p>`;
}

const POSTS = [];

{
  const findingsAt = new Map();
  for (const s of PLAN) {
    const arr = findingsAt.get(s.i) || [];
    arr.push(s);
    findingsAt.set(s.i, arr);
  }
  const bodyTrapAt = new Map(TRAP_PLAN.body.map((x) => [x.i, x.t]));
  const commentTrapAt = new Map(TRAP_PLAN.comment.map((x) => [x.i, x.t]));

  let seq = 0;
  for (let i = 0; i < TOTAL_POSTS; i++) {
    const secret = SECRET.has(i);
    const specs = findingsAt.get(i) || [];
    const injections = specs.map((s) => build(s, `G${pad(++seq)}`));

    // 본문 함정
    const traps = [];
    if (!secret && bodyTrapAt.has(i)) {
      const idx = bodyTrapAt.get(i);
      const t = TRAP_LINES[idx % TRAP_LINES.length];
      const gt = `N${pad(idx + 1)}`;
      traps.push({ gt, text: t.text, hidden: t.hidden, note: t.note, html: trapHtml(t, gt) });
    }

    const titleInj = injections.find((x) => x.where === 'title');
    const plainTitle = NORMAL_TITLES[i % NORMAL_TITLES.length];
    const title = titleInj ? titleInj.evidence : plainTitle;
    const titleHtml = titleInj ? titleInj.html : esc(plainTitle);

    // 댓글
    const commentInj = injections.filter((x) => x.where === 'comment');
    const normalCount = [1, 2, 4, 3, 5, 2, 6, 3, 2, 4][i % 10];
    const commentTraps = [];
    const comments = [];

    for (let k = 0; k < normalCount; k++) {
      comments.push({
        author: COMMENT_AUTHORS[(i + k) % COMMENT_AUTHORS.length],
        date: dateFor(i + 1 + k),
        html: esc(NORMAL_COMMENTS[(i * 3 + k) % NORMAL_COMMENTS.length]),
      });
    }

    if (!secret && commentTrapAt.has(i)) {
      const idx = commentTrapAt.get(i);
      const t = TRAP_COMMENTS[idx % TRAP_COMMENTS.length];
      const gt = `C${pad(idx + 1)}`;
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
      hits: 37 + ((i * 17) % 1900),
      body: [NORMAL_BODY[i % NORMAL_BODY.length], NORMAL_BODY[(i + 7) % NORMAL_BODY.length]],
      injections,
      traps,
      comments,
      commentTraps,
      commentsMoreFrom: null,
      collapsedGts: [],
      iframeId: iframeInj.length ? 1001 + i : null,
      secret,
    });
  }

  /**
   * '댓글 더보기'로 접을 글을 고른다.
   *
   * 접힌 댓글은 처음 HTML에 없고 더보기를 누르면 서버에서 받아 와 붙는다.
   * 숨겨 두면 그 광고 댓글이 display:none 으로도 잡혀 어느 기법이 정답인지 흐려지므로,
   * 글자 자체를 바꾸는 기법(닮은꼴·자모·폭0)만 든 글을 고른다.
   */
  const contentOnly = (p) =>
    p.injections.some((x) => x.where === 'comment') &&
    p.injections.filter((x) => x.where === 'comment').every((x) => x.codes.every((c) => TEXT_CODES.includes(c)));
  const picked = new Set();
  for (const p of POSTS) {
    if (picked.size >= 14 || p.secret || !contentOnly(p)) continue;
    if ([...picked].some((q) => q.page === p.page)) continue; // 쪽마다 최대 1건
    const more = Math.max(1, p.comments.length - p.injections.filter((x) => x.where === 'comment').length - 1);
    if (p.comments.length <= more) continue;
    p.commentsMoreFrom = more;
    p.collapsedGts = p.comments
      .slice(more)
      .flatMap((c) => [...String(c.html).matchAll(/data-gt="([^"]+)"/g)].map((m) => m[1]));
    if (p.collapsedGts.length) picked.add(p);
    else p.commentsMoreFrom = null;
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

/** iframe 문서에 들어갈 삽입 */
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
