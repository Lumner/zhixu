# WeUI接入练习（尚未安装或构建）

先复制第16组为独立练习工程，不修改已有云函数依赖，也不在本电脑工具实验目录安装后期待微信自动识别。

本次阅读 [官方快速上手](https://wechat-miniprogram.github.io/weui/docs/quickstart.html)、[Loading组件](https://wechat-miniprogram.github.io/weui/docs/loading.html) 与 [官方package清单](https://raw.githubusercontent.com/wechat-miniprogram/weui-miniprogram/master/package.json)。固定候选1.5.6，不声称最新版或已真机可用。

1. 在练习工程客户端miniprogram目录准备独立package.json，private=true。
2. 在该目录npm install --save-exact weui-miniprogram@1.5.6 --ignore-scripts --no-audit --no-fund，保存实际锁文件。
3. 按当前开发者工具配置核对npm包与输出目录，再构建npm；官方页面说明需要该构建步骤，本次未实际执行。
4. 官方npm方案要求引入样式；其示例为下方import，实际解析与生成位置需在工具中核对，不盲目拼路径。
5. 在独立练习页登记组件并使用，不替换原请求恢复协议。

第一步可手动创建以下最小package.json，再执行第二步安装；这能避免npm向上找到外层工具清单而装错目录：

```json
{"name":"studyhub-weui-practice","version":"0.0.0","private":true}
```

```css
@import 'weui-miniprogram/weui-wxss/dist/style/weui.wxss';
```

```json
{"usingComponents":{"mp-loading":"weui-miniprogram/loading/loading"}}
```

```xml
<mp-loading show="{{loading}}" type="circle" tips="正在读取任务" />
```

loading由原请求状态控制。等待、失败、旧响应、页面离开与finally清理仍需原业务负责。

记录工具/基础库、编译结果、实际包体、WebView/Skyline、大字、读屏、深色、样式隔离、禁用与失败状态。本课程没有实际npm微信构建结果，不将此练习计为通过。

扩展库是另一条官方介绍的路线，应按当前平台能力单独核对，避免和npm方案混用。
