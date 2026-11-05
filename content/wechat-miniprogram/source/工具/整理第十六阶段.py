"""生成截至第 36 章的各册、源码附录、静态检查记录和压缩包。不连接云账号。"""
from pathlib import Path
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / '示例代码'
DATE = '2026-11-03'


def read(file):
    return file.read_text(encoding='utf-8')


def write(file, value):
    file.write_text(value, encoding='utf-8')


def include(file):
    return (not any(part in {'node_modules', '.git', '__pycache__'} for part in file.parts)
            and file.name != 'project.private.config.json'
            and not file.name.startswith('.env') and file.suffix.lower() not in {'.log', '.pem', '.key', '.p12', '.pfx'})


languages = {'.js': 'js', '.cjs': 'js', '.json': 'json', '.wxss': 'css', '.wxml': 'xml', '.md': 'markdown', '.ts': 'ts'}
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
    ('第十四阶段', '15-studyhub-release', '第34章隐私与发布准备。三个选读入口先检查，原生同意后主动重试；本地检查默认受阻，不执行部署/上传/审核/发布。数据治理和真实环境待验收。'),
    ('第十五阶段', '16-studyhub-operations', '第35章日志、环境与维护。诊断默认关闭且仅内存，固定练习独立；源码清单不是编译/部署，回退检查不执行真实操作。实际告警、备份恢复与回退待验收。'),
    ('第十六阶段', '17-studyhub-tooling', '第36章独立电脑TypeScript与HTTP实验，不能导入微信工具。固定身份A/B非真实认证，无持久后端；组件/框架为待执行练习，完整业务保留第16组。')
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
    if stage == '第十六阶段':
        cloud_sources = len(files)

chapter_map = {}
for file in ROOT.glob('*.md'):
    match = re.match(r'^(\d{2})-', file.name)
    if match and int(match.group(1)) <= 36:
        chapter_map[int(match.group(1))] = file.name
assert set(chapter_map) == set(range(37))
groups = [list(range(0, 10)), list(range(10, 16)), list(range(16, 20)), list(range(20, 24)),
          list(range(24, 26)), [26], [27], [28], [29], [30], [31], [32], [33], [34], [35], [36]]
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
               ['第十四阶段-练习与参考答案.md', '第十四阶段-隐私授权与发布验收.md', '第十四阶段-完整源码附录.md'],
               ['第十五阶段-练习与参考答案.md', '第十五阶段-维护演练与实际验收.md', '第十五阶段-完整源码附录.md'],
               ['第十六阶段-练习与参考答案.md', '第十六阶段-工具运行与扩展验收.md', '最终综合实践-毕业设计与能力验收.md', '第十六阶段-完整源码附录.md']]
stage_files = [[chapter_map[index] for index in indexes] + extra for indexes, extra in zip(groups, supplements)]


def book(title, names, note):
    intro = '# ' + title + '\n\n' + note + ' 第01—36章主线正文已齐备；真实微信、云、数据治理及正式交付按实际验收表完成。'
    intro += '目录见 [README](README.md)。整理日期：' + DATE + '。\n\n'
    return intro + '\n\n---\n\n'.join(read(ROOT / name) for name in names + ['99-官方资料与核验说明.md'])


numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六']
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
    '第34章数据清单、平台隐私、原生同意与主动重试、发布材料和本地检查，含550本地场景、完整源码、20组练习与真实验收表；未实际上传/审核/发布。',
    '第35章允许字段日志、观察层、样本口径、环境检查、源码制品和备份/回退准备，含600本地场景、完整源码、20组练习与真实维护验收；未执行真实告警、备份、恢复或回退。',
    '第36章TypeScript、npm、组件库/框架与独立后端边界，含真实类型与HTTP实验50项、20组练习和毕业实践。主工程600记录摘要匹配，跨工程650；真实平台/生产接入待验收。'
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
        end = [9, 15, 19, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36][index]
        value = book('微信小程序开发教程 · 第 01—' + str(end) + ' 章合订版', all_files,
                     '此文件收录截至第 ' + str(end) + ' 章的连续教程和相应示例/练习。')
        write(ROOT / ('微信小程序开发教程-第01至' + str(end) + '章合订版.md'), value)
        if end == 36:
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
        ('15-studyhub-release', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js']),
        ('16-studyhub-operations', ['knowledge-schema.js', 'focus-contract.js', 'stats-core.js'])]:
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
            pending_report = ROOT / '验证' / '第十六阶段验证记录.md'
            assert destination.exists() or destination.resolve() == pending_report.resolve(), (file, target)
            links += 1
    assert fence_size == 0, file


test = json.loads(read(ROOT / '验证' / '第十五阶段测试结果.json'))
system_test = json.loads(read(ROOT / '验证' / '第十五阶段测试体系继承结果.json'))
assert test['project'] == system_test['project'] == '16-studyhub-operations'
assert test['passed'] == 50 and test['inheritedPassed'] == 550 and test['totalPassed'] == 600
assert system_test['passed'] == 50 and system_test['inheritedPassed'] == 450 and system_test['totalPassed'] == 500
for key in ['realCloud','realWechat','realAlert','realBackup','realRollback','dataRestored']:
    assert test[key] is False
for key in ['realCloud','realWechat','componentRenderingExecuted','devtoolsAutomationExecuted','ciExecuted','extraChecksIncludedIn500']:
    assert system_test[key] is False
assert system_test['expectedNegativePaths'] == 3 and system_test['fixedMutantsDetected'] == 3
for name, count, total in [('基础',52,52), ('知识库',56,108), ('计时',71,179), ('统计',60,239),
                           ('平台',59,298), ('体验',57,355), ('性能',45,400), ('兼容',50,450)]:
    result = json.loads(read(ROOT / '验证' / ('第十五阶段' + name + '继承测试结果.json')))
    assert result['project'] == '16-studyhub-operations' and result['passed'] == count
    assert result.get('totalPassed',result['passed']) == total and result['realCloud'] is False
project = EXAMPLES / '16-studyhub-operations'
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
assert inventory['mainPages'] == 16 and inventory['subpackagePages'] == 11
audit = json.loads(read(project / 'release/reports/readiness.json'))
assert audit['localChecksPass'] is False and audit['readyForPublicRelease'] is False
assert audit['externalVerification'] == 'notPerformed'
privacy_inherited = json.loads(read(ROOT / '验证' / '第十五阶段隐私继承测试结果.json'))
assert privacy_inherited['project'] == '16-studyhub-operations' and privacy_inherited['totalPassed'] == 550
assert [row['code'] for row in audit['errors']] == privacy_inherited['readinessBlockers']
assert len(audit['errors']) == test['releaseBlockers']
snapshot_check = subprocess.run(['node','-e',
    "const path=require('node:path');const p=path.resolve(process.argv[1]);console.log(require(path.join(p,'tools/release-audit.cjs')).snapshot(p).fingerprint);",
    str(project)],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
assert snapshot_check == audit['codeFingerprint']
assert len(json.loads(read(project / 'release/data-inventory.json'))['items']) == 10
changed,identical = [],0
for name in ['miniprogram','cloudfunctions','renderer-probe']:
    previous = EXAMPLES / '15-studyhub-release' / name
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
assert sorted(changed) == sorted(system_test['changedBusinessFiles']) and len(changed) == 16
assert identical == system_test['businessFilesByteIdentical']
coverage = latest['coverage']
assert len(coverage['files']) == 16
assert coverage['totals']['totalLineCount'] == 618 and coverage['totals']['coveredLineCount'] == 478
node_version = subprocess.run(['node','--version'],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()

manifest = json.loads(read(project / 'operations/reports/artifacts.json'))
recovery = json.loads(read(project / 'operations/reports/recovery.json'))
assert manifest['compiled'] is False and manifest['deployed'] is False
assert manifest['fingerprint'] == test['sourceFingerprint']
assert recovery['decision'] == test['recoveryDecision'] == 'blocked'
for key in ['canExecute','remoteVerified','dataRestored']:
    assert recovery[key] is False
current_manifest = subprocess.run(['node','-e',
    "const path=require('node:path');const p=path.resolve(process.argv[1]);console.log(require(path.join(p,'tools/build-manifest.cjs')).collect(p).fingerprint);",
    str(project)],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
assert current_manifest == manifest['fingerprint'] and current_digest == test['sourceDigest']


extension = json.loads(read(ROOT / '验证' / '第十六阶段测试结果.json'))
lab = EXAMPLES / '17-studyhub-tooling'
lab_report = json.loads(read(lab / 'reports/latest.json'))
toolchain = json.loads(read(lab / 'reports/toolchain.json'))
assert extension['project'] == lab_report['project'] == '17-studyhub-tooling'
assert extension['mainProject'] == '16-studyhub-operations'
assert extension['passed'] == lab_report['passed'] == 50
assert extension['mainPreviouslyPassed'] == 600 and extension['totalAcrossProjects'] == 650
assert extension['mainSourceDigest'] == current_digest
assert extension['compiler'] == lab_report['compiler'] == '5.9.3'
assert extension['compilerExecuted'] is True and extension['typeNegativeCasesRejected'] == 4
assert extension['loopbackHttp'] is True
for key in ['realWechat','realWechatIdentity','persistentBackend','productionReady','weuiExecuted','taroExecuted','uniAppExecuted']:
    assert extension[key] is False and lab_report[key] is False
assert toolchain['npmInstallExecuted'] is True and toolchain['npmCiExecuted'] is True and toolchain['globalInstall'] is False
lock = json.loads(read(lab / 'package-lock.json'))
assert lock['packages']['node_modules/typescript']['version'] == '5.9.3'
assert lock['packages']['node_modules/typescript']['resolved'].startswith('https://registry.npmjs.org/')
assert lock['packages']['node_modules/typescript']['integrity'].startswith('sha512-')
lab_digest = subprocess.run(['node','-e',
    "const path=require('node:path');console.log(require(path.resolve(process.argv[1],'tools/digest.cjs')).digest());", str(lab)],
    check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
assert lab_digest == extension['sourceDigest'] == lab_report['sourceDigest']
assert len(lab_report['scenarios']) == 50
assert (lab / 'dist/contracts.js').is_file() and (lab / 'dist/contracts.d.ts').is_file()
report = f"""# 第十六阶段与全课程交付验证记录

汇总日期：{DATE}。本机Node：{node_version}，npm：{toolchain['npm']}，固定TypeScript：{extension['compiler']}。实际执行时间保留在扩展报告executedAt。

## 已执行与复用的证据

完整业务仍是第16组，已有600个本地场景记录，当前约定源码摘要与记录一致：{current_digest}。本章没有修改业务/云函数/依赖，也没有重新声称执行全部600。

独立第17组新跑50项，实际执行固定TypeScript严格检查、正例与四个预期错误注释、四个无抑制类型负例、生成物字节对照、运行时校验、内存模型、客户端适配和真实127.0.0.1HTTP。

跨两类工程共650项，存在规则重叠，不是完整小程序迁移测试或650种互不重复功能。第33章3类负向/3个内存固定变体另列；本章四个类型负例已包含在新增50中。

## 本章50个场景

""" + chr(10).join(f'{index}. {name}' for index,name in enumerate(lab_report['scenarios'],1)) + f"""

## 实际工具链与产物

- 本次真实npm install生成锁文件，再npm ci重建固定依赖，使用ignore-scripts/no-audit/no-fund；未全局升级，未把node_modules打包。
- 锁文件记录TypeScript5.9.3、公开registry来源与sha512完整性；不作安全审计或最新版声明。
- dist/contracts.js与声明由该版本编译，测试逐字节对照当前输出；新代码/配置/生成物摘要：{lab_digest}。
- 服务仅本机固定actor夹具，无真实微信身份或持久数据库；HTTP测试有真实字节、UTF-8、状态、路由及适配闭环，不是生产接入。
- 主工程默认发布仍有{len(audit['errors'])}项待办，回退decision={recovery['decision']}、canExecute=false；终章不改变这些条件。

## 静态与交付检查

- 正文00—36齐全，共16册、17组独立示例；第16组是完整业务，第17组是电脑工具实验。
- {len(json_files)}个示例JSON解析、{len(scripts)}个JS/CJS的Node --check和相对require路径检查通过。
- {page_count}个登记页面四文件齐全，含{subpackage_pages}个分包页；主工程27页，独立探针另计，本章没有新增微信页面。
- {component_refs}处组件引用、{len(wxml_files)}个WXML基础结构/事件方法与WXSS括号检查通过，不是微信编译。
- {links}处Markdown本地链接存在、围栏配对，无Unicode替换字符。
- 第17组{cloud_sources}个实际文件同步源码附录；三组主工程客户端/云共享协议保持字节一致。
- 第十六册{len(books[15]):,}字符，第01—36章完整合订版{len(whole):,}字符；含代码、链接、空白和Markdown，不是纯中文正文字数。
- 最终ZIP排除node_modules、私有项目配置、.env、日志与密钥类扩展；这不替代人工秘密检查。

## 未执行与尚未实现

没有执行WeUI/npm微信构建、Taro/uni-app、主工程TS迁移、微信/Skyline编译、真实微信独立登录、SDK安装/云部署/双账号、原生权限/辅助服务、多设备、真实监控/告警、备份恢复/回退、上传审核或正式发布。

完整账户处理、全量个人数据导出和期限/权利机制仍未实现。课堂固定actor不是认证，内存回执不是数据库事务；本地与类型通过不作生产结论。

按 [工具与扩展验收](../第十六阶段-工具运行与扩展验收.md) 和 [最终综合实践](../最终综合实践-毕业设计与能力验收.md) 完成自己的实际记录。整理脚本读取既有业务与扩展报告并核对摘要，不重跑全部测试或连接后台。
"""
write(ROOT / '验证' / '第十六阶段验证记录.md', report)

archive = ROOT.parent / '微信小程序从零开发教程-第01至36章.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and include(file):
            bundle.write(file, file.relative_to(ROOT.parent))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    entries = len(bundle.namelist())
print(json.dumps({'json_files': len(json_files), 'scripts': len(scripts), 'pages': page_count,
    'component_references': component_refs, 'wxml_files': len(wxml_files), 'local_links': links,
    'local_scenarios_across_projects': extension['totalAcrossProjects'], 'extension_source_files': cloud_sources,
    'sixteenth_book_characters': len(books[15]), 'whole_book_characters': len(whole),
    'zip_entries': entries, 'zip_bytes': archive.stat().st_size}, ensure_ascii=True, indent=2))
