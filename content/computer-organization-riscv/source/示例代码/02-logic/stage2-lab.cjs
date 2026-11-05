'use strict';
// Optional paper-example model. No transistor, HDL, timing or physical-device simulation.
const {fullAdder,simultaneous}=require('./logic.cjs');
function integer(value,min,max,name){if(!Number.isInteger(value)||value<min||value>max)throw Error('Invalid '+name);return value;}
function bit(value){return integer(value,0,1,'bit');}
function word4(value){return integer(value,0,15,'4-bit value');}
function gates(a,b){bit(a);bit(b);return {and:a&b,or:a|b,xor:a^b,nand:1-(a&b),nor:1-(a|b),xnor:1-(a^b)};}
function mux4(a,b,select){word4(a);word4(b);bit(select);return select===0?a:b;}
function decode2(code){integer(code,0,3,'decoder input');return [0,1,2,3].map(i=>Number(i===code));}
function addSub4(a,b,subtract=0){
  word4(a);word4(b);bit(subtract);let carry=subtract,result=0;const trace=[];
  for(let i=0;i<4;i++){
    const ai=(a>>>i)&1,bi=((b>>>i)&1)^subtract,cin=carry,next=fullAdder(ai,bi,cin);
    result|=next.sum<<i;carry=next.carry;trace.push({bit:i,ai,biAfterControl:bi,cin,sum:next.sum,cout:carry});
  }
  return {result,carry,trace};
}
function alu4(a,b,op){word4(a);word4(b);integer(op,0,3,'ALU operation');return op<2?addSub4(a,b,op).result:op===2?a&b:a|b;}
function registerNext(q,d,enable,reset){word4(q);word4(d);bit(enable);bit(reset);return reset?0:enable?d:q;}
function multiplyTrace(a,b){
  word4(a);word4(b);let product=0;const trace=[];
  for(let i=0;i<4;i++){const selected=(b>>>i)&1,addend=selected?a*(2**i):0;product+=addend;trace.push({bit:i,selected,addend,product});}
  return {product,trace};
}
function divideTrace(dividend,divisor){
  integer(dividend,0,255,'8-bit dividend');integer(divisor,1,255,'nonzero divisor');
  let remainder=0,quotient=0;const trace=[];
  for(const digit of dividend.toString(2)){
    const inputBit=Number(digit),before=remainder,afterBring=remainder*2+inputBit,quotientBit=Number(afterBring>=divisor);
    remainder=afterBring-(quotientBit?divisor:0);quotient=quotient*2+quotientBit;
    trace.push({inputBit,before,afterBring,quotientBit,remainder});
  }
  return {quotient,remainder,trace};
}
function binary32(value){
  if(typeof value!=='number')throw Error('Expected numeric input');
  const bytes=Buffer.alloc(4);bytes.writeFloatLE(value);const word=bytes.readUInt32LE();
  return {value:bytes.readFloatLE(),hex:word.toString(16).padStart(8,'0'),littleEndian:bytes.toString('hex'),s:word>>>31,E:(word>>>23)&255,F:word&0x7fffff};
}
if(require.main===module){
  console.log('MUX A=10 B=6:',[0,1].map(s=>({s,result:mux4(10,6,s)})));
  console.log('Decoder 10:',decode2(2));
  console.log('4-bit 5+3:',JSON.stringify(addSub4(5,3),null,2));
  console.log('4-bit 3-5:',JSON.stringify(addSub4(3,5,1),null,2));
  console.log('ALU A=5 B=3:',[0,1,2,3].map(op=>({op,result:alu4(5,3,op)})));
  console.log('Simultaneous state:',simultaneous(1,0,3));
  console.log('13*11:',JSON.stringify(multiplyTrace(13,11),null,2));
  console.log('25/3:',JSON.stringify(divideTrace(25,3),null,2));
  for(const value of [1.5,2.5,-2.5,0.5,0.1])console.log('binary32:',binary32(value));
  const f=Math.fround,a=2**24,b=1,c=-(2**24);
  console.log('Each operation binary32:',{left:f(f(a+b)+c),right:f(a+f(b+c))});
}
module.exports={gates,mux4,decode2,addSub4,alu4,registerNext,multiplyTrace,divideTrace,binary32};
