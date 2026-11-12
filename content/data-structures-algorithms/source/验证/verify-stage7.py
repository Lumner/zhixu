"""Stage7 prose consistency, tree/priority models, Huffman optimality and bounded failures."""
import argparse
from datetime import datetime,timezone,timedelta
import json,os,re,subprocess,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent; SOURCE=HERE.parent; COURSE=SOURCE.parent; EXAMPLES=SOURCE/'示例代码'; DRAFT=COURSE/'drafts/stage7'
FOLDERS=['stage7-common','37-binary-tree','38-traversal','39-bst','40-avl','41-heap','42-huffman']
checks,environment,metrics=[],{},{}
def check(name,condition,detail=''):
    checks.append({'name':name,'passed':bool(condition),'detail':detail[:1600] if not condition else ''})
    if not condition: raise AssertionError(name+': '+detail[:1600])
def process(args,cwd=None):
    return subprocess.run(list(map(str,args)),capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45,cwd=cwd,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
def prose():
    for doc in list(SOURCE.rglob('*.md'))+list(DRAFT.glob('*.md')):
        text=doc.read_text(encoding='utf-8');check('resolved embeds: '+doc.name,'@@EXAMPLE:' not in text)
        if re.match(r'(3[7-9]|4[0-2])-',doc.name):
            for term in ['目标与先修','常见错误','练习与参考答案','完成条件']:check(doc.name+': '+term,term in text)
            check(doc.name+': sections',len(re.findall(r'^## ',text,re.M))>=10)
        base=SOURCE if doc.parent==DRAFT else doc.parent
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',link) or link.startswith('#'):continue
            target=(base/link.split('#')[0]).resolve();exists=target.exists() or (target.parent==SOURCE and (DRAFT/target.name).exists())
            check('local link: '+doc.name+' -> '+link,target.is_relative_to(COURSE) and exists)
    appendix=(EXAMPLES/'stage7-common/完整源码.md').read_text(encoding='utf-8');blocks=[x.strip() for x in re.findall(r'```c\n(.*?)\n```',appendix,re.S)]
    for folder in FOLDERS:
        for file in (EXAMPLES/folder).glob('*'):
            if file.suffix in ['.c','.h']:check('appendix: '+folder+'/'+file.name,file.read_text(encoding='utf-8').strip() in blocks)
    mapping={'37':['37-binary-tree/tree.c'],'38':['38-traversal/traversal.c'],'39':['39-bst/bst.c'],'40':['40-avl/avl.c'],'41':['41-heap/heap.c','41-heap/heapsort.c'],'42':['42-huffman/huffman.c']}
    for chapter,files in mapping.items():
        doc=(list(DRAFT.glob(chapter+'-*.md')) or list(SOURCE.glob(chapter+'-*.md')))[0];blocks=[x.strip() for x in re.findall(r'```c\n(.*?)\n```',doc.read_text(encoding='utf-8'),re.S)]
        for file in files:check('chapter full source: '+file,(EXAMPLES/file).read_text(encoding='utf-8').strip() in blocks)
def main(args):
    result=process([args.cc,'--version']);check('compiler starts',result.returncode==0,result.stderr);environment['compiler']=result.stdout.splitlines()[0]
    compat=['-D__USE_MINGW_ANSI_STDIO=1'] if os.name=='nt' and '8.1.0' in environment['compiler'] else []
    environment['flags']=['-std=c17','-Wall','-Wextra','-Wpedantic','-Werror','-O0',*compat]
    if not args.runtime_only:prose()
    temp_root=Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix='dsa-stage7-',dir=temp_root) as folder:
        work=Path(folder).resolve();check('temporary cleanup confined',work.parent==temp_root and work.name.startswith('dsa-stage7-'))
        includes=[]
        for directory in [HERE,*[EXAMPLES/f for f in FOLDERS],EXAMPLES/'stage6-common']:includes+=['-I',directory]
        flags=[*environment['flags'],*includes];serial=0
        def build(label,files):
            nonlocal serial
            serial+=1;exe=work/(f'case{serial}.exe' if os.name=='nt' else f'case{serial}')
            result=process([args.cc,*flags,*files,'-o',exe],work);check('compile: '+label,result.returncode==0,result.stderr);return exe
        def run(label,exe,expected):
            result=process([exe],work);check(label,result.returncode==0 and result.stdout==expected and not result.stderr,result.stdout+result.stderr);return result
        libs={'tree':EXAMPLES/'37-binary-tree/tree.c','traversal':EXAMPLES/'38-traversal/traversal.c','bst':EXAMPLES/'39-bst/bst.c','avl':EXAMPLES/'40-avl/avl.c','heap':EXAMPLES/'41-heap/heap.c','heapsort':EXAMPLES/'41-heap/heapsort.c','huffman':EXAMPLES/'42-huffman/huffman.c'}
        common=EXAMPLES/'stage6-common/sort_common.c'
        demos=[('37-binary-tree/main.c',['tree'],'nodes=5 height=3\nempty_nodes=0 empty_height=0\n'),
               ('38-traversal/main.c',['tree','traversal'],'pre=4,2,1,3,6\nin=1,2,3,4,6\npost=1,3,2,6,4\nlevel=4,2,6,1,3\npre-stack=4,2,1,3,6\nin-stack=1,2,3,4,6\npost-stack=1,3,2,6,4\n'),
               ('39-bst/main.c',['bst'],'duplicate=1\nafter-root-delete=1,2,3,5,6,7\ncontains4=0 count=6\n'),
               ('40-avl/main.c',['avl'],''.join(f'{name} root=20 height=2 left=10 right=30\n' for name in ['LL','RR','LR','RL'])),
               ('41-heap/main.c',['heap'],'priority=1 id=10\npriority=1 id=20\npriority=2 id=40\npriority=3 id=30\n'),
               ('42-huffman/main.c',['huffman'],'A=110\nB=111\nC=10\nD=0\nbits=1101111000110 cost=71\ndecoded=ABCDDA bytes=6\n')]
        for file,keys,expected in demos:
            exe=build(file,[EXAMPLES/file,*[libs[k] for k in keys]]);run('documented output: '+file,exe,expected)
        exe=build('heapsort demo',[EXAMPLES/'41-heap/sort_main.c',libs['heapsort'],common,EXAMPLES/'stage6-common/demo.c'])
        run('documented heapsort count and stability',exe,'heap-sort comparisons=3 writes=6\n1:12 2:11 2:10\n')
        objects={};hooks=['-Dmalloc=s6_malloc','-Dfree=s6_free']
        for key in ['tree','bst','avl']:
            obj=work/(key+'.o');result=process([args.cc,*flags,*hooks,'-c',libs[key],'-o',obj],work);check('compile allocation hook: '+key,result.returncode==0,result.stderr);objects[key]=obj
        model_base=[HERE/'stage7-models.c',HERE/'stage6-alloc.c',libs['traversal'],libs['heap'],libs['heapsort'],common]
        exe=build('tree and priority models',[*model_base,*objects.values()]);run('shapes, permutations, histories and failures',exe,'tree_shapes=626 permutations=5914 bst_steps=10000 heap_steps=20000 heap_sorts=10142 allocation_failures=70 live=0\n')
        exe=build('Huffman subset and parsing oracles',[HERE/'stage7-huffman.c',libs['huffman']]);run('optimality, binary messages and bit parsing',exe,'frequency_sets=364 binary_messages=5461 bit_strings=1023\n')
        metrics.update(treeShapes=626,insertionPermutations=5914,bstModelSteps=10000,heapModelSteps=20000,heapSortCases=10142,controlledAllocationFailures=70,finalTrackedAllocations=0,huffmanFrequencySets=364,huffmanBinaryMessages=5461,huffmanBitStrings=1023)
        mutations=[('successor incorrectly takes maximum','bst','while (successor->left != NULL) { successor = successor->left; }','while (successor->right != NULL) { successor = successor->right; }'),
                   ('rotation caches wrong lower height','avl','refresh(top); refresh(next);','top->height = 1; refresh(next);'),
                   ('heap equal priority reverses ID','heap','return a.id < b.id ? -1 : 1;','return a.id > b.id ? -1 : 1;'),
                   ('decoder accepts incomplete prefix','huffman','if (cursor != tree->root) { return T_INVALID; }','(void)cursor;')]
        for label,key,before,after in mutations:
            text=libs[key].read_text(encoding='utf-8');check('mutation target: '+label,before in text);wrong=work/('wrong_'+key+'.c');wrong.write_text(text.replace(before,after),encoding='utf-8')
            if key=='huffman':chosen=[HERE/'stage7-huffman.c',wrong]
            else:
                chosen=[p for p in model_base if p!=libs[key]]+[p for k,p in objects.items() if k!=key]
                if key in objects:
                    obj=work/('wrong_'+key+'.o');result=process([args.cc,*flags,*hooks,'-c',wrong,'-o',obj],work);check('compile wrong owner module: '+key,result.returncode==0,result.stderr);chosen.append(obj)
                else:chosen.append(wrong)
            exe=build('safe mutant: '+label,chosen);result=process([exe],work);check('oracle detects: '+label,result.returncode==1 and result.stderr.startswith('FAIL '),result.stdout+result.stderr)
        metrics['detectedSafeMutations']=4
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cc',default='gcc');parser.add_argument('--runtime-only',action='store_true');args=parser.parse_args();passed,error=False,''
    try:main(args);passed=True
    except Exception as exc:error=str(exc)
    payload={'date':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'passed':passed,'checks':len(checks),'programGroups':7,'runtimeOnly':args.runtime_only,'environment':environment,'metrics':metrics,'error':error,'results':checks}
    target=COURSE/'stage7-runtime-checks.json' if args.runtime_only else HERE/'第七阶段检查结果.json';target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k!='results'},ensure_ascii=True));raise SystemExit(0 if passed else 1)
