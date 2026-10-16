#!/usr/bin/env node
/**
 * 수집한 스팸 문자열을 정제해 `data/copy.js`에 넣을 줄로 바꾼다.
 *
 *   pbpaste | node tools/harvest.mjs            # 표준입력으로 원문을 넣는다
 *   node tools/harvest.mjs --file raw.txt
 *   node tools/harvest.mjs --file raw.txt --json # 분류 근거까지 본다
 *
 * 하는 일
 *   1. 실제 식별자를 가짜로 바꾼다 - 도메인·텔레그램 핸들·전화번호·URL.
 *      제출물에 실제 불법 사이트의 도메인이나 연락처가 들어가면 안 된다.
 *   2. 분야를 추정한다(키워드 기준). 확신이 없으면 `UNKNOWN`으로 남긴다.
 *   3. 너무 짧거나 한글이 없는 줄은 버린다.
 *
 * 출력은 그대로 복사해 `data/copy.js`의 해당 분야 배열에 붙이면 된다.
 * 분류는 어디까지나 추정이므로 붙이기 전에 사람이 한 번 본다.
 */
import { readFileSync } from 'node:fs';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] ?? true : null;
};

const raw = arg('file') ? readFileSync(arg('file'), 'utf8') : readFileSync(0, 'utf8');

/** 분야 추정용 키워드. 먼저 맞는 것을 쓴다. */
const RULES = [
  ['GAMBLE', /카지노|바카라|토토|슬롯|홀덤|파워볼|먹튀|꽁머니|첫충|매충|배팅|베팅|놀이터|룰렛|블랙잭|사설|머니상|장집|코인장|솔루션광고|블랙키워드|찌라시|웹문서/],
  ['ADULT', /성인|야동|조건\s*만남|출장\s*안마|출장\s*마사지|오피|립카페|휴게텔|키스방|애인대행|출장샵|누드|무삭제|웹툰/],
  ['LOAN', /대출|급전|일수|월변|신불자|무직자|작업대출|내구제|폰테크|개인돈|현금화|소액결제/],
  ['DRUG', /필로폰|케타민|엑스터시|졸피뎀|대마|떨|아이스|작대기|허브|수면제|처방전\s*없이|비아그라|시알리스/],
  ['TRADE', /대포통장|대포폰|대포차|대포유심|선불유심|유심|통장\s*매입|통장\s*대여|명의|위조|레플|총판|상품권|돈세탁|자금세탁|접근매체|개인정보|명부|DB/],
  ['INVEST', /리딩방|리딩|종목|선물|옵션|코인|비상장|투자자문|대여계좌|FX|레버리지|원금\s*보장/],
  ['JOB', /알바|아르바이트|일당|수거|심부름|추심|환전\s*알바|고수익/],
  ['HACK', /해킹|악성코드|디도스|위치\s*추적|위치\s*조회|감시\s*앱|통화내역|흥신소|몸캠|비밀번호\s*복구/],
];

/** 실제 식별자를 가짜로 바꾼다. 같은 값은 같은 가짜로 바뀐다. */
function sanitize(line, seen) {
  const fake = (kind, key) => {
    const k = `${kind}:${key}`;
    if (!seen.has(k)) seen.set(k, seen.size + 1);
    const n = String(seen.get(k)).padStart(2, '0');
    return kind === 'host' ? `ad-test${n}.example.test` : `${kind.toUpperCase()}TEST${n}`;
  };
  return line
    // http(s) 주소
    .replace(/https?:\/\/[^\s<>"'】\]]+/gi, (m) => `http://${fake('host', m)}`)
    // 괄호 안 도메인 【abc.xyz】 / 【구글찌라시.xyz】 / [abc.com]
    // 한글 도메인도 실제로 쓰이므로 ASCII로 한정하지 않는다.
    .replace(/([【[])\s*([^\s【】[\]]+\.[a-z]{2,})\s*([】\]])/gi, (m, a, d, b) => `${a}${fake('host', d)}${b}`)
    // 맨몸 도메인 (한글 라벨 포함)
    .replace(/[\w가-힣][\w가-힣-]*\.(?:xyz|top|cc|vip|shop|site|club|online|com|net|kr|me|io)(?![\w가-힣])/gi, (m) => fake('host', m))
    // 텔레그램 핸들 @abc / 텔레:abc / 텔레 abc
    .replace(/@([A-Za-z][A-Za-z0-9_]{3,31})/g, (m, h) => `@${fake('tg', h)}`)
    .replace(/(텔레(?:그램)?\s*(?:문의)?\s*[:：]?\s*)([A-Za-z][A-Za-z0-9_]{3,31})/g, (m, p, h) => p + fake('tg', h))
    .replace(/(카톡\s*[:：]?\s*)([A-Za-z][A-Za-z0-9_]{3,31})/g, (m, p, h) => p + fake('kt', h))
    // 전화번호
    .replace(/\b0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4}\b/g, '000-0000-0000');
}

const seen = new Map();
const out = [];
for (const line0 of raw.split(/\r?\n/)) {
  const line = line0.replace(/\s+/g, ' ').trim();
  if (line.length < 8) continue;
  if (!/[가-힣]/.test(line)) continue; // 한글이 없으면 버린다
  const text = sanitize(line, seen);
  const dom = RULES.find(([, re]) => re.test(text))?.[0] ?? 'UNKNOWN';
  out.push({ dom, text });
}

if (arg('json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const by = {};
  for (const o of out) (by[o.dom] ??= []).push(o.text);
  for (const dom of Object.keys(by).sort()) {
    console.log(`\n// --- ${dom} (${by[dom].length}줄) ---`);
    for (const t of by[dom]) console.log(`    '${t.replace(/'/g, "\\'")}',`);
  }
  console.log(`\n// 총 ${out.length}줄. 식별자는 가짜로 바뀌었다. 붙이기 전에 분류를 사람이 확인할 것.`);
}
