"""Prepare the final chapter and a complete six-file C appendix."""
import argparse
import re
import runpy
from pathlib import Path
COURSE=Path(__file__).resolve().parents[1]
SOURCE=COURSE/'source'
EXAMPLES=SOURCE/'示例代码'
APP=EXAMPLES/'stage9-planner'
DRAFT=COURSE/'drafts/stage9b'

def embed(match):
    file=EXAMPLES/match[1]
    if file.suffix not in ('.c','.h') or not file.resolve().is_relative_to(APP.resolve()):
        raise ValueError('invalid example path')
    return '```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```'

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--promote',action='store_true');args=parser.parse_args()
    settings=runpy.run_path(str(SOURCE/'验证/verify-stage9b.py'),run_name='authoring_import')
    lines=['gcc -std=c17 -Wall -Wextra -Wpedantic \\']
    includes=['-I'+name for name in settings['INCLUDE']]
    for i in range(0,len(includes),3):lines.append('  '+' '.join(includes[i:i+3])+' \\')
    files=['stage9-planner/main.c',*settings['FILES']]
    for i in range(0,len(files),3):lines.append('  '+' '.join(files[i:i+3])+' \\')
    lines.append('  -o planner.exe')
    command='```bash\n'+'\n'.join(lines)+'\n```'
    drafts=sorted(DRAFT.glob('*.md'))
    if args.promote and any((SOURCE/p.name).exists() for p in drafts):raise SystemExit('refusing to overwrite delivered files')
    for file in [*drafts,APP/'README.md']:
        text=re.sub(r'@@EXAMPLE:([^@]+)@@',embed,file.read_text(encoding='utf-8')).replace('@@BUILD@@',command)
        file.write_text(text,encoding='utf-8')
    text='# 最终项目完整C源码\n\n下列六份文件组成一个项目，另链接前批模块，完整命令见 [运行说明](README.md)。各块是完整文件，不可把多个文件直接拼接替代头文件与编译链接。\n'
    for file in sorted(APP.iterdir()):
        if file.suffix in ('.c','.h'):
            text+='\n## '+file.name+'\n\n[下载文件]('+file.name+')\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n'
    (APP/'完整源码.md').write_text(text,encoding='utf-8')
    if args.promote:
        for file in drafts:
            with (SOURCE/file.name).open('x',encoding='utf-8') as out:out.write(file.read_text(encoding='utf-8'))
            file.unlink()
    print('prepared six C/H files; promoted:',len(drafts) if args.promote else 0)
