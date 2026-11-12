"""Run batch09 teaching programs and actual mini-shell + help fragments.
Private Linux temporary workspace; signals only target our own test process group.
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
import time

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks, samples = [], []
programs = {}


def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name)


if platform.system() != "Linux" or os.geteuid() == 0:
    raise SystemExit("Use an ordinary Linux/WSL user without sudo.")
for chapter in [34, 35, 36]:
    text = next(SOURCE.glob(f"{chapter}-*.md")).read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for name, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique " + name, name not in programs)
        programs[name] = code
check("two new full teaching programs", len(programs) == 2)
base = (SOURCE / "示例代码/mini-shell.c").read_text(encoding="utf-8-sig").replace("\r\n", "\n")
exercise = (SOURCE / "详写第九批-练习与参考答案.md").read_text(encoding="utf-8-sig").replace("\r\n", "\n")
replacement = re.search(r"\*\*替换片段：help识别\*\*\s*```c\n(.*?)\n```", exercise, re.S).group(1)
insertion = re.search(r"\*\*插入片段：help分支\*\*\s*```c\n(.*?)\n```", exercise, re.S).group(1)
help_code, count = re.subn(r"static int is_builtin\(const char \*name\) \{.*?\n\}", lambda _: replacement, base, flags=re.S)
check("one builtin function replaced", count == 1)
anchor = '        if (strcmp(command.left[0], "exit") == 0) {'
check("one help insertion anchor", help_code.count(anchor) == 1)
help_code = help_code.replace(anchor, insertion + "\n" + anchor)
programs.update({"mini-shell.c": base, "mini-shell-help.c": help_code})
wraps = ["write", "read", "waitpid", "fork", "pipe", "dup", "dup2", "open", "close", "clock_gettime", "nanosleep", "fflush", "kill"]

with tempfile.TemporaryDirectory(prefix="os-detailed-batch09-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    for filename in ["lab.h"]: shutil.copy(SOURCE / "示例代码" / filename, root / filename)
    for filename in ["process-faults.c", "capstone-faults.c"]: shutil.copy(HERE / filename, root / filename)
    targets = {}
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g", "-O0"]
    for name, code in programs.items():
        (root / name).write_text(code, encoding="utf-8")
        for faulted in [False, True]:
            target = Path(name).stem + ("-faults" if faulted else "")
            command = flags + [str(root / name)]
            if faulted:
                command += [str(root / "process-faults.c"), str(root / "capstone-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
            result = subprocess.run(command + ["-o", str(root / target)], capture_output=True, text=True, timeout=30)
            if result.returncode: print(result.stderr)
            check("compiled " + target, result.returncode == 0)
            check("no warnings " + target, not result.stderr)
            targets[target] = root / target
    fixture = root / "wait-ready.c"
    fixture.write_text('#include <unistd.h>\nint main(void) { if(write(1,"ready\\n",6)!=6)return 1; for(;;)pause(); }\n')
    build = subprocess.run(flags + [str(fixture), "-o", str(root / "wait-ready")], capture_output=True, text=True, timeout=30)
    check("owned signal fixture compiled", build.returncode == 0 and not build.stderr)

    def run(name, args=(), data=b"", status=0, output=None, env=None, stdin_fd=None):
        proc = subprocess.Popen([str(targets[name]), *map(str, args)], cwd=root,
                                stdin=subprocess.PIPE if stdin_fd is None else stdin_fd,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                                env={**os.environ, "LC_ALL": "C", "OS_LAB_AUDIT": "1", **(env or {})})
        started = time.monotonic()
        try:
            out, err = proc.communicate(data if stdin_fd is None else None, timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL); proc.communicate()
            raise AssertionError("owned process group timed out: " + name)
        error = err.decode(errors="replace")
        check(f"status {name}={status} {str(args)[:30]} {str(env)} {error[:80]}", proc.returncode == status)
        check("parent resources balanced " + name, "LAB_UNBALANCED" not in error)
        if output is not None:
            check("output " + name, out == (output.encode() if isinstance(output, str) else output))
        return out, error, time.monotonic() - started

    expected = 1
    for _ in range(10000000): expected = (expected * 1664525 + 1013904223) & 0xffffffff
    for mode in ["wait", "cpu"]:
        for _ in range(3):
            out, _, _ = run("measure-self", [mode])
            match = re.fullmatch(rb"mode=(cpu|wait) checksum=(\d+)\nwall_s=(\d+\.\d+)\ncpu_s=(\d+\.\d+)\n", out)
            check("timing output structured", match is not None)
            checksum, wall, cpu = int(match[2]), float(match[3]), float(match[4])
            check("correct workload result", checksum == (expected if mode == "cpu" else 1))
            check("nonnegative clocks", wall >= 0 and cpu >= 0)
            if mode == "wait": check("wait covers requested interval", wall >= 0.19)
            samples.append({"mode": mode, "checksum": checksum, "wall_s": wall, "cpu_s": cpu})
    for args in [[], ["other"], ["cpu", "wait"]]: run("measure-self", args, status=2)
    for number in range(1, 5): run("measure-self-faults", ["cpu"], env={"CAP_CLOCK_FAIL":str(number)}, status=1)
    run("measure-self-faults", ["wait"], env={"CAP_SLEEP_FAIL":"1"}, status=1)
    run("measure-self-faults", ["wait"], env={"CAP_SLEEP_EINTR":"1"})
    run("measure-self-faults", ["cpu"], env={"CAP_FLUSH_FAIL":"1"}, status=1)
    run("run-one", ["printf", "abc"], output=b"abcchild_status=0\n")
    run("run-one", [], status=2)
    run("run-one", ["no_such_os_lab_command"], status=127, output=b"child_status=127\n")
    blocked = root / "blocked"
    blocked.write_bytes(b"not executable\n"); blocked.chmod(0o600)
    run("run-one", ["./blocked"], status=126, output=b"child_status=126\n")
    run("run-one-faults", ["/bin/true"], env={"OS_LAB_WAIT_EINTR":"1"}, output=b"child_status=0\n")
    run("run-one-faults", ["/bin/true"], env={"OS_LAB_FORK_FAIL":"1"}, status=1)
    run("run-one-faults", ["/bin/true"], env={"CAP_FLUSH_FAIL":"1"}, status=1)

    for name in ["mini-shell", "mini-shell-help"]:
        run(name, data=b"\n  \necho hello\npwd\nexit\n", output=b"hello\n" + str(root).encode() + b"\n")
        (root / "folder").mkdir(exist_ok=True)
        run(name, data=b"cd folder\npwd\nexit\n", output=str(root / "folder") + "\n")
        run(name, data=b"printf abc | wc -c\nexit\n", output=b"3\n")
        run(name, data=b"seq 1 100000 | wc -l\nexit\n", output=b"100000\n")
        run(name, data=b"echo saved > result.txt\nexit\n", output=b"")
        check("file content " + name, (root / "result.txt").read_bytes() == b"saved\n")
        run(name, data=b"printf abc | wc -c > count.txt\nexit\n", output=b"")
        check("pipe file count " + name, (root / "count.txt").read_text().strip() == "3")
        run(name, data=b"no_such_os_lab_command\nexit\n", status=127)
        run(name, data=b"./blocked\nexit\n", status=126)
        run(name, data=b"/bin/false | /bin/true\nexit\n", output=b"")
        run(name, data=b"/bin/true | /bin/false\nexit\n", status=1)
        run(name, data=b"echo a > missing/output\nexit\n", status=1)
        run(name, data=b"cd missing\nexit\n", status=1)
        run(name, data=b"no_such_os_lab_command\necho recovered\nexit\n", output=b"recovered\n")
        for syntax in ["| wc", "echo a |", "echo a|wc", "echo a | wc | wc", "echo a >", "echo a > x extra",
                       "echo a > x > y", 'echo "a b"', "echo $HOME", "echo *", "echo a &", "echo a ; pwd",
                       "pwd > x", "echo a | pwd", "cd folder | wc", "exit 0", "pwd extra", "cd", "cd a b"]:
            run(name, data=(syntax + "\nexit\n").encode(), status=2, output=b"")
        run(name, data=("/bin/true " + " ".join(["a"] * 62) + "\nexit\n").encode(), output=b"")
        run(name, data=("/bin/true " + " ".join(["a"] * 63) + "\nexit\n").encode(), status=2, output=b"")
        for length in [1022, 1023]:
            text = b"printf " + b"a" * (length - 7)
            for tail in [b"", b"\nexit\n"]: run(name, data=text + tail, output=b"a" * (length - 7))
        for length in [1024, 1500, 10000]:
            text = b"printf " + b"a" * (length - 7)
            run(name, data=text + b"\nexit\n", status=2, output=b"")
            run(name, data=text + b"\necho recovered\nexit\n", output=b"recovered\n")
        for payload in [b"\0", b"echo bad\0", b"\0echo bad", b"echo bad\0 ignored", b"a" * 1023 + b"\0"]:
            run(name, data=payload + b"\nexit\n", status=2, output=b"")
            run(name, data=payload + b"\necho recovered\nexit\n", output=b"recovered\n")
        run(name, data=b"echo eof", output=b"eof\n")
        run(name, data=b"/bin/false\n\n  \nexit\n", status=1)
        # With unbuffered Shell input, the external cat receives remaining input bytes.
        run(name, data=b"cat\nremaining text\n", output=b"remaining text\n")
        fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
        try: run(name, stdin_fd=fd, status=1)
        finally: os.close(fd)
        for env, status, text in [({"OS_LAB_PIPE_FAIL":"1"}, 1, b"echo a | wc -c\nexit\n"),
                                  ({"OS_LAB_FORK_FAIL":"1"}, 1, b"echo a | wc -c\nexit\n"),
                                  ({"OS_LAB_FORK_FAIL":"2", "CAP_ABORT_AUDIT":"1"}, 1, b"./wait-ready | wc -c\nexit\n"),
                                  ({"OS_LAB_DUP2_FAIL":"1"}, 1, b"echo a | wc -c\nexit\n"),
                                  ({"OS_LAB_OPEN_FAIL":"1"}, 1, b"echo a > rejected\nexit\n"),
                                  ({"CAP_FLUSH_FAIL":"1"}, 1, b"echo a | wc -c\nexit\n"),
                                  ({"OS_LAB_WAIT_EINTR":"1"}, 0, b"printf abc | wc -c\nexit\n")]:
            _, error, elapsed = run(name + "-faults", data=text, env=env, status=status)
            if env.get("OS_LAB_FORK_FAIL") == "2":
                check("failed second fork targets own child", "LAB_ABORT_OWN_CHILD" in error)
                check("failed launch does not await endless fixture", elapsed < 4)

    help_line = b"commands: cd DIR, pwd, help, exit; external [| external] [> FILE]\n"
    run("mini-shell-help", data=b"help\nexit\n", output=help_line)
    for syntax in ["help extra", "help | wc -c", "echo a | help", "help > help.txt"]:
        run("mini-shell-help", data=(syntax + "\nexit\n").encode(), status=2, output=b"")
    check("rejected help redirection creates nothing", not (root / "help.txt").exists())
    run("mini-shell-help-faults", data=b"help\nexit\n", status=1, env={"CAP_FLUSH_FAIL":"1"})

    # Synchronize on a child readiness line before signalling only this owned session group.
    for name in ["mini-shell", "mini-shell-help"]:
        proc = subprocess.Popen([str(targets[name])], cwd=root, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        try:
            proc.stdin.write(b"./wait-ready\nexit\n"); proc.stdin.flush()
            with selectors.DefaultSelector() as selector:
                selector.register(proc.stdout, selectors.EVENT_READ)
                check("child reaches signal-ready " + name, bool(selector.select(timeout=4)))
            check("owned child readiness output " + name, proc.stdout.readline() == b"ready\n")
            os.killpg(proc.pid, signal.SIGINT)
            out, err = proc.communicate(timeout=4)
            check("parent survives child SIGINT " + name, proc.returncode == 130 and out == b"" and err == b"")
        finally:
            if proc.poll() is None: os.killpg(proc.pid, signal.SIGKILL); proc.communicate()

report = {"date":"2026-11-12", "passed":True, "checks":len(checks), "newTeachingPrograms":2, "helpVariant":1,
          "mainExample":"mini-shell.c", "compiledTargets":8, "ownedTestFixtures":1,
          "platform":platform.platform(), "uid":os.geteuid(), "gcc":subprocess.check_output(["gcc","-dumpfullversion"],text=True).strip(),
          "timingSamples":samples, "straceAvailable":shutil.which("strace") is not None,
          "limits":["strace optional trace not executed; tool absent in current environment", "signal test uses owned noninteractive process group, not terminal job control",
                    "only direct left child killed on second fork failure; no descendant supervisor", "time samples are not a hardware benchmark", "no xv6/QEMU/kernel installation or build"],
          "checkNames":checks}
(HERE / "详写第九批测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k != "checkNames"},ensure_ascii=False))
