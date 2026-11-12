'use strict';
// Discrete-cycle teaching model, seven RV32I instructions, not HDL or a Ripes replica.
// IF/ID/EX/MEM/WB, in order, separate instruction/data access, WB before ID read.
// ALU operands, branch operands AND store data are consumed/captured at EX.
// No MEM->MEM store-data bypass. Static next-PC prediction is always PC+4.
const sx=(x,n)=>(x<<(32-n))>>(32-n);
function decode(word){
 word>>>=0;const code=word&127,rd=(word>>>7)&31,rs1=(word>>>15)&31,rs2=(word>>>20)&31,f3=(word>>>12)&7,f7=word>>>25;
 let op,imm=0,uses=[];
 if(code===0x33&&f3===0&&(f7===0||f7===32)){op=f7===0?'add':'sub';uses=[rs1,rs2];}
 else if(code===0x13&&f3===0){op='addi';imm=word>>20;uses=[rs1];}
 else if(code===3&&f3===2){op='lw';imm=word>>20;uses=[rs1];}
 else if(code===0x23&&f3===2){op='sw';imm=sx(((word>>>25)<<5)|rd,12);uses=[rs1,rs2];}
 else if(code===0x63&&(f3===0||f3===1)){
  op=f3===0?'beq':'bne';imm=sx(((word>>>31)<<12)|(((word>>>7)&1)<<11)|(((word>>>25)&63)<<5)|(((word>>>8)&15)<<1),13);uses=[rs1,rs2];
 }else throw Error('Unsupported teaching instruction 0x'+word.toString(16));
 return {op,rd,rs1,rs2,imm,uses,write:['add','sub','addi','lw'].includes(op)&&rd!==0};
}
class Pipeline {
 constructor(words,{forwarding=true,registers={},data={}}={}){
  if(typeof forwarding!=='boolean')throw Error('forwarding must be boolean');
  if(words.length>64)throw Error('Teaching code limited to 256 bytes');
  this.code=words.map(w=>w>>>0);this.r=new Uint32Array(32);this.memory=new DataView(new ArrayBuffer(512));
  this.code.forEach((w,i)=>this.memory.setUint32(i*4,w,true));
  for(const [k,v]of Object.entries(registers)){if(!/^\d+$/.test(k)||+k>31)throw Error('Register index');this.r[+k]=v>>>0;}
  this.r[0]=0;for(const [a,v]of Object.entries(data)){this.check(+a);this.memory.setUint32(+a,v>>>0,true);}
  this.forwarding=forwarding;this.pc=0;this.d=null;this.e=null;this.m=null;this.w=null;
  this.cycles=0;this.retired=0;this.stalls=0;this.redirects=0;this.trace=[];this.commits=[];
 }
 check(a){if(!Number.isInteger(a)||a<0||a+4>512||a%4)throw Error('Invalid aligned data address '+a);}
 fetch(){return this.pc>=0&&this.pc%4===0&&this.pc/4<this.code.length?{pc:this.pc,word:this.code[this.pc/4]}:null;}
 active(){return !!(this.fetch()||this.d||this.e||this.m||this.w);}
 operand(reg,captured){
  if(reg===0)return {value:0,from:'x0'};
  if(this.forwarding){
   if(this.m?.write&&this.m.rd===reg){
    if(this.m.op==='lw')throw Error('Load value not available at EX input; missing stall');
    return {value:this.m.value,from:'EX/MEM'};
   }
   if(this.w?.write&&this.w.rd===reg)return {value:this.w.value,from:'MEM/WB'};
  }
  return {value:captured,from:'ID register value'};
 }
 step(){
  if(!this.active())throw Error('Pipeline drained');
  const f=this.fetch(),pcOf=i=>i?i.pc:null;
  const row={cycle:++this.cycles,IF:pcOf(f),ID:pcOf(this.d),EX:pcOf(this.e),MEM:pcOf(this.m),WB:pcOf(this.w),stall:false,flush:[],operands:null,store:null};
  // The older WB write is visible to this cycle's ID register reads.
  if(this.w){
   if(this.w.write)this.r[this.w.rd]=this.w.value>>>0;
   this.retired++;this.commits.push({pc:this.w.pc,op:this.w.op,write:this.w.write?{rd:this.w.rd,value:this.w.value>>>0}:null});
  }
  let nw=null;
  if(this.m){
   nw={...this.m};
   if(this.m.op==='lw'||this.m.op==='sw')this.check(this.m.address);
   if(this.m.op==='lw')nw.value=this.memory.getUint32(this.m.address,true);
   if(this.m.op==='sw'){
    this.memory.setUint32(this.m.address,this.m.storeValue,true);
    row.store={address:this.m.address,value:this.m.storeValue};
   }
  }
  let nm=null,redirect=null;
  if(this.e){
   const i=this.e,a=this.operand(i.rs1,i.a),b=i.uses.includes(i.rs2)&&i.op!=='addi'&&i.op!=='lw'?this.operand(i.rs2,i.b):{value:0,from:'unused'};
   row.operands={a,b};nm={...i};
   if(i.op==='add')nm.value=(a.value+b.value)>>>0;
   else if(i.op==='sub')nm.value=(a.value-b.value)>>>0;
   else if(i.op==='addi')nm.value=(a.value+i.imm)>>>0;
   else if(i.op==='lw'||i.op==='sw'){nm.address=(a.value+i.imm)>>>0;nm.storeValue=b.value;}
   else {
    const taken=i.op==='beq'?a.value===b.value:a.value!==b.value;
    const actual=taken?(i.pc+i.imm)>>>0:(i.pc+4)>>>0;
    if(taken&&actual%4)throw Error('Misaligned branch target');
    row.branch={taken,predictedNext:i.pc+4,actualNext:actual};
    if(actual!==i.pc+4)redirect=actual;
   }
  }
  let ne=null,nd=null;
  if(redirect!==null){
   row.flush=[this.d,f].filter(Boolean).map(i=>i.pc);row.redirect=redirect;
   this.pc=redirect;this.redirects++;
  }else{
   const di=this.d?decode(this.d.word):null;
   const reads=di?di.uses.filter(r=>r!==0):[];
   const matches=i=>i?.write&&reads.includes(i.rd);
   const stall=di&&(this.forwarding?(this.e?.op==='lw'&&matches(this.e)):(matches(this.e)||matches(this.m)));
   if(stall){row.stall=true;this.stalls++;nd=this.d;}
   else{
    if(di)ne={...this.d,...di,a:this.r[di.rs1],b:this.r[di.rs2]};
    nd=f;if(f)this.pc=(this.pc+4)>>>0;
   }
  }
  this.r[0]=0;this.w=nw;this.m=nm;this.e=ne;this.d=nd;this.trace.push(row);return row;
 }
 run(limit=1000){
  if(!Number.isInteger(limit)||limit<1)throw Error('Invalid cycle limit');
  while(this.active()){if(this.cycles>=limit)throw Error('Cycle limit exceeded');this.step();}
  return this;
 }
}
// Fixture field builders, NOT a general assembler. Official RARS checks these independently.
const I=(n,a,rd,code=0x13)=>(((n&4095)<<20)|(a<<15)|((code===3?2:0)<<12)|(rd<<7)|code)>>>0;
const R=(a,b,rd,sub=false)=>(((sub?32:0)<<25)|(b<<20)|(a<<15)|(rd<<7)|0x33)>>>0;
const S=(n,a,b)=>((((n>>5)&127)<<25)|(b<<20)|(a<<15)|(2<<12)|((n&31)<<7)|0x23)>>>0;
const B=(n,a,b,ne=false)=>((((n>>12)&1)<<31)|(((n>>5)&63)<<25)|(b<<20)|(a<<15)|((ne?1:0)<<12)|(((n>>1)&15)<<8)|(((n>>11)&1)<<7)|0x63)>>>0;
const kernel=(asm,words,data={256:7})=>({asm,words,data});
const KERNELS={
 independent:kernel(['addi x5,x0,1','addi x6,x0,2','addi x7,x0,3'],[I(1,0,5),I(2,0,6),I(3,0,7)]),
 alu:kernel(['addi x5,x0,3','add x6,x5,x5','sub x10,x6,x5'],[I(3,0,5),R(5,5,6),R(6,5,10,true)]),
 priority:kernel(['addi x5,x0,1','addi x5,x5,1','add x10,x5,x0'],[I(1,0,5),I(1,5,5),R(5,0,10)]),
 load:kernel(['addi x5,x0,256','lw x6,0(x5)','add x10,x6,x6'],[I(256,0,5),I(0,5,6,3),R(6,6,10)]),
 unscheduled:kernel(['addi x5,x0,256','lw x6,0(x5)','add x7,x6,x6','addi x30,x30,1','sub x10,x7,x6'],[I(256,0,5),I(0,5,6,3),R(6,6,7),I(1,30,30),R(7,6,10,true)]),
 scheduled:kernel(['addi x5,x0,256','lw x6,0(x5)','addi x30,x30,1','add x7,x6,x6','sub x10,x7,x6'],[I(256,0,5),I(0,5,6,3),I(1,30,30),R(6,6,7),R(7,6,10,true)]),
 store:kernel(['addi x5,x0,256','lw x6,0(x5)','sw x6,4(x5)','lw x10,4(x5)'],[I(256,0,5),I(0,5,6,3),S(4,5,6),I(4,5,10,3)]),
 taken:kernel(['addi x5,x0,256','addi x6,x0,1','beq x6,x6,target','sw x0,0(x5)','addi x10,x0,99','target: lw x10,0(x5)'],[I(256,0,5),I(1,0,6),B(12,6,6),S(0,5,0),I(99,0,10),I(0,5,10,3)],{256:123}),
 untaken:kernel(['addi x5,x0,256','addi x6,x0,1','beq x6,x0,target','sw x0,0(x5)','addi x10,x0,99','target: lw x10,0(x5)'],[I(256,0,5),I(1,0,6),B(12,6,0),S(0,5,0),I(99,0,10),I(0,5,10,3)],{256:123}),
 loadBranch:kernel(['addi x5,x0,256','lw x6,0(x5)','beq x6,x0,target','addi x10,x0,99','sw x0,0(x5)','target: addi x11,x0,7'],[I(256,0,5),I(0,5,6,3),B(12,6,0),I(99,0,10),S(0,5,0),I(7,0,11)],{256:0}),
 loop:kernel(['addi x5,x0,3','addi x10,x0,0','loop: addi x10,x10,1','addi x5,x5,-1','bne x5,x0,loop'],[I(3,0,5),I(0,0,10),I(1,10,10),I(-1,5,5),B(-8,5,0,true)]),
 zero:kernel(['addi x0,x0,7','add x10,x0,x0'],[I(7,0,0),R(0,0,10)]),
 falseSource:kernel(['addi x5,x0,256','lw x6,0(x5)','addi x10,x0,6'],[I(256,0,5),I(0,5,6,3),I(6,0,10)])
};
function simulate(name,forwarding=true){const k=KERNELS[name];if(!k)throw Error('Unknown kernel '+name);return new Pipeline(k.words,{data:k.data,forwarding}).run();}
if(require.main===module){
 const name=process.argv[2]||'load',p=simulate(name,process.argv[3]!=='no-forward');
 console.table(p.trace.map(t=>({cycle:t.cycle,IF:t.IF,ID:t.ID,EX:t.EX,MEM:t.MEM,WB:t.WB,stall:t.stall,flush:t.flush.join(',')})));
 console.log(JSON.stringify({kernel:name,cycles:p.cycles,retired:p.retired,stalls:p.stalls,redirects:p.redirects,a0:p.r[10],memory256:p.memory.getUint32(256,true)}));
}
module.exports={Pipeline,decode,KERNELS,simulate,I,R,S,B};
