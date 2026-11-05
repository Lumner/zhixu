// 可选DOM模拟；本次未安装依赖或运行，不计入50/500本地场景。
const path=require('node:path'),simulate=require('miniprogram-simulate');
const client=path.resolve(__dirname,'../../miniprogram');
const task={id:'render_task',title:'读取标签后查看任务',done:false,meta:'固定教学元信息'};
function mounted(){const id=simulate.load(path.join(client,'components/task-card/index'),{rootPath:client,compiler:'simulate'}),comp=simulate.render(id,{task,disabled:false}),parent=document.createElement('div');document.body.appendChild(parent);comp.attach(parent);return{comp,close(){comp.detach();parent.remove();}};}
test('WXML实际形成两个按钮且查看事件携带任务ID',()=>{const f=mounted();try{const buttons=f.comp.querySelectorAll('button'),events=[];expect(buttons).toHaveLength(2);expect(f.comp.dom.textContent).toContain(task.title);f.comp.addEventListener('open',event=>events.push(event.detail));buttons[0].dispatchEvent('tap');expect(events).toEqual([{id:task.id}]);}finally{f.close();}});
test('通过模拟器更新disabled后不再触发完成动作',async()=>{const f=mounted();try{const events=[];f.comp.addEventListener('toggle',event=>events.push(event.detail));await new Promise(resolve=>f.comp.setData({disabled:true},resolve));f.comp.querySelectorAll('button')[1].dispatchEvent('tap');expect(events).toHaveLength(0);}finally{f.close();}});
