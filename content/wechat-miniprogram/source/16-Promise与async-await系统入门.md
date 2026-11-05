# 16 Promise 与 async/await 系统入门

建议 3—5 小时，分三次完成：先看执行顺序，再写 Promise 链，最后用 async/await 组织流程。前提是第 03 章的函数、回调和 this，以及第 07 章的异常处理。

本阶段完整示例在 `示例代码/04-studyhub-network`。第 17 章再启动服务端；本章纯语言例子可先放入练习页 onLoad 中运行，一次只运行一段。

## 16.1 从“稍后得到结果”出发

本地同步缓存调用返回后，下一行就能使用结果。网络请求则需要等待服务器和网络：调用发出后，JS 不能马上假定结果已经存在。

```js
let title = '还没拿到';
setTimeout(() => {
  title = '学习 Promise';
}, 500);
console.log(title); // 还没拿到
```

先前使用回调通知完成。步骤越来越多时，读取用户 → 读取任务 → 查询统计，层层嵌套会使顺序和错误处理分散。Promise 提供统一的结果对象，方便组合这些未来结果。

## 16.2 Promise 的三种状态

| 状态 | 含义 | 结果 |
| --- | --- | --- |
| pending | 结果未确定 | 等待完成或失败 |
| fulfilled | 已成功 | 有一个成功值 |
| rejected | 已失败 | 有一个失败原因 |

状态一旦由 pending 确定，就不会再次改变。失败原因通常使用 Error 对象，便于携带 message 和调用栈。

“创建 Promise”不等于“自动放到后台线程”。创建时传入的执行函数会立即运行，其中的网络或计时器才可能在稍后完成。

## 16.3 创建第一个 Promise

```js
function waitForLesson() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ title: '学习 Promise', minutes: 25 });
    }, 500);
  });
}

waitForLesson().then(lesson => {
  console.log(lesson.title); // 大约半秒后
});
console.log('请求已登记'); // 先输出
```

逐项解释：new Promise 创建对象；传入函数接收 resolve/reject；resolve 提交成功值；函数返回 Promise，调用者用 then 处理成功。reject 在这段里尚未使用，不需要为了“用全参数”硬加一个失败。

resolve 不等于 return。调用 resolve 后，当前执行函数中的后续同步语句仍可能继续。若逻辑需要立刻结束，用 `return` 明确退出。

Promise 概念与组合方法可参考 [MDN Promise 指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Using_promises)，本章示例围绕课程重新编写。

## 16.4 亲眼看执行顺序

```js
console.log('A');
const promise = new Promise(resolve => {
  console.log('B');
  resolve('D');
});
promise.then(value => console.log(value));
console.log('C');
```

输出 A、B、C、D。执行函数立即运行，所以 B 在 C 前；then 回调通过微任务机制稍后执行，即使 Promise 已经成功，也不会直接插队执行这个 then。

初学先掌握“同步语句先完成，已准备好的 Promise 回调随后处理”，不必立刻背全部事件循环细节。实际调试还要区分网络、计时器、框架渲染等不同调度机制。

## 16.5 then 返回的是另一个 Promise

```js
Promise.resolve(25)
  .then(minutes => minutes * 60)
  .then(seconds => {
    console.log(seconds); // 1500
    return seconds + 60;
  })
  .then(result => console.log(result)); // 1560
```

每个 then 返回新 Promise。回调返回普通值，下一步收到它；返回另一个 Promise，下一步等待它的结果；回调抛异常，链转入失败。

缺少 return 的例子：

```js
Promise.resolve(25)
  .then(minutes => {
    minutes * 60; // 算了但没返回
  })
  .then(value => console.log(value)); // undefined
```

要么写 `return minutes * 60`，要么用无花括号的箭头函数简写。不要只看屏幕有没有日志，还要看结果有没有沿链传下去。

## 16.6 失败、catch 和继续执行

```js
function parseMinutes(raw) {
  return Promise.resolve().then(() => {
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
      throw new Error('分钟数无效');
    }
    return value;
  });
}

parseMinutes('abc')
  .then(value => console.log('有效', value))
  .catch(error => console.log('失败原因', error.message));
```

catch 接到前面链路的拒绝。catch 若返回一个普通值，后面的链会恢复成功；若希望继续让调用者知道失败，应该再次 throw。

```js
Promise.reject(new Error('读取失败'))
  .catch(error => {
    console.log(error.message);
    return []; // 明确选择空数组作为降级结果
  })
  .then(tasks => console.log(tasks.length)); // 0
```

降级不是随意吞错。任务读取失败时用空数组再保存可能破坏数据，所以本课程的任务仓储不会这样处理。资源列表也会保留“失败”与“真实为空”的区别。

## 16.7 finally：成功失败都要做的清理

```js
loadSomething()
  .then(value => { /* 使用结果 */ })
  .catch(error => { /* 展示错误 */ })
  .finally(() => { /* 收起 loading */ });
```

这是说明片段，loadSomething 需要由你定义。finally 适合清理，不适合放“保存成功”的 toast。它不接收成功值；正常情况下保留之前的结果。若 finally 自己抛错或返回一个拒绝的 Promise，仍会影响最终结果。

## 16.8 async 函数总是返回 Promise

```js
async function getGoal() {
  return 25;
}

const result = getGoal();
console.log(result); // 一个 Promise，不是数字 25
getGoal().then(value => console.log(value)); // 25
```

加 async 不是“把内部代码自动挪到另一个线程”。它主要改变函数返回和内部等待的表达方式。语法定义见 [MDN async function](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/async_function)。

## 16.9 await 等待结果，不阻塞整个界面

```js
async function study() {
  console.log('开始等待');
  const lesson = await waitForLesson();
  console.log('拿到', lesson.title);
  return lesson.minutes;
}

study().then(minutes => console.log('最终分钟', minutes));
console.log('这行先继续');
```

await 暂停当前 async 函数后续部分，外部同步代码可以继续。Promise 成功后，lesson 才拿到成功值；失败时会像在 await 位置抛异常。

在本课程 CommonJS 小程序文件里，把 await 写在 async 函数中。不要看到其他运行环境支持顶层 await，就直接复制进当前文件顶层。

长时间同步 for 循环仍然会卡住线程。给函数加 async，不会让其中的大计算自动变得流畅。

## 16.10 用 try/catch/finally 组织页面方法

```js
// Page 配置中的说明片段；fetchLesson 约定返回 Promise。
async onLoadLesson() {
  this.setData({ loading: true, error: '' });
  try {
    const lesson = await fetchLesson();
    this.setData({ lesson });
  } catch (error) {
    this.setData({ error: error.message });
  } finally {
    this.setData({ loading: false });
  }
}
```

这一写法把一次调用的正常结果、失败和清理放在一起。但多个请求相互替换时，仅这个模式不够：旧请求 finally 也可能关闭新请求的 loading。第 18 章会加入请求序号来隔离旧流程。

不要在 finally 中随便 return，它可能覆盖之前的返回值或异常。清理代码应尽量简单。

## 16.11 串行与并发

串行：下一步依赖上一步。

```js
const user = await loadUser();
const tasks = await loadTasksForUser(user.id);
```

并发：两项互不依赖，可以先同时发起，再一起等待。

```js
const [tasks, notes] = await Promise.all([loadTasks(), loadNotes()]);
```

这些函数为说明用，需要实际实现。Promise.all 返回结果顺序与输入顺序对应，而不是谁先完成就排在前面。任一输入失败，组合结果失败；**它不会自动取消其余已经发出的请求**。自动取消需要请求层提供能力并由你调用。

可对照 [MDN Promise.all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) 和 [ECMAScript Promise.all 规范](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all)。阅读翻译资料时也要交叉核对“组合失败”与“中断底层操作”这两个不同概念。

## 16.12 allSettled：允许独立失败

```js
const results = await Promise.allSettled([loadTasks(), loadNotes()]);
for (const result of results) {
  if (result.status === 'fulfilled') {
    console.log('成功', result.value);
  } else {
    console.log('失败', result.reason);
  }
}
```

适合两个区块独立展示，一个失败不妨碍另一个。需要检查每个结果，不能因为外层成功返回就说所有业务都成功。参考 [MDN allSettled](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)。

Promise.race 选择最先确定的结果，也不自动取消输掉的任务。简单地 race 一个超时 Promise，如果不 abort 底层请求，网络仍可能继续。

## 16.13 循环中常见的两个陷阱

```js
// 不适合用来“等整个循环完成”
tasks.forEach(async task => {
  await saveTask(task);
});
console.log('这里不代表全部保存完成');
```

按顺序保存：

```js
for (const task of tasks) {
  await saveTask(task);
}
```

允许并发且数量很少：

```js
await Promise.all(tasks.map(task => saveTask(task)));
```

很多数据时应限制并发，而不是一次发出几百个请求。本阶段一次只允许一个列表加载动作，降低服务端压力和状态复杂度。

## 16.14 封装回调时不要使用 async 执行函数

推荐的 Promise 创建形式是普通执行函数，内部把底层成功/失败接到 resolve/reject。不要写 `new Promise(async (resolve, reject) => {...})` 然后以为内层 await 的异常会自动正确交给外层。

更直接的规则：已有 Promise 就用 async/await 组合，不要再套一层；只有把回调 API 转成 Promise 时才需要手动创建。

## 16.15 本章练习

1. 预测 A/B/C/D 示例顺序，再自己加入一条 then。
2. 写 wait(ms)，返回一段时间后成功的 Promise。
3. 把两个 then 改为 async/await，保留错误反馈。
4. 让任务区块失败、笔记区块成功，分别用 all 和 allSettled 观察结果。
5. 解释 await wx.request(...) 为什么不能在没有明确返回约定时直接当“等到业务成功”。本课会显式封装，避免混淆 RequestTask 与结果。

[下一章：HTTP、接口与本地服务](17-HTTP接口与本地服务入门.md)
