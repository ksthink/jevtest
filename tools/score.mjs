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

const keyUrl = `${site}/api/answer-key?origin=${encodeURIComponent(site)}`;
const key = await fetch(keyUrl).then((r) => {
  if (!r.ok) throw new Error(`정답표를 받지 못했습니다: ${r.status} ${keyUrl}`);
  return r.json();
});

const main = readJson(resultPath, 'result.json');
const extra = readJson(extraPath, 'result_extra.json');

/** 주소를 비교할 수 있게 다듬는다(쿼리 순서·불필요한 변수 정리). */
function normUrl(u) {
  try {
    const x = new URL(u, site);
    const keep = new URLSearchParams();
    for (const [k, v] of [...x.searchParams].sort()) {
      if (['page', 'pageIndex', 'id', 'nttId'].includes(k)) keep.set(k, v);
    }
    const q = keep.toString();
    return `${x.origin}${x.pathname}${q ? '?' + q : ''}`;
  } catch {
    return String(u);
  }
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// 정답 색인: gt+code, 그리고 evidence_text+code 로도 찾을 수 있게 한다.
const byGtCode = new Map();
const byEvCode = new Map();
for (const f of key.expected_findings) {
  byGtCode.set(`${f.gt}|${f.code}`, f);
  const ek = `${norm(f.evidence_text)}|${f.code}`;
  if (!byEvCode.has(ek)) byEvCode.set(ek, f);
}
const trapByEv = new Map();
const trapGts = new Set();
for (const a of key.expected_absent) {
  trapGts.add(a.gt);
  trapByEv.set(norm(a.text), a);
}

function gtFromLocation(loc) {
  const m = /data-gt\s*=\s*["']?([A-Z]\d+)/i.exec(String(loc ?? ''));
  return m ? m[1].toUpperCase() : null;
}

const rows = [
  ...main.map((r) => ({ ...r, bucket: 'main', code: r.technique ?? 'UNKNOWN' })),
  ...extra.map((r) => ({ ...r, bucket: 'extra', code: r.extra_finding ?? r.technique ?? 'UNKNOWN' })),
];

const tpGt = new Set();
const fp = [];
const trapHits = [];

for (const r of rows) {
  const code = String(r.code).toUpperCase();
  const gt = gtFromLocation(r.location);
  let hit = gt ? byGtCode.get(`${gt}|${code}`) : null;
  if (!hit) hit = byEvCode.get(`${norm(r.evidence_text)}|${code}`);

  if (hit) {
    tpGt.add(`${hit.gt}|${hit.code}`);
    continue;
  }
  if ((gt && trapGts.has(gt)) || trapByEv.has(norm(r.evidence_text))) {
    trapHits.push(r);
  }
  fp.push(r);
}

const allGtCode = new Set(key.expected_findings.map((f) => `${f.gt}|${f.code}`));
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
console.log(`정밀도      : ${pct(prec)}   재현율: ${pct(rec)}   F1: ${pct(f1)}`);

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
