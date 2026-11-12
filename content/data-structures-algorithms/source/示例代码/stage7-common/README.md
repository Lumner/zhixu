# 第七阶段七组完整例程

新增7组，累计48组。共享头、算法函数、测试程序和源码附录不重复计数。平台主线Windows x64、MSYS2 UCRT64 Bash、C17；作者实际验证使用已有MinGW-w64 GCC8.1.0，不是本批新装MSYS2。

## 文件组合

| 工程 | 真实文件 | 重点 |
| --- | --- | --- |
| 二叉树构造 | [tree.h](../37-binary-tree/tree.h)、[tree.c](../37-binary-tree/tree.c)、[main.c](../37-binary-tree/main.c) | 空标记、63节点、失败保留、后序释放 |
| 遍历对照 | 复用tree.h/c，加 [traversal.h](../38-traversal/traversal.h)、[traversal.c](../38-traversal/traversal.c)、[main.c](../38-traversal/main.c) | 三递归、三显式栈、层序 |
| BST | [bst.h](../39-bst/bst.h)、[bst.c](../39-bst/bst.c)、[main.c](../39-bst/main.c) | 唯一键、插入/三种删除/最小值 |
| AVL | [avl.h](../40-avl/avl.h)、[avl.c](../40-avl/avl.c)、[main.c](../40-avl/main.c) | 插入、四类失衡、缓存高度；无删除API |
| 优先队列 | [heap.h](../41-heap/heap.h)、[heap.c](../41-heap/heap.c)、[main.c](../41-heap/main.c) | 完全形状、上浮/下沉、建堆 |
| 堆排序 | [heapsort.h](../41-heap/heapsort.h)、[heapsort.c](../41-heap/heapsort.c)、[sort_main.c](../41-heap/sort_main.c)，复用第六阶段公共模块 | 大根堆、升序、不稳定、统一计数 |
| 哈夫曼 | [huffman.h](../42-huffman/huffman.h)、[huffman.c](../42-huffman/huffman.c)、[main.c](../42-huffman/main.c) | 有界数组树、前缀编码/解码 |

除堆排序外都需要本目录 [tree_status.h](tree_status.h)。单章平铺练习按正文复制到自己的独立文件夹，每次只选自己main；同名入口不能覆盖混用。全量展示在 [完整源码](完整源码.md)。

## 保持累计包布局时编译

在 **UCRT64 Bash、解压后的`source/示例代码`目录**，依次执行（相互独立，不必全部一次运行）：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common 37-binary-tree/main.c 37-binary-tree/tree.c -o tree.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common -I37-binary-tree 38-traversal/main.c 38-traversal/traversal.c 37-binary-tree/tree.c -o traversal.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common 39-bst/main.c 39-bst/bst.c -o bst.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common 40-avl/main.c 40-avl/avl.c -o avl.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common 41-heap/main.c 41-heap/heap.c -o heap.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 41-heap/sort_main.c 41-heap/heapsort.c stage6-common/sort_common.c stage6-common/demo.c -o heap-sort.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage7-common 42-huffman/main.c 42-huffman/huffman.c -o huffman.exe
./tree.exe
./traversal.exe
./bst.exe
./avl.exe
./heap.exe
./heap-sort.exe
./huffman.exe
```

旧MinGW若需要%zu兼容，在gcc后加-D__USE_MINGW_ANSI_STDIO=1，详见第09章。-I只影响头文件搜索，所需.c仍须写在命令里。堆排序是新增独立入口，没有修改前批九算法实验台或sort.h。

## 协议与限制

树高空0/叶1；普通二叉树允许重复值，BST/AVL拒绝重复键，最多63节点，错误输出保持；拥有节点对象先init后clear，不能浅拷贝拥有者。AVL只实现插入；红黑/B树是正文概览。遍历使用节点指针工作数组，不把地址转换成int。

MinHeap固定63项，按priority升序再id升序，允许完全重复Job，不是同优先级FIFO；对象不拥有指针，可值复制。堆排序独立沿用SItem/n<=128/SortStats，不稳定且不申请辅助记录数组。

哈夫曼最多8不同字节、权重1—1000、最多15节点；消息64字节、位串448字符。单符号码0，空表只处理空输入；decode不加零终止，须用数量。展示0/1文本，不做位打包、文件码表序列化或通用压缩；不使用旧Job堆强转表示哈夫曼节点。

真实测试及未覆盖平台/浏览器范围见 [验证](../../验证/第七阶段验证记录.md)。
