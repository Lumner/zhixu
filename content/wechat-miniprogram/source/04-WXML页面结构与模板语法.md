# 04 WXML 页面结构与模板语法

目标：把数据变成可见结构，正确使用条件、列表和输入组件。建议 2—3 小时。本章先搭页面，交互方法在第 06 章完成。

## 4.1 WXML 和 HTML 有什么关系

WXML 是小程序的界面描述语言。它也使用标签，但不是把 HTML 文件改一个扩展名就能运行。普通网页的 `div/span/img`，在这里常分别使用 `view/text/image`；功能和规则应以小程序组件文档为准。

你不用先学完网页开发。先掌握标签、属性、嵌套，再用少量常用组件完成页面。

```xml
<view class="card">
  <text class="title">今天的学习</text>
  <text>先完成一个小目标</text>
</view>
```

`view` 是父组件，两个 `text` 是子组件。标签必须正确嵌套，不能写成先开始 view、再开始 text，却先结束 view。`class="card"` 中 class 是属性名，card 是属性值。

注释这样写：

```xml
<!-- 这里是页面顶部卡片 -->
```

不是 JS 的 `//`。不同文件类型使用不同注释语法。

## 4.2 常用组件清单

| 组件 | 用途 | 初次使用要点 |
| --- | --- | --- |
| view | 分组和布局 | 通常由它承担背景、间距、Flex |
| text | 文字 | 需要文字单独占行时给它 block 样式 |
| button | 触发操作 | 用 bindtap 绑定方法，有默认样式 |
| input | 单行输入 | 从 bindinput 事件的 detail.value 取值 |
| textarea | 多行输入 | 适合备注、笔记正文 |
| image | 图片 | 使用 src 和 mode，通常要指定尺寸 |
| scroll-view | 局部滚动区 | 纵向滚动通常需要明确高度约束 |
| navigator | 页面跳转入口 | 后续结合页面注册和路由学习 |
| block | 逻辑分组 | 自身不产生可供布局的可视容器 |

图片的说明性例子：

```xml
<!-- 前提：你在项目根目录准备了 assets/cover.png -->
<image class="cover" src="/assets/cover.png" mode="aspectFit" />
```

`aspectFit` 保持比例并使整张图放入指定区域。不要在尚未放入图片时把加载失败误当语法问题。本次两个完整项目不依赖图片文件。

## 4.3 数据绑定：从 JS 读值

在临时练习页面的 JS 写完整配置：

```js
Page({
  data: {
    nickname: '小林',
    completed: 2,
    total: 5,
    loading: false,
    selectedId: 't1'
  }
});
```

对应 WXML：

```xml
<view>
  <text>你好，{{nickname}}</text>
  <text>已完成 {{completed}} / {{total}}</text>
  <text>剩余 {{total - completed}} 项</text>
  <button disabled="{{loading}}">保存</button>
</view>
```

`{{}}` 中写数据字段名或模板支持的简单表达式。文字中和属性值中都可以绑定。`disabled="{{loading}}"` 传入布尔值 false，按钮可以用；把 JS 中 loading 改为 true 再编译，按钮禁用。

不要写 `disabled="false"` 来表达布尔假，非空字符串可能被当作真。需要布尔值时使用 `{{false}}` 或绑定布尔字段。

### 三种位置的变量名不要混淆

```xml
<text>{{nickname}}</text>
```

这里读的是 `Page` 的 `data.nickname`，不是 `onLoad` 里随便定义的局部 `const nickname`，也不写 `{{this.data.nickname}}`。

## 4.4 条件渲染 wx:if

```xml
<view wx:if="{{loading}}">正在加载……</view>
<view wx:else>加载完成</view>
```

`wx:if` 为真时创建前面的节点；否则走紧邻的 `wx:else` 分支。多分支可以使用 `wx:elif`。

```xml
<view wx:if="{{status === 'loading'}}">加载中</view>
<view wx:elif="{{status === 'error'}}">加载失败，请重试</view>
<view wx:else>准备好了</view>
```

对应 data 中必须有 status，例如 `status: 'loading'`。

### wx:if 和 hidden 的区别

```xml
<view wx:if="{{showTip}}">按条件创建和销毁</view>
<view hidden="{{!showTip}}">节点保留，仅隐藏</view>
```

选择时考虑状态和切换成本：完全不需要时可用 `wx:if`；需要频繁切换显示、保留内部状态时可以研究 `hidden`。不要靠 CSS 隐藏敏感内容作为权限控制。

## 4.5 列表渲染 wx:for

练习页面 JS：

```js
Page({
  data: {
    tasks: [
      { id: 't1', title: '学习 WXML', done: true },
      { id: 't2', title: '写一个列表', done: false }
    ]
  }
});
```

WXML：

```xml
<view class="task" wx:for="{{tasks}}" wx:key="id">
  <text>{{index + 1}}. {{item.title}}</text>
  <text>{{item.done ? '已完成' : '待完成'}}</text>
</view>
```

框架遍历 tasks，每条产生一个 view。默认 `item` 是当前元素，`index` 是从 0 开始的位置。`wx:key="id"` 告诉框架，每个元素中的 id 属性可以稳定识别该项。

**这里写 `id`，不写 `{{item.id}}`。** key 应唯一且稳定。会删除、排序的列表，不要把索引当身份。

自定义变量名：

```xml
<view wx:for="{{tasks}}" wx:for-item="task" wx:for-index="position" wx:key="id">
  <text>{{position + 1}}. {{task.title}}</text>
</view>
```

这样在嵌套列表中更容易区分内外元素。

如果数组是 `['语法', '布局']` 这样的唯一字符串列表，可以使用 `wx:key="*this"`。如果元素值重复，就需要另行设计唯一标识。

## 4.6 空状态和列表分开

```xml
<view wx:if="{{tasks.length === 0}}" class="empty">
  还没有任务，先添加一个吧。
</view>
<block wx:else>
  <view wx:for="{{tasks}}" wx:key="id" class="task">
    <text>{{item.title}}</text>
  </view>
</block>
```

`block` 只负责把多项逻辑组织起来，不给它设置 margin 来期待出现间距。需要可布局容器时使用 `view`。

不要在同一个节点上同时塞复杂的 `wx:if` 和 `wx:for` 来筛选数据。先在 JS 生成 `visibleTasks`，模板只负责渲染，逻辑更清楚，也能单独验证。

## 4.7 输入框先认识绑定关系

```xml
<input
  value="{{draft}}"
  placeholder="例如：学习 WXML"
  maxlength="40"
  bindinput="onDraftInput"
/>
<button bindtap="onSave">保存任务</button>
```

需要 data 中有 `draft: ''`，还需要定义 onDraftInput 和 onSave，完整写法在第 06 章。

`value` 负责从数据传到输入框；`bindinput` 负责把输入变化交给 JS。普通 `value="{{draft}}"` 不代表自动双向同步，必须在事件处理里更新数据。本课先使用显式事件；其他绑定能力后续按需再学。

`maxlength` 是输入组件的前端限制。业务方法仍要校验，因为数据也可能来自缓存、接口或其他调用路径。

## 4.8 事件绑定写名字，参数走事件对象

```xml
<button bindtap="onRemove" data-id="{{item.id}}">删除</button>
```

上面是列表内部的片段。`bindtap` 写方法名，不写 `onRemove(item.id)`。通过 `data-id` 带上当前任务身份，在 JS 的事件参数中取值。第 06 章详细演示。

## 4.9 模板里能做哪些计算

可以使用模板支持的简单数据访问、运算、比较和三元表达式，例如：

```xml
<text>{{done ? '已完成' : '待完成'}}</text>
<view class="task {{done ? 'task--done' : ''}}">任务</view>
```

不要把 WXML 当作任意 JavaScript 执行环境。诸如 `tasks.filter(...)`、页面方法调用、复杂日期格式化，先在 JS 里计算出字段再交给模板。

```js
// 放在一个页面方法里，tasks 已定义时使用
const pendingTasks = tasks.filter(task => !task.done);
this.setData({ pendingTasks });
```

## 4.10 本章练习

1. 显示任务总数和每条标题。
2. 已完成任务后面显示“已完成”，其他显示“进行中”。
3. 把 tasks 改成空数组，出现空状态。
4. 把循环变量名改为 task，确认所有引用都同步修改。
5. 解释 `wx:key="id"` 为什么不是“每条任务显示 id”。

参考官方结构：[起步模板的 WXML 源码](https://github.com/wechat-miniprogram/miniprogram-quickstart/blob/master/pages/index/index.wxml)。这个历史模板含旧的用户信息获取写法，本课程仅参考结构和绑定，**不要照搬其中的头像昵称授权流程**。现代账号资料能力将在第 22 章重新查证。

[下一章：WXSS 样式与 Flex 布局](05-WXSS样式与Flex布局.md)
