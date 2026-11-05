"""生成截至第 34 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
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

if (EXAMPLES / '16-studyhub-operations').is_dir():
    subprocess.run([sys.executable, str(ROOT / '工具' / '整理第十五阶段.py')], check=True)
    raise SystemExit(0)


def read(file):
    return file.read_text(encoding='utf-8')


def write(file, value):
    file.write_text(value, encoding='utf-8')


def include(file):
    return (not any(part in {'node_modules', '.git', '__pycache__'} for part in file.parts)
            and file.name != 'project.private.config.json'
            and not file.name.startswith('.env') and file.suffix.lower() not in {'.log', '.pem', '.key', '.p12', '.pfx'})


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
    ('第十三阶段', '14-studyhub-testing', '第33章系统测试。业务与第32章一致，新增Node测试、故障实验、可选DOM配置和未启用CI模板。渲染/工具/真实环境仍待验收。'),
    ('第十四阶段', '15-studyhub-release', '第34章隐私与发布准备。三个选读入口先检查，原生同意后主动重试；本地检查默认受阻，不执行部署/上传/审核/发布。数据治理和真实环境待验收。')
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
    if stage == '第十四阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 34:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(35))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28], [29], [30], [31], [32], [33], [34]]
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
               ['第十三阶段-练习与参考答案.md', '第十三阶段-测试运行与分层验收.md', '第十三阶段-完整源码附录.md'],
               ['第十四阶段-练习与参考答案.md', '第十四阶段-隐私授权与发布验收.md', '第十四阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 当前教程正文已到第 34 章，第 35—36 章尚未展开。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四']
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
    '第33章纯函数、异步、组件和流程测试，含标准库50项、500本地回归、附加故障实验、完整源码、20组练习及分层验收。',
    '第34章数据清单、平台隐私、原生同意与主动重试、发布材料和本地检查，含550本地场景、完整源码、20组练习与真实验收表；未实际上传/审核/发布。'
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
        end = [9, 15, 19, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 34:
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
        ('14-studyhub-testing', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('15-studyhub-release', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
    for protocol in protocols:
        project = EXAMPLES / project_name
        assert (project / 'miniprogram/shared' / protocol).read_bytes() == (project / 'cloudfunctions/studyhub' / protocol).read_bytes()

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
            pending_report = ROOT / '验证' / '第十四阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file


test = json.loads(read(ROOT / '验证' / '第十四阶段测试结果.json'))
system_test = json.loads(read(ROOT / '验证' / '第十四阶段测试体系继承结果.json'))
assert test['project'] == system_test['project'] == '15-studyhub-release'
assert test['passed'] == 50 and test['inheritedPassed'] == 500 and test['totalPassed'] == 550
assert system_test['passed'] == 50 and system_test['inheritedPassed'] == 450 and system_test['totalPassed'] == 500
for key in ['realCloud','realWechat','realPrivacyAuthorization','uploaded','submittedForReview','published','localReadiness']:
    assert test[key] is False
for key in ['realCloud','realWechat','componentRenderingExecuted','devtoolsAutomationExecuted','ciExecuted','extraChecksIncludedIn500']:
    assert system_test[key] is False
assert system_test['expectedNegativePaths'] == 3 and system_test['fixedMutantsDetected'] == 3
for name, count, total in [('基础',52,52), ('知识库',56,108), ('计时',71,179), ('统计',60,239),
                           ('平台',59,298), ('体验',57,355), ('性能',45,400), ('兼容',50,450)]:
    result = json.loads(read(ROOT / '验证' / ('第十四阶段' + name + '继承测试结果.json')))
    assert result['project'] == '15-studyhub-release' and result['passed'] == count
    assert result.get('totalPassed',result['passed']) == total and result['realCloud'] is False
project = EXAMPLES / '15-studyhub-release'
latest = json.loads(read(project / 'tests/reports/latest.json'))
negative = json.loads(read(project / 'tests/reports/failure-path.json'))
mutations = json.loads(read(project / 'tests/reports/mutations.json'))
assert latest['status'] == 'passed' and latest['summary']['counts']['passed'] == 50
assert latest['summary']['counts']['tests'] == 50 and len(latest['scenarios']) == 50
assert all(row['status'] == 'passed' for row in latest['scenarios'])
for key in ['failed','skipped','todo','cancelled']:
    assert latest['summary']['counts'][key] == 0
for result in [latest,negative,mutations]:
    assert result['sourceDigest'] == system_test['sourceDigest']
assert negative['expectedNegativePaths'] == 3 and mutations['detected'] == 3
current_digest = subprocess.run(['node','-e',
    "const path=require('node:path');console.log(require(path.resolve(process.argv[1],'tests/support/digest.cjs')).digest());", str(project)],
    check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
assert current_digest == system_test['sourceDigest']
package_check = subprocess.run(['node','-e',
    "const path=require('node:path');const p=path.resolve(process.argv[1]);console.log(JSON.stringify(require(path.join(p,'tools/package-info.cjs')).inspect(p)));",
    str(project)], check=True,capture_output=True,text=True,encoding='utf-8')
inventory = json.loads(package_check.stdout)
assert inventory['mainPages'] == 16 and inventory['subpackagePages'] == 10
audit = json.loads(read(project / 'release/reports/readiness.json'))
assert audit['localChecksPass'] is False and audit['readyForPublicRelease'] is False
assert audit['externalVerification'] == 'notPerformed'
assert [row['code'] for row in audit['errors']] == test['readinessBlockers']
snapshot_check = subprocess.run(['node','-e',
    "const path=require('node:path');const p=path.resolve(process.argv[1]);console.log(require(path.join(p,'tools/release-audit.cjs')).snapshot(p).fingerprint);",
    str(project)],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
assert snapshot_check == audit['codeFingerprint']
assert len(json.loads(read(project / 'release/data-inventory.json'))['items']) == 10
changed,identical = [],0
for name in ['miniprogram','cloudfunctions','renderer-probe']:
    previous = EXAMPLES / '14-studyhub-testing' / name
    before = {p.relative_to(previous) for p in previous.rglob('*') if p.is_file()}
    after = {p.relative_to(project / name) for p in (project / name).rglob('*') if p.is_file()}
    assert before <= after
    if name != 'miniprogram':
        assert before == after
    for relative in sorted(after):
        if relative in before and (previous / relative).read_bytes() == (project / name / relative).read_bytes():
            identical += 1
        else:
            assert name == 'miniprogram'
            changed.append(name + '/' + relative.as_posix())
assert sorted(changed) == sorted(system_test['changedBusinessFiles']) and len(changed) == 18
assert identical == system_test['businessFilesByteIdentical']
coverage = latest['coverage']
assert len(coverage['files']) == 16
assert coverage['totals']['totalLineCount'] == 618 and coverage['totals']['coveredLineCount'] == 478
node_version = subprocess.run(['node','--version'],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
report = f"""# 第十四阶段验证记录

汇总日期：{DATE}。本地Node.js：{node_version}。实际执行时间/runId保存在标准测试报告；继承脚本中的教学日期保留原记录，不冒充真机执行时间。

## 已执行的本地场景

在15项目运行八组：基础52、知识库56、计时71、统计60、平台59、体验57、性能45、兼容50，共450；再执行标准node:test50和本章隐私/发布50，共{test['totalPassed']}个本地场景。存在规则重叠，不是550种互不重复功能。

平台继承运行真实127.0.0.1固定文件HTTP上传下载；其他微信/云行为使用桩或串行内存模型，不证明真实权限、事务或并发。旧图片/平台夹具显式注入允许的隐私桩以保留原断言；新增套件直接验证实际接入后的拒绝/超时/切页路径。

新增50项如下：

""" + '\n'.join(f'{index}. {name}' for index,name in enumerate(test['scenarios'],1)) + f"""

## 默认发布检查

实际子进程退出2，localChecksPass=false，readyForPublicRelease=false，externalVerification=notPerformed。共有{len(audit['errors'])}个阻塞项；配置/材料空白属于预期受阻，不是已满足发布条件。

""" + '\n'.join('- ' + row['code'] + '：' + row['message'] for row in audit['errors']) + f"""

本地材料全齐的固定测试夹具仍不能返回可公开发布。检查器不验证证据真实性或实际后台，有限字面扫描不证明所有数据流已覆盖。

## 源码、报告与附加检查

- 与14项目的{identical}个业务/云函数/探针文件逐字节一致，18处新增或改动均位于允许的客户端入口与页面；云函数、独立探针未变。
- 标准50项完整通过，无失败/取消/skip/TODO；报告与当前约定源码摘要一致：{current_digest}。
- 3类预期负向与3个固定内存故障变体另列，不加入550，也不是全项目变异分数。
- 标准50项加载并匹配筛选的16个客户端JS，478/618行约77.35%。不是本章新增隐私套件、550项、全部客户端、云端、WXML或原生覆盖率。
- 本章发布指纹与当前客户端/云函数输入一致：{snapshot_check}。输入范围与标准测试摘要不同，不是签名或审核证书。

## 静态检查与交付

- {len(json_files)}个JSON解析、{len(scripts)}个JS/CJS的Node --check与相对require路径检查通过。
- {page_count}个登记页面四文件齐全，其中{subpackage_pages}个分包页；主工程15为16主包+10分包，探针另计。
- {component_refs}处组件引用、{len(wxml_files)}个WXML基础标签/事件方法存在性与WXSS括号检查通过；不是微信编译。
- {links}处Markdown本地链接存在、围栏配对、无Unicode替换字符。
- 第十五组{cloud_sources}个实际文件同步源码附录，三份客户端/云共享协议逐字节一致。
- 第十四册{len(books[13]):,}字符，第01—34章合订版{len(whole):,}字符；包含源码、链接、空白和Markdown，不是纯中文正文字数。
- ZIP排除node_modules、.env、私有项目配置、日志与密钥类扩展；这不代替人工秘密检查。

## 待实际验收

未执行可选DOM、微信工具自动化、CI、SDK安装、微信/Skyline编译、原生隐私同意、系统权限、读屏/焦点/键盘、多设备、真实云部署与双账号、上传、提审或发布。

数据期限与完整权利处理、账户处理、全量个人数据导出未实现，正式交付应阻止。按 [隐私授权与发布验收](../第十四阶段-隐私授权与发布验收.md) 填写真实结果。

整理脚本读取已有业务结果并做静态/摘要检查，不重跑业务套件，不访问微信后台或外部云账号。
"""
write(ROOT / '验证' / '第十四阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至34章.zip'
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
    'fourteenth_book_characters': len(books[13]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
