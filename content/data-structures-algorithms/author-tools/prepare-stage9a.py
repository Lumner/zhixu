"""Embed only this batch; --promote refuses to overwrite existing chapter files."""
import argparse
import re
from pathlib import Path

COURSE = Path(__file__).resolve().parents[1]
SOURCE = COURSE / 'source'
EXAMPLES = SOURCE / '示例代码'
DRAFT = COURSE / 'drafts/stage9a'
FOLDERS = ['stage9-common', '49-interval', '49-change', '50-subset', '50-sudoku', '51-dp']

def embed(match):
    file = EXAMPLES / match[1]
    if file.suffix not in ['.c', '.h'] or not file.resolve().is_relative_to(EXAMPLES.resolve()):
        raise ValueError('invalid example path')
    return '```c\n' + file.read_text(encoding='utf-8').rstrip() + '\n```'

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--promote', action='store_true')
    args = parser.parse_args()
    drafts = sorted(DRAFT.glob('*.md'))
    if args.promote and any((SOURCE / file.name).exists() for file in drafts):
        raise SystemExit('refusing to overwrite delivered documents')
    for file in drafts:
        text = re.sub(r'@@EXAMPLE:([^@]+)@@', embed, file.read_text(encoding='utf-8'))
        file.write_text(text, encoding='utf-8')
    text = '# 第九阶段上完整C源码\n\n六组入口分别编译；不将共享模块重复统计。命令和接口见 [构建说明](README.md)。下列均为完整文件，位置相对示例代码根目录，不是可全部拼进一个main的片段。\n'
    count = 0
    for folder in FOLDERS:
        for file in sorted((EXAMPLES / folder).glob('*')):
            if file.suffix in ['.c', '.h']:
                relative = file.relative_to(EXAMPLES).as_posix()
                link = '../' + relative
                text += '\n## ' + relative + '\n\n[下载文件](' + link + ')\n\n```c\n' + file.read_text(encoding='utf-8').rstrip() + '\n```\n'
                count += 1
    (EXAMPLES / 'stage9-common/完整源码.md').write_text(text, encoding='utf-8')
    if args.promote:
        for file in drafts:
            destination = SOURCE / file.name
            with destination.open('x', encoding='utf-8') as out:
                out.write(file.read_text(encoding='utf-8'))
            file.unlink()
    print('example files:', count, 'promoted:', len(drafts) if args.promote else 0)
