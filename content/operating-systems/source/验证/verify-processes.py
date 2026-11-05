"""Compile and exercise the actual code in detailed chapters 11-16 and batch 04.
Linux only. Every subprocess owns a fresh process group; timeouts clean that group.
Fault wrappers affect only the newly compiled tutorial executables, not system tools.
"""
from pathlib import Path
import json
import os
import platform
import re
import selectors
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
    raise SystemExit("Run this script inside Linux/WSL Ubuntu.")
for doc in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(11, 17)] + [SOURCE / "详写第四批-练习与参考答案.md"]:
    text = doc.read_text(encoding="utf-8").replace("\r\n", "\n")
    for filename, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique teaching program " + filename, filename not in programs)
        programs[filename] = code
check("sixteen complete teaching programs extracted", len(programs) == 16)
main_names = ["syswrite", "process", "execute", "pipe-demo", "signal-demo", "scheduling"]
for name in main_names:
    programs[name + ".c"] = (SOURCE / "示例代码" / (name + ".c")).read_text(encoding="utf-8-sig")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch04-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "process-faults.c", root / "process-faults.c")
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]

    def compile_program(filename, code, wrap=False):
        file = root / filename
        file.write_text(code, encoding="utf-8")
        target = root / (file.stem + ("-faults" if wrap else ""))
        command = flags + [str(file)]
        if wrap:
            command += [str(root / "process-faults.c")]
            command += ["-Wl,--wrap=" + name for name in ["write", "read", "fork", "waitpid", "pipe", "dup", "dup2", "open", "close"]]
        result = subprocess.run(command + ["-o", str(target)], cwd=root, text=True, capture_output=True, timeout=30)
        check("compile " + target.name, result.returncode == 0 or print(result.stderr))
        check("warning free " + target.name, not result.stderr)
        return target

    executables = {Path(name).stem: compile_program(name, code) for name, code in programs.items()}
    wrapped = {name: compile_program(name + ".c", programs[name + ".c"], True) for name in
               ["syswrite", "fd-write", "process", "fork-return", "two-children", "run-command", "pipe-demo", "fd-dup", "redirect-new", "pipeline-run", "signal-handshake"]}
    fixtures = {
        "emit-fixture.c": '#include "lab.h"\nint main(void) { char data[4096]; memset(data, 65, sizeof data); size_t rest=1048699; while(rest){size_t n=rest<sizeof data?rest:sizeof data;write_all(1,data,n);rest-=n;}return 0;}\n',
        "count-fixture.c": '#include "lab.h"\nint main(void) { char b[4096];size_t total=0;for(;;){ssize_t n=read(0,b,sizeof b);if(n<0&&errno==EINTR)continue;if(n<0)die("read");if(!n)break;total+=(size_t)n;}printf("%zu\\n",total);return 0;}\n',
        "exit-fixture.c": '#include <string.h>\nint main(int argc,char **argv){return argc==2&&strcmp(argv[1],"seven")==0?7:0;}\n',
    }
    for name, code in fixtures.items():
        executables[Path(name).stem] = compile_program(name, code)

    def finish(process, timeout=8):
        try:
            out, err = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            out, err = process.communicate()
            raise AssertionError("timeout cleaned owned process group: " + str(process.args) + " " + err)
        return subprocess.CompletedProcess(process.args, process.returncode, out, err)

    def run(name, args=(), status=0, output=None, env=None, fault=False):
        target = wrapped[name] if fault else executables[name]
        process = subprocess.Popen([str(target), *map(str, args)], cwd=root, text=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   start_new_session=True, env={**os.environ, **(env or {})})
        result = finish(process)
        check("exit " + target.name + "=" + str(status), result.returncode == status)
        if output is not None:
            check("stdout " + target.name, result.stdout == output)
        check("owned resources balanced " + target.name, "LAB_UNBALANCED" not in result.stderr)
        return result

    run("fd-write", output="OS\n")
    r = run("fd-error", status=1, output="is_EBADF=1\n")
    check("EBADF diagnostic", bool(r.stderr))
    run("stdio-three", output="one\ntwo\nthree\n")
    redirected = root / "stdio-result.txt"
    with redirected.open("w") as file:
        r = subprocess.run([str(executables["stdio-three"])], cwd=root, stdout=file, stderr=subprocess.PIPE, text=True, timeout=8)
    check("stdio file redirect status", r.returncode == 0)
    check("stdio file redirect contents", redirected.read_text() == "one\ntwo\nthree\n")
    run("syswrite", output="write reaches fd 1\n")
    for settings in [{"OS_LAB_WRITE_EINTR": "1"}, {"OS_LAB_WRITE_SHORT": "1"}, {"OS_LAB_WRITE_EINTR": "1", "OS_LAB_WRITE_SHORT": "1"}]:
        run("syswrite", output="write reaches fd 1\n", env=settings, fault=True)
    r = run("syswrite", status=1, env={"OS_LAB_WRITE_ZERO": "1"}, fault=True)
    check("zero write explains no progress", "no progress" in r.stderr and "Success" not in r.stderr)
    r = run("syswrite", status=1, env={"OS_LAB_WRITE_ERROR": "1"}, fault=True)
    check("real write failure diagnosed", bool(r.stderr))
    run("fd-write", status=1, output="OS", env={"OS_LAB_WRITE_SHORT": "1"}, fault=True)

    run("process", output="child value=99\nparent value=10 child_exit=7\n")
    for attempt in range(6):
        r = run("fork-return")
        m = re.fullmatch(r"child pid=(\d+) fork_result=0\nparent pid=(\d+) child_pid=(\d+) child_exit=0\n", r.stdout)
        check("fork PID relations " + str(attempt), bool(m) and m[1] == m[3] and m[1] != m[2])
        r = run("two-children")
        check("two children once each " + str(attempt), sorted(r.stdout.splitlines()) == sorted([
            "child index=0", "child index=1", "reaped index=0 exit=3", "reaped index=1 exit=4"]))
        check("parent reap order " + str(attempt), r.stdout.index("reaped index=0") < r.stdout.index("reaped index=1"))
    for number in [1, 2]:
        r = run("two-children", status=1, fault=True, env={"OS_LAB_FORK_FAIL": str(number), "OS_LAB_AUDIT": "1"})
        check("fork failure reported " + str(number), "fork" in r.stderr)
    run("process", fault=True, output="child value=99\nparent value=10 child_exit=7\n", env={"OS_LAB_WAIT_EINTR": "1", "OS_LAB_AUDIT": "1"})

    run("execute", output="exec replaced the child\nexit=0\n")
    r = run("argv-view", ["alpha", "two words"])
    check("argv shape", "argc=3\n" in r.stdout and "argv[2]=<two words>\n" in r.stdout)
    r = run("exec-same-pid")
    m = re.match(r"before_exec_pid=(\d+)\ntarget pid=(\d+) argc=3\n", r.stdout)
    check("exec keeps PID", bool(m) and m[1] == m[2])
    check("explicit argv zero", "argv[0]=<argv-view>\n" in r.stdout)
    run("run-command", status=2)
    r = run("run-command", ["./missing-batch04"], status=127)
    check("exec missing diagnostic", "execvp" in r.stderr and "child_exit=127" in r.stderr)
    r = run("run-command", ["./exit-fixture", "seven"], status=7, output="")
    check("target status passed on stderr", "child_exit=7" in r.stderr)
    r = run("run-command", ["./argv-view", ">", "literal-output.txt"])
    check("no shell syntax interpretation", "argv[1]=<>>\n" in r.stdout and not (root / "literal-output.txt").exists())
    denied = root / "not-executable.txt"
    denied.write_text("practice\n")
    denied.chmod(0o600)
    run("run-command", ["./not-executable.txt"], status=127)
    run("run-command", ["./exit-fixture"], status=1, fault=True, env={"OS_LAB_FORK_FAIL": "1", "OS_LAB_AUDIT": "1"})

    run("fd-dup", ["dup-new.txt"], output="shared_offset=2\n")
    check("dup shares open offset", (root / "dup-new.txt").read_bytes() == b"AB")
    run("fd-dup", ["dup-new.txt"], status=1)
    check("existing dup output preserved", (root / "dup-new.txt").read_bytes() == b"AB")
    run("fd-dup", ["dup-failed.txt"], status=1, fault=True, env={"OS_LAB_DUP_FAIL": "1", "OS_LAB_AUDIT": "1"})
    run("fd-dup", ["dup-wrapped.txt"], output="shared_offset=2\n", fault=True, env={"OS_LAB_AUDIT": "1"})
    run("pipe-demo", output="hello through pipe\n")
    for settings in [{"OS_LAB_READ_EINTR": "1"}, {"OS_LAB_READ_SHORT": "1"}, {"OS_LAB_READ_SHORT": "1", "OS_LAB_WRITE_SHORT": "1", "OS_LAB_WAIT_EINTR": "1"}]:
        run("pipe-demo", fault=True, output="hello through pipe\n", env={**settings, "OS_LAB_AUDIT": "1"})
    run("pipe-eof-probe", output="writer_open=would_block\nwriter_closed=EOF\n")
    run("redirect-new", status=2)
    run("redirect-new", ["redirect-new.txt", "./argv-view", "demo"])
    original = (root / "redirect-new.txt").read_bytes()
    check("redirected target output", b"argv[1]=<demo>\n" in original)
    run("redirect-new", ["redirect-new.txt", "./argv-view", "changed"], status=1)
    check("redirect refuses overwrite", (root / "redirect-new.txt").read_bytes() == original)
    # The new output may receive descriptor 1 if stdout was closed before startup.
    process = subprocess.Popen([str(executables["redirect-new"]), "closed-stdout.txt", "./argv-view", "closed"],
                               cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               start_new_session=True, preexec_fn=lambda: os.close(1))
    r = finish(process)
    check("redirect handles open returning fd1", r.returncode == 0 and r.stdout == "")
    check("redirect fd1 retained across exec", b"argv[1]=<closed>\n" in (root / "closed-stdout.txt").read_bytes())
    run("redirect-new", ["empty-after-exec.txt", "./missing-batch04"], status=127)
    check("creation precedes exec failure", (root / "empty-after-exec.txt").read_bytes() == b"")
    run("redirect-new", ["dup2-failed.txt", "./argv-view"], status=1, fault=True, env={"OS_LAB_DUP2_FAIL": "1", "OS_LAB_AUDIT": "1"})
    run("redirect-new", ["open-failed.txt", "./argv-view"], status=1, fault=True, env={"OS_LAB_OPEN_FAIL": "1", "OS_LAB_AUDIT": "1"})
    check("injected open creates nothing", not (root / "open-failed.txt").exists())

    for attempt in range(20):
        run("signal-handshake", output="child received SIGUSR1\nparent child_exit=0\n")
    run("signal-handshake", fault=True, output="child received SIGUSR1\nparent child_exit=0\n", env={"OS_LAB_WAIT_EINTR": "1", "OS_LAB_AUDIT": "1"})
    run("signal-status", output="terminated_by_signal=SIGTERM\n")
    for attempt in range(3):
        process = subprocess.Popen([str(executables["signal-demo"])], cwd=root, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True)
        with selectors.DefaultSelector() as ready:
            ready.register(process.stdout, selectors.EVENT_READ)
            if not ready.select(5):
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
                raise AssertionError("signal-demo never became ready")
            first = process.stdout.readline()
        check("signal handler ready before send " + str(attempt), first == f"ready pid={process.pid}\n")
        process.send_signal(signal.SIGINT)
        r = finish(process)
        check("SIGINT graceful output " + str(attempt), r.stdout == "stopped safely\n")
        check("SIGINT graceful exit " + str(attempt), r.returncode == 0)

    run("scheduling", output="A wait=0 turnaround=5\nB wait=5 turnaround=8\nC wait=8 turnaround=9\naverage_wait=4.333\n")
    run("sjf-model", output="C start=0 end=1 wait=0\nB start=1 end=4 wait=1\nA start=4 end=9 wait=4\naverage_wait=1.667\n")
    expected = {
        1: ([("A",0,1),("B",1,2),("C",2,3),("A",3,4),("B",4,5),("A",5,6),("B",6,7),("A",7,8),("A",8,9)], [9,7,3], [0,1,2]),
        2: ([("A",0,2),("B",2,4),("C",4,5),("A",5,7),("B",7,8),("A",8,9)], [9,8,5], [0,2,4]),
        20: ([("A",0,5),("B",5,8),("C",8,9)], [5,8,9], [0,5,8]),
    }
    for quantum, (slices, completion, first) in expected.items():
        r = run("rr-model", [quantum])
        actual = [(name, int(a), int(b)) for name, a, b in re.findall(r"([ABC]) slice=(\d+)\.\.(\d+)", r.stdout)]
        check("RR exact hand-derived timeline q=" + str(quantum), actual == slices)
        waits = [c-b for c,b in zip(completion,[5,3,1])]
        for i, name in enumerate("ABC"):
            check("RR per-job metrics " + str(quantum) + name,
                  f"{name} wait={waits[i]} turnaround={completion[i]} response={first[i]}\n" in r.stdout)
        check("RR average " + str(quantum), f"average_wait={sum(waits)/3:.3f}\n" in r.stdout)
    check("RR default q2", run("rr-model").stdout == run("rr-model", [2]).stdout)
    for bad in ["0", "-1", "101", "two", "2x", "", "99999999999999999999999999999999999"]:
        run("rr-model", [bad], status=2)
    run("rr-model", [1, 2], status=2)
    # Independently known arrived-task timeline: runtime conservation and the published metric table.
    arrived = [("A",0,1),("B",1,2),("C",2,3),("B",3,6),("A",6,13)]
    for name, arrival, burst, completion in [("A",0,8,13),("B",1,4,6),("C",2,1,3)]:
        check("SRTF runtime conservation " + name, sum(b-a for who,a,b in arrived if who==name) == burst)
        check("SRTF completion " + name, max(b for who,a,b in arrived if who==name) == completion)
    check("SRTF mean waiting", ((13-0-8)+(6-1-4)+(3-2-1))/3 == 2)

    pipeline = ["./emit-fixture", "--", "./count-fixture"]
    r = run("pipeline-run", ["printf", "%s\n", "hello", "--", "wc", "-c"])
    check("small pipeline bytes", r.stdout.strip() == "6" and "left_exit=0 right_exit=0" in r.stderr)
    for attempt in range(3):
        r = run("pipeline-run", pipeline, output="1048699\n")
        check("large producer consumer both success " + str(attempt), "left_exit=0 right_exit=0" in r.stderr)
    for args in [[], ["./emit-fixture"], ["--", "./count-fixture"], ["./emit-fixture", "--"], ["./emit-fixture", "--", "./count-fixture", "--"]]:
        run("pipeline-run", args, status=2)
    r = run("pipeline-run", ["./missing-batch04", "--", "./count-fixture"], output="0\n")
    check("left failure does not imply pipefail", "left_exit=127 right_exit=0" in r.stderr)
    r = run("pipeline-run", ["./emit-fixture", "--", "./missing-batch04"], status=127)
    check("right exec failure reported", "right_exit=127" in r.stderr)
    r = run("pipeline-run", ["./exit-fixture", "seven", "--", "./count-fixture"], output="0\n")
    check("normal nonzero left status reported", "left_exit=7 right_exit=0" in r.stderr)
    for settings, status in [({},0), ({"OS_LAB_WAIT_EINTR":"1"},0), ({"OS_LAB_PIPE_FAIL":"1"},1),
                             ({"OS_LAB_FORK_FAIL":"1"},1), ({"OS_LAB_FORK_FAIL":"2"},1), ({"OS_LAB_DUP2_FAIL":"1"},1)]:
        r = run("pipeline-run", pipeline, status=status, fault=True, env={**settings,"OS_LAB_AUDIT":"1"})
        if status == 0:
            check("instrumented large pipeline bytes", r.stdout == "1048699\n")
    if shutil.which("seq") and shutil.which("wc"):
        r = run("pipeline-run", ["seq", "1", "100000", "--", "wc", "-l"])
        check("external 100000-line pipeline", r.stdout.strip() == "100000")

report = {"date":"2026-11-05", "passed":True, "checks":len(checks), "teachingPrograms":16,
          "mainExamples":6, "fixtures":3, "faultWrappedPrograms":11,
          "platform":platform.platform(), "compiler":subprocess.check_output(["gcc","--version"],text=True).splitlines()[0],
          "signalHandshakeRuns":21, "signalDemoRuns":3, "largePayloadBytes":1048699,
          "straceAvailable":shutil.which("strace") is not None,
          "limitations":["strace optional steps were not run because strace is absent", "no kernel scheduler modification or timing benchmark", "fault auditing covers parent-owned children and tracked descriptors at normal exit, not every possible process failure", "not a full shell or job control implementation"],
          "details":checks}
(HERE / "详写第四批测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k != "details"},ensure_ascii=False))
