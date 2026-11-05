"""同步第二阶段源码，检查整套文件，生成两册与总合订版。不会重跑业务测试。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'
PROJECT = EXAMPLES / '03-studyhub-v02'
DATE = '2026-10-31'

if (EXAMPLES / '04-studyhub-network').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第三阶段.py')], check=True)
    raise SystemExit(0)


def read(path):
    return path.read_text(encoding='utf-8')


def write(path, content):
    path.write_text(content, encoding='utf-8')


languages = {'.js': 'js', '.json': 'json', '.wxss': 'css', '.wxml': 'xml', '.md': 'markdown'}
source_files = sorted(path for path in PROJECT.rglob('*') if path.is_file())
appendix = '# 第二阶段完整源码附录\n\n'
appendix += '对应 `示例代码/03-studyhub-v02`。每个标题是项目根目录下的相对文件路径，'
appendix += '请逐文件创建。代码由实际示例整理，导入时选该项目目录，使用自己的 AppID。\n\n'
appendix += '学习顺序和逐段解释见第 10—15 章。项目本地业务上限是 200 条任务。'
appendix += '源码不依赖其他版本目录，不需要 npm。\n\n'
for file in source_files:
    appendix += '## 文件：' + file.relative_to(PROJECT).as_posix() + '\n\n'
    appendix += '```' + languages.get(file.suffix, 'text') + '\n' + read(file).rstrip() + '\n```\n\n'
write(ROOT / '第二阶段-完整源码附录.md', appendix)

first = [
    '00-整体规划与最终项目.md', '01-环境准备与第一个小程序.md', '02-JavaScript基础语法.md',
    '03-对象数组函数与异步入门.md', '04-WXML页面结构与模板语法.md', '05-WXSS样式与Flex布局.md',
    '06-数据驱动与事件处理.md', '07-生命周期模块化与本地存储.md', '08-实战学伴任务板v0.1.md',
    '09-调试练习与参考答案.md'
]
second = [
    '10-多页面路由与页面栈.md', '11-路由传参与页面更新.md', '12-表单分类优先级与日期.md',
    '13-自定义组件与组件通信.md', '14-组件生命周期观察器与Behavior.md', '15-项目分层数据迁移与Git入门.md',
    '第二阶段-练习与参考答案.md', '第二阶段-完整源码附录.md'
]


def assemble(title, introduction, chapters):
    return '# ' + title + '\n\n' + introduction + '\n\n' + '\n\n---\n\n'.join(read(ROOT / name) for name in chapters)


book1 = assemble('微信小程序开发教程 · 第一册',
    '从零基础到本地任务板。本册含总规划与第 01—09 章；第 10—15 章已经在第二册展开。'
    '当前进度见 [README](README.md)。整理日期：' + DATE + '。', first + ['99-官方资料与核验说明.md'])
book2 = assemble('微信小程序开发教程 · 第二册',
    '从单页任务板到多页面与自定义组件。包含第 10—15 章、练习答案及完整 v0.2 源码。'
    '先完成第一册，再从第 10 章继续；第 16—36 章尚未展开。编写日期：' + DATE + '。',
    second + ['99-官方资料与核验说明.md'])
whole = assemble('微信小程序开发教程 · 第 01—15 章合订版',
    '当前交付为 36 章规划与第 01—15 章正文，含三个独立示例和两阶段练习答案。'
    '第 16—36 章尚未展开。目录见 [README](README.md)。整理日期：' + DATE + '。',
    first + second + ['99-官方资料与核验说明.md'])
write(ROOT / '微信小程序开发教程-第一册.md', book1)
write(ROOT / '微信小程序开发教程-第二册.md', book2)
write(ROOT / '微信小程序开发教程-第01至15章合订版.md', whole)

json_files = list(EXAMPLES.rglob('*.json'))
for file in json_files:
    json.loads(read(file))
js_files = list(EXAMPLES.rglob('*.js'))
for file in js_files:
    subprocess.run(['node', '--check', str(file)], check=True, capture_output=True, text=True)
    for required in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", read(file)):
        if required.startswith('.'):
            assert (file.parent / required).with_suffix('.js').is_file(), (file, required)

page_count = 0
component_refs = 0
for config in EXAMPLES.glob('*/app.json'):
    app = json.loads(read(config))
    pages = app['pages']
    for page in pages:
        page_count += 1
        for extension in ('.js', '.json', '.wxml', '.wxss'):
            assert (config.parent / (page + extension)).is_file(), (config, page, extension)
    for tab in app.get('tabBar', {}).get('list', []):
        assert tab['pagePath'] in pages

for file in json_files:
    config = json.loads(read(file))
    if not isinstance(config, dict):
        continue
    for alias, target in config.get('usingComponents', {}).items():
        project_root = next(parent for parent in file.parents if (parent / 'app.json').is_file())
        component = project_root / target.lstrip('/') if target.startswith('/') else file.parent / target
        for extension in ('.js', '.json', '.wxml', '.wxss'):
            assert component.with_suffix(extension).is_file(), (file, alias, target)
        assert json.loads(read(component.with_suffix('.json'))).get('component') is True
        component_refs += 1

wxml_files = list(EXAMPLES.rglob('*.wxml'))
for file in wxml_files:
    content = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)', '&amp;', read(file))
    content = re.sub(r'wx:else(?=[\s/>])', 'wx:else=""', content)
    # 检查基础结构；这不等同于 WXML 编译。
    ET.fromstring('<root xmlns:wx="urn:wx" xmlns:bind="urn:bind" xmlns:catch="urn:catch">' + content + '</root>')
    for handler in re.findall(r'(?:bind|catch)(?::)?[a-z]+="([A-Za-z_$][\w$]*)"', content):
        assert re.search(r'\b' + re.escape(handler) + r'\s*\(', read(file.with_suffix('.js'))), (file, handler)

for file in EXAMPLES.rglob('*.wxss'):
    css = re.sub(r'/\*.*?\*/', '', read(file), flags=re.S)
    assert css.count('{') == css.count('}'), file

links = 0
for file in ROOT.glob('*.md'):
    content = read(file)
    assert '\ufffd' not in content, file
    fenced = False
    for line in content.splitlines():
        if line.startswith('```'):
            fenced = not fenced
            continue
        if fenced:
            continue
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', line):
            if re.match(r'^(https?://|#|codex:)', target):
                continue
            assert (file.parent / target.strip('<>').split('#', 1)[0]).exists(), (file, target)
            links += 1
    assert not fenced, file

report = f'''# 第二阶段验证记录

整理日期：{DATE}。

## 已执行的模拟业务验证

本批已单独运行 `node 验证/verify-v02.cjs`，33 个场景通过。覆盖真实日历日期、字段校验、旧数据迁移及失败保护、坏新版本拒绝回退、更新保留身份、返回副本、目标删除后拒绝复活、全量列表刷新、路由分支、表单重复提交与失败保留、组件事件、倒计时隐藏校正与销毁清理。

第一批的 22 个逻辑场景已在原交付中通过，代码未改动。本整理脚本不会重新执行业务测试；若修改源代码，应另外运行对应验证脚本。

## 本次静态和打包检查

- {len(json_files)} 个示例 JSON 文件解析通过。
- {len(js_files)} 个示例 JS 文件通过 Node `--check`。
- {page_count} 个已登记页面的四文件齐全，tabBar 路径正确。
- {component_refs} 处 usingComponents 引用路径存在，目标标记为 component。
- {len(wxml_files)} 个 WXML 文件基础标签与事件方法检查通过。
- 示例相对 require 路径存在，WXSS 花括号配对。
- 根目录 Markdown 中 {links} 处本地链接存在；代码围栏配对，未发现 Unicode 替换字符。
- v0.2 源码附录由 {len(source_files)} 个实际项目文件同步生成。
- 第二册 {len(book2):,} 个字符；第 01—15 章总合订版 {len(whole):,} 个字符。统计包含代码、标记、链接和空白，不是纯中文正文字数。

## 尚需实际微信环境确认

本批未执行微信开发者工具原生编译、视觉走查、真机测试、真实账号或发布验证。模拟环境不派发真实 form/picker/switch 事件，不执行微信路由和生命周期，不验证插槽渲染与样式隔离。

请按第 10—15 章的步骤导入 `示例代码/03-studyhub-v02`，核对原生表单、页面返回刷新、tabBar、按钮冒泡、后台恢复和组件销毁等行为。
'''
write(ROOT / '验证' / '第二阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至15章.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            bundle.write(file, file.relative_to(ROOT.parent))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    archive_entries = len(bundle.namelist())

print(json.dumps({
    'json_files': len(json_files), 'javascript_files': len(js_files), 'pages': page_count,
    'component_references': component_refs, 'wxml_files': len(wxml_files), 'local_links': links,
    'v02_source_files': len(source_files), 'second_book_characters': len(book2),
    'whole_book_characters': len(whole), 'archive_entries': archive_entries,
    'archive_bytes': archive.stat().st_size
}, ensure_ascii=True, indent=2))
