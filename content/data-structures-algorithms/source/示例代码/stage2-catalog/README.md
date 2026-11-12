# 资料目录v0.2：完整运行说明

这是第16章与第二阶段练习的参考工程。平台主线Windows x64、MSYS2 UCRT64 Bash，语法C17。无需第三方库。作者实际使用的编译器、调试器与限制见 [第二阶段验证记录](../../验证/第二阶段验证记录.md)。

将本目录catalog.h、catalog.c、main.c、sample.txt复制到自己的`~/dsa-labs/ch16`，在 **UCRT64 Bash、该目录**执行：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -g -O0 main.c catalog.c -o catalog.exe
./catalog.exe sample.txt
./catalog.exe sample.txt 2 60 > exported.txt
./catalog.exe exported.txt
```

第一条运行导入并原样规范导出3条记录；修改命令把id=2的45分钟变成60分钟，保留其他字段。正常状态0，错误状态1；正常数据stdout，错误stderr。输出目标使用不同的新文件名，不能重定向到输入同名路径。失败的导出可能留下部分输出，不具备原子文件替换保证。

文件格式：首行DSA-CATALOG-1，随后每条id、minutes、title各占一行；id0—9999唯一，minutes0—1440，title1—63字节、不含ASCII控制字节，最多32条。UTF-8为约定，未实现Unicode编码合法性验证；rb读取并显式识别LF/CRLF，不接受BOM和孤立CR。文件头后直接EOF表示空目录，完整标题后可无换行，记录中间EOF为错误。

load和save不关闭调用者提供的流。Catalog需先init，使用后free；find返回借用，扩容、释放或成功load替换后重新按id查找，不沿用旧记录地址。接口在有效对象与不变量前提下工作，不识别任意坏指针。

完整代码可阅读 [源码附录](完整源码.md)。本版本还没有菜单、删除、排序、散列索引或崩溃恢复。后续课程通过独立版本扩展，保留本版用于复习。
