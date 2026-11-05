# 第36章：TypeScript、npm、组件库、框架、独立后端与最终综合实践

本章完成原定36章主线。到这里，你已经有一个包含任务、知识库、图片、专注、统计、草稿、待处理操作、权限、测试与维护准备的原生小程序。接下来要学的是：怎样有理由地引入工具，而不丢掉已经理解的业务规则。

完整业务工程仍是 [16-studyhub-operations](示例代码/16-studyhub-operations/README.md)。本章新增 [17-studyhub-tooling](示例代码/17-studyhub-tooling/README.md)，是独立的电脑端TypeScript与固定身份HTTP实验，不能导入微信开发者工具作为小程序，也没有替换主工程的后端。

配套：[20组练习](第十六阶段-练习与参考答案.md)、[工具运行与扩展验收](第十六阶段-工具运行与扩展验收.md)、[最终综合实践](最终综合实践-毕业设计与能力验收.md)、[完整源码附录](第十六阶段-完整源码附录.md)、[本地验证记录](验证/第十六阶段验证记录.md)。

## 36.1 先选要解决的问题

| 当前问题 | 可以考虑 | 本章提供什么 |
| --- | --- | --- |
| 经常拼错字段、弄混返回类型 | TypeScript | 真实编译与类型负例 |
| 依赖版本与安装过程难复现 | npm与锁文件 | 实际生成锁文件并运行npm ci |
| 重复做常见界面组件 | 原生组件封装或WeUI | 基于官方资料的接入练习，未编译 |
| 同时维护多个端 | Taro、uni-app等 | 选型与迁移方法，未建立框架工程 |
| 需要自有服务端与外部系统 | 独立后端 | 真实回环HTTP与客户端适配实验 |
| 只是不知道下一步学什么 | 先完成综合实践 | 业务、工程和真实环境分层验收 |

不要为了“技术栈看起来丰富”把所有工具同时加入主工程。一次只改变一个边界，才容易判断收益和错误来源。

## 36.2 分清代码运行在哪里

| 环境 | 常见入口 | 本课程例子 |
| --- | --- | --- |
| 微信客户端 | App/Page/Component与wx | 第16组miniprogram |
| 云函数Node环境 | 函数入口、可信云上下文 | 第16组cloudfunctions |
| 电脑Node环境 | node、npm、文件和HTTP工具 | 第17组编译、服务和测试 |
| 浏览器环境 | DOM、window、document | 不是小程序页面运行时 |

安装npm包不会把Node的文件系统、HTTP服务或DOM变成微信API。能通过TypeScript类型检查，也不证明该包能在小程序运行。

本章核对日期2026-11-03。TypeScript实验固定5.9.3以复现，不称其为最新版；当次官方手册已有其他版本入口。Node实测24.15.0、npm实测11.12.1。

## 36.3 两个工程各自负责什么

第16组保持第35章业务、27页和九集合模型，不进行框架重写。其600项本地场景与当前源码摘要关联，真实云和微信验收仍需执行。

第17组只演示小范围契约：任务标题、完成状态、普通/高优先级、版本和原编号。它没有完整任务字段、笔记、图片、计时、迁移、持久数据库或真实登录，不能直接接入主工程并宣称迁移完成。

这种独立实验的目的，是先理解工具和边界，再决定是否扩展到业务。

## 36.4 TypeScript最基本的类型标注

```ts
const title: string = '阅读一章';
const plannedMinutes: number = 25;
const done: boolean = false;
const tags: string[] = ['英语', '复习'];
```

冒号后是类型，不是赋值。string表示文字，number表示数值，boolean表示真假，string[]表示文字数组。

TypeScript在开发/编译时检查这些约定，运行前通常转换为JavaScript。微信和Node最终是否能执行，仍取决于输出语法与目标运行时。

参考[官方基础类型手册](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)；以下业务类型是课程自己的设计。

## 36.5 类型推断与错误位置

```ts
let count = 0;       // 推断为number
count = count + 1;
// count = '很多';   // 取消注释后产生类型错误
```

不是每个变量都要写冒号。对容易变化的边界、函数参数和返回协议写清楚，对明显的局部变量可使用推断。

“编译错误”不是运行中弹出的Toast。先看文件和行号，确认传入值与约定为何不同，不要立即加any消除提示。

## 36.6 用interface描述对象，用联合限制取值

实验src/contracts.ts包含：

```ts
export type Priority = 'normal' | 'high';
export interface TaskFields {
  title: string;
  done: boolean;
  priority: Priority;
}
export interface TaskDTO extends TaskFields {
  id: string;
  version: number;
}
```

interface描述对象有哪些字段；extends表示TaskDTO同时具备TaskFields字段，并增加id/version。export让其他模块能导入这些声明。

'normal' | 'high'是两个字符串字面量的联合，不能随便写'urgent'。这里是独立实验的简化规则，与主工程的完整优先级/任务模型分别管理。

## 36.7 函数类型表达输入与输出

```ts
function displayTitle(task: TaskFields): string {
  return task.done ? '已完成：' + task.title : task.title;
}
```

参数task必须满足TaskFields，返回值约定为string。函数仍执行普通JavaScript逻辑，类型声明不替你实现业务。

如果需要异步，返回类型可写Promise<TaskDTO>，表示等待后得到TaskDTO；这不表示请求一定成功，也不取消网络错误。

## 36.8 泛型：同一种外壳装不同数据

```ts
export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: Code; message: string } };
```

T是类型参数。Reply<TaskDTO>的成功data是一条任务；Reply<TaskPage>的成功data是一页任务。

泛型复用的是结构约定，不会自动在网络上生成JSON，也不会检查JSON内容。真正的HTTP响应仍先视为unknown。

## 36.9 可辨别联合与缩窄

```ts
function readTitle(reply: Reply<TaskDTO>): string {
  if (reply.ok) {
    return reply.data.title;
  }
  return reply.error.message;
}
```

ok为true时，编译器知道走成功分支；另一个分支才有error。这叫依据共同字段缩窄联合。成功分支访问reply.error会产生类型错误。

这里的前提是reply确实符合协议。外部数据没有经过校验就强制声明成该类型，仍可能运行失败。参见[官方缩窄手册](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)。

## 36.10 unknown为什么适合外部数据

```ts
const external: unknown = JSON.parse(text);
// external.title不能直接读取
const fields = parseFields(external);
```

unknown表示目前不知道具体结构。你必须先判断是不是对象、字段类型与范围是否符合要求，然后才能当业务对象使用。

any会绕过大量检查。它适合少数经过解释的边界，不适合用来把所有红线清掉。本实验的解析函数接受unknown并在运行时验证。

## 36.11 as与类型擦除的误区

```ts
// 反例：断言不是校验
const task = JSON.parse('{"done":"不是布尔值"}') as TaskDTO;
```

as告诉编译器按某类型理解，不会补字段、改数据或阻止恶意输入。interface、type与大多数类型标注也不会作为运行时规则保留。

本实验在数组所有条目通过isTask后才使用受限断言表达已验证结果；这与在网络入口直接as不同。任何断言都要能指出前面的事实依据。

## 36.12 完整的运行时字段校验

核心规则排版如下，实际工程提供完整文件：

```ts
export function parseFields(value: unknown): TaskFields {
  const data = shape(value, ['title', 'done', 'priority']);
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 40 ||
    typeof data.done !== 'boolean' ||
    (data.priority !== 'normal' && data.priority !== 'high')
  ) {
    throw new DomainError('INVALID_INPUT');
  }
  return {
    title: data.title.trim(),
    done: data.done,
    priority: data.priority
  };
}
```

shape先保证对象只含这三个字段；if验证类型、非空、长度和允许值；return从零构造规范结果。类型缩窄让最后的priority自然符合字面量联合。

40按JavaScript代码单元计算，不声称是40个用户感知字符。业务限值是课堂选择，不是微信上限。

## 36.13 为什么未知字段也要处理

客户端传owner:'B'不应该改变服务器记录归属。本实验直接拒绝多余字段；真实主工程也保持明确的字段允许列表。

DTO响应同样校验，额外owner、错误version、重复ID、乱序和不匹配游标都会被拒绝，避免“接口有返回”被当作“结果可用”。

运行时校验与服务端归属检查各自负责一层，不能互相替代。

## 36.14 tsconfig的几个关键选项

| 选项 | 本实验值 | 作用 |
| --- | --- | --- |
| strict | true | 启用一组严格类型检查 |
| noUncheckedIndexedAccess | true | 数组/索引读取可能不存在 |
| exactOptionalPropertyTypes | true | 更精确地区分可选属性与显式undefined |
| noEmitOnError | true | 类型错误时不生成本次输出 |
| target | ES2020 | 选择输出语法目标 |
| module | commonjs | 与本实验CJS模块配合 |
| types | [] | 不自动纳入不需要的环境类型 |
| outDir | dist | 输出到独立目录 |

这些设置适用于本实验，不是所有微信TS项目的唯一配置。target不负责为运行时补齐API；lib声明也不等于运行环境真的拥有相应能力。

noEmitOnError默认并非true，本实验显式启用。它也不自动删除旧dist，因此任何编译失败都要停止后续运行。[官方选项说明](https://www.typescriptlang.org/tsconfig/noEmitOnError.html)

## 36.15 CommonJS、ES模块与文件扩展名

源TS使用import/export，编译设置将其转换为CommonJS；服务与工具用.cjs，通过require加载dist/contracts.js。

package.json没有设置type=module，所以本实验的.js输出按CommonJS运行。不要把另一个教程的ESM入口、require和不同module设置随意混合。

微信工程也有自己的模块与构建约束。此处讲的是电脑端实验，不能据此把Node服务文件放进miniprogram。

## 36.16 安装、检查、构建与运行

进入示例代码/17-studyhub-tooling：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
```

先用真实锁文件安装开发依赖，再检查正例/预期错误，构建src，最后执行50项实验。任何非预期失败都停止后续步骤。

本次实际安装TypeScript 5.9.3，生成package-lock.json，并用npm ci重建过依赖。没有全局安装或更新npm。离线机器需要事先准备可用依赖；命令失败不能假装编译已经执行。

## 36.17 类型错误也可以成为测试

type-tests/positive.ts包含四个注释，例如：

```ts
// @ts-expect-error done必须是布尔值
const wrong: TaskFields = { title: 'x', done: 'false', priority: 'normal' };
```

注释针对紧接的一行，错误位置也需要落在该行。若该行不再产生错误，编译器会报告注释未被使用。[官方说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html)

negative-cases还有四个不带抑制注释的文件，由测试单独编译并要求真实诊断。它们故意不包含在正常构建入口，不能把“负例被拒绝”误判为整个工程失败。

## 36.18 看看编译后的JavaScript

打开dist/contracts.js与src/contracts.ts对照：interface与type不再作为对象存在，但parseFields的判断、DomainError和返回对象还在。

dist/contracts.d.ts只描述类型，不执行校验。别把声明文件当成服务器验证代码。

实验额外用同一编译器计算输出并与交付dist逐字节比较；这证明输出对应当前源代码，不证明它适合微信运行时或生产服务器。

## 36.19 npm包、开发依赖与运行依赖

package.json用devDependencies固定TypeScript。它用于电脑编译；编译出的运行代码没有require('typescript')。

服务自身只用Node标准库，所以运行已经生成的dist不需要TS编译器，但重新检查与构建需要安装开发依赖。

主工程云函数仍有自己的wx-server-sdk依赖。不要把第17组的package.json覆盖到第16组根、miniprogram或云函数目录。

## 36.20 锁文件记录什么

本次package-lock.json实际记录固定版本、公开registry来源、integrity和依赖结构。它帮助复现解析结果，不是软件没有漏洞的证明。

package.json表达意图，锁文件记录具体解析，node_modules是本机安装结果。交付包含前两者与课程源码，排除node_modules；接收者运行npm ci恢复。

修改依赖后应审查锁文件差异并重测。不要手工编造integrity或把别的工程锁文件复制来充数。

## 36.21 install、ci与安装脚本

npm install适合有意调整依赖并更新锁文件；npm ci要求锁文件与清单一致，并重建安装目录。实际行为以所用npm版本为准。[npm ci官方文档](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

本实验用--ignore-scripts关闭安装生命周期脚本；--no-audit与--no-fund减少附加网络/提示，不代表做过安全审计。ignore-scripts也不能让任意包天然安全。

在课程配置下，显式npm run build/npm test仍用于执行你选择的课程脚本。先读scripts，确认自己正在什么目录运行。

## 36.22 为什么不让npx临时下载未知工具

工具入口使用本地安装的typescript/bin/tsc，并检查版本5.9.3。不支持时明确报错，要求先安装依赖，不自动下载另一个版本。

这让“运行了哪个编译器”可核对。npx本身不是错误工具，但自动获取行为、包名与版本都应当清楚，不能用它掩盖缺失依赖。

第一次遇到Cannot find module时，先查目录、安装是否成功、锁文件和版本，不在所有文件里改require路径。

## 36.23 为什么Node包未必能用于小程序

依赖可能使用fs、http服务、process、Buffer、DOM、动态加载或不被目标构建支持的语法。类型声明能找到，不等于这些能力在微信中存在。

第17组用Node的HTTP、Buffer和TextDecoder处理字节，明确只在电脑运行。微信选择文件、网络和页面仍应使用对应平台能力与已核对的封装。

引入包前读入口、运行环境、依赖树、体积、许可证和维护记录，再在隔离工程做实际编译与真机验证。

## 36.24 如果逐步把原生主工程改成TS

先选纯函数，不选整个App：复制一个任务校验模块，写入类型、错误与边界，再验证输出行为与原JS一致。

然后逐步处理仓储接口、DTO、组件参数和页面事件。微信API类型可以帮助编辑器检查，但版本与真实基础库仍需核对。

每一步只保留一个业务实现来源，明确生成输出与导入路径。不要同时维护两份渐渐不同的JS/TS校验。主工程三组客户端/云共享协议仍要保持一致。

本章没有执行主工程TS迁移，也没有证明任意微信TS模板可直接运行。

## 36.25 WeUI解决的是界面复用

WeUI小程序组件库提供常见界面能力，不能替你实现任务归属、原编号、草稿、隐私或网络恢复。本章读取了[官方快速上手](https://wechat-miniprogram.github.io/weui/docs/quickstart.html)与[加载组件说明](https://wechat-miniprogram.github.io/weui/docs/loading.html)。

接入路径可选扩展库或npm，具体条件按当前工具核对。这里提供npm候选练习，固定版本1.5.6与当次[官方仓库清单](https://raw.githubusercontent.com/wechat-miniprogram/weui-miniprogram/master/package.json)一致，不称为永远最新。

没有安装WeUI或在微信工具构建，所以以下步骤仍是待执行练习。

## 36.26 一个WeUI加载组件练习

复制第16组为独立练习工程，在其客户端miniprogram目录单独管理组件依赖，按当前工具的npm构建设置核对包目录。不要在第17组电脑工具目录安装后期待微信自动发现它。

候选命令：

```powershell
npm install --save-exact weui-miniprogram@1.5.6 --ignore-scripts --no-audit --no-fund
```

按官方说明构建npm、核对生成目录和样式入口，再在练习页JSON登记：

```json
{
  "usingComponents": {
    "mp-loading": "weui-miniprogram/loading/loading"
  }
}
```

```xml
<mp-loading show="{{loading}}" type="circle" tips="正在读取任务" />
```

loading仍应由原请求状态决定；组件只显示状态。请求结束或失败后按原finally逻辑结束加载，不能因为引入组件就丢掉竞态控制。

完整步骤与样式核对见第17组optional中的练习说明，没有把未构建组件计入测试。

## 36.27 组件库验收不能只看截图

检查基础库与渲染器、实际包体、样式隔离、长文本、大字、深色、读屏、点击目标、禁用与加载状态、分包以及失败恢复。

新增组件若带上传、分析或网络能力，还要回到第34章数据清单。官方风格一致也不能替代你自己的业务与无障碍验收。

需要的只是两个简单按钮时，原生控件和已有组件可能已足够。选择取决于具体收益与维护成本。

## 36.28 原生、Taro与uni-app怎样比较

| 路线 | 更适合的已有条件 | 新增成本 |
| --- | --- | --- |
| 原生 | 重点微信能力，团队已掌握本课程 | 多端需另做适配 |
| Taro | 已有React/Vue经验，确有多端需求 | 框架、构建、运行时和端差异 |
| uni-app | 选择其Vue与跨端工具路线 | 模板/编译模式、条件代码与端能力差异 |

本次读取[Taro官方仓库](https://github.com/NervJS/taro)与[uni-app官方跨端说明](https://uniapp.dcloud.net.cn/matter.html)。这些材料说明路线与差异，不证明某版本组件在你的所有目标端都一致。

没有安装Taro/uni-app，也没有生成或运行框架项目。本章不给出未经验证的“一条命令全端迁移完成”。

## 36.29 先理解不同的界面表达

原生写法：

```js
Page({
  data: { count: 0 },
  onAdd() { this.setData({ count: this.data.count + 1 }); }
});
```

在其他框架中，你会遇到React的state更新函数、Vue的响应式变量和模板指令。它们都在表达“状态改变后更新界面”，但API、生命周期、构建与平台映射不同。

不要把某端的浏览器DOM写法直接粘贴到小程序，也不要把Vue模板语法直接写进WXML。本课程先打好的事件、组件、状态和异步基础仍然有用。

## 36.30 框架迁移先做一个纵向小功能

选“读取固定任务列表—显示空态—失败重试”作为试点。保持同一接口契约与测试数据，分别验证状态、分页、原编号、权限和界面。

再扩展一项写入，随后才接知识库或计时。样式正常不代表后台恢复、隐私和幂等已迁移。

避免同时换框架、后端、数据模型和同步协议。若结果变坏，你会很难知道是哪一层造成。

## 36.31 什么时候考虑独立后端

当你需要自有服务部署、复杂外部集成、统一多端身份或更明确的运维边界时，可以评估独立后端。

你同时要负责认证、会话、数据库、事务、文件、网络、安全、监测、备份和费用等工作。后端不是把云函数复制到Express文件后就自然完成。

本章使用Node标准库演示边界，不引入Web框架，便于看清HTTP层究竟做了什么。

## 36.32 真实微信身份应怎样衔接

真实路线应由客户端取得一次性登录凭证，交给自己的后端；后端按当前微信官方服务端接口核验，再建立自己的会话与授权规则。密钥只能在服务端管理，不能接收客户端自报的OPENID作为可信身份。

本次微信npm与code2Session开发者页面未取得正文，因此不拼装未经核对的登录服务。本实验使用X-Course-Actor=A/B，是公开可伪造的固定夹具，只用于本机测试。

任何人都能把A改B。该实验没有微信登录、真正认证、持久会话、令牌刷新或生产权限模型，不能作为上线后端。

## 36.33 实验HTTP协议

| 方法与路径 | 输入 | 成功 |
| --- | --- | --- |
| GET /healthz | 无 | 固定夹具状态，不代表业务健康 |
| GET /v1/tasks | limit、cursor | 200，items与nextCursor |
| POST /v1/tasks | opId、fields | 201，TaskDTO |
| PATCH /v1/tasks/t0001 | opId、version、fields | 200，TaskDTO |

未知路由404、不支持方法405、输入400、夹具身份401、版本409、请求体413、媒体类型415、内存容量429，内部异常500且只回固定公开文案。

状态码与JSON结构共同解释结果。HTTP200并不保证业务DTO正确，客户端仍要解析。

## 36.34 启动并手动请求本地服务

构建成功后在第17组运行：

```powershell
npm start
```

服务仅绑定127.0.0.1的临时空闲端口，并输出实际URL。复制输出，例如实际端口是51000时，在另一终端：

```powershell
$apiBase = 'http://127.0.0.1:51000'
$actorHeaders = @{ 'X-Course-Actor' = 'A' }
Invoke-RestMethod -Uri "$apiBase/healthz"
$body = @{
  opId = 'operation_manual001'
  fields = @{ title = '学习HTTP'; done = $false; priority = 'normal' }
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri "$apiBase/v1/tasks" -Headers $actorHeaders -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Invoke-RestMethod -Uri "$apiBase/v1/tasks" -Headers $actorHeaders
```

51000只是说明端口，必须改为本次输出。Ctrl+C关闭服务后内存清空；没有持久保存。手机里的127.0.0.1也不指向你的电脑，本实验并未连接真机。

## 36.35 请求体上限按字节计算

server/index.cjs中的readJson函数按收到的Buffer长度累计，超过4096字节即拒绝，之后不再累积正文。结束时以严格UTF-8解码，再JSON.parse。

中文通常占多个UTF-8字节，不能只看JavaScript字符串length。实验测试专门用“字符数不足4096、字节数超过4096”的正文验证413。

4096是课堂上限，不是微信或Node默认额度；真实服务还需网关、超时、速率、解析和资源限制。[Node HTTP资料](https://nodejs.org/download/release/v24.15.0/docs/api/http.html)

## 36.36 内存模型怎样隔离记录

服务器把固定actor作为内部owner，DTO只返回id、version、title、done、priority。列表过滤owner，更新时同时检查归属，不信任请求正文中的owner。

在课堂固定身份假设下，这验证了“作用域必须进入查询/写入条件”的规则；它不能证明真实身份认证安全，因为actor本来就可伪造。

记录与回执均为进程内Map。代码没有数据库锁、跨进程事务或持久备份。

## 36.37 原编号与版本继续保留

创建/更新先规范化输入，按actor+opId查回执。同编号同内容重放返回旧结果，同编号改内容拒绝。

更新还要求当前version一致，成功只加一次。这个进程内教学模型可以帮助理解协议，但不是分布式幂等证明。

回执是历史结果，不是当前记录的强一致快照。真实迁移仍应沿用第25、30章完整草稿/outbox与回执协议。

## 36.38 分页与容量不能悄悄破坏约定

列表按ID继续，返回nextCursor；客户端不能把第一页当全量。限值1—20为课堂查询约定。

内存记录/回执默认上限100，满后阻止新写入，已有回执仍可重放。不能为了腾空间直接删回执，让旧指令突然再次生效。

真实后端应设计持久容量、过期操作拒绝、归档与清理；本实验没有实现这些生产流程。

## 36.39 客户端适配层负责哪一段

client/tasks-client.cjs接收一个request依赖：

```js
const client = createTasksClient({
  request: async ({ method, url, data }) => {
    // 传输层返回 { statusCode, data }
  }
});
```

list/create/update决定路径、状态与解析；传输层决定地址、会话、网络与平台API。测试既可传固定响应，也可接真实Node回环请求。

迁入微信时可以另做wx.request传输，但还要保留取消、期限、原编号、错误类型与合法域名等完整约束。本章没有直接替换主工程仓储。

## 36.40 适配层不自动修复未知写入

适配层不额外重试、不生成新opId，不把网络异常改成成功。create/update参数由原业务提交流程提供。

响应错误码只映射固定公共文案，不原样显示任意服务器message。成功状态不匹配、DTO非法或游标不一致都属于协议错误。

真正后端接入后，要测试“已提交但响应丢失”与重放；仅能正常GET一条数据不算迁移完成。

## 36.41 从实验到生产还缺什么

| 领域 | 本实验 | 真实接入前 |
| --- | --- | --- |
| 身份 | 固定可伪造A/B | 可信登录、会话、授权 |
| 数据 | 进程Map | 持久数据库、事务与并发验证 |
| 传输 | 本机HTTP | 实际HTTPS、合法域名、网络与隐私核对 |
| 文件 | 无 | 私人存储、归属、引用与清理 |
| 恢复 | 无持久备份 | 备份、恢复演练与回退 |
| 运维 | 固定本地测试 | 日志、告警、资源、依赖与负责人 |
| 数据治理 | 不接真实用户 | 告知、期限与适用权利机制 |

框架和类型系统不会替你填上这些空格。第34—35章的正式交付阻塞项依然有效。

## 36.42 三类测试分别证明什么

类型测试证明编译器是否接受或拒绝某种用法；运行时测试证明未知值经过校验后的行为；真实回环HTTP测试证明本机请求、字节、状态与适配链路。

本章新增50项，实际运行TypeScript5.9.3并拒绝四个无抑制负例。主工程保留原600项场景且摘要匹配，跨两类工程共650项，不说成一个微信项目运行了650种互不重复功能。

没有运行WeUI构建、Taro/uni-app、微信编译、真实微信身份或生产后端。报告明确记录这些范围。

## 36.43 工具迁移的验收顺序

先固定原行为与数据，再选一个小模块；写正例、类型负例和运行时非法输入；检查生成代码、依赖与输出目录；最后在目标平台编译、真机与真实权限验证。

测试通过后再扩大范围。任何“删校验后编译就过了”“换新opId就不冲突了”都可能改变业务协议，而不是解决工具问题。

## 36.44 最终综合实践的业务目标

以第16组为候选，实现并理解：私人任务增删改查、知识库与标签/链接、图片引用、专注会话与恢复、七日统计、草稿与待处理、平台实验、质量与维护准备。

你应能从按钮追到页面、仓储、云函数、事务与记录，再解释返回和恢复。具体执行步骤见 [最终综合实践](最终综合实践-毕业设计与能力验收.md)。

课程已经提供相对复杂业务代码；能在你自己的环境运行，还需要实际账号、部署、权限和真机操作。

## 36.45 分清课程完成与正式服务完成

36章正文、代码、练习和本地验证已经组成完整学习主线；正式服务仍需你完成真实部署、系统权限、数据隔离、隐私材料、期限/权利机制、审核与维护演练。

已有单条删除和汇总报告不等于完整账户处理或全量个人数据导出。未实现的生产能力不能靠在材料里勾选完成。

最终验收把“能解释”“本地已验证”“真实环境已验证”“尚未实现”分别记录，不把它们混成一个绿勾。

## 36.46 选择一个独立扩展作业

可选择分类管理、任务日历、知识库过滤、专注计划模板或一个新的只读统计维度。先写输入、输出、权限、口径、失败恢复和验收，再设计界面。

不要第一次扩展就同时加入支付、公开内容、定位和复杂消息。这些能力有独立平台、业务与资质条件，应逐专题查当前官方资料。

扩展必须保持原归属、版本与原编号约束，并重新核对数据清单。

## 36.47 学完后怎样巩固

第一轮不看源码，从空目录写本地任务板；第二轮独立做多页面和组件；第三轮接网络并制造失败；第四轮在隔离云环境验证两账号与恢复。

遇到疑惑回到相应章节：语法02—03、页面/组件10—15、网络16—19、云与权限20—25、完整业务26—29、体验与交付30—35。

最后再决定TS、组件库、框架或后端路线。能够解释并验证当前工程，比记住更多工具名称更有价值。

## 36.48 全课程主线完成标准

你能独立拆需求、写基本语法、组织页面/组件、处理网络与云端身份、设计数据和并发协议、排查失败，并给出有证据的验收记录。

你也知道能力边界：本地模拟不是微信运行时，类型不是运行时校验，体验版不是测试云，回退代码不是还原数据，材料齐全不是自动获得发布资格。

保存前面各阶段版本作对照，按最终实践表完成自己的真实结果。后续学习可以围绕一个具体需求继续深入，而不需要一次掌握微信平台的全部API。
