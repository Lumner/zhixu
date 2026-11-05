'use strict';
// Author-side numeric QA for the detailed stage 1, not a required beginner task.
const assert=require('node:assert/strict');
const scenarios=[];
function check(name,fn){fn();scenarios.push(name);}
const b8=n=>(n&255).toString(2).padStart(8,'0');
function i32(value,little=true){const bytes=Buffer.alloc(4);if(little)bytes.writeInt32LE(value);else bytes.writeInt32BE(value);return bytes;}
check('assignment reads old values and does not auto-recalculate',()=>{let a=3,b=4,s=a+b;a=10;assert.equal(s,7);s=a+b;assert.equal(s,14);});
check('paper exercise A B S sequence',()=>{let a=6,b=2,s=a-b;b=5;assert.deepEqual([a,b,s],[6,5,4]);s=a-b;a=a+1;assert.deepEqual([a,b,s],[7,5,1]);});
check('five-element cumulative states',()=>{let total=0;const trace=[3,-2,7,0,4].map(x=>(total+=x));assert.deepEqual(trace,[3,1,8,8,12]);});
check('binary examples checked by parsing and formatting',()=>{assert.equal(parseInt('1101',2),13);assert.equal(parseInt('00101101',2),45);assert.equal(b8(22),'00010110');assert.equal(b8(37),'00100101');assert.equal(b8(202),'11001010');});
check('hexadecimal positional examples',()=>{assert.equal(0x25,37);assert.equal(0xad,173);assert.equal(0x3c,60);assert.equal(0x123,291);assert.equal(0x1000,4096);});
check('binary addition and fixed-width truncation',()=>{assert.equal(b8(13+7),'00010100');assert.equal((15+1).toString(2),'10000');assert.equal((15+1)&15,0);assert.equal((255+1)&255,0);});
check('unsigned pattern counts and maxima',()=>{assert.equal(2**5,32);assert.equal(2**12-1,4095);assert.equal(2**32-1,4294967295);});
check('all quoted bitwise and mask examples',()=>{assert.equal(10&12,8);assert.equal(10|12,14);assert.equal(10^12,6);assert.equal(0xad&15,13);assert.equal(9|4,13);assert.equal(13^4,9);assert.equal(13&0xfb,9);});
check('8-bit shifts and discarded bits',()=>{assert.equal(b8(0x81<<1),'00000010');assert.equal(b8(0x81>>>1),'01000000');assert.equal(b8(0x80<<1),'00000000');assert.equal(b8(37<<1),'01001010');});
check('storage and transmission unit arithmetic',()=>{assert.equal(5*32,160);assert.equal(5*32/8,20);assert.equal(2*1024,2048);assert.equal(16/8,2);assert.equal(2**32/(1024**3),4);});
check('two complement encodings cross-checked with Buffer',()=>{const bytes=Buffer.alloc(1);for(const [value,code]of [[-5,0xfb],[-13,0xf3],[-128,0x80],[-2,0xfe]]){bytes.writeInt8(value);assert.equal(bytes[0],code);assert.equal(bytes.readInt8(),value);}assert.equal(Buffer.from([0x85]).readInt8(),-123);assert.equal(Buffer.from([0xf0]).readInt8(),-16);});
check('signed 8-bit boundaries enforced independently',()=>{const bytes=Buffer.alloc(1);assert.throws(()=>bytes.writeInt8(128),RangeError);assert.throws(()=>bytes.writeInt8(-129),RangeError);});
check('signed mixed addition and subtraction examples',()=>{assert.equal(Buffer.from([(0xfe+7)&255]).readInt8(),5);assert.equal(Buffer.from([(5+0xfe)&255]).readInt8(),3);assert.equal(Buffer.from([(19+0xf9)&255]).readInt8(),12);assert.equal(Buffer.from([(5+0xf7)&255]).readInt8(),-4);assert.equal(Buffer.from([(100+60)&255]).readInt8(),-96);});
check('carry and signed overflow table independently classified',()=>{for(const [a,b,low,carry,overflow]of [[0x7f,1,0x80,false,true],[0xff,1,0,true,false],[0x80,0x80,0,true,true],[0xff,0xff,0xfe,true,false]]){const signedA=Buffer.from([a]).readInt8(),signedB=Buffer.from([b]).readInt8(),sum=signedA+signedB;assert.equal((a+b)&255,low);assert.equal(a+b>255,carry);assert.equal(sum < -128 || sum>127,overflow);}});
check('sign extension and zero extension differ',()=>{assert.equal(i32(Buffer.from([0xfb]).readInt8()).toString('hex'),'fbffffff');assert.equal(i32(0xfb).toString('hex'),'fb000000');assert.equal(i32(-128).readUInt32LE(),0xffffff80);});
check('negative arithmetic shift differs from truncating division',()=>{assert.equal(-8>>1,-4);assert.equal(-3>>1,-2);assert.equal(Math.trunc(-3/2),-1);assert.equal(0xf8>>>1,124);});
check('little and big endian known words',()=>{assert.equal(i32(0x12345678).toString('hex'),'78563412');assert.equal(i32(0x01020304).toString('hex'),'04030201');assert.equal(i32(0x01020304,false).toString('hex'),'01020304');assert.equal(Buffer.from([0,1,0,0]).readUInt32LE(),256);});
check('read modify write changes memory only after store',()=>{const memory=i32(42);let value=memory.readInt32LE();value++;assert.equal(memory.readInt32LE(),42);memory.writeInt32LE(value);assert.equal(memory.toString('hex'),'2b000000');});
check('UTF-8 and ASCII examples',()=>{assert.equal(Buffer.from('A').toString('hex'),'41');assert.equal(Buffer.from('中').toString('hex'),'e4b8ad');assert.equal(Buffer.from('A中').length,4);assert.equal(Buffer.from('42').toString('hex'),'3432');assert.equal(Buffer.from('0')[0],0x30);assert.equal(Buffer.from('RISC-V').toString('hex'),'524953432d56');assert.equal(Buffer.byteLength('RISC-V')+1,7);});
check('array byte layout and address endpoints',()=>{const memory=Buffer.concat([3,-2,7,0,4].map(x=>i32(x)));assert.equal(memory.toString('hex'),'03000000feffffff070000000000000004000000');assert.equal(memory.length,20);assert.equal(0x1000+memory.length-1,0x1013);assert.equal(0x1000+memory.length,0x1014);assert.equal(0x2000+4*4,0x2010);});
check('single byte versus four-byte signed interpretation',()=>{const memory=i32(-2);assert.equal(memory.readUInt8(0),254);assert.equal(memory.readInt32LE(0),-2);});
check('one-byte mutation changes the second integer and sum',()=>{const memory=Buffer.concat([3,-2,7,0,4].map(x=>i32(x)));memory[4]=255;assert.equal(memory.readInt32LE(4),-1);let sum=0;for(let offset=0;offset<memory.length;offset+=4)sum+=memory.readInt32LE(offset);assert.equal(sum,13);assert.equal(memory.readUInt8(4),255);});
console.log(JSON.stringify({date:'2026-11-04',edition:'detailed-rewrite-stage1',chapters:[1,2,3,4],passed:scenarios.length,scope:'Author-side paper-example arithmetic and byte encoding QA; no RARS/Ripes execution',scenarios},null,2));
