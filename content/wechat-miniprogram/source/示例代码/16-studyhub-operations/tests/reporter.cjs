const path=require('node:path');
module.exports=async function*(source){const scenarios=[];let summary=null,coverage=null;
 for await(const {type,data}of source){
  if(['test:pass','test:fail'].includes(type)&&data.details?.type!=='suite')scenarios.push({name:data.name,status:type==='test:fail'?'failed':data.skip?'skipped':data.todo?'todo':'passed',error:type==='test:fail'?String(data.details?.error?.message||'测试失败'):undefined});
  if(type==='test:summary'&&data.file===undefined)summary={counts:data.counts,success:data.success};
  if(type==='test:coverage')coverage=data.summary?{scope:'本轮加载且匹配miniprogram筛选的JS，不是全项目/云端/原生覆盖率',totals:data.summary.totals,files:data.summary.files.map(file=>({path:path.relative(path.resolve(__dirname,'..'),file.path).split(path.sep).join('/'),totalLineCount:file.totalLineCount,coveredLineCount:file.coveredLineCount,coveredLinePercent:file.coveredLinePercent}))}:null;
 }
 yield JSON.stringify({format:'studyhub-node-test-v1',summary,scenarios,coverage})+'\n';
};
