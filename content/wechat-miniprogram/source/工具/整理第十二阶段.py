"""生成截至第 32 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
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

if (EXAMPLES / '14-studyhub-testing').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第十三阶段.py')], check=True)
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
    ('第八阶段', '09-studyhub-stats', '第 28 章七日统计。固定 UTC+08:00、整轮归结束日、完整分页、Canvas 2D 与精确表格；真实索引、微信编译和真机待验收。'),
    ('第九阶段', '10-studyhub-platform', '第 29 章文件、剪贴板、分享与订阅回执。独立消息函数和固定报告 HTTP 实验；真实微信、九集合权限和发送待验收。'),
    ('第十阶段', '11-studyhub-quality', '第30章统一反馈、弱网等待和任务草稿。新任务编辑、固定原编号与恢复；真实缓存、生命周期、云并发和权限待验收。'),
    ('第十一阶段', '12-studyhub-performance', '第31章性能测量、投影视图、分组列表、图片和普通分包；固定模型不等于原生提速，微信编译与真机性能待验收。'),
    ('第十二阶段', '13-studyhub-accessibility', '第32章兼容、原生控件语义、大字/配色与独立Skyline探针。主工程继续WebView；renderer-probe需单独导入。微信编译、读屏与真机待验收。')
]
cloud_sources = 0
for stage, name, note in stages:
    project = EXAMPLES / name
    files = sorted(file for file in project.rglob('*') if file.is_file() and include(file))
    appendix = '# ' + stage + '完整源码附录\n\n对应 `示例代码/' + name + '`。' + note
    appendix += '每段标题是相对项目根目录的实际路径，请逐文件创建。\n\n'
    for file in files:
        if file.suffix == '.png':
            appendix += '## 文件：' + file.relative_to(project).as_posix() + '\n\n'
            generator = 'make-image-fixtures.cjs' if file.name in {'fixture-small.png', 'fixture-large.png'} else 'make-share-card.cjs'
            appendix += '固定公开二进制资源，随项目提供；在本项目目录运行 `node tools/' + generator + '` 可重新生成。\n\n'
            appendix += '[查看图片](' + file.relative_to(ROOT).as_posix() + ')\n\n'
            continue
        body = read(file).rstrip()
        max_ticks = max([len(match.group(0)) for match in re.finditer(r'`{3,}', body)] or [2])
        fence = '`' * (max_ticks + 1)
        appendix += '## 文件：' + file.relative_to(project).as_posix() + '\n\n'
        appendix += fence + languages.get(file.suffix, 'text') + '\n' + body + '\n' + fence + '\n\n'
    write(ROOT / (stage + '-完整源码附录.md'), appendix)
    if stage == '第十二阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 32:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(33))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28], [29], [30], [31], [32]]
supplements = [[], ['第二阶段-练习与参考答案.md', '第二阶段-完整源码附录.md'],
               ['第三阶段-练习与参考答案.md', '第三阶段-完整源码附录.md'],
               ['第四阶段-练习与参考答案.md', '第四阶段-部署与双账号验收清单.md', '第四阶段-完整源码附录.md'],
               ['第五阶段-练习与参考答案.md', '第五阶段-部署故障与双账号验收清单.md', '第五阶段-完整源码附录.md'],
               ['第六阶段-练习与参考答案.md', '第六阶段-部署与知识库验收清单.md', '第六阶段-完整源码附录.md'],
               ['第七阶段-练习与参考答案.md', '第七阶段-部署与计时验收清单.md', '第七阶段-完整源码附录.md'],
               ['第八阶段-练习与参考答案.md', '第八阶段-部署与统计验收清单.md', '第八阶段-完整源码附录.md'],
               ['第九阶段-练习与参考答案.md', '第九阶段-部署与平台能力验收清单.md', '第九阶段-完整源码附录.md'],
               ['第十阶段-练习与参考答案.md', '第十阶段-部署与体验验收清单.md', '第十阶段-完整源码附录.md'],
               ['第十一阶段-练习与参考答案.md', '第十一阶段-性能验收与测量记录.md', '第十一阶段-完整源码附录.md'],
               ['第十二阶段-练习与参考答案.md', '第十二阶段-兼容与无障碍真机验收.md', '第十二阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 当前教程正文已到第 32 章，第 33—36 章尚未展开。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
notes = [
    '从零基础到本地任务板，含总规划与第 01—09 章。', '多页面、组件与本地 v0.2，含第 10—15 章。',
    '异步、HTTP 与网络实验，含第 16—19 章。',
    '云环境、数据库、身份与 CRUD 权限，含第 20—23 章。已准备源码与部署步骤，真实云部署和双账号验收仍待执行。',
    '图片、迁移、回执事务与冲突处理，含第 24—25 章。提供完整示例与本地故障验证，真实云和真机待执行。',
    '第 26 章私人知识库，附代码、练习和验收。',
    '第 27 章专注计时、后台恢复与会话记录，含完整示例、练习和实际环境验收清单。',
    '第 28 章统计口径、日期边界与七日图表，含完整示例、20 组练习和实际环境验收清单。',
    '第 29 章文件、剪贴板、分享、订阅消息与能力检测，含完整示例、20 组练习、HTTP 服务和真实环境验收清单。',
    '第30章统一反馈、弱网恢复与任务草稿，含固定故障实验、完整源码、20组练习和真实环境验收清单。',
    '第31章性能测量、视图更新、列表、图片与分包，含固定模型、完整源码、20组练习和待填真机测量记录。',
    '第32章基础库兼容、渲染器、无障碍和真机适配，含两个导入目标、完整源码、20组练习和待填真机验收。'
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
        end = [9, 15, 19, 23, 25, 26, 27, 28, 29, 30, 31, 32][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 32:
            whole = value

source_files = [file for file in EXAMPLES.rglob('*') if file.is_file() and include(file)]
json_files = [file for file in source_files if file.suffix == '.json']
for file in json_files:
    json.loads(read(file))
scripts = [file for file in source_files if file.suffix in {'.js', '.cjs'}]
for file in scripts:
    subprocess.run(['node', '--check', str(file)], check=True, capture_output=True, text=True, encoding='utf-8')
    for required in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", read(file)):
        if required.startswith('.'):
            target = file.parent / required
            if not target.suffix:
                target = target.with_suffix('.js')
            assert target.is_file(), (file, required)

page_count = 0
component_refs = 0
subpackage_pages = 0
for file in json_files:
    config = json.loads(read(file))
    if file.name == 'app.json':
        packages = config.get('subpackages', config.get('subPackages', []))
        extra_pages = [package['root'].rstrip('/') + '/' + page for package in packages for page in package['pages']]
        pages = config['pages'] + extra_pages
        assert len(set(pages)) == len(pages), file
        subpackage_pages += len(extra_pages)
        for page in pages:
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
        ('09-studyhub-stats', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('10-studyhub-platform', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('11-studyhub-quality', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('12-studyhub-performance', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('13-studyhub-accessibility', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
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
        inline_free = re.sub(r'(`+).*?\1', '', line)
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', inline_free):
            if re.match(r'^(https?://|#|codex:)', target):
                continue
            destination = file.parent / target.strip('<>').split('#', 1)[0]
            pending_report = ROOT / '验证' / '第十二阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file

test = json.loads(read(ROOT / '验证' / '第十二阶段测试结果.json'))
assert test['project'] == '13-studyhub-accessibility' and test['passed'] == 50
assert test['realCloud'] is False and test['realWechat'] is False
assert test['screenReaderVerified'] is False and test['skylineCompiled'] is False
assert test['inheritedPassed'] == 400 and test['totalPassed'] == 450
for name, count, total in [('第十二阶段基础继承测试结果.json', 52, 52),
                           ('第十二阶段知识库继承测试结果.json', 56, 108),
                           ('第十二阶段计时继承测试结果.json', 71, 179),
                           ('第十二阶段统计继承测试结果.json', 60, 239),
                           ('第十二阶段平台继承测试结果.json', 59, 298),
                           ('第十二阶段体验继承测试结果.json', 57, 355),
                           ('第十二阶段性能继承测试结果.json', 45, 400)]:
    result = json.loads(read(ROOT / '验证' / name))
    assert result['project'] == '13-studyhub-accessibility' and result['passed'] == count
    assert result.get('totalPassed', result['passed']) == total
    assert result['realCloud'] is False
model = json.loads(read(ROOT / '验证' / '第十二阶段兼容模型结果.json'))
assert model['realWechat'] is False and model['screenReaderVerified'] is False
assert model['skylineCompiled'] is False and model['kind'] == 'fixedNodeModel'
assert len(model['palette']) == 8 and all(row['ratio'] >= 4.5 for row in model['palette'])
package_check = subprocess.run(['node', '-e',
    "const path=require('node:path');const project=path.resolve(process.argv[1]);console.log(JSON.stringify(require(path.join(project,'tools/package-info.cjs')).inspect(project)));",
    str(EXAMPLES / '13-studyhub-accessibility')], check=True, capture_output=True, text=True, encoding='utf-8')
inventory = json.loads(package_check.stdout)
assert inventory == model['clientSource']
assert inventory['mainPages'] == 16 and inventory['subpackagePages'] == 9
probe = EXAMPLES / '13-studyhub-accessibility' / 'renderer-probe'
probe_config = json.loads(read(probe / 'app.json'))
assert probe_config['renderer'] == 'skyline' and probe_config['componentFramework'] == 'glass-easel'
assert json.loads(read(EXAMPLES / '13-studyhub-accessibility' / 'miniprogram/app.json'))['renderer'] == 'webview'
node_version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True, encoding='utf-8').stdout.strip()
report = f"""# 第十二阶段验证记录

日期：{DATE}。本地Node.js：{node_version}。

## 已运行的本地场景

verify-compatibility.cjs通过{test['passed']}个新增场景。在13主工程另运行52个基础、56个知识库、71个计时、60个统计、59个平台、57个体验、45个性能继承场景，共{test['totalPassed']}个。

新增通过实际能力/版本模块、窗口监听、表单/卡片代码、配色计算与页面桩验证未知值、诊断允许列表、监听代际、事件协议、隐藏焦点、控件结构、主工程与隔离工程配置。450是本地场景数，不是设备数量或读屏次数。

平台继承执行真实127.0.0.1固定文件上传下载。微信API、窗口、焦点、renderer和云函数仍为桩或串行内存模型，没有真实消息、云权限或并发证明。

""" + '\n'.join(f'{index}. {name}' for index, name in enumerate(test['scenarios'], 1)) + f"""

## 固定模型与颜色

- 2.10.0高于2.9.9；2.20等于2.20.0；未知格式返回null，不冒充0或最高版本。
- 无API的环境快照明确标为固定Node模型，非当前手机数据；不读取型号、设备ID、私人输入或原始异常。
- 浅/深两套共8组不透明文本颜色，未四舍五入前均不低于4.5:1课程目标；黑白21:1、同色1:1基准通过。不是整应用无障碍认证。
- 主工程客户端16主包页/9普通分包页，共25页，仍WebView。独立renderer-probe另1页、另一个导入目标；其配置请求Skyline，未执行实际编译或回退。
- 主工程原始源码清单：主包{inventory['groups']['main']['rawBytes']}字节，packageLab {inventory['groups']['packageLab']['rawBytes']}字节。不含云函数或隔离工程，不等于编译下载包；不用于证明性能。

## 静态与交付检查

- {len(json_files)}个示例JSON解析通过。
- {len(scripts)}个JS/CJS通过Node --check，相对模块路径存在。
- {page_count}个登记页面四文件齐全，其中{subpackage_pages}个分包页；tabBar与项目代码根有效，含独立探针自身的页面和配置。
- {component_refs}处组件引用有效，{len(wxml_files)}个WXML基础标签与事件方法存在性检查通过，WXSS括号配对。不是微信编译器，也不是读屏或视觉测量。
- {links}处Markdown本地链接存在，围栏配对，未发现Unicode替换字符。
- 第十三组示例{cloud_sources}个实际文件同步为源码附录，含两个导入目标和PNG资源链接；三组共享协议副本一致。
- 第十二册{len(books[11]):,}字符，第01—32章合订版{len(whole):,}字符；包含代码、链接、空白和Markdown，不是纯中文正文字数。

## 真实环境待执行

未执行SDK安装、微信或Skyline编译、实际renderer/回退、读屏/原生焦点/键盘、大字/安全区、多设备或真实云权限/并发。主业务保留WebView；独立探针600px只是窗口未知时的布局回退，不称实测。

按 [兼容与无障碍真机验收](../第十二阶段-兼容与无障碍真机验收.md) 逐项操作，保留版本、步骤与原始证据。Node及静态检查不能替代VoiceOver/TalkBack、真实布局或微信审核。整理脚本读取既有测试结果，不重新运行业务测试。
"""
write(ROOT / '验证' / '第十二阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至32章.zip'
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
    'twelfth_book_characters': len(books[11]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
