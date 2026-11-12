"""Embed maintained sources in staged prose; --promote moves only this batch's own Markdown."""
from pathlib import Path
import argparse
import re

course = Path(__file__).resolve().parent.parent
source = course / 'source'
draft = course / 'drafts/stage2'
parser = argparse.ArgumentParser()
parser.add_argument('--promote', action='store_true')
args = parser.parse_args()
for md in sorted(draft.glob('*.md')):
    text = md.read_text(encoding='utf-8')
    def embed(match):
        path = (source / '示例代码' / match.group(1)).resolve()
        assert path.is_relative_to(source.resolve())
        return '```c\n' + path.read_text(encoding='utf-8').rstrip() + '\n```'
    text = re.sub(r'@@EXAMPLE:(.*?)@@', embed, text)
    md.write_text(text, encoding='utf-8')
    if args.promote:
        target = source / md.name
        if target.exists():
            raise SystemExit('Refusing to replace an existing chapter: ' + str(target))
        md.rename(target)
project = source / '示例代码/stage2-catalog'
parts = ['# 资料目录v0.2完整源码\n\n这些文件共同组成一个程序，不是多个主线章节。编译和协议见 [运行说明](README.md)。\n']
for name in ['catalog.h', 'catalog.c', 'main.c', 'sample.txt']:
    language = 'text' if name.endswith('.txt') else 'c'
    parts.append(f'\n## {name}\n\n完整文件：[{name}]({name})。\n\n```{language}\n' + (project / name).read_text(encoding='utf-8').rstrip() + '\n```\n')
(project / '完整源码.md').write_text(''.join(parts), encoding='utf-8')
print('Prepared stage 2; promoted=' + str(args.promote))
