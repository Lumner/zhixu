"""Graph contracts, independent finite oracles, CLI examples and content checks."""
import argparse,json,os,re,subprocess,tempfile
from datetime import datetime,timezone,timedelta
from pathlib import Path
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parent;COURSE=SOURCE.parent;EXAMPLES=SOURCE/'示例代码';DRAFT=COURSE/'drafts/stage8'
FOLDERS=['stage8-common','43-graph','44-traversal','45-topological','46-shortest','47-negative-paths','48-spanning','stage8-graph-lab']
checks,environment,metrics=[],{},{}
def check(name,condition,detail=''):
    checks.append({'name':name,'passed':bool(condition),'detail':detail[:1800] if not condition else ''})
    if not condition:raise AssertionError(name+': '+detail[:1800])
def process(args,cwd=None):
    return subprocess.run(list(map(str,args)),capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45,cwd=cwd,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
def prose():
    for doc in list(SOURCE.rglob('*.md'))+list(DRAFT.glob('*.md')):
        text=doc.read_text(encoding='utf-8');check('resolved embeds: '+doc.name,'@@EXAMPLE:' not in text)
        if re.match(r'4[3-8]-',doc.name):
            for term in ['目标与先修','常见错误','练习与参考答案','完成条件']:check(doc.name+': '+term,term in text)
            check(doc.name+': sections',len(re.findall(r'^## ',text,re.M))>=10)
        base=SOURCE if doc.parent==DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',link) or link.startswith('#'):continue
            target=(base/link.split('#')[0]).resolve();exists=target.exists() or (target.parent==SOURCE and (DRAFT/target.name).exists())
            check('local link: '+doc.name+' -> '+link,target.is_relative_to(COURSE) and exists)
    blocks=[s.strip() for s in re.findall(r'```c\n(.*?)\n```',(EXAMPLES/'stage8-common/完整源码.md').read_text(encoding='utf-8'),re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES/folder).glob('*'):
            if file.suffix in ['.c','.h']:check('appendix: '+folder+'/'+file.name,file.read_text(encoding='utf-8').strip() in blocks)
    mapping={'43':['stage8-common/graph.c'],'44':['44-traversal/walk.c'],'45':['45-topological/topological.c'],'46':['46-shortest/dijkstra.c','46-shortest/path.c'],'47':['47-negative-paths/bellman.c','47-negative-paths/floyd.c'],'48':['48-spanning/dsu.c','48-spanning/spanning.c']}
    for chapter,files in mapping.items():
        doc=(list(DRAFT.glob(chapter+'-*.md')) or list(SOURCE.glob(chapter+'-*.md')))[0];blocks=[s.strip() for s in re.findall(r'```c\n(.*?)\n```',doc.read_text(encoding='utf-8'),re.S)]
        for file in files:check('chapter full source: '+file,(EXAMPLES/file).read_text(encoding='utf-8').strip() in blocks)
def main(args):
    version=process([args.cc,'--version']);check('compiler starts',version.returncode==0,version.stderr);environment['compiler']=version.stdout.splitlines()[0]
    compat=['-D__USE_MINGW_ANSI_STDIO=1'] if os.name=='nt' and '8.1.0' in environment['compiler'] else []
    environment['flags']=['-std=c17','-Wall','-Wextra','-Wpedantic','-Werror','-O0',*compat]
    if not args.runtime_only:prose()
    temp_root=Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage8-',dir=temp_root) as folder:
        work=Path(folder).resolve();check('temporary cleanup confined',work.parent==temp_root and work.name.startswith('dsa-stage8-'))
        include=[]
        for directory in [HERE,*[EXAMPLES/f for f in FOLDERS]]:include+=['-I',directory]
        flags=[*environment['flags'],*include];serial=0
        def build(label,files):
            nonlocal serial
            serial+=1;exe=work/(f'case{serial}.exe' if os.name=='nt' else f'case{serial}')
            result=process([args.cc,*flags,*files,'-o',exe],work);check('compile: '+label,result.returncode==0,result.stderr);return exe
        def run(label,exe,expected,arguments=(),error='',status=0):
            result=process([exe,*arguments],work);check(label,result.returncode==status and result.stdout==expected and result.stderr==error,repr((result.returncode,result.stdout,result.stderr)));return result
        libs={'graph':EXAMPLES/'stage8-common/graph.c','walk':EXAMPLES/'44-traversal/walk.c','topo':EXAMPLES/'45-topological/topological.c','path':EXAMPLES/'46-shortest/path.c','dijkstra':EXAMPLES/'46-shortest/dijkstra.c','bellman':EXAMPLES/'47-negative-paths/bellman.c','floyd':EXAMPLES/'47-negative-paths/floyd.c','dsu':EXAMPLES/'48-spanning/dsu.c','mst':EXAMPLES/'48-spanning/spanning.c'}
        demos=[('43-graph/main.c',[], 'vertices=4 edges=3 arcs=5\n0: 1(0) 2(5)\n1: 0(0)\n2: 0(5) 2(-1)\n3:\nreverse_duplicate=1\n'),
               ('44-traversal/main.c',['walk'],'dfs=0,1,2,3\nbfs=0,1,3,2\ndepth3 dfs=3 bfs=1 components=2\n'),
               ('45-topological/main.c',['topo'],'order=0,1,2,3\ncycle=1 old_count=4\n'),
               ('46-shortest/main.c',['path','dijkstra'],'cost=4 path=0,2,1,3\nvertex4=unreachable\n'),
               ('47-negative-paths/bellman_main.c',['path','bellman'],'0 finite 0\n1 negative\n2 negative\n3 negative\n4 unreachable\n'),
               ('47-negative-paths/floyd_main.c',['path','floyd'],'d02=2 state20=unreachable self3=0\nafter_cycle 0to2=negative 0to0=finite\n'),
               ('48-spanning/main.c',['dsu','mst'],'kruskal total=2 edges=3 components=2\nprim total=2 edges=3 components=2\n')]
        for file,keys,expected in demos:
            exe=build(file,[EXAMPLES/file,libs['graph'],*[libs[k] for k in keys]]);run('documented output: '+file,exe,expected)
        lab=build('network laboratory',[EXAMPLES/'stage8-graph-lab/main.c',libs['graph'],libs['path'],libs['dijkstra'],libs['topo']])
        run('study order',lab,'C -> arrays -> pointers -> lists -> graphs\n',['study'])
        run('dependency cycle',lab,'',['study','cycle'],'graph-lab: dependency cycle\n',1)
        run('route finite',lab,'cost=10 path=0,2,1,3,4\n',['route','0','4'])
        run('route unreachable',lab,'unreachable\n',['route','0','5'])
        run('route self',lab,'cost=0 path=2\n',['route','2','2'])
        run('reverse route',lab,'cost=10 path=4,3,1,2,0\n',['route','4','0'])
        for value in ['6','8','-1','','00','a']:
            run('invalid vertex '+repr(value),lab,'',['route',value,'0'],'graph-lab: invalid vertex\n',1)
        run('usage',lab,'',[],'usage: graph-lab study [cycle] | route source target\n',1)
        bases={'structural':[HERE/'stage8-structural.c',libs['graph'],libs['walk'],libs['topo'],libs['dsu']],
               'paths':[HERE/'stage8-paths.c',libs['graph'],libs['path'],libs['dijkstra'],libs['bellman'],libs['floyd']],
               'forests':[HERE/'stage8-forests.c',libs['graph'],libs['dsu'],libs['mst']]}
        expected={'structural':'storage_steps=5000 walk_graphs=512 component_graphs=64 topology_graphs=65536 dsu_steps=10000\n',
                  'paths':'weighted_graphs=262144 simple_path_cycle_oracle=1 numeric_boundaries=1\n',
                  'forests':'weighted_undirected_graphs=4096 exhaustive_edge_subsets=1 forest_boundaries=1\n'}
        for key,files in bases.items():
            exe=build('finite oracle: '+key,files);run('independent checks: '+key,exe,expected[key])
        metrics.update(storageModelSteps=5000,walkGraphs=512,componentGraphs=64,topologyGraphs=65536,dsuModelSteps=10000,weightedDirectedGraphs=262144,weightedUndirectedGraphs=4096,checkedArithmeticBoundaries=True,dynamicAllocationsUsed=False)
        mutations=[('topology accepts partial result','topo','structural','if (next.count != graph->n) { return G_CYCLE; }','if (next.count != graph->n) { *out = next; return G_OK; }'),
                   ('Dijkstra ignores zero edge','dijkstra','paths','if (!graph->has[u][v] || done[v])','if (!graph->has[u][v] || done[v] || graph->weight[u][v] == 0)'),
                   ('negative effect propagation too short','bellman','paths','for (size_t pass = 0; pass < graph->n; pass++)','for (size_t pass = 0; pass < 1; pass++)'),
                   ('Floyd misses upstream affected pair','floyd','paths','finite.state[u][k] == PATH_FINITE && finite.state[k][v]','u == k && finite.state[u][k] == PATH_FINITE && finite.state[k][v]'),
                   ('Prim ignores disconnected roots','mst','forests','if (used[root]) { continue; }','if (used[root] || root != 0) { continue; }')]
        for label,key,base,before,after in mutations:
            text=libs[key].read_text(encoding='utf-8');check('mutation target: '+label,before in text);wrong=work/('wrong_'+key+'.c');wrong.write_text(text.replace(before,after),encoding='utf-8')
            exe=build('safe mutant: '+label,[wrong if p==libs[key] else p for p in bases[base]]);result=process([exe],work);check('oracle detects: '+label,result.returncode==1 and result.stderr.startswith('FAIL '),result.stdout+result.stderr)
        metrics['detectedSafeMutations']=5
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cc',default='gcc');parser.add_argument('--runtime-only',action='store_true');args=parser.parse_args();passed,error=False,''
    try:main(args);passed=True
    except Exception as exc:error=str(exc)
    payload={'date':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'passed':passed,'checks':len(checks),'programGroups':8,'runtimeOnly':args.runtime_only,'environment':environment,'metrics':metrics,'error':error,'results':checks}
    target=COURSE/'stage8-runtime-checks.json' if args.runtime_only else HERE/'第八阶段检查结果.json';target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in payload.items() if k!='results'},ensure_ascii=True));raise SystemExit(0 if passed else 1)
