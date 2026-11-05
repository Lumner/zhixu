const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
function digest(){const hash=crypto.createHash('sha256'),files=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','reports'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:js|cjs|json|wxml|wxss)$/.test(file))files.push(file);}}
 for(const name of ['miniprogram','cloudfunctions','renderer-probe','tests'])walk(path.join(ROOT,name));
 for(const file of files.sort())hash.update(path.relative(ROOT,file).split(path.sep).join('/')+'\0').update(fs.readFileSync(file));
 return hash.digest('hex');}
module.exports={digest};
