"""Linux-only integration checks. Build and run only inside a temporary folder."""
from pathlib import Path
import datetime
import json
import os
import platform
import selectors
import shutil
import signal
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
EXAMPLES = HERE.parent / "示例代码"
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


def run(args, *, cwd, text="", code=0, timeout=8):
    result = subprocess.run(args, input=text, text=True, capture_output=True,
                            cwd=cwd, timeout=timeout)
    if result.returncode != code:
        raise AssertionError((args, result.returncode, code, result.stdout, result.stderr))
    return result


if platform.system() != "Linux":
    raise SystemExit("Run this script inside Linux / WSL Ubuntu; no Windows emulation.")

with tempfile.TemporaryDirectory(prefix="os-course-") as temporary:
    root = Path(temporary)
    examples = root / "examples"
    shutil.copytree(EXAMPLES, examples)
    sources = sorted(examples.glob("*.c"))
    check("23 complete C examples", len(sources) == 23)
    flags = "-std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror -g"
    build = run(["make", "all", "CC=gcc", "CFLAGS=" + flags], cwd=examples, timeout=60)
    for source in sources:
        check("compiled without warnings: " + source.name,
              (examples / source.stem).is_file())
    check("build produced no diagnostics", build.stderr == "")

    expected = {
        "hello": "Hello, operating systems!\n",
        "control": "total=250\n",
        "functions": "sum=90\n",
        "arrays": "count=4 sum=120 length=6\n",
        "pointers": "before=10,20\nafter=20,10\n",
        "records": "records=3 total=60\n",
        "syswrite": "write reaches fd 1\n",
        "process": "child value=99\nparent value=10 child_exit=7\n",
        "execute": "exec replaced the child\nexit=0\n",
        "pipe-demo": "hello through pipe\n",
        "threads": "results=20,40\n",
        "mutex": "counter=20000\n",
        "queue": "sum=15\n",
        "paging": "page=3 offset=1 physical=5\n",
        "mapping": "mapping=X file=a\n",
        "socket-demo": "local socket bytes\n",
    }
    for name, output in expected.items():
        actual = run([str(examples / name)], cwd=root)
        check("expected output: " + name, actual.stdout == output)

    result = run([str(examples / "scheduling")], cwd=root)
    check("FCFS independent hand calculation", result.stdout ==
          "A wait=0 turnaround=5\nB wait=5 turnaround=8\nC wait=8 turnaround=9\naverage_wait=4.333\n")
    result = run([str(examples / "replacement")], cwd=root)
    check("FIFO expected trace and count", result.stdout.endswith("faults=5\n") and
          "ref=4 fault frames=4,2,3" in result.stdout and
          "ref=5 fault frames=4,5,3" in result.stdout)

    for text, suffix in [("0\n", "0 h 0 min\n"), ("59\n", "0 h 59 min\n"),
                         ("60\n", "1 h 0 min\n"), ("90\n", "1 h 30 min\n"),
                         ("10080\n", "168 h 0 min\n"), (" 61 \n", "1 h 1 min\n")]:
        result = run([str(examples / "minutes")], cwd=root, text=text)
        check("minutes valid: " + repr(text), result.stdout.endswith(suffix))
    for text in ["", "\n", "abc\n", "12abc\n", "-1\n", "10081\n", "1.5\n", "9" * 90 + "\n"]:
        result = run([str(examples / "minutes")], cwd=root, text=text, code=1)
        check("minutes invalid: " + repr(text[:16]), bool(result.stderr))

    copy = str(examples / "copy")
    for size in [0, 1, 4096, 10000]:
        data = bytes((index % 256 for index in range(size)))
        source, target = root / ("in-" + str(size)), root / ("out-" + str(size))
        source.write_bytes(data)
        run([copy, str(source), str(target)], cwd=root)
        check("binary copy: " + str(size), target.read_bytes() == data)
    run([copy], cwd=root, code=2)
    check("copy requires two paths", True)
    run([copy, "missing", "new"], cwd=root, code=1)
    check("copy rejects missing source", not (root / "new").exists())
    source, target = root / "source", root / "existing"
    source.write_bytes(b"new data")
    target.write_bytes(b"old data")
    run([copy, str(source), str(target)], cwd=root, code=1)
    check("copy preserves existing target", target.read_bytes() == b"old data")
    run([copy, str(source), str(source)], cwd=root, code=1)
    check("copy rejects source equals target", source.read_bytes() == b"new data")

    directory = root / "listing"
    directory.mkdir()
    for name in ["alpha", "beta", "gamma"]:
        (directory / name).touch()
    result = run([str(examples / "listdir"), str(directory)], cwd=root)
    check("listdir exact names independent of order", set(result.stdout.splitlines()) == {"alpha", "beta", "gamma"})
    empty = root / "empty"
    empty.mkdir()
    result = run([str(examples / "listdir"), str(empty)], cwd=root)
    check("listdir empty directory", result.stdout == "")
    run([str(examples / "listdir"), "missing"], cwd=root, code=1)
    check("listdir missing directory fails", True)

    # Signal test waits for readiness; it never guesses process startup timing.
    process = subprocess.Popen([str(examples / "signal-demo")], cwd=root,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            check("signal program reaches ready state", bool(selector.select(timeout=5)))
        ready = process.stdout.readline()
        check("signal readiness identifies process", ready.startswith("ready pid="))
        process.send_signal(signal.SIGINT)
        stdout, stderr = process.communicate(timeout=5)
        check("SIGINT requests clean exit", process.returncode == 0 and stdout == "stopped safely\n" and not stderr)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()

    for index in range(10):
        for name in ["threads", "mutex", "queue"]:
            result = run([str(examples / name)], cwd=root)
            check("repeat concurrency %d: %s" % (index + 1, name), result.stdout == expected[name])

    shell = str(examples / "mini-shell")
    result = run([shell], cwd=root, text="\n  \n echo hello\npwd\nexit\n")
    check("shell whitespace and foreground command", result.stdout == "hello\n" + str(root) + "\n")
    result = run([shell], cwd=root, text="cd listing\npwd\nexit\n")
    check("shell cd changes parent cwd", result.stdout.strip() == str(directory))
    result = run([shell], cwd=root, text="printf abc | wc -c\nexit\n")
    check("shell pipeline", result.stdout.strip() == "3")
    result = run([shell], cwd=root, text="seq 1 50000 | wc -l\nexit\n")
    check("shell pipeline exceeds pipe capacity without deadlock", result.stdout.strip() == "50000")
    run([shell], cwd=root, text="echo saved > shell-result\nexit\n")
    check("shell output redirection", (root / "shell-result").read_text() == "saved\n")
    run([shell], cwd=root, text="printf abc | wc -c > shell-count\nexit\n")
    check("shell pipeline with redirection", (root / "shell-count").read_text().strip() == "3")
    run([shell], cwd=root, text="no_such_os_lab_command\nexit\n", code=127)
    check("shell command missing is 127", True)
    run([shell], cwd=root, text="echo a | no_such_os_lab_command\nexit\n", code=127)
    check("shell pipeline status comes from right", True)
    run([shell], cwd=root, text="echo a > missing-dir/file\nexit\n", code=1)
    check("shell output open failure", True)
    run([shell], cwd=root, text="cd missing-dir\nexit\n", code=1)
    check("shell cd failure", True)
    run([shell], cwd=root, text="no_such_os_lab_command\necho recovered\nexit\n")
    check("shell can continue after failure", True)
    for text in ["| wc", "echo a |", "echo a | wc | wc", "echo a >", "echo a > x extra",
                 "echo a > x > y", "echo a|wc", 'echo "a b"', "echo $HOME", "echo *",
                 "echo a &", "echo a ; pwd", "pwd > x", "cd listing | wc", "echo a | pwd",
                 "exit 0", "cd", "pwd extra", "echo " + "a " * 70]:
        result = run([shell], cwd=root, text=text + "\nexit\n", code=2)
        check("shell rejects: " + text[:35], bool(result.stderr))
    result = run([shell], cwd=root, text="x" * 1500 + "\necho recovered\nexit\n")
    check("shell discards oversized line and recovers", result.stdout == "recovered\n" and "line too long" in result.stderr)
    run([shell], cwd=root, text="echo eof", code=0)
    check("shell handles final line without newline", True)

report = {
    "date": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
    "platform": platform.system(), "kernel": platform.release(),
    "compiler": subprocess.check_output(["gcc", "--version"], text=True).splitlines()[0],
    "examples": 23, "checks": len(checks), "passed": True, "scenarios": checks,
    "limits": ["No power-loss persistence experiment", "No xv6/kernel build",
               "No external TCP network test", "No full terminal job-control validation"],
}
(HERE / "测试结果.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: report[key] for key in ["date", "platform", "compiler", "examples", "checks", "passed"]}, ensure_ascii=False))
