'use strict';
const {hex}=require('./cpu.cjs'),{sumCPU}=require('./program.cjs');
const cpu=sumCPU(),trace=cpu.run();
for(const row of trace)console.log(hex(row.pc),hex(row.word),row.op,
  row.write?'x'+row.write.register+'='+hex(row.write.value):'',
  row.memory?JSON.stringify(row.memory):'');
console.log(JSON.stringify({sum:cpu.r[10]|0,pointer:hex(cpu.r[5]),remaining:cpu.r[6],stepsIncludingHostStop:cpu.steps}));
