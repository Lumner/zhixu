"""Embed stage7 complete files and promote only previously nonexistent lessons."""
from pathlib import Path
import argparse,re
course=Path(__file__).resolve().parent.parent;source=course/'source';examples=source/'示例代码';draft=course/'drafts/stage7'
parser=argparse.ArgumentParser();parser.add_argument('--promote',action='store_true');args=parser.parse_args()
for doc in sorted(draft.glob('*.md')):
    text=doc.read_text(encoding='utf-8')
    def embed(match):
        file=(examples/match.group(1)).resolve();assert file.is_relative_to(examples.resolve())
        return '```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```'
    text=re.sub(r'@@EXAMPLE:(.*?)@@',embed,text);doc.write_text(text,encoding='utf-8')
    if args.promote:
        target=source/doc.name
        if target.exists():raise SystemExit('Refusing to replace '+str(target))
        doc.rename(target)
parts=['# 第七阶段完整源码\n\n7组完整例程，按 [运行说明](README.md) 各选入口。共享模块、函数和本附录不另计主线/程序。堆排序复用第六阶段公共文件，累计包包含全部依赖。\n']
for folder in ['stage7-common','37-binary-tree','38-traversal','39-bst','40-avl','41-heap','42-huffman']:
    for file in sorted((examples/folder).glob('*')):
        if file.suffix in ['.h','.c']:parts.append('\n## '+folder+'/'+file.name+'\n\n完整文件：['+file.name+'](../'+folder+'/'+file.name+')。\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n')
(examples/'stage7-common/完整源码.md').write_text(''.join(parts),encoding='utf-8')
print('Prepared stage7, promoted='+str(args.promote))
