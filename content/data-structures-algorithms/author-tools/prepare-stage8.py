"""Embed stage8 sources and promote only new lessons."""
from pathlib import Path
import argparse,re
course=Path(__file__).resolve().parent.parent;source=course/'source';examples=source/'示例代码';draft=course/'drafts/stage8'
parser=argparse.ArgumentParser();parser.add_argument('--promote',action='store_true');args=parser.parse_args()
for doc in sorted(draft.glob('*.md')):
    text=doc.read_text(encoding='utf-8')
    def embed(match):
        file=(examples/match.group(1)).resolve();assert file.is_relative_to(examples.resolve());return '```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```'
    text=re.sub(r'@@EXAMPLE:(.*?)@@',embed,text);doc.write_text(text,encoding='utf-8')
    if args.promote:
        target=source/doc.name
        if target.exists():raise SystemExit('Refusing to replace '+str(target))
        doc.rename(target)
parts=['# 第八阶段完整源码\n\n8组独立程序，各自选择入口，见 [构建表](README.md)。共享模块、函数与附录不另计主线/例程。[关系实验台](../stage8-graph-lab/README.md) 复用拓扑/路径，不是最终项目成品。\n']
for folder in ['stage8-common','43-graph','44-traversal','45-topological','46-shortest','47-negative-paths','48-spanning','stage8-graph-lab']:
    for file in sorted((examples/folder).glob('*')):
        if file.suffix in ['.h','.c']:parts.append('\n## '+folder+'/'+file.name+'\n\n完整文件：['+file.name+'](../'+folder+'/'+file.name+')。\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n')
(examples/'stage8-common/完整源码.md').write_text(''.join(parts),encoding='utf-8');print('Prepared stage8, promoted='+str(args.promote))
