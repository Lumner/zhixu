'use strict';
const {CPU}=require('./cpu.cjs');
// Hand-encoded RV32I machine words. Addresses below are byte addresses.
const WORDS=[
  0x10000293, // 00: addi x5,x0,256  (data base)
  0x00500313, // 04: addi x6,x0,5    (patched length below)
  0x00000513, // 08: addi x10,x0,0
  0x00030c63, // 0c: beq x6,x0,+24 -> 0x24
  0x0002a383, // 10: lw x7,0(x5)
  0x00750533, // 14: add x10,x10,x7
  0x00428293, // 18: addi x5,x5,4
  0xfff30313, // 1c: addi x6,x6,-1
  0xfedff06f, // 20: jal x0,-20 -> 0x0c
  0x00100073  // 24: ebreak, host stop in this model
];
function sumCPU(values=[3,-2,7,0,4]) {
  if(!Array.isArray(values)||values.length>16||!values.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647))throw Error('Expected at most 16 int32 values');
  const cpu=new CPU(), words=WORDS.slice();
  words[1]=((values.length<<20)|0x313)>>>0;
  cpu.loadWords(words);
  values.forEach((v,i)=>cpu.memory.setInt32(0x100+i*4,v,true));
  return cpu;
}
module.exports={WORDS,sumCPU};
