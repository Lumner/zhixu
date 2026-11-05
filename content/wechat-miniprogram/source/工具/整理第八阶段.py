"""生成截至第 28 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'
DATE = '2026-11-02'

if (EXAMPLES / '10-studyhub-platform').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第九阶段.py')], check=True)
    raise SystemExit(0)


def read(file):
    return file.read_text(encoding='utf-8')


def write(file, value):
    file.write_text(value, encoding='utf-8')


def include(file):
    return (not any(part in {'node_modules', '.git', '__pycache__'} for part in file.parts)
            and file.name != 'project.private.config.json'
            and not file.name.startswith('.env') and file.suffix != '.log')


languages = {'.js': 'js', '.cjs': 'js', '.json': 'json', '.wxss': 'css', '.wxml': 'xml', '.md': 'markdown'}
stages = [
    ('第二阶段', '03-studyhub-v02', '原生多页面与组件，逐文件对应实际项目。'),
    ('第三阶段', '04-studyhub-network', '客户端在 miniprogram/，本地服务在 server/，按第 17 章先启动服务。'),
    ('第四阶段', '05-studyhub-cloud', '客户端在 miniprogram/，云函数在 cloudfunctions/。需真实 AppID、ENV_ID 与部署。权限和索引计划须手动应用并验收。'),
    ('第五阶段', '06-studyhub-sync', '私人缩略图、回执事务、手动迁移与冲突处理。按 README 部署；云环境与真机待验收。'),
    ('第六阶段', '07-studyhub-knowledge', '第 26 章私人知识库。正文、标签、资源、星标、图片引用与搜索；需六集合和完整云端部署。'),
    ('第七阶段', '08-studyhub-focus', '第 27 章专注计时。八集合、会话槽、后台恢复与幂等终态；真实云与真机验收待执行。'),
    ('第八阶段', '09-studyhub-stats', '第 28 章七日统计。固定 UTC+08:00、整轮归结束日、完整分页、Canvas 2D 与精确表格；真实索引、微信编译和真机待验收。')
]
cloud_sources = 0
for stage, name, note in stages:
    project = EXAMPLES / name
    files = sorted(file for file in project.rglob('*') if file.is_file() and include(file))
    appendix = '# ' + stage + '完整源码附录\n\n对应 `示例代码/' + name + '`。' + note
    appendix += '每段标题是相对项目根目录的实际路径，请逐文件创建。\n\n'
    for file in files:
        body = read(file).rstrip()
        max_ticks = max([len(match.group(0)) for match in re.finditer(r'`{3,}', body)] or [2])
        fence = '`' * (max_ticks + 1)
        appendix += '## 文件：' + file.relative_to(project).as_posix() + '\n\n'
        appendix += fence + languages.get(file.suffix, 'text') + '\n' + body + '\n' + fence + '\n\n'
    write(ROOT / (stage + '-完整源码附录.md'), appendix)
    if stage == '第八阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 28:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(29))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28]]
supplements = [[], ['第二阶段-练习与参考答案.md', '第二阶段-完整源码附录.md'],
               ['第三阶段-练习与参考答案.md', '第三阶段-完整源码附录.md'],
               ['第四阶段-练习与参考答案.md', '第四阶段-部署与双账号验收清单.md', '第四阶段-完整源码附录.md'],
               ['第五阶段-练习与参考答案.md', '第五阶段-部署故障与双账号验收清单.md', '第五阶段-完整源码附录.md'],
               ['第六阶段-练习与参考答案.md', '第六阶段-部署与知识库验收清单.md', '第六阶段-完整源码附录.md'],
               ['第七阶段-练习与参考答案.md', '第七阶段-部署与计时验收清单.md', '第七阶段-完整源码附录.md'],
               ['第八阶段-练习与参考答案.md', '第八阶段-部署与统计验收清单.md', '第八阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 当前教程正文已到第 28 章，第 29—36 章尚未展开。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八']
notes = [
    '从零基础到本地任务板，含总规划与第 01—09 章。', '多页面、组件与本地 v0.2，含第 10—15 章。',
    '异步、HTTP 与网络实验，含第 16—19 章。',
    '云环境、数据库、身份与 CRUD 权限，含第 20—23 章。已准备源码与部署步骤，真实云部署和双账号验收仍待执行。',
    '图片、迁移、回执事务与冲突处理，含第 24—25 章。提供完整示例与本地故障验证，真实云和真机待执行。',
    '第 26 章私人知识库，附代码、练习和验收。',
    '第 27 章专注计时、后台恢复与会话记录，含完整示例、练习和实际环境验收清单。',
    '第 28 章统计口径、日期边界与七日图表，含完整示例、20 组练习和实际环境验收清单。'
]
books = []
for number, names, note in zip(numbers, stage_files, notes):
    value = book('微信小程序开发教程 · 第' + number + '册', names, note)
    write(ROOT / ('微信小程序开发教程-第' + number + '册.md'), value)
    books.append(value)

all_files = []
whole = ''
for index, names in enumerate(stage_files):
    all_files.extend(names)
    if index >= 1:
        end = [9, 15, 19, 23, 25, 26, 27, 28][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 28:
            whole = value

source_files = [file for file in EXAMPLES.rglob('*') if file.is_file() and include(file)]
json_files = [file for file in source_files if file.suffix == '.json']
for file in json_files:
    json.loads(read(file))
scripts = [file for file in source_files if file.suffix in {'.js', '.cjs'}]
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
for file in json_files:
    config = json.loads(read(file))
    if file.name == 'app.json':
        for page in config['pages']:
            page_count += 1
            for extension in ('.js', '.json', '.wxml', '.wxss'):
                assert (file.parent / (page + extension)).is_file(), (file, page)
        for tab in config.get('tabBar', {}).get('list', []):
            assert tab['pagePath'] in config['pages']
    if file.name == 'project.config.json':
        assert (file.parent / config.get('miniprogramRoot', './') / 'app.json').is_file()
        if config.get('cloudfunctionRoot'):
            assert (file.parent / config['cloudfunctionRoot']).is_dir()
    if isinstance(config, dict):
        for alias, target in config.get('usingComponents', {}).items():
            project = next(parent for parent in file.parents if (parent / 'app.json').is_file())
            component = project / target.lstrip('/') if target.startswith('/') else file.parent / target
            for extension in ('.js', '.json', '.wxml', '.wxss'):
                assert component.with_suffix(extension).is_file(), (file, alias, target)
            assert json.loads(read(component.with_suffix('.json'))).get('component') is True
            component_refs += 1

wxml_files = [file for file in source_files if file.suffix == '.wxml']
for file in wxml_files:
    content = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)', '&amp;', read(file))
    content = re.sub(r'wx:else(?=[\s/>])', 'wx:else=""', content)
    ET.fromstring('<root xmlns:wx="urn:wx" xmlns:bind="urn:bind" xmlns:catch="urn:catch">' + content + '</root>')
    for handler in re.findall(r'(?:bind|catch)(?::)?[a-z]+="([A-Za-z_$][\w$]*)"', content):
        assert re.search(r'\b' + re.escape(handler) + r'\s*\(', read(file.with_suffix('.js'))), (file, handler)
for file in [item for item in source_files if item.suffix == '.wxss']:
    content = re.sub(r'/\*.*?\*/', '', read(file), flags=re.S)
    assert content.count('{') == content.count('}'), file

assert read(EXAMPLES / '07-studyhub-knowledge' / 'miniprogram/shared/knowledge-schema.js') == read(EXAMPLES / '07-studyhub-knowledge' / 'cloudfunctions/studyhub/knowledge-schema.js')
for project_name, protocols in [
        ('08-studyhub-focus', ['knowledge-schema.js', 'focus-contract.js']),
        ('09-studyhub-stats', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
    for protocol in protocols:
        project = EXAMPLES / project_name
        assert read(project / 'miniprogram/shared' / protocol) == read(project / 'cloudfunctions/studyhub' / protocol)

links = 0
for file in ROOT.rglob('*.md'):
    if not include(file):
        continue
    content = read(file)
    assert '\ufffd' not in content, file
    fence_size = 0
    for line in content.splitlines():
        ticks = re.match(r'^(`{3,})', line)
        if ticks:
            size = len(ticks.group(1))
            if fence_size == 0:
                fence_size = size
            elif size >= fence_size:
                fence_size = 0
            continue
        if fence_size:
            continue
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', line):
            if re.match(r'^(https?://|#|codex:)', target):
                continue
            destination = file.parent / target.strip('<>').split('#', 1)[0]
            pending_report = ROOT / '验证' / '第八阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file

test = json.loads(read(ROOT / '验证' / '第八阶段测试结果.json'))
assert test['project'] == '09-studyhub-stats' and test['passed'] == 60 and test['realCloud'] is False
assert test['inheritedPassed'] == 179 and test['totalPassed'] == 239
focus_test = json.loads(read(ROOT / '验证' / '第八阶段计时继承测试结果.json'))
assert focus_test['project'] == '09-studyhub-stats' and focus_test['passed'] == 71 and focus_test['totalPassed'] == 179
knowledge_test = json.loads(read(ROOT / '验证' / '第八阶段知识库继承测试结果.json'))
assert knowledge_test['project'] == '09-studyhub-stats' and knowledge_test['passed'] == 56 and knowledge_test['totalPassed'] == 108
base_test = json.loads(read(ROOT / '验证' / '第八阶段基础继承测试结果.json'))
assert base_test['project'] == '09-studyhub-stats' and base_test['passed'] == 52
node_version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True).stdout.strip()
report = f'''# 第八阶段验证记录

日期：{DATE}。本地 Node.js：{node_version}。

## 已运行的本地场景

`验证/verify-stats.cjs` 通过 {test['passed']} 个新增场景，另在 09 项目执行 verify-sync.cjs 的 52 个基础、verify-knowledge.cjs 的 56 个知识库与 verify-focus.cjs 的 71 个计时继承场景，合计 {test['totalPassed']} 个。使用可控服务器/本地时钟、提交前/后故障的内存事务、文件存储桩与微信 API 桩，不访问云账号、不安装真实 SDK。事务模型采用串行隔离，不能替代真实数据库的并发、锁冲突与权限测试。

Canvas 测试核对几何坐标、调用顺序、节点查询、DPR、生命周期和回退，使用调用桩，未执行微信原生绘图。另通过实际 draw 函数导出指令，用带 Pillow 的 Python 重放为两个布局预览并目视核对有数据和零数据布局；预览明确标为非微信截图，不能证明真实字体、设备或基础库渲染已验收。主教程与业务测试不依赖 Pillow。

''' + '\n'.join(f'{index}. {name}' for index, name in enumerate(test['scenarios'], 1)) + f'''

## 静态与交付检查

- {len(json_files)} 个示例 JSON 解析通过。
- {len(scripts)} 个 JS/CJS 通过 Node --check；相对模块路径存在。
- {page_count} 个已登记页面四文件齐全；tabBar、代码根目录和云函数目录有效。
- {component_refs} 处自定义组件路径存在并标记为 component。
- {len(wxml_files)} 个 WXML 基础标签与事件方法存在性检查通过；WXSS 花括号配对。
- {links} 处 Markdown 本地链接存在，代码围栏配对，未发现 Unicode 替换字符。
- 统计版源码附录由 {cloud_sources} 个实际文件同步生成；三组共享协议副本一致。
- 第八册 {len(books[7]):,} 字符；第 01—28 章合订版 {len(whole):,} 字符。含代码、Markdown、链接和空白，不是纯中文正文字数。

## 真实环境待执行

尚未执行：SDK 真实安装与执行、云函数部署、云环境/IAM/数据库规则生效、真实索引及查询成本、双账号权限、微信原生编译与真机 Canvas。
内存数据库测试只能确认代码中携带的查询条件和状态转换，不能证明真实数据库权限或并发行为已经验收。complete=true 表示没有截断，不是跨查询强一致快照。

请使用 `第八阶段-部署与统计验收清单.md` 记录真实执行结果。该整理脚本读取已有测试记录，不重新运行测试。
'''
write(ROOT / '验证' / '第八阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至28章.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and include(file):
            bundle.write(file, file.relative_to(ROOT.parent))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    entries = len(bundle.namelist())
print(json.dumps({'json_files': len(json_files), 'scripts': len(scripts), 'pages': page_count,
    'component_references': component_refs, 'wxml_files': len(wxml_files), 'local_links': links,
    'local_cloud_scenarios': test['totalPassed'], 'cloud_source_files': cloud_sources,
    'eighth_book_characters': len(books[7]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
