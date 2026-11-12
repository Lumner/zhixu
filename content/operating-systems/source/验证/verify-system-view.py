"""Extract and run chapters 30-33 and batch08 as an ordinary Linux user.
All mutations and binaries stay below a private /tmp directory. TCP is loopback only.
Wrapped failures model API results; they are not kernel/security/Internet tests.
"""
from pathlib import Path
import json
import os
import platform
import re
import resource
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


if platform.system() != "Linux" or os.geteuid() == 0:
    raise SystemExit("Run under Linux/WSL as an ordinary user without sudo.")
for doc in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(30, 34)] + [SOURCE / "详写第八批-练习与参考答案.md"]:
    text = doc.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for name, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique program " + name, name not in programs)
        programs[name] = code
check("six new teaching programs", len(programs) == 6)
programs["socket-demo.c"] = (SOURCE / "示例代码/socket-demo.c").read_text(encoding="utf-8-sig")
wraps = ["open", "openat", "close", "fstat", "read", "write", "socket", "socketpair", "bind", "listen", "getsockname",
         "setsockopt", "connect", "accept", "send", "recv", "shutdown", "fork", "readlink", "getrlimit", "uname", "fflush"]

with tempfile.TemporaryDirectory(prefix="os-detailed-batch08-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "system-view-faults.c", root / "system-view-faults.c")
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]
    targets = {}
    for file, code in programs.items():
        (root / file).write_text(code, encoding="utf-8")
        for faulted in [False, True] if file != "socket-demo.c" else [False]:
            name = Path(file).stem + ("-faults" if faulted else "")
            command = flags + [str(root / file)]
            if faulted:
                command += [str(root / "system-view-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
            result = subprocess.run(command + ["-o", str(root / name)], capture_output=True, text=True, timeout=30)
            if result.returncode: print(result.stderr)
            check("compile " + name, result.returncode == 0)
            check("warning free " + name, not result.stderr)
            targets[name] = root / name

    def run(name, args=(), data=None, status=0, output=None, fault=None, preexec=None):
        env = {**os.environ, "LC_ALL": "C"}
        if fault: env["VIEW_FAULT"] = fault
        proc = subprocess.Popen([str(targets[name]), *map(str, args)], cwd=root, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
                                start_new_session=True, preexec_fn=preexec)
        try:
            out, err = proc.communicate(data, timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.communicate()
            raise AssertionError("timeout; owned process group stopped: " + name)
        error = err.decode("utf-8", errors="replace")
        check(f"status {name} {args} fault={fault} {error[:120]}", proc.returncode == status)
        if output is not None:
            check("exact output " + name, out == (output.encode() if isinstance(output, str) else output))
        check("no tracked live fd " + name, "LAB_LIVE_FD" not in error)
        return out, error

    def rendered(data):
        return f"bytes={len(data)}\nhex={data.hex()}\n".encode()

    out, _ = run("boot-probe")
    check("uname system matches", f"kernel={platform.system()}\n".encode() in out)
    check("uname release matches", f"release={platform.release()}\n".encode() in out)
    check("visible PID1 comm matches", b"visible-pid1=" + Path("/proc/1/comm").read_bytes() in out)
    run("boot-probe-faults", fault="uname:1", status=1)
    run("boot-probe-faults", fault="fflush:1", status=1)

    box = root / "owned box"
    box.mkdir()
    note = box / "note"
    for length in [0, 1, 3, 63, 64, 65, 1000]:
        payload = bytes((n * 37) % 256 for n in range(length))
        note.write_bytes(payload)
        run("bounded-open", [box, "note"], status=0 if length <= 64 else 2,
            output=rendered(payload) if length <= 64 else b"")
    note.write_bytes(b"Hi\n")
    for name in ["", ".", "..", "a/b", "../note", "/note", "x" * 65]:
        run("bounded-open", [box, name], status=2, output=b"")
    run("bounded-open", [], status=2)
    run("bounded-open", [box], status=2)
    run("bounded-open", [box, "missing"], status=1)
    (box / "link").symlink_to("note")
    run("bounded-open", [box, "link"], status=1)
    (box / "sub").mkdir()
    run("bounded-open", [box, "sub"], status=2)
    os.mkfifo(box / "fifo")
    run("bounded-open", [box, "fifo"], status=2)
    note.chmod(0)
    try: run("bounded-open", [box, "note"], status=1)
    finally: note.chmod(0o600)
    box.chmod(0o600)
    try: run("bounded-open", [box, "note"], status=1)
    finally: box.chmod(0o700)
    # Explicitly demonstrate the documented limitation: hard links are accepted.
    os.link(note, box / "hard")
    run("bounded-open", [box, "hard"], output=rendered(b"Hi\n"))
    root_link = root / "root-link"
    root_link.symlink_to(box, target_is_directory=True)
    run("bounded-open", [root_link, "note"], status=1)
    for fault in ["read-short", "read-eintr"]:
        run("bounded-open-faults", [box, "note"], fault=fault, output=rendered(b"Hi\n"))
    for fault in ["open:1", "openat:1", "fstat:1", "read:1", "close:1", "close:2", "fflush:1"]:
        run("bounded-open-faults", [box, "note"], fault=fault, status=1)

    # Deterministic check/use interleaving, entirely inside the private directory.
    a, b, entry = box / "first", box / "second", box / "entry"
    a.write_bytes(b"A\n"); b.write_bytes(b"B\n"); entry.symlink_to(a.name)
    check("checked readable A", os.access(entry, os.R_OK) and entry.read_bytes() == b"A\n")
    entry.unlink(); entry.symlink_to(b.name)
    check("later name resolves B", entry.read_bytes() == b"B\n")

    run("socket-demo", output="local socket bytes\n")
    for length in range(65):
        payload = bytes((i * 71 + length) % 256 for i in range(length))
        run("frame-read", data=length.to_bytes(2, "big") + payload, output=rendered(payload))
    payload = bytes(range(64))
    frame = b"\0\x40" + payload
    for end in range(len(frame)):
        run("frame-read", data=frame[:end], status=2, output=b"")
    for invalid in [b"\0\x41", b"\x01\0", b"\xff\xff", b"\0\0X", b"\0\1AB", b"\0\0\0\0"]:
        run("frame-read", data=invalid, status=2, output=b"")
    for fault in ["read-short", "read-eintr"]:
        run("frame-read-faults", data=frame, output=rendered(payload), fault=fault)
    for fault in ["read:1", "read:2", "read:24", "fflush:1"]:
        # 2 bytes header + 22 content reads + tail -> tail is call 24.
        run("frame-read-faults", data=frame, fault=fault, status=1)

    tcp_output = b"connected=loopback\nrequest=ping\nreply=pong\n"
    for _ in range(5): run("tcp-loop", output=tcp_output)
    for fault in ["send-short", "send-eintr", "recv-short", "recv-eintr", "accept-eintr"]:
        run("tcp-loop-faults", fault=fault, output=tcp_output)
    for fault in ["socket:1", "socket:2", "bind:1", "listen:1", "getsockname:1", "address-short",
                  "setsockopt:1", "setsockopt:2", "setsockopt:3", "setsockopt:4", "connect:1", "accept:1",
                  "send:1", "send:2", "send-zero", "recv:1", "recv:3", "recv-zero", "close:1", "close:2", "close:3", "fflush:1"]:
        run("tcp-loop-faults", fault=fault, status=1)

    out, _ = run("view-probe")
    for kind in ["pid", "mnt", "net"]:
        check("namespace target " + kind, f"{kind}={os.readlink('/proc/self/ns/' + kind)}\n".encode() in out)
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    check("resource soft matches", f"fd-soft={soft}\n".encode() in out)
    run("view-probe", preexec=lambda: resource.setrlimit(resource.RLIMIT_NOFILE, (min(64, soft), hard)))
    limited, _ = run("view-probe", preexec=lambda: resource.setrlimit(resource.RLIMIT_NOFILE, (min(64, soft), hard)))
    check("child-only limit observed", f"fd-soft={min(64, soft)}\n".encode() in limited)
    check("test parent limit unchanged", resource.getrlimit(resource.RLIMIT_NOFILE) == (soft, hard))
    for fault in ["readlink:1", "readlink:2", "readlink:3", "link-full", "getrlimit:1", "fflush:1"]:
        run("view-probe-faults", fault=fault, status=1)

    for text in ["", "hello", "a b", "a;echo nope", "x" * 64, "操作系统"]:
        run("local-request", [text], output=rendered(text.encode()))
    for args in [[], ["a", "b"], ["x" * 65]]: run("local-request", args, status=2, output=b"")
    for fault in ["write-short", "write-eintr", "read-short", "read-eintr"]:
        run("local-request-faults", ["hello"], fault=fault, output=rendered(b"hello"))
    for fault in ["socketpair:1", "fork:1", "write:1", "write-zero", "read:1", "shutdown:1", "close:2"]:
        run("local-request-faults", ["hello"], fault=fault, status=1)
    worker = root / "frame-read"
    worker.rename(root / "frame-read.saved")
    try: run("local-request", ["hello"], status=1)
    finally: (root / "frame-read.saved").rename(worker)
    run("local-request", ["hello"], output=rendered(b"hello"))

report = {"date": "2026-11-12", "passed": True, "checks": len(checks), "newTeachingPrograms": 6,
          "reusedMainExamples": ["socket-demo.c"], "compiledTargets": 13, "platform": platform.platform(),
          "uid": os.geteuid(), "gcc": subprocess.check_output(["gcc", "-dumpfullversion"], text=True).strip(),
          "scope": ["real temporary-file permissions and path changes", "single-frame binary parser, all lengths 0..64 and all 66 truncation positions",
                    "real IPv4 loopback TCP and AF_UNIX parent/exec exchange", "actual namespace/read-limit observations", "bounded API-failure injection and tracked parent fd cleanup"],
          "limits": ["not Internet, TLS, firewall or DNS validation", "no VM/container creation or boot changes", "not a hostile-directory sandbox or concurrent-file snapshot",
                     "not a kernel/security proof; wrappers cover selected user calls", "child _exit cleanup relies on OS; no full descriptor-inheritance audit", "no malicious-worker timeout implemented"],
          "checkNames": checks}
(HERE / "详写第八批测试结果.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "checkNames"}, ensure_ascii=False))
