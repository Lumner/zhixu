# 11 模块、路径、CSV与结果保存

## 学习目标与先修

先完成10章。约4—6小时，学会读取简单表格文件、定位路径、转换字段、校验数据并保存结果。当前只处理固定教学数据，不联网抓取真实个人信息。

## CSV是什么

CSV是常见的纯文本表格格式。通常一行对应一条记录，逗号分隔字段，第一行是列名；字段里含逗号或换行时还涉及引号规则，因此使用标准库`csv`读取，不自己用split猜所有情形。

本课[data/prices.csv](示例代码/data/prices.csv)的完整内容：

```csv
scenario,price
low,20
base,24
high,30
```

scenario是情景名，price单位元/杯。三行是人为给定的假想价格，既不是日期序列，也不是对同一天三个门店的观测。元数据和数值同样重要。

## 模块与路径逐项读

完整程序[csv_io.py](示例代码/csv_io.py)用到`csv`、`math`和`pathlib`。`from pathlib import Path`只从pathlib模块引入Path。**绝对路径**从盘符或根目录开始，**相对路径**依赖某个基准位置。

```python
HERE = Path(__file__).resolve().parent
```

这是完整文件的定位片段。`__file__`为当前源文件路径，resolve转成绝对形式，parent取父目录。随后 `HERE / "data" / "prices.csv"`用Path的斜杠运算构造路径，Windows会得到适合本机的分隔方式。它不是数值除法；对象类型决定运算含义。

这样数据位置相对程序文件固定。即使从其他工作目录启动程序，也不会误读另一个同名CSV。

## with、编码与字典读取

`with path.open(encoding="utf-8-sig", newline="") as handle:`打开文件，并在代码块结束时自动关闭。handle是当前文件对象。`encoding`规定文字与字节怎样转换；utf-8-sig既能读取普通UTF-8，也能处理带BOM的UTF-8文件。`newline=""`让csv模块按自己的规则处理换行。

`csv.DictReader(handle)`把每行变成字典，表头是键。它不会自动把`"24"`变成数字，仍需 `float(row["price"])`。完整程序要求表头恰好是`scenario,price`，拒绝缺列、多列、缺字段、非数字、非有限数和负价格，并将出错行号写入异常信息。

`enumerate(reader, start=2)`同时提供行号和记录，从2起是因为第1行是表头。`raise ValueError(...)`主动报告不符合本题约定的数据。与其默默丢掉坏行，课程选择中止，避免把不完整结果当成完整表格。

## 保存与复算

在示例目录的PowerShell执行：

```powershell
python csv_io.py
Get-Content -LiteralPath output/demand-results.csv
```

程序按文件位置创建output目录，写入CSV并显示 `Wrote output/demand-results.csv`。结果应为：

```csv
scenario,price,quantity
low,20.0,80.0
base,24.0,72.0
high,30.0,60.0
```

`"w"`模式会覆盖该输出文件，因此只对练习副本里的固定产物使用，不指向原始资料。`csv.DictWriter`按给定列名写表头和记录。`{**row, "quantity": quantity}`创建一个新字典，复制row字段后增加quantity；这里不会把新字段写回原始输入文件。

## 怎样从报错定位坏数据

把练习副本中第二条价格改成abc，重新运行，会得到带行号的ValueError。恢复后再试-1或缺少price列。这些异常没有被入口吞掉，所以终端会显示调用栈，帮助学习定位。只有全部读入成功才开始写结果；已有输出可能属于上次成功运行，失败后不要把旧文件当成新结果。

## 常见错误

- 在PowerShell当前目录拼路径，换目录后找不到输入。使用相对源文件的基准可避免。
- 表格软件将文件另存为其他编码。优先明确保存为UTF-8 CSV，并检查原文本。
- 忘记float转换，对字符串进行错误运算。
- 报错后只看输出目录有文件，就断言本次成功。要同时查看本次进程状态和输出时间。

## 练习与参考答案

1. 增加情景 `test,40`，结果数量？答：40。
2. 价格70为何输出0？答：需求截断规则；输入价格仍可非负，不要求每个输入都有正需求。
3. 如何从课程根目录运行？答：PowerShell执行 `python source/示例代码/csv_io.py`，文件定位仍基于源文件。

## 完成条件

能说明CSV每列含义、运行目录与数据目录的区别。亲自制造一个坏输入，读懂报错，再恢复并复算三行结果。完整校验规则以示例文件为准。
