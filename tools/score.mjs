#!/usr/bin/env node
/**
 * 탐지 결과를 정답표와 맞춰 점수를 낸다.
 *
 *   node tools/score.mjs --site https://xxx.vercel.app --result ./result.json --extra ./result_extra.json
 *
 * 채점 방법
 *   1. 정답표(/api/answer-key)를 받아 온다.
 *   2. 결과의 각 건에서 (주소, location) 을 보고, location 안에 들어 있는 data-gt 표식을 찾는다.
 *      도구가 `[data-gt="G01"]` 처럼 적지 않았다면 --fetch 로 실제 페이지를 받아
 *      location 선택자를 맞춰 보는 대신, evidence_text 가 같은 정답을 찾는 방식으로 대조한다.
 *   3. gt + technique 가 맞으면 TP, 정답표에 없으면 FP, 못 찾은 정답은 FN.
 *
 * 외부 라이브러리를 쓰지 않는다(Node 18+ 내장 fetch만 사용).
 */
import { readFileSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const site = (arg('site', 'http://localhost:3000') || '').replace(/\/+$/, '');
const resultPath = arg('result', './result.json');
const extraPath = arg('extra', './result_extra.json');
// 검사한 사이트에 직접 닿을 수 없을 때 정답표만 다른 데서 받아 온다.
// 예: --answer-key "http://localhost:3000/api/answer-key?origin=https://xxx.vercel.app"
const keyUrlArg = arg('answer-key', null);

function readJson(p, label) {
  try {
    const raw = readFileSync(p, 'utf8').replace(/^﻿/, '');
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : (v.findings ?? v.results ?? v.data ?? []);
  } catch (e) {
    console.error(`! ${label} 파일을 읽지 못했습니다 (${p}): ${e.message}`);
    return [];
  }
}

const keyUrl = keyUrlArg || `${site}/api/answer-key?origin=${encodeURIComponent(site)}`;
const key = await fetch(keyUrl).then((r) => {
  if (!r.ok) throw new Error(`정답표를 받지 못했습니다: ${r.status} ${keyUrl}`);
  return r.json();
});

const main = readJson(resultPath, 'result.json');
const extra = readJson(extraPath, 'result_extra.json');

/**
 * 주소를 비교할 수 있게 다듬는다.
 *
 * 경로마다 그 페이지를 가리키는 변수만 남긴다. 글 상세의 `page`처럼 화면 표시만 바꾸는
 * 변수는 지운다(목록에서 들어오면 `?id=1045&page=5`, 바로 열면 `?id=1045`로 같은 글이다).
 */
const ID_PARAMS = {
  '/board/view': ['id'],
  '/jsboard/view.do': ['nttId'],
  '/iframe/ad': ['id'],
  '/api/comments': ['id'],
  '/board/list': ['page'],
  '/gallery': ['page'],
  '/jsboard/list.do': ['pageIndex'],
};

function normUrl(u) {
  try {
    const x = new URL(u, site);
    const path = x.pathname.replace(/\/+$/, '') || '/';
    const keepNames = ID_PARAMS[path];
    const keep = new URLSearchParams();
    for (const [k, v] of [...x.searchParams].sort()) {
      // 아는 경로는 식별 변수만, 모르는 경로는 쿼리를 그대로 둔다.
      if (!keepNames || keepNames.includes(k)) keep.set(k, v);
    }
    const q = keep.toString();
    return `${x.protocol}//${x.host}${path}${q ? '?' + q : ''}`.replace(/^https:/, 'http:');
  } catch {
    return String(u);
  }
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** NFD 자모 분해처럼 눈에 안 보이는 표기 차이를 흡수한 비교용 형태. */
const fold = (s) => norm(s).normalize('NFC');

/**
 * `extra_finding`에서 유형 코드만 떼어 낸다.
 * 도구가 `HTML_COMMENT(HTML 주석 속 불법광고)`처럼 설명을 붙여 적어도 맞춰진다.
 */
function codeOf(raw) {
  const m = /^[A-Z_]+/.exec(String(raw ?? '').trim().toUpperCase());
  return m ? m[0] : String(raw ?? '').trim().toUpperCase();
}

/**
 * 정답 색인 3단.
 *
 * 1) gt+기법       — 도구가 `[data-gt="G01"]`처럼 표식을 적었을 때
 * 2) 주소+원문+기법 — 도구가 자기 선택자로 적었을 때 (여기가 보통 쓰인다)
 * 3) 원문+기법      — 주소 표기가 어긋났을 때의 마지막 수단
 *
 * 2)가 꼭 필요하다. 같은 광고 문구를 여러 글에 심어 두었기 때문에 원문만으로 맞추면
 * 서로 다른 글의 검출이 한 정답에 몰려 멀쩡한 검출이 오탐으로 깎인다.
 */
const byGtCode = new Map();
const byUrlEvCode = new Map();
const byEvCode = new Map();
for (const f of key.expected_findings) {
  byGtCode.set(`${f.gt}|${f.code}`, f);
  for (const ev of new Set([norm(f.evidence_text), fold(f.evidence_text)])) {
    const uk = `${normUrl(f.url)}|${ev}|${f.code}`;
    if (!byUrlEvCode.has(uk)) byUrlEvCode.set(uk, f);
    const ek = `${ev}|${f.code}`;
    if (!byEvCode.has(ek)) byEvCode.set(ek, f);
  }
}
const trapByEv = new Map();
const trapGts = new Set();
for (const a of key.expected_absent) {
  trapGts.add(a.gt);
  for (const t of new Set([norm(a.text), fold(a.text)])) trapByEv.set(t, a);
}

function gtFromLocation(loc) {
  const m = /data-gt\s*=\s*["']?([A-Z]\d+)/i.exec(String(loc ?? ''));
  return m ? m[1].toUpperCase() : null;
}

const rows = [
  ...main.map((r) => ({ ...r, bucket: 'main', code: codeOf(r.technique) })),
  ...extra.map((r) => ({ ...r, bucket: 'extra', code: codeOf(r.extra_finding ?? r.technique) })),
];

const tpGt = new Set();
const fp = [];
const trapHits = [];

const dup = [];
for (const r of rows) {
  const code = r.code;
  const gt = gtFromLocation(r.location);
  const u = normUrl(r.url);
  const evs = [norm(r.evidence_text), fold(r.evidence_text)];

  let hit = gt ? byGtCode.get(`${gt}|${code}`) : null;
  for (const ev of evs) if (!hit) hit = byUrlEvCode.get(`${u}|${ev}|${code}`);
  for (const ev of evs) if (!hit) hit = byEvCode.get(`${ev}|${code}`);

  if (hit) {
    const k = `${hit.gt}|${hit.code}`;
    // 같은 정답을 두 번 보고한 것은 오탐이 아니라 중복이다(채점은 1건으로 합친다).
    if (tpGt.has(k)) dup.push(r);
    tpGt.add(k);
    continue;
  }
  if ((gt && trapGts.has(gt)) || evs.some((ev) => trapByEv.has(ev))) {
    trapHits.push(r);
  }
  fp.push(r);
}

const allGtCode = new Set(key.expected_findings.map((f) => `${f.gt}|${f.code}`));
// 요강 5개 분야와 요강 밖 유형을 갈라 센다.
const scopeOf = new Map();
for (const f of key.expected_findings) scopeOf.set(`${f.gt}|${f.code}`, f.scope || 'spec');
const fn = [...allGtCode].filter((k) => !tpGt.has(k)).sort();

const tp = tpGt.size;
const prec = tp + fp.length ? tp / (tp + fp.length) : 0;
const rec = allGtCode.size ? tp / allGtCode.size : 0;
const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;

const pct = (x) => (x * 100).toFixed(1) + '%';
console.log(`대상 사이트 : ${site}`);
console.log(`정답 수     : ${allGtCode.size} (함정 ${trapGts.size}건)`);
console.log(`보고된 검출 : ${rows.length} (result.json ${main.length}, result_extra.json ${extra.length})`);
console.log('');
console.log(`맞힘(TP)    : ${tp}`);
console.log(`놓침(FN)    : ${fn.length}`);
console.log(`오탐(FP)    : ${fp.length}  그중 함정을 건드린 것 ${trapHits.length}건`);
if (dup.length) console.log(`중복        : ${dup.length}  (같은 정답을 두 번 보고 - 채점은 1건으로 합침)`);
console.log(`정밀도      : ${pct(prec)}   재현율: ${pct(rec)}   F1: ${pct(f1)}`);

// 적격평가는 요강 5개 분야만 본다. 그 숫자를 따로 보여 준다.
const spec = [...allGtCode].filter((k) => scopeOf.get(k) === 'spec');
const extraScope = [...allGtCode].filter((k) => scopeOf.get(k) === 'extra');
const hit = (arr) => arr.filter((k) => tpGt.has(k)).length;
console.log('');
console.log(`요강 5개 분야  : ${hit(spec)}/${spec.length}  ${pct(spec.length ? hit(spec) / spec.length : 0)}   <- 적격평가 대상`);
if (extraScope.length) {
  console.log(`요강 밖 유형   : ${hit(extraScope)}/${extraScope.length}  ${pct(hit(extraScope) / extraScope.length)}   (리딩방·고수익알바 등, 본심사 창의성 참고)`);
}

// 유형별
const perCode = new Map();
for (const k of allGtCode) {
  const code = k.split('|')[1];
  const s = perCode.get(code) ?? { total: 0, tp: 0 };
  s.total++;
  if (tpGt.has(k)) s.tp++;
  perCode.set(code, s);
}
console.log('\n유형별 재현율');
for (const [code, s] of [...perCode].sort()) {
  console.log(`  ${code.padEnd(18)} ${s.tp}/${s.total}  ${pct(s.total ? s.tp / s.total : 0)}`);
}

if (fn.length) {
  console.log('\n놓친 정답');
  for (const k of fn) {
    const [gt, code] = k.split('|');
    const f = byGtCode.get(k);
    console.log(`  ${gt} ${code.padEnd(18)} ${f.where.padEnd(7)} ${f.evidence_text.slice(0, 40)}  (${f.note})`);
  }
}
if (trapHits.length) {
  console.log('\n함정을 건드린 오탐');
  for (const r of trapHits) console.log(`  ${r.code} ${r.url} ${r.location} :: ${String(r.evidence_text).slice(0, 50)}`);
}
if (fp.length - trapHits.length > 0) {
  console.log('\n그 밖의 오탐(앞 20건)');
  for (const r of fp.filter((x) => !trapHits.includes(x)).slice(0, 20)) {
    console.log(`  ${r.code} ${normUrl(r.url)} ${r.location} :: ${String(r.evidence_text).slice(0, 50)}`);
  }
}
