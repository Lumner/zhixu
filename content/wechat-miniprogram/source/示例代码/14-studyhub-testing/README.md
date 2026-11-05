# 学伴：系统测试与回归（第33章）

正常微信开发仍导入本外层目录，客户端miniprogram/、云函数cloudfunctions/；renderer-probe仍是单独导入的Skyline实验。第33章不新增业务页面或云集合，主业务源码与第32章逐字节一致。新增内容在tests/与ci/。

## 默认本地测试

实测Node 24.15.0。先在本项目目录运行：

```text
node tests/run.cjs
node tests/run.cjs --coverage
node tests/check-failure-path.cjs
node tests/mutations.cjs
```

也可npm test / npm run test:coverage / npm run test:mutations。默认测试仅Node标准库，无需npm install。Node工具只在电脑运行，不导入小程序客户端。

四组50个教学测试：unit14、async12、component/page-method10、flow14。组件组捕获定义并调用方法，没有渲染WXML；流程组实际使用task-session和草稿仓储，服务器回执为可控fake，不能证明真实云幂等/事务。真实domain的内存验证另在课程继承链中。

入口只接受完整50项通过、0失败/取消/跳过/TODO。结构化报告写tests/reports/latest.json，含运行标识、实际执行时间、源代码摘要、场景和证据范围；旧报告不能代替当前执行。coverage只统计本轮加载且匹配miniprogram筛选的JS，不能称全项目或真机覆盖率。

check-failure-path故意启动失败、跳过、超时三个独立fixture，验证它们都不会被接受为通过；单个子进程返回失败是实验预期，不是正常套件失败。mutations在内存克隆中注入三种固定错误，先验证基线再看断言能否发现，原业务文件不改。这6项附加检查不加入50/500业务场景计数。

按名称调试可直接运行，例如：

```text
node --test --test-name-pattern="标题40" tests/unit.test.cjs
```

筛选不是完整验收，不更新latest.json。修复后重新运行全量入口。

## 组件模拟渲染与开发者工具

可选DOM渲染在tests/optional/，有自己的package.json和两项Jest示例。尚未安装或运行，不计通过。详见该目录README；直接依赖固定不等于传递依赖已经锁定，首次安装后保存审核package-lock，再用npm ci重现。

微信开发者工具自动化提供接口层回归的另一层证据；本交付只有操作清单与流程规格，没有把未读取到正文的automator接口拼成可执行脚本。工具自动化、原生读屏、键盘、Skyline和真机仍待执行，不由VM或DOM模拟替代。

ci/github-actions.example.yml是未启用、未执行的模板，按仓库结构调整后放到仓库根.github/workflows才生效。模板运行本项目50项及附加检查，不代表课程450项继承场景都在CI执行，没有上传、部署或真实消息动作。

## 课程整体回归

在教程目录按第十三阶段说明运行八组继承脚本，参数14-studyhub-testing，然后运行node 验证/verify-testing.cjs。它重新执行本章50项、失败通路、变体，并核对450项继承结果及业务源码一致性，生成500项汇总。

真实SDK安装、微信编译、云规则/并发、辅助服务、真实网络与消息按前章独立验收。测试数据全部固定本地；不把生产环境、用户记录或密钥接入默认测试。
