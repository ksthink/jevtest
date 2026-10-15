/**
 * 위장·은닉 문자 변환기.
 *
 * 모든 함수는 순수 함수이고 난수를 쓰지 않는다. 같은 입력이면 항상 같은 출력이라
 * 페이지 HTML과 정답표(`evidence_text`)가 어긋나지 않는다.
 */

/** ASCII -> 전각(Fullwidth). `mega-BET` -> `ｍｅｇａ－ＢＥＴ` */
function fullwidth(s) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (ch === ' ') return '　';
      if (c >= 0x21 && c <= 0x7e) return String.fromCodePoint(c + 0xfee0);
      return ch;
    })
    .join('');
}

/** 라틴 글자를 모양이 같은 키릴·그리스 글자로 바꾼다. `CASINO` -> `САЅІΝО` */
// 널리 쓰이는 혼동 글자만 쓴다. Ꝇ(U+A746)·Ԍ·ո 같은 희귀 글자는 혼동 글자표에도
// NFKC에도 없어서 어떤 도구로도 되돌릴 수 없다. 그런 글자를 넣으면 정답표가 불공정해진다.
// 대응 글자가 없는 L·N·G 등은 라틴 그대로 남긴다(실제 광고도 섞어 쓴다).
const CYRILLIC = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', J: 'Ј', K: 'К', M: 'М',
  O: 'О', P: 'Р', S: 'Ѕ', T: 'Т', X: 'Х', Y: 'Ү',
  a: 'а', c: 'с', e: 'е', i: 'і', j: 'ј', o: 'о', p: 'р', s: 'ѕ', x: 'х', y: 'у',
};
function cyrillic(s) {
  return [...s].map((ch) => CYRILLIC[ch] || ch).join('');
}

/** 숫자·기호 치환. `toto` -> `t0t0`, `casino` -> `ca$1no` */
// 되돌릴 수 있는 치환만 쓴다(0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s).
const LEET = { o: '0', O: '0', i: '1', I: '1', s: '$', S: '$', e: '3', E: '3', a: '@', A: '@', t: '7', T: '7', l: '1' };
const LEET_ALL = Object.keys(LEET);
function leet(s, only = LEET_ALL) {
  return [...s].map((ch) => (only.includes(ch) ? LEET[ch] || ch : ch)).join('');
}

/** 원문자(Enclosed Alphanumerics). `BET` -> `ⒷⒺⓉ` */
function circled(s) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(0x24b6 + (c - 0x41));
      if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(0x24d0 + (c - 0x61));
      if (c >= 0x31 && c <= 0x39) return String.fromCodePoint(0x2460 + (c - 0x31));
      return ch;
    })
    .join('');
}

/** 수학용 영문(Mathematical Sans-Serif Bold). `SLOT` -> `𝗦𝗟𝗢𝗧` */
function mathBold(s) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(0x1d5d4 + (c - 0x41));
      if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(0x1d5ee + (c - 0x61));
      return ch;
    })
    .join('');
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/**
 * 한글 음절을 호환 자모로 분해한다. `카지노` -> `ㅋㅏㅈㅣㄴㅗ`
 * `targets`를 주면 그 글자가 든 어절만 분해해 자연스러운 섞임을 만든다.
 */
function jamo(s) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c < 0xac00 || c > 0xd7a3) return ch;
      const idx = c - 0xac00;
      return CHO[Math.floor(idx / 588)] + JUNG[Math.floor((idx % 588) / 28)] + JONG[idx % 28];
    })
    .join('');
}

/** NFD 조합형 자모로 분해한다. 눈으로는 멀쩡해 보이지만 코드 포인트가 다르다. */
function nfd(s) {
  return s.normalize('NFD');
}

/**
 * 모음을 모양이 닮은 라틴 글자로 쓴 위장. `카지노` -> `ㅋr지노`, `배팅` -> `ㅂH팅`
 *
 * 받침이 없고 중성이 라틴 글자와 닮은 음절만 바꾼다(ㅏ->r, ㅐ->H, ㅣ->i, ㅜ->T).
 * 되돌릴 수 있는 대응만 쓴다. 특정 글자 목록이 아니라 음절 구조로 판단하므로
 * 한글 문구 거의 전부에 걸린다.
 */
const VOWEL_LIKE = { 'ㅏ': 'r', 'ㅐ': 'H', 'ㅣ': 'i', 'ㅜ': 'T' };
function jamoLatin(s) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c < 0xac00 || c > 0xd7a3) return ch;
      const idx = c - 0xac00;
      if (idx % 28 !== 0) return ch; // 받침이 있으면 건드리지 않는다
      const latin = VOWEL_LIKE[JUNG[Math.floor((idx % 588) / 28)]];
      return latin ? CHO[Math.floor(idx / 588)] + latin : ch;
    })
    .join('');
}

/** 폭 0 문자(U+200B)를 글자 사이에 끼워 키워드 매칭을 회피한다. */
function zeroWidth(s, mark = '​') {
  const chars = [...s];
  return chars.map((ch, i) => (ch === ' ' || i === chars.length - 1 ? ch : ch + mark)).join('');
}

/** 글자 사이를 공백으로 띄운 위장. `카지노` -> `카 지 노` */
function spaced(s) {
  return [...s].join(' ');
}

/** HTML 엔티티로 바꾼 위장. `카지노` -> `&#52852;&#51648;&#45432;` */
function entities(s) {
  return [...s].map((ch) => `&#${ch.codePointAt(0)};`).join('');
}

module.exports = { fullwidth, cyrillic, leet, circled, mathBold, jamo, nfd, jamoLatin, zeroWidth, spaced, entities };
