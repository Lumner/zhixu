// 用 Node 标准库生成固定公开封面，无字体库/网络/用户数据依赖。
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const W = 600, H = 480, pixels = Buffer.alloc(W * H * 3);
function rect(x, y, w, h, color) {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
      const offset = (yy * W + xx) * 3;
      for (let c = 0; c < 3; c++) pixels[offset + c] = color[c];
    }
  }
}
const green = [22, 121, 75], ink = [38, 63, 52], pale = [223, 236, 228];
rect(0, 0, W, H, [240, 247, 243]); rect(32, 32, 536, 416, [255, 255, 255]);
const glyphs = {
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110']
};
function text(value, y, scale, color) {
  let x = Math.round((W - (value.length * 6 - 1) * scale) / 2);
  for (const char of value) {
    if (glyphs[char]) glyphs[char].forEach((row, yy) => [...row].forEach((bit, xx) => {
      if (bit === '1') rect(x + xx * scale, y + yy * scale, scale, scale, color);
    }));
    x += 6 * scale;
  }
}
text('STUDY HUB', 80, 6, ink);
for (const y of [190, 250, 310]) rect(86, y, 428, 2, pale);
const bars = [0, 24, 8, 0, 0, 120, 16];
bars.forEach((height, i) => { if (height) rect(98 + i * 60, 310 - height, 36, height, green); rect(98 + i * 60, 326, 36, 5, pale); });
text('DEMO', 378, 5, green);
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), joined = Buffer.concat([name, data]); let crc = 0xffffffff;
  for (const byte of joined) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, joined, checksum]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const scanlines = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) pixels.copy(scanlines, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
const target = path.join(__dirname, '../miniprogram/assets/public-study-card.png');
fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, png);
console.log(JSON.stringify({ width: W, height: H, bytes: png.length, publicOnly: true }));
