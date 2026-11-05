'use strict';
// Read-only, direct-mapped cache; capacity counts data bytes only.
function simulate(addresses,{capacity=64,lineSize=16}={}){
  if(!Number.isInteger(capacity)||!Number.isInteger(lineSize)||capacity<lineSize||lineSize<1||capacity%lineSize!==0||capacity>1048576)throw Error('Invalid cache geometry');
  const lines=Array(capacity/lineSize).fill(null),trace=[];let hits=0;
  for(const address of addresses){
    if(!Number.isInteger(address)||address<0||address>0xffffffff)throw Error('Invalid byte address');
    const block=Math.floor(address/lineSize),index=block%lines.length,tag=Math.floor(block/lines.length),offset=address%lineSize;
    const hit=lines[index]===tag;if(hit)hits++;else lines[index]=tag;
    trace.push({address,block,index,tag,offset,hit});
  }
  return {trace,hits,misses:addresses.length-hits,hitRate:addresses.length?hits/addresses.length:0};
}
if(require.main===module)console.log(JSON.stringify(simulate([0,4,16,0,64,0]),null,2));
module.exports={simulate};
