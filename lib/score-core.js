/**
 * 요강 기준 채점 로직. `/score` 화면이 브라우저에서 돌린다.
 *
 * 브라우저에는 `createScorer.toString()`을 그대로 내려보내므로 함수 밖의 값을 참조하면 안 된다.
 * 필요한 것은 전부 `createScorer` 안에 둔다. 요소 찾기(CSS 선택자 해석)는 DOM이 있어야 하므로
 * 호출하는 쪽이 `resolve(url, location)`으로 넘긴다.
 *
 * 따르는 규칙 (공모전 모집요강 붙임2 p.6, 붙임4 p.10~12)
 *   파일   UTF-8(BOM 없음) JSON, 최상위 키는 `meta`·`findings` 두 개, `findings`는 단일 배열
 *   meta   topic·entry_url·started_at·finished_at(ISO 8601)·elapsed_sec(number) 필수, tool_version 선택
 *   항목   id(파일 안 고유)·url(전체 주소)·is_violation(boolean)·location·evidence_text·technique 필수
 *          technique은 4종 중 하나(result.json) 또는 "ETC"(result_extra.json), 배열·나열 불가
 *   정답   url·location·technique 세 필드가 모두 정답셋과 같을 때. 세 필드가 같은 항목은 1건으로 합친다
 *   url    끝의 `/`, http/https, `#` 이하는 무시. 쿼리 값이 다르면 다른 페이지, 항목 순서만 다르면 같은 페이지
 *   location 같은 요소를 가리키면 정답(표기 무관), 두 곳 이상을 가리키면 오답.
 *          iframe 안은 `iframe[src="절대주소"] >>> 선택자`
 *   제외   필수 필드가 빠졌거나 스키마를 어긴 항목은 채점에서 빼고, 정확도 계산에서는 오답으로 센다
 *   시간   30분(1,800초)을 넘으면 검출 시간 0점
 */
function createScorer() {
  const MAIN_CODES = ['HOMOGLYPH', 'JAMO', 'TRANSPARENT', 'OFFSCREEN'];
  const TIME_LIMIT_SEC = 1800;
  const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
  const REQUIRED = ['id', 'url', 'is_violation', 'location', 'evidence_text', 'technique'];
  const KNOWN = new Set([...REQUIRED, 'extra_finding']);

  const isStr = (v) => typeof v === 'string';
  const type = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

  function absoluteHttp(u) {
    try {
      const x = new URL(u);
      return x.protocol === 'http:' || x.protocol === 'https:' ? x : null;
    } catch {
      return null;
    }
  }

  /**
   * 요강의 주소 비교 규칙대로 다듬은 비교용 문자열.
   * 프로토콜·`#` 이하·경로 끝 `/`를 무시하고, 쿼리는 순서만 정렬한다(값은 그대로 비교).
   */
  function urlKey(u) {
    const x = absoluteHttp(u);
    if (!x) return null;
    const path = x.pathname.replace(/\/+$/, '') || '/';
    const q = [...x.searchParams].sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
    const qs = new URLSearchParams(q).toString();
    return `${x.host.toLowerCase()}${path}${qs ? '?' + qs : ''}`;
  }

  /**
   * 결과 파일 한 개를 검사한다.
   *
   * @param {Uint8Array} bytes 파일 내용
   * @param {'main'|'extra'} kind result.json / result_extra.json
   * @param {string} [fileName]
   * @returns {{fatal: string|null, issues: {level: string, msg: string}[], meta: object|null,
   *            entryUrl: string|null, elapsed: number|null, items: object[]}}
   */
  function validateFile(bytes, kind, fileName) {
    const out = { fatal: null, issues: [], meta: null, entryUrl: null, elapsed: null, items: [] };
    const err = (msg) => out.issues.push({ level: 'error', msg });
    const warn = (msg) => out.issues.push({ level: 'warn', msg });
    const expectName = kind === 'main' ? 'result.json' : 'result_extra.json';
    if (fileName && fileName !== expectName) warn(`파일 이름이 \`${expectName}\`이 아닙니다 (\`${fileName}\`)`);

    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      err('UTF-8 BOM이 붙어 있습니다. 요강은 BOM 없는 UTF-8을 요구합니다');
      bytes = bytes.subarray(3);
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      out.fatal = 'UTF-8로 읽을 수 없습니다. 파일 전체가 파싱되지 않으면 그 회차 성능 점수는 0점입니다';
      return out;
    }
    let doc;
    try {
      doc = JSON.parse(text);
    } catch (e) {
      out.fatal = `JSON 파싱 실패: ${e.message}. 파일 전체가 파싱되지 않으면 그 회차 성능 점수는 0점입니다`;
      return out;
    }
    if (type(doc) !== 'object') {
      out.fatal = `최상위가 객체가 아닙니다(${type(doc)}). 최상위 키는 \`meta\`, \`findings\` 두 개여야 합니다`;
      return out;
    }
    const extraKeys = Object.keys(doc).filter((k) => k !== 'meta' && k !== 'findings');
    if (extraKeys.length) err(`최상위 키는 \`meta\`, \`findings\` 두 개여야 합니다. 그 밖의 키: ${extraKeys.map((k) => `\`${k}\``).join(', ')}`);

    // meta
    const meta = doc.meta;
    if (type(meta) !== 'object') {
      err('`meta`가 없거나 객체가 아닙니다');
    } else {
      out.meta = meta;
      const need = (k, t) => {
        if (!(k in meta)) return err(`meta.${k}가 없습니다 (필수)`), false;
        if (type(meta[k]) !== t) return err(`meta.${k}의 타입이 ${t}가 아닙니다 (${type(meta[k])})`), false;
        return true;
      };
      if (need('topic', 'string') && meta.topic !== 'TOPIC' && meta.topic !== 'TOPIC(불법광고)') {
        warn(`meta.topic이 요강 예시(\`"TOPIC"\`)와 다릅니다: \`${meta.topic}\``);
      }
      if (need('entry_url', 'string')) {
        if (absoluteHttp(meta.entry_url)) out.entryUrl = meta.entry_url;
        else err(`meta.entry_url이 http(s) 전체 주소가 아닙니다: \`${meta.entry_url}\``);
      }
      const times = {};
      for (const k of ['started_at', 'finished_at']) {
        if (!need(k, 'string')) continue;
        if (!ISO_8601.test(meta[k]) || Number.isNaN(Date.parse(meta[k]))) err(`meta.${k}가 ISO 8601 형식이 아닙니다: \`${meta[k]}\``);
        else {
          times[k] = Date.parse(meta[k]);
          if (!/(Z|[+-]\d{2}:?\d{2})$/.test(meta[k])) warn(`meta.${k}에 시간대가 없습니다(예: \`+09:00\`)`);
        }
      }
      if (need('elapsed_sec', 'number')) {
        if (!Number.isFinite(meta.elapsed_sec) || meta.elapsed_sec < 0) err(`meta.elapsed_sec가 0 이상의 수가 아닙니다: ${meta.elapsed_sec}`);
        else out.elapsed = meta.elapsed_sec;
      }
      if (times.started_at != null && times.finished_at != null) {
        const diff = (times.finished_at - times.started_at) / 1000;
        if (diff < 0) err('meta.finished_at이 started_at보다 앞섭니다');
        else if (out.elapsed != null && Math.abs(diff - out.elapsed) > 2) {
          warn(`meta.elapsed_sec(${out.elapsed})가 finished_at − started_at(${diff.toFixed(1)}초)과 맞지 않습니다`);
        }
      }
      if ('tool_version' in meta && !isStr(meta.tool_version)) err('meta.tool_version의 타입이 string이 아닙니다');
    }

    // findings
    if (!('findings' in doc)) {
      err('`findings`가 없습니다. 검출이 0건이어도 `findings: []`를 넣어야 합니다');
      return out;
    }
    if (!Array.isArray(doc.findings)) {
      err(`\`findings\`가 배열이 아닙니다(${type(doc.findings)}). 페이지별로 나누지 않은 단일 배열이어야 합니다`);
      return out;
    }

    const ids = new Map();
    doc.findings.forEach((raw, index) => {
      const item = { index, raw, errors: [], warnings: [] };
      out.items.push(item);
      if (type(raw) !== 'object') {
        item.errors.push(`객체가 아닙니다(${type(raw)})`);
        return;
      }
      for (const k of REQUIRED) {
        if (k in raw) continue;
        // 요강의 result_extra.json 예시(붙임4)에는 is_violation이 없다. 적격평가 채점 대상도 아니라 경고만 한다.
        if (kind === 'extra' && k === 'is_violation') item.warnings.push('is_violation 없음 (요강 extra 예시에도 없음)');
        else item.errors.push(`${k} 없음 (필수)`);
      }
      for (const k of ['id', 'url', 'location', 'evidence_text', 'technique']) {
        if (k in raw && !isStr(raw[k])) item.errors.push(`${k}의 타입이 string이 아님 (${type(raw[k])})`);
      }
      if ('is_violation' in raw && typeof raw.is_violation !== 'boolean') item.errors.push(`is_violation의 타입이 boolean이 아님 (${type(raw.is_violation)})`);
      if ('extra_finding' in raw && !isStr(raw.extra_finding)) item.errors.push(`extra_finding의 타입이 string이 아님 (${type(raw.extra_finding)})`);

      if (isStr(raw.id)) {
        if (!raw.id) item.errors.push('id가 빈 문자열');
        else if (ids.has(raw.id)) item.errors.push(`id \`${raw.id}\`가 ${ids.get(raw.id) + 1}번째 항목과 겹침 (파일 안에서 고유해야 함)`);
        else ids.set(raw.id, index);
      }
      if (isStr(raw.url) && !absoluteHttp(raw.url)) item.errors.push(`url이 http(s) 전체 주소가 아님: \`${raw.url}\``);
      if (isStr(raw.location) && !raw.location.trim()) item.errors.push('location이 빈 문자열');
      if (isStr(raw.technique)) {
        if (kind === 'main' && !MAIN_CODES.includes(raw.technique)) {
          item.errors.push(
            raw.technique === 'ETC'
              ? 'technique "ETC"는 result_extra.json에 적어야 함'
              : `technique이 4종(${MAIN_CODES.join('·')}) 가운데 하나가 아님: \`${raw.technique}\``
          );
        }
        if (kind === 'extra' && raw.technique !== 'ETC') item.errors.push(`추가 탐지의 technique은 "ETC" 고정: \`${raw.technique}\``);
      }
      if (isStr(raw.evidence_text) && !raw.evidence_text.trim()) item.warnings.push('evidence_text가 비어 있음 (본심사 자료)');
      if (raw.is_violation === false) item.warnings.push('is_violation이 false');
      if (kind === 'extra' && !('extra_finding' in raw)) item.warnings.push('extra_finding(추가 유형 이름)이 없음');
      if (isStr(raw.location) && /\S>>>|>>>\S/.test(raw.location)) item.warnings.push('`>>>` 앞뒤에 공백 1칸이 없음');
      const unknown = Object.keys(raw).filter((k) => !KNOWN.has(k));
      if (unknown.length) item.warnings.push(`요강에 없는 필드: ${unknown.join(', ')}`);
    });
    return out;
  }

  /**
   * 정답 색인을 만든다.
   *
   * 정답 1건 = (주소, iframe 경로, 요소, 기법). 요소는 정답표 location의 `data-gt` 표식으로 가리킨다.
   * iframe 경로는 정답표 location의 `iframe[src="…"]`에서 읽는다.
   */
  function indexKey(key) {
    const answers = new Map(); // ident|code -> answer
    const gts = new Map(); // gt|code -> { gt, code, bucket, scope, domain, where, note, evidence, idents:Set }
    for (const f of key.expected_findings) {
      const frames = [];
      const re = /iframe\[src="([^"]+)"\]\s*>>>/g;
      let m;
      while ((m = re.exec(f.location))) frames.push(urlKey(m[1]));
      const ident = `${urlKey(f.url)}|${frames.join('>')}|${f.gt}`;
      answers.set(`${ident}|${f.code}`, f);
      const gk = `${f.gt}|${f.code}`;
      const g = gts.get(gk) || {
        gt: f.gt, code: f.code, bucket: f.bucket, scope: f.scope || 'spec', domain: f.domain,
        where: f.where, note: f.note, evidence: f.evidence_text, url: f.url, idents: new Set(),
      };
      g.idents.add(ident);
      gts.set(gk, g);
    }
    const trapGts = new Set(key.expected_absent.map((a) => a.gt));
    const answerGts = new Set(key.expected_findings.map((f) => f.gt));
    return { answers, gts, trapGts, answerGts };
  }

  /**
   * 채점.
   *
   * @param {object} p
   * @param {object} p.key    `/api/answer-key` 응답 (검사한 사이트 주소로 만든 것)
   * @param {object} p.main   validateFile(..., 'main') 결과 (없으면 null)
   * @param {object} p.extra  validateFile(..., 'extra') 결과 (없으면 null)
   * @param {(url: string, location: string) => Promise<object>} p.resolve
   *        `{ ok, error?, frames: string[], gt, ancestorGt, descendantGt }` 를 돌려준다.
   *        frames는 거쳐 간 iframe 문서 주소들이다.
   * @param {(done: number, total: number) => void} [p.onProgress]
   */
  async function score({ key, main, extra, resolve, onProgress }) {
    const idx = indexKey(key);
    const jobs = [];
    for (const [kind, file] of [['main', main], ['extra', extra]]) {
      if (!file || file.fatal) continue;
      for (const item of file.items) jobs.push({ kind, item });
    }

    let done = 0;
    const queue = [...jobs];
    async function worker() {
      while (queue.length) {
        const job = queue.shift();
        await judge(job);
        done++;
        if (onProgress) onProgress(done, jobs.length);
      }
    }

    async function judge(job) {
      const { item, kind } = job;
      const r = item.raw;
      job.verdict = 'wrong';
      if (item.errors.length) {
        job.verdict = 'invalid';
        job.reason = '스키마 위반: ' + item.errors.join(' / ');
        return;
      }
      const uk = urlKey(r.url);
      let res;
      try {
        res = await resolve(r.url, r.location);
      } catch (e) {
        res = { ok: false, error: String(e && e.message ? e.message : e) };
      }
      job.resolved = res;
      if (!res.ok) {
        job.reason = res.error;
        return;
      }
      // 표식(gt)이 없는 요소는 경로로 구분한다. 서로 다른 오답 요소가 한 건으로 합쳐지면 안 된다.
      const ident = `${uk}|${res.frames.map(urlKey).join('>')}|${res.gt || '@' + (res.path || r.location)}`;
      job.ident = ident;
      const code = kind === 'main' ? r.technique : null;

      if (res.gt && idx.trapGts.has(res.gt)) {
        job.trap = true;
        job.reason = `함정 요소(${res.gt})를 가리킴 — 정상 콘텐츠`;
        return;
      }
      if (kind === 'main') {
        const hit = idx.answers.get(`${ident}|${code}`);
        if (hit && hit.bucket === 'main') {
          job.verdict = 'correct';
          job.answer = hit;
          job.triple = `${ident}|${code}`;
          return;
        }
      } else {
        // 추가 탐지는 technique이 "ETC" 고정이라 요소가 같으면 맞힌 것으로 본다. 이름은 참고로 맞춰 본다.
        const hits = [...idx.answers.entries()].filter(([k, f]) => k.startsWith(ident + '|') && f.bucket === 'extra');
        if (hits.length) {
          job.verdict = 'correct';
          job.answer = hits[0][1];
          job.triple = `${ident}|ETC`;
          const name = String(r.extra_finding || '').toUpperCase();
          if (!hits.some(([, f]) => name.includes(f.code))) job.nameNote = `정답표 유형 이름: ${hits.map(([, f]) => f.code).join(', ')}`;
          return;
        }
      }
      job.reason = diagnose(job, res, ident, code, kind);
    }

    /** 오답이 된 까닭을 사람이 읽을 말로 적는다. */
    function diagnose(job, res, ident, code, kind) {
      if (!res.gt) {
        if (res.ancestorGt && idx.answerGts.has(res.ancestorGt)) return `정답 요소(${res.ancestorGt})의 안쪽 요소를 가리킴 — 같은 요소가 아님`;
        if (res.descendantGt && idx.answerGts.has(res.descendantGt)) return `정답 요소(${res.descendantGt})를 감싼 바깥 요소를 가리킴 — 같은 요소가 아님`;
        return '정답셋에 없는 요소';
      }
      const sameEl = [...idx.answers.entries()].filter(([k]) => k.startsWith(ident + '|'));
      if (sameEl.length) {
        const codes = sameEl.map(([, f]) => (f.bucket === 'main' ? f.code : `${f.code}(result_extra.json)`));
        return kind === 'main'
          ? `요소는 맞지만 technique이 다름: 보고 ${code}, 정답 ${codes.join(', ')}`
          : `요소는 맞지만 추가 유형이 아님: 정답 ${codes.join(', ')}`;
      }
      if (idx.answerGts.has(res.gt)) return `정답 요소(${res.gt})이지만 이 url은 정답셋에 없는 주소 — 쿼리 값까지 같아야 함`;
      return '정답셋에 없는 요소';
    }

    await Promise.all(Array.from({ length: 6 }, worker));

    /** 파일 하나의 집계. 세 필드가 같은 항목은 1건으로 합친다. */
    function summarize(kind, file) {
      if (!file) return null;
      const mine = jobs.filter((j) => j.kind === kind);
      const seen = new Set();
      const dup = [];
      const merged = [];
      for (const j of mine) {
        const k = j.triple || (j.ident ? `${j.ident}|${j.item.raw.technique}` : null);
        if (k && seen.has(k)) {
          dup.push(j);
          continue;
        }
        if (k) seen.add(k);
        merged.push(j);
      }
      const correct = merged.filter((j) => j.verdict === 'correct');
      const invalid = merged.filter((j) => j.verdict === 'invalid');
      const wrong = merged.filter((j) => j.verdict === 'wrong');
      const foundGt = new Set(correct.map((j) => `${j.answer.gt}|${j.answer.code}`));
      const bucketGts = [...idx.gts.values()].filter((g) => g.bucket === kind);
      const tally = (pick, list) => {
        const m = new Map();
        for (const g of list) {
          const name = pick(g);
          if (!name) continue;
          const s = m.get(name) || { name, found: 0, total: 0 };
          s.total++;
          if (foundGt.has(`${g.gt}|${g.code}`)) s.found++;
          m.set(name, s);
        }
        return [...m.values()];
      };
      return {
        fatal: file.fatal,
        reported: file.items.length,
        merged: merged.length,
        dup,
        correct,
        invalid,
        wrong,
        traps: wrong.filter((j) => j.trap),
        // 정확도: 전체 탐지 건수 대비 정탐 비율. 스키마 미준수 항목은 오답으로 센다(붙임2 p.6).
        accuracy: merged.length ? correct.length / merged.length : 0,
        answerTriples: [...idx.answers.values()].filter((f) => f.bucket === kind).length,
        planted: bucketGts.length,
        foundPlanted: bucketGts.filter((g) => foundGt.has(`${g.gt}|${g.code}`)).length,
        perCode: tally((g) => g.code, bucketGts).sort((a, b) => a.name.localeCompare(b.name)),
        perScope: tally((g) => g.scope, bucketGts),
        perDomain: tally((g) => g.domain, bucketGts).sort((a, b) => b.total - a.total),
        missed: bucketGts.filter((g) => !foundGt.has(`${g.gt}|${g.code}`)).sort((a, b) => a.gt.localeCompare(b.gt)),
      };
    }

    return {
      main: summarize('main', main),
      extra: summarize('extra', extra),
      timeLimit: TIME_LIMIT_SEC,
    };
  }

  /**
   * 적격평가 100점 환산 (붙임2 p.6 배점).
   *
   * - 정답 검출 개수 45점: 정답셋 항목 가운데 찾은 비율. 찾지 못한 항목만큼 깎인다.
   *   같은 항목이 여러 주소에 걸쳐 있어도 한 주소에서 찾으면 찾은 것으로 본다(심은 항목 기준).
   * - 정답 추출 정확도 35점: 전체 탐지 건수 대비 정탐 비율(스키마 위반은 오답).
   * - 검출 시간 20점: 30분 초과면 0점. 요강은 산식을 밝히지 않아 0초 20점 → 30분 0점 직선으로 가정한다.
   * - 파일 전체를 파싱할 수 없으면 0점.
   *
   * @param {object|null} s  score()가 돌려준 main 집계
   * @param {object|null} file validateFile(..., 'main') 결과
   */
  function points(s, file) {
    const zero = { detect: 0, accuracy: 0, time: 0, total: 0, final50: 0 };
    if (!file || file.fatal || !s) return { ...zero, fatal: file ? file.fatal : 'result.json이 없음' };
    const detect = s.planted ? (45 * s.foundPlanted) / s.planted : 0;
    const accuracy = s.merged ? (35 * s.correct.length) / s.merged : 0;
    const e = file.elapsed;
    const time = e == null || e > TIME_LIMIT_SEC ? 0 : 20 * (1 - e / TIME_LIMIT_SEC);
    const total = detect + accuracy + time;
    return { detect, accuracy, time, total, final50: total / 2, fatal: null };
  }

  return { MAIN_CODES, TIME_LIMIT_SEC, urlKey, validateFile, score, points };
}

module.exports = { createScorer };
