# 공공기관 게시판 모사 테스트 사이트

불법광고 탐지 도구를 검증하려고 만든 **가상 공공기관 누리집**입니다.
공공기관 게시판을 흉내 낸 글 **100건(10쪽 × 10건)** 가운데 일부에 위장·은닉한 가짜 광고를 심어 두고,
어디에 무엇을 심었는지 **정답표**로 함께 내려 줍니다.

- 외부에서 바로 접속할 수 있습니다(로그인·인증 없음).
- **데이터베이스가 없습니다.** 글 100건은 코드 안에 고정되어 있어 배포해도 매번 같은 사이트가 나옵니다.
- **의존성이 하나도 없습니다.** `npm install`도 빌드도 없이 버셀에 그대로 올라갑니다.

> 심어 둔 광고 문구·연락처·주소는 모두 가짜입니다. 실제 기관·업체와 관련이 없습니다.
> 모든 페이지에 `noindex`가 걸려 있어 검색엔진에 올라가지 않습니다.

---

## 1. 띄우기

### 로컬

```bash
node server.js            # http://localhost:3000
PORT=8080 node server.js
```

Node 18 이상이면 됩니다(설치할 것 없음).

### 버셀 배포

```bash
npm i -g vercel
vercel          # 미리보기
vercel --prod   # 운영
```

`vercel.json`이 모든 주소를 서버리스 함수 `api/index.js` 하나로 보냅니다.
깃허브 저장소를 버셀에 연결해도 그대로 동작합니다(프레임워크 선택: **Other**, 빌드 명령 없음).

배포가 끝나면 받은 주소를 그대로 탐지 도구에 넣습니다.

```bash
detect.exe https://<배포주소>/board/list?page=1
```

---

## 2. 주소 구성

| 주소 | 내용 |
|---|---|
| `/` | 첫화면. 쪽 넘김이 없는 '최근 게시물' 목록이 있어 게시판으로 오인하면 안 된다. 푸터에 숨긴 광고 1건 |
| `/board/list?page=1` ~ `10` | **열린게시판.** 일반 주소형 쪽 넘김. 쪽 번호 변수는 `page` |
| `/board/view?id=1001` ~ `1100` | 글 상세. 본문·댓글·iframe |
| `/jsboard/list.do?bbsId=B02&pageIndex=1` | **자유게시판.** 글 링크와 쪽 넘김이 모두 자바스크립트(`fn_view`, `fn_egov_link_page`). 쪽 번호 변수는 `pageIndex`, 시작 주소에만 있는 값 `postIdx=0`이 섞여 있다 |
| `/jsboard/view.do?nttId=1001` | 같은 글을 다른 주소로 보여 주는 상세 |
| `/gallery?page=1` | **포토갤러리.** 표가 아닌 카드형 목록 |
| `/life` | 오탐 함정 모음(접힌 메뉴·탭·아코디언·팝업·슬라이더, 보도·법령·행정 문구) |
| `/about` | 기관 소개. 게시판이 아닌 일반 페이지 |
| `/iframe/ad?id=<글번호>` | 글 안의 iframe 문서 |
| `/api/comments?id=<글번호>` | 「댓글 더보기」를 눌렀을 때 받아 가는 댓글 조각 |
| `/answer-key` | 정답표 화면 |
| `/api/answer-key` | 정답표 JSON (`?format=flat`, `?origin=https://...`) |
| `/robots.txt` | 전부 허용(`--respect-robots`로 돌려도 막히지 않게) |

### 게시판별로 무엇을 보는가

| 게시판 | 확인하려는 것 |
|---|---|
| 열린게시판 | 주소형 쪽 넘김, 쪽 구간 선택(`--pages 3-5`), 목록 → 상세 따라가기 |
| 자유게시판 | `javascript:` 글 링크와 `onclick`, 폼으로 보내는 쪽 넘김, 쪽 번호 변수 이름이 다른 경우 |
| 포토갤러리 | 목록 행이 표가 아니어도 게시판으로 인식하는지 |
| 첫화면 | 쪽 넘김 없는 목록을 게시판으로 오인하지 않는지, 게시판 밖 페이지도 훑는지 |
| 비밀글(글번호 55·15, 자물쇠 표시) | 열지 않거나, 열었을 때 "내용 확인 불가"로 처리하는지 |
| 정상 iframe (`/iframe/ad?id=0`) | iframe이 있다는 이유만으로 검출하지 않는지 |
| 댓글 | 상세 페이지의 댓글 영역까지 읽는지 |
| 댓글 더보기 (`id=1036`·`1076`) | 더보기를 눌러 펼친 뒤 분석하는지. 삭제·신고·작성 버튼은 누르지 않아야 한다 |

---

## 3. 심어 둔 것

### 적격평가 4종 (`result.json`)

| technique | 변형 | 건수 |
|---|---|---|
| `HOMOGLYPH` | 전각, 키릴·그리스, 숫자 치환(`t0t0`·`ca$1n0`), 원문자(`ⒷⒺⓉ`), 수학용 영문(`𝗦𝗟𝗢𝗧`) | 13 |
| `JAMO` | 호환 자모 분해(`ㅋㅏㅈㅣㄴㅗ`), NFD 조합형 자모, 모음을 라틴 글자로(`ㅋr지노`) | 11 |
| `TRANSPARENT` | `color:transparent`, `opacity:0`, 흰 배경에 흰 글자, `rgba` 알파 0, 조상 요소 배경과 같은 색, 명암비 1.05 저대비 | 14 |
| `OFFSCREEN` | `display:none`, `font-size:0`, `font-size:1px`, `left:-9999px`, `top:-10000px`, `text-indent:-9999px`, `transform` 이동 | 17 |

닮은꼴 위장은 라틴 글자에만 걸립니다. 그래서 그 항목은 불법 키워드를 **라틴 글자로** 적어 두었고
(`ＣＡＳＩＮＯ ＴＯＴＯ ＳＬＯＴ 24시 운영 안내`), 한글로 남는 부분은 그것만으로는 불법이 아닌 말입니다.
정규화(NFKC·치환 복원)를 하지 않으면 키워드가 걸리지 않습니다.

### 추가 유형 (`result_extra.json`)

| extra_finding | 내용 | 건수 |
|---|---|---|
| `ZERO_WIDTH` | 글자 사이에 폭 0 문자(U+200B)를 끼워 키워드 매칭 회피 | 4 |
| `CLIPPED` | `clip:rect(0,0,0,0)` 영역에 가림(sr-only 방식) | 4 |
| `VISIBILITY_HIDDEN` | `visibility:hidden` | 2 |
| `HTML_COMMENT` | HTML 주석 속 | 3 |
| `VISIBLE_AD` | 숨기지 않고 화면에 그대로 노출(띄어쓰기 위장 `메 이 저`) | 5 |

### 겹치기·분야

- 한 요소에 **기법이 겹친** 경우 1건(`opacity:0` + `font-size:0`) → 기법별로 따로 1건씩 세야 합니다.
- 한 글에 **검출이 2건** 들어간 경우가 3건 있습니다.
- `HTML 엔티티`로 한 번 더 감싼 경우 1건(`&#49888;…` + `display:none`).
- 분야는 요강의 5개(**도박·성인·불법대출·마약·불법거래**)를 모두 덮습니다.
- 쪽마다 검출이 고르게 퍼져 있어 쪽 구간 선택이나 중복 합치기를 시험할 수 있습니다.

### 검출 위치 (전체 73건)

| 위치 | 건수 | 내용 |
|---|---|---|
| 제목 | 5 | 목록 3곳(열린게시판·자유게시판·포토갤러리)과 상세 2곳에 같이 보인다 |
| 본문 | 44 | 글 상세의 본문 영역 |
| **댓글** | **20** | 아래 참고 |
| iframe 안 | 3 | `iframe[src="…"] >>> 선택자` 로 적어야 한다 |
| 게시판 밖 페이지 | 1 | 첫화면 푸터 |

### 댓글

댓글은 실제 공공기관 게시판에서 광고가 가장 많이 붙는 자리라, 본문과 같은 비중으로 깔았습니다.

- 100건 중 **90건에 댓글**이 달려 있습니다(총 236건). 글마다 0~6건이고, 담당 부서 답글도 섞여 있습니다.
- 댓글 검출 **20건**이 **10쪽 전부**에 1~3건씩 퍼져 있고, **9종 전부**를 덮습니다
  (HOMOGLYPH 3 · JAMO 3 · TRANSPARENT 3 · OFFSCREEN 3 · VISIBLE_AD 3 · ZERO_WIDTH 2 · CLIPPED 1 · VISIBILITY_HIDDEN 1 · HTML_COMMENT 1).
- 광고 댓글은 **맨 뒤(최근 댓글)**에 붙입니다. 실제 스팸도 그렇게 달립니다.
- **「댓글 더보기」로 접힌 댓글 2건**(글번호 65·25 / `id=1036`·`1076`)이 있습니다.
  접힌 댓글은 **처음 HTML에 아예 없고**, 버튼을 누르면 `/api/comments?id=<글번호>`에서 받아 와 붙습니다.
  정답표에서 `via: "comment-more"`로 표시된 건이 이것입니다. 숨겨 두는 대신 서버에서 받아 오게 한 이유는,
  숨겨 두면 그 광고 댓글이 `display:none`으로도 잡혀 어느 기법이 정답인지 흐려지기 때문입니다.
  그래서 접힌 쪽에는 글자 자체를 바꾸는 기법(닮은꼴·자모)만 넣었습니다.
- 댓글마다 `이 댓글 신고하기` **숨김 링크**(`sr-only`)가 있습니다. 숨겨져 있지만 정상이라 검출되면 오탐입니다.

### 오탐 함정 68건

하나라도 결과 파일에 나오면 오탐입니다.

- **숨겨져 있지만 정상**: 화면낭독기용 '본문 바로가기', `sr-only` 입력 라벨, 접힌 2단 메뉴, 숨은 탭 패널,
  높이 0 아코디언, 숨은 팝업, 슬라이더 뒤쪽 슬라이드, `font-size:0` 이미지 대체 텍스트
- **보이지만 약한 키워드가 든 정상 문구**: '성인 문해교육', '시각장애인 안마사', '어린이 놀이터',
  '한국도박문제예방치유원', '성인 세대주', 보도 문장('불법 카지노 조직 검거'), 합법 제도(체육진흥투표권),
  합법 사업장(강원랜드), 법령 인용('카지노업 제외'), 한자 병기 고유명사('야동(冶洞)'),
  낱말 사이에 우연히 생긴 키워드('분야 동향'의 야동, '첫 충전'의 첫충), 자모 나열('ㄱ ㄴ ㄷ'),
  전각으로 쓴 정상 문구('（주）ＫＴＸ'), 게시판 운영 안내('도박 홍보 글은 삭제')
- **댓글 함정 12건**: 스팸을 신고하는 댓글('위에 올라온 도박 사이트 홍보 댓글은 신고했습니다'),
  광고 문구를 따옴표로 인용한 신고 댓글('"첫충 30% 지급"이라고 적힌 광고 댓글이 계속 달립니다'),
  피해 신고 문의('불법 대출 광고 문자를 받았습니다. 어디에 신고하면 되나요?'),
  약한 키워드가 든 일반 문의('성인 문해교육 수강 신청했습니다', '시각장애인 안마사 일자리 사업 문의'),
  「댓글 더보기」 안에 접힌 정상 댓글

---

## 4. 정답표

페이지 HTML의 **`data-gt` 속성이 채점 표식**입니다. 탐지 판정에 쓰면 안 됩니다.

```html
<p data-gt="G25" style="opacity:0;font-size:0">카지노 신규가입 첫충 30% 머니 지급</p>
```

`/api/answer-key`는 이렇게 생겼습니다.

```json
{
  "counts": { "posts": 100, "pages": 10, "unique_findings": 73, "traps": 68,
              "by_code": { "HOMOGLYPH": 13, "JAMO": 11, "TRANSPARENT": 14, "OFFSCREEN": 17, "…": 0 } },
  "expected_findings": [
    { "gt": "G15", "bucket": "main", "code": "OFFSCREEN",
      "url": "https://<배포주소>/board/view?id=1027",
      "location": "iframe[src=\"https://<배포주소>/iframe/ad?id=1027\"] >>> [data-gt=\"G15\"]",
      "evidence_text": "메이저 놀이터 가입 쿠폰 전액 지급",
      "post_id": 1027, "where": "iframe", "via": null, "note": "화면 밖: display:none" },
    { "gt": "G26", "bucket": "main", "code": "HOMOGLYPH",
      "url": "https://<배포주소>/board/view?id=1036",
      "location": "[data-gt=\"G26\"]",
      "evidence_text": "ВАССАRА НОꝆDЕМ 입장 코드 발급",
      "post_id": 1036, "where": "comment", "via": "comment-more",
      "note": "닮은꼴: 키릴·그리스 / '댓글 더보기'를 눌러야 나타남" }
  ],
  "expected_absent": [
    { "gt": "N57", "url": "https://<배포주소>/life", "location": "[data-gt=\"N57\"]",
      "text": "도박 중독이 의심되면 국번 없이 1336으로 상담하세요.",
      "hidden": true, "post_id": 1036, "via": null, "note": "접힌 아코디언, 부정 맥락" }
  ]
}
```

- `bucket: "main"`은 `result.json`에, `"extra"`는 `result_extra.json`에 있어야 합니다.
- 같은 삽입이 여러 주소에 보이면(제목은 목록 3곳 + 상세 2곳) 주소마다 한 줄씩 들어갑니다.
  채점은 `gt` 단위로 하면 됩니다.
- 사이트를 다른 주소로 띄워 검사했다면 `?origin=https://...`로 주소를 맞출 수 있습니다.
- `via: "comment-more"`인 건은 **처음 HTML에 없습니다.** 「댓글 더보기」를 누르지 않는 도구는
  이 2건을 놓치는 것이 정상입니다(놓쳐도 다른 71건에는 영향이 없습니다).

---

## 5. 채점

탐지 도구가 만든 `result.json` / `result_extra.json`을 정답표와 맞춰 봅니다.

```bash
node tools/score.mjs --site https://<배포주소> \
  --result ./result.json --extra ./result_extra.json
```

```
정답 수     : 73 (함정 68건)
보고된 검출 : 57 (result.json 43, result_extra.json 14)

맞힘(TP)    : 55
놓침(FN)    : 18
오탐(FP)    : 2  그중 함정을 건드린 것 1건
정밀도      : 96.5%   재현율: 75.3%   F1: 84.6%

유형별 재현율
  CLIPPED            4/4   100.0%
  HOMOGLYPH          12/13  92.3%
  OFFSCREEN          11/17  64.7%
  ...
놓친 정답
  G04 OFFSCREEN   body     성인 전용 라이브 영상 무료 보기 주소  (화면 밖: left:-9999px)
  G26 HOMOGLYPH   comment  ВАССАRА НОꝆDЕМ 입장 코드 발급  (닮은꼴: 키릴·그리스 / '댓글 더보기'를 눌러야 나타남)
```

대조 순서는 이렇습니다.

1. 보고된 `location`에서 `data-gt` 표식을 읽어 `gt`를 찾는다.
2. 표식이 없으면 `evidence_text`가 같은 정답을 찾는다(도구가 자기 선택자로 적어도 맞춰진다).
3. `gt` + 기법이 맞으면 TP, 정답표에 없으면 FP, 못 찾은 정답은 FN.

### 사이트 자기 점검

사이트를 고친 뒤 정답표가 어긋나지 않았는지 봅니다.

```bash
node server.js &
node tools/check.mjs --site http://localhost:3000
# 확인 437건, 문제 0건
```

---

## 6. 파일 구성

```
server.js            로컬 실행 서버
api/index.js          버셀 서버리스 함수 (모든 주소가 여기로 온다)
vercel.json           rewrite 설정
lib/handler.js        주소 → 응답
lib/render.js         페이지 HTML 조립
lib/style.js          공용 스타일
lib/disguise.js       위장·은닉 문자 변환기 (전각·키릴·자모·폭0 …)
lib/answers.js        정답표 생성
data/copy.js          글 문구 모음 (광고 문구, 정상 글, 함정 문구)
data/posts.js         글 100건과 삽입 계획  ← 단일 원본
data/pages.js         게시판 밖 페이지에 심은 항목
tools/check.mjs       사이트 자기 점검
tools/score.mjs       탐지 결과 채점
```

`data/posts.js`의 `PLAN` 배열이 **무엇을 어디에 심을지** 정하는 유일한 곳입니다.
페이지 HTML과 정답표를 둘 다 여기서 만들기 때문에 서로 어긋날 수 없습니다.

### 심는 것을 바꾸려면

```js
// data/posts.js
const PLAN = [
  // i: 글 번호(0부터, 0~9가 1쪽)  codes: 기법  dom: 분야  c: 문구 번호  v: 변형 번호
  { i: 0, codes: ['HOMOGLYPH'], dom: 'GAMBLE', c: 0, v: 0, where: 'title' },
  { i: 44, codes: ['TRANSPARENT', 'OFFSCREEN'], dom: 'GAMBLE', c: 0, v: 1, where: 'body' },
  { i: 5, codes: ['TRANSPARENT'], dom: 'GAMBLE', c: 1, v: 2, where: 'comment' },
];

// 「댓글 더보기」로 접어 둘 글: 번호 -> 접기 시작 위치
const COMMENT_MORE_AT = new Map([[35, 2], [75, 2]]);

// 함정 댓글을 달 글 번호 (TRAP_COMMENTS 를 차례로 쓴다)
const COMMENT_TRAP_AT = [4, 14, 22, 24, 34, 44, 54, 64, 74, 84, 94, 35];
```

`where`는 `title` · `body` · `comment` · `iframe` 중 하나입니다.
줄을 더하거나 고치고 `node tools/check.mjs`로 확인하면 정답표가 자동으로 따라옵니다.
