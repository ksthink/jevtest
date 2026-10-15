/**
 * 정답표 생성.
 *
 * `POSTS`에서 바로 뽑아내므로 페이지와 정답표가 어긋날 수 없다.
 * 절대주소가 필요하므로 `origin`(예: `https://xxx.vercel.app`)을 받는다.
 */
const { EXTRA_CODES, POSTS, TOTAL_PAGES } = require('../data/posts');
const { PAGE_FINDINGS, PAGE_TRAPS } = require('../data/pages');



function isExtra(code) {
  return EXTRA_CODES.includes(code);
}

const trim = (o) => o.replace(/\/+$/, '');

/** 글 상세 주소들. 같은 글을 보여 주는 게시판이 두 개라 둘 다 적는다. */
function viewUrls(origin, p) {
  return [`${trim(origin)}/board/view?id=${p.id}`, `${trim(origin)}/jsboard/view.do?nttId=${p.id}`];
}

/** 제목에 걸린 건이 보이는 목록 주소들. */
function listUrls(origin, p) {
  const o = trim(origin);
  return [`${o}/board/list?page=${p.page}`, `${o}/jsboard/list.do?bbsId=B02&pageIndex=${p.page}`, `${o}/gallery?page=${p.page}`];
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
  return {
    generated_for: trim(origin),
    schema: 'board-fixture/answer-key/1',
    note:
      '탐지 도구가 보고한 location 선택자가 가리키는 요소의 data-gt 속성이 gt와 같으면 정답으로 센다. ' +
      'expected_absent에 있는 gt가 결과에 나오면 오탐이다.',
    counts: {
      posts: POSTS.length,
      pages: TOTAL_PAGES,
      unique_findings: gtSeen.size,
      by_code: byCode,
      traps: new Set(absent.map((a) => a.gt)).size,
    },
    expected_findings: findings,
    expected_absent: absent,
  };
}

module.exports = { expectedFindings, expectedAbsent, answerKey };
