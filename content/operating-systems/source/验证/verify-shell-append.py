"""Validate the optional Shell append lesson; only owned Linux temporary files.
Sequential offset experiments, parser negatives, binary pipeline and bounded failures.
"""
from pathlib import Path
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []


def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name)


if platform.system() != "Linux" or os.geteuid() == 0:
    raise SystemExit("Use ordinary Linux/WSL user without sudo.")
lesson = (SOURCE / "进阶实践01-Shell追加输出从零实现.md").read_text(encoding="utf-8-sig").replace("\r\n", "\n")
programs = {}
for filename, relpath, code in re.findall(r"\[完整源码：([^\]]+)\]\(([^)]+)\)\s*```c\n(.*?)\n```", lesson, re.S):
    check("embedded source matches " + filename, code.strip() == (SOURCE / relpath).read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip())
    programs[filename] = code
check("two extension programs", set(programs) == {"append-fds.c", "mini-shell-append.c"})
base = (SOURCE / "示例代码/mini-shell.c").read_text(encoding="utf-8-sig")
programs["mini-shell.c"] = base
anchor = "    if (put_byte(left, 'C') < 0"
check("unique seek exercise anchor", programs["append-fds.c"].count(anchor) == 1)
programs["append-fds-seek.c"] = programs["append-fds.c"].replace(anchor,
    '    if (lseek(left, 0, SEEK_SET) == (off_t)-1) { perror("seek left"); goto done; }\n' + anchor)
wraps = ["open", "close", "write", "lseek", "fflush", "pipe", "fork", "waitpid", "dup2"]

with tempfile.TemporaryDirectory(prefix="os-shell-append-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "append-faults.c", root / "append-faults.c")
    targets = {}
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]
    for filename, code in programs.items():
        (root / filename).write_text(code, encoding="utf-8")
        for wrapped in [False, True] if filename in ["append-fds.c", "mini-shell-append.c"] else [False]:
            name = Path(filename).stem + ("-faults" if wrapped else "")
            command = flags + [str(root / filename)]
            if wrapped: command += [str(root / "append-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
            result = subprocess.run(command + ["-o", str(root / name)], text=True, capture_output=True, timeout=30)
            if result.returncode: print(result.stderr)
            check("compiled " + name, result.returncode == 0)
            check("warnings absent " + name, not result.stderr)
            targets[name] = root / name
    fixture = root / "emit-bytes.c"
    fixture.write_text('#include <errno.h>\n#include <unistd.h>\nint main(void){ unsigned char b[4096]; for(unsigned i=0;i<sizeof b;i++)b[i]=(unsigned char)i; for(int j=0;j<256;j++){size_t p=0;while(p<sizeof b){ssize_t n=write(1,b+p,sizeof b-p);if(n<0&&errno==EINTR)continue;if(n<=0)return 1;p+=(size_t)n;}}return 0;}\n')
    r = subprocess.run(flags + [str(fixture), "-o", str(root / "emit-bytes")], capture_output=True, text=True, timeout=30)
    check("binary fixture compiled", r.returncode == 0 and not r.stderr)

    def run(name, args=(), data=b"", status=0, output=None, fault=None, trace=False):
        env = {**os.environ, "LC_ALL":"C"}
        if fault: env["APPEND_FAULT"] = fault
        if trace: env["APPEND_TRACE_OPEN"] = "1"
        proc = subprocess.Popen([str(targets[name]), *map(str, args)], cwd=root, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, env=env)
        try: out, err = proc.communicate(data, timeout=7)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL); proc.communicate()
            raise AssertionError("timeout; owned process group stopped: " + name)
        error = err.decode(errors="replace")
        check(f"status {name}={status} fault={fault} {error[:110]}", proc.returncode == status)
        check("tracked parent resources balanced " + name, "LAB_UNBALANCED" not in error)
        if output is not None: check("exact output " + name, out == (output.encode() if isinstance(output,str) else output))
        return out, error

    expected_positions = {"plain":"after-A left=1 right=0\nafter-B left=1 right=1\nafter-C left=2 right=1\n",
                          "append":"after-A left=1 right=0\nafter-B left=1 right=2\nafter-C left=3 right=2\n"}
    for mode, content in [("plain",b"BC"),("append",b"ABC")]:
        file = root / (mode + ".dat")
        run("append-fds", [mode, file], output=expected_positions[mode])
        check("deterministic file " + mode, file.read_bytes() == content)
        run("append-fds", [mode, file], status=1)
        check("O_EXCL preserves previous " + mode, file.read_bytes() == content)
        seek_file = root / (mode + "-seek.dat")
        expected = expected_positions[mode] if mode == "append" else expected_positions[mode].replace("after-C left=2", "after-C left=1")
        run("append-fds-seek", [mode, seek_file], output=expected)
        check("seek exercise content " + mode, seek_file.read_bytes() == (b"ABC" if mode == "append" else b"C"))
        for fault in ["write-eintr", "open:1", "open:2", "write:1", "write:2", "write:3", "write-zero", "lseek:1", "lseek:2", "lseek:6", "close:1", "close:2", "fflush:1"]:
            target = root / (mode + "-" + fault.replace(":","-") + ".dat")
            run("append-fds-faults", [mode, target], fault=fault, status=0 if fault == "write-eintr" else 1)
            if fault in ["open:1"]: check("failed first open creates nothing", not target.exists())
            if fault in ["open:2", "write:1", "write-zero"]: check("partial empty target retained", target.read_bytes() == b"")
            if fault == "write:2": check("partial first byte retained", target.read_bytes() == b"A")
            if fault == "write:3": check("partial second result retained", target.read_bytes() == (b"AB" if mode == "append" else b"B"))
            if fault in ["write-eintr", "close:1", "close:2", "fflush:1"]: check("full bytes on later failure or retry", target.read_bytes() == content)
    for args in [[],["plain"],["wrong","unused"],["plain","x","extra"]]: run("append-fds",args,status=2)

    shell = "mini-shell-append"
    note = root / "note.txt"
    run(shell,data=b"echo first > note.txt\necho second >> note.txt\nexit\n",output=b"")
    check("append retains first line",note.read_bytes()==b"first\nsecond\n")
    run(shell,data=b"printf abc | wc -c >> note.txt\nexit\n")
    check("pipe appended after existing lines",note.read_text().splitlines()==["first","second","3"])
    run(shell,data=b"echo reset > note.txt\nexit\n")
    check("overwrite still truncates",note.read_bytes()==b"reset\n")
    run(shell,data=b"printf a >> empty-created.txt\nprintf b >> empty-created.txt\nexit\n")
    check("append creates missing and adds no newline",(root/"empty-created.txt").read_bytes()==b"ab")
    note.write_bytes(b"prefix\0")
    run(shell,data=b"./emit-bytes | /bin/cat >> note.txt\nexit\n")
    payload=bytes(range(256))*4096
    check("1MiB binary pipe append",note.read_bytes()==b"prefix\0"+payload)
    run(shell,data=b"./emit-bytes | /bin/cat >> note.txt\nexit\n")
    check("repeated binary append exact",note.read_bytes()==b"prefix\0"+payload+payload)
    # Invalid complete records must not alter either existing or absent targets.
    for syntax in ["echo a >>", "echo a >> x extra", "echo a >>> x", "echo a>>x", "echo a >> x > y",
                   "echo a > x >> y", "echo a >> x >> y", "echo a >> | wc", "pwd >> x", "cd folder >> x",
                   "exit >> x", "echo a | pwd >> x", "echo a >> x | wc", "echo a >> ../x extra"]:
        (root/"x").write_bytes(b"old\0bytes")
        run(shell,data=(syntax+"\nexit\n").encode(),status=2,output=b"")
        check("invalid syntax preserves existing target",(root/"x").read_bytes()==b"old\0bytes")
        check("invalid syntax creates no second target",not(root/"y").exists())
    (root/"x").unlink()
    run(shell,data=b"pwd >> x\nexit\n",status=2)
    check("builtin rejection creates no x",not(root/"x").exists())
    run(shell,data=b"echo a >> missing/file\nexit\n",status=1)
    run(shell,data=b"echo a >> missing/file\necho recovered\nexit\n",output=b"recovered\n")
    locked=root/"locked";locked.write_bytes(b"keep");locked.chmod(0o400)
    try: run(shell,data=b"echo fail >> locked\nexit\n",status=1)
    finally: locked.chmod(0o600)
    check("permission failure retains content",locked.read_bytes()==b"keep")
    run(shell,data=b"echo fail >> folder-target\nexit\n",status=0) # first create a regular file
    (root/"folder-target").unlink();(root/"folder-target").mkdir()
    run(shell,data=b"echo fail >> folder-target\nexit\n",status=1)
    # Executing a missing program can occur after the valid redirection has opened/created its target.
    run(shell,data=b"no_such_os_lab_command >> created-before-exec\nexit\n",status=127)
    check("valid redirection can precede exec failure",(root/"created-before-exec").read_bytes()==b"")
    for text in [b"echo hidden\0 >> x\n",b"a"*1024+b" >> x\n"]:
        run(shell,data=text+b"exit\n",status=2,output=b"")
        check("invalid input does not create target",not(root/"x").exists())
    for env in ["open:1","dup2:1"]:
        note.write_bytes(b"keep")
        run(shell+"-faults",data=b"echo a >> note.txt\nexit\n",fault=env,status=1)
        check("append setup failure preserves bytes",note.read_bytes()==b"keep")
    for fault in ["pipe:1","fork:1","fork:2","fflush:1"]:
        run(shell+"-faults",data=b"printf a | /bin/cat >> note.txt\nexit\n",fault=fault,status=1)
    run(shell+"-faults",data=b"printf a | /bin/cat >> note.txt\nexit\n",fault="wait-eintr")
    _,err=run(shell+"-faults",data=b"echo appended >> note.txt\nexit\n",trace=True)
    check("append open flag without truncation","LAB_OPEN append=1 trunc=0" in err)
    _,err=run(shell+"-faults",data=b"echo replaced > note.txt\nexit\n",trace=True)
    check("overwrite open flag without append","LAB_OPEN append=0 trunc=1" in err)
    # Baseline rejection remains unchanged; the extension is an independent variant.
    note.write_bytes(b"keep")
    run("mini-shell",data=b"echo no >> note.txt\nexit\n",status=2)
    check("baseline has no extra syntax",note.read_bytes()==b"keep")
    for name in ["mini-shell",shell]:
        run(name,data=b"printf abc | wc -c\nexit\n",output=b"3\n")
        run(name,data=b"no_such_os_lab_command\necho recovered\nexit\n",output=b"recovered\n")
        run(name,data=b"echo ok",output=b"ok\n")
        run(name,data=("/bin/true "+" ".join(["a"]*62)+"\nexit\n").encode())
        run(name,data=("/bin/true "+" ".join(["a"]*63)+"\nexit\n").encode(),status=2)

report={"date":"2026-11-12","passed":True,"checks":len(checks),"extensionPrograms":2,"mainExamplesChanged":0,
        "compiledTargets":6,"binaryFixture":1,"binaryPipelineBytes":1048576,"platform":platform.platform(),"uid":os.geteuid(),
        "gcc":subprocess.check_output(["gcc","-dumpfullversion"],text=True).strip(),
        "scope":["sequential independent-offset and seek experiments","exact files and 1MiB binary pipeline repeated append",
                 "parser negatives preserve bytes; ordinary-user permissions","open/dup/fork/pipe/seek/write/close/flush failures and tracked parent cleanup"],
        "limits":["not a multiwriter record-atomicity test","not power-loss or remote-filesystem validation","no full job control or descendant supervision",
                  "child _exit resources reclaimed by OS; selected call wrappers only","full 23-main-example regression remains previous batch; baseline unchanged"],"checksDetail":checks}
(HERE/"Shell追加输出测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k!="checksDetail"},ensure_ascii=False))
