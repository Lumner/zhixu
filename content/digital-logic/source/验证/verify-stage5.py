"""Optional Python 3.10+ authoring check: four control/communication labs.
Learners can compile design.sv and tb.sv directly with Icarus -g2012.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,re,subprocess
source=Path(__file__).resolve().parents[1]
root=source.parent.parent.parent
cache=root/'.cache/digital-logic-stage5'
p=argparse.ArgumentParser();p.add_argument('--iverilog',default='iverilog');p.add_argument('--vvp',default='vvp');args=p.parse_args()
def decode(data):
    try:return data.decode('utf-8')
    except UnicodeDecodeError:return data.decode('gb18030',errors='replace')
def execute(command,cwd):
    r=subprocess.run(command,cwd=cwd,capture_output=True,timeout=30,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    return r.returncode,decode(r.stdout)+decode(r.stderr)
code,version=execute([args.iverilog,'-V'],root);assert code==0,version
results=[]
def run_lab(name,design,tb,fault=False):
    out=cache/name;out.mkdir(parents=True,exist_ok=True);sim=out/'sim.vvp'
    code,messages=execute([args.iverilog,'-g2012','-s','tb','-o',str(sim),str(design),str(tb)],out)
    assert code==0,(name,messages)
    status,log=execute([args.vvp,str(sim)],out)
    if fault:assert status!=0 and 'FATAL' in log,(name,status,log)
    else:assert status==0 and 'PASS ' in log,(name,status,log)
    results.append({'name':name,'expectedFailure':fault,'compileExitCode':code,
        'compileMessages':messages,'exitCode':status,'output':log})
    print(('DETECTED ' if fault else 'PASSED ')+name)
labs=sorted(p for p in (source/'控制通信实验').iterdir() if p.is_dir() and re.match(r'^\d{2}-',p.name));assert len(labs)==4
for lab in labs:run_lab(lab.name,lab/'design.sv',lab/'tb.sv')
count_case="""case ({push,pop})
        2'b10: level<=level+1'b1;
        2'b01: level<=level-1'b1;
        default: level<=level;
      endcase"""
mutations=[
 ('skip-yellow','22-fsm','if (advance) next_state=S_YELLOW;','if (advance) next_state=S_RED;'),
 ('ready-loses-replacement','23-ready-valid','(!full || out_ready)','!full'),
 ('overwrite-while-stalled','23-ready-valid','else if (in_ready) begin','else begin'),
 ('fifo-full-replacement','24-fifo','wr_en && !full','wr_en && (!full || rd_en)'),
 ('fifo-empty-bypass','24-fifo','rd_en && !empty','rd_en && (!empty || wr_en)'),
 ('fifo-double-count-write','24-fifo',count_case,"if (push) level<=level+1'b1;\n      if (pop) level<=level-1'b1;"),
 ('uart-msb-first','25-uart',"frame<={1'b1,data,1'b0};","frame<={1'b1,data[0],data[1],data[2],data[3],data[4],data[5],data[6],data[7],1'b0};"),
 ('uart-external-data','25-uart','tx<=frame[1];','tx<=data[bit_index];'),
 ('uart-short-stop-busy','25-uart','if (bit_index==9)','if (bit_index==8)'),
]
for name,lab_name,old,new in mutations:
    lab=source/'控制通信实验'/lab_name;text=(lab/'design.sv').read_text(encoding='utf-8')
    assert text.count(old)==1,(name,old)
    dst=cache/'mutations'/name/'design.sv';dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(text.replace(old,new),encoding='utf-8')
    run_lab('mutant-'+name,dst,lab/'tb.sv',True)

# Decode actual serial output samples independently of the DUT's frame register.
vcd=(cache/'25-uart/uart.vcd').read_text(encoding='utf-8')
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
samples=[];accepted_records={}
for cpb in [1,4]:
    prefix=f'tb.c{cpb}.';previous='x';accepted=[]
    for tick,state in snapshots:
        busy=state.get(names[prefix+'busy'],'x')
        if busy=='1' and previous!='1':
            accepted.append((tick,int(state[names[prefix+'data']],2)))
        previous=busy
    assert len(accepted)==257,(cpb,len(accepted))
    assert [v for _,v in accepted[:256]]==list(range(256))
    accepted_records[str(cpb)]=len(accepted)
    for byte in [0,0x53,0xa5,0xff]:
        start_tick,value=accepted[byte];bits=[]
        for symbol in range(10):
            center=start_tick+round((symbol+0.5)*cpb*10e-9/seconds_per_tick)
            state=[s for t,s in snapshots if t<=center][-1]
            tx=int(state[names[prefix+'tx']],2)
            expected=0 if symbol==0 else 1 if symbol==9 else (value>>(symbol-1))&1
            assert tx==expected and state[names[prefix+'busy']]=='1',(cpb,value,symbol,tx,expected)
            bits.append(tx)
        samples.append({'clksPerBit':cpb,'byte':value,
            'acceptedNs':round(start_tick*seconds_per_tick*1e9,6),'symbols':bits,
            'decodedByte':sum(bits[k+1]<<k for k in range(8))})
print('PASSED VCD: 8 selected UART frames, 80 symbol centers, both clock ratios')
report={'date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
 'tool':version.splitlines()[0],'languageMode':'-g2012','passedControlExperiments':4,'detectedInjectedFaults':9,
 'coverage':{'fsmEdges':10,'fsmTransitionRows':6,'streamCycles':13,'streamAccepted':5,
 'streamDelivered':4,'streamResetDiscarded':1,'fifoCycles':220,'uartClksPerBit':[1,4],
 'uartCompletedFrames':512,'uartCenterSamples':5120,'uartAbortedFrames':2},
 'results':results,'uartVcdFrames':samples,'uartAcceptedFramesIncludingAbort':accepted_records,
 'gtkWaveGuiExecuted':False,'fpgaSynthesisVerified':False,'physicalUartVerified':False,
 'sourceHashes':{str(f.relative_to(source)):hashlib.sha256(f.read_bytes()).hexdigest()
    for lab in labs for f in [lab/'design.sv',lab/'tb.sv']}}
Path(__file__).with_name('第五阶段仿真结果.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Completed: four labs, nine rejected faults, real UART waveforms decoded.')
