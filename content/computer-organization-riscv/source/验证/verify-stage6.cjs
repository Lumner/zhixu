'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {Pipeline,decode,KERNELS,simulate,I,R,S,B}=require('../示例代码/06-pipeline/pipeline-lab.cjs');
const {predict}=require('../示例代码/06-pipeline/predictor-lab.cjs');
const {CPU}=require('../示例代码/08-mini-rv32/cpu.cjs');
const examples=path.resolve(__dirname,'../示例代码/06-pipeline'),cache=path.resolve(__dirname,'../../.cache/stage6-run');
const names=[],runs=[];function check(name,fn){fn();names.push(name);}
function reference(words,data={},registers={}){
 const c=new CPU(512);c.loadWords(words);for(const [r,v]of Object.entries(registers))c.r[+r]=v>>>0;c.r[0]=0;
 for(const [a,v]of Object.entries(data))c.memory.setUint32(+a,v>>>0,true);
 const trace=[];while(c.pc<words.length*4){if(trace.length>2000)throw Error('Scalar limit');trace.push(c.step());}return {c,trace};
}
function compare(words,data,forwarding,registers={}){
 const p=new Pipeline(words,{data,forwarding,registers}).run(),{c,trace}=reference(words,data,registers);
 assert.deepEqual([...p.r],[...c.r]);assert.deepEqual([...new Uint8Array(p.memory.buffer)],[...new Uint8Array(c.memory.buffer)]);
 assert.deepEqual(p.commits.map(x=>x.pc),trace.map(x=>x.pc));assert.equal(p.pc,c.pc);return p;
}
for(const [name,k]of Object.entries(KERNELS))for(const forwarding of [true,false])check(name+' matches scalar architecture, forwarding='+forwarding,()=>compare(k.words,k.data,forwarding));
const expected={independent:[7,0,0,3],alu:[7,0,0,3],priority:[7,0,0,3],load:[8,1,0,3],unscheduled:[10,1,0,5],scheduled:[9,0,0,5],store:[9,1,0,4],taken:[10,0,1,4],untaken:[10,0,0,6],loadBranch:[11,1,1,4],loop:[19,0,2,11],zero:[6,0,0,2],falseSource:[7,0,0,3]};
check('All thirteen documented cycle/stall/redirect/retirement tuples',()=>{for(const [n,want]of Object.entries(expected)){const p=simulate(n);assert.deepEqual([p.cycles,p.stalls,p.redirects,p.retired],want,n);}});
check('ALU chain without forwarding waits four cycles and keeps result',()=>{const p=simulate('alu',false);assert.equal(p.cycles,11);assert.equal(p.stalls,4);assert.equal(p.r[10],3);});
check('Load-use freezes ID while load advances and EX receives a bubble',()=>{const p=simulate('load'),a=p.trace[3],b=p.trace[4];assert.equal(a.stall,true);assert.equal(a.ID,b.ID);assert.equal(a.EX,b.MEM);assert.equal(b.EX,null);assert.equal(p.trace[5].operands.a.from,'MEM/WB');});
check('Nearest matching writer wins over an older matching writer',()=>{const p=simulate('priority');assert.equal(p.r[10],2);assert.equal(p.trace[4].operands.a.from,'EX/MEM');});
check('A newer load masks an older same-register ALU value until ready',()=>{const words=[I(99,0,6),I(0,5,6,3),R(6,0,10)],p=compare(words,{256:7},true,{5:256});assert.equal(p.stalls,1);assert.equal(p.r[10],7);});
check('Same-cycle WB then ID read needs no stall without forwarding',()=>{const p=compare([I(7,0,5),I(1,0,6),I(2,0,7),R(5,0,10)],{},false);assert.equal(p.stalls,0);assert.equal(p.cycles,8);assert.equal(p.r[10],7);});
check('Store data is captured in EX and immediate load-store needs one stall',()=>{const p=simulate('store');assert.equal(p.stalls,1);assert.equal(p.memory.getUint32(260,true),7);assert.equal(p.r[10],7);});
check('Taken branch removes both younger instructions and all their effects',()=>{const p=simulate('taken');assert.deepEqual(p.trace.find(r=>r.redirect!==undefined).flush,[12,16]);assert.equal(p.memory.getUint32(256,true),123);assert.equal(p.r[10],123);assert.ok(!p.commits.some(x=>x.pc===12||x.pc===16));});
check('Untaken path executes its store; final load is not the transient 99',()=>{const p=simulate('untaken');assert.equal(p.r[10],0);assert.equal(p.memory.getUint32(256,true),0);assert.equal(p.retired,6);});
check('Load-branch stall followed by flush preserves data and target result',()=>{const p=simulate('loadBranch');assert.equal(p.stalls,1);assert.equal(p.redirects,1);assert.equal(p.r[11],7);assert.equal(p.memory.getUint32(256,true),0);});
check('Reordered independent work preserves registers and data memory',()=>{const a=simulate('unscheduled'),b=simulate('scheduled');assert.deepEqual([...a.r],[...b.r]);assert.deepEqual([...new Uint8Array(a.memory.buffer).slice(256)],[...new Uint8Array(b.memory.buffer).slice(256)]);assert.equal(a.cycles-b.cycles,1);});
check('x0 and I-immediate bit positions do not create false dependencies',()=>{assert.equal(simulate('zero').stalls,0);assert.equal(simulate('zero').r[10],0);assert.equal(simulate('falseSource').stalls,0);assert.deepEqual(decode(I(6,0,10)).uses,[0]);});
check('A flushed unsupported word is never decoded or executed',()=>{const words=[B(12,0,0),S(0,5,0),0xffffffff,I(7,0,10)],p=new Pipeline(words,{registers:{5:256},data:{256:123}}).run();assert.equal(p.r[10],7);assert.equal(p.memory.getUint32(256,true),123);assert.equal(p.retired,2);});
check('Executed unsupported code and misaligned data fail explicitly',()=>{assert.throws(()=>new Pipeline([0xffffffff]).run(),/Unsupported/);const p=new Pipeline([I(1,0,5),I(0,5,6,3)]);assert.throws(()=>p.run(),/aligned data/);assert.equal(p.r[6],0);});
check('Finite empty/single programs and infinite loop bounds',()=>{assert.equal(new Pipeline([]).run().cycles,0);assert.equal(new Pipeline([I(1,0,5)]).run().cycles,5);assert.throws(()=>new Pipeline([B(0,0,0)]).run(30),/Cycle limit/);});
let randomRuns=0,seed=0x1952;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
check('Two hundred generated dependent arithmetic programs, both forwarding modes',()=>{
 for(let c=0;c<200;c++){const words=[];for(let n=0;n<16;n++){const rd=5+random(6),a=5+random(6),b=5+random(6);words.push(random(3)===0?I(random(31)-15,a,rd):R(a,b,rd,random(2)===0));}for(const f of [true,false]){compare(words,{},f,{5:7,6:0xffffffff});randomRuns++;}}
});
check('Two-bit predictor follows all state transitions and saturation',()=>{for(let s=0;s<4;s++)for(const x of ['T','N']){const p=predict([x],s);assert.equal(p.rows[0].guess,s>=2?'T':'N');assert.equal(p.state,x==='T'?Math.min(3,s+1):Math.max(0,s-1));}});
check('Predict before update: T,T,N,T has two errors from weak not-taken',()=>{const p=predict('T,T,N,T');assert.equal(p.wrong,2);assert.deepEqual(p.rows.map(x=>x.before),[1,2,3,2]);assert.deepEqual(p.rows.map(x=>x.guess),['N','T','T','T']);});
check('Two repeated T,T,T,N loops differ for one and two bits',()=>{const x='T,T,T,N,T,T,T,N';assert.equal(predict(x,0,1).wrong,4);assert.equal(predict(x,1,2).wrong,3);});
check('Alternating history and empty input do not promise universal gains',()=>{assert.equal(predict('T,N,T,N',1).wrong,4);assert.equal(predict([],1).rate,null);assert.throws(()=>predict('yes'),/T or N/);assert.throws(()=>predict('T',4),/Invalid counter/);});
check('Time units, weighted CPI and whole-work speedup examples',()=>{assert.equal(1e6*1.5/2e9,0.00075);assert.equal(.6*1+.3*2+.1*4,1.6);assert.equal(.8*2/1.6,1);assert.equal((1e9/2e9)/(.8e9*1.5/3e9),1.25);});
check('Dynamic loop count includes final branch but excludes output region',()=>{for(const n of [0,1,5]){const words=[I(0,0,5),I(n,0,6),I(0,0,10),B(16,5,6),R(10,5,10),I(1,5,5),0xff5ff06f];const {trace,c}=reference(words);assert.equal(trace.length,4*n+4);assert.equal(c.r[10],(n*(n-1)/2)>>>0);}});
check('Amdahl time fractions and finite pipeline overhead',()=>{assert.ok(Math.abs(1/(.6+.4/4)-10/7)<1e-12);assert.equal(104*220,22880);assert.equal(100*700,70000);assert.equal(20+4+2+6,32);assert.ok(Math.abs(.2*.1*2-.04)<1e-12);assert.equal(200+4+5*2,214);});
const javaIndex=process.argv.indexOf('--java'),jarIndex=process.argv.indexOf('--jar');
const official=javaIndex>=0||jarIndex>=0;
if(official){
 assert.ok(javaIndex>=0&&jarIndex>=0,'Provide both --java and --jar');
 const java=path.resolve(process.argv[javaIndex+1]),jar=path.resolve(process.argv[jarIndex+1]);fs.mkdirSync(cache,{recursive:true});
 function rars(name,file,opts=[]){const args=['-Dfile.encoding=UTF-8','-Duser.language=en','-Duser.country=US','-jar',jar,'nc','me','sm','ae2','se3','1000',...opts,file],r=spawnSync(java,args,{cwd:examples,encoding:'utf8',timeout:30000,windowsHide:true});assert.ifError(r.error);runs.push({name,args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0,name+': '+r.stderr);return r;}
 for(const [name,k]of Object.entries(KERNELS))check('Official RARS encoding of '+name,()=>{
  const f=path.join(cache,name+'.s'),dump=path.join(cache,name+'.txt');fs.writeFileSync(f,'.text\n.globl main\nmain:\n'+k.asm.join('\n')+'\n');rars('assemble-'+name,f,['a','dump','.text','SegmentWindow',dump]);
  const actual=[...fs.readFileSync(dump,'utf8').matchAll(/^0x[\da-f]{8}\s+0x([\da-f]{8})/gim)].map(m=>parseInt(m[1],16)>>>0);assert.deepEqual(actual,k.words);
 });
 for(const [file,want,extra]of [['alu-chain.s','3',[]],['load-use.s','7',['t2','t5']],['scheduled.s','7',['t2','t5']],['branch-squash.s','123',['0x10010000-0x10010000']]])check('Official RARS execution '+file,()=>{
  const r=rars('run-'+file,path.join(examples,file),['a0',...extra]);assert.equal(r.stdout.trim(),want);assert.match(r.stderr,new RegExp('a0\\s+0x'+Number(want).toString(16).padStart(8,'0')));
  if(file==='branch-squash.s')assert.match(r.stderr,/Mem\[0x10010000\]\s+0x0000007b/);
  if(extra.includes('t5')){assert.match(r.stderr,/t2\s+0x0000000e/);assert.match(r.stderr,/t5\s+0x00000001/);}
 });
 for(const n of [0,1,5])check('Official RARS counted loop N='+n,()=>{
  const src=fs.readFileSync(path.join(examples,'count-loop.s'),'utf8').replace('addi t1, zero, 5','addi t1, zero, '+n),file=path.join(cache,'count-'+n+'.s');fs.writeFileSync(file,src);
  // v1.6 returns on the exit ecall before updating its reported counter.
  // Counted region is 4*N+4; ic includes the next three completed instructions.
  const r=rars('run-count-'+n,file,['a0','ic']);assert.equal(r.stdout.trim(),String(n*(n-1)/2));assert.match(r.stderr,new RegExp('(?:^|\\n)'+(4*n+7)+'(?:\\r?\\n|$)'));
 });
}
const sourceFiles=fs.readdirSync(examples).filter(n=>/\.(s|cjs)$/.test(n)).sort().map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(examples,name))).digest('hex')}));
const traceNames=['independent','alu','load','unscheduled','scheduled','taken','loadBranch','loop'];
const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),edition:'detailed-stage6',passed:names.length,officialRarsChecked:official,rarsInvocations:runs.length,randomArchitectureRuns:randomRuns,scope:'Discrete-cycle teaching model, scalar differential checks, arithmetic and predictor; optional official RARS encoding/architecture, never real hardware timing or Ripes GUI.',sourceFiles,scenarios:names,expected,traces:Object.fromEntries(traceNames.map(n=>{const p=simulate(n);return [n,{cycles:p.cycles,retired:p.retired,stalls:p.stalls,redirects:p.redirects,trace:p.trace}];})),runs};
const output=path.join(__dirname,official?'stage6-checks.json':'stage6-model-checks.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({date:report.date,passed:report.passed,rarsInvocations:runs.length,randomArchitectureRuns:randomRuns,officialRarsChecked:official},null,2));
