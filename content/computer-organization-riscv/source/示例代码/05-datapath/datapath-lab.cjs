'use strict';
// Five-op functional teaching model. No real clock, gates, HDL, timing, traps or ecall.
const hex=n=>'0x'+(n>>>0).toString(16).padStart(8,'0');
const sx=(n,b)=>(n<<(32-b))>>(32-b);
function decode(word){
 word>>>=0;const opcode=word&127,rd=(word>>>7)&31,rs1=(word>>>15)&31,rs2=(word>>>20)&31,f3=(word>>>12)&7,f7=word>>>25;
 let op,imm=0;
 if(opcode===0x33&&f3===0&&f7===0)op='add';
 else if(opcode===0x13&&f3===0){op='addi';imm=word>>20;}
 else if(opcode===3&&f3===2){op='lw';imm=word>>20;}
 else if(opcode===0x23&&f3===2){op='sw';imm=sx(((word>>>25)<<5)|rd,12);}
 else if(opcode===0x63&&f3===0){op='beq';imm=sx(((word>>>31)<<12)|(((word>>>7)&1)<<11)|(((word>>>25)&63)<<5)|(((word>>>8)&15)<<1),13);}
 else throw Error('Unsupported encoding '+hex(word));
 return {op,rd,rs1,rs2,imm,controls:{RegWrite:['add','addi','lw'].includes(op),ALUSrc:['addi','lw','sw'].includes(op)?'imm':'reg',MemRead:op==='lw',MemWrite:op==='sw',ResultSrc:op==='lw'?'memory':['add','addi'].includes(op)?'alu':null,Branch:op==='beq'}};
}
class Datapath {
 constructor(bytes=512){this.r=new Uint32Array(32);this.memory=new DataView(new ArrayBuffer(bytes));this.pc=0;}
 check(address){if(!Number.isInteger(address)||address<0||address+4>this.memory.byteLength||address%4)throw Error('Invalid aligned word address '+address);}
 load(words){words.forEach((w,i)=>this.memory.setUint32(i*4,w>>>0,true));}
 step(){
  const pc=this.pc;this.check(pc);const word=this.memory.getUint32(pc,true),d=decode(word),c=d.controls;
  const a=d.rs1===0?0:this.r[d.rs1],b=d.rs2===0?0:this.r[d.rs2],aluB=c.ALUSrc==='imm'?d.imm:b;
  const aluResult=(d.op==='beq'?a-b:a+aluB)>>>0,equal=a===b,target=(pc+d.imm)>>>0;
  const nextPC=c.Branch&&equal?target:(pc+4)>>>0;if(c.Branch&&equal&&nextPC%4)throw Error('Misaligned branch target');
  let memReadValue=null,memoryWrite=null;if(c.MemRead||c.MemWrite)this.check(aluResult);
  if(c.MemRead)memReadValue=this.memory.getUint32(aluResult,true);
  if(c.MemWrite)memoryWrite={address:aluResult,value:b};
  const value=c.ResultSrc==='memory'?memReadValue:aluResult;
  const registerWrite=c.RegWrite&&d.rd!==0?{register:d.rd,value}:null;
  // Commit selected effects only after decode and access checks succeed.
  if(memoryWrite)this.memory.setUint32(memoryWrite.address,memoryWrite.value,true);
  if(registerWrite)this.r[registerWrite.register]=registerWrite.value;
  this.r[0]=0;this.pc=nextPC;
  return {pc,word,op:d.op,rs1Value:a,rs2Value:b,imm:d.imm,controls:c,aluB,aluResult,memReadValue,equal,target,nextPC,registerWrite,memoryWrite};
 }
}
// addi x5,x0,256; lw x6,0(x5); addi x7,x6,2; sw x7,4(x5);
// beq x6,x7,+8 (not taken); add x10,x6,x7; beq x7,x7,+8 (taken); skipped addi.
const WORDS=[0x10000293,0x0002a303,0x00230393,0x0072a223,0x00730463,0x00730533,0x00738463,0xfff00513];
function demo(){const cpu=new Datapath();cpu.load(WORDS);cpu.memory.setUint32(256,5,true);const trace=[];for(let i=0;i<7;i++)trace.push(cpu.step());return {cpu,trace};}
if(require.main===module){const {cpu,trace}=demo();for(const row of trace)console.log(JSON.stringify({...row,pc:hex(row.pc),word:hex(row.word)}));console.log('a0 = '+cpu.r[10]+', memory[260] = '+cpu.memory.getUint32(260,true)+', nextPC = '+cpu.pc);}
module.exports={decode,Datapath,demo,WORDS};
