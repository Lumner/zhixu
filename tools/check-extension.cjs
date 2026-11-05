// 使用临时课程验证扩展机制；只移除本脚本创建并核对过的目录，最后还原正式构建。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {build}=require('./build.cjs');
const ROOT=path.resolve(__dirname,'..'),CONTENT=path.join(ROOT,'content'),FIXTURE=path.join(CONTENT,'extension-check');
if(path.dirname(FIXTURE)!==CONTENT||path.basename(FIXTURE)!=='extension-check'||fs.existsSync(FIXTURE))throw Error('Temporary course directory must be new');
const created=[];
function write(rel,value){const target=path.join(FIXTURE,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);created.push(target);}
function readScript(rel,window){vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist',rel),'utf8'),{window});}
let passed=false;
try{
  write('course.json',JSON.stringify({id:'extension-check',title:'扩展机制临时验证',category:'foundations',source:'source',level:'基础',updatedAt:'2026-11-03',stats:{chapters:2},groups:[{id:'intro',name:'独立课程阶段'}],cover:{lines:['独立课程','目录验证'],icon:'code'},chapters:[{id:'first',file:'start.md',number:1,group:'intro'},{id:'second',file:'nested/types.md',number:2,group:'intro'}]}));
  write('source/start.md','# 扩展起点\n\n## 专属知识点\n\nextension_unique_knowledge\n\n[第二节](nested/types.md)\n\n```python\nprint("hello")\n```\n');
  write('source/nested/types.md','# 自定义章节文件名\n\n[回到起点](../start.md)\n');
  build();
  const window={};readScript('data/catalog.js',window);readScript('data/search.js',window);
  const course=window.TUTORIAL_CATALOG.courses.find(c=>c.id==='extension-check');
  assert.equal(course.category,'foundations');assert.equal(course.chapterCount,2);assert.deepEqual(Array.from(course.documents,d=>d.id),['first','second']);assert.equal(course.cover.icon,'code');
  let first;readScript('data/content/extension-check/first.js',{TutorialContent:{register(key,data){assert.equal(key,'extension-check/first');first=data;}}});
  assert.ok(first.html.includes('#/learn/extension-check/second'));assert.ok(first.html.includes('language-python'));assert.ok(window.TUTORIAL_SEARCH.some(r=>r.courseId==='extension-check'&&r.text.includes('extension_unique_knowledge')));
  assert.equal(window.TUTORIAL_CATALOG.courses.find(c=>c.id==='wechat-miniprogram').chapterCount,36);passed=true;
}finally{
  // 先逐个删除确知的临时文件，再移除空目录；不递归删除未知内容。
  for(const file of created.reverse())fs.unlinkSync(file);
  for(const rel of ['source/nested','source',''])fs.rmdirSync(path.join(FIXTURE,rel));
  build();
}
if(passed){const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),passed:true,checks:['second course discovery','independent category and cover','explicit nested chapter order','relative chapter links','syntax highlighting','search indexing','existing course preservation'],temporaryCourseRemoved:!fs.existsSync(FIXTURE)};fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});fs.writeFileSync(path.join(ROOT,'reports/extension-check.json'),JSON.stringify(report,null,2)+'\n');console.log('Second-course integration checks passed; final build contains only real courses.');}
