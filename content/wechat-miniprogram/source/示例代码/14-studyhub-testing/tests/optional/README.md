# 可选：真实WXML的DOM模拟测试

本目录与默认node:test隔离，有自己的package.json。准备Jest29.7.0、jest-environment-jsdom29.7.0与miniprogram-simulate1.6.2的直接依赖候选。版本取自已读取的一手来源，不代表本环境已完成安装、传递依赖审核或兼容验证。

在此目录首次运行npm install，保存并审核生成的package-lock.json，再npm test。后续相同锁文件用npm ci。当前交付未安装、未运行这两项，不能填通过，也不把缺依赖当成skip后的绿色结果。

jest.config.cjs显式选择jsdom和本目录*.render.spec.cjs，避免将node:test、故意失败fixture混入。不要照搬旧教程“Jest必然内置jsdom”的假设，本例单独列出环境包。

测试读取实际task-card四文件，compiler:simulate使用JS模拟WXML编译器，构造两按钮、触发tap、观察open/toggle与disabled。组件挂载后finally里detach并移除父DOM。模拟器不等于微信双线程/原生控件/读屏，也没有证明Skyline兼容。

若遇到模板或编译器限制，先查当前官方simulate说明。切换official编译器需要单独核对其工具、平台与依赖，不把缺编译器误归业务失败。先用最小组件复现，再扩大到业务组件。

此目录没有伪造锁文件或自动安装脚本。可选环境通过后应另存版本、命令、测试数量、失败与截图，默认50/课程500的统计范围仍须清楚区分。
