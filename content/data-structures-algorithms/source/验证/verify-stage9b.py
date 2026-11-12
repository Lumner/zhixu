"""Final planner: CLI, independent integration models, allocation and I/O injection."""
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
APP = EXAMPLES / 'stage9-planner'
DRAFT = COURSE / 'drafts/stage9b'
INCLUDE = ['stage6-common','stage5-common','29-open-addressing','27-matching','stage7-common','stage8-common','stage9-planner']
FILES = ['stage9-planner/app.c','stage9-planner/relations.c','stage9-planner/query.c',
         'stage6-catalog/io.c','stage6-catalog/view.c','stage2-catalog/catalog.c',
         'stage5-indexed-catalog/catalog.c','29-open-addressing/open_map.c',
         '27-matching/matching.c','33-merge/merge.c','stage6-common/sort_common.c',
         'stage8-common/graph.c','45-topological/topological.c','46-shortest/path.c',
         '46-shortest/dijkstra.c','41-heap/heap.c']
checks, environment, metrics = [], {}, {}

def check(label, condition, detail=''):
    checks.append({'name':label,'passed':bool(condition),'detail':detail[:1800] if not condition else ''})
    if not condition:
        raise AssertionError(label + ': ' + detail[:1800])

def process(args, cwd=None):
    return subprocess.run(list(map(str,args)),cwd=cwd,capture_output=True,text=True,
                          encoding='utf-8',errors='replace',timeout=45,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)

def prose():
    for doc in list(SOURCE.rglob('*.md'))+list(DRAFT.glob('*.md')):
        text = doc.read_text(encoding='utf-8')
        check('resolved embeds: '+doc.name,'@@EXAMPLE:' not in text)
        if doc.name.startswith('52-'):
            for term in ['目标与先修','常见错误','练习与参考答案','完成条件']:
                check(doc.name+': '+term,term in text)
            check('final chapter sections',len(re.findall(r'^## ',text,re.M))>=16)
        base = SOURCE if doc.parent==DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',link) or link.startswith('#'):
                continue
            target=(base/link.split('#')[0]).resolve()
            exists=target.exists() or (target.parent==SOURCE and (DRAFT/target.name).exists())
            check('local link: '+doc.name+' -> '+link,target.is_relative_to(COURSE) and exists)
    appendix=(APP/'完整源码.md').read_text(encoding='utf-8')
    blocks=[s.strip() for s in re.findall(r'```c\n(.*?)\n```',appendix,re.S)]
    for file in APP.iterdir():
        if file.suffix in ('.c','.h'):
            check('full appendix: '+file.name,file.read_text(encoding='utf-8').strip() in blocks)
    chapter=(list(DRAFT.glob('52-*.md')) or list(SOURCE.glob('52-*.md')))[0]
    blocks=[s.strip() for s in re.findall(r'```c\n(.*?)\n```',chapter.read_text(encoding='utf-8'),re.S)]
    check('chapter app module matches source',(APP/'app.c').read_text(encoding='utf-8').strip() in blocks)

def main(args):
    version=process([args.cc,'--version']); check('compiler starts',version.returncode==0,version.stderr)
    environment['compiler']=version.stdout.splitlines()[0]
    compatibility=['-D__USE_MINGW_ANSI_STDIO=1'] if os.name=='nt' and '8.1.0' in environment['compiler'] else []
    environment['flags']=['-std=c17','-Wall','-Wextra','-Wpedantic','-Werror','-O0',*compatibility]
    if not args.runtime_only: prose()
    temp_root=Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage9b-',dir=temp_root) as directory:
        work=Path(directory).resolve()
        check('temporary cleanup confined',work.parent==temp_root and work.name.startswith('dsa-stage9b-'))
        includes=['-I',HERE]
        for name in INCLUDE: includes += ['-I',EXAMPLES/name]
        flags=[*environment['flags'],*includes]
        serial=0
        def build(label, files):
            nonlocal serial
            serial+=1
            exe=work/('case'+str(serial)+('.exe' if os.name=='nt' else ''))
            result=process([args.cc,*flags,*files,'-o',exe],work)
            check('compile: '+label,result.returncode==0,result.stderr)
            return exe
        libs=[EXAMPLES/f for f in FILES]
        exe=build('planner CLI',[APP/'main.c',*libs])
        catalog=(APP/'catalog.txt').read_text(encoding='utf-8')
        relations=(APP/'relations.txt').read_text(encoding='utf-8')
        cp=work/'catalog.txt'; rp=work/'relations.txt'
        def cli(label,commands,expected='',error='',status=0,cat=catalog,rel=relations):
            cp.write_bytes(cat.encode('utf-8') if isinstance(cat,str) else cat)
            rp.write_bytes(rel.encode('utf-8') if isinstance(rel,str) else rel)
            result=process([exe,cp,rp,*commands],work)
            check('CLI: '+label,result.returncode==status and result.stdout==expected and result.stderr==error,
                  repr((result.returncode,result.stdout,result.stderr)))
            return result
        listing='id=9999 minutes=15 title=Graphs\nid=9 minutes=20 title=Pointers\nid=0 minutes=30 title=C basics\nid=17 minutes=30 title=Arrays\n'
        cli('check',['check'],'records=4 categories=3 study=4 places=4\n')
        cli('stable view',['list'],listing)
        cli('ID zero',['find','0'],'id=0 minutes=30 title=C basics\n')
        cli('sparse ID',['find','9999'],'id=9999 minutes=15 title=Graphs\n')
        cli('title matching',['title','C'],'id=0 minutes=30 title=C basics\n')
        cli('no matches',['title','none'],'no matches\n')
        original='id=0 minutes=30 title=C basics\nid=17 minutes=30 title=Arrays\nid=9 minutes=20 title=Pointers\nid=9999 minutes=15 title=Graphs\n'
        cli('empty pattern',['title',''],original)
        cli('classification',['categories'],'category=0 label=Basics\n  id=0 minutes=30 title=C basics\n  category=7 label=Algorithms\n    id=17 minutes=30 title=Arrays\n    id=9 minutes=20 title=Pointers\n    id=9999 minutes=15 title=Graphs\n  category=42 label=Empty category\n')
        cli('topological ID mapping',['order'],'order=0,9,17,9999\n')
        cli('ready initially',['ready'],'ready=0\n')
        cli('ready after root',['ready','0'],'ready=9,17\n')
        cli('ready after prerequisites',['ready','0','17','9'],'ready=9999\n')
        cli('all finished',['ready','0','17','9','9999'],'ready=empty\n')
        cli('zero road and mapping',['route','0','202'],'cost=5 path=0,101,202\n')
        cli('reverse road',['route','202','0'],'cost=5 path=202,101,0\n')
        cli('self route',['route','0','0'],'cost=0 path=0\n')
        cli('unreachable',['route','0','9999'],'unreachable\n')
        cli('export',['export'],catalog)
        updated=catalog.replace('0\n30\nC basics','0\n20\nC basics')
        cli('minutes/export',['minutes','0','20'],updated)
        cli('reload updated',['list'],listing.replace('id=9 minutes=20 title=Pointers\nid=0 minutes=30 title=C basics','id=0 minutes=20 title=C basics\nid=9 minutes=20 title=Pointers'),cat=updated)
        empty='DSA-CATALOG-1\n'; empty_rel='DSA-RELATIONS-1\n'
        for command,expected in [(['check'],'records=0 categories=0 study=0 places=0\n'),(['list'],'no matches\n'),(['categories'],'empty categories\n'),(['order'],'order=empty\n'),(['ready'],'ready=empty\n'),(['export'],empty)]:
            cli('empty '+command[0],command,expected,cat=empty,rel=empty_rel)
        cli('CRLF',['check'],'records=4 categories=3 study=4 places=4\n',cat=catalog.replace('\n','\r\n'),rel=relations.replace('\n','\r\n'))
        cli('no final newline',['check'],'records=4 categories=3 study=4 places=4\n',cat=catalog.rstrip('\n'),rel=relations.rstrip('\n'))
        cli('UTF-8 labels',['categories'],'category=0 label=基础\n  id=0 minutes=0 title=C语言\n',cat='DSA-CATALOG-1\n0\n0\nC语言\n',rel='DSA-RELATIONS-1\nC|0|-1|基础\nM|0|0\n')
        bad_commands=[(['find','2'],'missing reference or item'),(['find','-1'],'bad format'),(['find','10000'],'limit exceeded'),(['find','x'],'bad format'),(['minutes','0','1441'],'limit exceeded'),(['ready','9999'],'invalid argument'),(['ready','0','0'],'duplicate item'),(['ready','44'],'missing reference or item'),(['route','0','44'],'missing reference or item'),(['title','a'*65],'limit exceeded')]
        for commands,error in bad_commands:
            cli('invalid arguments '+str(commands[:2]),commands,error='planner: '+error+'\n',status=1)
        bad_relations=[('bad header',relations.replace('DSA-RELATIONS-1','DSA-RELATIONS-2'),'bad format'),
            ('BOM','\ufeff'+relations,'bad format'),('blank line',relations+'\n','bad format'),
            ('unknown tag',relations+'X|0\n','bad format'),('field count',relations.replace('S|9999','S|9999|x'),'bad format'),
            ('phase order',relations+'C|55|-1|late\n','bad format'),('NUL',relations.replace('Basics','Basic\x00s'),'bad format'),
            ('bare CR',relations+'\r','bad format'),('oversized line',relations+'X'*128+'\n','limit exceeded'),
            ('category duplicate',relations.replace('C|42|0|Empty category','C|7|0|Empty category'),'duplicate item'),
            ('parent missing',relations.replace('C|7|0|','C|7|8|'),'missing reference or item'),
            ('class cycle',relations.replace('C|0|-1|','C|0|7|'),'cycle'),
            ('multiple roots',relations.replace('C|7|0|','C|7|-1|'),'invalid argument'),
            ('membership absent',relations.replace('M|9|7\n',''),'missing reference or item'),
            ('membership duplicate',relations.replace('M|9|7','M|17|7'),'duplicate item'),
            ('unknown membership record',relations.replace('M|9|7','M|8|7'),'missing reference or item'),
            ('unknown class',relations.replace('M|9|7','M|9|8'),'missing reference or item'),
            ('study duplicate',relations.replace('S|17','S|0'),'duplicate item'),
            ('study missing record',relations.replace('S|17','S|8'),'missing reference or item'),
            ('missing dependency endpoint',relations.replace('D|0|17','D|0|8'),'missing reference or item'),
            ('dependency duplicate',relations.replace('D|0|9','D|0|17'),'duplicate item'),
            ('dependency cycle',relations.replace('D|0|17','D|9999|0'),'cycle'),
            ('dependency self',relations.replace('D|0|17','D|0|0'),'cycle'),
            ('place duplicate',relations.replace('P|101|Gate','P|0|Gate'),'duplicate item'),
            ('negative road',relations.replace('R|101|202|5','R|101|202|-1'),'bad format'),
            ('road too large',relations.replace('R|101|202|5','R|101|202|1001'),'limit exceeded'),
            ('reverse duplicate road',relations+'R|101|0|0\n','duplicate item'),
            ('road missing endpoint',relations.replace('R|0|202|9','R|0|99|9'),'missing reference or item'),
            ('label too long',relations.replace('Basics','a'*32),'limit exceeded'),
            ('empty label',relations.replace('Basics',''),'bad format'),
            ('control label',relations.replace('Basics','Ba\tsics'),'bad format'),
            ('numeric space',relations.replace('S|9999','S| 9999'),'bad format'),
            ('numeric overflow',relations.replace('S|9999','S|999999999999999999'),'limit exceeded')]
        for label,rel,error in bad_relations:
            cli(label,['check'],error='planner: '+error+'\n',status=1,rel=rel)
        for label,cat,error in [('catalog header',catalog.replace('DSA-CATALOG-1','BAD'),'bad format'),('duplicate catalog ID',catalog.replace('17\n30\nArrays','0\n30\nArrays'),'duplicate item'),('title too long',catalog.replace('C basics','a'*64),'bad format'),('negative minutes',catalog.replace('0\n30\nC basics','0\n-1\nC basics'),'bad format'),('truncated catalog','DSA-CATALOG-1\n0\n30\n','bad format')]:
            cli(label,['check'],error='planner: '+error+'\n',status=1,cat=cat)
        maxcat='DSA-CATALOG-1\n'+''.join(f'{i}\n1440\n'+('a'*63)+'\n' for i in range(32))
        maxrel='DSA-RELATIONS-1\n'+''.join(f'C|{i}|{i-1}|'+('a'*31)+'\n' for i in range(8))+''.join(f'M|{i}|{i%8}\n' for i in range(32))+''.join(f'S|{i}\n' for i in range(8))+''.join(f'D|{i}|{j}\n' for i in range(8) for j in range(i+1,8))+''.join(f'P|{i}|Place{i}\n' for i in range(8))+''.join(f'R|{i}|{j}|1000\n' for i in range(8) for j in range(i,8))
        cli('all capacity limits',['check'],'records=32 categories=8 study=8 places=8\n',cat=maxcat,rel=maxrel)
        for label,rel in [('ninth category',maxrel.replace('M|0|0','C|8|7|Ninth\nM|0|0')),('ninth study',maxrel.replace('D|0|1','S|8\nD|0|1')),('ninth place',maxrel.replace('R|0|0|1000','P|8|Ninth\nR|0|0|1000'))]:
            cli(label,['check'],error='planner: limit exceeded\n',status=1,cat=maxcat,rel=rel)
        cli('thirty-third record',['check'],error='planner: limit exceeded\n',status=1,cat=maxcat+'32\n0\nExtra\n',rel=maxrel)
        for arguments in [[],[cp,rp],[cp,rp,'unknown'],[cp,rp,'find'],[cp,rp,'check','extra'],[cp,rp,'ready',*['0']*9]]:
            result=process([exe,*arguments],work)
            check('CLI: usage '+str(len(arguments)),result.returncode==1 and result.stdout=='' and result.stderr.startswith('usage: planner '),repr((result.returncode,result.stdout,result.stderr)))
        cp.write_text(catalog,encoding='utf-8'); rp.write_text(relations,encoding='utf-8')
        model=build('independent integration models',[HERE/'planner-models.c',HERE/'planner-test.c',*libs])
        result=process([model],work)
        check('integration models',result.returncode==0 and result.stderr=='',repr((result.returncode,result.stdout,result.stderr)))
        summary=re.fullmatch(r'dependency_graphs=512 ready_cases=200 route_graphs=64 route_queries=576 category_cases=701 reload=1 sort_comparisons=(\d+) sort_writes=(\d+)\n',result.stdout)
        check('model summary',bool(summary),result.stdout)
        metrics.update(dependencyGraphs=512,readyCases=200,routeGraphs=64,routeQueries=576,categoryCases=701)
        metrics.update(stableSampleComparisons=int(summary[1]),stableSampleWrites=int(summary[2]))
        instrument=['-include',HERE/'planner-test.h', '-Dmalloc=p_malloc','-Dcalloc=p_calloc','-Drealloc=p_realloc','-Dfree=p_free',
                    '-Dfgetc=p_fgetc','-Dferror=p_ferror','-Dfopen=p_fopen','-Dfclose=p_fclose']
        objects=[]
        for i,file in enumerate(libs):
            obj=work/f'fault{i}.o'
            target=file
            if file == EXAMPLES/'stage2-catalog/catalog.c':
                target=work/'instrumented_catalog.c'
                text=file.read_text(encoding='utf-8').replace('fprintf(', 'p_fprintf(').replace('fflush(', 'p_fflush(')
                target.write_text(text,encoding='utf-8')
            result=process([args.cc,'-I',file.parent,*flags,*instrument,'-c',target,'-o',obj],work)
            check('instrument: '+file.name+' '+str(i),result.returncode==0,result.stderr); objects.append(obj)
        faults=build('controlled allocation and I/O failures',[HERE/'planner-faults.c',HERE/'planner-test.c',*objects])
        result=process([faults,cp,rp],work)
        check('fault model',result.returncode==0 and result.stderr=='',repr((result.returncode,result.stdout,result.stderr)))
        values=dict(re.findall(r'(\w+)=(\d+)',result.stdout))
        check('fault summary',int(values.get('load_failure_positions','0'))>=5 and int(values.get('export_failure_positions','0'))>=1 and values.get('io_cases')=='10' and values.get('live')=='0' and values.get('streams')=='0',result.stdout)
        metrics.update({k:int(v) for k,v in values.items()})
        metrics['cliCases']=sum(c['name'].startswith('CLI:') for c in checks)
        mutants=[('failed load replaces old app','app.c','if (status == P_OK) { swap_owners(out, &candidate); }','if (status != P_INVALID) { swap_owners(out, &candidate); }'),
                 ('ready leaks positions','query.c','next.ids[next.count++] = job.id;','next.ids[next.count] = (int)next.count; next.count++;'),
                 ('route leaks positions','query.c','next.ids[i] = app->places[path.vertices[i]].id;','next.ids[i] = (int)path.vertices[i];'),
                 ('ready ignores closure','query.c','if (app->study.has[u][v] && finished[v] && !finished[u]) { return P_INVALID; }','if (app->study.has[u][v] && finished[v] && !finished[u]) { (void)u; }')]
        for label,file,before,after in mutants:
            original=APP/file; text=original.read_text(encoding='utf-8'); check('mutant target: '+label,before in text)
            wrong=work/('wrong_'+file); wrong.write_text(text.replace(before,after,1),encoding='utf-8')
            mutated=build('safe mutant: '+label,[HERE/'planner-models.c',HERE/'planner-test.c',*[wrong if p==original else p for p in libs]])
            result=process([mutated],work)
            check('oracle detects: '+label,result.returncode!=0 and 'planner oracle failed' in result.stderr,repr((result.returncode,result.stderr)))
        metrics['detectedSafeMutations']=len(mutants)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--cc',default='gcc'); parser.add_argument('--runtime-only',action='store_true'); args=parser.parse_args()
    error=''
    try: main(args)
    except Exception as exc: error=str(exc)
    report={'date':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'passed':not error,'checks':len(checks),'programGroups':1,'runtimeOnly':args.runtime_only,'environment':environment,'metrics':metrics,'error':error,'results':checks}
    target=COURSE/'stage9b-runtime-checks.json' if args.runtime_only else HERE/'第九阶段下检查结果.json'
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=True)); raise SystemExit(1 if error else 0)
