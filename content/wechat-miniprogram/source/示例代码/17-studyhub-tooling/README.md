# 第36章：独立TypeScript与HTTP工具实验

这不是微信小程序目录，不导入微信开发者工具。完整业务继续使用第16组；本实验不修改其源码、云函数或依赖。

本实验字段简化为title/done/priority；服务只绑定本机127.0.0.1，X-Course-Actor=A/B是公开可伪造夹具，没有真实微信身份、会话、持久数据库、文件或生产后端。退出进程数据消失。

## 工具与实际验证

实测Node24.15.0、npm11.12.1、固定TypeScript5.9.3。实际生成package-lock.json并运行npm ci重建过；未全局安装/升级。node_modules不交付。

在本目录：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
```

check检查严格类型正例与四个预期错误注释；build只生成src到dist；test重新检查/构建、对照生成物并执行50项，含四个真实类型负例和回环HTTP。失败后停止，不运行旧dist。

TypeScript是开发依赖，运行已构建服务只用Node标准库。没有自动npx下载，编译器缺失会明确报错。

## 手动HTTP

```powershell
npm start
```

复制输出的实际URL，按第36章发请求；端口为临时空闲端口。GET /healthz明确fixture-only/persistent=false/wechatIdentity=false；任务接口使用固定actor。Ctrl+C关闭。

支持有界列表、创建、版本更新、固定原编号回执；没有删除、完整迁移、主工程草稿/outbox或跨进程事务。100记录/回执、4096字节正文、最多20条分页是课堂限值，不是平台额度。

## 文件关系

- src/contracts.ts：类型、运行时校验、DTO和公开错误。
- dist/：由固定编译器生成的JS与声明，测试核对字节。
- type-tests/：正常类型检查中的正例与预期错误。
- negative-cases/：故意错误，测试单独编译，不能加入正常构建入口。
- server/：内存模型与本机HTTP。
- client/：依赖注入式HTTP适配，不自动重试或另建opId。
- reports/latest.json：实际50项报告，源码摘要关联。
- optional/：WeUI与框架练习说明，未安装或运行。

## 课程关联

在教程根目录运行node 验证/verify-tooling.cjs，确认第16组600项既有记录与当前摘要匹配，再新跑本实验50，跨两类工程共650。不是本章重跑600，也不是完整小程序迁成TS或独立后端。

未执行WeUI/npm微信构建、Taro/uni-app、微信编译、真实登录/云/生产部署。本地测试不作发布结论。

- [第36章](../../36-TypeScript工具扩展与最终综合实践.md)
- [20组练习](../../第十六阶段-练习与参考答案.md)
- [运行验收](../../第十六阶段-工具运行与扩展验收.md)
- [最终综合实践](../../最终综合实践-毕业设计与能力验收.md)
- [本地验证记录](../../验证/第十六阶段验证记录.md)
