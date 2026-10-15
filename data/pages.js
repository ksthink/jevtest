/**
 * 게시글이 아닌 페이지(첫화면·기관소개·생활정보·공용 레이아웃)에 심은 항목 목록.
 *
 * 각 페이지 컴포넌트의 `data-gt`와 1:1로 맞춰 둔다. 정답표가 이 표를 읽는다.
 */


/** 게시판 밖에 심은 불법광고. 게시판이 아닌 주소로 시작했을 때 사이트 전체를 훑는지 본다. */
const PAGE_FINDINGS = [
  {
    gt: 'G00',
    path: '/',
    code: 'OFFSCREEN',
    evidence: '먹튀 없는 메이저 토토사이트 주소 안내',
    note: '화면 밖: left:-9999px (첫화면 푸터)',
  },
];

/** 숨겨져 있거나 약한 키워드가 들었지만 정상인 글. 결과에 나오면 오탐이다. */
const PAGE_TRAPS = [
  { gt: 'N00', path: '*', text: '본문 바로가기', hidden: true, note: '모든 페이지 공용 - 화면낭독기용 건너뛰기 링크' },

  { gt: 'N40', path: '/about', text: '야동(冶洞) 마을 경로당을 증축하고 다소출장소를 폐지', hidden: false, note: '한자 병기 고유명사' },
  { gt: 'N41', path: '/about', text: '관광진흥법에 따른 관광사업(여행업 및 카지노업 제외) 등록 업무를 이관', hidden: false, note: '법령 인용' },
  { gt: 'N42', path: '/about', text: '광고·홍보성 글과 도박·성인물 관련 글은 통보 없이 삭제하며 이용을 제한할 수 있습니다.', hidden: false, note: '게시판 운영 안내' },

  { gt: 'N50', path: '/life', text: '성인 문해교육 수강생 모집 바로가기', hidden: true, note: '접힌 2단 메뉴 (성인=일상어)' },
  { gt: 'N51', path: '/life', text: '어르신 만남의 광장 프로그램 바로가기', hidden: true, note: '접힌 2단 메뉴 (만남=일상어)' },
  { gt: 'N52', path: '/life', text: '시각장애인 안마사 일자리 지원 바로가기', hidden: true, note: '접힌 2단 메뉴 (안마=일상어)' },
  { gt: 'N53', path: '/life', text: '한국도박문제예방치유원 상담 안내 바로가기', hidden: true, note: '접힌 2단 메뉴 (공공기관명)' },
  { gt: 'N54', path: '/life', text: '어린이 놀이터 안전점검 결과 바로가기', hidden: true, note: '접힌 2단 메뉴 (놀이터=일상어)' },
  { gt: 'N55', path: '/life', text: '성인병 예방 건강강좌 신청 주소 안내', hidden: true, note: '숨은 탭 패널' },
  { gt: 'N56', path: '/life', text: '생활체육 야구 교실 참가 신청 안내', hidden: true, note: '숨은 탭 패널' },
  { gt: 'N57', path: '/life', text: '도박 중독이 의심되면 국번 없이 1336으로 상담하세요.', hidden: true, note: '접힌 아코디언, 부정 맥락' },
  { gt: 'N58', path: '/life', text: '불법 사행성 게임장 신고 포상금 안내입니다.', hidden: true, note: '숨은 팝업, 신고 안내' },
  { gt: 'N59', path: '/life', text: '온라인 불법도박 예방 교육 신청 안내', hidden: true, note: '슬라이더 뒤쪽 슬라이드 (transform)' },
  { gt: 'N60', path: '/life', text: '성인 평생교육 강좌 목록', hidden: true, note: 'font-size:0 이미지 대체 텍스트' },
  { gt: 'N61', path: '/life', text: '경찰, 불법 온라인 카지노 조직 검거… 도박 사이트 30곳 폐쇄', hidden: false, note: '보도 문장' },
  { gt: 'N62', path: '/life', text: '체육진흥투표권(스포츠토토) 수익금으로 공공 체육시설을 짓습니다.', hidden: false, note: '합법 제도' },
  { gt: 'N63', path: '/life', text: '폐광지역 관광 코스로 강원랜드 카지노 일대를 소개합니다.', hidden: false, note: '합법 사업장' },
  { gt: 'N64', path: '/life', text: '성인 세대주 기준 주민세 부과 안내', hidden: false, note: '행정 문구' },
  { gt: 'N65', path: '/life', text: '마약류 오남용 예방 교육 강사 양성 과정 수강생 모집', hidden: false, note: '예방 맥락' },
  { gt: 'N66', path: '/life', text: '불법 대출 광고 피해 예방 수칙 안내 자료를 배포합니다.', hidden: false, note: '예방 맥락' },
  { gt: 'N67', path: '/life', text: '대포통장 명의 대여 범죄 예방 캠페인 참여 안내', hidden: false, note: '예방 캠페인' },
  { gt: 'N68', path: '/life', text: '분야 동향 보고서와 첫 충전 요금제 비교 자료', hidden: false, note: "'야동'·'첫충'이 낱말 사이에 우연히 생긴 경우" },
  { gt: 'N69', path: '/life', text: '한글 교실: ㄱ ㄴ ㄷ ㄹ 자음과 ㅏ ㅑ ㅓ ㅕ 모음 익히기', hidden: false, note: '자모 나열이지만 정상' },
  { gt: 'N70', path: '/life', text: '（주）가상시관광공사 ＫＴＸ 연계 투어 안내', hidden: false, note: '전각이지만 정상' },
  { gt: 'N71', path: '/life', text: '검색어를 입력하세요', hidden: true, note: 'sr-only 입력 라벨' },
];

module.exports = { PAGE_FINDINGS, PAGE_TRAPS };
