# 05 Python环境、文件与第一个程序

## 学习目标与先修

先完成01—04章。本章约3—5小时，从文件和终端开始，在Windows上运行第一个程序。Python是一种编程语言；**解释器**是读取Python代码并执行步骤的程序；`.py`是源代码文件的扩展名。当前批次只使用标准库，不需要付费软件、科学计算包或在线账号。

## 先确认电脑上已有的环境

**终端**是输入命令并查看文字输出的窗口。Windows开始菜单搜索“PowerShell”后打开，不需要管理员权限。命令中的符号和空格有意义，代码块里不包含终端提示符。

在PowerShell任意目录执行：

```powershell
python --version
```

若输出 `Python 3.x.y`，记录实际版本。本批代码按Python3.11及以上的语法范围编写，实际测试版本见验证记录；没有逐一测试所有版本。如果命令已能运行，不必为了本课重复安装。

若命令不存在或打开商店，可从[Python官方下载入口](https://www.python.org/downloads/)取得适合Windows的安装方式。官方Windows文档截至2026-11-12推荐Python install manager，也说明已有安装和命令别名可能影响解释器选择；请以当日[官方Windows说明](https://docs.python.org/3/using/windows.html)为准。不要照旧教程盲改系统PATH，也不需要卸载现有Conda环境。使用已有环境时，确认运行的是自己选定的解释器。

## 文件、目录与扩展名

**目录**就是文件夹；**路径**说明文件位置。资源管理器中启用“显示文件扩展名”，避免把 `hello.py` 保存成 `hello.py.txt`。可以用记事本编辑纯文本，以UTF-8保存。Word文档不是Python源文件。

本课已有完整示例。网页读者先下载[课程学习包](示例代码/运行说明.md)中说明的整包，解压后找到 `source/示例代码/`；不要只下载入口文件却漏掉同目录模块。保留一份原始副本，再将示例复制到自己的练习目录。下面路径针对当前知识库本机源文件；如果你放在其他目录，只替换 `Set-Location` 后面的路径。

在PowerShell执行：

```powershell
Set-Location 'C:\Users\17597\Desktop\tutorial\content\western-economics\source\示例代码'
Get-Location
Get-ChildItem
python hello.py
```

`Set-Location`切换当前工作目录，引号包住完整路径；`Get-Location`显示当前位置；`Get-ChildItem`列出文件；`python hello.py`让解释器运行这个目录中的文件。后续章节的相同命令都在此目录执行。

## 第一个完整程序

完整文件见[hello.py](示例代码/hello.py)。核心两行是：

```python
print("Hello, economics!")
print("2 + 3 =", 2 + 3)
```

`print`是Python内置函数，可以将括号内的内容显示到终端。函数可暂理解为“有名字的操作”。双引号中的内容是文字，`2+3`没有引号，因此会计算。逗号分隔要显示的不同内容。使用英文半角括号和引号。

预期输出：

```text
Hello, economics!
2 + 3 = 5
```

电脑按源文件从上到下执行。修改文字并保存，再运行一次，结果才会变化；只在编辑器修改但未保存，解释器读到的仍是旧文件。

## 交互模式与脚本模式

只输入 `python` 会进入交互模式，常见提示符为 `>>>`。在那里输入一行可立即执行。`>>>`是解释器给的提示，不属于代码。输入 `exit()` 返回PowerShell。

`python hello.py`属于脚本模式，一次执行文件。不要在 `>>>` 后输入PowerShell的 `Set-Location`，也不要把 `>>>`复制进 `.py` 文件。终端命令和Python语法属于两个不同的环境。

## 可选：建立独立环境

**虚拟环境**为一个项目保留单独的Python与第三方包入口。前18章没有第三方依赖，可以暂不建立。希望隔离时，在示例目录的PowerShell执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe hello.py
```

`-m venv`使用Python自带环境模块，`.venv`是新建目录。直接调用其中的解释器即可，不要求修改PowerShell执行策略，也不需要激活脚本。环境目录只留在自己的练习副本，不上传到课程source。

## 常见错误

- `can't open file`：先检查当前目录、文件名和隐藏的`.txt`后缀。
- `SyntaxError`：检查中文引号、漏括号、把提示符写进代码。
- 输出还是旧内容：保存文件，确认编辑和运行的是同一路径。
- 运行后窗口一闪而过：用已经打开的PowerShell运行，便于保留输出。

## 练习与参考答案

1. 添加第三行显示 `Study hours: 3`。答：`print("Study hours:", 3)`。
2. 比较 `print("2 + 3")` 和 `print(2 + 3)`。答：前者显示文字2 + 3，后者计算并显示5。
3. 为什么同名文件在不同目录运行会有不同输出？答：相对文件名根据当前目录定位，可能运行了另一个文件。

## 完成条件

从新开的PowerShell切换到正确目录，运行、修改、保存、重跑，并解释两行输出。环境安装步骤未在本次重新安装验证，当前已有解释器的执行结果另见验证记录。
