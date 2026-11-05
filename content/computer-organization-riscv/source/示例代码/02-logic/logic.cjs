'use strict';
function fullAdder(a,b,cin){return {sum:a^b^cin,carry:(a&b)|(cin&(a^b))};}
function add4(a,b){
  let result=0,carry=0;
  for(let bit=0;bit<4;bit++){
    const next=fullAdder((a>>>bit)&1,(b>>>bit)&1,carry);
    result|=next.sum<<bit;carry=next.carry;
  }
  return {result,carry};
}
function simultaneous(a,b,rounds){
  const trace=[];
  for(let i=0;i<rounds;i++){const nextA=a+1,nextB=a;a=nextA;b=nextB;trace.push({a,b});}
  return trace;
}
if(require.main===module){
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let cin=0;cin<2;cin++)console.log({a,b,cin,...fullAdder(a,b,cin)});
  console.log('7+1:',add4(7,1));
  console.log('A_next=A+1, B_next=A:',simultaneous(1,0,3));
}
module.exports={fullAdder,add4,simultaneous};
