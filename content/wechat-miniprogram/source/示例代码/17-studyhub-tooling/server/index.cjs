const http = require('node:http');
const { DomainError, failure } = require('../dist/contracts.js');
const { createStore } = require('./store.cjs');
const STATUS = { INVALID_INPUT:400,UNAUTHORIZED:401,NOT_FOUND:404,CONFLICT:409,OP_REUSED:409,CAPACITY:429,TOO_LARGE:413,MEDIA_TYPE:415,METHOD:405,PROTOCOL:502,INTERNAL:500 };
function readJson(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) return Promise.reject(new DomainError('MEDIA_TYPE'));
  return new Promise((resolve,reject) => {
    let bytes = 0, ended = false; const chunks = [];
    const stop = error => { if (!ended) { ended = true; chunks.length = 0; reject(error); } };
    request.on('data',chunk => {
      if (ended) return;
      bytes += chunk.length;
      if (bytes > 4096) stop(new DomainError('TOO_LARGE')); else chunks.push(chunk);
    });
    request.on('aborted',() => stop(new DomainError('INVALID_INPUT')));
    request.on('error',() => stop(new DomainError('INVALID_INPUT')));
    request.on('end',() => {
      if (ended) return; ended = true;
      try { resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))); } catch (_) { reject(new DomainError('INVALID_INPUT')); }
    });
  });
}
function createServer({ store = createStore() } = {}) {
  const server = http.createServer(async (request,response) => {
    function send(status,body) {
      if (response.destroyed || response.headersSent) return;
      response.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Course-Mode':'fixture-only' });
      response.end(JSON.stringify(body));
    }
    try {
      const url = new URL(request.url,'http://127.0.0.1');
      if (url.pathname === '/healthz' && request.method === 'GET') {
        send(200,{ ok:true,data:{ mode:'fixture-only',persistent:false,wechatIdentity:false } }); return;
      }
      // 公开可伪造的课堂夹具，绝不是微信登录或可信身份认证。
      const actor = request.headers['x-course-actor'];
      if (!['A','B'].includes(actor)) throw new DomainError('UNAUTHORIZED');
      const item = /^\/v1\/tasks\/(t\d{4})$/.exec(url.pathname);
      if (url.pathname === '/v1/tasks') {
        if (request.method === 'GET') {
          const pairs = [...url.searchParams.entries()];
          if (new Set(pairs.map(([key]) => key)).size !== pairs.length) throw new DomainError('INVALID_INPUT');
          send(200,{ ok:true,data:store.list(actor,Object.fromEntries(pairs)) }); return;
        }
        if (request.method === 'POST') {
          if (url.search) throw new DomainError('INVALID_INPUT');
          send(201,{ ok:true,data:store.create(actor,await readJson(request)) }); return;
        }
        throw new DomainError('METHOD');
      }
      if (item) {
        if (request.method !== 'PATCH') throw new DomainError('METHOD');
        if (url.search) throw new DomainError('INVALID_INPUT');
        send(200,{ ok:true,data:store.update(actor,item[1],await readJson(request)) }); return;
      }
      throw new DomainError('NOT_FOUND');
    } catch (error) {
      request.resume(); const code = error instanceof DomainError ? error.code : 'INTERNAL';
      send(STATUS[code],failure(code));
    }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
  return server;
}
if (require.main === module) {
  const server = createServer();
  server.listen(0,'127.0.0.1',() => console.log(JSON.stringify({ url:'http://127.0.0.1:' + server.address().port,mode:'fixture-only',persistent:false,wechatIdentity:false })));
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => server.close());
}
module.exports = { createServer };
