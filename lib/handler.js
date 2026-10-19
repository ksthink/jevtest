/** 주소 하나를 받아 응답을 만든다. 버셀 함수와 로컬 서버가 같이 쓴다. */
const R = require('./render');
const { answerKey } = require('./answers');
const { POST_BY_ID, clampPage } = require('../data/posts');

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };

function num(sp, name) {
  return clampPage(sp.get(name) || undefined);
}

function findPost(sp, name) {
  const v = Number(sp.get(name));
  return Number.isFinite(v) ? POST_BY_ID.get(Math.trunc(v)) : undefined;
}

/**
 * @param {string} rawUrl  요청 주소(경로 + 쿼리)
 * @param {string} origin  `https://호스트` 형태의 배포 주소
 * @returns {{status:number, headers:Record<string,string>, body:string}}
 */
function handle(rawUrl, origin) {
  const url = new URL(rawUrl, origin);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const sp = url.searchParams;

  switch (path) {
    case '/':
      return { status: 200, headers: HTML, body: R.renderHome() };

    case '/about':
      return { status: 200, headers: HTML, body: R.renderAbout() };

    case '/life':
      return { status: 200, headers: HTML, body: R.renderLife() };

    case '/board/list':
      return { status: 200, headers: HTML, body: R.renderBoardList(num(sp, 'page')) };

    case '/board/view': {
      const post = findPost(sp, 'id');
      if (!post) break;
      const page = sp.get('page') ? num(sp, 'page') : post.page;
      return { status: 200, headers: HTML, body: R.renderView(post, `/board/list?page=${page}`) };
    }

    case '/jsboard/list.do':
      return { status: 200, headers: HTML, body: R.renderJsBoardList(num(sp, 'pageIndex')) };

    case '/jsboard/view.do': {
      const post = findPost(sp, 'nttId');
      if (!post) break;
      const page = sp.get('pageIndex') ? num(sp, 'pageIndex') : post.page;
      return { status: 200, headers: HTML, body: R.renderView(post, `/jsboard/list.do?bbsId=B02&pageIndex=${page}`) };
    }

    case '/gallery':
      return { status: 200, headers: HTML, body: R.renderGallery(num(sp, 'page')) };

    // '댓글 더보기'가 받아 가는 댓글 조각. 처음 HTML에 없는 댓글이 여기로 온다.
    case '/api/comments':
      return { status: 200, headers: HTML, body: R.renderMoreComments(sp.get('id')) };

    case '/iframe/ad':
      return { status: 200, headers: HTML, body: R.renderIframe(sp.get('id')) };

    case '/answer-key':
      return { status: 200, headers: HTML, body: R.renderAnswerKey(origin) };

    // 탐지 결과 파일을 올려 채점하는 화면. 채점은 브라우저에서 한다.
    case '/score':
      return { status: 200, headers: HTML, body: R.renderScore() };

    case '/api/answer-key': {
      const key = answerKey(sp.get('origin') || origin);
      const body = sp.get('format') === 'flat' ? key.expected_findings : key;
      return {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify(body, null, 2),
      };
    }

    // 탐지 도구가 --respect-robots로 돌아도 막히지 않아야 하므로 크롤링은 전부 허용한다.
    // 검색엔진 색인은 각 페이지의 <meta name="robots" content="noindex"> 로 막는다.
    case '/robots.txt':
      return {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'User-agent: *\nAllow: /\n',
      };

    case '/favicon.ico':
      return { status: 204, headers: {}, body: '' };
  }

  return { status: 404, headers: HTML, body: R.render404(path) };
}

module.exports = { handle };
