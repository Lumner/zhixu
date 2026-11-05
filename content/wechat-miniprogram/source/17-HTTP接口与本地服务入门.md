# 17 HTTP、接口与本地服务入门

建议 3—5 小时。本章第一次让小程序连接一个真正的本地 HTTP 服务。先理解请求/响应，再启动服务，最后导入网络实验项目。无需数据库、付费服务器或第三方 API Key。

## 17.1 前端和服务端是两个运行环境

```text
微信开发工具中的小程序
    └─ wx.request 发出请求
            ↓ HTTP
电脑上运行的 Node.js 教学服务
    └─ 查找固定资源并返回 JSON
            ↓
小程序收到响应，更新界面
```

服务端不是一个特殊的网页页面，而是监听端口、接收请求的程序。本项目 server/server.cjs 用 Node.js 标准库运行；miniprogram 中的代码交给微信开发工具运行。

同为 JavaScript，不代表 API 相同。服务端有 node:http、文件与进程能力；小程序有 wx、Page、Component。不要在 Node 终端里直接执行 Page 文件期待出现界面，也不要把 node:http 导入小程序客户端。

## 17.2 一个 URL 怎么读

```text
http://127.0.0.1:3210/api/resources?q=WXML&limit=10
  协议     地址     端口       路径          查询参数
```

http 是本地实验协议；127.0.0.1 指当前设备自己；3210 是服务监听端口；/api/resources 定位接口；q 和 limit 描述本次查询。

端口可以类比同一栋楼里的不同窗口。程序没有监听这个端口，或者访问了另一台设备的回环地址，就找不到服务。

## 17.3 HTTP 请求由什么组成

| 部分 | 本项目例子 | 职责 |
| --- | --- | --- |
| 方法 | GET / POST | 表达读取或提交等操作意图 |
| 地址 | /api/resources | 指向某个接口 |
| 查询参数 | q、category、cursor、limit | 描述读取条件 |
| 请求头 | content-type: application/json | 说明发送的数据格式等元信息 |
| 请求体 | `{ "title": "学习网络" }` | POST 等请求携带的内容 |

GET 本例只读资源；POST /api/echo 用来观察 JSON 请求体，并不保存任务。实际 API 的业务由服务端定义，不是换个方法名就自动创建数据库记录。

## 17.4 响应的三层结果

1. 有没有成功建立连接并收到响应：网络层。
2. HTTP 状态码是什么：协议层，例如 200、400、404、503。
3. body 是否符合约定、业务是否成功：应用层。

本项目成功响应：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "nextCursor": null,
    "total": 0
  }
}
```

业务失败响应可能仍是 HTTP 200：

```json
{
  "ok": false,
  "error": {
    "code": "DEMO_REJECTED",
    "message": "模拟业务拒绝，请切回正常模式"
  }
}
```

ok/data/error 是我们为课程制定的接口契约，不是微信为所有服务器强制规定的字段。调用别人的接口时必须先看对方文档。

## 17.5 常见状态码先掌握这些

| 状态 | 含义 | 本课处理思路 |
| --- | --- | --- |
| 200 | 本次 HTTP 请求成功返回 | 继续看业务和结构 |
| 400 | 请求参数或格式不符合要求 | 修正输入，不盲目自动重试 |
| 401 | 缺少或无效的认证 | 后续登录章节处理 |
| 403 | 不允许访问 | 后续权限章节处理 |
| 404 | 找不到对应资源/接口 | 检查路径和资源状态 |
| 405 | 方法不允许 | 检查 GET/POST 等方法 |
| 413 | 请求体过大 | 减少数据或调整明确的业务限制 |
| 503 | 服务暂时不可用 | 本课 GET 可有限重试 |

更多解释见 [MDN HTTP 状态码](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Status)。不要把所有 4xx/5xx 都归成“用户网络不好”。

## 17.6 JSON 文本和 JS 对象的转换

服务器用 JSON.stringify 把对象写成响应文本，客户端解析后得到对象。微信请求配置 dataType:'json' 时会处理 JSON 解析，通常不要再对 response.data 无条件 JSON.parse。

```js
const object = { title: '学习 HTTP', done: false };
const text = JSON.stringify(object);
console.log(typeof text); // string
console.log(JSON.parse(text).title); // 学习 HTTP
```

Content-Type 用来说明内容格式，不会把一段坏 JSON 自动修好。状态码 200 却返回 HTML 错误页，依然不能当资源数组渲染。

## 17.7 认识这次的项目目录

```text
04-studyhub-network/
├─ project.config.json
├─ README.md
├─ server/
│  ├─ server.cjs
│  └─ fixtures.cjs
└─ miniprogram/
   ├─ app.js / app.json / app.wxss
   ├─ config/network.js
   ├─ services/request.js / resource-api.js / resource-cache.js
   ├─ models/resource-pager.js
   ├─ pages/resources/          新增资源页
   └─ 之前 v0.2 的页面、组件与本地任务仓储
```

导入开发工具时选外层 04-studyhub-network。project.config.json 的 miniprogramRoot 为 miniprogram/，所以服务端文件不属于小程序代码目录。先前版本没有这一层目录，是因为当时只需要客户端。

## 17.8 安装或确认 Node.js

若电脑已有 Node.js，打开 PowerShell：

```powershell
node --version
```

如果提示找不到命令，从 [Node.js 官方下载入口](https://nodejs.org/en/download) 安装适合系统的 LTS 版本，安装后重新打开终端。无需因为某个教程截图不同就安装多个版本。

本项目服务端只用标准库，没有第三方依赖，不需要 npm install。本课的 `.cjs` 扩展名明确选择 CommonJS 模块方式；小程序的 require 仍由微信环境处理。

## 17.9 启动服务端

在项目外层目录打开终端。例如当前课程位置：

```powershell
Set-Location -LiteralPath 'C:\Users\17597\Desktop\微信小程序综合实践作业\微信小程序从零开发教程\示例代码\04-studyhub-network'
node .\server\server.cjs
```

看到 `StudyHub teaching server: http://127.0.0.1:3210/health` 后，让这个终端保持运行。按 Ctrl+C 才会停止服务。

在浏览器打开 [本地健康检查](http://127.0.0.1:3210/health)，应看到 ok:true，资源数量 45。这只证明电脑能访问本机服务，还不能证明手机或小程序已满足各自网络条件。

端口已占用会报错。可以先停止占用该端口的你自己的旧教学服务，或显式换端口：

```powershell
node .\server\server.cjs --port 3211
```

换端口时还要同步修改 miniprogram/config/network.js 的 BASE_URL，不是只改一边。

## 17.10 用 PowerShell 直接请求，隔离客户端问题

另开一个终端：

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3210/api/resources?q=WXML&limit=10'
```

测试 JSON POST：

```powershell
$lessonBody = @{ title = '学习网络'; count = 2 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3210/api/echo' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($lessonBody))
```

lessonBody 是本次练习变量；UTF-8 字节明确编码，避免不同 PowerShell 版本处理中文请求体时出现差异。返回 data.received 应包含刚才提交的字段。

命令调用成功而小程序失败，优先查客户端地址与平台网络设置；命令也失败，先查服务是否启动、端口和请求路径。

## 17.11 导入小程序与本地调试条件

1. 导入 04-studyhub-network 外层目录，填自己的 AppID 或工具允许的测试方式。
2. 确认识别的小程序目录是 miniprogram/。
3. BASE_URL 保持 http://127.0.0.1:3210，与服务端一致。
4. 本项目为本地实验在 project.config.json 中设置 urlCheck:false。若工具仍拦截，请在当前版本的“本地设置”相关界面核对合法域名/HTTPS 校验选项，仅用于本机调试。
5. 编译后打开底部“资源”标签，正常模式应出现第一页 10 条。

微信正式网络能力有合法域名、HTTPS 等平台要求；开发工具临时放宽校验不是线上配置方案。正式环境应使用满足平台要求的服务地址，不能把 localhost 和这个调试设置当作发布后可用的网络方案。官方入口：[网络能力说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。

当前检索工具仍无法直接读取微信文档站，操作界面和账号条件应以你实际打开的官方文档及开发工具为准。本次实际核对了 [官方请求 API 类型与注释](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)。

## 17.12 第一个原生 wx.request 例子

在练习页方法中可这样观察回调：

```js
wx.request({
  url: 'http://127.0.0.1:3210/api/resources',
  method: 'GET',
  data: { q: 'WXML', limit: 10 },
  timeout: 1800,
  success(response) {
    console.log('HTTP 状态', response.statusCode);
    console.log('响应数据', response.data);
  },
  fail(error) {
    console.error('传输失败', error);
  },
  complete() {
    console.log('这次底层调用已结束');
  }
});
```

success 表示进入响应处理路径，不等于业务已成功；仍要看 statusCode、ok 和数据形状。complete 也不能用作成功提示，因为失败后同样会执行。下一章会把判断统一放进请求层。

## 17.13 服务端是怎样响应的

关键步骤：createServer 注册每次请求的处理函数；URL 解析路径和参数；校验 q/category/cursor/limit；从固定数组筛选与切片；writeHead 设置状态与内容格式；end 发出 JSON 文本。

```js
const filtered = resources.filter(item =>
  item.title.toLowerCase().includes(q)
  && (category === 'all' || item.category === category)
);
const items = filtered.slice(offset, offset + limit);
```

这是服务端处理，不需要页面下载 45 条后再假装网络分页。服务端仍然用内存中的固定课程资源，没有数据库，重启不会丢失这些固定条目；也没有实现账号和私人云端任务。

Node 的 http.createServer、请求和响应 API 可查 [Node.js 官方 HTTP 文档](https://nodejs.org/api/http.html)。完整服务端见源码附录。

## 17.14 手机上的 127.0.0.1 是谁

它指手机自己，不是电脑。仅在电脑开发工具中用回环地址跑通，并不保证真机可连接。

如需在可信局域网继续实验，可以手动以 `--host 0.0.0.0` 启动教学服务，并把 BASE_URL 改为电脑实际局域网 IPv4 地址和端口。电脑与手机需要网络可达，系统防火墙和微信真机调试条件也可能影响连接。本课程不会替你自动修改防火墙。

0.0.0.0 是监听地址，不是让手机填写的目标地址。不要把电脑内网地址写成所有用户都能访问的正式后端；正式部署在后续阶段处理。

## 17.15 常见问题与练习

connection refused：程序没启动、端口不对或服务已退出。timeout：地址不可达、网络慢或特意选择了延迟模式。HTTP 404：接口路径不对。浏览器能打开但小程序失败：查合法域名/HTTPS 设置与客户端地址。网页 CORS 与原生小程序的平台网络限制不同，不要遇到所有请求问题都盲目添加 Access-Control-Allow-Origin。

练习：请求第二页 cursor=10；把 limit 改成 -1 观察 400；请求不存在路径观察 404；POST 一个中文对象；切到业务拒绝模式，解释为何 HTTP 200 仍要提示失败。

[下一章：请求封装、取消与竞态](18-请求封装错误处理与竞态控制.md)
