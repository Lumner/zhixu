'use strict';
// Author checks: RARS encoding/execution, host GCC C17, and bounded functional models.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const course=path.resolve(__dirname,'../..'),examples=path.join(course,'source/示例代码/05-datapath'),scratch=path.join(course,'.cache/stage5-run');fs.mkdirSync(scratch,{recursive:true});
const arg=n=>{const i=process.argv.indexOf(n);assert.ok(i>=0&&process.argv[i+1],'Missing '+n);return path.resolve(process.argv[i+1]);};
const java=arg('--java'),jar=arg('--jar'),gcc=arg('--gcc'),checks=[],runs=[];
const {Datapath,decode,demo,WORDS}=require('../示例代码/05-datapath/datapath-lab.cjs');
const {CPU}=require('../示例代码/08-mini-rv32/cpu.cjs');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
function check(name,fn){fn();checks.push(name);}
function execute(name,command,args,success=true){const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout:30000,cwd:examples});assert.ifError(r.error);runs.push({name,tool:path.basename(command),args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});if(success)assert.equal(r.status,0,name+': '+r.stderr);else assert.notEqual(r.status,0,name);return r;}
function rars(name,file,options=[]){return execute(name,java,['-Dfile.encoding=UTF-8','-Duser.language=en','-Duser.country=US','-jar',jar,'nc','me','sm','ae2','se3','1000',...options,file]);}
const source=n=>path.join(examples,n),tmp=n=>path.join(scratch,n);
function wordsOf(text){return [...text.matchAll(/^0x[\da-f]{8}\s+0x([\da-f]{8})/gim)].map(m=>parseInt(m[1],16)>>>0);}
const dumpFile=tmp('encoding-text.txt');rars('encoding-assemble-only',source('encoding.s'),['a','dump','.text','SegmentWindow',dumpFile]);const encodingText=fs.readFileSync(dumpFile,'utf8');
fs.writeFileSync(path.join(__dirname,'stage5-encoding-text.txt'),encodingText);
const actualWords=wordsOf(encodingText);
const expected=[0x00700293,0x006283b3,0x406283b3,0xfff28293,0x0042a383,0xfe62ae23,0x00000463,0x00000013,0xfe000ce3,0x123452b7,0x008000ef,0x00000013,0x00000013];
check('All thirteen fixture words agree with official RARS assembler',()=>assert.deepEqual(actualWords,expected));
check('I field extraction and signed immediate',()=>{const w=actualWords[0];assert.equal(w&127,0x13);assert.equal((w>>>7)&31,5);assert.equal((w>>>15)&31,0);assert.equal(w>>20,7);assert.equal(actualWords[3]>>20,-1);});
check('R add/sub differ only in their specified funct7 bit',()=>assert.equal((actualWords[1]^actualWords[2])>>>0,0x40000000));
check('S split immediate reassembles to minus four',()=>{const w=actualWords[5],raw=((w>>>25)<<5)|((w>>>7)&31);assert.equal(raw,0xffc);assert.equal((raw<<20)>>20,-4);assert.equal(decode(w).op,'sw');});
check('B positive and negative offsets use current PC',()=>{assert.equal(decode(actualWords[6]).imm,8);assert.equal(decode(actualWords[8]).imm,-8);assert.equal(0x100+8,0x108);assert.equal(0x108-8,0x100);});
check('U value and J link/target have different meanings',()=>{assert.equal((actualWords[9]&0xfffff000)>>>0,0x12345000);const c=new CPU();c.loadWords([actualWords[10],0x13,0x13]);c.step();assert.equal(c.pc,8);assert.equal(c.r[1],4);});
check('Machine word produces little-endian bytes, not bit reversal',()=>{const b=Buffer.alloc(4);b.writeUInt32LE(actualWords[0]);assert.deepEqual([...b],[0x93,2,0x70,0]);});
const modelAsm='.text\n.globl main\nmain:\naddi x5,x0,256\nlw x6,0(x5)\naddi x7,x6,2\nsw x7,4(x5)\nbeq x6,x7,skip\nadd x10,x6,x7\nskip:\nbeq x7,x7,end\naddi x10,x0,-1\nend:\n';
fs.writeFileSync(tmp('model-encoding.s'),modelAsm);rars('model-words-assemble-only',tmp('model-encoding.s'),['a','dump','.text','SegmentWindow',tmp('model-words.txt')]);
check('Teaching demo words independently assembled by RARS',()=>assert.deepEqual(wordsOf(fs.readFileSync(tmp('model-words.txt'),'utf8')),WORDS));
const official=rars('datapath-rars-execute',source('datapath-rars.s'),['a0','t1','t2','0x10010000-0x10010004']);
check('Official RARS program prints twelve and writes data seven',()=>{assert.equal(official.stdout.trim(),'12');assert.match(official.stderr,/a0\s+0x0000000c/);assert.match(official.stderr,/t1\s+0x00000005/);assert.match(official.stderr,/t2\s+0x00000007/);assert.match(official.stderr,/Mem\[0x10010000\]\s+0x00000005\s+0x00000007/);});
const basic=demo();
check('Seven-step functional demo final architecture',()=>{assert.equal(basic.trace.length,7);assert.equal(basic.cpu.r[10],12);assert.equal(basic.cpu.memory.getUint32(260,true),7);assert.equal(basic.cpu.pc,32);});
check('lw address, memory value and writeback are distinct',()=>{const x=basic.trace[1];assert.equal(x.aluResult,256);assert.equal(x.memReadValue,5);assert.deepEqual(x.registerWrite,{register:6,value:5});assert.equal(x.controls.ResultSrc,'memory');});
check('sw ALU immediate and memory write source are distinct',()=>{const x=basic.trace[3];assert.equal(x.aluB,4);assert.deepEqual(x.memoryWrite,{address:260,value:7});assert.equal(x.registerWrite,null);});
check('Both beq paths select correct next PC without state writes',()=>{for(const [i,next,equal]of [[4,20,false],[6,32,true]]){const x=basic.trace[i];assert.equal(x.nextPC,next);assert.equal(x.equal,equal);assert.equal(x.registerWrite,null);assert.equal(x.memoryWrite,null);}});
check('Five-op control rows match independently specified expectations',()=>{
 const want={add:[true,'reg',false,false,'alu',false],addi:[true,'imm',false,false,'alu',false],lw:[true,'imm',true,false,'memory',false],sw:[false,'imm',false,true,null,false],beq:[false,'reg',false,false,null,true]};
 for(const x of basic.trace){const c=x.controls;assert.deepEqual([c.RegWrite,c.ALUSrc,c.MemRead,c.MemWrite,c.ResultSrc,c.Branch],want[x.op]);}
});
for(const value of [0,5,9,0x7fffffff,0xfffffffe])check('Differential architecture versus existing model input '+value,()=>{
 const a=new Datapath(),b=new CPU(512);a.load(WORDS);b.loadWords(WORDS);a.memory.setUint32(256,value,true);b.memory.setUint32(256,value,true);
 for(let i=0;i<7;i++){a.step();b.step();assert.equal(a.pc,b.pc);assert.deepEqual([...a.r],[...b.r]);assert.deepEqual([...new Uint8Array(a.memory.buffer)],[...new Uint8Array(b.memory.buffer)]);}
});
check('Unsupported sub and reserved load reject before changing architecture',()=>{for(const w of [0x406283b3,0x0002b303,0xffffffff]){const d=new Datapath();d.load([w]);assert.throws(()=>d.step(),/Unsupported/);assert.equal(d.pc,0);assert.ok([...d.r].every(x=>x===0));}});
check('Misaligned load rejects without a partial register write',()=>{const d=new Datapath();d.load([0x0012a303]);d.r[5]=256;assert.throws(()=>d.step(),/Invalid aligned/);assert.equal(d.r[6],0);assert.equal(d.pc,0);});
check('x0 writes are discarded and old operands are used',()=>{const d=new Datapath();d.load([0x00700013,0x00128293]);d.r[5]=6;d.step();assert.equal(d.r[0],0);d.step();assert.equal(d.r[5],7);});
check('Single-cycle path and unit calculations',()=>{assert.equal(200+100+150+200+50,700);assert.equal(200+100+150+50,500);assert.ok(Math.abs(1/(700e-12)/1e9-1.4285714285714286)<1e-12);});
check('Multicycle schedule time, CPI and branch base arithmetic',()=>{assert.equal(60*4+20*5+10*4+10*3,410);assert.equal(410*250,102500);assert.equal(100*700,70000);assert.equal(0x100-8,0xf8);assert.equal(0x104-8,0xfc);});
const gccVersion=execute('gcc-version',gcc,['--version']).stdout.trim(),gccTarget=execute('gcc-target',gcc,['-dumpmachine']).stdout.trim();
check('Host target explicitly differs from RISC-V',()=>{assert.match(gccTarget,/x86_64/);assert.doesNotMatch(gccTarget,/riscv/);});
for(const level of ['O0','O2']){
 check('C17 two-file sum compile and execute '+level,()=>{const exe=tmp('sum-'+level+'.exe');execute('build-sum-'+level,gcc,['-std=c17','-Wall','-Wextra','-Werror','-'+level,source('sum.c'),source('sum-main.c'),'-o',exe]);assert.equal(execute('run-sum-'+level,exe,[]).stdout.trim(),'sum = 12');});
 check('C17 pointer value/store distinction '+level,()=>{const exe=tmp('pointer-'+level+'.exe');execute('build-pointer-'+level,gcc,['-std=c17','-Wall','-Wextra','-Werror','-'+level,source('pointer-demo.c'),'-o',exe]);assert.equal(execute('run-pointer-'+level,exe,[]).stdout.replaceAll('\r','').trim(),'inside = 4\nafter local = 3\nafter store = 9');});
}
for(const [name,values,n,want]of [['negative',[-5,-2],2,-7],['prefix',[3,-2,7,0,4],3,8],['zero',[0],1,0],['empty',[0],0,0]])check('C defined-input sum '+name,()=>{
 const p=tmp('c-'+name+'.c');fs.writeFileSync(p,'#include <stdio.h>\n#include "sum.h"\nint main(void){int a[] = {'+values.join(',')+'}; printf("%d\\n",sum(a,'+n+'));return 0;}\n');const exe=tmp('c-'+name+'.exe');execute('compile-c-'+name,gcc,['-std=c17','-Wall','-Wextra','-Werror','-I',examples,source('sum.c'),p,'-o',exe]);assert.equal(execute('run-c-'+name,exe,[]).stdout.trim(),String(want));
});
check('C compile stages and separate link produce the same result',()=>{
 execute('preprocess',gcc,['-std=c17','-E',source('sum.c'),'-o',tmp('sum.i')]);
 for(const level of ['O0','O2'])execute('host-assembly-'+level,gcc,['-std=c17','-'+level,'-S',source('sum.c'),'-o',tmp('sum-host-'+level+'.s')]);
 execute('compile-sum-object',gcc,['-std=c17','-c',source('sum.c'),'-o',tmp('sum.o')]);execute('compile-main-object',gcc,['-std=c17','-c',source('sum-main.c'),'-o',tmp('sum-main.o')]);execute('separate-link',gcc,[tmp('sum.o'),tmp('sum-main.o'),'-o',tmp('sum-linked.exe')]);assert.equal(execute('run-linked',tmp('sum-linked.exe'),[]).stdout.trim(),'sum = 12');assert.ok(fs.statSync(tmp('sum.o')).size>0);assert.match(fs.readFileSync(tmp('sum-host-O0.s'),'utf8'),/%r[a-z0-9]+/);
});
check('Missing definition is a real link failure',()=>{const r=execute('missing-sum-definition',gcc,[tmp('sum-main.o'),'-o',tmp('missing.exe')],false);assert.match(r.stderr,/undefined reference.*sum/i);});
check('Observed host type sizes are recorded, not assumed RV32',()=>{fs.writeFileSync(tmp('sizes.c'),'#include <stdio.h>\nint main(void){printf("%zu %zu\\n",sizeof(int),sizeof(void*));return 0;}\n');execute('build-sizes',gcc,['-std=c17',tmp('sizes.c'),'-o',tmp('sizes.exe')]);assert.equal(execute('run-sizes',tmp('sizes.exe'),[]).stdout.trim(),'4 8');});
const files=fs.readdirSync(examples).filter(n=>/\.(s|c|h|cjs)$/.test(n)).sort().map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(source(name))).digest('hex')}));
const report={date,edition:'detailed-rewrite-stage5',passed:checks.length,gccVersion,gccTarget,rarsInvocations:runs.filter(r=>r.tool.toLowerCase()==='java.exe').length,scope:'RARS encoding/one complete program; host C17; bounded functional models and arithmetic. No RV32 C cross compilation, HDL, Ripes or real timing validation.',sourceFiles:files,scenarios:checks,datapathTrace:basic.trace,runs};
fs.writeFileSync(path.join(__dirname,'stage5-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({date,passed:checks.length,rarsInvocations:report.rarsInvocations,gccTarget},null,2));
