"""生成截至第 31 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
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

if (EXAMPLES / '13-studyhub-accessibility').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第十二阶段.py')], check=True)
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
    ('第十一阶段', '12-studyhub-performance', '第31章性能测量、投影视图、分组列表、图片和普通分包；固定模型不等于原生提速，微信编译与真机性能待验收。')
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
    if stage == '第十一阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 31:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(32))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28], [29], [30], [31]]
supplements = [[], ['第二阶段-练习与参考答案.md', '第二阶段-完整源码附录.md'],
               ['第三阶段-练习与参考答案.md', '第三阶段-完整源码附录.md'],
               ['第四阶段-练习与参考答案.md', '第四阶段-部署与双账号验收清单.md', '第四阶段-完整源码附录.md'],
               ['第五阶段-练习与参考答案.md', '第五阶段-部署故障与双账号验收清单.md', '第五阶段-完整源码附录.md'],
               ['第六阶段-练习与参考答案.md', '第六阶段-部署与知识库验收清单.md', '第六阶段-完整源码附录.md'],
               ['第七阶段-练习与参考答案.md', '第七阶段-部署与计时验收清单.md', '第七阶段-完整源码附录.md'],
               ['第八阶段-练习与参考答案.md', '第八阶段-部署与统计验收清单.md', '第八阶段-完整源码附录.md'],
               ['第九阶段-练习与参考答案.md', '第九阶段-部署与平台能力验收清单.md', '第九阶段-完整源码附录.md'],
               ['第十阶段-练习与参考答案.md', '第十阶段-部署与体验验收清单.md', '第十阶段-完整源码附录.md'],
               ['第十一阶段-练习与参考答案.md', '第十一阶段-性能验收与测量记录.md', '第十一阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 当前教程正文已到第 31 章，第 32—36 章尚未展开。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']
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
    '第31章性能测量、视图更新、列表、图片与分包，含固定模型、完整源码、20组练习和待填真机测量记录。'
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
        end = [9, 15, 19, 23, 25, 26, 27, 28, 29, 30, 31][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 31:
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
        ('12-studyhub-performance', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
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
            pending_report = ROOT / '验证' / '第十一阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file

test = json.loads(read(ROOT / '验证' / '第十一阶段测试结果.json'))
assert test['project'] == '12-studyhub-performance' and test['passed'] == 45
assert test['realCloud'] is False and test['realWechat'] is False
assert test['nativePerformanceMeasured'] is False
assert test['inheritedPassed'] == 355 and test['totalPassed'] == 400
for name, count, total in [('第十一阶段基础继承测试结果.json', 52, 52),
                           ('第十一阶段知识库继承测试结果.json', 56, 108),
                           ('第十一阶段计时继承测试结果.json', 71, 179),
                           ('第十一阶段统计继承测试结果.json', 60, 239),
                           ('第十一阶段平台继承测试结果.json', 59, 298),
                           ('第十一阶段体验继承测试结果.json', 57, 355)]:
    result = json.loads(read(ROOT / '验证' / name))
    assert result['project'] == '12-studyhub-performance' and result['passed'] == count
    assert result.get('totalPassed', result['passed']) == total
    assert result['realCloud'] is False
model = json.loads(read(ROOT / '验证' / '第十一阶段性能模型结果.json'))
assert model['nativeWechatMeasured'] is False
assert model['jsonModel']['sameFinalState'] is True
assert model['formModel']['visibleProjectionEquivalent'] is True
package_check = subprocess.run(['node', '-e',
    "const path=require('node:path');const project=path.resolve(process.argv[1]);console.log(JSON.stringify(require(path.join(project,'tools/package-info.cjs')).inspect(project)));",
    str(EXAMPLES / '12-studyhub-performance')], check=True, capture_output=True, text=True, encoding='utf-8')
inventory = json.loads(package_check.stdout)
assert inventory == model['packageSources']['after']
assert inventory['mainPages'] == 16 and inventory['subpackagePages'] == 7
node_version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True, encoding='utf-8').stdout.strip()
report = f"""# 第十一阶段验证记录

日期：{DATE}。本地Node.js：{node_version}。

## 已运行的本地场景

verify-performance.cjs通过{test['passed']}个新增场景。在12项目另运行52个基础、56个知识库、71个计时、60个统计、59个平台、57个体验继承场景，共{test['totalPassed']}个。

新增使用实际视图投影、表单会话、列表页面、性能页面和图片事件模块，配合确定时钟与API/回调桩，验证逻辑正确性、路径追加、隐藏恢复、采样边界、分包依赖与异常。400个是场景数，不是400台设备或性能采样次数。

继承测试保留实际业务模块和串行内存事务。平台继承执行真实127.0.0.1固定文件上传下载；没有实际微信消息或公网请求。原生性能页40步流程使用立即回调桩验证，不产生真机耗时结论。

""" + '\n'.join(f'{index}. {name}' for index, name in enumerate(test['scenarios'], 1)) + f"""

## 固定模型与源码清单

- 同一120行40次更新：整体数组JSON更新量{model['jsonModel']['baseline']['updateJsonBytes']}字节，路径方案{model['jsonModel']['optimized']['updateJsonBytes']}字节；调用均40次，初始化分别{model['jsonModel']['baseline']['initialJsonBytes']}字节，最终状态相同。
- 实际task-session固定流：原完整快照{model['formModel']['baselineCalls']}次、{model['formModel']['baselineJsonBytes']}字节；新适配器{model['formModel']['optimized']['calls']}次、{model['formModel']['optimized']['bytes']}字节，跳过{model['formModel']['optimized']['skipped']}次，可见投影相同。
- 原主包源码203089字节；新主包{inventory['groups']['main']['rawBytes']}字节，packageLab {inventory['groups']['packageLab']['rawBytes']}字节。主包减少不等于总体源码缩小，新增实验与图片增加了客户端总量。
- JSON是UTF-8近似数据量，不是原生桥字节、网络流量或FPS；源码清单不是编译、压缩、上传或下载包。
- 两张PNG头部与字节已核对，实际资源已解码目视查看；RGBA8只作单层像素估算，不是实际GPU或进程内存。load事件不代表下载次数。

## 静态与交付检查

- {len(json_files)}个示例JSON解析通过。
- {len(scripts)}个JS/CJS通过Node --check，相对模块路径存在。
- {page_count}个登记页面四文件齐全，其中{subpackage_pages}个分包页；tabBar和客户端根有效。新示例16主包/7分包页面，字面路由与相对模块图通过。
- {component_refs}处组件引用有效，{len(wxml_files)}个WXML基础标签与事件方法存在性检查通过，WXSS括号配对。不是微信编译器。
- {links}处Markdown本地链接存在，围栏配对，未发现Unicode替换字符。
- 第十二个示例{cloud_sources}个实际文件同步为源码附录，图片以资源链接提供并注明各自生成工具，三组共享协议副本一致。
- 第十一册{len(books[10]):,}字符，第01—31章合订版{len(whole):,}字符；包含代码、链接、空白和Markdown，不是纯中文正文字数。

## 真实环境待执行

未执行真实SDK安装、微信编译、编译包体、原生首屏/回调/FPS/CPU/内存、图片懒加载、不同设备、真实云权限/并发或消息发送。本地模型不证明原生性能提升；性能观察默认关闭，无指标保持未知，未配置预加载。

按 [性能验收与测量记录](../第十一阶段-性能验收与测量记录.md) 执行实际环境操作。本次真机记录留空；onLoad→onReady和setData回调不称完整首屏或物理绘制完成。整理脚本读取已有业务测试结果，不重新运行业务测试。
"""
write(ROOT / '验证' / '第十一阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至31章.zip'
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
    'eleventh_book_characters': len(books[10]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
