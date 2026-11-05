const {copy,clock,deferred}=require('./core.cjs');
const {createTaskDraftStore}=require('../../miniprogram/services/task-draft-core');
const {createTaskSession,defaults}=require('../../miniprogram/services/task-session');
const failure=(code,message=code)=>Object.assign(new Error(message),{code});
function flow(factory=createTaskSession){
 const c=clock(),storage=new Map(),receipts=new Map(),sessions=[];
 const f={received:deferred(),clock:c,owner:'test-env|user-A',requests:[],ids:0,writes:0,reads:0,queue:[],flags:{failWrite:false,failClear:false,loseResponse:false,hold:null},records:new Map()};
 f.drafts=createTaskDraftStore({now:c.now,read:key=>copy(storage.get(key)),write(key,value){if(f.flags.failWrite||f.flags.failClear&&value.items.length===0)throw failure('CACHE');storage.set(key,copy(value));}});
 f.repository={async get(id){f.reads++;if(!f.records.has(id))throw failure('NOT_FOUND');return copy(f.records.get(id));}};
 // 回执fake是本地假服务，非云端事务证明；真实domain另由继承套件验证。
 f.outbox={identity:async()=>f.owner,list:async()=>copy(f.queue),newOperationId(){f.ids++;return 'test_op_'+String(f.ids).padStart(16,'0');},
 async resume(attempt,owner){const sealed=f.drafts.get(owner,attempt.action==='update'?attempt.payload.id:'');if(!sealed||sealed.phase!=='sealed'||sealed.attempt.opId!==attempt.opId)throw failure('NOT_SEALED');
 f.requests.push(copy(attempt));f.received.resolve();if(f.flags.hold)await f.flags.hold.promise;
 if(!receipts.has(attempt.opId)){f.writes++;receipts.set(attempt.opId,{id:'fake_task_'+f.writes,version:1});}
 if(f.flags.loseResponse){f.flags.loseResponse=false;throw failure('TRANSPORT');}return copy(receipts.get(attempt.opId));}};
 f.create=()=>{const states=[],session=factory({repository:f.repository,outbox:f.outbox,drafts:f.drafts,emit:state=>states.push(copy(state)),setTimer:c.setTimer,clearTimer:c.clearTimer});sessions.push(session);return{session,states};};
 f.existing=(id='task_1',version=2)=>{const task={id,...defaults(),title:'服务器原标题',createdAt:1000,updatedAt:1000,version};f.records.set(id,task);return task;};
 f.dispose=()=>sessions.forEach(session=>session.close());return f;
}
module.exports={flow,failure};
