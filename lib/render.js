/** 페이지 HTML 조립. 외부 라이브러리 없이 문자열로 만든다. */
const { STYLE } = require('./style');
const {
  POSTS, POST_BY_ID, POSTS_PER_PAGE, TOTAL_PAGES, TOTAL_POSTS,
  postsOnPage, clampPage, bodyInjections, iframeInjections, MAIN_CODES, EXTRA_CODES,
} = require('../data/posts');
const { answerKey, HOME_RECENT } = require('./answers');
const { PROFILE } = require('../data/profile');
const { createScorer } = require('./score-core');

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
  ['/score', '결과 채점'],
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
<!-- 화면낭독기용 건너뛰기 링크. 숨겨져 있지만 불법광고가 아니다 -> 검출되면 오탐(PT00). -->
<a href="#content" class="blind" data-gt="PT00">본문 바로가기</a>
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
  const recent = POSTS.slice(0, HOME_RECENT)
    .map((p) => `<li><a href="/board/view?id=${p.id}">${p.titleHtml}</a> <span class="view-meta">(${p.date})</span></li>`)
    .join('');
  return layout(
    '누리집 첫화면',
    `<div class="notice-box">
<h3>이 사이트는 무엇인가요</h3>
공공기관 누리집 게시판을 모사한 <strong>시험용 사이트</strong>입니다. 불법광고 탐지 도구를 검증하려고 만들었고,
게시글 ${TOTAL_POSTS}건(${TOTAL_PAGES}쪽, 한 쪽에 ${POSTS_PER_PAGE}건) 가운데 일부에 위장·은닉한 가짜 광고를 심어 두었습니다.
실제 기관·업체·연락처와는 관련이 없습니다. 심어 둔 위치와 기법은 <a href="/answer-key">정답표</a>에서 확인할 수 있습니다.
<br><strong>분야 분포:</strong> ${PROFILE.label} (<code>${PROFILE.name}</code>) &mdash; ${PROFILE.note}
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
<div style="position:absolute;left:-9999px" data-gt="PG01"><a href="http://ad-g00.example.test/">먹튀 없는 메이저 토토사이트 주소 안내</a></div>`
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
<li data-gt="PT01">야동(冶洞) 마을 경로당을 증축하고 다소출장소를 폐지</li>
<li data-gt="PT02">관광진흥법에 따른 관광사업(여행업 및 카지노업 제외) 등록 업무를 이관</li>
</ul>
<h3>게시판 운영 안내</h3>
<p data-gt="PT03">광고·홍보성 글과 도박·성인물 관련 글은 통보 없이 삭제하며 이용을 제한할 수 있습니다. 불법 광고를 발견하면 담당 부서로 신고해 주세요.</p>`
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
  <li><a href="#adult" data-gt="PT04">성인 문해교육 수강생 모집 바로가기</a></li>
  <li><a href="#senior" data-gt="PT05">어르신 만남의 광장 프로그램 바로가기</a></li></ul></li>
<li>복지<ul class="gnb-sub">
  <li><a href="#massage" data-gt="PT06">시각장애인 안마사 일자리 지원 바로가기</a></li>
  <li><a href="#gamble" data-gt="PT07">한국도박문제예방치유원 상담 안내 바로가기</a></li></ul></li>
<li>안전<ul class="gnb-sub">
  <li><a href="#park" data-gt="PT08">어린이 놀이터 안전점검 결과 바로가기</a></li></ul></li>
</ul>

<div class="tabs">
<div class="tab-panel on">이달의 행사 안내입니다.</div>
<div class="tab-panel" data-gt="PT09">성인병 예방 건강강좌 신청 주소 안내</div>
<div class="tab-panel" data-gt="PT10">생활체육 야구 교실 참가 신청 안내</div>
</div>

<div class="acc"><button type="button">자주 묻는 질문</button>
<div class="acc-body" data-gt="PT11">도박 중독이 의심되면 국번 없이 1336으로 상담하세요. 불법 토토사이트 이용은 처벌 대상입니다.</div></div>

<div class="modal" data-gt="PT12">불법 사행성 게임장 신고 포상금 안내입니다. 불법 카지노·바카라 영업을 발견하면 신고해 주세요.</div>

<div class="slider">
<div class="slide">불법도박 근절 캠페인 안내</div>
<div class="slide prev" data-gt="PT13">온라인 불법도박 예방 교육 신청 안내</div>
</div>

<h3 class="ir" data-gt="PT14">성인 평생교육 강좌 목록</h3>

<h3>보도자료·안내</h3>
<ul>
<li data-gt="PT15">경찰, 불법 온라인 카지노 조직 검거… 도박 사이트 30곳 폐쇄</li>
<li data-gt="PT16">체육진흥투표권(스포츠토토) 수익금으로 공공 체육시설을 짓습니다.</li>
<li data-gt="PT17">폐광지역 관광 코스로 강원랜드 카지노 일대를 소개합니다.</li>
<li data-gt="PT18">성인 세대주 기준 주민세 부과 안내</li>
<li data-gt="PT19">마약류 오남용 예방 교육 강사 양성 과정 수강생 모집</li>
<li data-gt="PT20">불법 대출 광고 피해 예방 수칙 안내 자료를 배포합니다.</li>
<li data-gt="PT21">대포통장 명의 대여 범죄 예방 캠페인 참여 안내</li>
<li data-gt="PT22">분야 동향 보고서와 첫 충전 요금제 비교 자료를 함께 올립니다.</li>
<li data-gt="PT23">한글 교실: ㄱ ㄴ ㄷ ㄹ 자음과 ㅏ ㅑ ㅓ ㅕ 모음 익히기</li>
<li data-gt="PT24">（주）가상시관광공사 ＫＴＸ 연계 투어 안내</li>
</ul>

<form action="#" method="get">
<label for="q" class="sr-only" data-gt="PT25">검색어를 입력하세요</label>
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
<li>분야 분포 프로필: <strong>${PROFILE.label}</strong> (<code>${PROFILE.name}</code>) &mdash; ${PROFILE.note}</li>
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

// ------------------------------------------------------------------ 결과 채점

const SCORE_STYLE = `<style>
.drop{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0}
.drop label{display:block;border:2px dashed var(--line);padding:16px;background:var(--soft);cursor:pointer}
.drop label.on{border-color:var(--brand);background:#eef3fa}
.drop strong{display:block;margin-bottom:4px}
.drop input{margin-top:8px;max-width:100%}
.drop .file{display:block;margin-top:6px;font-size:13px;color:#555;word-break:break-all}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:14px 0}
.stat{border:1px solid var(--line);padding:10px 12px}
.stat .t{font-size:13px;font-weight:600}
.stat .v{font-size:22px;font-weight:700;color:var(--brand)}
.stat .l{font-size:13px;color:#555}
.stat.bad .v{color:#b42318}
.bar{display:inline-block;vertical-align:middle;width:120px;height:8px;background:var(--soft);margin-right:8px}
.bar i{display:block;height:100%;background:var(--brand)}
.err{color:#b42318}
.warn{color:#9a6700}
.ok{color:#1a7f37}
ul.issues{margin:6px 0;padding-left:20px;font-size:14px}
.scroll{overflow-x:auto}
table.answer td.ev{word-break:break-all;min-width:140px}
details{margin:10px 0}
details summary{cursor:pointer;font-weight:600}
</style>`;

/**
 * 탐지 결과 파일을 올려 요강 기준으로 채점하는 화면.
 *
 * 채점은 브라우저 안에서 한다. 올린 파일은 서버로 보내지 않는다.
 * location 선택자는 이 사이트의 페이지를 받아 DOM에 직접 대 보고, 정확히 1개 요소를 가리키는지 본다.
 */
function renderScore() {
  return layout(
    '결과 채점',
    `<h2 class="page-title">결과 채점 (검증용)</h2>
<div class="notice-box">
<h3>쓰는 방법</h3>
탐지 도구가 만든 <code>result.json</code>과 <code>result_extra.json</code>을 올리고 <strong>채점하기</strong>를 누릅니다.
둘 중 하나만 올려도 됩니다. 파일은 이 브라우저 안에서만 읽고 서버로 보내지 않습니다.
<h3 style="margin-top:10px">채점 기준 (모집요강 붙임2·붙임4)</h3>
<ul class="issues">
<li>파일: UTF-8(BOM 없음) JSON, 최상위 키는 <code>meta</code>·<code>findings</code> 두 개, <code>findings</code>는 단일 배열</li>
<li>필수 필드가 빠졌거나 타입·값이 스키마와 다른 항목은 채점에서 빼고, 정확도 계산에서는 오답으로 셉니다</li>
<li><code>url</code>·<code>location</code>·<code>technique</code> 세 필드가 모두 정답셋과 같아야 정답이고, 세 필드가 같은 항목은 1건으로 합칩니다</li>
<li>url은 끝의 <code>/</code>, http/https, <code>#</code> 이하만 무시합니다. 쿼리 값이 다르면 다른 페이지입니다(항목 순서는 무관)</li>
<li>location은 이 사이트의 페이지에 실제로 대 봅니다. 같은 요소를 정확히 1개 가리켜야 하고, 둘 이상이면 오답입니다.
iframe 안은 <code>iframe[src="절대주소"] &gt;&gt;&gt; 선택자</code>로 적어야 합니다. 「댓글 더보기」는 펼친 상태로 봅니다</li>
<li>검출 시간은 <code>meta.elapsed_sec</code>로 보고, 30분을 넘으면 0점입니다</li>
</ul>
정답셋은 <code>meta.entry_url</code>의 주소로 만든 <a href="/answer-key">정답표</a>입니다. 같은 사이트를 다른 주소로 띄워 검사했어도 채점할 수 있습니다.
같은 분야 분포 프로필로 띄운 사이트에서 채점해야 합니다.
</div>

<form id="score-form">
<div class="drop">
<label id="drop-main"><strong>result.json</strong>적격평가 4종 결과
<input type="file" id="file-main" accept=".json,application/json"><span class="file" id="name-main"></span></label>
<label id="drop-extra"><strong>result_extra.json</strong>추가 유형 결과
<input type="file" id="file-extra" accept=".json,application/json"><span class="file" id="name-extra"></span></label>
</div>
<div class="btns"><button type="submit">채점하기</button> <button type="reset">비우기</button></div>
</form>
<div id="score-out" aria-live="polite"></div>
<script>
const createScorer = ${createScorer.toString()};
${SCORE_SCRIPT}
</script>`,
    SCORE_STYLE
  );
}

/** 채점 화면의 브라우저 쪽 코드. 위의 `createScorer`를 쓴다. */
const SCORE_SCRIPT = String.raw`
(function () {
  const { validateFile, score, urlKey, TIME_LIMIT_SEC } = createScorer();
  const $ = (id) => document.getElementById(id);
  const out = $('score-out');
  const E = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => E[c]);
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0') + '%';
  const WHERE = { title: '제목', body: '본문', comment: '댓글', iframe: 'iframe 안', page: '게시판 밖' };
  const SCOPE = { spec: '요강 5개 분야', extra: '요강 밖 유형' };

  // ---------------------------------------------------------------- 파일 고르기

  for (const name of ['main', 'extra']) {
    const box = $('drop-' + name);
    const input = $('file-' + name);
    const show = () => { $('name-' + name).textContent = input.files[0] ? input.files[0].name : ''; };
    input.addEventListener('change', show);
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('on'); });
    box.addEventListener('dragleave', () => box.classList.remove('on'));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('on');
      if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); }
    });
  }
  $('score-form').addEventListener('reset', () => {
    out.innerHTML = '';
    $('name-main').textContent = '';
    $('name-extra').textContent = '';
  });

  // ---------------------------------------------------------------- 선택자 해석

  let entryHost = location.host;
  const docs = new Map();

  /**
   * 보고된 주소의 페이지를 이 사이트에서 받아 DOM으로 만든다.
   * 「댓글 더보기」는 눌렀을 때와 같게 펼치고, iframe src는 요강대로 절대 주소로 바꿔 둔다.
   */
  function loadDoc(absUrl) {
    const u = new URL(absUrl);
    const local = location.origin + u.pathname + u.search;
    if (!docs.has(local)) {
      docs.set(local, (async () => {
        const res = await fetch(local, { cache: 'no-store' });
        if (!res.ok) throw new Error('페이지를 받지 못함 (HTTP ' + res.status + ')');
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        for (const btn of doc.querySelectorAll('button[id^="cmt-more-btn-"]')) {
          const id = btn.getAttribute('data-id');
          const box = doc.getElementById('cmt-more-' + id);
          const more = await fetch('/api/comments?id=' + encodeURIComponent(id), { cache: 'no-store' });
          if (box && more.ok) box.innerHTML = await more.text();
          btn.remove();
        }
        for (const f of doc.querySelectorAll('iframe[src]')) f.setAttribute('src', new URL(f.getAttribute('src'), absUrl).href);
        return doc;
      })());
    }
    return docs.get(local);
  }

  function select(doc, sel) {
    // iframe[src="…"] 는 주소 비교 규칙(http/https·끝의 / 무시)으로 맞춘다.
    const m = /^iframe\[src="([^"]+)"\]$/.exec(sel.trim());
    if (m) {
      const want = urlKey(m[1]);
      if (!want) throw new Error('iframe src가 절대 주소가 아님: ' + m[1]);
      return [...doc.querySelectorAll('iframe[src]')].filter((f) => urlKey(f.getAttribute('src')) === want);
    }
    try {
      return [...doc.querySelectorAll(sel)];
    } catch (e) {
      throw new Error('CSS 선택자 문법 오류: ' + sel);
    }
  }

  async function resolve(url, loc) {
    try {
      if (new URL(url).host.toLowerCase() !== entryHost) return { ok: false, error: '검사한 사이트(' + entryHost + ') 밖의 주소' };
      const parts = loc.split('>>>').map((p) => p.trim());
      if (parts.some((p) => !p)) return { ok: false, error: '>>> 앞뒤에 선택자가 없음' };
      let doc = await loadDoc(url);
      const frames = [];
      for (let i = 0; i < parts.length - 1; i++) {
        const els = select(doc, parts[i]);
        if (els.length !== 1) return { ok: false, error: 'iframe 선택자가 ' + els.length + '개 요소를 가리킴: ' + parts[i] };
        if (els[0].tagName !== 'IFRAME') return { ok: false, error: '>>> 앞의 요소가 iframe이 아님: ' + parts[i] };
        const src = els[0].getAttribute('src');
        frames.push(src);
        doc = await loadDoc(src);
      }
      const els = select(doc, parts[parts.length - 1]);
      if (els.length === 0) return { ok: false, error: '선택자가 가리키는 요소가 없음' };
      if (els.length > 1) return { ok: false, error: '선택자가 ' + els.length + '개 요소를 가리킴 — 두 곳 이상이면 오답' };
      const el = els[0];
      const up = el.parentElement && el.parentElement.closest('[data-gt]');
      const down = el.querySelector('[data-gt]');
      return {
        ok: true, frames,
        gt: el.getAttribute('data-gt'),
        ancestorGt: up ? up.getAttribute('data-gt') : null,
        descendantGt: down ? down.getAttribute('data-gt') : null,
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------- 그리기

  const stat = (title, v, l, bad) =>
    '<div class="stat' + (bad ? ' bad' : '') + '"><div class="t">' + title + '</div><div class="v">' + v + '</div><div class="l">' + l + '</div></div>';
  const ratioTable = (head, rows, label) =>
    '<table class="answer"><thead><tr><th>' + head + '</th><th>찾음</th><th>비율</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + esc(label ? label(r.name) : r.name) + '</td><td>' + r.found + '/' + r.total +
      '</td><td><span class="bar"><i style="width:' + (r.total ? (r.found / r.total) * 100 : 0) + '%"></i></span>' +
      pct(r.found, r.total) + '</td></tr>').join('') + '</tbody></table>';
  const fold = (title, n, body, open) =>
    '<details' + (open ? ' open' : '') + '><summary>' + title + ' (' + n + '건)</summary>' + body + '</details>';

  function fileReport(label, f) {
    if (!f) return '';
    let h = '<h4>' + label + '</h4>';
    if (f.fatal) return h + '<p class="err"><strong>채점 불가:</strong> ' + esc(f.fatal) + '</p>';
    const errs = f.issues.filter((i) => i.level === 'error');
    const warns = f.issues.filter((i) => i.level === 'warn');
    const badItems = f.items.filter((i) => i.errors.length);
    const warnItems = f.items.filter((i) => !i.errors.length && i.warnings.length);
    if (!errs.length && !warns.length && !badItems.length) h += '<p class="ok">파일 형식과 스키마를 모두 지켰습니다 (항목 ' + f.items.length + '건).</p>';
    if (errs.length) h += '<p class="err"><strong>스키마 위반</strong> — 평가 대상에서 제외될 수 있습니다</p><ul class="issues err">' + errs.map((i) => '<li>' + esc(i.msg) + '</li>').join('') + '</ul>';
    if (warns.length) h += '<p class="warn"><strong>주의</strong> — 요강 예시와 다르거나 값이 서로 맞지 않습니다</p><ul class="issues warn">' + warns.map((i) => '<li>' + esc(i.msg) + '</li>').join('') + '</ul>';
    if (badItems.length) {
      h += fold('<span class="err">스키마를 어긴 항목 — 채점 제외·정확도에서 오답</span>', badItems.length,
        '<div class="scroll"><table class="answer"><thead><tr><th>#</th><th>id</th><th>문제</th></tr></thead><tbody>' +
        badItems.map((i) => '<tr><td>' + (i.index + 1) + '</td><td>' + esc(i.raw && i.raw.id) + '</td><td class="err">' + esc(i.errors.join(' / ')) + '</td></tr>').join('') +
        '</tbody></table></div>', true);
    }
    if (warnItems.length) {
      h += fold('<span class="warn">주의할 항목 — 채점에는 영향 없음</span>', warnItems.length,
        '<div class="scroll"><table class="answer"><thead><tr><th>#</th><th>id</th><th>내용</th></tr></thead><tbody>' +
        warnItems.map((i) => '<tr><td>' + (i.index + 1) + '</td><td>' + esc(i.raw.id) + '</td><td>' + esc(i.warnings.join(' / ')) + '</td></tr>').join('') +
        '</tbody></table></div>');
    }
    return h;
  }

  function jobTable(jobs, withReason) {
    return '<div class="scroll"><table class="answer"><thead><tr><th>id</th><th>technique</th><th>url</th><th>location</th><th>evidence_text</th>' +
      (withReason ? '<th>판정</th>' : '') + '</tr></thead><tbody>' +
      jobs.map((j) => { const r = j.item.raw || {}; return '<tr><td>' + esc(r.id) + '</td><td>' + esc(r.technique) + (r.extra_finding ? '<br>' + esc(r.extra_finding) : '') +
        '</td><td class="ev">' + esc(r.url) + '</td><td class="ev"><code>' + esc(r.location) + '</code></td><td class="ev">' +
        esc(String(r.evidence_text == null ? '' : r.evidence_text).slice(0, 80)) + '</td>' +
        (withReason ? '<td class="' + (j.verdict === 'invalid' || j.trap ? 'err' : '') + '">' + esc(j.reason || j.nameNote || '') + '</td>' : '') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function missedTable(list) {
    return '<div class="scroll"><table class="answer"><thead><tr><th>gt</th><th>유형</th><th>위치</th><th>기법</th><th>evidence_text</th><th>예시 url</th></tr></thead><tbody>' +
      list.map((g) => '<tr><td><code>' + esc(g.gt) + '</code></td><td>' + esc(g.code) + '</td><td>' + esc(WHERE[g.where] || g.where) +
        '</td><td>' + esc(g.note) + '</td><td class="ev">' + esc(g.evidence) + '</td><td class="ev">' + esc(g.url) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  function bucketReport(title, s, isMain, elapsed) {
    if (!s || s.fatal) return '';
    const wrongs = [...s.invalid, ...s.wrong];
    const spec = s.perScope.find((x) => x.name === 'spec');
    let h = '<h3>' + title + '</h3><div class="stats">';
    h += stat('정답 검출 개수' + (isMain ? ' (45점)' : ''), s.correct.length + '건',
      '맞힌 (url + location + technique)<br>정답셋 ' + s.answerTriples + '건 중');
    h += stat('심은 항목 기준', pct(s.foundPlanted, s.planted), s.foundPlanted + '/' + s.planted + ' 항목을 한 주소 이상에서 찾음');
    if (isMain && spec) h += stat('요강 5개 분야', pct(spec.found, spec.total), spec.found + '/' + spec.total + ' · 적격평가 대상 분야');
    h += stat('정답 추출 정확도' + (isMain ? ' (35점)' : ''), pct(s.correct.length, s.merged),
      '정탐 ' + s.correct.length + ' / 탐지 ' + s.merged + '건<br>스키마 위반 ' + s.invalid.length + '건 오답 포함', s.merged && s.correct.length < s.merged);
    if (isMain) {
      const over = elapsed != null && elapsed > TIME_LIMIT_SEC;
      h += stat('검출 시간 (20점)', elapsed == null ? '확인 불가' : elapsed.toFixed(1) + '초',
        elapsed == null ? 'meta.elapsed_sec가 올바르지 않음' : over ? '30분 초과 — 0점' : '30분 이내 (점수는 상대 평가)', elapsed == null || over);
    }
    h += stat('오답', wrongs.length + '건', '함정 ' + s.traps.length + '건 · 스키마 위반 ' + s.invalid.length + '건', wrongs.length > 0);
    h += '</div>';
    h += '<p class="view-meta">보고 ' + s.reported + '건 → 세 필드가 같은 항목을 합쳐 ' + s.merged + '건 (중복 ' + s.dup.length + '건)</p>';
    h += '<h4>유형별</h4>' + ratioTable('유형', s.perCode);
    if (s.perScope.length > 1) h += '<h4>분야 범위별</h4>' + ratioTable('범위', s.perScope, (n) => SCOPE[n] || n);
    if (s.perDomain.length) h += '<h4>분야별</h4>' + ratioTable('분야', s.perDomain);
    if (wrongs.length) h += fold('오답 — 까닭과 함께', wrongs.length, jobTable(wrongs, true), true);
    const named = s.correct.filter((j) => j.nameNote);
    if (named.length) h += fold('맞혔지만 유형 이름이 정답표와 다른 항목 (채점에는 영향 없음)', named.length, jobTable(named, true));
    if (s.missed.length) h += fold('찾지 못한 항목', s.missed.length, missedTable(s.missed));
    if (s.dup.length) h += fold('합쳐진 중복 항목', s.dup.length, jobTable(s.dup, false));
    return h;
  }

  // ---------------------------------------------------------------- 채점

  async function readInput(name, kind) {
    const f = $('file-' + name).files[0];
    if (!f) return null;
    return validateFile(new Uint8Array(await f.arrayBuffer()), kind, f.name);
  }

  $('score-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const main = await readInput('main', 'main');
    const extra = await readInput('extra', 'extra');
    if (!main && !extra) { out.innerHTML = '<p class="err">파일을 하나 이상 골라 주세요.</p>'; return; }

    const entries = [main, extra].filter((f) => f && f.entryUrl).map((f) => f.entryUrl);
    let head = '';
    if (entries.length === 2 && urlKey(entries[0]) !== urlKey(entries[1])) {
      head += '<p class="warn">두 파일의 meta.entry_url이 다릅니다. result.json 쪽을 씁니다.</p>';
    }
    const entry = entries[0] || location.origin + '/';
    if (!entries.length) head += '<p class="warn">meta.entry_url을 읽지 못해 이 사이트 주소(' + esc(location.origin) + ')로 채점합니다.</p>';
    const origin = new URL(entry).origin;
    entryHost = new URL(entry).host.toLowerCase();
    docs.clear();

    out.innerHTML = '<p>정답표를 받는 중…</p>';
    let key;
    try {
      const res = await fetch('/api/answer-key?origin=' + encodeURIComponent(origin), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      key = await res.json();
    } catch (err) {
      out.innerHTML = '<p class="err">정답표를 받지 못했습니다: ' + esc(err.message) + '</p>';
      return;
    }

    const result = await score({
      key, main, extra, resolve,
      onProgress: (d, t) => { if (d % 20 === 0 || d === t) out.innerHTML = '<p>location을 페이지에 대 보는 중… ' + d + '/' + t + '</p>'; },
    });

    out.innerHTML = head +
      '<p class="view-meta">검사한 사이트: <code>' + esc(origin) + '</code>' +
      (key.profile ? ' · 분야 분포: ' + esc(key.profile.label) + ' (<code>' + esc(key.profile.name) + '</code>)' : '') + '</p>' +
      '<h3>파일 검사</h3>' + fileReport('result.json', main) + fileReport('result_extra.json', extra) +
      bucketReport('적격평가 — result.json', result.main, true, main && main.elapsed) +
      bucketReport('추가 유형 — result_extra.json (본심사 자료)', result.extra, false, null);
  });
})();
`;

module.exports = {
  layout, esc, clampPage, POST_BY_ID,
  renderHome, renderBoardList, renderJsBoardList, renderGallery, renderView,
  renderIframe, renderMoreComments, renderAbout, renderLife, renderAnswerKey, renderScore, render404,
};
