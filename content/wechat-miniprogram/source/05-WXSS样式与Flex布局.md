# 05 WXSS 样式与 Flex 布局

目标：能从一个页面草图写出样式，理解尺寸和间距，能解决文字太长、按钮挤压等实际问题。建议 2—4 小时。

## 5.1 一条样式规则怎么读

```css
.card {
  background: #ffffff;
  padding: 24rpx;
  border-radius: 20rpx;
}
```

`.card` 是选择器，决定样式用到哪里；`{}` 内每条是“属性: 值;”。WXML 中写 `class="card"` 的组件会匹配这个选择器。代码写在 `.wxss` 文件，不要再套 `<style>` 标签。

WXSS 基于 CSS 扩展，但不能据此假设所有浏览器特性、所有渲染器行为完全一致。本阶段只使用常用、容易理解的规则。官方起步示例也演示了 class、Flex 和 rpx，见 [官方 WXSS 源码](https://github.com/wechat-miniprogram/miniprogram-quickstart/blob/master/pages/index/index.wxss)。

## 5.2 常见选择器

```css
page { background: #f4f7fb; }   /* 当前页面 */
text { color: #334155; }       /* text 组件 */
.title { font-size: 36rpx; }   /* 指定 class */
#main { padding: 24rpx; }      /* 指定 id，早期少用 */
.card .title { color: #16794b; } /* card 内的 title */
.title, .subtitle { display: block; } /* 两个选择器共用规则 */
```

一个组件可以有多个类：

```xml
<view class="card selected">选中的卡片</view>
```

不写 `class=".card"`，点号只出现在 WXSS 选择器中。

多个规则作用于同一属性时，选择器的优先级、来源和先后顺序会影响结果。初学时保持简单：主要用 class，避免层层嵌套和大量 `!important`。看到样式没生效，先查 class 名字和当前生效规则。

## 5.3 盒模型：内容外面还有空间

```text
外部：margin（和别人的距离）
┌──────── border（边框）────────┐
│ padding（内容和边框之间）      │
│     content（文字或图片）      │
└─────────────────────────────┘
```

```css
.card {
  width: 600rpx;
  padding: 24rpx;
  border: 2rpx solid #dbe3ec;
  margin: 24rpx auto;
}
```

在默认 content-box 计算方式下，实际横向占用还要加上左右 padding 和 border。若希望 width 包含内部间距和边框：

```css
.card {
  box-sizing: border-box;
  width: 100%;
  padding: 24rpx;
}
```

本课程项目会为常用组件设置 `box-sizing: border-box`，减少尺寸误算。

间距简写：

- `margin: 20rpx`：四边均 20。
- `margin: 20rpx 32rpx`：上下 20，左右 32。
- `margin: 10rpx 20rpx 30rpx 40rpx`：上、右、下、左。
- `margin: 24rpx auto`：上下固定，左右自动分配，常用于固定宽度块居中。

`margin` 和 `padding` 不能互换。例如卡片内文字贴边，应增加 padding；两张卡片太近，应增加 margin。

## 5.4 rpx、px、% 各做什么

在常见小程序布局中，屏幕宽度以 750rpx 为参考。若可用宽度为 375 逻辑像素，则 100rpx 对应约 50px；宽度为 414 时约为 55.2px。

```text
某个 rpx 数值对应的 px ≈ rpx 数值 × 当前可用宽度 / 750
```

注意这是布局参考，不是“手机实际物理像素”。旋转、平板、多窗口、渲染环境都可能影响可用宽度，最终要实际验证。

| 单位 | 常见用途 | 注意 |
| --- | --- | --- |
| rpx | 需要随屏幕宽度缩放的间距、卡片尺寸 | 不要所有尺寸机械照搬设计稿 |
| px | 比较稳定的细线等尺寸 | 不是固定数量的物理像素 |
| % | 相对父容器的尺寸 | 取决于父容器实际约束 |

用 rpx 不代表自动适配所有设备。适配还需要弹性布局、合理最大宽度、长文字处理和真机测试。

## 5.5 字体、颜色、边框

```css
.title {
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.5;
  color: #1f2937;
}
.subtitle {
  font-size: 26rpx;
  color: #64748b;
}
.card {
  border: 1px solid #e2e8f0;
  border-radius: 20rpx;
  background: #ffffff;
}
```

`line-height: 1.5` 表示行高约是字体尺寸的 1.5 倍。正文过小、对比过弱，即使布局没错也不好读。不要只通过颜色表达完成状态，搭配文字“已完成”。

## 5.6 Flex：把组件排成行或列

```xml
<view class="row">
  <text class="title">学习任务</text>
  <button class="small-button" size="mini">编辑</button>
</view>
```

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.small-button { margin: 0; }
```

`display: flex` 使 row 成为弹性容器。默认主轴为横向：`justify-content` 管横向分布，`align-items` 管纵向对齐。

| 属性 | 本课常用值 | 用途 |
| --- | --- | --- |
| flex-direction | row / column | 排成一行或一列 |
| justify-content | flex-start / center / space-between | 沿主轴排列 |
| align-items | stretch / center / flex-start | 沿交叉轴对齐 |
| flex-wrap | nowrap / wrap | 是否允许换行 |
| flex | 1 | 子项占用剩余空间 |
| flex-shrink | 0 | 子项不被挤小 |

如果方向改成 column，主轴变纵向，“主轴横向”的记忆就失效了。永远先看 flex-direction。

## 5.7 输入框占满剩余宽度

```xml
<view class="editor-row">
  <input class="draft" placeholder="输入学习任务" />
  <button class="save-button" size="mini">添加</button>
</view>
```

```css
.editor-row { display: flex; align-items: center; }
.draft {
  flex: 1;
  min-width: 0;
  padding: 16rpx;
  border: 1px solid #cbd5e1;
  border-radius: 12rpx;
}
.save-button { flex-shrink: 0; margin: 0 0 0 16rpx; }
```

`flex: 1` 让输入框吃掉剩余空间，按钮保留自身需要的宽度。`min-width: 0` 允许弹性子项在必要时缩小，解决某些内容把容器撑爆的问题。

小屏仍然拥挤时，可以把输入和提交按钮拆成上下两行。本课程完整项目采用容易适配的布局，不追求强塞一行。

## 5.8 长文本是必须测试的情况

任务标题可能很长或是一整串英文：

```css
.task-title {
  display: block;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: break-all;
}
```

如果产品只要单行省略：

```css
.one-line {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

省略号需要可约束的宽度；在 Flex 里经常还需要给所在子项 `min-width: 0`。不要为了视觉整齐让用户永远看不到完整内容，详情页应提供完整文本。

## 5.9 条件样式

```xml
<view class="task {{item.done ? 'task--done' : ''}}">
  <text class="task-title">{{item.title}}</text>
</view>
```

```css
.task { background: #ffffff; }
.task--done { background: #eef8f1; }
.task--done .task-title {
  text-decoration: line-through;
  color: #64748b;
}
```

JS 只负责改变 done；WXML 根据 done 决定类名；WXSS 决定对应外观。不需要在 JS 里寻找 DOM 再改 style。

## 5.10 全局与页面样式

`app.wxss` 放整个项目的基础样式；某页的 `.wxss` 放该页专用样式。不要把所有页面都叫 `.title` 却期待它们永远互不影响，后面组件化还会涉及样式隔离。

button 具有默认样式，修改时可能还要处理它的伪元素边框：

```css
.plain-button::after { border: 0; }
```

这只是针对默认边框的调整，不是所有样式问题都靠 `::after` 解决。

## 5.11 本章小项目：统计卡片

WXML：

```xml
<view class="stats">
  <view class="stat"><text class="number">8</text><text>全部</text></view>
  <view class="stat"><text class="number">3</text><text>完成</text></view>
  <view class="stat"><text class="number">5</text><text>剩余</text></view>
</view>
```

WXSS：

```css
.stats {
  display: flex;
  padding: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
}
.stat { flex: 1; text-align: center; font-size: 26rpx; color: #64748b; }
.number { display: block; font-size: 48rpx; color: #16794b; font-weight: 700; }
```

先使用静态数字练布局，再把数字换成数据绑定。将“排版问题”和“数据问题”分步验证，更容易定位故障。

## 5.12 本章练习

1. 让统计卡片横向三等分。
2. 增加第四项“完成率”，看看 Flex 如何分配。
3. 把横向统计改为纵向，说明主轴如何变化。
4. 给任务卡片增加内部留白，而不改变卡片之间的距离。
5. 在窄屏模拟器输入 40 个英文字符，确保没有横向溢出。

[下一章：数据驱动与事件](06-数据驱动与事件处理.md)
