#!/usr/bin/env node
/**
 * `DIC.md`의 정본 JSON을 뽑아 쓰고, 구조를 검사한다.
 *
 *   node tools/dict.mjs                 # JSON 을 표준출력으로
 *   node tools/dict.mjs --out dict.json
 *   node tools/dict.mjs --check         # 중복·빈 항목·충돌 검사
 *
 * DIC.md 는 사람이 손으로 고치는 원본이고, 이 도구는 읽기만 한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] ?? true : null;
};

const md = readFileSync(join(root, 'DIC.md'), 'utf8');
// 마지막 json 펜스가 정본이다.
const blocks = [...md.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
if (!blocks.length) {
  console.error('DIC.md 에서 json 블록을 찾지 못했습니다.');
  process.exit(1);
}
let dict;
try {
  dict = JSON.parse(blocks[blocks.length - 1]);
} catch (e) {
  console.error(`DIC.md 의 json 블록을 파싱하지 못했습니다: ${e.message}`);
  process.exit(1);
}

if (arg('check')) {
  const problems = [];
  const all = new Map(); // 어휘 -> 어디에 있는지

  const note = (term, where) => {
    const t = term.trim();
    if (!t) problems.push(`빈 항목: ${where}`);
    const prev = all.get(t);
    if (prev) problems.push(`중복: "${t}" (${prev} / ${where})`);
    else all.set(t, where);
  };

  for (const [dom, v] of Object.entries(dict.domains)) {
    for (const tier of ['strong', 'strong_en', 'domain', 'everyday']) {
      for (const t of v[tier] || []) note(t, `domains.${dom}.${tier}`);
    }
    if (!['spec', 'extra'].includes(v.scope)) problems.push(`scope 값이 이상함: ${dom} -> ${v.scope}`);
  }
  for (const t of dict.trade_cues) note(t, 'trade_cues');
  for (const t of dict.generic) note(t, 'generic');
  for (const t of dict.neg) note(t, 'neg');

  // 부정 맥락어가 분야 어휘와 겹치면 광고가 스스로를 깎는다.
  const domTerms = new Set();
  for (const v of Object.values(dict.domains)) {
    for (const tier of ['strong', 'strong_en', 'domain', 'everyday']) for (const t of v[tier] || []) domTerms.add(t);
  }
  for (const t of dict.neg) {
    if (domTerms.has(t)) problems.push(`충돌: "${t}" 가 neg 와 분야 어휘에 모두 있음 (광고가 스스로를 깎는다)`);
  }
  // 정상 예외가 분야 어휘와 글자 그대로 같으면 그 어휘는 영영 안 걸린다.
  for (const t of [...dict.benign_strong, ...dict.benign_weak]) {
    if (domTerms.has(t)) problems.push(`충돌: "${t}" 가 benign 과 분야 어휘에 모두 있음`);
  }

  const counts = Object.fromEntries(
    Object.entries(dict.domains).map(([k, v]) => [k, (v.strong?.length || 0) + (v.strong_en?.length || 0) + (v.domain?.length || 0) + (v.everyday?.length || 0)])
  );
  console.log(`사전 ${dict.version} (${dict.updated})`);
  console.log(`분야 ${Object.keys(dict.domains).length}개 / 어휘 ${all.size}개`);
  console.log('분야별 어휘:', JSON.stringify(counts));
  console.log(`권유어 ${dict.trade_cues.length} · 유인어 ${dict.generic.length} · 부정맥락 ${dict.neg.length} · 정상예외 ${dict.benign_strong.length + dict.benign_weak.length}`);
  if (problems.length) {
    console.log(`\n문제 ${problems.length}건`);
    for (const p of problems) console.log('  -', p);
    process.exit(1);
  }
  console.log('\n문제 없음');
} else if (arg('out')) {
  writeFileSync(arg('out'), JSON.stringify(dict, null, 2) + '\n', 'utf8');
  console.log(`${arg('out')} 에 썼습니다.`);
} else {
  process.stdout.write(JSON.stringify(dict, null, 2) + '\n');
}
