"""One-time stage6 embedding and promotion, refusing to replace delivered lessons."""
from pathlib import Path
import argparse
import re
course=Path(__file__).resolve().parent.parent
source=course/'source'; examples=source/'示例代码'; draft=course/'drafts/stage6'
parser=argparse.ArgumentParser(); parser.add_argument('--promote',action='store_true'); args=parser.parse_args()
for doc in sorted(draft.glob('*.md')):
    text=doc.read_text(encoding='utf-8')
    def embed(match):
        file=(examples/match.group(1)).resolve(); assert file.is_relative_to(examples.resolve())
        return '```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```'
    text=re.sub(r'@@EXAMPLE:(.*?)@@',embed,text); doc.write_text(text,encoding='utf-8')
    if args.promote:
        target=source/doc.name
        if target.exists(): raise SystemExit('Refusing to replace '+str(target))
        doc.rename(target)
parts=['# 第六阶段完整源码\n\n7组完整工程，按 [运行说明](README.md) 选择入口。公共模块、算法函数与本附录不另计程序或主线。目录v0.3的前批依赖通过相对路径引用，累计包包含它们，见 [工程说明](../stage6-catalog/README.md)。\n']
for folder in ['stage6-common','31-basic-sort','32-insertion-shell','33-merge','34-quick','35-distribution','stage6-lab','stage6-catalog']:
    for file in sorted((examples/folder).glob('*')):
        if file.suffix in ['.c','.h']:
            parts.append('\n## '+folder+'/'+file.name+'\n\n完整文件：['+file.name+'](../'+folder+'/'+file.name+')。\n\n```c\n'+file.read_text(encoding='utf-8').rstrip()+'\n```\n')
(examples/'stage6-common/完整源码.md').write_text(''.join(parts),encoding='utf-8')
print('Prepared stage6, promoted='+str(args.promote))
