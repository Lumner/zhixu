const http = require('node:http');
const { resources } = require('./fixtures.cjs');

function send(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
const failure = (code, message) => ({ ok: false, error: { code, message } });
function integer(value, fallback, min, max) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error('分页或延迟参数必须是整数');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error('分页或延迟参数超出范围');
  return result;
}

function createServer() {
  const seen = new Set();
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        send(res, 200, { ok: true, data: { service: 'studyhub-network-lab', resourceCount: resources.length } });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/echo') {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8192) {
            send(res, 413, failure('TOO_LARGE', '教学 echo 请求最多 8KB'));
            return;
          }
          chunks.push(chunk);
        }
        const text = Buffer.concat(chunks).toString('utf8');
        let input;
        try { input = JSON.parse(text); } catch { send(res, 400, failure('BAD_JSON', '请求体不是合法 JSON')); return; }
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          send(res, 400, failure('BAD_INPUT', '请求体必须是 JSON 对象')); return;
        }
        send(res, 200, { ok: true, data: { received: input } });
        return;
      }
      if (url.pathname !== '/api/resources') { send(res, 404, failure('NOT_FOUND', '接口不存在')); return; }
      if (req.method !== 'GET') {
        res.setHeader('allow', 'GET'); send(res, 405, failure('METHOD_NOT_ALLOWED', '资源接口仅用于读取')); return;
      }
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const category = url.searchParams.get('category') || 'all';
      const mode = url.searchParams.get('mode') || 'normal';
      const limit = integer(url.searchParams.get('limit'), 10, 1, 20);
      const offset = integer(url.searchParams.get('cursor'), 0, 0, resources.length);
      const delayMs = integer(url.searchParams.get('delayMs'), 0, 0, 5000);
      if (q.length > 80 || !['all', 'syntax', 'layout', 'network'].includes(category)
        || !['normal', 'http503', 'business', 'malformed', 'flaky'].includes(mode)) {
        send(res, 400, failure('BAD_QUERY', '搜索或实验模式参数不合法')); return;
      }
      const respond = () => {
        if (mode === 'http503') { send(res, 503, failure('TEMPORARY', '模拟服务暂时不可用')); return; }
        if (mode === 'business') { send(res, 200, failure('DEMO_REJECTED', '模拟业务拒绝，请切回正常模式')); return; }
        if (mode === 'malformed') { send(res, 200, { ok: true, data: { items: '这不是数组' } }); return; }
        const flakyKey = JSON.stringify([q, category, offset, limit]);
        if (mode === 'flaky' && !seen.has(flakyKey)) {
          seen.add(flakyKey); send(res, 503, failure('TRY_AGAIN', '第一次模拟失败，下一次可成功')); return;
        }
        const filtered = resources.filter(item => item.title.toLowerCase().includes(q)
          && (category === 'all' || item.category === category));
        const items = filtered.slice(offset, offset + limit);
        const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null;
        send(res, 200, { ok: true, data: { items, nextCursor, total: filtered.length } });
      };
      if (delayMs > 0) {
        const timer = setTimeout(respond, delayMs);
        res.once('close', () => clearTimeout(timer));
      } else {
        respond();
      }
    } catch (error) {
      send(res, 400, failure('BAD_REQUEST', error.message || '请求不合法'));
    }
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const readArg = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
  const host = readArg('--host', '127.0.0.1');
  const port = Number(readArg('--port', '3210'));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('请提供有效 host/port');
  const server = createServer();
  server.on('error', error => { console.error('教学服务启动失败：', error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log('StudyHub teaching server: http://' + host + ':' + port + '/health'));
}
module.exports = { createServer };
