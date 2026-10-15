#!/usr/bin/env node
/**
 * 자기 점검.
 *
 * 정답표에 적힌 모든 항목이 실제로 그 주소의 HTML에 있는지 확인한다.
 * 사이트를 고친 뒤 정답표가 어긋나지 않았는지 보는 용도다.
 *
 *   node server.js &            # 먼저 서버를 띄운다
 *   node tools/check.mjs --site http://localhost:3000
 */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const site = arg('site', 'http://localhost:3000').replace(/\/+$/, '');

const key = await fetch(`${site}/api/answer-key`).then((r) => r.json());

const cache = new Map();
async function body(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${url}`)))));
  return cache.get(url);
}

let bad = 0;
let checked = 0;

// 1) 검출되어야 하는 것: 주소의 HTML에 data-gt와 원문이 함께 있어야 한다.
for (const f of key.expected_findings) {
  // iframe 안에 있는 건은 iframe 문서를 직접 받아서 본다.
  const m = /^iframe\[src="([^"]+)"\]/.exec(f.location);
  const target = m ? m[1] : f.url;
  let html;
  try {
    html = await body(target);
  } catch (e) {
    console.log(`FAIL ${f.gt} ${f.code}: 주소를 받지 못함 ${e.message}`);
    bad++;
    continue;
  }
  checked++;
  if (!html.includes(`data-gt="${f.gt}"`)) {
    console.log(`FAIL ${f.gt} ${f.code}: ${target} 에 data-gt="${f.gt}" 가 없음`);
    bad++;
    continue;
  }
  // HTML 주석·엔티티 변형은 원문이 그대로 들어 있지 않을 수 있어 건너뛴다.
  const skipText = f.code === 'HTML_COMMENT' || /&#\d+;/.test(html.split(`data-gt="${f.gt}"`)[1]?.slice(0, 400) ?? '');
  if (!skipText && !html.includes(f.evidence_text)) {
    console.log(`FAIL ${f.gt} ${f.code}: ${target} 에 원문이 없음 :: ${f.evidence_text}`);
    bad++;
  }
}

// 2) 함정: 적어 둔 주소의 HTML에 있어야 한다(없으면 정답표가 낡은 것).
for (const a of key.expected_absent) {
  if (a.url.startsWith('(')) continue;
  let html;
  try {
    html = await body(a.url);
  } catch (e) {
    console.log(`FAIL trap ${a.gt}: 주소를 받지 못함 ${e.message}`);
    bad++;
    continue;
  }
  checked++;
  if (!html.includes(`data-gt="${a.gt}"`)) {
    console.log(`FAIL trap ${a.gt}: ${a.url} 에 data-gt="${a.gt}" 가 없음`);
    bad++;
  }
}

// 3) 쪽마다 글이 10건씩 나오는지, 쪽 넘김이 끝까지 되는지
for (let p = 1; p <= key.counts.pages; p++) {
  for (const u of [`${site}/board/list?page=${p}`, `${site}/jsboard/list.do?bbsId=B02&pageIndex=${p}`, `${site}/gallery?page=${p}`]) {
    const html = await body(u);
    checked++;
    const n = u.includes('gallery') ? (html.match(/<li><a href="\/board\/view/g) || []).length : (html.match(/<tr><td>\d+<\/td>/g) || []).length;
    if (n !== 10) {
      console.log(`FAIL 목록: ${u} 에 글이 ${n}건 (10건이어야 함)`);
      bad++;
    }
  }
}

// 4) 모든 글 상세가 열리는지
const ids = new Set(key.expected_findings.map((f) => f.post_id).filter((x) => x > 0));
for (let id = 1001; id <= 1100; id++) ids.add(id);
for (const id of ids) {
  const r = await fetch(`${site}/board/view?id=${id}`);
  checked++;
  if (!r.ok) {
    console.log(`FAIL 상세: /board/view?id=${id} -> ${r.status}`);
    bad++;
  }
}

console.log(`\n확인 ${checked}건, 문제 ${bad}건`);
console.log(`정답 ${key.counts.unique_findings}건 / 함정 ${key.counts.traps}건 / 글 ${key.counts.posts}건`);
process.exit(bad ? 1 : 0);
