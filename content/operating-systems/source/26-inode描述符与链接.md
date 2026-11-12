# 26 inode、描述符与链接：名字不是文件本身

> **零基础详细版 · 已重写。** 先画名字、inode和打开状态的关系，再观察硬链接、符号链接、共享偏移与删除后仍可读的对象。建议8—11小时。

## 1. 本章目标

先会第25章路径与权限、第14章描述符、dup与偏移。本章学完能分清目录项、文件对象、打开文件描述和fd，正确使用stat/lstat/fstat，解释硬链接与符号链接，并说明unlink移除的是名字。

所有实验在Linux/WSL Ubuntu的Bash，目录`~/os-lab/files`；需要lab.h。会修改名字的命令都在新建的专用目录进行，不拿已有资料做链接或删除实验。

## 2. 四层图分别回答什么

```text
目录项中的名字 ─────→ 文件对象/inode ─→ 数据或相应实现
                          ↑
进程fd编号 ─→ 打开文件描述：偏移、状态标志
```

**目录项**记录某个目录中的名字如何关联对象。**inode**保存或关联文件类型、权限、大小和数据定位等元数据，名字通常在目录项中。**打开文件描述**是一次打开的内核状态，包含偏移等；**fd**是进程表中的索引。

两个名字可以指同一对象，两个fd也可以共享同一个打开状态，但这是两种不同的“多条引用”。不要把它们画成一条没有层次的箭头。

## 3. inode号要结合文件系统身份

在同一文件系统内，inode号用于标识文件对象；跨文件系统可能出现相同数字。比较当前两个路径是否指向同一文件对象，通常要同时比较st_dev与st_ino。

对象删除以后，编号以后也可能重用，所以它不是永久全球唯一标识。文件系统还可能有不同内部实现，本课通过VFS提供的接口理解统一对象信息，不假设磁盘布局都长得一样。

**VFS**是内核向不同文件系统提供统一操作抽象的一层，不是某种特定分区格式。

## 4. 三个查询接口

| 接口 | 从哪里查询 | 遇符号链接时的重点 |
| --- | --- | --- |
| stat(path) | 路径最终目标 | 通常跟随链接 |
| lstat(path) | 路径末尾对象本身 | 查看链接自身 |
| fstat(fd) | 已打开引用 | 不重新解析原路径 |

路径查询和后续操作之间仍可能有变化，不能把一次stat当作未来open一定指向同一对象的保证。已打开fd适合查询你已经取得的对象，但打开本身仍需按需求设计。

## 5. 完整程序：查看对象信息

**完整程序：object-info.c**

```c
#include "lab.h"
#include <inttypes.h>
#include <sys/stat.h>

int main(int argc, char *argv[]) {
    if (argc != 2) { fputs("usage: object-info PATH\n", stderr); return 2; }
    struct stat info;
    if (lstat(argv[1], &info) < 0) { die("lstat"); }
    const char *kind = S_ISREG(info.st_mode) ? "regular" :
                       S_ISDIR(info.st_mode) ? "directory" :
                       S_ISLNK(info.st_mode) ? "symlink" : "other";
    printf("kind=%s device=%ju inode=%ju links=%ju size=%jd mode=%03jo\n",
           kind, (uintmax_t)info.st_dev, (uintmax_t)info.st_ino,
           (uintmax_t)info.st_nlink, (intmax_t)info.st_size,
           (uintmax_t)(info.st_mode & 0777));
    return 0;
}
```

编译：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror -g object-info.c -o object-info
./object-info .
```

`.`应分类为directory。具体inode、大小和mode依环境变化，不写死数字。uintmax_t/intmax_t及%ju/%jd用于按明确的足够宽整数类型打印系统字段；S_ISREG等宏判断类型，不用手猜st_mode的所有位。

## 6. 大小不等于独占存储量

普通文件st_size表示逻辑字节长度；符号链接自身的大小常反映目标路径文本长度；目录的大小由文件系统组织决定，不等于其中所有文件大小之和。

稀疏文件可能有逻辑空洞，不为每个逻辑字节分配实际存储；硬链接也不各自复制数据。统计磁盘占用还涉及已分配块、共享、压缩等口径，不能简单把所有名字的st_size相加就叫真实设备用量。

## 7. 建立硬链接与符号链接

在本批Bash中创建新的专用目录：

```bash
cd ~/os-lab/files
links_dir=$(mktemp -d "$PWD/links-XXXXXX")
cd "$links_dir"
printf 'same data\n' > original.txt
ln original.txt hard.txt
ln -s original.txt soft.txt
ls -li
```

**硬链接**为同一对象增加一个目录项名字；**符号链接**是保存目标路径的另一种对象。original与hard应有相同设备/inode、链接计数增加；soft有自己的inode，内容意义是路径字符串，不是原数据的一份独立备份。

若程序放在父目录，可运行`../object-info original.txt`、`../object-info hard.txt`与`../object-info soft.txt`。链接命令失败时先看名字是否已存在，换新目录，不覆盖不明文件。

## 8. 修改和移除一个名字

在这个专用links_dir执行：

```bash
printf 'changed\n' > hard.txt
cat original.txt
cat soft.txt
rm -- original.txt
cat hard.txt
cat soft.txt
```

写hard会改变同一对象，其他名字查到相应内容。移除original以后，hard仍可读；soft保存的目标名字已不存在，可能报错。符号链接自身仍可被lstat查询，这和stat跟随失败是两件事。

本例重定向会截断**本次创建**的目标对象，不是为通用保存推荐的替换协议；第28章会用新对象发布完整版本。

## 9. 相对符号链接从哪里解释

若refs/soft的目标文本为`../data/note.txt`，解析通常相对于**链接所在目录refs**，不是每次调用者cwd。这样从上级读refs/soft，或进入refs后读soft，都可以找到同一个目标。

软链接可以跨文件系统，也可以暂时指向不存在的目标；硬链接通常不能跨文件系统，普通用户通常不能任意给目录建立硬链接，以免破坏目录结构规则。

包含链接的路径不能总靠字符串化简`..`得到真实结果。固定受控例子容易解释，处理不可信路径则需更严格的接口与策略。

## 10. 打开状态为何另有一层

两次独立open同一对象，通常各有自己的偏移；dup以及fork继承的相关描述符则可共享打开文件描述。这决定“下一次从哪读”，不是名字有没有变化决定的。

第14章用dup观察共享写入位置，这里用两个共享引用和一个独立打开对照。只看fd整数相同或路径相同，都不足以判断偏移关系。

## 11. 完整程序：共享与独立偏移

**完整程序：offset-relations.c**

```c
#include "lab.h"
#include <fcntl.h>

static int one_byte(int fd, char *out) {
    ssize_t n;
    do { n = read(fd, out, 1); } while (n < 0 && errno == EINTR);
    if (n < 0) { perror("read"); return 0; }
    if (n != 1) { fputs("expected one byte\n", stderr); return 0; }
    return 1;
}
int main(int argc, char *argv[]) {
    if (argc != 2) { fputs("usage: offset-relations NEW_FILE\n", stderr); return 2; }
    int first = open(argv[1], O_RDWR | O_CREAT | O_EXCL, 0600);
    if (first < 0) { die("create"); }
    int duplicate = -1, separate = -1, failed = 1;
    write_all(first, "ABC", 3);
    if (lseek(first, 0, SEEK_SET) < 0) { perror("rewind"); goto cleanup; }
    duplicate = dup(first);
    if (duplicate < 0) { perror("dup"); goto cleanup; }
    separate = open(argv[1], O_RDONLY);
    if (separate < 0) { perror("separate open"); goto cleanup; }
    char a, b, c;
    if (!one_byte(first, &a) || !one_byte(duplicate, &b) || !one_byte(separate, &c)) { goto cleanup; }
    off_t shared_offset = lseek(first, 0, SEEK_CUR);
    off_t separate_offset = lseek(separate, 0, SEEK_CUR);
    if (shared_offset < 0 || separate_offset < 0) { perror("position"); goto cleanup; }
    printf("first=%c duplicate=%c independent=%c shared_offset=%ld separate_offset=%ld\n",
           a, b, c, (long)shared_offset, (long)separate_offset);
    failed = 0;
cleanup:
    if (separate >= 0 && close(separate) < 0) { perror("close separate"); failed = 1; }
    if (duplicate >= 0 && close(duplicate) < 0) { perror("close duplicate"); failed = 1; }
    if (close(first) < 0) { perror("close first"); failed = 1; }
    return failed;
}
```

用第5节选项编译，运行`./offset-relations offset-new.txt`。预期first=A、duplicate=B、independent=A，偏移分别2和1。普通读写推进位置，pread则按指定位置读取且不改变这份当前偏移。

## 12. 把结果对应回三条引用

```text
first ─────┐
           ├→ 打开状态1：读过A、B，偏移2 ─→ 同一ABC对象
duplicate ─┘
separate ───→ 打开状态2：读过A，偏移1 ────┘
```

重复运行同名会拒绝覆盖，换一个新文件名即可。例程对常规返回失败做集中关闭；write_all仍沿用本课遇不可恢复写错误就结束整个进程的策略，不把它当成业务恢复库。

## 13. unlink移除名字，不立刻取消所有引用

unlink去掉一个目录项；还有其他硬链接时仍能按那些名字访问。最后一个名字移除以后，已有打开引用也可以继续使用相应对象，直到相关引用都释放后才有机会回收存储。

映射还可能持有后备对象引用，第24章已看到关闭fd不等于撤销映射。不能把“目录里看不见”直接当作“所有内容已经从内存和设备清除”。

## 14. 完整程序：名字消失后通过fd读取

**完整程序：unlink-open.c**

```c
#include "lab.h"
#include <fcntl.h>
#include <inttypes.h>
#include <sys/stat.h>

int main(int argc, char *argv[]) {
    if (argc != 2) { fputs("usage: unlink-open NEW_TEMP_NAME\n", stderr); return 2; }
    int fd = open(argv[1], O_RDWR | O_CREAT | O_EXCL, 0600);
    if (fd < 0) { die("create temporary"); }
    int failed = 1;
    write_all(fd, "abc", 3);
    if (unlink(argv[1]) < 0) { perror("unlink own name"); goto cleanup; }
    struct stat info;
    if (fstat(fd, &info) < 0) { perror("fstat"); goto cleanup; }
    char bytes[3];
    ssize_t n;
    do { n = pread(fd, bytes, sizeof bytes, 0); } while (n < 0 && errno == EINTR);
    if (n < 0) { perror("pread"); goto cleanup; }
    if (n != 3) { fputs("expected three bytes\n", stderr); goto cleanup; }
    printf("links=%ju data=%c%c%c\n", (uintmax_t)info.st_nlink, bytes[0], bytes[1], bytes[2]);
    failed = 0;
cleanup:
    if (close(fd) < 0) { perror("close"); failed = 1; }
    return failed;
}
```

预期links=0 data=abc，结束后新名字不存在。程序只移除它刚用O_EXCL建立的名字，课堂目录由自己控制且没有并发改名；不把这种“创建再按名字删除”推广为对抗不可信修改的安全清理方案。

## 15. 为什么新建同名文件不是原对象复活

original被unlink后再创建同样文本名字，目录项可以关联新对象。旧fd仍引用旧对象，不会因为名字相同自动跳转。

这也是用rename发布新版本时，已经打开旧版本的读者通常仍可读旧对象，而后来按路径打开者得到新对象的原因。原子名字替换不让一个已打开流在中途自动切换到新内容。

## 16. 链接计数的解释范围

普通文件硬链接计数反映相应名字关联数量，不包含每个打开fd，也不因符号链接指向它就自动加一。目录的链接计数与文件系统组织有关，不把普通文件实验数字套给所有目录。

本章验证的是可见接口行为，没有测“最后关闭后设备上何时覆写旧数据”。删除并不等于安全擦除，也不是为敏感文件销毁制定的协议。

## 17. 大小、名字与偏移的排错顺序

先问操作的是路径还是fd；若路径，逐段查起点和链接；若fd，回到它由哪次open或dup得到。再看stat/lstat差别、设备/inode、当前偏移和硬链接计数。

文件内容变化可能是同一对象被写，也可能是名字被替换指向新对象；仅看文件名没变不能判断。把查询和真实操作时间分开记录，避免把过去的元数据当成未来对象的保证。

## 18. 常见误解

“硬链接是一份复制”：两个名字引用同一对象。

“软链接目标相对调用者cwd”：通常相对链接所在目录。

“inode数字一样就全局相同”：还要结合设备/文件系统身份和时间。

“删掉名字，fd立即失效”：已有引用与路径查找分开。

“dup有新编号，所以有独立偏移”：新编号可以仍共享打开状态。

## 19. 练习与参考答案

1. original和hard当前dev/ino相同，写hard后original是否能看到？在没有并发替换等额外情况时会，它们是同一对象。
2. soft指向original，删除original后hard仍在，soft会自动转向hard吗？不会，soft保存的路径没改变。
3. offset-relations再从duplicate读一次，应读什么？C，共享偏移到3；separate仍在1。
4. links=0是否表示不能再用fd？不是，打开引用仍可读取。
5. inode号能作永久全球唯一文档ID吗？不能，文件系统和重用等因素需要考虑。

纸面练习：分别画“两个名字一个对象”和“两个fd一个打开状态”，再增加一个独立open。画不清时先不加更多接口，回到四层图。

## 20. 完成条件与资料

能运行三份完整程序、解释链接变化与偏移变化、准确使用元数据查询接口，知道本章没有证明安全擦除或并发安全路径处理。

接口依据[inode(7)](https://man7.org/linux/man-pages/man7/inode.7.html)、[stat(2)](https://man7.org/linux/man-pages/man2/stat.2.html)、[link(2)](https://man7.org/linux/man-pages/man2/link.2.html)、[symlink(7)](https://man7.org/linux/man-pages/man7/symlink.7.html)和[unlink(2)](https://man7.org/linux/man-pages/man2/unlink.2.html)，核验2026-11-05。下一章：[目录接口与文件工具](27-目录接口与文件工具.md)。
