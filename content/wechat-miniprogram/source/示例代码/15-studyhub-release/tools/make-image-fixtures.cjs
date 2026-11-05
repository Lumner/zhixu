const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const table = Array.from({ length:256 }, (_,i) => { let x=i; for(let n=0;n<8;n++) x=x&1?0xedb88320^(x>>>1):x>>>1; return x>>>0; });
function chunk(name,data) { const body=Buffer.concat([Buffer.from(name),data]); let crc=0xffffffff;
  for(const byte of body) crc=table[(crc^byte)&255]^(crc>>>8);
  const size=Buffer.alloc(4),end=Buffer.alloc(4);size.writeUInt32BE(data.length);end.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,body,end]); }
function png(width,height) { const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
  const raw=Buffer.alloc(height*(width*3+1));
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) { const at=y*(width*3+1)+1+x*3;
    const stripe=(Math.floor(x/Math.max(1,width/12))+Math.floor(y/Math.max(1,height/8)))%2;
    raw[at]=stripe?22:225;raw[at+1]=stripe?121:236;raw[at+2]=stripe?75:228;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]); }
const folder=path.join(__dirname,'../miniprogram/packageLab/assets');fs.mkdirSync(folder,{recursive:true});
const result=[];for(const [name,width,height] of [['small',160,120],['large',1280,960]]) { const data=png(width,height);fs.writeFileSync(path.join(folder,'fixture-'+name+'.png'),data);result.push({name,width,height,pngBytes:data.length,rgba8EstimateBytes:width*height*4}); }
console.log(JSON.stringify(result));
