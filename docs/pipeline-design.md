# 2단 판정 파이프라인 설계

`ksthink/detect`에 적용할 설계다. 이 문서를 그 저장소에서 작업하는 Claude Code에 넘긴다.

```
수집 ─▶ 정규화(조합) ─▶ 1차 규칙 판정 ─┬─ score ≥ 1.0  확정 후보 ─┐
                                      ├─ 0.5 ≤ s < 1.0 애매 후보 ─┼─▶ 2차 JEV AI ─▶ 최종
                                      └─ s < 0.5       버림       ┘
```

핵심은 두 가지다.

- **1차는 조합된 문자열로 판정한다** — 이미 그렇게 하고 있다(`classify.py:64-65`). 바꾸지 않는다.
- **2차 AI도 조합된 문자열을 받는다** — 지금은 위장된 원문을 보내고 있다. 이걸 고친다.

그리고 **AI는 최종 결정권자가 아니라 "확신할 때만 뒤집는" 심판**이다. 이유는 2절에 있다.

---

## 1. 먼저 측정한 것

설계를 정하기 전에 모사 사이트(`ksthink/jevtest`)의 문구로 현재 엔진을 돌려 봤다.
아래 숫자가 이 설계의 순서를 정했다.

### 광고 문구 226건을 현재 사전으로 채점하면

| 점수 구간 | 건수 | 뜻 |
|---|---:|---|
| `≥ 1.0` (검출됨) | 92 | 41% |
| `0.5 ~ 1.0` (애매) | 7 | 3% |
| **`< 0.5` (키워드가 아예 안 걸림)** | **127** | **56%** |

**놓치는 광고의 대부분은 애매해서가 아니라 사전에 그 말이 없어서다.**
그래서 임계값을 0.5로 낮춰 AI에 넘겨도 7건밖에 못 건진다. AI를 먼저 손대면 헛수고다.

### 사전을 넓히면 (`DIC.md`, 어휘 90 → 245)

| | 건수 |
|---|---:|
| 0.5 미만이던 광고 | 127 |
| **새 어휘가 하나라도 걸리는 것** | **112 (88%)** |
| 그래도 안 걸리는 것 | 15 |

안 걸리는 15건은 약한 조합어뿐이다. `성인 영상 무제한 시청 전용 주소`, `만남 어플 무료 가입`,
`출장 서비스 전지역 매니저`, `제1금융권 제휴 저금리 대출`, `미등록 대부 저금리 대환`.
**이게 AI가 풀어야 할 영역이다.**

### 함정 183건 중 현재 임계를 넘는 것

| 문구 | 점수 |
|---|---:|
| `일반의약품은 처방전 없이 구매할 수 있습니다. 복약 지도를 받으세요.` | 1.0 |
| `토토 사이트 홍보 댓글 때문에 글이 안 보입니다. 정리해 주세요.` | 1.0 |

둘 다 AI의 `intent`로 정확히 갈린다(`administrative`, `warning`).
**AI가 값을 하는 자리가 바로 여기다.**

> 숨김 함정 41건은 전부 0.5 미만이다. 접근성용 숨김 텍스트(`이 댓글 신고하기` 등)는
> 애매 구간에 들어오지 않으므로, 구간을 열어도 AI 호출이 폭증하지 않는다.

---

## 2. 왜 AI에 최종 결정권을 주지 않는가

**점수가 비대칭이다.** 정답 검출 개수 45점, 정답 추출 정확도 35점.

| AI가 틀렸을 때 | 잃는 것 |
|---|---|
| 진짜 검출을 버림 (FN) | 검출 개수 45점에서 1건 **그리고** 정확도 분자에서도 1건 |
| 가짜를 남김 (FP) | 정확도 35점에서만 깎임 |

**정탐을 잃는 쪽이 항상 더 비싸다.** 그래서 버리는 문턱은 높게, 올리는 문턱은 중간으로 둔다.

**모델의 한국어 정확도를 공급사가 경고한다.** TypeSafe 문서(`/models#language-support`):

> "English is the primary training language and where accuracy is currently best.
> Other languages, including CJK scripts, are handled but not equally well;
> **pay close attention to Confidence when routing.**"

대상이 전부 한국어다. 그런데 현재 코드는 `confidence`를 한 번도 읽지 않는다.
**확신이 낮을 때는 AI가 규칙 판정을 뒤집지 못하게** 막는다.

---

## 3. 1차 — 3구간 판정

### 지금 (`detector/classify.py:64-67`)

```python
raw = it["text"]
full = normalize(raw)
ks = keyword_score(normalize_spaced(raw))
if ks["score"] < THRESHOLD:        # 1.0 미만이면 여기서 끝
    return None
```

### 바꿀 모습

```python
REVIEW_MIN = 0.5          # 애매 구간의 아래쪽

ks = keyword_score(normalize_spaced(raw))
if ks["score"] < REVIEW_MIN:
    return None
band = "confirm" if ks["score"] >= THRESHOLD else "review"
```

그리고 반환에 `band`를 싣는다(`classify.py:102`).

```python
return {"labels": labels, "normalized": full, "category": ks["category"],
        "hits": ks["hits"], "score": ks["score"], "band": band}
```

**애매 구간에는 조건을 하나 더 건다.** `band == "review"`인데 `labels`가 `VISIBLE_AD` 하나뿐이면
버린다. 숨김·위장 증거가 없는데 키워드도 애매하면 근거가 없다.
요강 해석("불법 내용 **그리고** 위장·은닉 기법")을 그대로 따르는 것이다.

```python
if band == "review" and all(c == "VISIBLE_AD" for _, c, _ in labels):
    return None
```

`crawler.py:356-363`의 finding dict에 `"band": j["band"]`를 더한다.

---

## 4. 2차 — AI에 무엇을 보내는가

### 지금 (`detector/crawler.py:686`)

```python
verdicts, ai = await aijudge.judge_texts([f["evidence_text"] for f in findings], cfg)
```

`evidence_text`는 **정규화 전 원문**이다. 그래서 AI가 `ㅋㅏㅈㅣㄴㅗ ㅂㅗㄴㅓㅅㅡ`,
`ＣＡＳＩＮＯ　ＴＯＴＯ`, 폭 0 문자가 박힌 `카​지​노`를 그대로 받는다.
한국어가 약하다고 공급사가 밝힌 모델에게 **일부러 깨뜨린 한국어**를 주고 있다.

조합된 문자열은 이미 `f["normalized"]`에 들어 있다(`crawler.py:361`). 바로 옆에 두고 안 쓴다.

### 바꿀 모습

문장이 아니라 **객체**로 보낸다. TypeSafe 문서(`/concepts/state`)가 권하는 형태다.
위장 자체가 의도의 증거이므로 원문도 함께 보낸다 — 정상 문구는 전각 키릴로 쓰이지 않는다.

```python
def ai_state(f, page_title=None):
    return {
        "text":        f["normalized"],      # 조합·정규화된 문자열 (판단의 주재료)
        "text_as_posted": f["evidence_text"],# 원문 (위장된 그대로)
        "disguise":    f["code"],            # HOMOGLYPH / JAMO / TRANSPARENT / OFFSCREEN / …
        "disguise_detail": f["reason"],      # "자모 분해: 원문을 재조합하면 …"
        "where":       "댓글" if "cmt" in f["location"] else "본문",
        "page_title":  page_title,
        "rule_hits":   f["hits"],            # 규칙이 집은 키워드
        "rule_score":  f["score"],
    }
```

**같은 문장은 한 번만 호출한다**(요강의 도입 가능성 평가 항목). 지금 `judge_texts`가
`dict.fromkeys`로 중복을 지우는데, 키를 `evidence_text`에서 **`normalized`**로 바꾼다.
위장만 다르고 내용이 같은 광고가 한 번으로 합쳐져 호출이 오히려 준다.

질문 4가지(`aijudge.py:25-35`)는 그대로 둔다. 다만 `_call`이 버리고 있는 값을 받아 온다.

```python
return {
    "p": round(a["is_illegal_ad"]["noul"], 3),
    "intent": a["intent"]["choice"],
    "intent_conf": round(a["intent"]["confidence"], 3),      # ← 지금 안 읽음
    "category": a["category"]["choice"],
    "category_conf": round(a["category"]["confidence"], 3),  # ← 지금 안 읽음
    "risk": round(a["risk"]["score"], 2),
    "risk_conf": round(a["risk"]["confidence"], 3),          # ← 지금 안 읽음
    "model": d.get("model"),
    "usage": d.get("usage"),                                 # ← 지금 안 읽음
}
```

`is_illegal_ad`는 noul이라 `confidence`가 없다. 문서가 등가 공식을 준다 — `|2p − 1|`.

---

## 5. 최종 판정 규칙

`aijudge.keep(code, ai)`를 `decide(finding, ai)`로 바꾼다.

```python
PROMOTION_INTENTS = {"promotion"}
BENIGN_INTENTS    = {"warning", "administrative", "news"}

DROP_P_MAX        = 0.30   # 확정 후보를 버리려면 이보다 낮아야
DROP_P_MAX_VISIBLE= 0.50   # 숨김 증거가 없는 VISIBLE_AD 는 완화
DROP_CONF_MIN     = 0.60   # 그리고 의도 판단이 이만큼 확실해야

PROMOTE_P_MIN     = 0.60   # 애매 후보를 올리려면 이보다 높아야
PROMOTE_CONF_MIN  = 0.50
```

| 구간 | AI 없음 | AI 있음 |
|---|---|---|
| **확정** `score ≥ 1.0` | **남긴다** | 아래 셋을 **모두** 만족할 때만 버린다<br>① `intent ∈ {warning, administrative, news}`<br>② `intent_conf ≥ 0.60`<br>③ `p < 0.30` (`VISIBLE_AD`는 `< 0.50`) |
| **애매** `0.5 ≤ score < 1.0` | **버린다** | 아래 넷을 **모두** 만족할 때만 올린다<br>① `p ≥ 0.60`<br>② `intent == promotion`<br>③ `intent_conf ≥ 0.50`<br>④ `category != none` |

```python
def decide(f, ai):
    band = f.get("band", "confirm")
    if ai is None:
        return band == "confirm"            # AI 없으면 지금 동작과 똑같다
    if band == "confirm":
        pmax = DROP_P_MAX_VISIBLE if f["code"] == "VISIBLE_AD" else DROP_P_MAX
        drop = (ai["intent"] in BENIGN_INTENTS
                and ai["intent_conf"] >= DROP_CONF_MIN
                and ai["p"] < pmax)
        return not drop
    return (ai["p"] >= PROMOTE_P_MIN
            and ai["intent"] in PROMOTION_INTENTS
            and ai["intent_conf"] >= PROMOTE_CONF_MIN
            and ai["category"] != "none")
```

올린 건은 `result.json`에 그대로 들어간다. 다만 `report.html`과 `site_profile.json`에는
**규칙이 아니라 AI가 올린 건**임을 표시해, 담당자가 근거를 알 수 있게 한다.

---

## 6. AI를 못 쓸 때의 보장

이 설계의 안전 장치다. 반드시 지킨다.

> **AI가 꺼져 있으면(키 없음·호출 실패·429·시간 초과) 결과가 현재와 정확히 같다.**

성립하는 이유: `decide`의 `ai is None` 분기가 `band == "confirm"`을 돌려주고,
확정 구간의 조건은 현재 `THRESHOLD`와 같다. 애매 구간은 버려지는데, 그건 지금도 버려진다.

**그러므로 이 변경은 성능을 떨어뜨릴 수 없다.** 적격평가에서 주최 측 키가 동작하지 않아도
현재 점수는 그대로 나온다. 코드 리뷰에서 이 성질이 깨지지 않았는지 꼭 확인한다.

---

## 7. 운영

| 항목 | 지금 | 바꿀 것 |
|---|---|---|
| 모델 | `jev-latest` (별칭) | **`jev-1.13.0`으로 고정.** 별칭은 새 버전이 나오면 옮겨 간다. 임계값을 맞춰 둔 버전이 바뀌면 코드 변경 없이 결과가 달라진다. 적격평가가 10.26~10.28이고 1.14가 10.14에 나왔다 |
| 429 / 529 | 재시도 없음. 실패하면 그 문장은 판단 없이 통과 | **지수 백오프**(2→4→8초). `crawler.py:276-278`에 같은 패턴이 이미 있다 |
| 호출 상한 | 없음 | **상한을 둔다**(예: 400건). 넘으면 애매 구간은 버리고 확정 구간만 남긴다. 30분 제한을 지키기 위한 안전판 |
| `usage` | 버림 | 합계를 모아 `site_profile.json`과 `report.html`에 남긴다. 요강의 도입 가능성 10점이 토큰 사용량을 본다. `$0.042`/Mtok로 비용 환산까지 적는다 |
| `site_profile.json` | AI 흔적 없음 | `enabled` · `model` · `calls` · `errors` · `dropped` · `promoted` · `usage` |

---

## 8. 적용 순서

**순서를 지킨다.** 1번 없이 2번만 하면 AI가 걸러낼 오탐이 거의 없다(현재 함정 183건 중 2건).

| 단계 | 할 일 | 기대 효과 |
|---|---|---|
| **1** | `DIC.md`의 어휘 245개를 `keywords.py`에 얹는다. **정상 예외 84개를 반드시 함께** 넣는다 | 0.5 미만 광고 127건 중 **112건(88%)**이 임계 위로 올라온다 |
| **2** | 3구간 판정(3절) + `band` 전달 | 남은 애매 건을 AI에 넘길 통로가 생긴다 |
| **3** | AI 입력을 조합 문자열 객체로(4절), `confidence`·`usage` 수집 | AI가 제대로 된 재료를 받는다 |
| **4** | `decide()` 규칙(5절) | 1단계에서 늘어난 오탐을 깎는다. 현재 함정 2건은 `intent`로 갈린다 |
| **5** | 운영 항목(7절) | 적격평가에서 조용히 깨지는 경우를 막는다 |

1단계만 해도 재현율이 크게 오르고, 그때 정밀도가 얼마나 떨어지는지를 보고 4단계의 문턱을 조정한다.
**문턱을 먼저 정하지 말고 1단계 뒤에 측정해서 정한다.**

---

## 9. 검증

```bash
python -m unittest discover -s tests          # 키워드 회귀
python -m tools.score                         # 기존 테스트 사이트

# 모사 사이트 (두 분포 프로필)
detect.exe https://jevtest-two.vercel.app/board/list?page=1
node tools/score.mjs --site https://jevtest-two.vercel.app \
  --result ./result.json --extra ./result_extra.json

# 오탐 함정 전체 (게시판 진입으로는 /life 를 안 본다)
detect.exe https://jevtest-two.vercel.app/

# AI 효과 측정 - 같은 사이트를 두 번
detect.exe --no-ai <url>   # 그리고 AI 켜고 한 번 더. 두 결과를 비교한다
```

`tools/score.mjs`가 **유형별·분야별 재현율**과 **요강 5분야 / 요강 밖**을 나눠 보여 준다.
어느 분야 어휘가 비어 있는지 바로 보인다.

단계마다 네 숫자를 기록한다 — **재현율 / 정밀도 / 함정 회피 / 소요 시간**.
재현율이 올라도 정밀도가 더 떨어지면 손해다(45점 대 35점이지만, 정탐을 잃는 건 양쪽에서 깎인다).

---

## 10. 바꾸지 말 것

지금 통과하는 것들이다. 이 설계를 적용한 뒤에도 유지되어야 한다.

- **AI 없이도 모든 기능이 동작한다** (요강 요건이자 사용자 결정 2026-10-14). 6절의 보장을 깨지 않는다.
- **1차 판정은 조합된 문자열로** 한다(`normalize_spaced`로 공백을 남겨 `분야 동향`의 `야동`을 거른다).
- **`evidence_text`는 정규화 전 원문 그대로** 둔다. AI에 보내는 건 별개의 `state`다.
- **같은 문장은 한 번만 호출한다.**
- 비밀글을 열지 않는다 / 게시판 범위를 지킨다 / 「댓글 더보기」를 누른다 / iframe을 따라간다.
- 30분 제한. 현재 23초이고 AI 호출이 늘어도 상한(7절)으로 묶는다.
