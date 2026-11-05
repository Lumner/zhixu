const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'dist');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip','.md':'text/markdown; charset=utf-8'};
function createServer(){
  return http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
    let name;
    try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch(_){res.writeHead(400);res.end('Bad request');return;}
    if(name==='/'||name.endsWith('/'))name+='index.html';
    const target=path.resolve(ROOT,'.'+name);
    if(!target.startsWith(ROOT+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    fs.stat(target,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
      const type=TYPES[path.extname(target).toLowerCase()]||'application/octet-stream';
      const headers={'Content-Type':type,'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'};
      if(name.startsWith('/files/')&&!/\.(?:png|jpe?g|gif|svg|webp)$/i.test(target))headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(target));
      res.writeHead(200,headers);if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
    });
  });
}
if(require.main===module){
  let port=Number(process.env.PORT)||4173;
  function listen(){
    const server=createServer();
    server.once('error',error=>{if(error.code==='EADDRINUSE'&&port<4190){port++;listen();}else{console.error(error.message);process.exitCode=1;}});
    server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'\n按 Ctrl+C 停止。也可直接双击网站根目录 index.html 离线阅读。'));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
  }
  listen();
}
module.exports={createServer};
