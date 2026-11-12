"""Stage6 actual builds, tagged-record oracles, operation counts and allocation failure checks."""
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
DRAFT = COURSE / 'drafts/stage6'
FOLDERS = ['stage6-common','31-basic-sort','32-insertion-shell','33-merge','34-quick','35-distribution','stage6-lab','stage6-catalog']
checks, environment, metrics = [], {}, {}
def check(name, condition, detail=''):
    checks.append({'name':name,'passed':bool(condition),'detail':detail[:1600] if not condition else ''})
    if not condition: raise AssertionError(name+': '+detail[:1600])
def process(args, cwd=None):
    return subprocess.run(list(map(str,args)), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=45, cwd=cwd,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
def prose():
    for doc in list(SOURCE.rglob('*.md'))+list(DRAFT.glob('*.md')):
        text=doc.read_text(encoding='utf-8')
        check('resolved embeds: '+doc.name,'@@EXAMPLE:' not in text)
        if re.match(r'3[1-6]-',doc.name):
            for term in ['目标与先修','常见错误','练习与参考答案','完成条件']:
                check(doc.name+': '+term,term in text)
            check(doc.name+': sections',len(re.findall(r'^## ',text,re.M))>=10)
        base=SOURCE if doc.parent==DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',link) or link.startswith('#'): continue
            target=(base/link.split('#')[0]).resolve()
            exists=target.exists() or (target.parent==SOURCE and (DRAFT/target.name).exists())
            check('local link: '+doc.name+' -> '+link,target.is_relative_to(COURSE) and exists)
    appendix=(EXAMPLES/'stage6-common/完整源码.md').read_text(encoding='utf-8')
    blocks=[b.strip() for b in re.findall(r'```c\n(.*?)\n```',appendix,re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES/folder).glob('*'):
            if file.suffix in ['.c','.h']: check('appendix: '+folder+'/'+file.name,file.read_text(encoding='utf-8').strip() in blocks)
    mapping={'31':['stage6-common/sort_common.c','31-basic-sort/basic.c'],
             '32':['32-insertion-shell/insertion_shell.c'],'33':['33-merge/merge.c'],
             '34':['34-quick/quick.c'],'35':['35-distribution/distribution.c'],'36':['stage6-catalog/view.c']}
    for chapter,files in mapping.items():
        doc=(list(DRAFT.glob(chapter+'-*.md')) or list(SOURCE.glob(chapter+'-*.md')))[0]
        blocks=[b.strip() for b in re.findall(r'```c\n(.*?)\n```',doc.read_text(encoding='utf-8'),re.S)]
        for file in files: check('chapter full source: '+file,(EXAMPLES/file).read_text(encoding='utf-8').strip() in blocks)
def main(args):
    result=process([args.cc,'--version'])
    check('compiler starts',result.returncode==0,result.stderr)
    environment['compiler']=result.stdout.splitlines()[0]
    compat=['-D__USE_MINGW_ANSI_STDIO=1'] if os.name=='nt' and '8.1.0' in environment['compiler'] else []
    environment['flags']=['-std=c17','-Wall','-Wextra','-Wpedantic','-Werror','-O0',*compat]
    if not args.runtime_only: prose()
    temp_root=Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage6-',dir=temp_root) as folder:
        work=Path(folder).resolve()
        check('temporary cleanup confined',work.parent==temp_root and work.name.startswith('dsa-stage6-'))
        includes=[]
        for directory in [HERE,*[EXAMPLES/f for f in FOLDERS],EXAMPLES/'stage5-common',EXAMPLES/'27-matching',EXAMPLES/'29-open-addressing']:
            includes+=['-I',directory]
        flags=[*environment['flags'],*includes]
        serial=0
        def build(label,files):
            nonlocal serial
            serial+=1
            exe=work/(f'case{serial}.exe' if os.name=='nt' else f'case{serial}')
            result=process([args.cc,*flags,*files,'-o',exe],work)
            check('compile: '+label,result.returncode==0,result.stderr)
            return exe
        def run(label,exe,expected,arguments=(),error='',status=0):
            result=process([exe,*arguments],work)
            check(label,result.returncode==status and result.stdout==expected and result.stderr==error,repr((result.returncode,result.stdout,result.stderr)))
            return result
        libs={'common':EXAMPLES/'stage6-common/sort_common.c','basic':EXAMPLES/'31-basic-sort/basic.c',
              'insertion':EXAMPLES/'32-insertion-shell/insertion_shell.c','merge':EXAMPLES/'33-merge/merge.c',
              'quick':EXAMPLES/'34-quick/quick.c','distribution':EXAMPLES/'35-distribution/distribution.c'}
        demos=[('31-basic-sort','basic','selection comparisons=3 writes=2\n1:12 2:11 2:10\nbubble comparisons=3 writes=4\n1:12 2:10 2:11\n'),
               ('32-insertion-shell','insertion','insertion-sorted comparisons=3 writes=3\n1:0 2:1 3:2 4:3\ninsertion-reverse comparisons=6 writes=9\n1:3 2:2 3:1 4:0\nshell comparisons=5 writes=6\n1:12 2:11 2:10 2:13\n'),
               ('33-merge','merge','merge comparisons=8 writes=24\n1:1 1:3 2:2 3:0 3:4\n'),
               ('34-quick','quick','quick comparisons=3 writes=2\n1:12 2:11 2:10\nquick-equal comparisons=4 writes=0\n5:0 5:1 5:2 5:3\n'),
               ('35-distribution','distribution','counting comparisons=0 writes=10\n-9:0 -9:2 0:3 4:1 12:4\nbucket comparisons=3 writes=13\n-9:0 -9:2 0:3 4:1 12:4\nradix comparisons=0 writes=40\n-9:0 -9:2 0:3 4:1 12:4\n')]
        for folder,key,expected in demos:
            exe=build(folder,[EXAMPLES/folder/'main.c',libs[key],libs['common'],EXAMPLES/'stage6-common/demo.c'])
            run('documented output: '+folder,exe,expected)
        lab_files=[EXAMPLES/'stage6-lab/main.c',EXAMPLES/'stage6-lab/experiment.c',*libs.values()]
        lab=build('sort laboratory',lab_files)
        names=['selection','bubble','insertion','shell','merge','quick','counting','bucket','radix']
        for dataset in ['sorted','reverse','equal','nearly','mixed']:
            result=process([lab,'all',dataset],work)
            rows=re.findall(r'^(\w+) (\w+) n=32 comparisons=(\d+) writes=(\d+) verified=1$',result.stdout,re.M)
            check('lab all: '+dataset,result.returncode==0 and not result.stderr and [r[0] for r in rows]==names and all(r[1]==dataset for r in rows),result.stdout+result.stderr)
        run('lab insertion sorted counts',lab,'insertion sorted n=32 comparisons=31 writes=31 verified=1\n',['insertion','sorted'])
        run('lab bad algorithm',lab,'',['missing','sorted'],'unknown algorithm\n',1)
        run('lab bad dataset',lab,'',['quick','missing'],'unknown dataset\n',1)
        run('lab usage',lab,'',[],'usage: sort-lab algorithm|all dataset\n',1)
        catalog_deps=[EXAMPLES/'stage6-catalog/io.c',EXAMPLES/'stage6-catalog/view.c',EXAMPLES/'stage2-catalog/catalog.c',EXAMPLES/'stage5-indexed-catalog/catalog.c',EXAMPLES/'29-open-addressing/open_map.c',EXAMPLES/'27-matching/matching.c',libs['merge'],libs['common']]
        catalog=build('catalog v0.3', [EXAMPLES/'stage6-catalog/main.c',*catalog_deps])
        sample=EXAMPLES/'stage6-catalog/sample.txt'
        text=sample.read_text(encoding='utf-8')
        run('stable catalog view',catalog,'id=3 minutes=20 title=Arrays\nid=17 minutes=30 title=C basics\nid=9 minutes=30 title=Queues\nid=1 minutes=45 title=Pointers in C\n',['view',sample])
        run('query ID',catalog,'id=9 minutes=30 title=Queues\n',['find',sample,'9'])
        run('query title',catalog,'id=17 minutes=30 title=C basics\nid=1 minutes=45 title=Pointers in C\n',['title',sample,'C'])
        run('save original order',catalog,text,['save',sample])
        changed=run('update before save',catalog,text.replace('1\n45\nPointers','1\n30\nPointers'),['save',sample,'1','30'])
        exported=work/'exported.txt'; exported.write_text(changed.stdout,encoding='utf-8',newline='\n')
        run('reload updated query',catalog,'id=1 minutes=30 title=Pointers in C\n',['find',exported,'1'])
        run('reload stable three ties',catalog,'id=3 minutes=20 title=Arrays\nid=17 minutes=30 title=C basics\nid=1 minutes=30 title=Pointers in C\nid=9 minutes=30 title=Queues\n',['view',exported])
        removed=run('delete canonical output',catalog,text.replace('17\n30\nC basics\n',''),['remove',sample,'17'])
        exported.write_text(removed.stdout,encoding='utf-8',newline='\n')
        run('reload after delete index',catalog,'id=9 minutes=30 title=Queues\n',['find',exported,'9'])
        run('missing query',catalog,'',['find',sample,'9999'],'v3: not found\n',1)
        run('invalid minutes',catalog,'',['save',sample,'1','1441'],'v3: invalid arguments\n',1)
        run('invalid key',catalog,'',['find',sample,'-1'],'v3: invalid arguments\n',1)
        run('over title budget',catalog,'',['title',sample,'x'*65],'v3: invalid arguments\n',1)
        run('missing input',catalog,'',['view',work/'missing.txt'],'v3: open failed\n',1)
        malformed=work/'malformed.txt'; malformed.write_text('DSA-CATALOG-1\n1\n30\n',encoding='utf-8')
        run('truncated data',catalog,'',['view',malformed],'v3: invalid data\n',1)
        hooks=['-Dmalloc=s6_malloc','-Dcalloc=s6_calloc','-Drealloc=s6_realloc','-Dfree=s6_free']
        hooked={'merge':libs['merge'],'distribution':libs['distribution'],'open':EXAMPLES/'29-open-addressing/open_map.c','legacy':EXAMPLES/'stage2-catalog/catalog.c'}
        objects={}
        for key,file in hooked.items():
            obj=work/(key+'.o'); result=process([args.cc,*flags,*hooks,'-c',file,'-o',obj],work)
            check('compile allocation hook: '+key,result.returncode==0,result.stderr); objects[key]=obj
        model_base=[HERE/'stage6-models.c',HERE/'stage6-alloc.c',EXAMPLES/'stage6-lab/experiment.c',libs['common'],libs['basic'],libs['insertion'],libs['quick'],EXAMPLES/'stage6-catalog/io.c',EXAMPLES/'stage6-catalog/view.c',EXAMPLES/'stage5-indexed-catalog/catalog.c']
        model=build('model, reference sort and failure audit',[*model_base,*objects.values()])
        result=process([model],work)
        match=re.fullmatch(r'sort_runs=(\d+) catalog_roundtrips=(\d+) allocation_failures=(\d+) live=0\n',result.stdout)
        check('record oracles and allocation failures',result.returncode==0 and not result.stderr and match is not None,result.stdout+result.stderr)
        metrics.update(sortRuns=int(match[1]),catalogRoundtrips=int(match[2]),controlledAllocationFailures=int(match[3]),finalTrackedAllocations=0)
        check('expected finite coverage',metrics['sortRuns']==93123 and metrics['catalogRoundtrips']==33 and metrics['controlledAllocationFailures']>=10)
        mutations=[('merge equal keys choose right', 'merge', 'stats) <= 0)', 'stats) < 0)'),
                   ('bubble descending', 'basic', '&stats) > 0)', '&stats) < 0)'),
                   ('counting loses payload identities', 'distribution', 'sort_write(work, next[key]++, a[i], &stats);','sort_write(work, next[key]++, a[0], &stats);')]
        for label,key,before,after in mutations:
            file=libs[key]; text=file.read_text(encoding='utf-8'); check('mutation target: '+label,before in text)
            wrong=work/('wrong_'+key+'.c'); wrong.write_text(text.replace(before,after),encoding='utf-8')
            changed_base=[f for f in model_base if f!=file]
            changed_objects=[f for k,f in objects.items() if k!=key]
            if key in objects:
                obj=work/('wrong_'+key+'.o'); result=process([args.cc,*flags,*hooks,'-c',wrong,'-o',obj],work)
                check('compile wrong allocation module: '+key,result.returncode==0,result.stderr); changed_objects.append(obj)
            else: changed_base.append(wrong)
            exe=build('safe mutant: '+label,[*changed_base,*changed_objects]); result=process([exe],work)
            check('oracle detects: '+label,result.returncode==1 and result.stderr.startswith('FAIL '),result.stdout+result.stderr)
        metrics['detectedSafeMutations']=3

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--cc',default='gcc'); parser.add_argument('--runtime-only',action='store_true'); args=parser.parse_args()
    passed,error=False,''
    try: main(args); passed=True
    except Exception as exc: error=str(exc)
    payload={'date':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'passed':passed,'checks':len(checks),'programGroups':7,'runtimeOnly':args.runtime_only,'environment':environment,'metrics':metrics,'error':error,'results':checks}
    target=COURSE/'stage6-runtime-checks.json' if args.runtime_only else HERE/'第六阶段检查结果.json'
    target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k!='results'},ensure_ascii=True)); raise SystemExit(0 if passed else 1)
