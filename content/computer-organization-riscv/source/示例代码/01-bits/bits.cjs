'use strict';
function bits(value,width=8){return (value>>>0).toString(2).slice(-width).padStart(width,'0');}
function binary32(value){const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,value,true);return d.getUint32(0,true);}
if(require.main===module){
  console.log('37 = 0b'+bits(37)+' = 0x'+(37).toString(16));
  console.log('-5 in 8 bits = '+bits(-5));
  console.log('0xAD & 0x0F = '+(0xad&15));
  console.log('binary32(1.5) = 0x'+binary32(1.5).toString(16));
}
module.exports={bits,binary32};
