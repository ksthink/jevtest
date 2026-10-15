#!/usr/bin/env node
/**
 * 로컬 실행용 서버. 버셀에 올린 것과 같은 핸들러를 쓴다.
 *
 *   node server.js            # http://localhost:3000
 *   PORT=8080 node server.js
 */
const http = require('node:http');
const { handle } = require('./lib/handler');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

http
  .createServer((req, res) => {
    const h = req.headers.host || `localhost:${port}`;
    const out = handle(req.url || '/', `http://${h}`);
    for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
    res.statusCode = out.status;
    res.end(out.body);
  })
  .listen(port, host, () => {
    console.log(`가상시청 모사 게시판: http://localhost:${port}`);
    console.log(`정답표: http://localhost:${port}/answer-key  (JSON: /api/answer-key)`);
  });
