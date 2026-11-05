"""维护者用：同步源码附录、检查文件、生成合订版和 ZIP。仅使用 Python 标准库。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'

# 课程已有第二阶段时，使用支持多页与组件的新整理入口。
if (EXAMPLES / '03-studyhub-v02').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第二阶段.py')], check=True)
    raise SystemExit(0)


def read(path):
    return path.read_text(encoding='utf-8')


def write(path, value):
    path.write_text(value, encoding='utf-8')


# 附录始终取自真正可导入的项目文件，避免正文附录与源码版本不一致。
project = EXAMPLES / '02-study-board'
order = [
    'app.js', 'app.json', 'app.wxss', 'project.config.json', 'sitemap.json',
    'utils/task.js', 'services/storage.js', 'pages/index/index.json',
    'pages/index/index.js', 'pages/index/index.wxml', 'pages/index/index.wxss'
]
parts = []
languages = {'.js': 'js', '.json': 'json', '.wxss': 'css', '.wxml': 'xml'}
for name in order:
    source = project / name
    parts.append('### 文件：' + name + '\n\n```' + languages[source.suffix]
                 + '\n' + read(source).rstrip() + '\n```\n')
chapter = ROOT / '08-实战学伴任务板v0.1.md'
start = '<!-- SOURCE_APPENDIX_START -->'
end = '<!-- SOURCE_APPENDIX_END -->'
before, rest = read(chapter).split(start, 1)
_, after = rest.split(end, 1)
write(chapter, before + start + '\n\n' + '\n'.join(parts) + '\n' + end + after)

json_files = list(EXAMPLES.rglob('*.json'))
for file in json_files:
    json.loads(read(file))

js_files = list(EXAMPLES.rglob('*.js'))
for file in js_files:
    subprocess.run(['node', '--check', str(file)], check=True, capture_output=True, text=True)
    for required in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", read(file)):
        if required.startswith('.'):
            target = file.parent / required
            assert target.with_suffix('.js').is_file(), (file, required)

for config in EXAMPLES.glob('*/app.json'):
    for page in json.loads(read(config))['pages']:
        for extension in ('.js', '.json', '.wxml', '.wxss'):
            assert (config.parent / (page + extension)).is_file(), (config, page, extension)

wxml_files = list(EXAMPLES.rglob('*.wxml'))
for file in wxml_files:
    content = read(file)
    # 仅借助 XML 解析器检查标签嵌套；WXML 表达式不是通用 XML，转义裸 & 供解析。
    content_for_xml = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)', '&amp;', content)
    ET.fromstring('<root xmlns:wx="urn:wx">' + content_for_xml + '</root>')
    handlers = re.findall(r'(?:bind|catch)(?::)?[a-z]+="([A-Za-z_$][\w$]*)"', content)
    js = read(file.with_suffix('.js'))
    for handler in handlers:
        assert re.search(r'\b' + re.escape(handler) + r'\s*\(', js), (file, handler)

chapters = [
    '00-整体规划与最终项目.md',
    '01-环境准备与第一个小程序.md',
    '02-JavaScript基础语法.md',
    '03-对象数组函数与异步入门.md',
    '04-WXML页面结构与模板语法.md',
    '05-WXSS样式与Flex布局.md',
    '06-数据驱动与事件处理.md',
    '07-生命周期模块化与本地存储.md',
    '08-实战学伴任务板v0.1.md',
    '09-调试练习与参考答案.md',
    '99-官方资料与核验说明.md'
]
book = '# 微信小程序开发教程 · 第一册\n\n'
book += '从完全零基础到本地任务板。日期：2026-10-28。\n\n'
book += '本册包含总规划、第 01—09 章和资料说明。第 10—36 章是后续规划，尚未展开正文。'
book += '分章导航见 [README](README.md)，完整项目在同目录的“示例代码”中。\n\n'
book += '\n\n---\n\n'.join(read(ROOT / chapter) for chapter in chapters)
write(ROOT / '微信小程序开发教程-第一册.md', book)

link_count = 0
for file in ROOT.glob('*.md'):
    fenced = False
    for line in read(file).splitlines():
        if line.startswith('```'):
            fenced = not fenced
            continue
        if fenced:
            continue
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', line):
            if re.match(r'^(https?://|#|codex:)', target):
                continue
            local = target.strip('<>').split('#', 1)[0]
            assert (file.parent / local).exists(), (file, target)
            link_count += 1

result = subprocess.run(['node', str(ROOT / '验证' / 'verify.cjs')], check=True,
                        capture_output=True, text=True, encoding='utf-8')
assert 'All 22 logic scenarios passed.' in result.stdout
chars = len(book)
report = f'''# 验证记录

检查日期：2026-10-28。

- {len(json_files)} 个示例 JSON 文件解析通过。
- {len(js_files)} 个示例 JavaScript 文件通过 Node.js `--check` 语法检查。
- 项目 pages 登记的页面文件齐全，示例相对 require 路径存在。
- {len(wxml_files)} 个 WXML 文件通过静态标签嵌套和事件方法存在性检查。
- 根目录 Markdown 中 {link_count} 处本地文件链接存在。
- 22 个模拟业务场景全部通过；测试代码见 [verify.cjs](verify.cjs)。
- 第 08 章完整源码附录已从实际示例文件同步生成。
- 合订版含 {chars:,} 个字符（包含 Markdown、代码、链接与空白，不等于纯中文正文字数）。

## 逻辑测试输出

```text
{result.stdout.rstrip()}
```

## 还需实际环境确认

未在本次交付中执行微信开发者工具编译、模拟器视觉走查、手机真机测试、真实 AppID/云开发/发布验证。
静态 XML 解析只检查基础嵌套，不是完整 WXML 编译器。Node 模拟中的 setData/存储/弹窗也不是微信原生实现。

学习者应按第 01、08、09 章导入示例并完成手动验收。账号、基础库、工具界面和平台规则以实际操作时的官方信息为准。
'''
write(ROOT / '验证' / '验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第一阶段.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as target:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            target.write(file, file.relative_to(ROOT.parent))

print(json.dumps({
    'json_files': len(json_files), 'javascript_files': len(js_files),
    'wxml_files': len(wxml_files), 'local_links': link_count,
    'logic_scenarios': 22, 'book_characters': chars,
    'archive_bytes': archive.stat().st_size,
    'book': str(ROOT / '微信小程序开发教程-第一册.md'),
    'archive': str(archive)
}, ensure_ascii=False, indent=2))
