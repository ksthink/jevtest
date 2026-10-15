/** 페이지 HTML 조립. 외부 라이브러리 없이 문자열로 만든다. */
const { STYLE } = require('./style');
const {
  POSTS, POST_BY_ID, POSTS_PER_PAGE, TOTAL_PAGES, TOTAL_POSTS,
  postsOnPage, clampPage, bodyInjections, iframeInjections, MAIN_CODES, EXTRA_CODES,
} = require('../data/posts');
const { answerKey } = require('./answers');

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ESCAPE[ch]);

const MENU = [
  ['/', '누리집 첫화면'],
  ['/board/list?page=1', '열린게시판'],
  ['/jsboard/list.do?bbsId=B02&pageIndex=1', '자유게시판'],
  ['/gallery?page=1', '포토갤러리'],
  ['/life', '생활정보'],
  ['/about', '기관소개'],
  ['/answer-key', '정답표(검증용)'],
];

/**
 * 공용 틀.
 *
 * `noindex`로 검색엔진 색인만 막는다. robots.txt는 전부 허용하므로 탐지 도구에는 영향이 없다.
 */
function layout(title, body, extraHead = '') {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${esc(title)} | 가상시청</title>
<style>${STYLE}</style>${extraHead}
</head>
<body>
<!-- 화면낭독기용 건너뛰기 링크. 숨겨져 있지만 불법광고가 아니다 -> 검출되면 오탐(N00). -->
<a href="#content" class="blind" data-gt="N00">본문 바로가기</a>
<header class="gnb">
  <div class="inner"><h1><a href="/">가상시청</a></h1></div>
  <nav class="menu"><ul>${MENU.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></nav>
</header>
<main class="wrap" id="content">
${body}
</main>
<footer class="foot"><div class="inner">
가상시청 (우)00000 가상시 가상구 가상로 1 · 대표전화 000-000-0000<br>
불법광고 탐지 도구 시험용 모사 사이트입니다. 실제 기관·업체와 관련이 없습니다.
</div></footer>
</body>
</html>`;
}

// ------------------------------------------------------------------ 첫화면

function renderHome() {
  const recent = POSTS.slice(0, 5)
    .map((p) => `<li><a href="/board/view?id=${p.id}">${p.titleHtml}</a> <span class="view-meta">(${p.date})</span></li>`)
    .join('');
  return layout(
    '누리집 첫화면',
    `<div class="notice-box">
<h3>이 사이트는 무엇인가요</h3>
공공기관 누리집 게시판을 모사한 <strong>시험용 사이트</strong>입니다. 불법광고 탐지 도구를 검증하려고 만들었고,
게시글 ${TOTAL_POSTS}건(${TOTAL_PAGES}쪽, 한 쪽에 ${POSTS_PER_PAGE}건) 가운데 일부에 위장·은닉한 가짜 광고를 심어 두었습니다.
실제 기관·업체·연락처와는 관련이 없습니다. 심어 둔 위치와 기법은 <a href="/answer-key">정답표</a>에서 확인할 수 있습니다.
</div>

<h2 class="page-title">알림마당</h2>
<p>게시판 유형별 시험 대상:
<a href="/board/list?page=1">열린게시판(주소형 쪽넘김)</a> ·
<a href="/jsboard/list.do?bbsId=B02&amp;pageIndex=1">자유게시판(자바스크립트 쪽넘김)</a> ·
<a href="/gallery?page=1">포토갤러리(카드형)</a></p>

<!-- 쪽넘김이 없는 '최근 게시물' 목록. 게시판으로 오인하면 안 된다. -->
<h3>최근 게시물</h3>
<ul>${recent}</ul>

<h3>기관 안내</h3>
<ul>
<li><a href="/about">기관 소개</a></li>
<li><a href="/life">생활정보 (오탐 함정 모음)</a></li>
<li><a href="/api/answer-key">정답표 JSON</a></li>
</ul>

<!-- 게시판 밖에 숨긴 광고 1건(G00). 게시판이 아닌 주소로 시작했을 때 사이트 전체를 훑는지 본다. -->
<div style="position:absolute;left:-9999px" data-gt="G00"><a href="http://ad-g00.example.test/">먹튀 없는 메이저 토토사이트 주소 안내</a></div>`
  );
}

// ------------------------------------------------------------------ 목록

function paging(page, href) {
  const nums = [];
  for (let n = 1; n <= TOTAL_PAGES; n++) {
    nums.push(n === page ? `<strong aria-current="page">${n}</strong>` : `<a href="${href(n)}">${n}</a>`);
  }
  return `<div class="paging">${page > 1 ? `<a href="${href(page - 1)}">이전</a>` : ''}${nums.join('')}${
    page < TOTAL_PAGES ? `<a href="${href(page + 1)}">다음</a>` : ''
  }</div>`;
}

const THEAD = '<thead><tr><th scope="col">번호</th><th scope="col">제목</th><th scope="col">작성부서</th><th scope="col">등록일</th><th scope="col">조회</th></tr></thead>';

function rows(page, link) {
  return postsOnPage(page)
    .map((p) => {
      const title = p.secret
        ? `<span class="lock" title="비밀글">[비밀]</span> ${p.titleHtml} <span class="lock">(비밀글)</span>`
        : link(p, page);
      return `<tr><td>${p.no}</td><td class="title">${title}</td><td>${p.author}</td><td>${p.date}</td><td>${p.hits}</td></tr>`;
    })
    .join('');
}

/** 일반 주소형 게시판. 쪽 번호 변수는 `page`. */
function renderBoardList(page) {
  return layout(
    '열린게시판',
    `<h2 class="page-title">열린게시판</h2>
<p class="view-meta">전체 ${TOTAL_POSTS}건 · ${page}/${TOTAL_PAGES}쪽 · 주소형 쪽넘김(<code>?page=</code>)</p>
<table class="board-list"><caption class="sr-only">게시글 목록</caption>${THEAD}
<tbody>${rows(page, (p) => `<a href="/board/view?id=${p.id}&amp;page=${page}">${p.titleHtml}</a>`)}</tbody></table>
${paging(page, (n) => `/board/list?page=${n}`)}
<p class="view-meta">게시판 운영 안내: 광고·도박 홍보 글은 통보 없이 삭제합니다.</p>`
  );
}

/**
 * 전자정부 표준프레임워크형 게시판 흉내.
 *
 * - 글 링크가 `javascript:fn_view('1001')` 이라 주소만 보고는 알 수 없다.
 * - 쪽 넘김도 `javascript:fn_egov_link_page(2)` 이고 실제로는 폼을 보낸다.
 * - 쪽 번호 변수 이름이 `pageIndex`로 다르고, 시작 주소에만 있는 값(`postIdx=0`)이 섞여 있다.
 */
function renderJsBoardList(page) {
  const nums = [];
  for (let n = 1; n <= TOTAL_PAGES; n++) {
    nums.push(
      n === page
        ? `<strong aria-current="page">${n}</strong>`
        : `<a href="javascript:fn_egov_link_page(${n});" onclick="fn_egov_link_page(${n});return false;">${n}</a>`
    );
  }
  const link = (p) =>
    `<a href="javascript:fn_view('${p.id}');" onclick="fn_view('${p.id}');return false;" data-nttid="${p.id}">${p.titleHtml}</a>`;

  return layout(
    '자유게시판',
    `<h2 class="page-title">자유게시판</h2>
<p class="view-meta">전체 ${TOTAL_POSTS}건 · ${page}/${TOTAL_PAGES}쪽 · 자바스크립트 글 링크·쪽넘김(<code>fn_egov_link_page</code>, <code>pageIndex</code>)</p>
<form name="listForm" id="listForm" method="get" action="/jsboard/list.do">
  <input type="hidden" name="bbsId" value="B02">
  <input type="hidden" name="pageIndex" id="pageIndex" value="${page}">
  <input type="hidden" name="postIdx" value="0">
  <input type="hidden" name="recordCountPerPage" value="${POSTS_PER_PAGE}">
</form>
<table class="board-list"><caption class="sr-only">자유게시판 목록</caption>${THEAD}
<tbody>${rows(page, link)}</tbody></table>
<div class="paging">
${page > 1 ? `<a href="javascript:fn_egov_link_page(${page - 1});" onclick="fn_egov_link_page(${page - 1});return false;">이전</a>` : ''}
${nums.join('')}
${page < TOTAL_PAGES ? `<a href="javascript:fn_egov_link_page(${page + 1});" onclick="fn_egov_link_page(${page + 1});return false;">다음</a>` : ''}
</div>
<script>
function fn_egov_link_page(pageNo){
  document.getElementById('pageIndex').value = pageNo;
  document.getElementById('listForm').submit();
}
function fn_view(nttId){
  location.href = '/jsboard/view.do?nttId=' + nttId + '&bbsId=B02&pageIndex=' + document.getElementById('pageIndex').value;
}
</script>`
  );
}

/** 사진·카드형 게시판. 목록이 표가 아니라 카드다. */
function renderGallery(page) {
  const cards = postsOnPage(page)
    .map(
      (p) => `<li><a href="/board/view?id=${p.id}" style="text-decoration:none;color:inherit">
<div class="thumb" role="img" aria-label="사진"></div>
<div class="cap">${p.titleHtml}<br><span class="view-meta">${p.author} · ${p.date}</span></div></a></li>`
    )
    .join('');
  return layout(
    '포토갤러리',
    `<h2 class="page-title">포토갤러리</h2>
<p class="view-meta">전체 ${TOTAL_POSTS}건 · ${page}/${TOTAL_PAGES}쪽 · 카드형 목록</p>
<ul class="cards">${cards}</ul>
${paging(page, (n) => `/gallery?page=${n}`)}`
  );
}

// ------------------------------------------------------------------ 글 상세

/**
 * 댓글 한 건.
 *
 * 숨김 라벨('이 댓글 신고하기')은 실제 누리집에 흔한 접근성 요소다. 숨겨져 있지만
 * 불법광고가 아니므로 검출되면 오탐이다.
 */
function commentHtml(c) {
  return (
    `<div class="cmt${c.official ? ' official' : ''}">` +
    `<span class="who">${esc(c.author)}</span><span class="view-meta">${c.date}</span>` +
    `<div class="cmt-body">${c.html}</div>` +
    `<a href="#report" class="sr-only">이 댓글 신고하기</a>` +
    `</div>`
  );
}

function renderView(post, backHref) {
  if (post.secret) {
    return layout(
      '비밀글 확인',
      `<h2 class="page-title">비밀글 확인</h2>
<div class="box">
<p>비밀글입니다. 작성자 본인 또는 담당자만 볼 수 있습니다.</p>
<form action="#" method="post"><label for="pw">비밀번호</label> <input id="pw" name="pw" type="password"> <button type="submit">확인</button></form>
<p class="view-meta">글 번호 ${post.no} · 내용 확인 불가</p>
</div>
<div class="btns"><a href="${backHref}">목록</a></div>`
    );
  }

  const all = bodyInjections(post);
  // `.same` 변형은 배경색이 같은 조상 요소(.box) 안에 있어야 투명해진다.
  const inBox = all.filter((x) => x.html.includes('class="same"'));
  const body = all.filter((x) => !inBox.includes(x));
  const iframes = iframeInjections(post);

  const one = commentHtml;

  const more = post.commentsMoreFrom;
  const comments =
    more === null
      ? post.comments.map(one).join('\n')
      : // '댓글 더보기'. 접힌 댓글은 처음 HTML에 아예 없고, 누르면 서버에서 받아 와 붙는다.
        // (숨긴 채로 두면 그 광고 댓글이 display:none 으로도 잡혀 기법이 흐려진다.)
        post.comments.slice(0, more).map(one).join('\n') +
        `\n<div id="cmt-more-${post.id}"></div>` +
        `\n<div class="btns"><button type="button" id="cmt-more-btn-${post.id}" data-id="${post.id}">댓글 더보기 (${
          post.comments.length - more
        })</button></div>` +
        `\n<script>
(function(){
  var b = document.getElementById('cmt-more-btn-${post.id}');
  var box = document.getElementById('cmt-more-${post.id}');
  b.addEventListener('click', function(){
    fetch('/api/comments?id=${post.id}').then(function(r){ return r.text(); }).then(function(html){
      box.innerHTML = html;
      b.parentNode.removeChild(b);
    });
  });
})();
</script>`;

  return layout(
    '게시글 보기',
    `<h2 class="page-title">게시글 보기</h2>
<div class="view-head">
<h3>${post.titleHtml}</h3>
<p class="view-meta">작성부서 ${post.author} · 등록일 ${post.date} · 조회 ${post.hits} · 글번호 ${post.no}</p>
</div>
<div class="view-body">
${post.body.map((t) => `<p>${esc(t)}</p>`).join('\n')}
${body.map((x) => x.html).join('\n')}
<div class="box"><p>담당 부서: ${post.author} / 전화 000-000-0000</p>
${inBox.map((x) => x.html).join('\n')}</div>
${post.traps.map((t) => t.html).join('\n')}
${
  iframes.length
    ? `<p class="view-meta">관련 배너</p>
<iframe src="/iframe/ad?id=${post.id}" title="관련 배너" width="600" height="90" style="border:1px solid #ddd"></iframe>`
    : post.id % 11 === 0
      ? `<!-- 광고가 없는 정상 iframe. iframe이 있다는 이유만으로 검출하면 안 된다. -->
<iframe src="/iframe/ad?id=0" title="시정 소식" width="600" height="90" style="border:1px solid #ddd"></iframe>`
      : ''
}
</div>
<h3>댓글 ${post.comments.length}</h3>
${post.comments.length ? comments : '<p class="view-meta">등록된 댓글이 없습니다.</p>'}
<form action="#" method="post" style="margin-top:12px">
<label for="cmt" class="sr-only">댓글 내용</label>
<textarea id="cmt" name="cmt" rows="2" cols="60"></textarea> <button type="submit">댓글 등록</button>
</form>
<div class="btns"><a href="${backHref}">목록</a></div>`
  );
}

/** '댓글 더보기'를 눌렀을 때 서버가 돌려주는 댓글 조각. */
function renderMoreComments(id) {
  const post = POST_BY_ID.get(Number(id));
  if (!post || post.commentsMoreFrom === null) return '';
  return post.comments.slice(post.commentsMoreFrom).map(commentHtml).join('\n');
}

/**
 * iframe 안에 들어가는 문서. 공용 머리글·꼬리글을 넣지 않는다.
 * 검출 위치는 바깥 페이지 기준으로 `iframe[src="..."] >>> 선택자` 로 적어야 한다.
 */
function renderIframe(id) {
  const post = POST_BY_ID.get(Number(id));
  const injections = post ? iframeInjections(post) : [];
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>가상시 시정소식</title>
<meta name="robots" content="noindex,nofollow">
<style>
body{margin:0;padding:8px;font:14px/1.5 sans-serif;background:#fff;color:#1f2328}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.same{color:#f4f6f8}
</style></head>
<body>
<strong>가상시 시정소식</strong> &mdash; 이번 주 알림: 무더위쉼터 운영 시간이 늘어납니다.
${injections.map((x) => x.html).join('\n')}
</body></html>`;
}

// ------------------------------------------------------------------ 기관소개 / 생활정보

function renderAbout() {
  return layout(
    '기관 소개',
    `<h2 class="page-title">기관 소개</h2>
<p>가상시청은 존재하지 않는 기관입니다. 이 페이지는 탐지 도구가 게시판이 아닌 일반 페이지도 훑는지 보기 위한 것입니다.</p>
<h3>연혁</h3>
<ul>
<li>1998년 조례로 영산동·부덕동을 영산동으로 통폐합</li>
<li data-gt="N40">야동(冶洞) 마을 경로당을 증축하고 다소출장소를 폐지</li>
<li data-gt="N41">관광진흥법에 따른 관광사업(여행업 및 카지노업 제외) 등록 업무를 이관</li>
</ul>
<h3>게시판 운영 안내</h3>
<p data-gt="N42">광고·홍보성 글과 도박·성인물 관련 글은 통보 없이 삭제하며 이용을 제한할 수 있습니다. 불법 광고를 발견하면 담당 부서로 신고해 주세요.</p>`
  );
}

/**
 * 오탐 함정 모음.
 *
 * 공공기관 누리집에 실제로 흔한 패턴만 모았다. 접힌 메뉴·탭·아코디언·팝업·슬라이더처럼
 * "숨겨져 있지만 정상"인 글과, 보이지만 약한 키워드가 든 행정·보도·법령 문구다.
 * 이 페이지의 `data-gt`가 하나라도 결과 파일에 나오면 오탐이다.
 */
function renderLife() {
  return layout(
    '생활정보',
    `<h2 class="page-title">생활정보</h2>
<p class="view-meta">이 페이지에서 잡히는 검출은 모두 오탐입니다. (정답표의 expected_absent 참고)</p>

<ul class="gnb">
<li>평생학습<ul class="gnb-sub">
  <li><a href="#adult" data-gt="N50">성인 문해교육 수강생 모집 바로가기</a></li>
  <li><a href="#senior" data-gt="N51">어르신 만남의 광장 프로그램 바로가기</a></li></ul></li>
<li>복지<ul class="gnb-sub">
  <li><a href="#massage" data-gt="N52">시각장애인 안마사 일자리 지원 바로가기</a></li>
  <li><a href="#gamble" data-gt="N53">한국도박문제예방치유원 상담 안내 바로가기</a></li></ul></li>
<li>안전<ul class="gnb-sub">
  <li><a href="#park" data-gt="N54">어린이 놀이터 안전점검 결과 바로가기</a></li></ul></li>
</ul>

<div class="tabs">
<div class="tab-panel on">이달의 행사 안내입니다.</div>
<div class="tab-panel" data-gt="N55">성인병 예방 건강강좌 신청 주소 안내</div>
<div class="tab-panel" data-gt="N56">생활체육 야구 교실 참가 신청 안내</div>
</div>

<div class="acc"><button type="button">자주 묻는 질문</button>
<div class="acc-body" data-gt="N57">도박 중독이 의심되면 국번 없이 1336으로 상담하세요. 불법 토토사이트 이용은 처벌 대상입니다.</div></div>

<div class="modal" data-gt="N58">불법 사행성 게임장 신고 포상금 안내입니다. 불법 카지노·바카라 영업을 발견하면 신고해 주세요.</div>

<div class="slider">
<div class="slide">불법도박 근절 캠페인 안내</div>
<div class="slide prev" data-gt="N59">온라인 불법도박 예방 교육 신청 안내</div>
</div>

<h3 class="ir" data-gt="N60">성인 평생교육 강좌 목록</h3>

<h3>보도자료·안내</h3>
<ul>
<li data-gt="N61">경찰, 불법 온라인 카지노 조직 검거… 도박 사이트 30곳 폐쇄</li>
<li data-gt="N62">체육진흥투표권(스포츠토토) 수익금으로 공공 체육시설을 짓습니다.</li>
<li data-gt="N63">폐광지역 관광 코스로 강원랜드 카지노 일대를 소개합니다.</li>
<li data-gt="N64">성인 세대주 기준 주민세 부과 안내</li>
<li data-gt="N65">마약류 오남용 예방 교육 강사 양성 과정 수강생 모집</li>
<li data-gt="N66">불법 대출 광고 피해 예방 수칙 안내 자료를 배포합니다.</li>
<li data-gt="N67">대포통장 명의 대여 범죄 예방 캠페인 참여 안내</li>
<li data-gt="N68">분야 동향 보고서와 첫 충전 요금제 비교 자료를 함께 올립니다.</li>
<li data-gt="N69">한글 교실: ㄱ ㄴ ㄷ ㄹ 자음과 ㅏ ㅑ ㅓ ㅕ 모음 익히기</li>
<li data-gt="N70">（주）가상시관광공사 ＫＴＸ 연계 투어 안내</li>
</ul>

<form action="#" method="get">
<label for="q" class="sr-only" data-gt="N71">검색어를 입력하세요</label>
<input id="q" name="q"> <button type="submit">검색</button>
</form>`
  );
}

// ------------------------------------------------------------------ 정답표 화면

function renderAnswerKey(origin) {
  const key = answerKey(origin);

  const byGt = new Map();
  for (const f of key.expected_findings) {
    const g = byGt.get(f.gt) || { gt: f.gt, codes: new Set(), where: f.where, evidence: f.evidence_text, note: f.note, urls: new Set() };
    g.codes.add(f.code);
    g.urls.add(f.url);
    byGt.set(f.gt, g);
  }
  const rows = [...byGt.values()].sort((a, b) => a.gt.localeCompare(b.gt));

  const absentByGt = new Map();
  for (const a of key.expected_absent) if (!absentByGt.has(a.gt)) absentByGt.set(a.gt, a);
  const absent = [...absentByGt.values()].sort((a, b) => a.gt.localeCompare(b.gt));

  const count = (c) => key.counts.by_code[c] || 0;

  // 위치별 집계 (gt+기법 단위)
  const perWhere = {};
  const seenW = new Set();
  for (const f of key.expected_findings) {
    const k2 = `${f.gt}|${f.code}`;
    if (seenW.has(k2)) continue;
    seenW.add(k2);
    perWhere[f.where] = (perWhere[f.where] || 0) + 1;
  }
  const WHERE_KO = { title: '제목', body: '본문', comment: '댓글', iframe: 'iframe 안', page: '게시판 밖 페이지' };

  return layout(
    '정답표',
    `<h2 class="page-title">정답표 (검증용)</h2>
<div class="notice-box">
<h3>읽는 방법</h3>
페이지 HTML의 <code>data-gt</code> 속성이 채점 표식입니다. 탐지 도구가 보고한 <code>location</code> 선택자가 가리키는 요소의
<code>data-gt</code>가 아래 <code>gt</code>와 같으면 정답(TP)입니다.<br>
<strong>함정</strong> 표의 <code>gt</code>가 결과 파일에 나오면 오탐(FP)입니다.<br>
검출은 제목·본문·<strong>댓글</strong>·iframe 안에 들어 있습니다. 댓글 2건은
<strong>'댓글 더보기'를 눌러야</strong> 나타납니다(처음 HTML에는 없고 <code>/api/comments?id=</code>로 받아 옵니다).
정답표의 <code>via: "comment-more"</code>가 그 건입니다.<br>
댓글마다 <code>이 댓글 신고하기</code> 숨김 링크(<code>sr-only</code>)가 있습니다. 숨겨져 있지만 정상이라 검출되면 오탐입니다.<br>
기계가 읽을 형태: <a href="/api/answer-key">/api/answer-key</a> · 검출 목록만: <a href="/api/answer-key?format=flat">/api/answer-key?format=flat</a>
</div>

<h3>요약</h3>
<ul>
<li>게시글 ${key.counts.posts}건 / ${key.counts.pages}쪽 (한 쪽에 ${POSTS_PER_PAGE}건)</li>
<li>심어 둔 검출 ${key.counts.unique_findings}건, 함정 ${key.counts.traps}건</li>
<li>위치별: ${Object.entries(perWhere).map(([k2, v]) => `${WHERE_KO[k2] || k2} ${v}`).join(' · ')}</li>
<li>적격평가 4종(<code>result.json</code>): ${MAIN_CODES.map((c) => `${c} ${count(c)}`).join(' · ')}</li>
<li>추가 유형(<code>result_extra.json</code>): ${EXTRA_CODES.map((c) => `${c} ${count(c)}`).join(' · ')}</li>
</ul>

<h3>검출되어야 하는 것 (${rows.length}건)</h3>
<table class="answer">
<thead><tr><th>gt</th><th>유형</th><th>위치</th><th>기법</th><th>원문(evidence_text)</th><th>주소 수</th></tr></thead>
<tbody>${rows
      .map(
        (r) =>
          `<tr><td><code>${r.gt}</code></td><td>${[...r.codes].join(' + ')}</td><td>${WHERE_KO[r.where] || r.where}</td><td>${esc(r.note)}</td><td>${esc(r.evidence)}</td><td>${r.urls.size}</td></tr>`
      )
      .join('')}</tbody></table>

<h3>검출되면 오탐인 것 (${absent.length}건)</h3>
<table class="answer">
<thead><tr><th>gt</th><th>숨김</th><th>글</th><th>왜 정상인가</th></tr></thead>
<tbody>${absent
      .map((a) => `<tr><td><code>${a.gt}</code></td><td>${a.hidden ? '숨김' : '노출'}</td><td>${esc(a.text)}</td><td>${esc(a.note)}</td></tr>`)
      .join('')}</tbody></table>`
  );
}

function render404(path) {
  return layout('페이지를 찾을 수 없습니다', `<h2 class="page-title">페이지를 찾을 수 없습니다</h2>
<p>요청하신 주소를 찾지 못했습니다: <code>${esc(path)}</code></p>
<p><a href="/">첫화면으로</a></p>`);
}

module.exports = {
  layout, esc, clampPage, POST_BY_ID,
  renderHome, renderBoardList, renderJsBoardList, renderGallery, renderView,
  renderIframe, renderMoreComments, renderAbout, renderLife, renderAnswerKey, render404,
};
