# 27 字符串匹配与KMP

## 27.1 目标与先修

先完成第09章字符串、第17—20章循环不变量与查找，能解释数组下标、size_t和const。建议6—8小时，包含手推、手打和改错。学完应能定义“第一次出现”，手算前缀表，解释KMP失配时为什么不把正文下标退回。

你在标题`ababababac`中查`ababac`。找的是连续的一段，不能隔几个字母拼起来。被查的长串叫**正文text**，要找的短串叫**模式pattern**。这叫字符串匹配。它和第20章“在整数数组里找一个数”解决的问题不同。

## 27.2 先约定到底怎样算匹配

本章按**字节**相等匹配，区分大小写；不做大小写折叠、拼音、Unicode规范化或模糊搜索。C函数接收指针与明确长度n、m；n最多256，m最多64。非零长度需要有效可读的连续空间；长度为0时相应指针可以NULL。库函数可以处理包含零字节的缓冲区，因为不依赖strlen；命令行演示接受C字符串，无法通过argv传入内部零字节。

结果Match有found和index。找到：found=1，index是从0开始的最早字节位置；没找到：found=0，index=n。空模式规定在位置0匹配，包括空正文。空正文里找非空模式失败。空正文时成功和失败的index都可能为0，所以必须同时看found，不能只比较index。

M_OK表示这次计算完成，不表示一定找到。M_INVALID是NULL参数等协议错误，M_LENGTH是超预算或前缀表空间不足；失败不改输出。结构体输出变量、pi数组必须是调用者独立的有效空间，不与输入重叠。函数能检查NULL，不能替你验证任意地址是否有效。

## 27.3 朴素算法：每个起点重新对齐

从start=0开始，依次检查text[start+j]与pattern[j]。全部m字节相等就返回；某一处不同，start加1，j回0。

```text
正文    a b a b a b a b a c
起点0   a b a b a c          第6个字节不同
起点1     a b a b a c        第1个字节不同
起点2       a b a b a c      又在末尾附近不同
起点3         a b a b a c    第1个字节不同
起点4           a b a b a c  全部相同
```

进入某个起点时，更小的起点都已排除；内循环j之前的字节都相等。只有j==m才成功。先检查m<=n，才计算n-m；size_t是无符号数，m>n时直接做n-m会得到很大的值，不能靠循环“自然不执行”。

非空模式且m<=n时，候选起点有n-m+1个，每处最多比较m次，因此最坏O((n-m+1)m)，常写成O(nm)。不是每个输入都比较这么多：第一个字节就成功的短模式可能很快。额外空间Θ(1)。

## 27.4 重复比较中藏着什么信息

正文先读到`ababa`，我们已经确认这5字节和模式开头相等。接着看到b，而模式想要c。旧的5字节里，末尾`aba`恰好也是模式开头`aba`。因此无需丢掉所有进展，可以保留“已经匹配3字节”，再用当前b比较模式下标3。

**前缀**是从开头取的连续部分；**后缀**是从结尾取的连续部分。**真前缀**不包含整个字符串。`ababa`的最长相同真前缀和后缀是`aba`，长度3。这里比的是内容，前后两段可以重叠。

KMP是Knuth、Morris、Pratt三位研究者名字的缩写。它预先记录模式自身的重复关系，失配时用这些关系缩短j。正文位置继续向前，不重新读取更早起点的全部字节。

## 27.5 前缀表pi的精确定义与手算

pi[i]定义为pattern[0..i]的最长相同真前缀与后缀的**长度**。下标i、长度pi[i]不是同一种量；不要把另一本资料里带-1的next表直接代入这里的代码。

| i | 当前字节 | 当前段 | 最长相同真前后缀 | pi[i] |
| --- | --- | --- | --- | --- |
| 0 | a | a | 空串 | 0 |
| 1 | b | ab | 空串 | 0 |
| 2 | a | aba | a | 1 |
| 3 | b | abab | ab | 2 |
| 4 | a | ababa | aba | 3 |
| 5 | c | ababac | 空串 | 0 |

构造时，j先是上一个位置的最长长度。若pattern[i]==pattern[j]，能再延长一个字节；否则，旧候选长度j的更短候选应是pi[j-1]，而非一律j-1。以最后的c为例：j从3退到pi[2]=1，再退到pi[0]=0，仍不能延长，结果0。

每次回退都严格缩短j，所以不会无限循环。j=0时不读pi[j-1]；单字节模式只有pi[0]=0。循环中j<=i，访问pattern[j]不会越过当前模式长度。

## 27.6 匹配时怎样复用这张表

处理text[i]前，j表示已匹配的模式前缀长度；它也是已处理正文后缀与模式前缀相等的长度。当前字节失配就重复j=pi[j-1]，寻找还能保留的最长候选，再比较当前字节。不是跳过当前正文字符。

| 正文i | 字节 | 处理前j | 回退 | 处理后j |
| --- | --- | --- | --- | --- |
| 0 | a | 0 | 无 | 1 |
| 1 | b | 1 | 无 | 2 |
| 2 | a | 2 | 无 | 3 |
| 3 | b | 3 | 无 | 4 |
| 4 | a | 4 | 无 | 5 |
| 5 | b | 5 | 5→3 | 4 |
| 6 | a | 4 | 无 | 5 |
| 7 | b | 5 | 5→3 | 4 |
| 8 | a | 4 | 无 | 5 |
| 9 | c | 5 | 无 | 6，成功 |

最后一个匹配字节下标9，长度6，因此起点9+1-6=4。第一次达到j==m就返回，正文按顺序处理，所以得到最早匹配。此后不再访问pattern[j]，避免j==m时读到模式末尾之外。

为什么失配不会漏掉正确起点？已匹配部分如果还能作为新匹配的末尾，它必须同时是模式前缀和旧匹配段后缀；pi链恰好按长度递减枚举这些可保留候选。更长的候选先尝试，失败才继续缩短；没有这种相等关系的起点已经被旧比较排除。

## 27.7 完整C文件与复现实验

下载 [matching.h](示例代码/27-matching/matching.h)、[matching.c](示例代码/27-matching/matching.c)、[main.c](示例代码/27-matching/main.c) 到自己的`~/dsa-labs/ch27`。

完整文件matching.h：

```c
#ifndef DSA_MATCHING_H
#define DSA_MATCHING_H
#include <stddef.h>
#define MATCH_TEXT_MAX 256
#define MATCH_PATTERN_MAX 64
typedef enum { M_OK, M_INVALID, M_LENGTH } MStatus;
typedef struct { int found; size_t index; } Match;
MStatus prefix_build(const char *pattern, size_t m, size_t *pi, size_t capacity);
MStatus naive_match(const char *text, size_t n, const char *pattern, size_t m, Match *out);
MStatus kmp_match(const char *text, size_t n, const char *pattern, size_t m, Match *out);
#endif
```

完整文件matching.c：

```c
#include "matching.h"

static MStatus validate(const char *text, size_t n, const char *pattern, size_t m, const Match *out)
{
    if (out == NULL || (n != 0 && text == NULL) || (m != 0 && pattern == NULL)) {
        return M_INVALID;
    }
    if (n > MATCH_TEXT_MAX || m > MATCH_PATTERN_MAX) {
        return M_LENGTH;
    }
    return M_OK;
}
MStatus prefix_build(const char *pattern, size_t m, size_t *pi, size_t capacity)
{
    if (m != 0 && (pattern == NULL || pi == NULL)) {
        return M_INVALID;
    }
    if (m > MATCH_PATTERN_MAX || capacity < m) {
        return M_LENGTH;
    }
    if (m == 0) {
        return M_OK;
    }
    pi[0] = 0;
    size_t j = 0;
    for (size_t i = 1; i < m; i++) {
        while (j > 0 && pattern[i] != pattern[j]) {
            j = pi[j - 1];
        }
        if (pattern[i] == pattern[j]) {
            j++;
        }
        pi[i] = j;
    }
    return M_OK;
}
MStatus naive_match(const char *text, size_t n, const char *pattern, size_t m, Match *out)
{
    MStatus status = validate(text, n, pattern, m, out);
    if (status != M_OK) {
        return status;
    }
    Match result = {0, n};
    if (m <= n) {
        for (size_t start = 0; start <= n - m; start++) {
            size_t j = 0;
            while (j < m && text[start + j] == pattern[j]) {
                j++;
            }
            if (j == m) {
                result.found = 1;
                result.index = start;
                break;
            }
        }
    }
    *out = result;
    return M_OK;
}
MStatus kmp_match(const char *text, size_t n, const char *pattern, size_t m, Match *out)
{
    MStatus status = validate(text, n, pattern, m, out);
    if (status != M_OK) {
        return status;
    }
    Match result = {0, n};
    if (m == 0) {
        result.found = 1;
        result.index = 0;
    }
    else if (m <= n) {
        size_t pi[MATCH_PATTERN_MAX];
        (void)prefix_build(pattern, m, pi, MATCH_PATTERN_MAX);
        size_t j = 0;
        for (size_t i = 0; i < n; i++) {
            while (j > 0 && text[i] != pattern[j]) {
                j = pi[j - 1];
            }
            if (text[i] == pattern[j]) {
                j++;
            }
            if (j == m) {
                result.found = 1;
                result.index = i + 1 - m;
                break;
            }
        }
    }
    *out = result;
    return M_OK;
}
```

validate是仅本文件使用的辅助函数，static限制链接可见性。`*out=result`最后统一写回；`(void)prefix_build(...)`明确忽略返回值，因为长度和指针前提已在本路径验证。它不是普遍忽略错误的模板。前缀函数单独暴露，方便把实际表与手算对照。

完整入口见 [main.c](示例代码/27-matching/main.c) 与 [本阶段源码附录](示例代码/stage5-common/完整源码.md)。在 **UCRT64 Bash、`~/dsa-labs/ch27`目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c matching.c -o matching.exe
./matching.exe
./matching.exe "aaaaa" "aaa"
./matching.exe "abc" ""
./matching.exe "abc" "z"
```

第一条运行输出：

```text
pi=0,0,1,2,3,0
naive found=1 index=4
kmp found=1 index=4
```

后面三次的两种结果应分别是found=1/index=0、found=1/index=0、found=0/index=3。空模式pi=后面没有数字，这不是漏打印。旧MinGW若对%zu有兼容问题，使用第09章说明的`-D__USE_MINGW_ANSI_STDIO=1`，不改为错误的格式符。

## 27.8 时间、空间与真实使用边界

构表时i总共向前m次，j每次增加至多1；所有回退总量受这些增加限制，因此构表O(m)。扫描同理，i前进n次，j增长总量至多n，回退总量也不超过增长量；尽管有嵌套while，总计O(n)。合起来O(n+m)，不是O(nm)。

常规KMP保存m项前缀表，额外空间O(m)。本版预算固定64，实际局部数组占`64*sizeof(size_t)`字节；没有堆分配。复杂度讨论把预算推广为可变m，不能把所有有限程序都说成“常数”。

入口的strlen也要扫描输入长度；这里正文与模式各求一次。后面的标题批量查询为了简单会每条重建pi，r条标题总成本O(各标题长度之和+r*m)。同一模式复用前缀表可以减少重复构表，但本版未提供那种独立扫描接口。

## 27.9 中文、大小写与常见错误

UTF-8中文可能一个字占多个字节。匹配结果是字节偏移，不是第几个汉字；本库不验证输入是否有效UTF-8。对合法UTF-8同一字节序列可作精确子串查找，但不理解同形字、组合字符与语言规则。

常见错误：没检查m<=n就做无符号减法；将pi当下标而不是长度；失配后i和j一起退；j=0时访问pi[-1]；找到完整模式后还访问pattern[m]；空模式不单独处理；只用index判断是否找到；把按字节匹配描述成完整中文搜索。

## 27.10 练习与参考答案

练习一：`aaaa`的pi是多少？答案：0,1,2,3；最后的真前缀最长只有3，不能取整个长度4。

练习二：在`ababc`中找`abc`，读最后c前，j应怎样回退？答案：读到下标2的a时已从j=2回退到0，再增长到1；接着b到2，最后c到3，起点2。画出每个字节，不能只写最终数字。

练习三：空正文中找空模式与找`a`，结果分别怎样？答案：前者found=1/index=0，后者found=0/index=0。M_OK在二者中都成立。

更多独立任务见 [第五阶段练习](第五阶段-练习.md)，做完再看 [参考答案](第五阶段-参考答案.md)。

## 27.11 完成条件

能不看代码算出`ababac`的pi，跟踪正文j变化，说明两种算法结果相同但重复比较方式不同；能运行空、单字节、重复、无结果和模式更长的例子。下一章从“在一段文字里找”转到“用ID直接找记录”。
