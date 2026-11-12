"""Actual chapter 21-24 programs, bounded models, real mappings and injected cleanup.
Linux/WSL only. No invalid-object access, physical-page probing or system OOM tests.
"""
from collections import deque
from pathlib import Path
import json
import os
import platform
import random
import re
import shutil
import signal
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []
programs = {}


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


if platform.system() != "Linux":
    raise SystemExit("Run inside Linux/WSL Ubuntu.")
for doc in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(21, 25)] + [SOURCE / "详写第六批-练习与参考答案.md"]:
    text = doc.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for filename, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique teaching program " + filename, filename not in programs)
        programs[filename] = code
check("12 complete teaching programs extracted", len(programs) == 12)
for name in ["paging", "replacement", "mapping"]:
    programs[name + ".c"] = (SOURCE / "示例代码" / (name + ".c")).read_text(encoding="utf-8-sig")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch06-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "memory-faults.c", root / "memory-faults.c")
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]
    wraps = ["malloc", "free", "fopen", "tmpfile", "fclose", "fgets", "ferror", "fileno", "mkstemp", "close",
             "pwrite", "pread", "mmap", "munmap", "mprotect", "msync", "sysconf"]

    def compile_program(name, code, wrapped=False, extra=()):
        file = root / (name + ".c")
        file.write_text(code, encoding="utf-8")
        command = flags + list(extra) + [str(file)]
        if wrapped:
            command += [str(root / "memory-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
        result = subprocess.run(command + ["-o", str(root / name)], cwd=root, text=True, capture_output=True, timeout=30)
        if result.returncode:
            print(result.stderr)
        check("compile " + name, result.returncode == 0)
        check("warning free " + name, not result.stderr)
        return root / name

    targets = {Path(name).stem: compile_program(Path(name).stem, code) for name, code in programs.items()}
    fault_names = ["address-regions", "proc-region", "map-modes", "map-lifetime", "mapping"]
    for name in fault_names:
        targets[name + "-faults"] = compile_program(name + "-faults", programs[name + ".c"], wrapped=True)
    targets["vm-lab-optimized"] = compile_program("vm-lab-optimized", programs["vm-lab.c"], extra=["-O2"])
    locality4 = programs["locality-pages.c"].replace("frames[2] = {-1, -1}", "frames[4] = {-1, -1, -1, -1}").replace(
        "frames[0] == page || frames[1] == page", "frames[0] == page || frames[1] == page || frames[2] == page || frames[3] == page").replace("% 2", "% 4")
    targets["locality-four"] = compile_program("locality-four", locality4)

    def run(name, args=(), status=0, output=None, env=None):
        process = subprocess.Popen([str(targets[name]), *map(str,args)], cwd=root, text=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                                   env={**os.environ,"LC_ALL":"C",**(env or {})})
        try:
            out, err = process.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL)
            process.communicate()
            raise AssertionError("timeout cleaned owned group: " + str(process.args))
        result = subprocess.CompletedProcess(process.args,process.returncode,out,err)
        check("exit " + name + "=" + str(status),result.returncode == status)
        if output is not None:
            check("stdout " + name,result.stdout == output)
        check("balanced explicit resources " + name,"LAB_UNBALANCED" not in result.stderr)
        return result

    result = run("address-regions")
    seen = []
    for label, value in [("global",10),("static",20),("automatic",30),("dynamic",40)]:
        match = re.search(r"^"+label+r"=(0x[0-9a-f]+) value="+str(value)+r"$",result.stdout,re.M)
        check("live object address and value " + label,bool(match))
        seen.append(match[1])
    check("four distinct live object addresses",len(set(seen)) == 4)
    check("actual page size queried",f"page_size={os.sysconf('SC_PAGE_SIZE')}\n" in result.stdout)
    run("proc-region",output="allocation_region=rw-p\n")
    for attempt in range(3):
        result = run("fork-address")
        match = re.fullmatch(r"child address=(0x[0-9a-f]+) value=99\nparent address=(0x[0-9a-f]+) value=10 child_exit=7\n",result.stdout)
        check("fork same VA independent values " + str(attempt),bool(match) and match[1] == match[2])

    run("paging",output="page=3 offset=1 physical=5\n")
    for address in range(16):
        for access in ["r","w"]:
            page,offset = divmod(address,4)
            if page == 3:
                status, message = 3,"unmapped_page"
            elif page == 2 and access == "w":
                status, message = 4,"write_not_allowed"
            elif page == 1:
                status, message = 5,"page_fault=not_resident"
            else:
                frame = 5 if page == 0 else 7
                status, message = 0,None
            result = run("translate-checked",[address,access],status=status)
            if message:
                check("classified translation rejection " + str(address)+access,message in result.stderr and not result.stdout)
            else:
                check("checked translation fields " + str(address)+access,
                      result.stdout == f"page={page} offset={offset} frame={frame} physical={frame*4+offset} access={access}\n")
    for args in [[],[0],[0,"x"],[-1,"r"],[16,"r"],["abc","r"],["1x","r"],["","r"],["99999999999999999999999999","r"]]:
        run("translate-checked",args,status=2,output="")
    run("walk-two-level",output="address=0 directory=0 entry=0 offset=0 physical=16\naddress=165 directory=2 entry=2 offset=5 physical=149\naddress=64 directory=1 no_table\naddress=255 directory=3 no_table\n")
    expected_tlb = "".join(f"address={a} page={a//4} tlb={event} physical={physical}\n" for a,event,physical in
                            [(0,"miss",20),(1,"hit",21),(4,"miss",8),(5,"hit",9),(8,"miss",28),(0,"miss",20),(9,"hit",29)])
    run("tlb-model",output=expected_tlb+"tlb_hits=3 tlb_misses=4 page_faults=0\n")
    refs = [1,2,3,1,4,2,5]
    fifo_frames = [(1,-1,-1),(1,2,-1),(1,2,3),(1,2,3),(4,2,3),(4,2,3),(4,5,3)]
    lru_frames = [(1,-1,-1),(1,2,-1),(1,2,3),(1,2,3),(1,4,3),(1,4,2),(5,4,2)]
    for name,states,hits,faults in [("replacement",fifo_frames,{3,5},5),("lru-trace",lru_frames,{3},6)]:
        output = "".join(f"ref={page} {'hit' if i in hits else 'fault'} frames={','.join(map(str,states[i]))}\n" for i,page in enumerate(refs))
        run(name,output=output+f"faults={faults}\n")
    clock_states = [((1,-1,-1),(1,0,0),1),((1,2,-1),(1,1,0),2),((1,2,3),(1,1,1),0),
                    ((1,2,3),(1,1,1),0),((4,2,3),(1,0,0),1),((4,2,3),(1,1,0),1),((4,2,5),(1,0,1),0)]
    output = "".join(f"ref={page} {'hit' if i in {3,5} else 'fault'} frames={','.join(map(str,state[0]))} bits={','.join(map(str,state[1]))} hand={state[2]}\n"
                     for i,(page,state) in enumerate(zip(refs,clock_states)))
    run("clock-trace",output=output+"faults=5\n")
    run("locality-pages",output="row_major_faults=4\ncolumn_major_faults=16\n")
    run("locality-four",output="row_major_faults=4\ncolumn_major_faults=4\n")
    run("mapping",output="mapping=X file=a\n")
    run("map-modes",output="private=X file=a\nshared=Y file=Y\n")
    run("map-lifetime",output="before_close=abc\nafter_close=aZc\n")

    baseline = {file.name for file in root.iterdir()}
    audit = {"OS_LAB_AUDIT":"1"}
    for name,settings in [
        ("address-regions",{"OS_LAB_ALLOC_FAIL":"1"}),
        ("address-regions",{"OS_LAB_SYSCONF_FAIL":"1"}),
        ("proc-region",{"OS_LAB_FOPEN_FAIL":"1"}),
        ("proc-region",{"OS_LAB_FGETS_ERROR":"1"}),
        ("map-modes",{"OS_LAB_MKSTEMP_FAIL":"1"}),
        ("map-modes",{"OS_LAB_PWRITE_ERROR":"1"}),
        ("map-modes",{"OS_LAB_PWRITE_SHORT":"1"}),
        ("map-modes",{"OS_LAB_PREAD_ZERO":"1"}),
        ("map-modes",{"OS_LAB_PREAD_ZERO":"2"}),
        ("map-modes",{"OS_LAB_PREAD_ERROR":"1"}),
        ("map-modes",{"OS_LAB_MMAP_FAIL":"1"}),
        ("map-modes",{"OS_LAB_MMAP_FAIL":"2"}),
        ("map-modes",{"OS_LAB_MSYNC_FAIL":"1"}),
        ("map-modes",{"OS_LAB_UNMAP_FAIL":"1"}),
        ("map-modes",{"OS_LAB_CLOSE_ERROR":"1"}),
        ("map-lifetime",{"OS_LAB_TMPFILE_FAIL":"1"}),
        ("map-lifetime",{"OS_LAB_FILENO_FAIL":"1"}),
        ("map-lifetime",{"OS_LAB_MMAP_FAIL":"1"}),
        ("map-lifetime",{"OS_LAB_MPROTECT_FAIL":"1"}),
        ("map-lifetime",{"OS_LAB_FCLOSE_ERROR":"1"}),
    ]:
        result = run(name+"-faults",status=1,env={**audit,**settings})
        check("injected failure explanation " + name + str(settings),"LAB_AUDIT" in result.stderr and len(result.stderr.splitlines()) >= 2)
        if "OS_LAB_PWRITE_SHORT" in settings or "OS_LAB_PREAD_ZERO" in settings:
            check("short I/O explains own cause " + str(settings),"short " in result.stderr and "Success" not in result.stderr)
    for settings in [{"OS_LAB_PWRITE_EINTR":"1"},{"OS_LAB_PREAD_EINTR":"1"},{}]:
        run("map-modes-faults",output="private=X file=a\nshared=Y file=Y\n",env={**audit,**settings})
    run("map-lifetime-faults",output="before_close=abc\nafter_close=aZc\n",env=audit)
    run("mapping-faults",output="mapping=X file=a\n",env=audit)
    run("proc-region-faults",output="allocation_region=rw-p\n",env={**audit,"OS_LAB_LONG_MAPS":"1"})
    check("temporary mapped files leave no directory names",{file.name for file in root.iterdir()} == baseline)

    def reference(policy,frame_count,page_size,addresses):
        locations = {}  # page -> physical slot, independent of C timestamp arrays
        order = deque()  # oldest load for FIFO, oldest reference for LRU
        hits = faults = 0
        lines = []
        for step,address in enumerate(addresses,1):
            page,offset = divmod(address,page_size)
            evicted = None
            hit = page in locations
            if hit:
                hits += 1
                if policy == "lru":
                    order.remove(page)
                    order.append(page)
            else:
                faults += 1
                if len(locations) < frame_count:
                    slot = min(set(range(frame_count))-set(locations.values()))
                else:
                    evicted = order.popleft()
                    slot = locations.pop(evicted)
                locations[page] = slot
                order.append(page)
            slot = locations[page]
            contents = ["-"]*frame_count
            for current,position in locations.items():
                contents[position] = str(current)
            lines.append(f"step={step} address={address} page={page} offset={offset} {'hit' if hit else 'fault'} slot={slot} physical={slot*page_size+offset} evicted={evicted if evicted is not None else 'none'} frames={','.join(contents)}\n")
        return "".join(lines)+f"hits={hits} faults={faults}\n",faults

    fixed_cases = [(3,4,[4,8,12,4,16,8,20]),(2,4,[0,1,3,4]),(1,1,[1,2,1,2]),(8,4096,[0,4095,4096,65535]),
                   (3,1,[2,2,2]),(3,1,[1,2,3,4,1,2,5,1,2,3,4,5]),(4,1,[1,2,3,4,1,2,5,1,2,3,4,5])]
    for policy in ["fifo","lru"]:
        for capacity,size,addresses in fixed_cases:
            output,faults = reference(policy,capacity,size,addresses)
            run("vm-lab",[policy,capacity,size,*addresses],output=output)
            if size == 1 and len(addresses) == 12:
                expected_faults = {("fifo",3):9,("fifo",4):10,("lru",3):10,("lru",4):8}[policy,capacity]
                check("known Belady comparison "+policy+str(capacity),faults == expected_faults)
    rng = random.Random(20261105)
    for case in range(50):
        capacity = rng.randint(1,8)
        size = 1 << rng.randint(0,12)
        largest_page = min(10,65535//size)
        addresses = [rng.randint(0,largest_page)*size+rng.randrange(size) for _ in range(rng.randint(1,64))]
        for policy in ["fifo","lru"]:
            output,_ = reference(policy,capacity,size,addresses)
            run("vm-lab-optimized",[policy,capacity,size,*addresses],output=output)
    for args in [[],["opt",3,4,0],["fifo",0,4,0],["fifo",9,4,0],["fifo",3,0,0],["fifo",3,3,0],
                 ["fifo",3,4097,0],["fifo",3,4,65536],["fifo",3,4,-1],["fifo",3,4,""],
                 ["fifo",3,4,"+1"],["fifo",3,4," 1"],["fifo",3,4,"1x"],["fifo",3,4,"999999999999999999999999999999999999"],
                 ["fifo",3,4,4,"bad"],["fifo",3,4,*([0]*65)]]:
        result = run("vm-lab",args,status=2,output="")
        check("invalid model input explained "+str(args[:5]),bool(result.stderr))
    output,_ = reference("lru",8,1,list(range(64)))
    run("vm-lab",["lru",8,1,*range(64)],output=output)

report = {"date":"2026-11-05","passed":True,"checks":len(checks),"teachingPrograms":12,"mainExamples":3,
          "faultWrappedPrograms":5,"randomSeed":20261105,"randomCases":50,"policiesPerRandomCase":2,
          "pageSizeBytes":os.sysconf("SC_PAGE_SIZE"),"maxReferences":64,"modelFrames":[1,8],
          "compiler":subprocess.check_output(["gcc","--version"],text=True).splitlines()[0],"platform":platform.platform(),
          "limitations":["Model physical addresses are integers, never real pointers", "No real page-table, TLB or replacement-policy modification", "No physical-frame-number probe, swap tuning, OOM or invalid-object access", "No hardware timing benchmark or power-loss persistence test", "Fault audit covers explicit tutorial objects, not libc internals", "Late close failures are simulated after real close, so handles are consumed"],
          "details":checks}
(HERE / "详写第六批测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({key:value for key,value in report.items() if key != "details"},ensure_ascii=False))
