# 02 JavaScript 基础语法

本章从“变量是什么”讲起，目标是能读懂和编写简单计算程序。建议 3—5 小时，分几次完成。不要一口气背语法，先预测输出，再运行验证。

## 2.1 这些练习在哪里运行

用第 01 章的计数器，在 `pages/index/index.js` 的 `Page` 配置中临时加入：

```js
onLoad() {
  console.log('我开始练习 JavaScript');
},
```

例如放在 `data` 后、`onIncrease` 前，注意配置项之间有逗号。后面不含 `Page` 的 JS 片段，都可以放到这个 `onLoad` 的花括号内，每次只练一个片段。编译后看 Console。不要把练习代码直接写进 WXML。

`onLoad` 是页面创建时框架会调用的方法，第 07 章会系统介绍。练习完移除临时代码，以免改变示例运行。

纯 JS 也可以在浏览器 Console 中练习，但浏览器没有小程序专用的 `Page`、`App`、`wx`。反过来，小程序逻辑代码也不能假定存在浏览器的 `document`、DOM 或 `localStorage`。语言和宿主环境是两回事。

## 2.2 从一条语句认识标点

```js
console.log('今天学习 30 分钟');
```

`console` 是提供日志功能的对象，`.` 读取它的 `log` 方法，`()` 调用方法，引号中的内容是字符串，`;` 结束语句。这里没有任何内容会自动出现在小程序页面上。

用英文输入状态书写引号、括号、冒号、逗号。中文 `“”`、`（）` 不能代替代码中的 `''`、`()`。

```js
// 单行注释：给阅读代码的人看
/* 多行注释：
   可以解释为什么要做某件事 */
console.log('程序只执行这一行');
```

注释不参与执行。缩进一般用两个空格，帮助看清结构，不要靠代码挤成一行来“显得熟练”。

## 2.3 变量：给值取一个名字

```js
let minutes = 20;
minutes = 35;
console.log(minutes); // 35

const subject = '微信小程序';
console.log(subject); // 微信小程序
```

`let minutes = 20` 包含三件事：创建名字 `minutes`，计算右侧的值 `20`，把它赋给该名字。后面的 `minutes = 35` 是重新赋值。

`const` 声明的名字不能再次赋值。优先用 `const`，确实需要重新赋值时再用 `let`。你会在旧教程看到 `var`，现阶段知道它也是声明变量的方式即可，不要混用来解决报错。

```js
const goal = 60;
// goal = 90; // 如果取消注释，会因重新赋值而报错
```

推荐名字：`taskTitle`、`totalMinutes`、`isFinished`。避免 `a1`、`xx` 这种无法解释含义的名字。名字区分大小写，不能以数字开头，不要用 `if`、`return` 等关键字。

关于声明和基础类型，可查 [MDN JavaScript 语法与类型](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Grammar_and_types)。本章练习围绕学习任务重新编写。

## 2.4 常用数据类型

```js
const title = '学习变量';  // string 字符串
const minutes = 30;       // number 数字
const done = false;       // boolean 布尔值
const dueAt = null;       // 主动表示“没有截止时间”
let selectedTask;         // undefined 尚未赋值
```

字符串承载文字；数字用于计算；布尔值只有 `true` 和 `false`，用于表达是/否。`null` 常用于明确的空值，`undefined` 常出现在未赋值或读取不存在的属性时。

```js
console.log(typeof '30'); // string
console.log(typeof 30);   // number
console.log(typeof true); // boolean
```

`typeof` 可以帮助排查类型，但它不是万能判断器。例如 `typeof null` 是历史遗留的 `object`，数组也会得到 `object`；判断数组用 `Array.isArray`，下一章会用到。

数字 `30` 和字符串 `'30'` 看起来相似，行为可能完全不同。

```js
console.log(30 + 5);       // 35
console.log('30' + 5);     // '305'，发生字符串拼接
console.log(Number('30') + 5); // 35
console.log(Number('abc'));   // NaN，无法转换成有效数字
```

输入框拿到的值通常是字符串，`type="number"` 也不能替你保证业务数据有效。处理数字输入时，先去除首尾空格，检查不为空，再转换并验证：

```js
const raw = ' 25 ';
const cleaned = raw.trim();
const value = Number(cleaned);

if (cleaned === '' || !Number.isFinite(value) || value <= 0) {
  console.log('请输入大于 0 的有效分钟数');
} else {
  console.log('有效分钟数', value);
}
```

`Number('')` 会得到 `0`，所以空字符串需要先独立判断。`NaN` 不是普通数字，不能用 `value === NaN` 判断。

## 2.5 算术、比较和逻辑

| 运算 | 示例 | 结果/含义 |
| --- | --- | --- |
| 加减乘除 | `12 + 3`、`12 - 3`、`12 * 3`、`12 / 3` | 15、9、36、4 |
| 取余 | `13 % 5` | 3 |
| 严格相等 | `5 === 5`、`5 === '5'` | true、false |
| 严格不等 | `5 !== 3` | true |
| 大小比较 | `minutes >= 25` | 是否至少 25 分钟 |
| 与 | `hasTitle && isValid` | 两个条件都成立 |
| 或 | `isToday || isOverdue` | 至少一个条件成立 |
| 非 | `!done` | 把真变假、假变真 |

初学时优先使用 `===` 和 `!==`，避免 `==` 的隐式转换让结果难以预测。

```js
const total = 8;
const completed = 3;
const remaining = total - completed;
const percent = Math.round(completed / total * 100);
console.log(remaining, percent); // 5 38
```

`Math.round` 四舍五入。若 `total` 为零，不能直接套这个公式，应明确“没有任务时完成率为 0”：

```js
const total = 0;
const completed = 0;
const percent = total === 0 ? 0 : Math.round(completed / total * 100);
console.log(percent); // 0
```

`条件 ? 成立时的值 : 不成立时的值` 是三元运算符。适合选择一个简单结果，不要嵌套一串复杂业务。

### 真值和假值

在条件位置，`false`、`0`、`''`、`null`、`undefined`、`NaN` 等会被当成假；`[]`、`{}`、字符串 `'false'` 都是真。**判断空数组用 `tasks.length === 0`，不能用 `if (tasks)`。**

## 2.6 条件语句：按情况执行

```js
const minutes = 35;

if (minutes >= 60) {
  console.log('完成长时学习');
} else if (minutes >= 25) {
  console.log('完成一次专注');
} else {
  console.log('继续积累');
}
```

程序从上往下检查，命中一个分支后，不再进入后面的分支。这里输出“完成一次专注”。把 `60` 的判断放在 `25` 后面，会使超过 60 的情况先被 25 的分支截住。

验证标题是项目中的常见需求：

```js
const rawTitle = '   学习条件判断   ';
const title = rawTitle.trim();

if (title.length === 0) {
  console.log('标题不能为空');
} else if (title.length > 40) {
  console.log('标题过长');
} else {
  console.log('可以保存', title);
}
```

`.trim()` 返回去掉首尾空白的新字符串，不会删除中间空格。`.length` 是字符串长度；JavaScript 按 UTF-16 代码单元计算，表情符号不一定等于 1。早期项目把它当作技术长度限制，后面可按产品需求优化。

## 2.7 循环：重复处理

```js
let total = 0;

for (let day = 1; day <= 3; day += 1) {
  total += 20;
  console.log('第几天', day, '累计', total);
}
console.log('最终', total); // 60
```

`for` 圆括号内分三部分：

1. `let day = 1`：只执行一次，设置起点。
2. `day <= 3`：每轮开始前检查条件。
3. `day += 1`：每轮结束后让 day 加一。

`total += 20` 相当于 `total = total + 20`。不要漏掉让条件逐渐结束的操作，否则可能形成无限循环，导致程序卡住。

有数组以后，按元素处理还可以这样：

```js
const sessions = [20, 30, 25];
let total = 0;
for (const minutes of sessions) {
  total += minutes;
}
console.log(total); // 75
```

`[]` 中是一组值，`for...of` 逐个取出。本章先能理解重复相加，下一章详细学数组。

## 2.8 函数：给一段步骤取名字

```js
function minutesToSeconds(minutes) {
  return minutes * 60;
}

const result = minutesToSeconds(25);
console.log(result); // 1500
```

`function` 定义函数，`minutesToSeconds` 是函数名，定义处的 `minutes` 是形参，调用时的 `25` 是实参。`return` 把结果返回给调用者，同时结束本次函数执行。

“定义”和“执行”不同：只定义函数不会自动计算。函数可以多次调用，不同参数产生不同结果。

```js
console.log(minutesToSeconds(10)); // 600
console.log(minutesToSeconds(30)); // 1800
```

`console.log` 负责显示，`return` 负责交付结果，不可互相替代：

```js
function wrongAdd(a, b) {
  console.log(a + b);
}

const result = wrongAdd(2, 3); // Console 显示 5
console.log(result);          // undefined，没有 return
```

### 提前返回使校验更清楚

```js
function getTitleError(rawTitle) {
  const title = rawTitle.trim();
  if (title.length === 0) {
    return '标题不能为空';
  }
  if (title.length > 40) {
    return '标题不能超过 40 个代码单元';
  }
  return '';
}

console.log(getTitleError('   '));     // 标题不能为空
console.log(getTitleError('学习函数')); // 空字符串，表示没有错误
```

## 2.9 作用域：名字在哪能使用

```js
const subject = '小程序';

function printSubject() {
  const minutes = 25;
  console.log(subject, minutes);
}

printSubject();
// console.log(minutes); // 外面访问不到函数内部的 minutes
```

`let`、`const` 受块作用域约束，`if`、`for` 的花括号也会形成作用范围。不要通过把所有变量搬到文件最外层来解决访问问题；通常应通过参数传入、返回值传出。

常见区别：局部变量 `const count = 1` 不会自动变成页面数据。只有进入页面 `data` 并通过合适方式提交更新，WXML 才能使用它。

## 2.10 JSON 与 JavaScript 对象先分清

JS 中允许这样写：

```js
const config = {
  title: '我的学习',
  count: 0
};
```

JSON 文件中对应的写法是：

```json
{
  "title": "我的学习",
  "count": 0
}
```

JSON 是数据格式，不是放任意 JS 的地方。不能在 `app.json` 写函数、`const`、单引号字符串或注释。以后网络响应也常用 JSON，但“JSON 格式的文本”和“内存中的对象”仍是不同东西。

## 2.11 自测

1. 预测 `Number('12') + 3`、`'12' + 3`、`12 === '12'` 的结果。
2. 写一个函数 `getRemaining(total, completed)`，返回剩余任务数。
3. 写 `isValidMinutes(raw)`：字符串输入必须非空、转为有限数字、大于零且不超过 180。
4. 用循环把 `[15, 25, 40]` 求和。
5. 解释 `const` 为什么不等于“对象内部永远不能变化”（先带着问题进入下一章）。

通过标准：能手写条件函数，能解释参数和返回值，不把日志当返回值，不把字符串当数字。答案见第 09 章。

[下一章：对象、数组、函数与异步](03-对象数组函数与异步入门.md)
