"""Run four combinational labs and seven isolated fault copies.

Optional authoring check. Learners only need Icarus and the two direct
compile/run commands in each lab. Python 3.10+ is used here for reporting.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess

source = Path(__file__).resolve().parents[1]
root = source.parent.parent.parent
cache = root / '.cache' / 'digital-logic-stage3'
parser = argparse.ArgumentParser()
parser.add_argument('--iverilog', default='iverilog')
parser.add_argument('--vvp', default='vvp')
args = parser.parse_args()

def decode(data):
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return data.decode('gb18030', errors='replace')

def execute(command, cwd):
    result = subprocess.run(command, cwd=cwd, capture_output=True, timeout=30,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    return result.returncode, decode(result.stdout) + decode(result.stderr)

version_code, version_text = execute([args.iverilog, '-V'], root)
assert version_code == 0, version_text
results = []

def run_lab(name, design, tb, expected_failure=False):
    output = cache / name
    output.mkdir(parents=True, exist_ok=True)
    sim = output / 'sim.vvp'
    compile_code, messages = execute([args.iverilog, '-g2012', '-s', 'tb', '-o',
        str(sim), str(design), str(tb)], output)
    assert compile_code == 0, (name, messages)
    exit_code, log = execute([args.vvp, str(sim)], output)
    if expected_failure:
        assert exit_code != 0 and 'FATAL' in log, (name, exit_code, log)
    else:
        assert exit_code == 0 and 'PASS ' in log, (name, exit_code, log)
    results.append({'name':name, 'expectedFailure':expected_failure,
        'compileExitCode':compile_code, 'compileMessages':messages,
        'exitCode':exit_code, 'output':log})
    print(('DETECTED ' if expected_failure else 'PASSED ') + name)

labs = sorted(p for p in (source/'组合实验').iterdir()
              if p.is_dir() and re.match(r'^\d{2}-', p.name))
assert len(labs) == 4
for lab in labs:
    run_lab(lab.name, lab/'design.sv', lab/'tb.sv')

high_first = """if (req[3]) begin valid = 1'b1; index = 2'd3; end
    else if (req[2]) begin valid = 1'b1; index = 2'd2; end
    else if (req[1]) begin valid = 1'b1; index = 2'd1; end
    else if (req[0]) begin valid = 1'b1; index = 2'd0; end"""
low_first = """if (req[0]) begin valid = 1'b1; index = 2'd0; end
    else if (req[1]) begin valid = 1'b1; index = 2'd1; end
    else if (req[2]) begin valid = 1'b1; index = 2'd2; end
    else if (req[3]) begin valid = 1'b1; index = 2'd3; end"""
mutations = [
    ('priority-reversed','13-routing',high_first,low_first),
    ('subtract-missing-one','14-alu','+ 5\'d1;','+ 5\'d0;'),
    ('address-boundary-inclusive','15-parameter','addr} < DEPTH','addr} <= DEPTH'),
    ('overflow-is-carry','16-alu-regression',
        '~(a[3] ^ b[3]) & (y[3] ^ a[3])','carry'),
    ('borrow-inverted','16-alu-regression',
        'overflow = (a[3] ^ b[3]) & (y[3] ^ a[3]);',
        "carry = ~carry;\n        overflow = (a[3] ^ b[3]) & (y[3] ^ a[3]);"),
    ('or-written-as-and','16-alu-regression',"3'b100: y = a | b;","3'b100: y = a & b;"),
    ('reserved-op-accepted','16-alu-regression',"valid_op = 1'b0;","valid_op = 1'b1;"),
]
for name, lab_name, old, new in mutations:
    lab = source/'组合实验'/lab_name
    text = (lab/'design.sv').read_text(encoding='utf-8')
    assert text.count(old) == 1, (name, old)
    mutant = cache/'mutations'/name/'design.sv'
    mutant.parent.mkdir(parents=True, exist_ok=True)
    mutant.write_text(text.replace(old,new), encoding='utf-8')
    run_lab('mutant-'+name, mutant, lab/'tb.sv', True)

# Read values in the actual simulator VCD, after settling inside each interval.
vcd = (cache/'16-alu-regression'/'alu.vcd').read_text(encoding='utf-8')
scale = re.search(r'\$timescale\s+(\d+)\s*(s|ms|us|ns|ps|fs)\s+\$end',vcd)
assert scale
seconds_per_tick = int(scale[1])*{'s':1,'ms':1e-3,'us':1e-6,'ns':1e-9,'ps':1e-12,'fs':1e-15}[scale[2]]
names, stack, values, snapshots = {}, [], {}, []
time = 0
for raw in vcd.splitlines():
    line=raw.strip(); fields=line.split()
    if line.startswith('$scope '): stack.append(fields[2])
    elif line.startswith('$upscope'): stack.pop()
    elif line.startswith('$var '): names['.'.join(stack+[fields[4]])]=fields[3]
    elif line.startswith('#'):
        snapshots.append((time,dict(values))); time=int(line[1:])
    elif line and line[0] in '01xz': values[line[1:]]=line[0]
    elif line and line[0] in 'bB' and len(fields)==2: values[fields[1]]=fields[0][1:]
snapshots.append((time,dict(values)))
vcd_checks=[]
for op,a,b in [(0,7,1),(0,15,1),(0,8,8),(1,3,5),(1,8,1),(2,10,12),(4,1,2),(5,7,1)]:
    sample_ns=op*256+a*16+b+0.5
    tick=round(sample_ns*1e-9/seconds_per_tick)
    state=[s for t,s in snapshots if t<=tick][-1]
    actual={name:int(state[names['tb.'+name]],2)
        for name in ['a','b','op','y','carry','overflow','zero','valid_op']}
    sa=a if a<8 else a-16; sb=b if b<8 else b-16
    math_value={0:a+b,1:a-b,2:a&b,3:a^b,4:a|b}.get(op,0)
    signed_math=sa+sb if op==0 else sa-sb
    expected={'a':a,'b':b,'op':op,'y':math_value%16,
        'carry':int(a+b>15) if op==0 else int(a>=b) if op==1 else 0,
        'overflow':int(not(-8<=signed_math<=7)) if op<2 else 0,
        'zero':int(math_value%16==0),'valid_op':int(op<5)}
    assert actual==expected,(sample_ns,actual,expected)
    vcd_checks.append({'sampleNs':sample_ns,**actual})
print('PASSED VCD: 8 arithmetic/reserved-op samples')

report={'date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
    'tool':version_text.splitlines()[0], 'languageMode':'-g2012',
    'passedCombinationalExperiments':4,'detectedInjectedFaults':7,
    'routingSelectedCases':2048,'aluDirectedCases':9,
    'parameterDataCases':16644,'parameterAddressChecks':18,'parameterDigitCases':16,
    'extendedAluBinaryInputCases':2048,'vcdSamples':vcd_checks,'results':results,
    'fpgaSynthesisVerified':False,'gtkWaveGuiExecuted':False,
    'sourceHashes':{str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest()
        for lab in labs for p in [lab/'design.sv',lab/'tb.sv']}}
Path(__file__).with_name('第三阶段仿真结果.json').write_text(
    json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Completed: four labs, seven rejected mutants, eight VCD samples.')
