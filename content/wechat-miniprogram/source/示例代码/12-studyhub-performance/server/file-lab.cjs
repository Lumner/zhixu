// 匿名本地教学服务，只接收与固定练习完全相同的报告。不接收私人报告。
const http = require('node:http');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const { pack } = require('../miniprogram/utils/report-file');
const lab = require('../miniprogram/utils/stats-lab-data');
const FIXED_TEXT = pack(lab.report(), 'demo');
const BODY_LIMIT = 65536, TTL = 600000, MAX_FILES = 20;
function filePart(body, contentType) {
  const match = /^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9_-]{1,70})"|([A-Za-z0-9_-]{1,70}))$/i.exec(contentType || '');
  if (!match) throw new Error('MULTIPART');
  const boundary = match[1] || match[2], start = Buffer.from('--' + boundary + '\r\n');
  const end = Buffer.from('\r\n--' + boundary + '--\r\n');
  if (!body.subarray(0, start.length).equals(start) || !body.subarray(-end.length).equals(end)) throw new Error('MULTIPART');
  const split = body.indexOf('\r\n\r\n', start.length);
  if (split < 0 || split - start.length > 2048) throw new Error('HEADERS');
  const headers = body.subarray(start.length, split).toString('ascii');
  if (!/^Content-Disposition: form-data; name="file"; filename="[^"\r\n]{1,200}"(?:\r\nContent-Type: [^\r\n]+)?$/i.test(headers)) throw new Error('PART');
  const file = body.subarray(split + 4, body.length - end.length);
  if (file.length > 32768) throw new Error('SIZE');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(file);
  if (text !== FIXED_TEXT) throw new Error('FIXED_DEMO_ONLY');
  return Buffer.from(text, 'utf8');
}
function createServer({ now = Date.now } = {}) {
  const files = new Map();
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const server = http.createServer((req, res) => {
    for (const [id, item] of files) if (now() >= item.expiresAt) files.delete(id);
    const match = /^\/files\/([a-f0-9]{32})$/.exec(req.url);
    if (req.method === 'GET' && req.url === '/health') { json(res, 200, { ok: true, mode: 'fixed-demo-only' }); return; }
    if (req.method === 'GET' && match) {
      const item = files.get(match[1]);
      if (!item) { json(res, 404, { ok: false }); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': item.buffer.length, 'Cache-Control': 'no-store' }); res.end(item.buffer); return;
    }
    if (req.method !== 'POST' || req.url !== '/upload') { json(res, 404, { ok: false }); req.resume(); return; }
    let size = 0, tooLarge = false; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > BODY_LIMIT) { tooLarge = true; chunks.length = 0; } else if (!tooLarge) chunks.push(chunk); });
    req.on('end', () => {
      if (tooLarge) { json(res, 413, { ok: false, code: 'BODY_LIMIT' }); return; }
      try {
        const buffer = filePart(Buffer.concat(chunks), req.headers['content-type']);
        if (files.size >= MAX_FILES) { json(res, 429, { ok: false, code: 'LAB_FULL' }); return; }
        const id = crypto.randomBytes(16).toString('hex'); files.set(id, { buffer, expiresAt: now() + TTL });
        json(res, 200, { ok: true, id });
      } catch (_) { json(res, 400, { ok: false, code: 'FIXED_DEMO_OR_MULTIPART_INVALID' }); }
    });
    req.on('error', () => { if (!res.writableEnded) res.destroy(); });
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return server;
}
if (require.main === module) {
  const server = createServer();
  server.listen(8877, process.env.FILE_LAB_HOST || '127.0.0.1', () => console.log('Fixed demo file lab listening on port 8877; no private uploads.'));
}
module.exports = { createServer, filePart, FIXED_TEXT, BODY_LIMIT, TTL, MAX_FILES };
