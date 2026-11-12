"""Stage 2 C17 checks. Run from repository root; --cc and --gdb select existing tools."""
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import random
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
COURSE = SOURCE.parent
DRAFT = COURSE / 'drafts/stage2'
EXAMPLES = SOURCE / '示例代码'
checks = []
environment = {}


def check(name, condition, detail=''):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail if not condition else ''})
    if not condition:
        raise AssertionError(name + ': ' + detail[:1500])


def process(args, data=None, cwd=None):
    return subprocess.run(list(map(str, args)), input=data, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=20, cwd=cwd,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cc', default='gcc')
    parser.add_argument('--gdb', default='gdb')
    args = parser.parse_args()
    version = process([args.cc, '--version'])
    check('compiler starts', version.returncode == 0, version.stderr)
    environment['compiler'] = version.stdout.splitlines()[0]
    compatibility = ['-D__USE_MINGW_ANSI_STDIO=1'] if os.name == 'nt' and '8.1.0' in environment['compiler'] else []
    environment['compatibilityFlags'] = compatibility
    docs = list(SOURCE.rglob('*.md')) + list(DRAFT.glob('*.md'))
    for doc in docs:
        text = doc.read_text(encoding='utf-8')
        check('no unresolved include: ' + doc.name, '@@EXAMPLE:' not in text)
        if doc.parent == DRAFT or re.match(r'(09|1[0-6])-', doc.name):
            for heading in ['目标与先修', '常见错误', '练习与参考答案', '完成条件']:
                if re.match(r'\d\d-', doc.name):
                    check(doc.name + ': ' + heading, heading in text)
        base = SOURCE if doc.parent == DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', link) or link.startswith('#'):
                continue
            target = (base / link.split('#')[0]).resolve()
            exists = target.exists() or (target.parent == SOURCE and (DRAFT / target.name).exists())
            check('link: ' + doc.name + ' -> ' + link, target.is_relative_to(COURSE) and exists)
    mapping = {'09': '09-strings/strings.c', '10': '10-pointers/pointers.c',
               '11': '11-array-api/array_api.c', '12': '12-records/records.c',
               '13': '13-memory/memory.c', '15': '15-files/file_count.c', '16': 'stage2-catalog/main.c'}
    for number, name in mapping.items():
        candidates = list(DRAFT.glob(number + '-*.md')) or list(SOURCE.glob(number + '-*.md'))
        text = candidates[0].read_text(encoding='utf-8')
        blocks = re.findall(r'```c\n(.*?)\n```', text, re.S)
        code = (EXAMPLES / name).read_text(encoding='utf-8').strip()
        check('prose/source match: ' + name, code in [b.strip() for b in blocks])
    chapter14 = (list(DRAFT.glob('14-*.md')) or list(SOURCE.glob('14-*.md')))[0].read_text(encoding='utf-8')
    blocks14 = re.findall(r'```c\n(.*?)\n```', chapter14, re.S)
    for name in ['totals.h', 'totals.c', 'main.c']:
        check('module source match: ' + name, (EXAMPLES / '14-modules' / name).read_text(encoding='utf-8').strip() in blocks14)
    appendix = (EXAMPLES / 'stage2-catalog/完整源码.md').read_text(encoding='utf-8')
    for name in ['catalog.h', 'catalog.c', 'main.c', 'sample.txt']:
        check('appendix source match: ' + name, (EXAMPLES / 'stage2-catalog' / name).read_text(encoding='utf-8').strip() in appendix)

    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage2-', dir=temp_root) as folder:
        work = Path(folder).resolve()
        check('temp cleanup confined', work.parent == temp_root and work.name.startswith('dsa-stage2-'))
        serial = 0
        def build(label, sources, extra=None, expected=True):
            nonlocal serial
            serial += 1
            output = work / (f'case{serial}.exe' if os.name == 'nt' else f'case{serial}')
            result = process([args.cc, '-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror',
                              '-g', '-O0', *compatibility, *(extra or []), *sources, '-o', output], cwd=work)
            check('compile: ' + label, (result.returncode == 0) == expected, result.stderr)
            return output

        def run(label, exe, stdout='', data=None, arguments=None, stderr='', status=0):
            result = process([exe, *(arguments or [])], data, work)
            check(label, result.returncode == status and result.stdout == stdout and result.stderr == stderr,
                  repr({'status': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
                        'expected': [status, stdout, stderr]}))
            return result

        exe = {number: build(number, [EXAMPLES / name]) for number, name in mapping.items() if number != '16'}
        module = EXAMPLES / '14-modules'
        exe['14'] = build('modules', [module / 'main.c', module / 'totals.c'])
        project = EXAMPLES / 'stage2-catalog'
        exe['16'] = build('catalog project', [project / 'main.c', project / 'catalog.c'])
        build('missing implementation rejected', [module / 'main.c'], expected=False)
        for source in ['main.c', 'totals.c']:
            result = process([args.cc, '-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror',
                              *compatibility, '-c', module / source, '-o', work / (source + '.o')], cwd=work)
            check('separate compile: ' + source, result.returncode == 0, result.stderr)
        linked = build('separate linking', [work / 'main.c.o', work / 'totals.c.o'])
        run('separate objects output', linked, 'total=45\n')

        for length in range(18):
            for ending in ['\n', '']:
                data = 'a' * length + ending
                if not data:
                    run('title EOF', exe['09'], 'missing input\n', data, status=1)
                elif length == 0:
                    run('title empty', exe['09'], 'empty title\n', data, status=1)
                elif length > 15:
                    run(f'title too long {length}/{ending!r}', exe['09'], 'too long\n', data, status=1)
                else:
                    run(f'title boundary {length}/{ending!r}', exe['09'], f'title={"a" * length}\nbytes={length}\nsame=0\n', data)
        run('matching title', exe['09'], 'title=C basics\nbytes=8\nsame=1\n', 'C basics\n')
        run('UTF8 byte length', exe['09'], 'title=算法\nbytes=6\nsame=0\n', '算法\n')
        run('pointer state transitions', exe['10'], 'before=15,20\nafter=20,15\nrebound=20,30\nnull_call=20,30\n')
        run('array API normal and empty', exe['11'], 'count=3 total=60 first=10\ngrid=6\nempty_total=0\n')
        run('record copies independent', exe['12'], 'original=C basics,0\ncopy=X basics,1\n')
        run('memory growth and calloc', exe['13'], 'sum=100\nzeros=0,0,0\n')
        run('module output', exe['14'], 'total=45\n')

        api_code = (EXAMPLES / mapping['11']).read_text(encoding='utf-8').split('int main(void)')[0]
        api_code += '''int main(void) {
            int total=999, bad[]={-1}, one[]={1440};
            if(sum_minutes(bad,1,&total) || total!=999) return 1;
            if(sum_minutes(NULL,1,&total) || total!=999) return 2;
            if(sum_minutes(one,8,&total) || total!=999) return 3;
            if(sum_minutes(one,1,NULL)) return 4;
            if(!sum_minutes(one,1,&total) || total!=1440) return 5;
            if(!sum_minutes(NULL,0,&total) || total!=0) return 6;
            puts("array failures preserve output"); return 0;
        }'''
        api_path = work / 'array_cases.c'
        api_path.write_text(api_code, encoding='utf-8')
        run('array API failures', build('array failure harness', [api_path]), 'array failures preserve output\n')
        api_path.write_text(api_code.replace('total += values[i];', 'values[i] = 0; total += values[i];'), encoding='utf-8')
        build('const input write rejected', [api_path], expected=False)

        for index, data in enumerate([b'', b'abc\n', b'a\r\nb', bytes(range(256)), bytes(range(256)) * 100]):
            path = work / f'bytes{index}.bin'
            path.write_bytes(data)
            run('binary file length ' + str(index), exe['15'], f'bytes={len(data)}\n', arguments=[path])
        run('file usage', exe['15'], arguments=[], stderr='usage: file_count input-file\n', status=1)
        run('file missing', exe['15'], arguments=[work / 'missing.bin'], stderr='open failed\n', status=1)

        def canonical(records):
            return 'DSA-CATALOG-1\n' + ''.join(f'{id}\n{minutes}\n{title}\n' for id, minutes, title in records)

        def fixture(data):
            nonlocal serial
            serial += 1
            path = work / f'input{serial}.txt'
            path.write_bytes(data.encode('utf-8') if isinstance(data, str) else data)
            return path

        normal = [[], [(0, 0, 'zero')], [(9999, 1440, 'a' * 63)],
                  [(1, 30, 'C basics'), (2, 45, 'Pointers')], [(i, 1440, f'entry {i}') for i in range(32)],
                  [(1, 20, '算法'), (2, 10, 'with spaces')]]
        rng = random.Random(20261111)
        for _ in range(25):
            normal.append([(i, rng.randrange(1441), f'title {i}') for i in range(rng.randrange(33))])
        for index, records in enumerate(normal):
            expected = canonical(records)
            for variant in [expected, expected.rstrip('\n'), expected.replace('\n', '\r\n')]:
                run(f'catalog roundtrip {index}', exe['16'], expected, arguments=[fixture(variant)])
        sample = canonical([(1, 30, 'C basics'), (2, 45, 'Pointers'), (3, 20, 'Arrays')])
        path = fixture(sample)
        edited = canonical([(1, 30, 'C basics'), (2, 60, 'Pointers'), (3, 20, 'Arrays')])
        result = run('catalog update', exe['16'], edited, arguments=[path, '2', '60'])
        run('catalog reload edited output', exe['16'], edited, arguments=[fixture(result.stdout)])
        run('catalog missing ID', exe['16'], arguments=[path, '4', '60'], stderr='catalog: not found\n', status=1)
        for value in ['-1', '1.5', '2x', '1441', '9' * 5000]:
            run('invalid command minutes ' + value[:12], exe['16'], arguments=[path, '2', value], stderr='invalid arguments\n', status=1)
        bad_files = ['', 'UNKNOWN\n', '\ufeffDSA-CATALOG-1\n', 'DSA-CATALOG-1\n\n',
                     'DSA-CATALOG-1\n1\n', 'DSA-CATALOG-1\n1\n30\n',
                     'DSA-CATALOG-1\n1\n30\n\n', canonical([(1, 1, 'a' * 64)]),
                     'DSA-CATALOG-1\n10000\n30\nx\n']
        for value in ['-1', '+1', '1441', '1.5', '12x', ' 1', '1 ', '9' * 5000]:
            bad_files.append('DSA-CATALOG-1\n1\n' + value + '\nx\n')
        for byte in [0, 1, 9, 13, 26, 31, 127]:
            bad_files.append(b'DSA-CATALOG-1\n1\n30\na' + bytes([byte]) + b'b\n')
        for index, data in enumerate(bad_files):
            run('catalog bad file ' + str(index), exe['16'], arguments=[fixture(data)], stderr='catalog: invalid data\n', status=1)
        run('duplicate IDs numeric equivalence', exe['16'], arguments=[fixture('DSA-CATALOG-1\n1\n30\na\n0001\n40\nb\n')], stderr='catalog: duplicate id\n', status=1)
        run('record 33 rejected', exe['16'], arguments=[fixture(canonical([(i, 1, 'x') for i in range(33)]))], stderr='catalog: record limit\n', status=1)
        run('catalog missing input file', exe['16'], arguments=[work / 'absent.txt'], stderr='open failed\n', status=1)
        run('catalog usage', exe['16'], stderr='usage: catalog input-file [id minutes]\n', status=1)

        obj = work / 'catalog-injected.o'
        flags = ['-Drealloc=lab_realloc', '-Dfree=lab_free', '-Dfgetc=lab_fgetc',
                 '-Dferror=lab_ferror', '-Dfprintf=lab_fprintf', '-Dfflush=lab_fflush']
        result = process([args.cc, '-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror',
                          *flags, '-c', project / 'catalog.c', '-o', obj], cwd=work)
        check('compile controlled allocation and IO substitutes', result.returncode == 0, result.stderr)
        injected = build('API rollback and resource audit', [obj, HERE / 'stage2-faults.c', HERE / 'stage2-api-tests.c'], ['-I', project])
        run('API failure paths and resource balance', injected, 'api and failure paths passed\n', arguments=[fixture(canonical([(i, 30, 'entry') for i in range(5)]))])

        command_file = work / 'debug.gdb'
        command_file.write_text('break totals.c:7\nrun\nprint a\nprint b\nnext\nprint result\ncontinue\n', encoding='ascii')
        commands = [args.gdb, '--batch', '-nx', '-q', '-x', command_file, exe['14']]
        try:
            debug = process(commands, cwd=work)
            log = debug.stdout + '\n' + debug.stderr
            (HERE / '第二阶段GDB记录.txt').write_text(log, encoding='utf-8')
            good = debug.returncode == 0 and all(re.search(pattern, log) for pattern in [r'\$1 = 30', r'\$2 = 15', r'\$3 = 45'])
            environment['gdb'] = {'attempted': True, 'passed': bool(good), 'exitCode': debug.returncode}
        except (OSError, subprocess.TimeoutExpired) as error:
            environment['gdb'] = {'attempted': True, 'passed': False, 'error': str(error)}


if __name__ == '__main__':
    passed = False
    error = ''
    try:
        main()
        passed = True
    except Exception as exc:
        error = str(exc)
    report = {'date': datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
              'passed': passed, 'checks': len(checks), 'programGroups': 8,
              'environment': environment, 'error': error, 'results': checks}
    (HERE / '第二阶段检查结果.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'results'}, ensure_ascii=True))
    raise SystemExit(0 if passed else 1)
