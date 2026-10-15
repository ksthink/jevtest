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
const CYRILLIC = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', J: 'Ј', K: 'К', M: 'М',
  O: 'О', P: 'Р', S: 'Ѕ', T: 'Т', X: 'Х', Y: 'Ү',
  a: 'а', c: 'с', e: 'е', i: 'і', j: 'ј', o: 'о', p: 'р', s: 'ѕ', x: 'х', y: 'у',
  N: 'Ν', G: 'Ԍ', L: 'Ꝇ', n: 'ո', g: 'ɡ',
};
function cyrillic(s) {
  return [...s].map((ch) => CYRILLIC[ch] || ch).join('');
}

/** 숫자·기호 치환. `toto` -> `t0t0`, `casino` -> `ca$1no` */
const LEET = { o: '0', O: '0', i: '1', I: '1', s: '$', S: '$', e: '3', a: '@', l: '1' };
function leet(s, only = ['o', 'O', 'i', 'I']) {
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

/** 모음을 모양이 닮은 라틴 글자로 쓴 위장. `카지노` -> `ㅋr지노` */
const JAMO_LATIN = { 카: 'ㅋr', 사: 'ㅅr', 자: 'ㅈr', 다: 'Cr', 바: 'br', 마: 'nr', 나: 'Lr', 파: 'ㅍr' };
function jamoLatin(s) {
  return [...s].map((ch) => JAMO_LATIN[ch] || ch).join('');
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
