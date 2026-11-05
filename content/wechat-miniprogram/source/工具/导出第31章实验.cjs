const fs=require('node:fs'),path=require('node:path');
const course=path.resolve(__dirname,'..'),project=path.join(course,'示例代码/12-studyhub-performance');
const requireFrom=file=>require(path.join(project,file));
const {comparison}=requireFrom('miniprogram/utils/perf-scenario');
const {composeView}=requireFrom('miniprogram/utils/task-view');
const {createPatchWriter,getAt}=requireFrom('miniprogram/utils/view-patch');
const {createTaskDraftStore}=requireFrom('miniprogram/services/task-draft-core');
const {createTaskSession}=requireFrom('miniprogram/services/task-session');
const {utf8Bytes}=requireFrom('miniprogram/utils/report-file');
const {CATEGORIES,PRIORITIES}=requireFrom('miniprogram/constants/index');
const {inspect}=requireFrom('tools/package-info.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function apply(data,patch){for(const [key,value] of Object.entries(patch)){const parts=key.replace(/\[(\d+)\]/g,'.$1').split('.');let current=data;for(let i=0;i<parts.length-1;i++)current=current[parts[i]] ||= /^\d+$/.test(parts[i+1])?[]:{};current[parts.at(-1)]=clone(value);}}
async function formExperiment(){
  const cache=new Map(),data={},states=[];let baselineBytes=0,baselineCalls=0;
  const writer=createPatchWriter({send:patch=>apply(data,patch),read:key=>getAt(data,key),project:composeView});
  const drafts=createTaskDraftStore({read:key=>cache.get(key),write:(key,value)=>cache.set(key,clone(value)),now:()=>1000});
  const session=createTaskSession({repository:{},outbox:{identity:async()=> 'fixed-env:wx:fixed-user'},drafts,setTimer:()=>1,clearTimer(){},emit:state=>{
    states.push(state);
    const old={...state,fieldsPreview:JSON.stringify(state.fields,null,2),categoryIndex:Math.max(0,CATEGORIES.findIndex(x=>x.id===state.fields.category)),priorityIndex:Math.max(0,PRIORITIES.findIndex(x=>x.id===state.fields.priority))};
    baselineBytes+=utf8Bytes(JSON.stringify(old));baselineCalls++;writer.write(state);
  }});
  await session.open();session.change({description:'固定的长备注。'.repeat(80)});
  for(let index=0;index<20;index++){session.change({title:'固定输入'+index});if(index%5===0)session.flush();}
  session.flush();const final=composeView(session.snapshot());
  const equivalent=Object.keys(final).every(key=>JSON.stringify(final[key])===JSON.stringify(getAt(data,key)));
  const result={emittedStates:states.length,baselineCalls,baselineJsonBytes:baselineBytes,optimized:writer.metrics(),visibleProjectionEquivalent:equivalent,
    note:'实际task-session的固定输入流；比较第30章完整快照发送方式与当前视图适配器。无真实原生渲染计时。'};
  session.close();writer.dispose();return result;
}
async function main(){
  const result={date:'2026-11-02',jsonModel:comparison(),formModel:await formExperiment(),
    packageSources:{before:inspect(path.join(course,'示例代码/11-studyhub-quality')),after:inspect(project)},
    imageFixtures:['small','large'].map(name=>{const file=path.join(project,'miniprogram/packageLab/assets/fixture-'+name+'.png'),bytes=fs.readFileSync(file);const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);return{name,width,height,pngBytes:bytes.length,rgba8EstimateBytes:width*height*4};}),
    nativeWechatMeasured:false};
  fs.writeFileSync(path.join(course,'验证/第十一阶段性能模型结果.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
