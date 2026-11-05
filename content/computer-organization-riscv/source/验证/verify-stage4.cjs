'use strict';
// Official RARS v1.6 command-line execution. Run from repository root with --java and --jar.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const course=path.resolve(__dirname,'../..'),examples=path.join(course,'source/示例代码/04-rars-programs');
const scratch=path.join(course,'.cache/stage4-run');fs.mkdirSync(scratch,{recursive:true});
const argument=n=>{const i=process.argv.indexOf(n);assert.ok(i>=0&&process.argv[i+1],'Missing '+n);return path.resolve(process.argv[i+1]);};
const java=argument('--java'),jar=argument('--jar'),scenarios=[],runs=[];
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
function check(name,fn){fn();scenarios.push(name);}
const src=n=>fs.readFileSync(path.join(examples,n+'.s'),'utf8');
const file=n=>path.join(examples,n+'.s');
function variant(n,s){const p=path.join(scratch,n+'.s');fs.writeFileSync(p,s);return p;}
function run(name,p,options=[]){
 const limit=name==='fault-no-progress'||name==='fault-ra'?'100':'10000';
 const result=spawnSync(java,['-Dfile.encoding=UTF-8','-Duser.language=en','-Duser.country=US','-jar',jar,'nc','me','sm','ae2','se3',limit,...options,p],{encoding:'utf8',windowsHide:true,timeout:20000,cwd:examples});
 assert.ifError(result.error);assert.equal(result.status,0,name+': '+result.stderr);
 const text=result.stdout+'\n'+result.stderr;runs.push({name,file:path.relative(course,p).replaceAll('\\','/'),options,exitCode:result.status,stdout:result.stdout,stderr:result.stderr});return {...result,text};
}
function reg(r,n){const m=r.text.match(new RegExp('(?:^|\\n)'+n+'\\s+0x([\\da-f]{8})(?=\\s|$)','i'));assert.ok(m,'Missing '+n);return parseInt(m[1],16)>>>0;}
function regs(r,want){for(const [n,v]of Object.entries(want))assert.equal(reg(r,n),v>>>0,n);}
function output(r,want){assert.equal(r.stdout.trim(),String(want));assert.doesNotMatch(r.stderr,/maximum step limit/i);}
const jarSha256=crypto.createHash('sha256').update(fs.readFileSync(jar)).digest('hex');
check('Fixed official RARS v1.6 artifact',()=>assert.equal(jarSha256,'780f730eb457b1ba609e968accc2c8b77d8f92c3d9dbf30cc7fdb3cfb14e8c24'));
for(const x of [-3,0,5])check('branch choice '+x,()=>{const r=run('branch-'+x,x===-3?file('branch-demo'):variant('branch-'+x,src('branch-demo').replace('li t0, -3','li t0, '+x)),['a0']);output(r,Math.max(0,x));regs(r,{a0:Math.max(0,x)});});
// Parse register dumps from combined stdout/stderr; me keeps program stdout separate.
function printed(r,want){assert.ok(r.stdout.startsWith(String(want)+'\n')||r.stdout===String(want),r.stdout);assert.doesNotMatch(r.stderr,/maximum step limit/i);}
for(const n of [0,1,5,10,1000])check('range sum N='+n,()=>{const r=run('range-'+n,n===5?file('range-sum'):variant('range-'+n,src('range-sum').replace('li t1, 5','li t1, '+n)),['t0','t2']);printed(r,n*(n+1)/2);regs(r,{t0:n+1,t2:n*(n+1)/2});});
for(const n of [0,1,3,5])for(const indexed of [false,true])check((indexed?'index':'pointer')+' sum length '+n,()=>{
 const name=indexed?'sum-index':'sum',s=src(name).replace(indexed?'li t2, 5':'li t1, 5',(indexed?'li t2, ':'li t1, ')+n);
 const r=run(name+'-'+n,n===5?file(name):variant(name+'-'+n,s),indexed?['t0','t1','t3']:['t0','t1','t2']);
 const expected=[3,-2,7,0,4].slice(0,n).reduce((a,b)=>a+b,0);printed(r,expected);
 regs(r,indexed?{t0:0x10010000,t1:n,t3:expected}:{t0:0x10010000+n*4,t1:0,t2:expected});
});
for(const [name,declaration,expected]of [['ascii','message: .asciz "RISC-V"',6],['empty','message: .asciz ""',0],['digit-zero','message: .asciz "0"',1],['embedded-zero','message: .byte 65, 0, 66, 0',1],['utf8-bytes','message: .byte 0xe4, 0xb8, 0xad, 0',3]])check('zero-terminated byte scan '+name,()=>{
 const r=run('strlen-'+name,name==='ascii'?file('strlen'):variant('strlen-'+name,src('strlen').replace('message: .asciz "RISC-V"',declaration)));output(r,expected);
});
for(const [name,bytes,cap,len,found]of [['no-nul',[65,66,67],3,3,0],['last-nul',[65,66,0],3,2,1],['middle-nul',[65,0,67],3,1,1],['first-nul',[0,66,67],3,0,1],['nul-outside-limit',[65,66,0],2,2,0],['zero-capacity',[65,66,67],0,0,0]])check('bounded byte scan '+name,()=>{
 const s=src('bounded-strlen').replace('buffer: .byte 65, 66, 67','buffer: .byte '+bytes.join(', ')).replace('li t1, 3','li t1, '+cap);
 const r=run('bounded-'+name,name==='no-nul'?file('bounded-strlen'):variant('bounded-'+name,s));output(r,len+'\n'+found);
});
for(const x of [5,-3,0,7])check('nested function input '+x,()=>{const r=run('functions-'+x,x===5?file('functions'):variant('functions-'+x,src('functions').replace('li a0, 5','li a0, '+x)),['a0','sp']);printed(r,2*x+1);regs(r,{a0:2*x+1});assert.equal(reg(r,'sp')%16,0);});
for(const x of [5,-3])check('caller and callee preservation input '+x,()=>{const r=run('abi-'+x,x===5?file('abi-lab'):variant('abi-'+x,src('abi-lab').replace('li a0, 5','li a0, '+x)),['a0','t0','s0','s1','sp']);printed(r,2*x+91);regs(r,{a0:2*x+91,t0:90,s0:123});assert.equal(reg(r,'sp'),reg(r,'s1'));assert.equal(reg(r,'sp')%16,0);});
const statsBody=src('stats').slice(src('stats').indexOf('\nstats:'));
function harness(values,n=values.length,invalidBase=false){return '.data\n.align 2\nnumbers: .word '+(values.length?values.join(', '):'0')+'\n.text\n.globl main\nmain:\n    andi sp, sp, -16\n    mv s11, sp\n'+Array.from({length:11},(_,i)=>'    li s'+i+', '+(101+i)+'\n').join('')+(invalidBase?'    li a0, 0\n':'    la a0, numbers\n')+'    li a1, '+n+'\n    jal ra, stats\n    li a7, 10\n    ecall\n'+statsBody;}
check('stats complete demonstration output and saved tuple',()=>{const r=run('stats-main',file('stats'),['s0','s1','s2','s3']);printed(r,'12\n7\n3');regs(r,{s0:12,s1:7,s2:3,s3:1});});
const cases=[['default',[3,-2,7,0,4]],['all-negative',[-5,-2]],['single-zero',[0]],['single-positive',[7]],['interior-zero',[3,0,4]],['positive-wrap',[2147483647,1]],['negative-wrap',[-2147483648,-1]],['empty',[]],['equal-max',[4,4,4]],['decreasing',[9,7,2,-4]],['mixed',[-8,2,0,-1,13,-7,4]]];
for(const [name,values]of cases)check('stats tuple, preserved s registers and sp: '+name,()=>{
 const names=['a0','a1','a2','a3',...Array.from({length:12},(_,i)=>'s'+i),'sp'];
 const r=run('stats-'+name,variant('stats-'+name,harness(values)),names);assert.doesNotMatch(r.stderr,/maximum step limit/i);
 regs(r,{a0:values.reduce((a,b)=>(a+b)|0,0),a1:values.length?Math.max(...values):0,a2:values.filter(v=>v>0).length,a3:values.length?1:0,...Object.fromEntries(Array.from({length:11},(_,i)=>['s'+i,101+i]))});
 assert.equal(reg(r,'sp'),reg(r,'s11'));assert.equal(reg(r,'sp')%16,0);
});
for(const n of [0,-1])check('stats nonpositive length '+n+' accepts unreadable base without load',()=>{const r=run('stats-invalid-base-'+n,variant('stats-invalid-base-'+n,harness([],n,true)),['a0','a1','a2','a3']);regs(r,{a0:0,a1:0,a2:0,a3:0});});
// Fault injection: assert an independently predicted wrong result or finite nontermination.
check('fault detected: missing branch join jump',()=>{const r=run('fault-fallthrough',variant('fault-fallthrough',src('branch-demo').replace('li t0, -3','li t0, 5').replace('    j show\n','')));output(r,0);assert.notEqual(Number(r.stdout.trim()),5);});
check('fault detected: range loses inclusive endpoint',()=>{const r=run('fault-off-by-one',variant('fault-off-by-one',src('range-sum').replace('blt t1, t0, done','bge t0, t1, done')));output(r,10);assert.notEqual(Number(r.stdout.trim()),15);});
check('fault detected: range missing progress reaches finite step limit',()=>{const r=run('fault-no-progress',variant('fault-no-progress',src('range-sum').replace('    addi t0, t0, 1\n','')));assert.match(r.stderr,/maximum step limit/i);});
check('fault detected: caller fails to restore live t0',()=>{const r=run('fault-caller',variant('fault-caller',src('abi-lab').replace('    lw t0, 0(sp)\n','')));output(r,-88);});
check('fault detected: callee fails to restore s0 despite correct printed result',()=>{const r=run('fault-callee',variant('fault-callee',src('abi-lab').replace('    lw s0, 8(sp)\n','')),['s0']);printed(r,101);regs(r,{s0:5});assert.notEqual(reg(r,'s0'),123);});
check('fault detected: nested call loses outer return address',()=>{const r=run('fault-ra',variant('fault-ra',src('functions').replace('    lw ra, 12(sp)\n','')));assert.match(r.stderr,/maximum step limit/i);});
check('fault detected: zero initial max breaks all-negative input',()=>{const r=run('fault-max',variant('fault-max',harness([-5,-2]).replace('lw t1, 0(a4)','li t1, 0')),['a1']);regs(r,{a1:0});assert.notEqual(reg(r,'a1'),(-2)>>>0);});
check('fault detected: zero incorrectly counted positive',()=>{const r=run('fault-positive',variant('fault-positive',harness([0]).replace('bge zero, t3, not_positive','blt t3, zero, not_positive')),['a2']);regs(r,{a2:1});});
check('fault detected: repeated first array element still terminates',()=>{const r=run('fault-pointer',variant('fault-pointer',harness([3,-2,7,0,4]).replace('    addi a4, a4, 4\n','')),['a0','a1','a2']);regs(r,{a0:15,a1:3,a2:5});});
const dump=path.join(scratch,'functions-text.txt');run('functions-machine-table',file('functions'),['a','dump','.text','SegmentWindow',dump]);
const dumpText=fs.readFileSync(dump,'utf8');fs.writeFileSync(path.join(__dirname,'stage4-functions-text.txt'),dumpText);
check('functions machine table exposes two jal links and ret expansion',()=>{assert.match(dumpText,/jal x1/);assert.match(dumpText,/jalr x0,x1,0/);assert.equal([...dumpText.matchAll(/\bjal x1,/g)].length,2);});
const sourceFiles=fs.readdirSync(examples).filter(n=>n.endsWith('.s')).sort().map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(examples,name))).digest('hex')}));
const runtime=spawnSync(java,['-version'],{encoding:'utf8',windowsHide:true});
const report={date,edition:'detailed-rewrite-stage4',passed:scenarios.length,independentPrograms:sourceFiles.length,rarsInvocations:runs.length,scope:'Official RARS v1.6 CLI, RV32, Default; GUI, physical timing and Ripes not executed',javaVersion:runtime.stderr.trim(),rarsSha256:jarSha256,sourceFiles,scenarios,runs};
fs.writeFileSync(path.join(__dirname,'stage4-rars-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({date,passed:scenarios.length,independentPrograms:sourceFiles.length,rarsInvocations:runs.length},null,2));
