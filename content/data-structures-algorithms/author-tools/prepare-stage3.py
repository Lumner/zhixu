"""Embed only this batch's draft sources; --promote refuses existing destination chapters."""
import argparse
from pathlib import Path
import re

course = Path(__file__).resolve().parent.parent
source = course / 'source'
draft = course / 'drafts/stage3'
parser = argparse.ArgumentParser()
parser.add_argument('--promote', action='store_true')
args = parser.parse_args()
for md in sorted(draft.glob('*.md')):
    text = md.read_text(encoding='utf-8')
    def embed(match):
        file = (source / '示例代码' / match.group(1)).resolve()
        assert file.is_relative_to(source.resolve())
        return '```c\n' + file.read_text(encoding='utf-8').rstrip() + '\n```'
    text = re.sub(r'@@EXAMPLE:(.*?)@@', embed, text)
    md.write_text(text, encoding='utf-8')
    if args.promote:
        target = source / md.name
        if target.exists():
            raise SystemExit('Refusing to replace ' + str(target))
        md.rename(target)
print('Prepared stage3, promoted=' + str(args.promote))
