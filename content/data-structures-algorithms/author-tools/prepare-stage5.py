"""One-time stage5 embedding/promotion. Never overwrite an existing lesson."""
from pathlib import Path
import argparse
import re
course = Path(__file__).resolve().parent.parent
source = course / 'source'
examples = source / '示例代码'
draft = course / 'drafts/stage5'
parser = argparse.ArgumentParser()
parser.add_argument('--promote', action='store_true')
args = parser.parse_args()
for doc in sorted(draft.glob('*.md')):
    text = doc.read_text(encoding='utf-8')
    def embed(match):
        file = (examples / match.group(1)).resolve()
        assert file.is_relative_to(examples.resolve())
        return '```c\n' + file.read_text(encoding='utf-8').rstrip() + '\n```'
    text = re.sub(r'@@EXAMPLE:(.*?)@@', embed, text)
    doc.write_text(text, encoding='utf-8')
    if args.promote:
        target = source / doc.name
        if target.exists(): raise SystemExit('Refusing to replace '+str(target))
        doc.rename(target)
parts = ['# 第五阶段完整源码\n\n共4组完整程序，分别选择入口。按 [运行说明](README.md) 组合文件，不把多个main链接在一起。本附录不另计主线或例程。\n']
for folder in ['stage5-common','27-matching','28-chaining','29-open-addressing','stage5-indexed-catalog']:
    for file in sorted((examples/folder).glob('*')):
        if file.suffix in ['.h','.c']:
            parts.append('\n## '+folder+'/'+file.name+'\n\n完整文件：['+file.name+'](../'+folder+'/'+file.name+')。\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n')
(examples/'stage5-common/完整源码.md').write_text(''.join(parts), encoding='utf-8')
print('Prepared stage5, promoted='+str(args.promote))
