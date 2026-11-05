const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function clock(){let time=1000,next=0;const jobs=new Map();return{now:()=>time,setTimer(fn,ms){const id=++next;jobs.set(id,{at:time+ms,fn});return id;},clearTimer:id=>jobs.delete(id),count:()=>jobs.size,
 tick(ms){const end=time+ms;let steps=0;while(true){const due=[...jobs.entries()].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;if(++steps>10000)throw Error('虚拟时钟疑似无界循环');jobs.delete(due[0]);time=due[1].at;due[1].fn();}time=end;}};}
const turns=async()=>{await Promise.resolve();await Promise.resolve();};
function applyData(data,patch){for(const [key,value]of Object.entries(patch)){const keys=key.replace(/\[(\d+)\]/g,'.$1').split('.');let at=data;for(let i=0;i<keys.length-1;i++)at=at[keys[i]] ||= /^\d+$/.test(keys[i+1])?[]:{};at[keys.at(-1)]=copy(value);}}
// 仅执行本项目可信代码；vm在这里用于捕获定义，不是安全沙箱或微信运行时。
function load(relative,{globals={},mocks={},source}={}){const file=path.join(ROOT,relative),module={exports:{}};vm.runInNewContext(source===undefined?fs.readFileSync(file,'utf8'):source,{module,exports:module.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name.startsWith('.')?path.resolve(path.dirname(file),name):name),console,setTimeout,clearTimeout,Date,...globals},{filename:file});return module.exports;}
function component(name){let definition;load('miniprogram/components/'+name+'/index.js',{globals:{Component:value=>{definition=value;}}});const data=copy(definition.data||{});for(const [key,value]of Object.entries(definition.properties||{}))data[key]=copy(value.value);
 const instance={data,properties:data,events:[],patches:[],setData(patch,callback){this.patches.push(copy(patch));applyData(this.data,patch);if(callback)callback();},triggerEvent(name,detail){this.events.push({name,detail:copy(detail)});}};
 for(const [name,fn]of Object.entries(definition.methods||{}))instance[name]=fn.bind(instance);
 return{instance,definition};}
function page(name,api={}){let definition;load('miniprogram/packageLab/pages/'+name+'/index.js',{globals:{Page:value=>{definition=value;},wx:api}});return{...definition,data:copy(definition.data),patches:[],setData(patch,callback){this.patches.push(copy(patch));applyData(this.data,patch);if(callback)callback();}};}
module.exports={ROOT,copy,deferred,clock,turns,applyData,load,component,page};
