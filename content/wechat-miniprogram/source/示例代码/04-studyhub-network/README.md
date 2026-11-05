# 学伴网络实验版：第 16—19 章

本项目保留 v0.2 本地任务功能，新增网络资源标签。资源服务提供 45 条固定练习；支持分页、搜索、分类、下拉刷新、故障模拟和加入本地任务。尚未实现账号、云数据库或任务云同步。

## 运行步骤

1. 确认安装 Node.js，在此目录打开 PowerShell。
2. 运行 `node .\server\server.cjs`，保持终端运行。
3. 浏览器访问 [本地健康检查](http://127.0.0.1:3210/health)，应看到资源数量 45。
4. 微信开发者工具导入此目录，填自己的 AppID 或工具允许的测试方式。
5. project.config.json 指定 miniprogramRoot 为 miniprogram/；本地实验 urlCheck:false 只用于开发工具连接 HTTP 回环服务，正式服务应满足平台 HTTPS/合法域名要求。
6. 打开“资源”标签，正常模式显示第一页；切换实验模式观察失败与恢复。

默认 BASE_URL 在 miniprogram/config/network.js。3210 被占用时可 `node .\server\server.cjs --port 3211`，同时改客户端地址。停止服务按 Ctrl+C。

手机的 127.0.0.1 指手机自己。局域网调试需要用电脑实际地址、显式监听参数以及符合当前微信工具/真机条件；详见 [第 17 章](../../17-HTTP接口与本地服务入门.md)。

## 接口约定

- GET /health：健康检查。
- GET /api/resources：q/category/limit/cursor，返回 items/nextCursor/total。
- POST /api/echo：JSON 回显，不持久化。
- 资源实验 mode：normal、flaky、http503、business、malformed；delayMs 可模拟延迟。

flaky 对同一组条件首次失败后恢复，重启服务重置该实验记忆。客户端 slow 模式对应 4 秒延迟，用于观察 1.8 秒单次超时和有限重试。

资源分页数据固定，字符串游标内部是偏移量；不应当作动态数据库稳定分页方案照搬。任务仍使用 studyhub.tasks.v2 本地缓存。

本批通过 38 个验证场景，包含实际本机 HTTP。微信原生 wx.request、WXML、下拉刷新与真机网络仍需实际验收，见教程验证记录。
