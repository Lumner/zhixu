"""Stage 3 source/text, finite exhaustive properties, CLI and arithmetic checks."""
import argparse
import bisect
from datetime import datetime, timezone, timedelta
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
COURSE = SOURCE.parent
DRAFT = COURSE / 'drafts/stage3'
EXAMPLES = SOURCE / '示例代码'
checks = []
environment = {}
metrics = {}


def check(name, condition, detail=''):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail[:1500] if not condition else ''})
    if not condition:
        raise AssertionError(name + ': ' + detail[:1500])


def process(arguments, data=None, cwd=None):
    return subprocess.run(list(map(str, arguments)), input=data, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=20, cwd=cwd,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cc', default='gcc')
    args = parser.parse_args()
    version = process([args.cc, '--version'])
    check('compiler starts', version.returncode == 0, version.stderr)
    environment['compiler'] = version.stdout.splitlines()[0]
    compatibility = ['-D__USE_MINGW_ANSI_STDIO=1'] if os.name == 'nt' and '8.1.0' in environment['compiler'] else []
    environment['compatibilityFlags'] = compatibility
    for doc in list(SOURCE.rglob('*.md')) + list(DRAFT.glob('*.md')):
        body = doc.read_text(encoding='utf-8')
        check('resolved examples: ' + doc.name, '@@EXAMPLE:' not in body)
        if re.match(r'(17|18|19|20)-', doc.name):
            for word in ['目标与先修', '常见错误', '练习与参考答案', '完成条件']:
                check(doc.name + ': ' + word, word in body)
        base = SOURCE if doc.parent == DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', body):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', link) or link.startswith('#'):
                continue
            target = (base / link.split('#')[0]).resolve()
            exists = target.exists() or (target.parent == SOURCE and (DRAFT / target.name).exists())
            check('link: ' + doc.name + ' -> ' + link, target.is_relative_to(COURSE) and exists)

    mapping = {
        '17': ['17-specifications/prefix_stats.h', '17-specifications/prefix_stats.c', '17-specifications/main.c'],
        '18': ['18-growth/growth.c'],
        '19': ['19-recursion/recursion.c', '19-recursion/hanoi.c'],
        '20': ['20-search/search.h', '20-search/search.c', '20-search/search_demo.c'],
        'answer': ['stage3-search-lab/main.c']
    }
    for number, files in mapping.items():
        if number == 'answer':
            candidates = [DRAFT / '第三阶段-参考答案.md', SOURCE / '第三阶段-参考答案.md']
            doc = next(p for p in candidates if p.exists())
        else:
            doc = (list(DRAFT.glob(number + '-*.md')) or list(SOURCE.glob(number + '-*.md')))[0]
        blocks = [b.strip() for b in re.findall(r'```c\n(.*?)\n```', doc.read_text(encoding='utf-8'), re.S)]
        for name in files:
            check('complete text/source: ' + name, (EXAMPLES / name).read_text(encoding='utf-8').strip() in blocks)

    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage3-', dir=temp_root) as folder:
        work = Path(folder).resolve()
        check('temporary cleanup confined', work.parent == temp_root and work.name.startswith('dsa-stage3-'))
        serial = 0
        def build(label, files, extra=None):
            nonlocal serial
            serial += 1
            exe = work / (f'case{serial}.exe' if os.name == 'nt' else f'case{serial}')
            result = process([args.cc, '-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror', '-O0',
                              *compatibility, *(extra or []), *files, '-o', exe], cwd=work)
            check('compile: ' + label, result.returncode == 0, result.stderr)
            return exe

        def run(label, exe, expected='', arguments=None, data=None, error='', status=0):
            result = process([exe, *(arguments or [])], data, work)
            check(label, result.returncode == status and result.stdout == expected and result.stderr == error,
                  repr({'status': result.returncode, 'out': result.stdout, 'err': result.stderr,
                        'expected': [status, expected, error]}))
            return result

        prefix = EXAMPLES / '17-specifications'
        search = EXAMPLES / '20-search'
        prefix_exe = build('prefix stats', [prefix / 'main.c', prefix / 'prefix_stats.c'])
        growth_exe = build('growth', [EXAMPLES / '18-growth/growth.c'])
        recursive_exe = build('recursive sum', [EXAMPLES / '19-recursion/recursion.c'])
        hanoi_exe = build('Hanoi', [EXAMPLES / '19-recursion/hanoi.c'])
        demo_exe = build('search demo', [search / 'search_demo.c', search / 'search.c'])
        lab_exe = build('search lab', [EXAMPLES / 'stage3-search-lab/main.c', search / 'search.c'], ['-I', search])
        run('prefix normal result', prefix_exe, 'total=135 maximum=45 first_max=2\n')
        run('search demo counts', demo_exe, 'linear index=1 comparisons=2\nlower index=1 comparisons=3\nbinary index=1 comparisons=4\n')

        stats_tests = build('statistics exhaustive harness', [HERE / 'stage3-stats-tests.c', prefix / 'prefix_stats.c'], ['-I', prefix])
        tested = process([stats_tests], cwd=work)
        match = re.fullmatch(r'valid_cases=(\d+) overflow_checked=([01])\n', tested.stdout)
        check('statistics finite exhaustive and failure guarantees', tested.returncode == 0 and tested.stderr == '' and match is not None, tested.stdout + tested.stderr)
        metrics['statisticsValidCases'] = int(match.group(1))
        metrics['longOverflowBoundaryExecuted'] = match.group(2) == '1'
        search_tests = build('search exhaustive harness', [HERE / 'stage3-search-tests.c', search / 'search.c'], ['-I', search])
        run('search exhaustive positions and count properties', search_tests, 'sorted_cases=5558 unsorted_cases=5465\n')
        metrics['sortedSearchCases'] = 5558
        metrics['arbitraryLinearCases'] = 5465

        for n in [0, 1, 2, 3, 4, 7, 8, 9, 15, 16, 17, 31, 32, 63, 64, 65, 127, 128]:
            halves = n.bit_length() - 1 if n else 0
            expected = f'n={n} linear={n} square={n*n} pairs={n*(n-1)//2} halves={halves}\n'
            run('growth count n=' + str(n), growth_exe, expected, [str(n)])
        for arguments in [[], ['129'], ['-1'], ['+1'], [''], ['1.5'], ['12x'], [' 1'], ['9'*5000], ['2','3']]:
            run('growth rejects ' + repr(arguments)[:35], growth_exe, arguments=arguments, error='usage: growth n (0..128)\n', status=1)

        original = (EXAMPLES / '19-recursion/recursion.c').read_text(encoding='utf-8')
        for n in [0, 1, 3, 5, 20]:
            selected = recursive_exe
            if n != 3:
                path = work / f'recursive{n}.c'
                path.write_text(original.replace('unsigned int n = 3;', f'unsigned int n = {n};'), encoding='utf-8')
                selected = build('recursive n=' + str(n), [path])
            expected = ''.join(f'enter n={i}\n' for i in range(n, -1, -1))
            expected += ''.join(f'leave n={i} total={i*(i+1)//2}\n' for i in range(1, n+1))
            expected += f'recursive={n*(n+1)//2} iterative={n*(n+1)//2}\n'
            run('recursive enter/return trace ' + str(n), selected, expected)

        for n in range(9):
            result = process([hanoi_exe, str(n)], cwd=work)
            lines = result.stdout.splitlines()
            need_count = 2**n - 1
            check('Hanoi count n=' + str(n), result.returncode == 0 and result.stderr == '' and len(lines) == need_count+1 and lines[-1] == f'moves={need_count}', result.stdout + result.stderr)
            towers = {'A': list(range(n,0,-1)), 'B': [], 'C': []}
            valid = True
            for line in lines[:-1]:
                match = re.fullmatch(r'disk=(\d+) ([ABC])->([ABC])', line)
                if not match:
                    valid = False
                    break
                disk = int(match.group(1))
                start, end = match.group(2), match.group(3)
                if start == end or not towers[start] or towers[start][-1] != disk or (towers[end] and towers[end][-1] < disk):
                    valid = False
                    break
                towers[start].pop()
                towers[end].append(disk)
            check('Hanoi legal moves and final state n=' + str(n), valid and not towers['A'] and not towers['B'] and towers['C'] == list(range(n,0,-1)))
        for arguments in [[], ['9'], ['08'], ['-1'], [''], ['a'], ['1','2']]:
            run('Hanoi rejects ' + repr(arguments), hanoi_exe, arguments=arguments, error='usage: hanoi n (one digit 0..8)\n', status=1)

        cases = [([],3), ([3],2), ([3],3), ([3],4), ([3,3,3],3), ([1,3,3,3,8,12],3),
                 ([1,3,3,3,8,12],4), ([1,3,3,3,8,12],12), ([1,3,3,3,8,12],13),
                 (list(range(128)),0), (list(range(128)),127), ([0]*128,0), ([9999]*128,9999)]
        pattern = r'count=(\d+) target=(\d+)\nlower=(\d+)\nlinear=(\d+) comparisons=(\d+) found=([01])\nbinary=(\d+) comparisons=(\d+) found=([01])\n'
        for index, (values, target) in enumerate(cases):
            n = len(values)
            lower = bisect.bisect_left(values, target)
            found = lower < n and values[lower] == target
            expected_index = lower if found else n
            text = '\n'.join(map(str, [n, *values]))
            for ending in ['', '\n']:
                result = process([lab_exe, str(target)], text+ending, work)
                match = re.fullmatch(pattern, result.stdout)
                check('lab structured report ' + str(index) + repr(ending), result.returncode == 0 and result.stderr == '' and match is not None, result.stdout + result.stderr)
                got = list(map(int, match.groups()))
                limit = n.bit_length() + 1 if n else 0
                check('lab semantic oracle ' + str(index) + repr(ending), got[0:3] == [n,target,lower] and got[3] == got[6] == expected_index and got[5] == got[8] == int(found) and got[4] == (lower+1 if found else n) and got[7] <= limit)
        run('hand-calculated 4-element table', lab_exe,
            'count=4 target=5\nlower=3\nlinear=4 comparisons=4 found=0\nbinary=4 comparisons=3 found=0\n', ['5'], '4\n2\n4\n4\n9\n')
        run('front query 128', lab_exe, 'count=128 target=0\nlower=0\nlinear=0 comparisons=1 found=1\nbinary=0 comparisons=9 found=1\n', ['0'], '\n'.join(map(str,[128,*range(128)])))
        run('last query 128', lab_exe, 'count=128 target=127\nlower=127\nlinear=127 comparisons=128 found=1\nbinary=127 comparisons=8 found=1\n', ['127'], '\n'.join(map(str,[128,*range(128)])))
        for arguments in [[], ['10000'], ['-1'], ['+1'], [''], ['12x'], ['1.0'], ['9'*5000], ['1','2']]:
            run('lab bad target ' + repr(arguments)[:30], lab_exe, arguments=arguments, data='0\n', error='usage: search_lab target (0..9999)\n', status=1)
        for text in ['', '\n', '129\n', '-1\n', '1x\n', '9'*5000+'\n']:
            run('lab bad count ' + text[:15], lab_exe, arguments=['1'], data=text, error='invalid count\n', status=1)
        for text in ['1\n', '1\n\n', '1\n10000\n', '1\n12x\n', '1\n-1\n', '1\n 3\n', '1\n3 \n', '1\n'+'9'*5000+'\n']:
            run('lab bad value ' + text[:15], lab_exe, arguments=['1'], data=text, error='invalid value\n', status=1)
        run('unsorted CLI input rejected', lab_exe, arguments=['1'], data='3\n5\n1\n4\n', error='array is not sorted\n', status=1)
        run('leading zeros accepted', lab_exe, 'count=1 target=3\nlower=0\nlinear=0 comparisons=1 found=1\nbinary=0 comparisons=2 found=1\n', ['0003'], '001\n0003')

        mutated_search = work / 'wrong_boundary.c'
        mutated_search.write_text((search / 'search.c').read_text(encoding='utf-8').replace('values[mid] < target', 'values[mid] <= target'), encoding='utf-8')
        wrong = build('benign upper/lower confusion', [HERE / 'stage3-search-tests.c', mutated_search], ['-I', search])
        result = process([wrong], cwd=work)
        check('oracle catches upper/lower confusion', result.returncode == 1 and 'lower position' in result.stderr, result.stdout+result.stderr)
        mutated_stats = work / 'wrong_tie.c'
        mutated_stats.write_text((prefix / 'prefix_stats.c').read_text(encoding='utf-8').replace('value > result.maximum', 'value >= result.maximum'), encoding='utf-8')
        wrong = build('benign first/last maximum confusion', [HERE / 'stage3-stats-tests.c', mutated_stats], ['-I', prefix])
        result = process([wrong], cwd=work)
        check('oracle catches earliest-maximum bug', result.returncode == 1 and 'first maximum position' in result.stderr, result.stdout+result.stderr)

        copy_cost = 0
        capacity = 4
        for count in range(17):
            if count == capacity:
                copy_cost += count
                capacity *= 2
        check('amortized copy arithmetic example', copy_cost == 28 and copy_cost+17 == 45 and 45 < 3*17)
        check('sorted exhaustive-case arithmetic', sum(math.comb(n+4,4)*7 for n in range(8)) == 5544)
        metrics['hanoiSizesLegalityChecked'] = list(range(9))
        metrics['growthSizesChecked'] = 18


if __name__ == '__main__':
    passed = False
    error = ''
    try:
        main()
        passed = True
    except Exception as exc:
        error = str(exc)
    payload = {'date': datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
               'passed': passed, 'checks': len(checks), 'programGroups': 6,
               'environment': environment, 'metrics': metrics, 'error': error, 'results': checks}
    (HERE / '第三阶段检查结果.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k != 'results'}, ensure_ascii=True))
    raise SystemExit(0 if passed else 1)
