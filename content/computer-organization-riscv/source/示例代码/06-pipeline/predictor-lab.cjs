'use strict';
// One logical branch, known target, one counter. Not an integrated speculative CPU/BTB.
function predict(sequence,initial=1,bits=2){
 if(![1,2].includes(bits)||!Number.isInteger(initial)||initial<0||initial>=(1<<bits))throw Error('Invalid counter');
 const outcomes=typeof sequence==='string'?sequence.split(',').map(s=>s.trim()):sequence;
 if(!Array.isArray(outcomes)||outcomes.some(x=>x!=='T'&&x!=='N'))throw Error('Use T or N outcomes');
 let state=initial,wrong=0;const rows=[];
 for(const actual of outcomes){const before=state,guess=state>=(1<<(bits-1))?'T':'N',miss=guess!==actual;if(miss)wrong++;
  state=actual==='T'?Math.min((1<<bits)-1,state+1):Math.max(0,state-1);rows.push({before,guess,actual,miss,after:state});}
 return {bits,initial,state,count:outcomes.length,wrong,rate:outcomes.length?wrong/outcomes.length:null,rows};
}
if(require.main===module)console.log(JSON.stringify(predict(process.argv[2]||'T,T,N,T'),null,2));
module.exports={predict};
