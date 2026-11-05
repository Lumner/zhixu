const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname,'..');
function digest() {
  const files = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
      if (['node_modules','reports','.git','__pycache__'].includes(item.name)) continue;
      const file = path.join(dir,item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.(?:ts|js|cjs|json)$/.test(item.name)) files.push(file);
    }
  }
  walk(ROOT); const hash = crypto.createHash('sha256');
  for (const file of files.sort()) hash.update(path.relative(ROOT,file).split(path.sep).join('/')+'\0').update(fs.readFileSync(file));
  return hash.digest('hex');
}
module.exports = { digest };
