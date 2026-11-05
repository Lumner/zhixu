# 示例07：直接映射读Cache

运行`node cache.cjs`，需Node.js20或以上，无依赖。默认数据容量64 B、块16 B、4行、初始无效，只模拟读请求，不模拟脏块、写分配、多级Cache或真实延迟。

输入字节地址0,4,16,0,64,0。预期hit序列false,true,false,true,false,false，命中2、缺失4。每行输出地址、块号、index、tag和offset。

空行用null表示，不用tag=0代表“空”，因为tag=0是合法映射。这是常见模型错误。可改输入为0x100开始的五个word，首次扫描2 miss、3 hit，再重复一遍有5 hit。

回到[第26章](../../26-Cache映射替换与写策略.md)。
