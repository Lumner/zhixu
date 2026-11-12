# v0.8a关系网络实验台

这是第八阶段第8组完整工程，组合拓扑与非负路径接口。固定课程依赖和地点样本，提供可复现命令；尚未导入资料目录v0.3、分类树或图文件，不把本实验说成完整v0.8/v1.0。

## 编译与命令

保持累计包目录布局。在 **UCRT64 Bash、解压后的`source/示例代码`目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common -I45-topological -I46-shortest \
  stage8-graph-lab/main.c stage8-common/graph.c 45-topological/topological.c \
  46-shortest/path.c 46-shortest/dijkstra.c -o graph-lab.exe
./graph-lab.exe study
./graph-lab.exe study cycle
./graph-lab.exe route 0 4
./graph-lab.exe route 0 5
./graph-lab.exe route 2 2
```

反斜杠为Bash续行，后面直接换行；也可合并一行。PowerShell不使用这种续行语法。旧MinGW若需%zu兼容，加第09章说明的定义。

study输出`C -> arrays -> pointers -> lists -> graphs`。依赖0→1、0→2、1→3、2→3、3→4；cycle额外加4→0，返回1且stderr为graph-lab: dependency cycle，不给半份计划。

route使用6点无向图，边0—1=4、0—2=2、2—1=1、1—3=5、2—3=8、3—4=2，5孤立：0到4输出`cost=10 path=0,2,1,3,4`；0到5输出unreachable但正常返回0；2到自己输出`cost=0 path=2`。

输入编号只接受单个ASCII数字，且须小于本图6；负号、00、空串、8、6均拒绝。这是小实验协议，不是通用整数读取器；main里的校验已写明，不能只改n还坚持所有旧参数预期都成立。

## 语义与限制

先修箭头不是路线代价；两张图分别构建。仅使用非负路线，失败不输出伪造距离；不可达是正常计算结论。程序不改源代码文件、不联网、不保存资料，不提供自动调度时长或最小生成森林菜单。

完整入口 [main.c](main.c)，依赖和全部新文件见 [源码附录](../stage8-common/完整源码.md)。源码、路径边和负权前提经 [课程验证](../../验证/第八阶段验证记录.md) 实际检查，浏览器和真实业务整合分别验收。
