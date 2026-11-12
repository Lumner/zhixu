"""Independent finite models for greedy search and dynamic programming."""
import argparse
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
COURSE = SOURCE.parent
EXAMPLES = SOURCE / '示例代码'
DRAFT = COURSE / 'drafts/stage9a'
FOLDERS = ['stage9-common', '49-interval', '49-change', '50-subset', '50-sudoku', '51-dp']
checks, environment, metrics = [], {}, {}

def check(name, condition, detail=''):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail[:1800] if not condition else ''})
    if not condition:
        raise AssertionError(name + ': ' + detail[:1800])

def process(arguments, cwd=None):
    return subprocess.run(list(map(str, arguments)), cwd=cwd, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=45,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

def prose():
    for doc in list(SOURCE.rglob('*.md')) + list(DRAFT.glob('*.md')):
        text = doc.read_text(encoding='utf-8')
        check('resolved embeds: ' + doc.name, '@@EXAMPLE:' not in text)
        if re.match(r'(49|50|51)-', doc.name):
            for term in ['目标与先修', '常见错误', '练习与参考答案', '完成条件']:
                check(doc.name + ': ' + term, term in text)
            check(doc.name + ': sections', len(re.findall(r'^## ', text, re.M)) >= 12)
        base = SOURCE if doc.parent == DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', link) or link.startswith('#'):
                continue
            target = (base / link.split('#')[0]).resolve()
            exists = target.exists() or (target.parent == SOURCE and (DRAFT / target.name).exists())
            check('local link: ' + doc.name + ' -> ' + link,
                  target.is_relative_to(COURSE) and exists)
    appendix = (EXAMPLES / 'stage9-common/完整源码.md').read_text(encoding='utf-8')
    blocks = [s.strip() for s in re.findall(r'```c\n(.*?)\n```', appendix, re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES / folder).glob('*'):
            if file.suffix in ['.c', '.h']:
                check('appendix: ' + folder + '/' + file.name, file.read_text(encoding='utf-8').strip() in blocks)
    mapping = {'49': ['49-interval/interval.c', '49-change/greedy.c'],
               '50': ['50-subset/subset.c', '50-sudoku/sudoku.c'],
               '51': ['51-dp/coins.c', '51-dp/knapsack.c']}
    for number, files in mapping.items():
        doc = (list(DRAFT.glob(number + '-*.md')) or list(SOURCE.glob(number + '-*.md')))[0]
        blocks = [s.strip() for s in re.findall(r'```c\n(.*?)\n```', doc.read_text(encoding='utf-8'), re.S)]
        for file in files:
            check('chapter full source: ' + file, (EXAMPLES / file).read_text(encoding='utf-8').strip() in blocks)

def main(args):
    version = process([args.cc, '--version'])
    check('compiler starts', version.returncode == 0, version.stderr)
    environment['compiler'] = version.stdout.splitlines()[0]
    compatibility = ['-D__USE_MINGW_ANSI_STDIO=1'] if os.name == 'nt' and '8.1.0' in environment['compiler'] else []
    environment['flags'] = ['-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror', '-O0', *compatibility]
    if not args.runtime_only:
        prose()
    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage9a-', dir=temp_root) as folder:
        work = Path(folder).resolve()
        check('temporary cleanup confined', work.parent == temp_root and work.name.startswith('dsa-stage9a-'))
        includes = []
        for directory in [HERE, *[EXAMPLES / f for f in FOLDERS]]:
            includes += ['-I', directory]
        serial = 0
        def build(label, files):
            nonlocal serial
            serial += 1
            exe = work / ('case' + str(serial) + ('.exe' if os.name == 'nt' else ''))
            result = process([args.cc, *environment['flags'], *includes, *files, '-o', exe], work)
            check('compile: ' + label, result.returncode == 0, result.stderr)
            return exe
        def run(label, exe, expected):
            result = process([exe], work)
            check(label, result.returncode == 0 and result.stdout == expected and result.stderr == '',
                  repr((result.returncode, result.stdout, result.stderr)))
            return result
        library = {'interval': EXAMPLES / '49-interval/interval.c', 'greedy': EXAMPLES / '49-change/greedy.c',
                   'subset': EXAMPLES / '50-subset/subset.c', 'sudoku': EXAMPLES / '50-sudoku/sudoku.c',
                   'coins': EXAMPLES / '51-dp/coins.c', 'pack': EXAMPLES / '51-dp/knapsack.c'}
        demos = [('49-interval/main.c', 'interval', 'count=4 ids=20,30,40,50\n'),
                 ('49-change/main.c', 'greedy', 'greedy total=3 counts=1,0,2\nmanual better: 3+3 uses 2 coins\nstuck=1 old_total=99\n'),
                 ('50-subset/main.c', 'subset', 'solutions=4 masks=9,1,14,6\nplain_nodes=31 pruned_nodes=15 cuts=4\n'),
                 ('50-sudoku/main.c', 'sudoku', 'solutions=1\n1 2 3 4\n3 4 1 2\n2 1 4 3\n4 3 2 1\n'),
                 ('51-dp/coin_main.c', 'coins', 'memo total=2 states=7\ntable total=2 counts=0,2,0 states=7\namount3 possible=0\n'),
                 ('51-dp/pack_main.c', 'pack', 'value=9 cost=6 mask=6 rolling=9\nratio greedy on this sample: value=8, optimum=9\n')]
        for file, key, expected in demos:
            exe = build(file, [EXAMPLES / file, library[key]])
            run('documented output: ' + file, exe, expected)
        models = {'search': [HERE / 'stage9a-search.c', library['interval'], library['subset']],
                  'dp': [HERE / 'stage9a-dp.c', library['greedy'], library['coins'], library['pack']],
                  'sudoku': [HERE / 'stage9a-sudoku.c', library['sudoku']]}
        expected = {'search': 'interval_cases=111111 subset_cases=103759 boundaries=1\n',
                    'dp': 'coin_cases=15616 pack_cases=629145 greedy_counterexamples=1 boundaries=1\n'}
        for label, files in models.items():
            exe = build('independent oracle: ' + label, files)
            result = process([exe], work)
            check('oracle exits: ' + label, result.returncode == 0 and result.stderr == '', repr((result.returncode,result.stdout,result.stderr)))
            if label == 'sudoku':
                matched = re.fullmatch(r'row_candidates=331776 solutions=288 clue_masks=65536 impossible_cases=(\d+) boundaries=1\n', result.stdout)
                check('sudoku oracle summary', bool(matched) and int(matched[1]) > 0, result.stdout)
                metrics['validImpossibleSudokuCases'] = int(matched[1])
            else:
                check('oracle summary: ' + label, result.stdout == expected[label], result.stdout)
        metrics.update(intervalCases=111111, subsetCases=103759, coinCases=15616, packCases=629145,
                       sudokuRowCandidates=331776, completeMiniSudokuSolutions=288, sudokuClueMasks=65536,
                       dynamicAllocationsUsed=False)
        mutants = [('wrong interval criterion', 'interval', 'search', 'return a.end < b.end;', 'return a.start < b.start;'),
                   ('subset prunes equality', 'subset', 'search', 'sum > search->target', 'sum >= search->target'),
                   ('subset forgets rollback', 'subset', 'search', 'search->mask = saved;', '(void)saved;'),
                   ('sudoku ignores box', 'sudoku', 'sudoku', 'search->boxes[box]) & bit', '0u) & bit'),
                   ('coin skips one-coin improvement', 'coins', 'dp', 'child + 1 < work.best[a]', 'child + 2 < work.best[a]'),
                   ('rolling uses current row twice', 'pack', 'dp', 'for (unsigned cap = budget; cap >= items[i].cost; cap--)', 'for (unsigned cap = items[i].cost; cap <= budget; cap++)')]
        for label, key, model, before, after in mutants:
            text = library[key].read_text(encoding='utf-8')
            check('mutation target: ' + label, before in text)
            wrong = work / ('wrong_' + key + '.c')
            wrong.write_text(text.replace(before, after), encoding='utf-8')
            exe = build('safe mutant: ' + label, [wrong if f == library[key] else f for f in models[model]])
            result = process([exe], work)
            check('oracle detects: ' + label, result.returncode != 0 and 'oracle failed at' in result.stderr,
                  repr((result.returncode, result.stdout, result.stderr)))
        metrics['detectedSafeMutations'] = len(mutants)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cc', default='gcc')
    parser.add_argument('--runtime-only', action='store_true')
    args = parser.parse_args()
    error = ''
    try:
        main(args)
    except Exception as exc:
        error = str(exc)
    report = {'date': datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
              'passed': not error, 'checks': len(checks), 'programGroups': 6,
              'runtimeOnly': args.runtime_only, 'environment': environment, 'metrics': metrics,
              'error': error, 'results': checks}
    target = COURSE / 'stage9a-runtime-checks.json' if args.runtime_only else HERE / '第九阶段上检查结果.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'results'}, ensure_ascii=True))
    raise SystemExit(1 if error else 0)
