"""Stage5 text/source consistency, executable contracts, differential histories and fault injection."""
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
COURSE = SOURCE.parent
EXAMPLES = SOURCE / '示例代码'
DRAFT = COURSE / 'drafts/stage5'
FOLDERS = ['stage5-common', '27-matching', '28-chaining', '29-open-addressing', 'stage5-indexed-catalog']
checks, environment, metrics = [], {}, {}

def check(name, condition, detail=''):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail[:1600] if not condition else ''})
    if not condition: raise AssertionError(name + ': ' + detail[:1600])

def process(args, cwd=None):
    return subprocess.run(list(map(str, args)), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30, cwd=cwd,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cc', default='gcc')
    args = parser.parse_args()
    result = process([args.cc, '--version'])
    check('compiler starts', result.returncode == 0, result.stderr)
    environment['compiler'] = result.stdout.splitlines()[0]
    compat = ['-D__USE_MINGW_ANSI_STDIO=1'] if os.name == 'nt' and '8.1.0' in environment['compiler'] else []
    environment['compatibilityFlags'] = compat
    for doc in list(SOURCE.rglob('*.md')) + list(DRAFT.glob('*.md')):
        text = doc.read_text(encoding='utf-8')
        check('no unresolved embed: ' + doc.name, '@@EXAMPLE:' not in text)
        if re.match(r'(27|28|29|30)-', doc.name):
            for term in ['目标与先修', '常见错误', '练习与参考答案', '完成条件']:
                check(doc.name + ': ' + term, term in text)
            check(doc.name + ': teaching sections', len(re.findall(r'^## ', text, re.M)) >= 10)
        base = SOURCE if doc.parent == DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', link) or link.startswith('#'): continue
            target = (base / link.split('#')[0]).resolve()
            exists = target.exists() or (target.parent == SOURCE and (DRAFT / target.name).exists())
            check('local link: ' + doc.name + ' -> ' + link, target.is_relative_to(COURSE) and exists)
    appendix = (EXAMPLES / 'stage5-common/完整源码.md').read_text(encoding='utf-8')
    blocks = [b.strip() for b in re.findall(r'```c\n(.*?)\n```', appendix, re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES / folder).glob('*'):
            if file.suffix in ['.c', '.h']:
                check('appendix matches: ' + folder + '/' + file.name, file.read_text(encoding='utf-8').strip() in blocks)
    mapping = {'27': ['27-matching/matching.h', '27-matching/matching.c'],
               '28': ['stage5-common/hash_status.h', '28-chaining/chaining.h', '28-chaining/chaining.c'],
               '29': ['29-open-addressing/open_map.h', '29-open-addressing/open_map.c'],
               '30': ['stage5-indexed-catalog/catalog.h', 'stage5-indexed-catalog/catalog.c']}
    for chapter, files in mapping.items():
        doc = (list(DRAFT.glob(chapter + '-*.md')) or list(SOURCE.glob(chapter + '-*.md')))[0]
        blocks = [b.strip() for b in re.findall(r'```c\n(.*?)\n```', doc.read_text(encoding='utf-8'), re.S)]
        for file in files: check('chapter full file matches: ' + file, (EXAMPLES / file).read_text(encoding='utf-8').strip() in blocks)
    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage5-', dir=temp_root) as folder:
        work = Path(folder).resolve()
        check('temporary cleanup confined', work.parent == temp_root and work.name.startswith('dsa-stage5-'))
        includes = []
        for directory in [HERE, *[EXAMPLES / f for f in FOLDERS]]: includes += ['-I', directory]
        flags = ['-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror', '-O0', *compat, *includes]
        environment['flags'] = ['-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror', '-O0', *compat]
        serial = 0
        def build(label, files):
            nonlocal serial
            serial += 1
            exe = work / (f'case{serial}.exe' if os.name == 'nt' else f'case{serial}')
            result = process([args.cc, *flags, *files, '-o', exe], work)
            check('compile: ' + label, result.returncode == 0, result.stderr)
            return exe
        def run(label, exe, expected, arguments=(), error='', status=0):
            result = process([exe, *arguments], work)
            check(label, result.returncode == status and result.stdout == expected and result.stderr == error, repr((result.returncode, result.stdout, result.stderr)))
            return result
        libs = {'matching': EXAMPLES / '27-matching/matching.c', 'chaining': EXAMPLES / '28-chaining/chaining.c',
                'open': EXAMPLES / '29-open-addressing/open_map.c', 'catalog': EXAMPLES / 'stage5-indexed-catalog/catalog.c'}
        exe = build('matching demo', [EXAMPLES / '27-matching/main.c', libs['matching']])
        run('documented default KMP', exe, 'pi=0,0,1,2,3,0\nnaive found=1 index=4\nkmp found=1 index=4\n')
        for text, pattern, pi, found, index in [('aaaaa', 'aaa', '0,1,2', 1, 0), ('abc', '', '', 1, 0), ('abc', 'z', '0', 0, 3), ('', 'a', '0', 0, 0), ('', '', '', 1, 0), ('abc', 'abcd', '0,0,0,0', 0, 3)]:
            run('matching CLI ' + repr((text, pattern)), exe, f'pi={pi}\nnaive found={found} index={index}\nkmp found={found} index={index}\n', [text, pattern])
        run('matching usage', exe, '', ['one'], 'usage: matching [text pattern]\n', 1)
        run('matching over text budget', exe, '', ['a' * 257, 'a'], 'matching: invalid or length\n', 1)
        run('matching over pattern budget', exe, '', ['a', 'a' * 65], 'matching: invalid or length\n', 1)
        exe = build('chaining demo', [EXAMPLES / '28-chaining/main.c', libs['chaining']])
        run('documented chaining', exe, 'bucket1=17,9,1\nduplicate=1\nkey17=170 count=2\n')
        exe = build('open addressing demo', [EXAMPLES / '29-open-addressing/main.c', libs['open']])
        run('documented tombstones', exe, 'after_delete key16=160 count=2 used=3 capacity=8\nduplicate=1\nafter_rehash count=3 used=3 capacity=16\n')
        exe = build('indexed catalog demo', [EXAMPLES / 'stage5-indexed-catalog/main.c', libs['catalog'], libs['open'], libs['matching']])
        prefix = 'id=9 minutes=25 title=Queues\n'
        suffix = 'count=2 index_count=2\n'
        run('catalog default title', exe, prefix + 'title_match=1 byte=12\n' + suffix)
        run('catalog Queues title', exe, prefix + 'title_match=9 byte=0\n' + suffix, ['Queues'])
        run('catalog empty title', exe, prefix + 'title_match=1 byte=0\ntitle_match=9 byte=0\n' + suffix, [''])
        run('catalog absent and case sensitive', exe, prefix + suffix, ['queues'])
        run('catalog over pattern budget', exe, '', ['x' * 65], 'catalog: pattern length\n', 1)
        run('catalog usage', exe, '', ['a', 'b'], 'usage: catalog [title-pattern]\n', 1)
        objects = {}
        hooks = ['-Dmalloc=s5_malloc', '-Dcalloc=s5_calloc', '-Dfree=s5_free']
        for key in ['chaining', 'open']:
            obj = work / (key + '.o')
            result = process([args.cc, *flags, *hooks, '-c', libs[key], '-o', obj], work)
            check('compile allocator hook: ' + key, result.returncode == 0, result.stderr)
            objects[key] = obj
        model_files = [HERE / 'stage5-models.c', HERE / 'stage5-alloc.c', libs['matching'], libs['catalog'], *objects.values()]
        exe = build('model and allocation audit', model_files)
        run('finite matching, histories and failures', exe, 'matching_pairs=32193 map_steps=30000 catalog_steps=4000 allocation_failures=15 live=0\n')
        metrics.update(matchingPairs=32193, prefixPatterns=63, mapModelSteps=30000, catalogModelSteps=4000, controlledAllocationFailures=15, finalTrackedAllocations=0)
        # All variants change values/control only; no deliberate invalid memory access.
        mutations = [('tombstone treated as empty', libs['open'],
                      'map->slots[i].state == SLOT_EMPTY) {\n            break;',
                      '(map->slots[i].state == SLOT_EMPTY || map->slots[i].state == SLOT_DELETED)) {\n            break;', 'open'),
                     ('index positions all zero', libs['catalog'], '(int)i);', '0);', 'catalog'),
                     ('KMP discards valid border', libs['matching'], 'j = pi[j - 1];', 'j = 0;', 'matching')]
        for label, original, before, after, key in mutations:
            text = original.read_text(encoding='utf-8')
            check('mutation target: ' + label, before in text)
            wrong = work / ('wrong_' + key + '.c')
            wrong.write_text(text.replace(before, after), encoding='utf-8')
            chosen = [HERE / 'stage5-models.c', HERE / 'stage5-alloc.c', wrong if key == 'matching' else libs['matching'], wrong if key == 'catalog' else libs['catalog'], objects['chaining']]
            if key == 'open':
                obj = work / 'wrong_open.o'
                result = process([args.cc, *flags, *hooks, '-c', wrong, '-o', obj], work)
                check('compile wrong open hook', result.returncode == 0, result.stderr)
                chosen.append(obj)
            else: chosen.append(objects['open'])
            exe = build('safe mutant: ' + label, chosen)
            result = process([exe], work)
            check('oracle detects: ' + label, result.returncode == 1 and result.stderr.startswith('FAIL '), result.stdout + result.stderr)
        metrics['detectedSafeMutations'] = 3

if __name__ == '__main__':
    passed, error = False, ''
    try: main(); passed = True
    except Exception as exc: error = str(exc)
    payload = {'date': datetime.now(timezone(timedelta(hours=8))).date().isoformat(), 'passed': passed, 'checks': len(checks), 'programGroups': 4,
               'environment': environment, 'metrics': metrics, 'error': error, 'results': checks}
    (HERE / '第五阶段检查结果.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k != 'results'}, ensure_ascii=True))
    raise SystemExit(0 if passed else 1)
