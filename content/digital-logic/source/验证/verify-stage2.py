"""Verify the six language labs, three injected faults, and the actual VCD.

Run from any directory with Python 3.10+ and Icarus in PATH, or supply
--iverilog /absolute/path/iverilog --vvp /absolute/path/vvp.
This authoring check is optional; learners can use the direct commands.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, os, re, subprocess

source = Path(__file__).resolve().parents[1]
course = source.parent
root = course.parent.parent
cache = root / '.cache' / 'digital-logic-stage2'
parser = argparse.ArgumentParser()
parser.add_argument('--iverilog', default='iverilog')
parser.add_argument('--vvp', default='vvp')
args = parser.parse_args()

def execute(command, cwd):
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=30,
                          creationflags=flags)

version = execute([args.iverilog, '-V'], root)
if version.returncode:
    raise RuntimeError(version.stdout + version.stderr)
results = []

def run_lab(name, design, tb, expect_failure=False):
    output = cache / name
    output.mkdir(parents=True, exist_ok=True)
    sim = output / 'sim.vvp'
    compile_result = execute([args.iverilog, '-g2012', '-s', 'tb', '-o', str(sim), str(design), str(tb)], output)
    if compile_result.returncode:
        raise RuntimeError(name + ': compile failed\n' + compile_result.stdout + compile_result.stderr)
    run = execute([args.vvp, str(sim)], output)
    if expect_failure:
        assert run.returncode != 0 and 'FATAL' in run.stdout + run.stderr, (name, run.stdout, run.stderr)
    else:
        assert run.returncode == 0 and 'PASS ' in run.stdout, (name, run.stdout, run.stderr)
    result = {'name': name, 'expectedFailure': expect_failure, 'exitCode': run.returncode,
              'compileMessages': compile_result.stdout + compile_result.stderr,
              'output': run.stdout + run.stderr}
    results.append(result)
    print(('DETECTED ' if expect_failure else 'PASSED ') + name)

labs = sorted(p for p in (source / '语言实验').iterdir() if p.is_dir() and re.match(r'^\d{2}-', p.name))
assert len(labs) == 6
for lab in labs:
    run_lab(lab.name, lab / 'design.sv', lab / 'tb.sv')

mutations = [
    ('gate-and-to-or', '07-first', [('a & b', 'a | b')]),
    ('missing-combination-assignments', '11-comb', [('selected=4\'b0000;', ''), ('else selected=a;', '')]),
    ('majority-to-any', '12-majority', [('(a&b)|(a&c)|(b&c)', 'a|b|c')]),
]
for name, lab_name, edits in mutations:
    lab = source / '语言实验' / lab_name
    mutated = (lab / 'design.sv').read_text(encoding='utf-8')
    for old, new in edits:
        assert old in mutated, (name, old)
        mutated = mutated.replace(old, new)
    mutant = cache / 'mutations' / name / 'design.sv'
    mutant.parent.mkdir(parents=True, exist_ok=True)
    mutant.write_text(mutated, encoding='utf-8')
    run_lab('mutant-' + name, mutant, lab / 'tb.sv', True)

# Parse the real simulator-produced VCD, not a hand-created expected file.
vcd_file = cache / '12-majority' / 'majority.vcd'
vcd = vcd_file.read_text(encoding='utf-8')
scale = re.search(r'\$timescale\s+(\d+)\s*(s|ms|us|ns|ps|fs)\s+\$end', vcd)
assert scale
seconds_per_tick = int(scale[1]) * {'s':1, 'ms':1e-3, 'us':1e-6, 'ns':1e-9, 'ps':1e-12, 'fs':1e-15}[scale[2]]
stack, names, values, snapshots = [], {}, {}, []
time = 0
for raw in vcd.splitlines():
    line = raw.strip()
    fields = line.split()
    if line.startswith('$scope '): stack.append(fields[2])
    elif line.startswith('$upscope'): stack.pop()
    elif line.startswith('$var '): names['.'.join(stack + [fields[4]])] = fields[3]
    elif line.startswith('#'):
        snapshots.append((time, dict(values)))
        time = int(line[1:])
    elif line and line[0] in '01xz': values[line[1:]] = line[0]
    elif line and line[0] in 'bBrR' and len(fields) == 2: values[fields[1]] = fields[0][1:]
snapshots.append((time, dict(values)))
vcd_checks = []
for i in range(8):
    sample_ns = 5 + 10*i
    sample_tick = round(sample_ns*1e-9/seconds_per_tick)
    state = [state for t,state in snapshots if t <= sample_tick][-1]
    actual = ''.join(state[names['tb.'+name]] for name in ('a','b','c','y'))
    bits = f'{i:03b}'
    expected = bits + str(int(bits.count('1') >= 2))
    assert actual == expected, (sample_ns, actual, expected)
    vcd_checks.append({'sampleNs': sample_ns, 'input':bits, 'y':int(actual[-1])})
print('PASSED VCD: 8 interval-center samples')

report = {
    'date': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
    'tool': version.stdout.splitlines()[0], 'languageMode':'-g2012',
    'passedLanguageExperiments':6, 'detectedInjectedFaults':3, 'vcdSamples':vcd_checks,
    'results':results, 'gtkWaveGuiExecuted':False, 'fpgaSynthesisVerified':False,
    'sourceHashes': {str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest()
                     for lab in labs for p in (lab/'design.sv', lab/'tb.sv')},
}
report_file = Path(__file__).with_name('第二阶段仿真结果.json')
report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Completed: six labs, three rejected mutants, actual VCD parsed.')
