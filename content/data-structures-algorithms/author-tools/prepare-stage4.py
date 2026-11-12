"""One-time stage4 embedding and promotion; existing destination chapters are never overwritten."""
import argparse
from pathlib import Path
import re

course = Path(__file__).resolve().parent.parent
source = course / 'source'
examples = source / '示例代码'
draft = course / 'drafts/stage4'
parser = argparse.ArgumentParser()
parser.add_argument('--promote', action='store_true')
args = parser.parse_args()
for md in sorted(draft.glob('*.md')):
    body = md.read_text(encoding='utf-8')
    def embed(match):
        file = (examples / match.group(1)).resolve()
        assert file.is_relative_to(examples.resolve())
        return '```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```'
    body = re.sub(r'@@EXAMPLE:(.*?)@@', embed, body)
    md.write_text(body, encoding='utf-8')
    if args.promote:
        target = source / md.name
        if target.exists(): raise SystemExit('Refusing to replace '+str(target))
        md.rename(target)
folders = ['stage4-common','21-sequence','22-vector','23-singly','24-doubly','25-stack','26-queue','stage4-expression']
parts = ['# 第四阶段完整源码\n\n文件共同组成8组程序，按 [模块说明](README.md) 选择入口，不把所有main一起链接。本附录不另计主线。\n']
for folder in folders:
    for file in sorted((examples/folder).glob('*')):
        if file.suffix not in ['.c','.h']: continue
        rel = '../'+folder+'/'+file.name
        parts.append('\n## '+folder+'/'+file.name+'\n\n完整文件：['+file.name+']('+rel+')。\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n')
(examples/'stage4-common/完整源码.md').write_text(''.join(parts), encoding='utf-8')
print('Prepared stage4, promoted='+str(args.promote))
