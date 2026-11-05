"""生成截至第 33 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'
DATE = '2026-11-03'

if (EXAMPLES / '15-studyhub-release').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第十四阶段.py')], check=True)
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
    ('第十二阶段', '13-studyhub-accessibility', '第32章兼容、原生控件语义、大字/配色与独立Skyline探针。主工程继续WebView；renderer-probe需单独导入。微信编译、读屏与真机待验收。'),
    ('第十三阶段', '14-studyhub-testing', '第33章系统测试。业务与第32章一致，新增Node测试、故障实验、可选DOM配置和未启用CI模板。渲染/工具/真实环境仍待验收。')
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
    if stage == '第十三阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 33:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(34))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28], [29], [30], [31], [32], [33]]
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
               ['第十二阶段-练习与参考答案.md', '第十二阶段-兼容与无障碍真机验收.md', '第十二阶段-完整源码附录.md'],
               ['第十三阶段-练习与参考答案.md', '第十三阶段-测试运行与分层验收.md', '第十三阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 当前教程正文已到第 33 章，第 34—36 章尚未展开。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三']
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
    '第32章基础库兼容、渲染器、无障碍和真机适配，含两个导入目标、完整源码、20组练习和待填真机验收。',
    '第33章纯函数、异步、组件和流程测试，含标准库50项、500本地回归、附加故障实验、完整源码、20组练习及分层验收。'
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
        end = [9, 15, 19, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 33:
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
        ('13-studyhub-accessibility', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('14-studyhub-testing', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
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
            pending_report = ROOT / '验证' / '第十三阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file

test = json.loads(read(ROOT / '验证' / '第十三阶段测试结果.json'))
assert test['project'] == '14-studyhub-testing' and test['passed'] == 50
assert test['realCloud'] is False and test['realWechat'] is False
assert test['componentRenderingExecuted'] is False and test['devtoolsAutomationExecuted'] is False and test['ciExecuted'] is False
assert test['inheritedPassed'] == 450 and test['totalPassed'] == 500
assert test['expectedNegativePaths'] == 3 and test['fixedMutantsDetected'] == 3
assert test['extraChecksIncludedIn500'] is False
for name, count, total in [('第十三阶段基础继承测试结果.json', 52, 52),
                           ('第十三阶段知识库继承测试结果.json', 56, 108),
                           ('第十三阶段计时继承测试结果.json', 71, 179),
                           ('第十三阶段统计继承测试结果.json', 60, 239),
                           ('第十三阶段平台继承测试结果.json', 59, 298),
                           ('第十三阶段体验继承测试结果.json', 57, 355),
                           ('第十三阶段性能继承测试结果.json', 45, 400),
                           ('第十三阶段兼容继承测试结果.json', 50, 450)]:
    result = json.loads(read(ROOT / '验证' / name))
    assert result['project'] == '14-studyhub-testing' and result['passed'] == count
    assert result.get('totalPassed', result['passed']) == total
    assert result['realCloud'] is False
project = EXAMPLES / '14-studyhub-testing'
latest = json.loads(read(project / 'tests/reports/latest.json'))
negative = json.loads(read(project / 'tests/reports/failure-path.json'))
mutations = json.loads(read(project / 'tests/reports/mutations.json'))
assert latest['status'] == 'passed' and latest['summary']['counts']['passed'] == 50
assert latest['summary']['counts']['tests'] == 50 and len(latest['scenarios']) == 50
assert all(row['status'] == 'passed' for row in latest['scenarios'])
for key in ['failed','skipped','todo','cancelled']:
    assert latest['summary']['counts'][key] == 0
for result in [latest,negative,mutations]:
    assert result['sourceDigest'] == test['sourceDigest']
assert negative['expectedNegativePaths'] == 3 and mutations['detected'] == 3
current_digest = subprocess.run(['node', '-e',
    "const path=require('node:path');console.log(require(path.resolve(process.argv[1],'tests/support/digest.cjs')).digest());", str(project)],
    check=True, capture_output=True, text=True, encoding='utf-8').stdout.strip()
assert current_digest == test['sourceDigest']
package_check = subprocess.run(['node', '-e',
    "const path=require('node:path');const project=path.resolve(process.argv[1]);console.log(JSON.stringify(require(path.join(project,'tools/package-info.cjs')).inspect(project)));",
    str(project)], check=True, capture_output=True, text=True, encoding='utf-8')
inventory = json.loads(package_check.stdout)
assert inventory['mainPages'] == 16 and inventory['subpackagePages'] == 9
identical = 0
for name in ['miniprogram','cloudfunctions','renderer-probe']:
    previous = EXAMPLES / '13-studyhub-accessibility' / name
    previous_files = sorted(p.relative_to(previous) for p in previous.rglob('*') if p.is_file())
    current_files = sorted(p.relative_to(project / name) for p in (project / name).rglob('*') if p.is_file())
    assert current_files == previous_files
    for relative in previous_files:
        assert (previous / relative).read_bytes() == (project / name / relative).read_bytes()
        identical += 1
assert identical == test['businessFilesByteIdentical']
coverage = latest['coverage']
assert len(coverage['files']) == 16
assert coverage['totals']['totalLineCount'] == 618 and coverage['totals']['coveredLineCount'] == 478
node_version = subprocess.run(['node', '--version'], check=True, capture_output=True, text=True, encoding='utf-8').stdout.strip()
report = f"""# 第十三阶段验证记录

汇总日期：{DATE}。本地Node.js：{node_version}。教材编写跨2026-11-02—03；继承结果保留原脚本日期，当前Node教学报告另含实际executedAt与runId。

## 已运行的本地场景

在14项目运行八组继承：基础52、知识库56、计时71、统计60、平台59、体验57、性能45、兼容50，共450项。再执行本章标准库node:test50项：unit14、async12、component/page-method10、flow14，合计{test['totalPassed']}个本地场景。

各套件存在规则重叠，500不是互不重复功能数量。平台继承执行真实127.0.0.1固定文件HTTP上传下载；其他涉及微信/云的部分使用桩或串行内存模型，没有真实消息或权限/并发结论。

本章测试直接使用实际纯函数、读取控制/调用封装、组件/页面方法和task-session/草稿仓储。flow的回执服务是可控fake，不能证明真实数据库幂等或恰好一次。组件定义捕获与方法调用不渲染WXML，不自动验证微信生命周期/原生行为。

""" + '\n'.join(f'{index}. {name}' for index, name in enumerate(test['scenarios'], 1)) + f"""

## 额外的故障检查

- 3个负向fixture：断言失败、skip、超时，均被完整通过判定拒绝；skip子进程可退出0，但不能算完整验收。
- 3个内存固定故障变体：版本字典序、追加失去重、重放另换编号。先验证基线，再要求AssertionError检出；原业务文件未改。
- 这6项不加入500，也不是全项目变异分数。
- 本次与第32章{identical}个业务客户端、云函数及独立探针文件逐字节一致。新增位于测试/文档/模板层，无业务页面或云集合变化。

## 覆盖率与报告

本轮已加载并匹配miniprogram筛选的{len(coverage['files'])}个客户端JS，共{coverage['totals']['totalLineCount']}行、执行{coverage['totals']['coveredLineCount']}行，约{coverage['totals']['coveredLinePercent']:.2f}%。具体文件见项目tests/reports/latest.json。

该数字不是全项目、450项继承总覆盖率、云端、WXML或原生覆盖率；未加载的模块不在分母。Node对应版本覆盖功能标为实验能力，结果随代码和工具变化。覆盖执行不等于断言充分。

报告仅在完整50通过、无失败/取消/skip/TODO时标passed，包含运行ID、实际执行时间和约定代码/配置的SHA-256摘要。运行前后输入一致；摘要不是安全签名，也不证明每个文件执行过。当前摘要：{test['sourceDigest']}。

## 静态与交付检查

- {len(json_files)}个示例JSON解析通过，包含实际测试报告和可选依赖配置；没有伪造可选锁文件。
- {len(scripts)}个JS/CJS通过Node --check，相对模块路径存在；不说明未安装的第三方依赖已可运行。
- {page_count}个登记页面四文件齐全，其中{subpackage_pages}个分包页；tabBar与项目根有效，独立探针另有自己的配置。
- {component_refs}处组件引用有效，{len(wxml_files)}个WXML基础标签/事件方法存在性检查通过，WXSS括号配对。不是微信编译器。
- {links}处Markdown本地链接存在、围栏配对、无Unicode替换字符。
- 第十四组{cloud_sources}个实际文件同步为源码附录，三组客户端/云共享协议一致。
- 第十三册{len(books[12]):,}字符，第01—33章合订版{len(whole):,}字符，包含代码/链接/空白/Markdown，不是纯中文正文字数。

## 未执行的层次

可选Jest/jsdom/simulate仅准备两项渲染候选与直接依赖；未安装或运行，传递依赖/锁文件/实际兼容待核对。开发者工具自动化未安装或连接，CI模板未启用或在GitHub运行。没有把这些计入500。

未执行真实SDK安装、微信/Skyline编译、真实云权限/事务/并发、读屏、原生键盘/焦点、安全区、多设备或真实消息。按 [测试运行与分层验收](../第十三阶段-测试运行与分层验收.md) 独立记录。整理脚本读取既有业务结果并静态检查，不重新运行业务测试。
"""
write(ROOT / '验证' / '第十三阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至33章.zip'
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
    'thirteenth_book_characters': len(books[12]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
