const fs = require('node:fs'), path = require('node:path');
function filesUnder(root) { return fs.readdirSync(root,{withFileTypes:true}).flatMap(item => item.isDirectory() ? filesUnder(path.join(root,item.name)) : [path.join(root,item.name)]); }
const posix = value => value.split(path.sep).join('/');
function pageCatalog(config) { return [...config.pages, ...(config.subpackages || config.subPackages || []).flatMap(pkg => pkg.pages.map(page => pkg.root.replace(/\/$/,'') + '/' + page))]; }
function inspect(project) {
  const root=path.join(project,'miniprogram'),config=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
  const packages=config.subpackages || config.subPackages || [],pages=pageCatalog(config);
  if(new Set(pages).size!==pages.length)throw new Error('Duplicate page path');
  const roots=packages.map(pkg=>pkg.root.replace(/\/$/,''));
  for(const pkg of packages) if(pkg.independent===true)throw new Error('This teaching package imports main modules and must be normal');
  for(const page of pages) for(const extension of ['.js','.json','.wxml','.wxss']) if(!fs.existsSync(path.join(root,page+extension)))throw new Error('Missing page '+page+extension);
  for(const tab of config.tabBar.list)if(!config.pages.includes(tab.pagePath))throw new Error('Tab page must remain in main package');
  const groups={main:{files:0,rawBytes:0}};for(const name of roots)groups[name]={files:0,rawBytes:0};
  for(const file of filesUnder(root)) {
    const relative=posix(path.relative(root,file)),group=roots.find(name=>relative.startsWith(name+'/')) || 'main';
    groups[group].files++;groups[group].rawBytes+=fs.statSync(file).size;
    if(path.extname(file)!=='.js')continue;
    const source=fs.readFileSync(file,'utf8');
    for(const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g))if(match[1].startsWith('.')) {
      let target=path.resolve(path.dirname(file),match[1]);if(!path.extname(target))target+='.js';
      if(!fs.existsSync(target))throw new Error('Missing module '+relative+' -> '+match[1]);
      const destination=posix(path.relative(root,target));
      if(group==='main'&&roots.some(name=>destination.startsWith(name+'/')))throw new Error('Main package requires subpackage module');
    }
    for(const match of source.matchAll(/(?:url|path):\s*['"](\/[^'"]+)['"]/g)) {
      const route=match[1].split('?')[0].slice(1);
      if(route.startsWith('pages/')||roots.some(name=>route.startsWith(name+'/')))if(!pages.includes(route))throw new Error('Unregistered route '+route);
    }
  }
  return { groups,pageCount:pages.length,mainPages:config.pages.length,subpackagePages:pages.length-config.pages.length,
    note:'源码树原始字节；不等于开发者工具编译、压缩、上传或微信实际下载包。云函数/server/tools不计入客户端清单。' };
}
module.exports={inspect,pageCatalog};
