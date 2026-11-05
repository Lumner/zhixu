'use strict';
const {CPU,hex,fields}=require('../08-mini-rv32/cpu.cjs');
const cpu=new CPU();
// addi x5,x0,3; addi x6,x0,4; add x10,x5,x6; host stop.
cpu.loadWords([0x00300293,0x00400313,0x00628533,0x00100073]);
for(const row of cpu.run())console.log({pc:hex(row.pc),word:hex(row.word),...fields(row.word),op:row.op,write:row.write});
console.log('a0 =',cpu.r[10]);
