# 11 数组参数、长度与const

## 11.1 目标与先修

先掌握第10章的指针。建议4—6小时。本章兑现第08章的约定：把统计拆成函数，明确数组、指针和长度分别提供什么信息。进一步理解size_t、只读访问、二维数组和函数失败时的输出约定。

## 11.2 数组不是指针对象，但经常转换成指针

main中的`int minutes[3]`是真正的数组对象，含3个连续int。多数表达式使用数组名时，会转换成指向第一个元素的指针；因此把minutes传给函数，不是复制整个数组。

函数参数写`const int values[]`，在此处会调整为`const int *values`。它只收到起始位置，不知道后面实际有几个合法元素。调用者必须另外传count，并保证所指区域确实包含count个仍有效的int。

`values[i]`可以理解为从起点前进i个元素再访问，不是前进i字节。对一个数组，可形成刚过末尾的位置用于比较，但不能解引用它。两块无关对象之间的任意指针加减、大小比较不能套用数组内规则。

## 11.3 为什么函数里的sizeof不能算长度

在数组定义所在的main中，`sizeof minutes / sizeof minutes[0]`得到3；分子是整个数组字节数，分母是一个元素字节数。

但在形参处，values已经是指针参数，`sizeof values`得到的是指针对象的大小，不是调用者数组大小。不同机器的指针大小也可能不同。函数内不能凭它恢复数组长度，更不能靠遇到数值0结束——0是合法分钟数。

第09章给fgets传`sizeof title`，是因为调用处持有真实数组；如果把它包进函数，就必须把容量作为另一个参数传进来。

## 11.4 const限制哪一条访问路径

`const int *values`表示不能通过这个指针改所指int。它不是“这块数据永远不能被任何人改”的保证：如果原对象可修改，其他合适指针仍可以改它。

`int *const p`则是指针本身不能重绑，仍可通过它改可修改对象；`const int *const p`两方面都受限制。先以“const在保护哪个对象”来读，不必背复杂声明口诀。本章计算函数使用第一种，表达借用输入且不通过该参数修改。

## 11.5 状态与结果为什么分开

求和函数正常可能得到0，所以不能用0同时表示失败。本例返回1表示成功、0表示失败；真正的和通过`int *out_total`写回。

前提：out_total要指向可写int；非空输入时values指向至少count个元素；本教学函数最多处理7条、每条0—1440，以保证总和不超过10080。空输入允许values为NULL，结果为0。失败时保持调用者原来的out_total值不变。

这里的空检查与范围检查不能识别悬空指针，也不能验证调用者谎报的实际数组容量。接口的职责与调用者前提要同时成立。

## 11.6 完整实验

**完整程序：array_api.c。** 下载 [源码](示例代码/11-array-api/array_api.c)，放到`~/dsa-labs/ch11`。

```c
#include <stdio.h>

int sum_minutes(const int values[], size_t count, int *out_total)
{
    if (out_total == NULL || count > 7 || (count > 0 && values == NULL)) {
        return 0;
    }
    int total = 0;
    for (size_t i = 0; i < count; i++) {
        if (values[i] < 0 || values[i] > 1440) {
            return 0;
        }
        total += values[i];
    }
    *out_total = total;
    return 1;
}

int main(void)
{
    int minutes[] = {10, 20, 30};
    size_t count = sizeof minutes / sizeof minutes[0];
    int total = -1;
    if (!sum_minutes(minutes, count, &total)) {
        return 1;
    }
    printf("count=%zu total=%d first=%d\n", count, total, minutes[0]);
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
    printf("grid=%d\n", grid[1][2]);
    if (!sum_minutes(NULL, 0, &total)) {
        return 1;
    }
    printf("empty_total=%d\n", total);
    return 0;
}
```

在 **UCRT64 Bash、`~/dsa-labs/ch11`目录**执行：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic array_api.c -o array_api.exe
./array_api.exe
```

输出：

```text
count=3 total=60 first=10
grid=6
empty_total=0
```

函数先用局部total计算，所有元素检查通过后才写`*out_total`。如果读到非法分钟就返回0，不把半个和写给调用者。main中的minutes[0]仍为10，符合只读计算的目的。

空输入时count为0，循环不执行，所以不会通过NULL读元素；最后仍可以向有效的out_total写0。不要误读成“任何时候NULL都能当数组”。

## 11.7 size_t与倒序的陷阱

size_t适合表示容量与下标，但它是无符号类型。0减1会变成该类型可表示的最大值，`i >= 0`对它总成立。不要写`for (size_t i=count-1; i>=0; i--)`，count为0时初始化就出问题。

**上下文片段：main内，已有minutes数组与count。**

```c
for (size_t i = count; i > 0; i--) {
    printf("%d\n", minutes[i - 1]);
}
```

先检查i>0，再访问i-1，count为0时自然跳过。计数不含负数不等于不需要边界判断。只有确实需要负数哨兵时再选择合适的有符号结果类型，例如第08章的first=-1。

## 11.8 二维数组的一行也是数组

`int grid[2][3]`包含2行，每行3个int；`grid[1][2]`取第2行第3列，为6。它不是自动创建了2个独立指针，也不能当`int **`传给函数。

一个接收这种数组的参数可写`const int grid[][3]`，行数另传；列数3决定了前进一行的跨度。对应的指针类型是“指向含3个int的一行”，写作`const int (*grid)[3]`。括号让星号先与grid结合。

这一节先能解释固定列数即可，后面图的邻接矩阵会复习。不要为了“看起来像二维”就把不同指针类型强制转换后访问。

## 11.9 改造、常见错误

在练习副本写一个调用，传NULL、count=1与有效out_total，函数应失败；再传负分钟，out_total原来为999时应保持999。将count置0但传有效out_total，应成功写0。这些都是符合接口的失败测试，不需要伪造坏地址。

常见错误是：把数组参数当完整副本；在函数里用sizeof求长度；把const当全局不可变保证；size_t倒数到负数；把二维数组当二级指针；失败前就写出不完整结果。

## 11.10 练习与参考答案

练习一：为什么`sum_minutes(NULL, 0, &total)`可以成功，而count为1时不行？

答案：空输入不读取元素，但非空输入必须有有效元素区域；两种调用仍都需要有效的输出地址。

练习二：在函数形参声明中，把`values[]`写成`values[100]`会自动检查100个元素吗？

答案：不会。普通这种数组参数仍调整为指针，不自动带来容量检查。

练习三：const int指针能否证明main里的minutes永远不变？

答案：不能。这里只禁止通过该只读访问路径写；main如果有可修改对象，仍可以自行赋值。

## 11.11 完成条件与下一步

能写带长度的数组函数，解释失败不写结果、空输入、sizeof与const；能给size_t写安全倒序。下一章把相关字段组合：[结构体与记录](12-结构体枚举与记录.md)。
