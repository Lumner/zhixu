const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Marked,Renderer}=require('marked'),hljs=require('highlight.js'),{diagram,escape}=require('./diagrams.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'dist');
const ignored=new Set(['node_modules','.git','__pycache__','.build','.cache']);
const allowed=file=>!ignored.has(path.basename(file))&&!path.basename(file).startsWith('.env')&&!/\.(?:log|pem|key|p12|pfx|vvp|vcd|fst)$/i.test(file)&&path.basename(file)!=='project.private.config.json';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{const file=path.join(dir,item.name);if(!allowed(file))return[];if(item.isSymbolicLink())throw Error('Symlink not supported: '+file);return item.isDirectory()?walk(file):[file];});
const json=file=>JSON.parse(fs.readFileSync(file,'utf8')),relative=(root,file)=>path.relative(root,file).split(path.sep).join('/');
const slug=text=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s+/g,'-')||'section';
function stageOf(rel){
  const match=rel.match(/第([一二三四五六七八九十百\d]+)阶段/);if(!match)return null;
  if(/^\d+$/.test(match[1]))return Number(match[1]);
  const digits={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};let result=0,last=0;
  for(const char of match[1]){if(char==='十'||char==='百'){result+=(last||1)*(char==='十'?10:100);last=0;}else last=digits[char]||0;}return result+last;
}
const serialize=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function write(file,body){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
function copy(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
function kindOf(rel){
  if(rel.startsWith('最终综合实践'))return'capstone';
  if(rel.includes('验证/'))return'validation';
  if(rel.includes('示例代码/'))return'project';
  if(rel.includes('完整源码附录'))return'code';
  if(rel.includes('练习与参考答案'))return'exercise';
  if(/验收|清单|测量记录/.test(rel))return'checklist';
  return'reference';
}
function renderDocument(course,doc,lookup){
  const toc=[],ids=new Map();let codeIndex=0;
  const renderer=new Renderer(),baseTable=Renderer.prototype.table;
  function destination(href,image=false){
    if(/^https?:\/\//i.test(href))return {href,external:true};
    if(/^mailto:/i.test(href)&&!image)return{href,external:true};
    if(href.startsWith('#')){try{return{heading:decodeURIComponent(href.slice(1))};}catch(_){return null;}}
    if(/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith('//'))return null;
    let raw,anchor;try{const parts=href.split('#');raw=decodeURIComponent(parts[0]);anchor=parts[1]?decodeURIComponent(parts[1]):'';}catch(_){return null;}
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(doc.relative),raw));
    if(target==='..'||target.startsWith('../')||path.posix.isAbsolute(target))return null;
    const other=lookup.get(target);
    if(other&&!image)return{href:'#/learn/'+course.id+'/'+other.id+(anchor?'?section='+encodeURIComponent(anchor):'')};
    if(target==='README.md'&&!image)return{href:'#/course/'+course.id};
    const full=path.resolve(course.sourcePath,...target.split('/'));
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())return null;
    return{href:'files/'+course.id+'/'+target.split('/').map(encodeURIComponent).join('/')+(anchor?'#'+encodeURIComponent(anchor):''),download:!image};
  }
  renderer.heading=function({tokens,depth}){const content=this.parser.parseInline(tokens),plain=content.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');const name=slug(plain),seen=ids.get(name)||0;ids.set(name,seen+1);const id=name+(seen?'-'+seen:'');if(depth<=3)toc.push({id,text:plain,level:depth});return'<h'+depth+' id="'+escape(id)+'">'+content+'</h'+depth+'>\n';};
  renderer.link=function({href,title,tokens}){const text=this.parser.parseInline(tokens),url=destination(href);if(!url)return text;if(url.heading)return'<a href="#" data-heading="'+escape(url.heading)+'">'+text+'</a>';return'<a href="'+escape(url.href)+'"'+(url.external?' target="_blank" rel="noopener noreferrer"':'')+(url.download?' download':'')+(title?' title="'+escape(title)+'"':'')+'>'+text+'</a>';};
  renderer.image=function({href,text,title}){const url=destination(href,true);if(!url)return'<span>'+escape(text)+'</span>';return'<img src="'+escape(url.href)+'" alt="'+escape(text)+'" loading="lazy"'+(title?' title="'+escape(title)+'"':'')+'>';};
  renderer.html=({text})=>escape(text);
  renderer.table=function(token){return'<div class="table-scroll" tabindex="0">'+baseTable.call(this,token)+'</div>';};
  renderer.code=function({text,lang}){const label=(lang||'text').split(/\s/)[0],language=({js:'javascript',cjs:'javascript',ts:'typescript',wxml:'xml',wxss:'css',ps1:'powershell',sh:'bash',sv:'verilog',systemverilog:'verilog'})[label]||label;let html=escape(text);if(text.length<25000&&hljs.getLanguage(language))html=hljs.highlight(text,{language,ignoreIllegals:true}).value;const code='<figure class="code-block"><figcaption><span>'+escape(label)+'</span><button type="button" data-copy aria-label="复制代码"><span class="copy-label">复制</span></button></figcaption><pre><code class="hljs language-'+escape(language)+'">'+html+'</code></pre></figure>';if(label==='mermaid'){const svg=diagram(text,doc.id+'-'+(++codeIndex));if(svg)return'<figure class="diagram-block"><div class="diagram-caption">图解</div><div class="diagram-scroll">'+svg+'</div><details><summary>查看图表代码</summary>'+code+'</details></figure>';}return code;};
  const marked=new Marked({renderer,gfm:true,breaks:false});
  const body=doc.markdown.replace(/^#\s+[^\r\n]+\r?\n/,'');
  const html=marked.parse(body);
  return{version:1,courseId:course.id,id:doc.id,title:doc.title,kind:doc.kind,number:doc.number,group:doc.group,relative:doc.relative,html,toc,raw:'files/'+course.id+'/'+doc.relative.split('/').map(encodeURIComponent).join('/'),characters:doc.markdown.length,minutes:Math.max(3,Math.ceil(doc.markdown.length/650))};
}
function generateSite(OUT){
  const site=json(path.join(ROOT,'site.config.json'));
  // 只写入本次在项目缓存内创建的目录；失败时不触碰现有dist。
  if(path.dirname(OUT)!==path.join(ROOT,'.cache')||!/^site-build-/.test(path.basename(OUT)))throw Error('Unexpected output directory');
  if(fs.existsSync(OUT)&&fs.lstatSync(OUT).isSymbolicLink())throw Error('Output cannot be a symlink');
  const courses=[],search=[],diagnostics={courses:0,chapters:0,documents:0,rawFiles:0,diagrams:0,brokenMarkdownLinks:[]};
  for(const entry of fs.readdirSync(path.join(ROOT,'content'),{withFileTypes:true})){
    if(!entry.isDirectory())continue;const home=path.join(ROOT,'content',entry.name),metaPath=path.join(home,'course.json');if(!fs.existsSync(metaPath))continue;
    const meta=json(metaPath);
    if(!/^[a-z0-9][a-z0-9-]{1,60}$/.test(meta.id)||courses.some(c=>c.id===meta.id))throw Error('Invalid/duplicate course ID');
    if(!site.categories.some(c=>c.id===meta.category))throw Error('Unknown category: '+meta.category);
    const sourcePath=path.resolve(home,meta.source||'source');if(!sourcePath.startsWith(home+path.sep))throw Error('Source outside course');
    const files=walk(sourcePath),documents=[];
    const explicit=meta.chapters?new Map(meta.chapters.map((c,i)=>[c.file,{...c,number:c.number===undefined?i+1:c.number}])):null;
    for(const file of files){
      const rel=relative(sourcePath,file);copy(file,path.join(OUT,'files',meta.id,rel));diagnostics.rawFiles++;
      if(!file.endsWith('.md')||rel==='README.md'||path.basename(rel).startsWith('微信小程序开发教程-'))continue;
      const md=fs.readFileSync(file,'utf8'),top=!rel.includes('/'),numbered=top&&/^(\d{2})-/.exec(rel),chapter=explicit?explicit.get(rel):numbered&&Number(numbered[1])<99?{id:numbered[1],number:Number(numbered[1])}:null;
      const kind=chapter?(chapter.number===0?'guide':'chapter'):kindOf(rel),id=chapter?.id||(numbered?numbered[1]:'d-'+crypto.createHash('sha1').update(rel).digest('hex').slice(0,12));
      if(!/^[a-z0-9-]+$/.test(id)||documents.some(d=>d.id===id))throw Error('Invalid/duplicate document ID: '+id);
      const title=chapter?.title||(md.match(/^#\s+(.+)$/m)?.[1]||path.basename(rel,'.md')).replace(/^\d{2}\s+/,'');
      const group=chapter?.group||(chapter?meta.groups?.find(g=>g.range&&chapter.number>=g.range[0]&&chapter.number<=g.range[1])?.id:null)||null;
      documents.push({id,title,kind,group,number:chapter?.number??null,stage:stageOf(rel),relative:rel,markdown:md});
    }
    if(explicit)for(const file of explicit.keys())if(!documents.some(d=>d.relative===file))throw Error('Chapter missing: '+file);
    documents.sort((a,b)=>(a.number??1000)-(b.number??1000)||(a.stage??1000)-(b.stage??1000)||a.relative.localeCompare(b.relative,'zh',{numeric:true}));
    const course={...meta,sourcePath},lookup=new Map(documents.map(d=>[d.relative,d]));
    for(const doc of documents){
      const payload=renderDocument(course,doc,lookup);
      write(path.join(OUT,'data','content',meta.id,doc.id+'.js'),'window.TutorialContent.register('+serialize(meta.id+'/'+doc.id)+','+serialize(payload)+');\n');
      diagnostics.diagrams+=(payload.html.match(/class="course-diagram/g)||[]).length;
      const blocks=doc.markdown.split(/(?=^#{1,3}\s)/m);
      if(['code','project','validation'].includes(doc.kind)){search.push({courseId:meta.id,docId:doc.id,title:doc.title,heading:'',text:doc.title,kind:doc.kind});}
      else for(const block of blocks){const heading=(block.match(/^#{1,3}\s+(.+)/)||[])[1]||doc.title;search.push({courseId:meta.id,docId:doc.id,title:doc.title,heading,text:block.replace(/```[\w-]*/g,'').replace(/[#*>|]/g,'').trim(),kind:doc.kind});}
    }
    const lessons=documents.filter(d=>d.kind==='chapter').length;
    if(meta.stats?.chapters!==undefined&&meta.stats.chapters!==lessons)throw Error('Chapter count mismatch');
    const cleanDocs=documents.map(({markdown,...d})=>d);
    let download=null;if(meta.download){const file=path.resolve(home,meta.download);if(!file.startsWith(home+path.sep)||!fs.existsSync(file))throw Error('Missing download: '+meta.id+' / '+meta.download+'（请等该课程交付后再集成）');download='downloads/'+meta.id+'/'+path.basename(file);copy(file,path.join(OUT,download));}
    const {sourcePath:omit,...clean}=course;
    courses.push({...clean,download,documents:cleanDocs,chapterCount:lessons,documentCount:documents.length});
    diagnostics.documents+=documents.length;diagnostics.chapters+=lessons;
  }
  const catalog={version:1,site,courses};diagnostics.courses=courses.length;
  write(path.join(OUT,'data/catalog.js'),'window.TUTORIAL_CATALOG='+serialize(catalog)+';\n');
  write(path.join(OUT,'data/search.js'),'window.TUTORIAL_SEARCH='+serialize(search)+';\n');
  for(const file of walk(path.join(ROOT,'web')))copy(file,path.join(OUT,relative(path.join(ROOT,'web'),file)));
  write(path.join(OUT,'build-report.json'),JSON.stringify(diagnostics,null,2)+'\n');
  console.log(JSON.stringify(diagnostics));
}
// 构建入口共用互斥锁；成功后才替换dist，失败则保留上一版。
function build(){
  const lock=path.join(ROOT,'.tutorial-build.lock');let fd;
  try{fd=fs.openSync(lock,'wx');}catch(error){
    if(error.code==='EEXIST')throw Error('另一个构建持有 .tutorial-build.lock。请等待它结束；若曾异常中断，先核对锁内PID已退出，再移除锁。');
    throw error;
  }
  const cache=path.join(ROOT,'.cache');let staging,backup;
  function cleanup(target){
    if(!target||!fs.existsSync(target))return;
    if(path.dirname(target)!==cache||!/^site-(?:build|previous)-[a-zA-Z0-9-]+$/.test(path.basename(target))||fs.lstatSync(target).isSymbolicLink())throw Error('Unexpected cleanup target');
    fs.rmSync(target,{recursive:true,force:true});
  }
  try{
    fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');
    if(fs.existsSync(cache)&&fs.lstatSync(cache).isSymbolicLink())throw Error('Cache cannot be a symlink');
    fs.mkdirSync(cache,{recursive:true});staging=fs.mkdtempSync(path.join(cache,'site-build-'));
    generateSite(staging);
    if(path.resolve(OUT)!==path.join(ROOT,'dist')||path.dirname(OUT)!==ROOT)throw Error('Unexpected live output');
    if(fs.existsSync(OUT)){
      if(fs.lstatSync(OUT).isSymbolicLink())throw Error('Live output cannot be a symlink');
      backup=path.join(cache,'site-previous-'+crypto.randomUUID());fs.renameSync(OUT,backup);
    }
    try{fs.renameSync(staging,OUT);staging=null;}
    catch(error){if(backup)fs.renameSync(backup,OUT);backup=null;throw error;}
    cleanup(backup);backup=null;
  }finally{try{cleanup(staging);}finally{fs.closeSync(fd);fs.unlinkSync(lock);}}
}
if(require.main===module)build();
module.exports={build,renderDocument,kindOf,slug,serialize,stageOf};
