/**
 * 정답표 생성.
 *
 * `POSTS`에서 바로 뽑아내므로 페이지와 정답표가 어긋날 수 없다.
 * 절대주소가 필요하므로 `origin`(예: `https://xxx.vercel.app`)을 받는다.
 */
const { EXTRA_CODES, POSTS, POSTS_PER_PAGE, TOTAL_PAGES } = require('../data/posts');

/** 첫화면 '최근 게시물'에 나오는 글 수. `renderHome()`과 같아야 한다. */
const HOME_RECENT = 5;
const { PROFILE } = require('../data/profile');
const { PAGE_FINDINGS, PAGE_TRAPS } = require('../data/pages');



function isExtra(code) {
  return EXTRA_CODES.includes(code);
}

const trim = (o) => o.replace(/\/+$/, '');

/**
 * 글 상세 주소들.
 *
 * 요강은 쿼리 값이 다르면 다른 페이지로 본다(p.12). 그래서 사이트가 실제로 거는 링크 모양을 전부 적는다.
 * - `/board/view?id=X`                              첫화면·포토갤러리에서 들어올 때
 * - `/board/view?id=X&page=P`                       열린게시판 목록에서 들어올 때
 * - `/jsboard/view.do?nttId=X`                      주소를 바로 열 때
 * - `/jsboard/view.do?nttId=X&bbsId=B02&pageIndex=P` 자유게시판 `fn_view()`로 들어올 때
 */
function viewUrls(origin, p) {
  const o = trim(origin);
  return [
    `${o}/board/view?id=${p.id}`,
    `${o}/board/view?id=${p.id}&page=${p.page}`,
    `${o}/jsboard/view.do?nttId=${p.id}`,
    `${o}/jsboard/view.do?nttId=${p.id}&bbsId=B02&pageIndex=${p.page}`,
  ];
}

/**
 * 제목에 걸린 건이 보이는 목록 주소들.
 *
 * 자유게시판은 메뉴 링크(`bbsId`·`pageIndex`)와 쪽 넘김 폼 전송(숨은 입력 4개가 모두 붙는다)의 주소가 다르다.
 * 첫화면 '최근 게시물'에도 앞 5건의 제목이 그대로 나온다.
 */
function listUrls(origin, p) {
  const o = trim(origin);
  const urls = [
    `${o}/board/list?page=${p.page}`,
    `${o}/jsboard/list.do?bbsId=B02&pageIndex=${p.page}`,
    `${o}/jsboard/list.do?bbsId=B02&pageIndex=${p.page}&postIdx=0&recordCountPerPage=${POSTS_PER_PAGE}`,
    `${o}/gallery?page=${p.page}`,
  ];
  if (POSTS.indexOf(p) < HOME_RECENT) urls.push(`${o}/`);
  return urls;
}

function expectedFindings(origin) {
  const out = [];
  for (const p of POSTS) {
    for (const inj of p.injections) {
      const loc = `[data-gt="${inj.gt}"]`;
      let urls;
      let location = loc;
      if (inj.where === 'title') {
        urls = [...listUrls(origin, p), ...viewUrls(origin, p)];
      } else if (inj.where === 'iframe') {
        urls = viewUrls(origin, p);
        location = `iframe[src="${trim(origin)}/iframe/ad?id=${p.id}"] >>> ${loc}`;
      } else {
        urls = viewUrls(origin, p);
      }
      const collapsed = p.collapsedGts.includes(inj.gt);
      for (const code of inj.codes) {
        for (const url of urls) {
          out.push({
            gt: inj.gt,
            bucket: isExtra(code) ? 'extra' : 'main',
            code,
            url,
            location,
            evidence_text: inj.evidence,
            post_id: p.id,
            where: inj.where,
            // 'spec' = 요강 5개 분야, 'extra' = 요강 밖이지만 실제로 올라오는 유형
            scope: inj.scope || 'spec',
            domain: inj.dom || null,
            // 처음 HTML에 없고 '댓글 더보기'를 눌러야 나타나는 건.
            via: collapsed ? 'comment-more' : null,
            note: collapsed ? `${inj.note} / '댓글 더보기'를 눌러야 나타남` : inj.note,
          });
        }
      }
    }
  }
  for (const f of PAGE_FINDINGS) {
    out.push({
      gt: f.gt,
      bucket: isExtra(f.code) ? 'extra' : 'main',
      code: f.code,
      url: `${trim(origin)}${f.path}`,
      location: `[data-gt="${f.gt}"]`,
      evidence_text: f.evidence,
      post_id: 0,
      where: 'page',
      scope: 'spec',
      domain: null,
      via: null,
      note: f.note,
    });
  }
  return out;
}

function expectedAbsent(origin) {
  const out = [];
  for (const p of POSTS) {
    // 본문 함정과 댓글 함정을 모두 넣는다.
    for (const t of [...p.traps, ...p.commentTraps]) {
      for (const url of viewUrls(origin, p)) {
        out.push({
          gt: t.gt,
          url,
          location: `[data-gt="${t.gt}"]`,
          text: t.text,
          hidden: t.hidden,
          post_id: p.id,
          via: p.collapsedGts.includes(t.gt) ? 'comment-more' : null,
          note: t.note,
        });
      }
    }
  }
  for (const t of PAGE_TRAPS) {
    out.push({
      gt: t.gt,
      url: t.path === '*' ? '(모든 페이지)' : `${trim(origin)}${t.path}`,
      location: `[data-gt="${t.gt}"]`,
      text: t.text,
      hidden: t.hidden,
      post_id: 0,
      via: null,
      note: t.note,
    });
  }
  return out;
}

function answerKey(origin) {
  const findings = expectedFindings(origin);
  const absent = expectedAbsent(origin);
  const byCode = {};
  // 같은 gt가 여러 주소에 나오므로 gt 단위로도 센다.
  const gtSeen = new Set();
  for (const f of findings) {
    const key = `${f.gt}:${f.code}`;
    if (gtSeen.has(key)) continue;
    gtSeen.add(key);
    byCode[f.code] = (byCode[f.code] || 0) + 1;
  }
  const byScope = { spec: 0, extra: 0 };
  const scopeSeen = new Set();
  for (const f of findings) {
    const key = `${f.gt}:${f.code}`;
    if (scopeSeen.has(key)) continue;
    scopeSeen.add(key);
    byScope[f.scope] = (byScope[f.scope] || 0) + 1;
  }

  return {
    generated_for: trim(origin),
    // 분야 분포 프로필. 프로필이 다르면 글도 정답표도 다르다.
    profile: { name: PROFILE.name, label: PROFILE.label, note: PROFILE.note },
    schema: 'board-fixture/answer-key/1',
    note:
      '탐지 도구가 보고한 location 선택자가 가리키는 요소의 data-gt 속성이 gt와 같으면 정답으로 센다. ' +
      'expected_absent에 있는 gt가 결과에 나오면 오탐이다. ' +
      "scope가 'extra'인 건은 요강 5개 분야(도박·성인·불법대출·마약·불법거래) 밖이다. " +
      '실제 공공기관 누리집에 올라오는 유형이라 넣어 두었지만 적격평가 대상은 아니므로 따로 집계한다.',
    counts: {
      posts: POSTS.length,
      pages: TOTAL_PAGES,
      unique_findings: gtSeen.size,
      by_code: byCode,
      // 요강 5개 분야 / 요강 밖 유형
      by_scope: byScope,
      traps: new Set(absent.map((a) => a.gt)).size,
    },
    expected_findings: findings,
    expected_absent: absent,
  };
}

module.exports = { expectedFindings, expectedAbsent, answerKey, HOME_RECENT };
