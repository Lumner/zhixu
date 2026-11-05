'use strict';
// Named teaching scenarios, not a claim of complete ISA conformance.
const assert=require('node:assert/strict');
const {bits,binary32}=require('./01-bits/bits.cjs');
const {fullAdder,add4,simultaneous}=require('./02-logic/logic.cjs');
const {simulate}=require('./07-cache/cache.cjs');
const {CPU,sx}=require('./08-mini-rv32/cpu.cjs');
const {sumCPU,WORDS}=require('./08-mini-rv32/program.cjs');
const names=[];function check(name,fn){fn();names.push(name);}
// Encoders are for bounded test fixtures only, not a general assembler.
const I=(imm,rs1,f3,rd,op=0x13)=>(((imm&4095)<<20)|(rs1<<15)|(f3<<12)|(rd<<7)|op)>>>0;
const R=(f7,rs2,rs1,f3,rd)=>((f7<<25)|(rs2<<20)|(rs1<<15)|(f3<<12)|(rd<<7)|0x33)>>>0;
const S=(imm,rs2,rs1,f3)=>(((imm&0xfe0)<<20)|(rs2<<20)|(rs1<<15)|(f3<<12)|((imm&31)<<7)|0x23)>>>0;
const B=(imm,rs2,rs1,f3)=>(((imm&0x1000)<<19)|((imm&0x800)>>>4)|((imm&0x7e0)<<20)|((imm&30)<<7)|(rs2<<20)|(rs1<<15)|(f3<<12)|0x63)>>>0;
function one(word,a=0,b=0){const c=new CPU();c.loadWords([word]);c.r[1]=a>>>0;c.r[2]=b>>>0;const row=c.step();return {c,row};}
check('37 in binary and low-byte complement',()=>{assert.equal(bits(37),'00100101');assert.equal(bits(-5),'11111011');});
check('binary32 known encodings',()=>{assert.equal(binary32(1.5),0x3fc00000);assert.equal(binary32(2.5),0x40200000);});
check('full adder: all 8 input combinations',()=>{for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let cin=0;cin<2;cin++){const x=fullAdder(a,b,cin);assert.equal(x.sum+2*x.carry,a+b+cin);}});
check('4-bit ripple adder: all 256 input pairs',()=>{for(let a=0;a<16;a++)for(let b=0;b<16;b++){const x=add4(a,b);assert.equal(x.result,(a+b)&15);assert.equal(x.carry,(a+b)>>>4);}});
check('simultaneous state updates use old A',()=>assert.deepEqual(simultaneous(1,0,3),[{a:2,b:1},{a:3,b:2},{a:4,b:3}]));
check('known independent instruction encodings',()=>{assert.equal(I(7,0,0,5),0x00700293);assert.equal(R(0,6,5,0,7),0x006283b3);assert.equal(I(-1,5,0,5),0xfff28293);assert.equal(B(8,0,0,0),0x00000463);});
check('sign extension boundaries',()=>{assert.equal(sx(0x800,12),-2048);assert.equal(sx(0x7ff,12),2047);assert.equal(sx(0x1ffc,13),-4);});
const immediateCases=[
 ['addi',0,0,-1,5,4],['slti',2,0,1,-1,1],['sltiu',3,0,-1,1,1],
 ['xori',4,0,-1,0x0f,0xfffffff0],['ori',6,0,1,2,3],['andi',7,0,15,0xad,13],
 ['slli',1,0,2,7,28],['srli',5,0,1,-8,0x7ffffffc],['srai',5,0x20,1,-8,-4]
];
for(const [name,f3,f7,imm,a,expected]of immediateCases)check(name+' semantics',()=>{const {c,row}=one(I((f7<<5)| (imm&4095),1,f3,3),a);assert.equal(c.r[3],expected>>>0);assert.equal(row.op,name);});
const registerCases=[
 ['add',0,0,0x7fffffff,1,0x80000000],['sub',0,0x20,3,4,-1],['sll',1,0,1,33,2],
 ['slt',2,0,-1,1,1],['sltu',3,0,-1,1,0],['xor',4,0,10,12,6],
 ['srl',5,0,-8,1,0x7ffffffc],['sra',5,0x20,-8,1,-4],['or',6,0,10,12,14],['and',7,0,10,12,8]
];
for(const [name,f3,f7,a,b,expected]of registerCases)check(name+' semantics',()=>{const {c,row}=one(R(f7,2,1,f3,3),a,b);assert.equal(c.r[3],expected>>>0);assert.equal(row.op,name);});
for(const [f3,name,expected]of [[0,'lb',-2],[4,'lbu',254],[1,'lh',-2],[5,'lhu',65534],[2,'lw',0xfffffffe]])check(name+' little-endian load',()=>{const c=new CPU();c.loadWords([I(0,1,f3,3,3)]);c.r[1]=256;c.memory.setUint32(256,0xfffffffe,true);assert.equal(c.step().op,name);assert.equal(c.r[3],expected>>>0);});
for(const [f3,name,size]of [[0,'sb',1],[1,'sh',2],[2,'sw',4]])check(name+' width and negative offset',()=>{const c=new CPU();c.loadWords([S(-4,2,1,f3)]);c.r[1]=260;c.r[2]=0x12345678;c.memory.setUint32(256,0xffffffff,true);assert.equal(c.step().op,name);assert.equal(c.memory.getUint32(256,true),size===1?0xffffff78:size===2?0xffff5678:0x12345678);});
for(const [f3,name,a,b,taken]of [[0,'beq',7,7,true],[1,'bne',7,7,false],[4,'blt',-1,1,true],[5,'bge',-1,1,false],[6,'bltu',-1,1,false],[7,'bgeu',-1,1,true]])check(name+' signed/unsigned direction',()=>{const {c,row}=one(B(8,2,1,f3),a,b);assert.equal(c.pc,taken?8:4);assert.equal(row.op,name);});
check('backward branch uses current PC',()=>{const c=new CPU();c.loadWords([0x13,B(-4,0,0,0)]);c.pc=4;c.step();assert.equal(c.pc,0);});
check('lui and auipc preserve upper immediate',()=>{const c=new CPU();c.loadWords([0x123451b7,0x12345217]);c.step();c.step();assert.equal(c.r[3],0x12345000);assert.equal(c.r[4],0x12345004);});
check('jal link and target, negative J immediate',()=>{const {c}=one(0x008001ef);assert.equal(c.pc,8);assert.equal(c.r[3],4);const d=new CPU();d.loadWords(WORDS);d.pc=32;d.step();assert.equal(d.pc,12);assert.equal(d.r[0],0);});
check('jalr reads old rs1 when rd equals rs1 and clears bit0',()=>{const c=new CPU();c.loadWords([I(0,1,0,1,0x67)]);c.r[1]=9;c.step();assert.equal(c.pc,8);assert.equal(c.r[1],4);});
check('x0 cannot be written',()=>{const c=new CPU();c.loadWords([I(7,0,0,0)]);c.step();assert.equal(c.r[0],0);});
check('load to x0 still performs an access check',()=>{const c=new CPU();c.loadWords([I(1,0,2,0,3)]);assert.throws(()=>c.step(),/Misaligned/);});
check('misaligned jal does not write its link',()=>{const {c}=one(0x13);c.pc=0;c.loadWords([0x002001ef]);assert.throws(()=>c.step(),/Misaligned instruction/);assert.equal(c.r[3],0);assert.equal(c.pc,0);});
check('untaken branch may have a misaligned target',()=>{const {c}=one(B(2,2,1,0),1,2);assert.equal(c.pc,4);});
check('out-of-range and misaligned loads are explicit errors',()=>{for(const address of [1024,257]){const c=new CPU();c.loadWords([I(0,1,2,3,3)]);c.r[1]=address;assert.throws(()=>c.step(),/Memory range|Misaligned/);assert.equal(c.r[3],0);}});
check('reserved shifts, M extension, invalid branch, ecall rejected',()=>{for(const word of [I(0x20,1,1,3),R(1,2,1,0,3),B(4,0,0,2),0x00000073,0xffffffff]){const c=new CPU();c.loadWords([word]);assert.throws(()=>c.step(),/Unsupported\/illegal/);}});
check('host stop and finite step limit',()=>{const c=new CPU();c.loadWords([0x00100073]);assert.equal(c.run().length,1);assert.throws(()=>c.step(),/halted/);const d=new CPU();d.loadWords([0x0000006f]);assert.throws(()=>d.run(5),/Step limit/);});
for(const values of [[3,-2,7,0,4],[],[-5,-2],[0],[2147483647,1]])check('machine-code sum '+JSON.stringify(values),()=>{const c=sumCPU(values),trace=c.run();assert.equal(c.r[10],values.reduce((a,b)=>(a+b)>>>0,0));assert.equal(c.r[5],256+values.length*4);assert.equal(c.r[6],0);assert.equal(trace.filter(x=>x.op==='lw').length,values.length);});
check('cache cold, spatial and conflict cases',()=>{const x=simulate([0,4,16,0,64,0]);assert.equal(x.hits,2);assert.equal(x.misses,4);assert.deepEqual(x.trace.map(r=>r.hit),[false,true,false,true,false,false]);});
check('cache address 0x24 fields and zero valid tag',()=>{const x=simulate([0,0,0x24]);assert.equal(x.hits,1);assert.deepEqual(x.trace[2],{address:36,block:2,index:2,tag:0,offset:4,hit:false});});
check('two array scans reuse both cache lines',()=>{const scan=[256,260,264,268,272];assert.equal(simulate(scan).misses,2);assert.equal(simulate([...scan,...scan]).hits,8);});
check('cache geometry and address checks',()=>{assert.throws(()=>simulate([0],{capacity:63,lineSize:16}),/geometry/);assert.throws(()=>simulate([-1]),/address/);assert.equal(simulate([]).hitRate,0);});
check('AMAT, finite pipeline and predictor arithmetic',()=>{assert.equal(1+0.05*50,3.5);assert.equal(100+4+10,114);let state=1,wrong=0;for(const taken of [1,1,0,1]){if(Number(state>=2)!==taken)wrong++;state=taken?Math.min(3,state+1):Math.max(0,state-1);}assert.equal(wrong,2);});
const report={date:'2026-11-04',namedScenarios:names.length,passed:names.length,scope:'Local educational models only; RARS/Ripes not executed',scenarios:names};
console.log(JSON.stringify(report,null,2));
