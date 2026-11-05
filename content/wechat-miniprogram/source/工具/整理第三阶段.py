"""整理第三阶段及此前各册。静态检查与打包不重跑需要回环连接的业务测试。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'
DATE = '2026-10-31'

if (EXAMPLES / '05-studyhub-cloud').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第四阶段.py')], check=True)
    raise SystemExit(0)


def read(path):
    return path.read_text(encoding='utf-8')


def write(path, content):
    path.write_text(content, encoding='utf-8')


languages = {'.js': 'js', '.cjs': 'js', '.json': 'json', '.wxss': 'css', '.wxml': 'xml', '.md': 'markdown'}


def source_appendix(project_name, title, note, output):
    project = EXAMPLES / project_name
    files = sorted(file for file in project.rglob('*') if file.is_file())
    value = '# ' + title + '\n\n' + note + '\n\n'
    for file in files:
        value += '## 文件：' + file.relative_to(project).as_posix() + '\n\n'
        value += '```' + languages.get(file.suffix, 'text') + '\n' + read(file).rstrip() + '\n```\n\n'
    write(ROOT / output, value)
    return len(files)


source_appendix('03-studyhub-v02', '第二阶段完整源码附录',
    '对应 `示例代码/03-studyhub-v02`。每个标题是项目内的相对文件路径；逐文件创建。第 10—15 章有详细解释。',
    '第二阶段-完整源码附录.md')
network_files = source_appendix('04-studyhub-network', '第三阶段完整源码附录',
    '对应 `示例代码/04-studyhub-network`。导入项目外层目录，客户端位于 miniprogram/，'
    '服务端位于 server/；先启动 Node 服务，再在开发工具编译。每段标题是相对项目根目录的实际文件路径。'
    '本附录完整保留本地任务功能，并包含本阶段新增网络模块，不依赖上一版目录。',
    '第三阶段-完整源码附录.md')

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
third = [
    '16-Promise与async-await系统入门.md', '17-HTTP接口与本地服务入门.md',
    '18-请求封装错误处理与竞态控制.md', '19-分页刷新防抖与缓存实战.md',
    '第三阶段-练习与参考答案.md', '第三阶段-完整源码附录.md'
]


def assemble(title, introduction, chapters):
    return '# ' + title + '\n\n' + introduction + '\n\n' + '\n\n---\n\n'.join(read(ROOT / name) for name in chapters + ['99-官方资料与核验说明.md'])


book1 = assemble('微信小程序开发教程 · 第一册',
    '从零基础到本地任务板，收录第 01—09 章和总规划。当前已续写到第 19 章，后续内容见第二、三册与 [README](README.md)。', first)
book2 = assemble('微信小程序开发教程 · 第二册',
    '多页面与自定义组件，收录第 10—15 章、练习答案与完整 v0.2 源码。第 16—19 章已在第三册展开。', second)
book3 = assemble('微信小程序开发教程 · 第三册',
    'Promise、async/await、HTTP、本地服务、请求封装、竞态、分页、刷新、防抖与缓存。'
    '收录第 16—19 章、练习答案和完整客户端/服务端源码。编写日期：' + DATE
    + '。第 20—36 章尚未展开。目录见 [README](README.md)。', third)
whole15 = assemble('微信小程序开发教程 · 第 01—15 章合订版',
    '此文件保留前两阶段的连续内容；当前课程已到第 19 章，最新完整导航见 [README](README.md)。', first + second)
whole = assemble('微信小程序开发教程 · 第 01—19 章合订版',
    '当前交付：36 章规划、第 01—19 章详细正文、四个独立示例、三阶段练习与答案。'
    '第 20—36 章仍为后续规划。整理日期：' + DATE + '。分章目录见 [README](README.md)。', first + second + third)
for name, value in [
    ('微信小程序开发教程-第一册.md', book1), ('微信小程序开发教程-第二册.md', book2),
    ('微信小程序开发教程-第三册.md', book3), ('微信小程序开发教程-第01至15章合订版.md', whole15),
    ('微信小程序开发教程-第01至19章合订版.md', whole)
]:
    write(ROOT / name, value)

json_files = list(EXAMPLES.rglob('*.json'))
for file in json_files:
    json.loads(read(file))
scripts = list(EXAMPLES.rglob('*.js')) + list(EXAMPLES.rglob('*.cjs'))
for file in scripts:
    subprocess.run(['node', '--check', str(file)], check=True, capture_output=True, text=True)
    for required in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", read(file)):
        if required.startswith('.'):
            target = file.parent / required
            if not target.suffix:
                target = target.with_suffix('.js')
            assert target.is_file(), (file, required)

page_count = 0
component_refs = 0
for config in EXAMPLES.rglob('app.json'):
    app = json.loads(read(config))
    for page in app['pages']:
        page_count += 1
        for extension in ('.js', '.json', '.wxml', '.wxss'):
            assert (config.parent / (page + extension)).is_file(), (config, page, extension)
    for tab in app.get('tabBar', {}).get('list', []):
        assert tab['pagePath'] in app['pages']

for file in json_files:
    config = json.loads(read(file))
    if not isinstance(config, dict):
        continue
    if file.name == 'project.config.json':
        assert (file.parent / config.get('miniprogramRoot', './') / 'app.json').is_file(), file
    for alias, target in config.get('usingComponents', {}).items():
        project = next(parent for parent in file.parents if (parent / 'app.json').is_file())
        component = project / target.lstrip('/') if target.startswith('/') else file.parent / target
        for extension in ('.js', '.json', '.wxml', '.wxss'):
            assert component.with_suffix(extension).is_file(), (file, alias, target)
        assert json.loads(read(component.with_suffix('.json'))).get('component') is True
        component_refs += 1

wxml_files = list(EXAMPLES.rglob('*.wxml'))
for file in wxml_files:
    value = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)', '&amp;', read(file))
    value = re.sub(r'wx:else(?=[\s/>])', 'wx:else=""', value)
    ET.fromstring('<root xmlns:wx="urn:wx" xmlns:bind="urn:bind" xmlns:catch="urn:catch">' + value + '</root>')
    for handler in re.findall(r'(?:bind|catch)(?::)?[a-z]+="([A-Za-z_$][\w$]*)"', value):
        assert re.search(r'\b' + re.escape(handler) + r'\s*\(', read(file.with_suffix('.js'))), (file, handler)
for file in EXAMPLES.rglob('*.wxss'):
    value = re.sub(r'/\*.*?\*/', '', read(file), flags=re.S)
    assert value.count('{') == value.count('}'), file

link_count = 0
for file in ROOT.rglob('*.md'):
    value = read(file)
    assert '\ufffd' not in value, file
    fenced = False
    for line in value.splitlines():
        if line.startswith('```'):
            fenced = not fenced
            continue
        if fenced:
            continue
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', line):
            if re.match(r'^(https?://|#|codex:)', target):
                continue
            assert (file.parent / target.strip('<>').split('#', 1)[0]).exists(), (file, target)
            link_count += 1
    assert not fenced, file

result_path = ROOT / '验证' / '第三阶段测试结果.json'
result = json.loads(read(result_path))
assert result['passed'] == 38 and result['realLoopbackHttp'] is True
node_version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True).stdout.strip()
report = f'''# 第三阶段验证记录

日期：{DATE}。本机 Node.js：{node_version}。

## 已运行的测试

`验证/verify-network.cjs` 已通过 {result['passed']} 个场景。测试使用真实本机回环 HTTP 验证健康检查、45 条分页资源、中文 JSON POST、错误状态、有限重试、超时与取消；使用可控 Promise 验证乱序响应、旧错误隔离、刷新和分页合并、缓存、页面防抖与刷新收尾。

执行环境默认沙箱阻止回环连接，测试经权限检查后在沙箱外临时 127.0.0.1 端口完成，服务已随测试关闭，不访问外网。

场景明细：

''' + '\n'.join(f'{index}. {name}' for index, name in enumerate(result['scenarios'], 1)) + f'''

## 本次静态和文件检查

- {len(json_files)} 个示例 JSON 解析通过。
- {len(scripts)} 个示例 JS/CJS 通过 Node --check；相对模块路径存在。
- {page_count} 个页面四文件齐全；tabBar、miniprogramRoot 和 {component_refs} 处组件引用正确。
- {len(wxml_files)} 个 WXML 基础标签与事件方法存在性检查通过；WXSS 花括号配对。
- {link_count} 处 Markdown 本地链接存在；代码围栏配对，未发现 Unicode 替换字符。
- 第三阶段附录由 {network_files} 个实际项目文件生成。
- 第三册 {len(book3):,} 字符；第 01—19 章合订版 {len(whole):,} 字符。含代码、Markdown、链接和空白，不是纯中文正文字数。

## 验证边界

真实 HTTP 使用 Node 传输适配器模拟 wx.request 的回调约定；并未运行微信原生 wx.request、WXML 编译、开发工具界面或手机真机。分页的固定数据不代替动态数据库分页验证。本地调试开关不表示已满足正式 HTTPS/合法域名与账号条件。

本整理脚本读取已完成测试记录，不重新启动测试。修改网络逻辑后，应重新运行 verify-network.cjs 并更新结果，再打包。
'''
write(ROOT / '验证' / '第三阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至19章.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            bundle.write(file, file.relative_to(ROOT.parent))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    entries = len(bundle.namelist())

print(json.dumps({ 'json_files': len(json_files), 'scripts': len(scripts), 'pages': page_count,
    'component_references': component_refs, 'wxml_files': len(wxml_files), 'local_links': link_count,
    'network_scenarios': result['passed'], 'network_source_files': network_files,
    'third_book_characters': len(book3), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size }, ensure_ascii=True, indent=2))
