"""Stage4 prose/source, model histories, allocation failure and application checks."""
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent
COURSE=SOURCE.parent
EXAMPLES=SOURCE/'示例代码'
DRAFT=COURSE/'drafts/stage4'
FOLDERS=['stage4-common','21-sequence','22-vector','23-singly','24-doubly','25-stack','26-queue','stage4-expression']
checks=[]
environment={}
metrics={}

def check(name,condition,detail=''):
    checks.append({'name':name,'passed':bool(condition),'detail':detail[:1600] if not condition else ''})
    if not condition: raise AssertionError(name+': '+detail[:1600])

def process(args,data=None,cwd=None):
    return subprocess.run(list(map(str,args)),input=data,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=30,cwd=cwd,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cc',default='gcc')
    args=parser.parse_args()
    version=process([args.cc,'--version'])
    check('compiler starts',version.returncode==0,version.stderr)
    environment['compiler']=version.stdout.splitlines()[0]
    compat=['-D__USE_MINGW_ANSI_STDIO=1'] if os.name=='nt' and '8.1.0' in environment['compiler'] else []
    environment['compatibilityFlags']=compat
    for doc in list(SOURCE.rglob('*.md'))+list(DRAFT.glob('*.md')):
        text=doc.read_text(encoding='utf-8')
        check('resolved sources: '+doc.name,'@@EXAMPLE:' not in text)
        if re.match(r'2[1-6]-',doc.name):
            for word in ['目标与先修','常见错误','练习与参考答案','完成条件']:
                check(doc.name+': '+word,word in text)
        base=SOURCE if doc.parent==DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',link) or link.startswith('#'): continue
            target=(base/link.split('#')[0]).resolve()
            exists=target.exists() or (target.parent==SOURCE and (DRAFT/target.name).exists())
            check('link: '+doc.name+' -> '+link,target.is_relative_to(COURSE) and exists)
    appendix=(EXAMPLES/'stage4-common/完整源码.md').read_text(encoding='utf-8')
    blocks=[b.strip() for b in re.findall(r'```c\n(.*?)\n```',appendix,re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES/folder).glob('*'):
            if file.suffix in ['.c','.h']:
                check('appendix source match: '+folder+'/'+file.name,file.read_text(encoding='utf-8').strip() in blocks)
    mapping={'21':['stage4-common/ds_status.h','21-sequence/sequence.h','21-sequence/sequence.c'],
             '22':['22-vector/vector.h','22-vector/vector.c'],'23':['23-singly/singly.h','23-singly/singly.c'],
             '24':['24-doubly/doubly.h','24-doubly/doubly.c'],
             '25':['25-stack/stack.h','25-stack/stack.c','25-stack/brackets.c'],
             '26':['26-queue/queue.h','26-queue/queue.c'],
             'answer':['stage4-expression/expression.h','stage4-expression/expression.c']}
    for key,files in mapping.items():
        if key=='answer': doc=next(p for p in [DRAFT/'第四阶段-参考答案.md',SOURCE/'第四阶段-参考答案.md'] if p.exists())
        else: doc=(list(DRAFT.glob(key+'-*.md')) or list(SOURCE.glob(key+'-*.md')))[0]
        found=[b.strip() for b in re.findall(r'```c\n(.*?)\n```',doc.read_text(encoding='utf-8'),re.S)]
        for name in files: check('chapter complete source: '+name,(EXAMPLES/name).read_text(encoding='utf-8').strip() in found)

    temp_root=Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage4-',dir=temp_root) as folder:
        work=Path(folder).resolve()
        check('temporary cleanup confined',work.parent==temp_root and work.name.startswith('dsa-stage4-'))
        includes=[]
        for directory in [HERE,*[EXAMPLES/f for f in FOLDERS]]: includes+=['-I',directory]
        flags=['-std=c17','-Wall','-Wextra','-Wpedantic','-Werror','-O0',*compat,*includes]
        serial=0
        def build(label,files):
            nonlocal serial
            serial+=1
            exe=work/(f'case{serial}.exe' if os.name=='nt' else f'case{serial}')
            result=process([args.cc,*flags,*files,'-o',exe],cwd=work)
            check('compile: '+label,result.returncode==0,result.stderr)
            return exe
        def run(label,exe,expected='',arguments=None,error='',status=0):
            result=process([exe,*(arguments or [])],cwd=work)
            check(label,result.returncode==status and result.stdout==expected and result.stderr==error,
                  repr({'status':result.returncode,'out':result.stdout,'err':result.stderr,'expected':[status,expected,error]}))
            return result

        libs={'sequence':EXAMPLES/'21-sequence/sequence.c','vector':EXAMPLES/'22-vector/vector.c',
              'singly':EXAMPLES/'23-singly/singly.c','doubly':EXAMPLES/'24-doubly/doubly.c',
              'stack':EXAMPLES/'25-stack/stack.c','queue':EXAMPLES/'26-queue/queue.c'}
        expected={'sequence':'removed=10 count=2\n[0]=20\n[1]=30\n',
                  'vector':'doubling count=17 capacity=32 copy_model=28\nexact count=17 capacity=17 copy_model=136\n',
                  'singly':'removed=10 count=2\n[0]=20\n[1]=30\n',
                  'doubly':'forward=10\nforward=20\nforward=30\nbackward=30\nbackward=20\nbackward=10\nremoved=20 count=2\n',
                  'stack':'array_pop=20 linked_pop=20\n',
                  'queue':'first=10,10\nnext=20,20\nnext=30,30\nnext=40,40\nlinked_empty=1\n'}
        for key,file in libs.items(): run('normal demo: '+key,build(key,[file.parent/'main.c',file]),expected[key])
        bracket_exe=build('brackets',[EXAMPLES/'25-stack/brackets_main.c',EXAMPLES/'25-stack/brackets.c',libs['stack']])
        expression_exe=build('expression',[EXAMPLES/'stage4-expression/main.c',EXAMPLES/'stage4-expression/expression.c',libs['stack'],libs['queue']])
        for text in ['', 'abc','()','([])','({[]})','('*16+')'*16,'x'*256]:
            run('brackets valid '+text[:20],bracket_exe,'ok\n',[text])
        for text,kind,position in [(')', 'mismatch',0),('([)]','mismatch',2),('[(','unclosed',0),('abc(','unclosed',3),('[(]','mismatch',2),('a[b(c','unclosed',1),('"("','unclosed',1),('('*17+')'*17,'depth',16),('x'*257,'length',256),(')'+'x'*256,'length',256)]:
            run('brackets diagnostic '+text[:20],bracket_exe,arguments=[text],error=f'{kind} position={position}\n',status=1)
        run('brackets usage',bracket_exe,error='usage: brackets text\n',status=1)
        for text,value in [('2 3 + 4 *',20),('8 3 - 2 *',10),('2 8 -',-6),('7 2 /',3),('0 7 - 2 /',-3),('   7  ',7),('0',0),('9 9 * 9 * 9 *',6561)]:
            run('expression valid '+text,expression_exe,f'result={value}\n',[text])
        for text,kind,position in [('2 +','arity',1),('2 3','arity',2),('8 0 /','division-by-zero',2),('12 3 +','token',0),('-3 2 +','token',0),('1\t2','token',0),('9 9 * 9 * 9 * 9 *','range',8),('0 9 - 9 * 9 * 9 * 9 *','range',10),(' '.join(['1']*17),'capacity',16),('','arity',0),('   ','arity',0),(' '*128,'length',0),('1 (','token',1)]:
            run('expression diagnostic '+text[:24],expression_exe,arguments=[text],error=f'expression: {kind} token={position}\n',status=1)
        run('expression usage',expression_exe,error='usage: expression quoted-postfix\n',status=1)

        objects={}
        hooks=['-Dmalloc=s4_malloc','-Drealloc=s4_realloc','-Dfree=s4_free']
        for key,file in libs.items():
            obj=work/(key+'.o')
            result=process([args.cc,*flags,*hooks,'-c',file,'-o',obj],cwd=work)
            check('compile controlled allocator: '+key,result.returncode==0,result.stderr)
            objects[key]=obj
        models=build('model histories and failure audit',[HERE/'stage4-models.c',HERE/'stage4-alloc.c',*objects.values()])
        run('model traces, invariants and allocation failure',models,'list_steps=20000 end_steps=57000 allocation_failures=47 live=0\n')
        apps=build('application finite comparisons',[HERE/'stage4-apps.c',HERE/'stage4-alloc.c',objects['stack'],objects['queue'],EXAMPLES/'25-stack/brackets.c',EXAMPLES/'stage4-expression/expression.c'])
        run('bracket reduction and expression tree oracles',apps,'bracket_words=97656 expression_trees=81920 live=0\n')
        metrics.update(listModelSteps=20000,stackQueueModelSteps=57000,controlledAllocationFailures=47,bracketWords=97656,expressionTrees=81920,finalTrackedAllocations=0)

        wrong=work/'wrong_sequence.c'
        wrong.write_text(libs['sequence'].read_text(encoding='utf-8').replace('list->data[position] = value;','list->data[position] = value + 1;'),encoding='utf-8')
        obj=work/'wrong_sequence.o'
        result=process([args.cc,*flags,*hooks,'-c',wrong,'-o',obj],cwd=work)
        check('compile safe value-corruption variant',result.returncode==0,result.stderr)
        wrong_model=build('detect sequence corruption',[HERE/'stage4-models.c',HERE/'stage4-alloc.c',obj,*[v for k,v in objects.items() if k!='sequence']])
        result=process([wrong_model],cwd=work)
        check('model oracle detects value corruption',result.returncode==1 and 'list value' in result.stderr,result.stdout+result.stderr)
        wrong=work/'wrong_expression.c'
        wrong.write_text((EXAMPLES/'stage4-expression/expression.c').read_text(encoding='utf-8').replace('(long)left - right','(long)right - left'),encoding='utf-8')
        wrong_app=build('detect operand-order corruption',[EXAMPLES/'stage4-expression/main.c',wrong,libs['stack'],libs['queue']])
        result=process([wrong_app,'8 3 -'],cwd=work)
        check('operand oracle detects left-right confusion',result.returncode==0 and result.stdout=='result=-5\n')

if __name__=='__main__':
    passed=False; error=''
    try: main(); passed=True
    except Exception as exc: error=str(exc)
    payload={'date':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'passed':passed,'checks':len(checks),'programGroups':8,
             'environment':environment,'metrics':metrics,'error':error,'results':checks}
    (HERE/'第四阶段检查结果.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k!='results'},ensure_ascii=True))
    raise SystemExit(0 if passed else 1)
