# 单独导入的Skyline渲染器探针

这里是独立小程序根目录，含自己的project.config.json、app.json和pages/，不依赖外层miniprogram/或云函数。评估时在微信开发者工具单独导入本目录，使用自己的可用AppID和支持配置的基础库/工具；本次没有执行真实编译或预览。

app.json请求skyline、glass-easel和requiredComponents。页面custom导航、disableScroll，scroll-view使用明确高度；CSS显式写布局和盒模型。主学伴业务仍WebView，二者没有自动路由。

打开后看页面报告的实际renderer：skyline/webview/未知，不从配置猜结果。无窗口能力时600px只是布局回退值，不是测得的真实高度。顶部按状态栏和胶囊区域保守留白，标题与内容在其下；这不是完整产品导航栏，没有自行返回或分享业务，使用微信菜单关闭。

测试步骤：先确认当前官方支持条件；独立导入编译；核对实际渲染器；查看固定16行是否能滚到底；变窗口/横竖屏、胶囊/安全区和大字；再在副本中将renderer改成webview并对照。保留每种条件与截图，不在主项目全局试改。

disableABTest:true只是实验配置，不能让不支持的客户端获得Skyline，也不是业务发布策略。基础库低到无法识别新配置时，需要合适的独立工程/支持范围，不能等onLoad再降级。官方配置、基础组件、WXSS差异与Skylint可协助审查；本例未安装Skylint，没有自动迁移整个项目。

本工程只含固定教学内容，无云、无身份、无存储。不能据此断言原项目editor/Canvas/图片/表单或自定义组件已经兼容。读屏、焦点、回退和性能需要实际微信设备验证。
