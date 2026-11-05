'use strict';
// Executes official RARS, rather than a home-written assembler or ISA model.
// Usage from repository root:
// node content/computer-organization-riscv/source/验证/verify-stage3.cjs --java <java.exe> --jar <rars1_6.jar>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const course = path.resolve(__dirname, '../..');
const examples = path.join(course, 'source/示例代码/03-rars-basics');
const scratch = path.join(course, '.cache/stage3-run');
fs.mkdirSync(scratch, {recursive:true});
function argument(name) {const i = process.argv.indexOf(name); assert.ok(i >= 0 && process.argv[i+1], 'Missing '+name); return path.resolve(process.argv[i+1]);}
const java = argument('--java'), jar = argument('--jar');
assert.ok(fs.existsSync(java)); assert.ok(fs.existsSync(jar));
const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai'}).format(new Date());
const scenarios = [], runs = [];
function check(name, fn) {fn(); scenarios.push(name);}
function invoke(name, file, options = [], expectedStatus = 0) {
  const args = ['-Dfile.encoding=UTF-8','-Duser.language=en','-Duser.country=US','-jar',jar,'nc','me','ae2','se3','sm',...options,file];
  const run = spawnSync(java,args,{encoding:'utf8',timeout:20000,windowsHide:true,cwd:examples});
  assert.ifError(run.error);
  const text = run.stdout + '\n' + run.stderr;
  runs.push({name, file:path.relative(course,file).replaceAll('\\','/'), options, exitCode:run.status, stdout:run.stdout, stderr:run.stderr});
  assert.equal(run.status,expectedStatus,name+' exit status: '+text);
  return {text, stdout:run.stdout, stderr:run.stderr};
}
function register(text, name) {
  const m = text.match(new RegExp('(?:^|\\n)'+name+'\\s+0x([0-9a-f]{8})(?=\\s|$)','i'));
  assert.ok(m,'Missing register '+name+' in '+text); return parseInt(m[1],16)>>>0;
}
function registers(run, expected) {for(const [name,value] of Object.entries(expected)) assert.equal(register(run.text,name),value>>>0,name);}
function words(run) {
  const result = [];
  for(const line of run.text.split(/\r?\n/)) if(line.startsWith('Mem[')) result.push(...[...line.matchAll(/\t0x([0-9a-f]{8})/ig)].map(m=>parseInt(m[1],16)>>>0));
  return result;
}
function variant(name, source) {const file=path.join(scratch,name+'.s'); fs.writeFileSync(file,source); return file;}
const source = name => fs.readFileSync(path.join(examples,name+'.s'),'utf8');
const file = name => path.join(examples,name+'.s');
const runtime = spawnSync(java,['-version'],{encoding:'utf8',windowsHide:true});
check('Java runtime is available',()=>{assert.equal(runtime.status,0);const match=runtime.stderr.match(/version "(\d+)(?:\.(\d+))?/);assert.ok(match);assert.ok((Number(match[1])===1?Number(match[2]):Number(match[1]))>=8);});
const jarSha256=crypto.createHash('sha256').update(fs.readFileSync(jar)).digest('hex');
check('RARS v1.6 artifact fingerprint matches this verification batch',()=>assert.equal(jarSha256,'780f730eb457b1ba609e968accc2c8b77d8f92c3d9dbf30cc7fdb3cfb14e8c24'));
check('hello.s: actual console output 7 and register inputs',()=>{
 const r=invoke('hello',file('hello'),['t0','t1','a0']);assert.match(r.stdout,/^7(?:\r?\n|$)/);registers(r,{t0:3,t1:4,a0:7});
});
for(const [name,a,b,op,expected] of [['hello-negative-add',-2,7,'add',5],['hello-negative-sub',-2,7,'sub',-9],['hello-expression',9,14,'expression',-2]]) {
 check(name,()=>{
  let s=source('hello').replace('li t0, 3','li t0, '+a).replace('li t1, 4','li t1, '+b);
  s=s.replace('add a0, t0, t1',op==='expression'?'sub t2, t0, t1\n    addi a0, t2, 3':op+' a0, t0, t1');
  const r=invoke(name,variant(name,s),['a0']);assert.match(r.stdout,new RegExp('^'+expected+'(?:\\r?\\n|$)'));registers(r,{a0:expected});
 });
}
for(const [n,expected] of [[1,{t0:3,zero:0}],[2,{t0:3,t1:4,zero:0}],[3,{t0:7,t1:4,zero:0}],[4,{t0:7,t1:4,zero:0}],[5,{t0:7,t1:4,a0:14,zero:0}]]) check('register trace prefix '+n+' begins from reset state',()=>{
 const r=invoke('register-prefix-'+n,file('register-trace'),[String(n),...Object.keys(expected)]);registers(r,expected);assert.match(r.text,/maximum step limit/i);
});
check('register-trace: complete base-instruction program without pseudoinstructions',()=>registers(invoke('register-full-np',file('register-trace'),['np','t0','t1','a0','zero']),{t0:7,t1:4,a0:14,zero:0}));
const arithmetic = invoke('arithmetic',file('arithmetic'),['t0','t1','t2','s0','s1','t6','a1','a2','a3','a4','a5','a6','s3','s5','s6']);
check('arithmetic: logical and arithmetic right shift',()=>registers(arithmetic,{t0:-8,t1:0x7ffffffc,t2:-4}));
check('arithmetic: signed and unsigned comparisons',()=>registers(arithmetic,{s0:1,s1:0}));
check('arithmetic: masks and left shift',()=>registers(arithmetic,{t6:13,a1:180,a6:0}));
check('arithmetic: both signed 12-bit immediate boundaries',()=>registers(arithmetic,{a2:-2048,a3:2047}));
check('arithmetic: li, mv and manually constructed large constant agree',()=>registers(arithmetic,{a4:0x12345abc,a5:0x12345abc,s3:0x12345abc}));
check('arithmetic: signed overflow wraps and register shift masks to five bits',()=>registers(arithmetic,{s5:0x80000000,s6:2}));
check('arithmetic variant: negative odd right shift is floor, not truncation',()=>registers(invoke('arithmetic-minus7',variant('arithmetic-minus7',source('arithmetic').replace('li t0, -8','li t0, -7')),['t1','t2']),{t1:0x7ffffffc,t2:-4}));
const pseudo=invoke('pseudo',file('pseudo'),['t0','t1','t2','t3','t4']);
check('pseudo: actual final state',()=>registers(pseudo,{t0:7,t1:2048,t2:0x12345abc,t3:0x12345abc,t4:0}));
const dump=path.join(scratch,'pseudo-text.txt');
invoke('pseudo-assemble-and-dump',file('pseudo'),['a','dump','.text','SegmentWindow',dump]);
const dumpText=fs.readFileSync(dump,'utf8');
fs.writeFileSync(path.join(__dirname,'stage3-pseudo-text.txt'),dumpText);
const decoded=[...dumpText.matchAll(/^0x([\da-f]{8})\s+0x([\da-f]{8})\s+(.+)$/gim)].map(m=>({address:parseInt(m[1],16),code:parseInt(m[2],16)>>>0,basic:m[3].trim()}));
check('pseudo: eleven machine instructions at four-byte addresses',()=>{assert.equal(decoded.length,11);decoded.forEach((x,i)=>assert.equal(x.address,0x00400000+i*4));});
check('pseudo: independently specified machine words',()=>assert.deepEqual(decoded.map(x=>x.code),[0x00700293,0x00001337,0x80030313,0x123463b7,0xabc38393,0x00700e33,0x00000013,0xfff04e93,0x001e8e93,0x00a00893,0x00000073]));
check('pseudo: RARS v1.6 mv actually expands to add',()=>assert.match(decoded[5].basic,/^add x28,x0,x7/));
const memory=invoke('memory',file('memory'),['t1','t3','t5','t6','0x10010000-0x10010004']);
check('memory: copied word and low byte',()=>{registers(memory,{t1:0x12345678,t3:0x78});assert.deepEqual(words(memory),[0x12345678,0x12345678]);});
check('memory: same byte loaded signed and unsigned',()=>registers(memory,{t5:-2,t6:254}));
const update=invoke('memory-update',file('memory-update'),['t0','t1','t2','t3','s0','s1','s2','s3','s4','a0','a1','a2','a3','a4','0x10010000-0x1001000c']);
check('memory update: load-add-store-reload and console',()=>{assert.match(update.stdout,/^5(?:\r?\n|$)/);registers(update,{t0:0x10010000,t2:-4,t3:5,a0:5});assert.deepEqual(words(update),[9,0xfffffffc,5,0x1122bbcc]);});
check('memory update: earlier register copy remains unchanged after sh',()=>registers(update,{t1:0x112233aa,s4:0x1122bbcc}));
check('memory update: byte and halfword extension rules',()=>registers(update,{s0:-2,s1:254,s2:-2,s3:65534}));
check('memory update: four byte probes verify little-endian order',()=>registers(update,{a1:0xcc,a2:0xbb,a3:0x22,a4:0x11}));
for(const [name,a,b,c,expected] of [['practice-original',12,-5,-6,13],['practice-negative',-12,5,6,-13],['practice-zero',0,0,0,0],['practice-wrap',2147483647,1,0,-2147483648]]) check(name+': inputs preserved and output reloaded',()=>{
 const s=source('stage3-practice').replace('x: .word 12','x: .word '+a).replace('y: .word -5','y: .word '+b).replace('z: .word -6','z: .word '+c);
 const r=invoke(name,name==='practice-original'?file('stage3-practice'):variant(name,s),['a0','0x10010000-0x1001000c']);
 assert.match(r.stdout,new RegExp('^'+expected+'(?:\\r?\\n|$)'));registers(r,{a0:expected});assert.deepEqual(words(r),[a>>>0,b>>>0,c>>>0,expected>>>0]);
});
for(const [name,line] of [['bad-addi-positive','addi t0, zero, 2048'],['bad-addi-negative','addi t0, zero, -2049'],['bad-shift','slli t0, zero, 32'],['bad-register','add t7, zero, zero']]) check(name+': official assembler rejects invalid input',()=>{
 const r=invoke(name,variant(name,'.text\n.globl main\nmain:\n'+line+'\n'),[],2);assert.match(r.text,/Error|error/);
});
check('np mode rejects pseudo hello source',()=>assert.match(invoke('pseudo-disabled',file('hello'),['np'],2).text,/Error|error/));
for(const dest of ['t1','zero']) check('misaligned lw to '+dest+' still raises a runtime error',()=>{
 const s=source('memory').replace('lw t1, 0(t0)','lw '+dest+', 1(t0)');
 const r=invoke('misaligned-'+dest,variant('misaligned-'+dest,s),[],3);assert.match(r.text,/not aligned to word boundary/i);
});
const sourceFiles=fs.readdirSync(examples).filter(f=>f.endsWith('.s')).sort().map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(examples,name))).digest('hex')}));
const report={date,edition:'detailed-rewrite-stage3',passed:scenarios.length,scope:'Official RARS v1.6 command-line assembly/execution, RV32, Default, little endian; GUI operations and Ripes not executed',javaVersion:runtime.stderr.trim(),rarsSha256:jarSha256,independentPrograms:sourceFiles.length,sourceFiles,scenarios,runs};
fs.writeFileSync(path.join(__dirname,'stage3-rars-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({date,passed:scenarios.length,independentPrograms:sourceFiles.length,invocations:runs.length,report:'stage3-rars-checks.json'},null,2));
