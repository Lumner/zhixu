const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname,'..'), { compile } = require('./compile.cjs'), { digest } = require('./digest.cjs');
const cases = []; async function test(name,fn) { await fn(); cases.push(name); }
const fields = (title='固定任务') => ({ title,done:false,priority:'normal' });
const op = n => 'operation_'+String(n).padStart(8,'0');
const input = (n=1,title) => ({ opId:op(n),fields:fields(title) });
const dto = (id='t0001') => ({ id,version:1,...fields() });
async function main() {
  compile(true); compile(false);
  const before = digest(), ts = require('typescript'), api = require('../dist/contracts.js');
  const { createStore } = require('../server/store.cjs'), { createServer } = require('../server/index.cjs'), { createTasksClient } = require('../client/tasks-client.cjs');
  const rejects = (fn,code='INVALID_INPUT') => assert.throws(fn,error=>error.code===code);
  const pageBody = items => ({ok:true,data:{items,nextCursor:null}});
  async function withServer(fn,store=createStore()) {
    const server = createServer({store});
    await new Promise((resolve,reject)=>{ server.once('error',reject);server.listen(0,'127.0.0.1',resolve); });
    const base='http://127.0.0.1:'+server.address().port;
    async function request(route='/v1/tasks',options={}) {
      const headers={}; if(options.actor!==null)headers['X-Course-Actor']=options.actor||'A';
      if(options.body!==undefined)headers['Content-Type']=options.contentType||'application/json; charset=utf-8';
      const response=await fetch(base+route,{method:options.method||'GET',headers,body:options.body===undefined?undefined:typeof options.body==='string'||Buffer.isBuffer(options.body)?options.body:JSON.stringify(options.body),signal:AbortSignal.timeout(5000)});
      return { statusCode:response.status,data:await response.json() };
    }
    try { return await fn(request,store); } finally { await new Promise(resolve=>server.close(resolve)); }
  }
  await test('实际安装编译器5.9.3且锁文件含公开来源与完整性字段',()=> {
    const lock=JSON.parse(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8'));
    assert.equal(ts.version,'5.9.3');assert.equal(lock.packages['node_modules/typescript'].version,'5.9.3');
    assert.ok(lock.packages['node_modules/typescript'].resolved.startsWith('https://registry.npmjs.org/'));assert.ok(lock.packages['node_modules/typescript'].integrity.startsWith('sha512-'));
  });
  await test('严格类型正例与四个预期错误注释已由真实编译器检查',()=> {
    const text=fs.readFileSync(path.join(ROOT,'type-tests/positive.ts'),'utf8');assert.equal((text.match(/@ts-expect-error/g)||[]).length,4);
    const config=JSON.parse(fs.readFileSync(path.join(ROOT,'tsconfig.json'),'utf8'));assert.equal(config.compilerOptions.strict,true);assert.equal(config.compilerOptions.noEmitOnError,true);
  });
  await test('交付dist与当前TypeScript真实编译输出逐字节一致',()=> {
    const config=ts.readConfigFile(path.join(ROOT,'tsconfig.json'),ts.sys.readFile);
    const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,ROOT);
    const program=ts.createProgram(parsed.fileNames,parsed.options);assert.equal(ts.getPreEmitDiagnostics(program).length,0);
    let count=0;const result=program.emit(undefined,(file,text)=>{assert.equal(fs.readFileSync(file,'utf8'),text);count++;});
    assert.equal(result.emitSkipped,false);assert.equal(count,2);
  });
  await test('运行时校验会规范化标题且保留固定字段',()=>assert.deepEqual(api.parseFields(fields('  学习  ')),fields('学习')));
  await test('空标题与超过40代码单元标题被拒绝',()=>{rejects(()=>api.parseFields(fields(' ')));rejects(()=>api.parseFields(fields('a'.repeat(41))));});
  await test('布尔字段不接受字符串false',()=>rejects(()=>api.parseFields({...fields(),done:'false'})));
  await test('优先级联合在运行时同样校验',()=>{for(const value of ['urgent',{},null])rejects(()=>api.parseFields({...fields(),priority:value}));});
  await test('未知字段和非对象输入不进入业务模型',()=>{rejects(()=>api.parseFields({...fields(),owner:'B'}));for(const value of [null,[],1])rejects(()=>api.parseFields(value));});
  await test('缺失或不合法原编号被拒绝',()=>{for(const value of ['',null,'new-id'])rejects(()=>api.parseCreate({opId:value,fields:fields()}));});
  await test('版本必须是正安全整数',()=>{for(const version of [0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1])rejects(()=>api.parseUpdate({opId:op(1),version,fields:fields()}));});
  await test('DTO额外身份字段与非规范标题不能通过响应校验',()=>{assert.equal(api.isTask(dto()),true);assert.equal(api.isTask({...dto(),owner:'PRIVATE'}),false);assert.equal(api.isTask({...dto(),title:' x '}),false);});
  await test('列表响应拒绝重复ID、乱序和不匹配游标',()=> {
    rejects(()=>api.parsePageReply(pageBody([dto(),dto()])),'PROTOCOL');
    rejects(()=>api.parsePageReply(pageBody([dto('t0002'),dto('t0001')])),'PROTOCOL');
    rejects(()=>api.parsePageReply({ok:true,data:{items:[dto()],nextCursor:'t0009'}}),'PROTOCOL');
  });
  await test('错误响应只使用已知码的公开文字而不回显任意message',()=>assert.throws(()=>api.parsePageReply({ok:false,error:{code:'CONFLICT',message:'PRIVATE'}}),e=>e.code==='CONFLICT'&&!e.message.includes('PRIVATE')));
  await test('外部JSON即使被写成类型也仍需真实运行时校验',()=>{const value=JSON.parse('{"title":4,"done":false,"priority":"normal"}');rejects(()=>api.parseFields(value));});
  await test('内存创建返回版本1及不含owner的DTO',()=>{const s=createStore(),r=s.create('A',input());assert.equal(r.version,1);assert.equal(r.id,'t0001');assert.equal(Object.hasOwn(r,'owner'),false);});
  await test('A与B列表按课堂固定身份隔离',()=>{const s=createStore();s.create('A',input());assert.equal(s.list('A').items.length,1);assert.equal(s.list('B').items.length,0);});
  await test('B不能更新A的记录，对外表现为不存在',()=>{const s=createStore(),r=s.create('A',input());rejects(()=>s.update('B',r.id,{...input(2),version:1}),'NOT_FOUND');});
  await test('相同原编号与内容重放不重复创建',()=>{const s=createStore(),a=s.create('A',input());assert.deepEqual(s.create('A',input()),a);assert.equal(s.counts().records,1);});
  await test('原编号改内容会冲突，不静默覆盖回执',()=>{const s=createStore();s.create('A',input());rejects(()=>s.create('A',input(1,'changed')),'OP_REUSED');});
  await test('正确版本更新只增加一次版本',()=>{const s=createStore(),r=s.create('A',input());assert.equal(s.update('A',r.id,{...input(2,'new'),version:1}).version,2);});
  await test('旧版本冲突不修改当前内容',()=>{const s=createStore(),r=s.create('A',input());s.update('A',r.id,{...input(2,'new'),version:1});rejects(()=>s.update('A',r.id,{...input(3,'old'),version:1}),'CONFLICT');assert.equal(s.list('A').items[0].title,'new');});
  await test('更新原编号重放返回旧回执，不再次加版本',()=>{const s=createStore(),r=s.create('A',input()),body={...input(2,'new'),version:1};const a=s.update('A',r.id,body);assert.deepEqual(s.update('A',r.id,body),a);assert.equal(s.list('A').items[0].version,2);});
  await test('有界列表按游标继续，无重复也不把截断当完整',()=>{const s=createStore();for(let i=1;i<=3;i++)s.create('A',input(i));const a=s.list('A',{limit:'2'}),b=s.list('A',{limit:'2',cursor:a.nextCursor});assert.equal(a.items.length,2);assert.equal(b.items.length,1);assert.equal(b.nextCursor,null);assert.notEqual(a.items[1].id,b.items[0].id);});
  await test('容量满后停止新写入但保留旧回执可重放',()=>{const s=createStore({capacity:1}),a=s.create('A',input());rejects(()=>s.create('A',input(2)),'CAPACITY');assert.deepEqual(s.create('A',input()),a);});
  await test('返回对象不是内部记录或回执的可变引用',()=>{const s=createStore(),a=s.create('A',input());a.title='tamper';const b=s.list('A');b.items[0].title='tamper';assert.equal(s.create('A',input()).title,'固定任务');});
  await test('客户端适配层解析合法列表',async()=>{const c=createTasksClient({request:async()=>({statusCode:200,data:pageBody([dto()])})});assert.equal((await c.list()).items[0].id,'t0001');});
  await test('客户端写入保留原编号与字段，不额外重试',async()=>{let n=0;const f=fields(),c=createTasksClient({request:async o=>{n++;assert.equal(o.data.opId,op(1));assert.equal(o.data.fields,f);return{statusCode:201,data:{ok:true,data:dto()}};}});await c.create(op(1),f);assert.equal(n,1);});
  await test('客户端传输异常保留原对象不伪造业务确认',async()=>{const e=Error('network'),c=createTasksClient({request:async()=>{throw e;}});await assert.rejects(c.list(),x=>x===e);});
  await test('HTTP成功但DTO非法仍抛协议错误',async()=>{const c=createTasksClient({request:async()=>({statusCode:200,data:pageBody([{...dto(),version:'1'}])})});await assert.rejects(c.list(),{code:'PROTOCOL'});});
  await test('业务错误码经适配层返回且不回显服务端私密文案',async()=>{const c=createTasksClient({request:async()=>({statusCode:409,data:{ok:false,error:{code:'CONFLICT',message:'PRIVATE'}}})});await assert.rejects(c.list(),e=>e.code==='CONFLICT'&&!e.message.includes('PRIVATE'));});
  await test('状态码错误不能被合法形状的成功正文掩盖',async()=>{const c=createTasksClient({request:async()=>({statusCode:500,data:pageBody([])})});await assert.rejects(c.list(),{code:'PROTOCOL'});});
  await test('真实回环健康检查明确标注夹具且无微信身份',()=>withServer(async req=>{const r=await req('/healthz',{actor:null});assert.equal(r.statusCode,200);assert.equal(r.data.data.wechatIdentity,false);assert.equal(r.data.data.persistent,false);}));
  await test('真实HTTP缺少固定身份返回401',()=>withServer(async req=>assert.equal((await req('/v1/tasks',{actor:null})).statusCode,401)));
  await test('真实HTTP未知固定身份返回401',()=>withServer(async req=>assert.equal((await req('/v1/tasks',{actor:'C'})).statusCode,401)));
  await test('真实HTTP错误媒体类型返回415',()=>withServer(async req=>assert.equal((await req('/v1/tasks',{method:'POST',body:input(),contentType:'text/plain'})).statusCode,415)));
  await test('真实HTTP非法JSON与非法UTF8都返回400',()=>withServer(async req=>{assert.equal((await req('/v1/tasks',{method:'POST',body:'{'})).statusCode,400);assert.equal((await req('/v1/tasks',{method:'POST',body:Buffer.from([0xff])})).statusCode,400);}));
  await test('4096字节上限按实际UTF8字节拒绝而不按字符估算',()=>withServer(async req=>{const body=JSON.stringify(input(1,'中'.repeat(1500)));assert.ok(body.length<4096);assert.ok(Buffer.byteLength(body)>4096);assert.equal((await req('/v1/tasks',{method:'POST',body})).statusCode,413);}));
  await test('真实HTTP创建201且DTO没有归属或凭据字段',()=>withServer(async req=>{const r=await req('/v1/tasks',{method:'POST',body:input()});assert.equal(r.statusCode,201);assert.equal(api.isTask(r.data.data),true);assert.equal(Object.hasOwn(r.data.data,'owner'),false);}));
  await test('真实HTTP原编号重复提交仍只有一条记录',()=>withServer(async(req,s)=>{const a=await req('/v1/tasks',{method:'POST',body:input()}),b=await req('/v1/tasks',{method:'POST',body:input()});assert.deepEqual(a.data,b.data);assert.equal(s.counts().records,1);}));
  await test('真实HTTP不同固定身份看不到彼此任务',()=>withServer(async req=>{await req('/v1/tasks',{method:'POST',body:input()});assert.equal((await req('/v1/tasks',{actor:'B'})).data.data.items.length,0);}));
  await test('真实HTTP多余输入字段与写入query均被拒绝',()=>withServer(async req=>{assert.equal((await req('/v1/tasks',{method:'POST',body:{...input(),owner:'B'}})).statusCode,400);assert.equal((await req('/v1/tasks?unexpected=1',{method:'POST',body:input()})).statusCode,400);}));
  await test('真实HTTP越权更新返回404',()=>withServer(async req=>{await req('/v1/tasks',{method:'POST',body:input()});assert.equal((await req('/v1/tasks/t0001',{actor:'B',method:'PATCH',body:{...input(2),version:1}})).statusCode,404);}));
  await test('真实HTTP旧版本更新返回409',()=>withServer(async req=>{await req('/v1/tasks',{method:'POST',body:input()});await req('/v1/tasks/t0001',{method:'PATCH',body:{...input(2),version:1}});assert.equal((await req('/v1/tasks/t0001',{method:'PATCH',body:{...input(3),version:1}})).statusCode,409);}));
  await test('真实HTTP重复query、非法上限与未知字段都拒绝',()=>withServer(async req=>{for(const query of ['limit=1&limit=2','limit=21','limit=1x','owner=B'])assert.equal((await req('/v1/tasks?'+query)).statusCode,400);}));
  await test('真实HTTP区分方法/路由/内部异常且不暴露堆栈',async()=> {
    await withServer(async req=>{assert.equal((await req('/v1/tasks',{method:'DELETE'})).statusCode,405);assert.equal((await req('/missing')).statusCode,404);});
    await withServer(async req=>{const r=await req();assert.equal(r.statusCode,500);assert.ok(!JSON.stringify(r).includes('PRIVATE'));},{list(){throw Error('PRIVATE_STACK');}});
  });
  const negatives=[['wrong-done.ts',2322],['unknown-access.ts',18046],['wrong-branch.ts',2339],['wrong-generic.ts',2322]];
  for(const [name,code] of negatives)await test('真实类型编译拒绝负例：'+name,()=> {
    const program=ts.createProgram([path.join(ROOT,'negative-cases',name)],{strict:true,noEmit:true,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,types:[]});
    const diagnostics=ts.getPreEmitDiagnostics(program);assert.ok(diagnostics.some(x=>x.code===code));assert.ok(diagnostics.every(x=>[2322,18046,2339].includes(x.code)));
  });
  await test('实际适配层通过回环HTTP完成创建读取更新闭环',()=>withServer(async req=> {
    const client=createTasksClient({request:o=>req(o.url,{method:o.method,body:o.data})});
    const created=await client.create(op(1),fields()),page=await client.list();assert.equal(page.items[0].id,created.id);
    const updated=await client.update(created.id,op(2),created.version,fields('已修改'));assert.equal(updated.version,2);assert.equal((await client.list()).items[0].title,'已修改');
  }));
  assert.equal(cases.length,50);assert.equal(digest(),before);
  const report={date:'2026-11-03',executedAt:new Date().toISOString(),project:'17-studyhub-tooling',passed:50,sourceDigest:before,compiler:'5.9.3',compilerExecuted:true,typeNegativeCasesRejected:4,loopbackHttp:true,realWechat:false,realWechatIdentity:false,persistentBackend:false,productionReady:false,weuiExecuted:false,taroExecuted:false,uniAppExecuted:false,scenarios:cases};
  fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});fs.writeFileSync(path.join(ROOT,'reports/latest.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:50,compiler:'5.9.3',typeNegativeCasesRejected:4,loopbackHttp:true,productionReady:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
