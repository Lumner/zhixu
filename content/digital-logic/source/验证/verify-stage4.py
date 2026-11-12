"""Optional authoring check for five sequential labs (Python 3.10+).
Run with Icarus in PATH, or supply --iverilog and --vvp absolute paths.
Generated outputs and isolated fault copies stay in the project cache.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,re,shutil,subprocess
source=Path(__file__).resolve().parents[1]
root=source.parent.parent.parent
cache=root/'.cache/digital-logic-stage4'
parser=argparse.ArgumentParser()
parser.add_argument('--iverilog',default='iverilog')
parser.add_argument('--vvp',default='vvp')
args=parser.parse_args()

def decode(data):
    try:return data.decode('utf-8')
    except UnicodeDecodeError:return data.decode('gb18030',errors='replace')

def execute(command,cwd):
    result=subprocess.run(command,cwd=cwd,capture_output=True,timeout=30,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    return result.returncode,decode(result.stdout)+decode(result.stderr)

version_code,version=execute([args.iverilog,'-V'],root)
assert version_code==0,version
results=[]
def run_lab(name,design,tb,expected_failure=False):
    output=cache/name;output.mkdir(parents=True,exist_ok=True)
    for extra in tb.parent.glob('*.hex'):shutil.copyfile(extra,output/extra.name)
    sim=output/'sim.vvp'
    code,messages=execute([args.iverilog,'-g2012','-s','tb','-o',str(sim),str(design),str(tb)],output)
    assert code==0,(name,messages)
    exit_code,log=execute([args.vvp,str(sim)],output)
    if expected_failure:assert exit_code!=0 and 'FATAL' in log,(name,exit_code,log)
    else:assert exit_code==0 and 'PASS ' in log,(name,exit_code,log)
    results.append({'name':name,'expectedFailure':expected_failure,'compileExitCode':code,
        'compileMessages':messages,'exitCode':exit_code,'output':log})
    print(('DETECTED ' if expected_failure else 'PASSED ')+name)

labs=sorted(p for p in (source/'时序实验').iterdir() if p.is_dir() and re.match(r'^\d{2}-',p.name))
assert len(labs)==5
for lab in labs:run_lab(lab.name,lab/'design.sv',lab/'tb.sv')

mutations=[
 ('pipeline-blocking-collapse','17-pipeline','q1 <= d;\n      q2 <= q1;','q1 = d;\n      q2 = q1;'),
 ('sync-reset-made-async','18-reset','always_ff @(posedge clk) begin','always_ff @(posedge clk or posedge rst) begin'),
 ('enable-before-reset-clear','18-reset',
  "if (rst) sync_q <= 4'h0;\n    else if (clear) sync_q <= 4'h0;\n    else if (en) sync_q <= d;",
  "if (en) sync_q <= d;\n    else if (rst || clear) sync_q <= 4'h0;"),
 ('tick-one-cycle-late','19-tick','count == DIV-1','count == DIV'),
 ('pause-clears-position','19-tick',"else count <= count + 1'b1;\n    end\n  end",
  "else count <= count + 1'b1;\n    end else count <= '0;\n  end"),
 ('shift-direction-reversed','20-shift-pwm','{q[2:0],serial_in}','{serial_in,q[3:1]}'),
 ('pwm-inclusive-comparison','20-shift-pwm','phase}<duty','phase}<=duty'),
 ('ram-write-first','21-memory','dout <= mem[addr];','dout <= we ? din : mem[addr];'),
 ('ram-forced-zero-initial','21-memory','logic [7:0] mem[0:3];',
  "logic [7:0] mem[0:3];\n  initial for (int j=0;j<4;j++) mem[j]=8'h00;"),
]
for name,lab_name,old,new in mutations:
    lab=source/'时序实验'/lab_name;text=(lab/'design.sv').read_text(encoding='utf-8')
    assert text.count(old)==1,(name,old)
    mutated=cache/'mutations'/name/'design.sv';mutated.parent.mkdir(parents=True,exist_ok=True)
    mutated.write_text(text.replace(old,new),encoding='utf-8')
    run_lab('mutant-'+name,mutated,lab/'tb.sv',True)

# Parse actual VCD samples one nanosecond after the checked rising edges.
vcd=(cache/'17-pipeline/pipeline.vcd').read_text(encoding='utf-8')
scale=re.search(r'\$timescale\s+(\d+)\s*(s|ms|us|ns|ps|fs)\s+\$end',vcd);assert scale
seconds_per_tick=int(scale[1])*{'s':1,'ms':1e-3,'us':1e-6,'ns':1e-9,'ps':1e-12,'fs':1e-15}[scale[2]]
stack=[];names={};values={};snapshots=[];time=0
for raw in vcd.splitlines():
    line=raw.strip();f=line.split()
    if line.startswith('$scope '):stack.append(f[2])
    elif line.startswith('$upscope'):stack.pop()
    elif line.startswith('$var '):names['.'.join(stack+[f[4]])]=f[3]
    elif line.startswith('#'):snapshots.append((time,dict(values)));time=int(line[1:])
    elif line and line[0] in '01xz':values[line[1:]]=line[0]
    elif line and line[0] in 'bB' and len(f)==2:values[f[1]]=f[0][1:]
snapshots.append((time,dict(values)))
samples=[]
for ns,d,rst,q1,q2 in [(16,0,1,0,0),(26,10,0,10,0),(36,11,0,11,10),
                      (46,12,0,12,11),(56,15,1,0,0),(66,15,0,15,0),(76,2,0,2,15)]:
    tick=round(ns*1e-9/seconds_per_tick)
    state=[s for t,s in snapshots if t<=tick][-1]
    actual={name:int(state[names['tb.'+name]],2) for name in ['d','rst','q1','q2']}
    assert actual=={'d':d,'rst':rst,'q1':q1,'q2':q2},(ns,actual)
    samples.append({'sampleNs':ns,**actual})
print('PASSED VCD: 7 two-stage pipeline samples')
report={'date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
 'tool':version.splitlines()[0],'languageMode':'-g2012','passedSequentialExperiments':5,
 'detectedInjectedFaults':9,'results':results,'pipelineVcdSamples':samples,
 'coverage':{'pipelineScriptedEdges':7,'resetScriptedEdges':17,'resetPulseChecks':3,
  'counterCyclesPerConfiguration':25,'counterDivisors':[1,4,5],'shiftChecks':5,
  'pwmFrames':16,'pwmPhaseSamples':128,'pwmLiveChanges':2,'memoryAccesses':14},
 'gtkWaveGuiExecuted':False,'fpgaSynthesisVerified':False,
 'sourceHashes':{str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest()
  for lab in labs for p in lab.iterdir() if p.suffix in ['.sv','.hex']}}
Path(__file__).with_name('第四阶段仿真结果.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Completed: five labs, nine rejected faults, seven actual VCD samples.')
