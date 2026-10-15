/**
 * 버셀 서버리스 함수. `vercel.json`의 rewrite로 모든 주소가 여기로 온다.
 * 외부 라이브러리를 쓰지 않으므로 설치·빌드 단계가 없다.
 */
const { handle } = require('../lib/handler');

module.exports = (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const out = handle(req.url || '/', `${proto}://${host}`);
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body);
};
