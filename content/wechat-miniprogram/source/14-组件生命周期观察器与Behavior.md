# 14 组件生命周期、观察器与 Behavior

建议 3—4 小时。这一章通过概览页的 10/20 秒倒计时，训练“什么时候初始化、什么时候停止后台工作、什么时候释放资源”。它是生命周期实验，还不是完整专注产品。

## 14.1 页面和组件各有生命周期

页面用 onLoad/onShow/onHide/onUnload，组件实例有自己的创建、挂载、准备和移除过程。页面还在，并不代表里面每个组件一直都在。

```xml
<demo-countdown wx:if="{{showTimer}}" duration="{{duration}}" bind:finish="onFinish" />
```

showTimer 从 true 改 false，会移除组件实例；再改 true，创建的是新实例。反过来，仅切换底部标签可能保留页面及其中组件，只是所在页暂时隐藏。

## 14.2 lifetimes 的常见阶段

| 阶段 | 含义 | 本例用途 |
| --- | --- | --- |
| created | 组件实例刚创建 | 不依赖界面的普通字段准备，不能在这里 setData |
| attached | 进入页面节点树 | 初始化状态、标记存活 |
| ready | 首次布局准备完成 | 需要布局完成后再做的工作 |
| detached | 从页面节点树移除 | 清理定时器、取消订阅、停止后续更新 |

```js
lifetimes: {
  attached() {
    this._alive = true;
    this._visible = true;
    this.onReset();
  },
  detached() {
    this._alive = false;
    this._visible = false;
  }
}
```

片段来自完整倒计时。定时器清理由它使用的 Behavior 负责，下文会解释；只复制这几行并不能获得完整清理效果。阶段语义和 created 限制可查 [官方组件生命周期定义](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.component.d.ts)。

## 14.3 pageLifetimes：组件所在页面的显示状态

```js
pageLifetimes: {
  show() {
    this._visible = true;
    this.syncClock();
    this.ensureTicker();
  },
  hide() {
    this._visible = false;
    this.clearTicker();
  }
}
```

这里写 show/hide，不是 onShow/onHide。它们描述“组件所在页面”的变化，不是整个应用唯一的全局回调。

页面隐藏时停止轮询，避免没有可见界面还每 250ms 更新；页面回来先按真实时间校正，再决定是否重新轮询。组件销毁时还需要 detached 清理，因为销毁和隐藏不是同一件事。

## 14.4 data 和实例字段怎样划分

| 数据 | 放在哪里 | 原因 |
| --- | --- | --- |
| remaining | data | 界面显示剩余秒数 |
| label | data | 界面显示格式化时间 |
| running | data | 控制文字和按钮状态 |
| _timer | 普通实例字段 | 定时器资源句柄，不发送到视图 |
| _endAt | 普通实例字段 | 内部计算的结束时间 |
| _alive/_visible | 普通实例字段 | 控制回调是否还能工作 |
| _finished | 普通实例字段 | 本轮是否已经发过完成事件 |

前面的下划线是本课程命名习惯，不是 JavaScript 自动私有化。组件外部仍不应依赖这些内部字段。

## 14.5 为什么不每秒直接 remaining -= 1

定时器可能延迟，手机后台也可能暂停回调。假设本该执行 10 次，实际只执行 6 次，盲减法就多出 4 秒。

本例开始时记录结束时间：

```js
this._endAt = Date.now() + this.data.remaining * 1000;
```

刷新时计算：

```js
const remaining = Math.max(0, Math.ceil((this._endAt - Date.now()) / 1000));
```

差值以毫秒为单位，除 1000 转秒，ceil 向上取整，max 保证不出现负数。即使回调中途没有运行，返回页面仍能从当前时间算出合理结果。

这是显示倒计时的基础策略。系统时间被用户改动、暂停后毫秒精度、应用被结束后的恢复、专注记录落库，仍有更多问题；第 27 章会补齐。当前实验暂停时按整秒保留剩余量，不声称提供毫秒精度的学习统计。

## 14.6 开始为什么要防止重复建立定时器

```js
ensureTicker() {
  if (!this._alive || !this._visible || !this.data.running || this._timer != null) return;
  this._timer = setInterval(() => this.syncClock(), 250);
}
```

只有组件存活、页面可见、处于运行状态且没有定时器，才建立一个。这里 `!= null` 是有意同时识别 null 和 undefined 的简写；其他业务比较仍以严格相等为主，也可以改成两个明确的严格判断。

重复点击开始或多次 show，不应多建一份轮询。否则同一界面可能被多个回调同时更新，销毁时只清一个句柄还会泄漏剩下的资源。

250ms 是刷新频率，不代表每次扣掉 0.25 秒。每次仍根据 _endAt 计算，这两个职责必须分开。

## 14.7 暂停、重置和隐藏分别意味着什么

暂停：先校正一次当前显示，清轮询，running=false，保留整秒 remaining；继续时从剩余量建立新结束时间。

重置：清轮询、清结束时间和完成标记，重新从 duration 属性得到初始值。

隐藏：只停止可视轮询，仍保持 running 和 _endAt。时间继续流逝，返回时校正。

移除：实例退出，资源清理，后续不再 setData；重新创建后从 duration 开始。这里没有实现跨实例保存会话。

这四个词不是同一种操作，用同一段“清空全部状态”的代码处理会使行为难以解释。

## 14.8 完成事件只发送一次

```js
if (remaining === 0) {
  this.setData({ running: false });
  this._endAt = 0;
  this.clearTicker();
  if (!this._finished) {
    this._finished = true;
    this.triggerEvent('finish', {});
  }
}
```

_finished 记录这轮是否已通知。父页面收到 finish 后只增加“本页本次运行收到次数”，不写学习记录，也不把该计数宣称为学习时长。

第 27 章真正保存专注会话时，还要用业务身份和幂等规则防止重复落库。组件内部防重复是其中一个环节。

## 14.9 observers：对输入和数据变化做响应

```js
observers: {
  duration() {
    if (this._alive) this.onReset();
  }
}
```

父页把 duration 从 10 改成 20，组件重置当前实验。初始化阶段可能先收到属性变化，_alive 防止还未挂载就执行依赖挂载状态的步骤；attached 里会用最终属性再初始化。

上一章卡片也有 task observer：task 变了重新计算 meta。不要把 observer 当作只能在 DOM 上运行的浏览器事件，它是组件数据机制的一部分。

### 观察什么，就尽量避免在内部又改同一依赖

```js
// 不推荐的循环思路
observers: {
  count(value) {
    this.setData({ count: value + 1 });
  }
}
```

观察 count，又无条件更新 count，可能形成持续触发。更合理的是观察原始输入，更新独立的派生字段；确需归一化时也要有明确终止条件。

可以观察多个字段，如 `'firstName,lastName'`，或按框架支持的路径观察嵌套对象。不要刚开始就对所有数据使用宽泛观察，把业务状态流变得难以追踪。

## 14.10 Behavior：共享一组组件能力

普通工具函数用于共享计算。Behavior 可以共享组件方法、数据或生命周期，它与组件实例机制结合。

本例 `behaviors/timer-cleanup.js`：

```js
module.exports = Behavior({
  methods: {
    clearTicker() {
      if (this._timer !== null && this._timer !== undefined) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  },
  lifetimes: {
    detached() { this.clearTicker(); }
  }
});
```

组件引入：

```js
const timerCleanup = require('../../behaviors/timer-cleanup');
Component({
  behaviors: [timerCleanup]
  // 其余配置见完整源码；需要在多个配置项之间加逗号。
});
```

上面引入代码只演示 behaviors 配置，完整项目另有 methods/lifetimes。Behavior 的 clearTicker 成为实例可调用方法，移除时清理 _timer。组件自身 detached 仍执行它的标记逻辑。

共享生命周期与同名方法有合并/覆盖规则，不能仅按普通对象展开推断所有细节。本课程避免在 Behavior 和组件中定义同名业务方法；具体定义见 [官方 Behavior 类型与接口](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.behavior.d.ts)。

## 14.11 不要过早把所有逻辑塞进 Behavior

formatSeconds、标题校验、日期校验是普通纯函数；不需要组件实例，放 utils 即可。轮询清理依赖实例句柄与 detached，才适合演示 Behavior。

Behavior 与组件都用 `_timer` 是明确约定。如果一个组件要管理两个独立定时器，不能直接拿一个字段硬套，需要更清楚的资源管理方式。共享越多，越要写清依赖和冲突。

## 14.12 手动实验顺序

1. 打开概览，点击开始，看到从 00:10 逐渐减少。
2. 再点开始不应产生第二轮；点暂停后数字不再变化。
3. 点继续，切换任务标签，等待几秒再回概览，显示应按时间校正。
4. 在隐藏时等到超过结束时间，再返回，只应收到一次 finish。
5. 运行中切换时长，当前轮停止并重置为新时长。
6. 运行中点移除组件，再重新创建，出现新初始状态。
7. 查看验证脚本中的定时器资源检查，理解移除后必须没有残留轮询。

模拟环境能确认代码分支与资源句柄处理；微信原生生命周期派发、后台策略和页面切换效果仍要在工具和手机核对。

## 14.13 练习

1. 用日志观察 attached/detached 与 page show/hide 的区别。
2. 加入一个 status-label 内部派生字段，确保 observer 不观察它自己。
3. 设计两个倒计时同时放在一页，为什么不能把 _timer 放到模块最外层？
4. 把 Behavior 清理逻辑内联到组件，比较哪一种更容易读；两种都应确保销毁释放资源。

[下一章：分层、迁移与完整项目验收](15-项目分层数据迁移与Git入门.md)
