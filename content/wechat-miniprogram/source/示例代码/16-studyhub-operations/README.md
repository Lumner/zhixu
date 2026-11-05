# 学伴：日志、环境与持续维护（第35章）

从第34章继续，主工程WebView，16主包+11普通分包共27页；renderer-probe另行导入。新增环境目标核对、默认关闭的本地诊断、调用观察层、维护练习页、三组件源码清单与回退准备检查。不新增云集合，云函数和共享协议沿用上一版。

## 导入与配置

导入本外层目录，客户端miniprogram/、云函数cloudfunctions/。真实AppID、cloud.ENV_ID与runtime.EXPECTED_APP_ID/EXPECTED_ENV_ID必须核对；STAGE默认development，平台元数据未知或目标不一致时不初始化云。发行类型不等于云环境：production候选允许trial/release，不根据trial自动选库。

云函数仍固定wx-server-sdk 4.0.2，按前章实际部署函数、九集合、存储规则和索引，完成双账号验收。cloudReady只表示本地初始化。本交付未安装SDK、微信编译或部署。

## 本地诊断

config/runtime.js的ENABLE_LOCAL_DIAGNOSTICS默认false。启用后最多80条内存事件，只保留seq/event/action/code/elapsed，不复制正文、身份、路径、URL、原始错误或堆栈；不写缓存、不上传、不发送告警。

cloud-client观察层保留原载荷、结果/错误对象和原编号，不增加重试；日志或时钟异常不应改变业务结果。App的两个错误钩子只记录分类，不保证捕获所有原生/进程异常。

身份与环境→日志与维护练习，可生成独立20条固定样本，5条超时。练习没有真实请求；清空只影响本机内存，不清业务或云日志。样本比例不是线上可用率或时间窗口。

## 本地工具

在本项目目录：

```powershell
node tests/run.cjs --coverage
node tools/build-manifest.cjs
node tools/release-audit.cjs
node tools/recovery-check.cjs
```

标准测试50项完整通过后生成摘要关联报告。源码清单默认可退出0，包含client/cloud/controls源码，compiled/deployed=false。默认发布检查退出2、28项待办；回退检查退出2、decision=blocked，这是预期结果。

operations/recovery-plan.json与rollback-target.json保留空白/pending，不能复制当前制品冒充旧候选。即使固定材料全齐，回退也仅manual-review-only，canExecute/remoteVerified/dataRestored=false。工具不查证真实备份、停写或兼容性，不部署、删除或恢复资源。

三种摘要的范围不同：标准sourceDigest、发布codeFingerprint、三组件fingerprint不可互相复制。实际候选材料、部署版本和备份还需分别记录。

## 课程完整验证

按 [维护验收表](../../第十五阶段-维护演练与实际验收.md) 在教程根运行八组450、标准50、隐私发布50、本章50，共600本地场景。3类负向和3个固定变体另列，不加入600。平台继承包含临时127.0.0.1固定文件HTTP，其余微信/云为桩或串行模型。

标准50的局部覆盖率不代表本章新增50或全项目。可选DOM、微信自动化和CI未运行；CI模板仅标准50及附加检查。真实告警、备份恢复、回退、原生钩子、微信编译、云权限与发布后观察均待实际验收。

完整个人数据导出、账户处理与期限/权利机制仍未实现，正式交付应阻止；不能用本地材料齐全替代。

- [第35章](../../35-日志监测环境管理与持续维护.md)
- [20组练习](../../第十五阶段-练习与参考答案.md)
- [维护与实际验收](../../第十五阶段-维护演练与实际验收.md)
- [本地记录](../../验证/第十五阶段验证记录.md)
- [维护工具说明](operations/维护说明.md)
- [事件记录模板](operations/事件记录模板.md)
