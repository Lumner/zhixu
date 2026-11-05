import { TaskFields, Reply, TaskDTO, parseFields } from '../src/contracts';
const fields: TaskFields = { title: '学习类型', done: false, priority: 'high' };
const checked: TaskFields = parseFields(fields);
const reply: Reply<TaskDTO> = { ok: true, data: { ...checked, id: 't0001', version: 1 } };
if (reply.ok) { const title: string = reply.data.title; void title; }
// @ts-expect-error done必须是布尔值
const wrongDone: TaskFields = { title: 'x', done: 'false', priority: 'normal' };
// @ts-expect-error 字面量联合不接受任意优先级
const wrongPriority: TaskFields = { title: 'x', done: false, priority: 'urgent' };
const external: unknown = {};
// @ts-expect-error unknown必须先校验或缩窄
const uncheckedTitle = external.title;
// @ts-expect-error 成功分支没有error字段
if (reply.ok) reply.error;
void wrongDone; void wrongPriority; void uncheckedTitle;
