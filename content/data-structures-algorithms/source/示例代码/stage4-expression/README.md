# 后缀表达式实验台

复制本目录expression.h、expression.c、main.c，以及25-stack的stack.h/stack.c、26-queue的queue.h/queue.c、stage4-common的ds_status.h到自己的`~/dsa-labs/stage4`同一目录。

在 **UCRT64 Bash、该目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c expression.c stack.c queue.c -o expression.exe
./expression.exe '2 3 + 4 *'
```

输出result=20，状态0。旧MinGW标准格式兼容选项见第09章。本阶段代码都只依赖标准C库。

协议：单参数，最多127字节，ASCII空格分隔最多16个单字符token；数字字面量仅0—9，二元运算+ - * /。中间与最终值[-9999,9999]，整数除法向0截断。空/多余操作数、坏token、除零、容量、范围分别报错，stderr消息含0起始token序号，状态1；长度错误序号用0占位。

先完成全部词法与队列预算校验，再开始求值。接口失败不改结果变量，成功不改错误位置变量。调用者传正确终止的字符串及独立输出变量，不伪造坏地址。

完整接口与求值代码见 [第四阶段答案](../../第四阶段-参考答案.md)，所有复用文件见 [源码附录](../stage4-common/完整源码.md)。这不是中缀转换器或通用计算器，不支持负数/多位字面量、浮点、变量和括号。队列用于本次教学组合，通用后缀求值并不必然需要先缓存全流。
