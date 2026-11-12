"""Run actual programs from detailed chapters 25-29 and batch 07.
Requires an ordinary Linux user. All mutation stays in owned temporary directories.
Failure wrappers test call ordering and cleanup, never real power-loss recovery.
"""
from pathlib import Path
import errno
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
programs = {}


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


if platform.system() != "Linux" or os.geteuid() == 0:
    raise SystemExit("Run in Linux/WSL as an ordinary user, without sudo.")
for document in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(25, 30)] + [SOURCE / "详写第七批-练习与参考答案.md"]:
    text = document.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for filename, code in re.findall(r"\*\*完整程序：([^*]+)\*\*\s*```c\n(.*?)\n```", text, re.S):
        check("unique program " + filename, filename not in programs)
        programs[filename] = code
check("11 complete teaching programs", len(programs) == 11)
programs["listdir.c"] = (SOURCE / "示例代码/listdir.c").read_text(encoding="utf-8-sig")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch07-") as temporary:
    root = Path(temporary) / "learner workspace"
    root.mkdir()
    shutil.copy(SOURCE / "示例代码/lab.h", root / "lab.h")
    shutil.copy(HERE / "storage-faults.c", root / "storage-faults.c")
    flags = ["gcc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]
    wraps = ["open", "openat", "close", "dup", "pipe", "fstat", "fstatat", "write", "read", "opendir", "readdir", "closedir", "dirfd",
             "fopen", "fwrite", "fputc", "fflush", "fclose", "fileno", "fsync", "renameat", "unlinkat", "poll", "fcntl"]

    def compile_program(name, code, wrapped=False):
        file = root / (name + ".c")
        file.write_text(code, encoding="utf-8")
        command = flags + [str(file)]
        if wrapped:
            command += [str(root / "storage-faults.c"), *["-Wl,--wrap=" + item for item in wraps]]
        result = subprocess.run(command + ["-o", str(root / name)], cwd=root, text=True, capture_output=True, timeout=30)
        if result.returncode:
            print(result.stderr)
        check("compile " + name, result.returncode == 0)
        check("warning free " + name, not result.stderr)
        return root / name

    targets = {Path(name).stem: compile_program(Path(name).stem, code) for name, code in programs.items()}
    fault_names = ["mode-create", "cwd-anchor", "offset-relations", "dir-summary", "dir-nul", "sync-stream", "io-ready", "atomic-note"]
    for name in fault_names:
        targets[name + "-faults"] = compile_program(name + "-faults", programs[name + ".c"], True)

    def run(name, args=(), status=0, output=None, env=None):
        process = subprocess.Popen([str(targets[name]), *map(str, args)], cwd=root, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True,
                                   env={**os.environ, "LC_ALL":"C", **(env or {})})
        try:
            out, err = process.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise AssertionError("timeout cleaned owned process group: " + str(process.args))
        error = err.decode("utf-8", errors="replace")
        check("status " + name + "=" + str(status) + " " + error[:180], process.returncode == status)
        if output is not None:
            expected = output.encode() if isinstance(output, str) else output
            check("output " + name, out == expected)
        check("explicit resources balanced " + name, "LAB_UNBALANCED" not in error)
        return subprocess.CompletedProcess(process.args, process.returncode, out, error)

    audit = {"OS_LAB_AUDIT":"1"}
    # Actual owner permissions; every directory is below this private Linux temporary root.
    box = root / "permission-box"
    box.mkdir()
    note = box / "note.txt"
    note.write_bytes(b"abc\n")
    note.chmod(0o400)
    check("owner reads 0400 file", note.read_bytes() == b"abc\n")
    try:
        descriptor = os.open(note, os.O_WRONLY | os.O_APPEND)
        os.close(descriptor)
        denied = False
    except OSError as error:
        denied = error.errno == errno.EACCES
    check("ordinary user cannot append 0400 file", denied)
    try:
        box.chmod(0o100)
        check("search-only directory permits known-file read", note.read_bytes() == b"abc\n")
        listing = subprocess.run(["ls", "--color=never", str(box)], capture_output=True, timeout=5)
        check("search-only directory blocks listing", listing.returncode != 0)
        box.chmod(0o400)
        listing = subprocess.run(["ls", "--color=never", str(box)], capture_output=True, timeout=5)
        check("read-only directory permits names", listing.returncode == 0 and listing.stdout == b"note.txt\n")
        try:
            note.read_bytes()
            denied = False
        except OSError as error:
            denied = error.errno == errno.EACCES
        check("read-only directory blocks traversal", denied)
    finally:
        box.chmod(0o700)
    note.unlink()
    check("parent permissions permit unlink of readonly file", not note.exists())
    run("mode-create", ["mask-new.txt"], output="requested=0666 mask=0077 actual=0600\n")
    check("created mode observed", (root / "mask-new.txt").stat().st_mode & 0o777 == 0o600)
    (root / "mask-new.txt").write_bytes(b"keep")
    run("mode-create", ["mask-new.txt"], status=1)
    check("exclusive create preserves existing", (root / "mask-new.txt").read_bytes() == b"keep")
    anchor = root / "anchor"
    anchor.mkdir()
    (anchor / "note.txt").write_bytes(b"hello\n")
    run("cwd-anchor", [anchor], output="byte_after_chdir=h\n")
    run("cwd-anchor-faults", [anchor], output="byte_after_chdir=h\n", env={**audit,"OS_LAB_READ_EINTR":"1"})
    run("cwd-anchor-faults", [anchor], status=1, env={**audit,"OS_LAB_OPENAT_FAIL":"1"})
    run("mode-create-faults", ["stat-failure-new"], status=1, env={**audit,"OS_LAB_FSTAT_FAIL":"1"})

    links = root / "links"
    links.mkdir()
    original, hard, soft = links / "original.txt", links / "hard.txt", links / "soft.txt"
    original.write_bytes(b"same data\n")
    os.link(original, hard)
    soft.symlink_to("original.txt")
    def information(path):
        result = run("object-info", [path])
        return dict(item.split("=",1) for item in result.stdout.decode().split())
    a, b, s = information(original), information(hard), information(soft)
    check("hard links share device inode", (a["device"],a["inode"]) == (b["device"],b["inode"]))
    check("hard link count", a["links"] == b["links"] == "2")
    check("symlink has own object", s["kind"] == "symlink" and s["inode"] != a["inode"])
    hard.write_bytes(b"changed\n")
    check("hard-link modification visible", original.read_bytes() == soft.read_bytes() == b"changed\n")
    original.unlink()
    check("remaining hard link still readable", hard.read_bytes() == b"changed\n")
    check("soft link dangles but exists as link", not soft.exists() and os.path.lexists(soft))
    check("lstat sees dangling link", information(soft)["kind"] == "symlink")
    data, refs = root / "data", root / "refs"
    data.mkdir(); refs.mkdir()
    (data / "note.txt").write_bytes(b"relative target\n")
    (refs / "soft").symlink_to("../data/note.txt")
    result = subprocess.run(["cat","soft"], cwd=refs, capture_output=True, timeout=5)
    check("relative link target uses link directory", result.returncode == 0 and result.stdout == (refs/"soft").read_bytes() == b"relative target\n")
    offset_output = "first=A duplicate=B independent=A shared_offset=2 separate_offset=1\n"
    run("offset-relations", ["offset-new.txt"], output=offset_output)
    run("offset-relations-faults", ["offset-retry.txt"], output=offset_output, env={**audit,"OS_LAB_READ_EINTR":"1"})
    for index,settings in enumerate([{"OS_LAB_DUP_FAIL":"1"},{"OS_LAB_OPEN_FAIL_AT":"2"},{"OS_LAB_READ_ZERO":"1"}]):
        run("offset-relations-faults", [f"offset-error-{index}"], status=1, env={**audit,**settings})
    run("unlink-open", ["unlinked-own.txt"], output="links=0 data=abc\n")
    check("new temporary name removed", not (root / "unlinked-own.txt").exists())

    fixture = root / "directory fixture"
    fixture.mkdir()
    (fixture / "a.txt").write_bytes(b"abc")
    (fixture / "sub").mkdir()
    (fixture / "soft").symlink_to("a.txt")
    (fixture / "dangling").symlink_to("missing")
    for name,payload in [(".hidden",b""),("two words",b"xy"),("line\nbreak",b"z"),("-dash",b"")]:
        (fixture / name).write_bytes(payload)
    os.mkfifo(fixture / "queue")
    os.link(fixture / "a.txt", fixture / "hard")
    names = {os.fsencode(path.name) for path in fixture.iterdir()}
    summary = "entries=10 regular=6 directories=1 symlinks=2 other=1 bytes=9\n"
    result = run("listdir", [fixture])
    check("human list does not promise newline-safe records", b"line\nbreak\n" in result.stdout)
    run("dir-summary", [fixture], output=summary)
    result = run("dir-nul", [fixture])
    records = result.stdout.split(b"\0")
    check("NUL output ends in separator", records[-1] == b"")
    check("NUL names exact once", len(records)-1 == len(names) and set(records[:-1]) == names)
    empty = root / "empty"
    empty.mkdir()
    run("dir-summary", [empty], output="entries=0 regular=0 directories=0 symlinks=0 other=0 bytes=0\n")
    run("dir-nul", [empty], output=b"")
    for name in ["dir-summary", "dir-nul", "listdir"]:
        run(name, [root / "missing-dir"], status=1)
        run(name, [fixture / "a.txt"], status=1)
    for settings in [{"OS_LAB_READDIR_FAIL_AFTER":"1"},{"OS_LAB_FSTATAT_FAIL":"1"},{"OS_LAB_DIRFD_FAIL":"1"},{"OS_LAB_CLOSEDIR_ERROR":"1"}]:
        run("dir-summary-faults", [fixture], status=1, output=b"", env={**audit,**settings})
    run("dir-summary-faults", [fixture], output=summary, env={**audit,"OS_LAB_UNKNOWN_TYPE":"1"})
    for settings in [{"OS_LAB_READDIR_FAIL_AFTER":"1"},{"OS_LAB_FWRITE_FAIL":"1"},{"OS_LAB_FPUTC_FAIL":"1"},{"OS_LAB_FLUSH_FAIL":"1"}]:
        run("dir-nul-faults", [fixture], status=1, env={**audit,**settings})
    limit = root / "limit"
    limit.mkdir()
    for index in range(1000):
        (limit / str(index)).touch()
    run("dir-summary", [limit], output="entries=1000 regular=1000 directories=0 symlinks=0 other=0 bytes=0\n")
    (limit / "overflow").touch()
    run("dir-summary", [limit], status=1, output=b"")

    run("sync-stream", ["sync-new.txt"], output="file_sync_completed\n")
    check("stream sync contents", (root / "sync-new.txt").read_bytes() == b"version=1\n")
    run("sync-stream", ["sync-new.txt"], status=1)
    for index,settings in enumerate([{"OS_LAB_FWRITE_FAIL":"1"},{"OS_LAB_FLUSH_FAIL":"1"},{"OS_LAB_FILENO_FAIL":"1"},{"OS_LAB_SYNC_FILE_FAIL":"1"},{"OS_LAB_FCLOSE_ERROR":"1"}]):
        run("sync-stream-faults", [f"sync-failure-{index}"], status=1, output=b"", env={**audit,**settings})
    run("sync-stream-faults", ["sync-retry.txt"], output="file_sync_completed\n", env={**audit,"OS_LAB_SYNC_EINTR":"1"})
    ready_output = "empty=would_block\nready_read=K\nafter_drain=EOF\n"
    run("io-ready", output=ready_output)
    run("io-ready-faults", output=ready_output, env={**audit,"OS_LAB_POLL_EINTR":"1","OS_LAB_WRITE_EINTR":"1"})
    for settings in [{"OS_LAB_POLL_FAIL":"1"},{"OS_LAB_FCNTL_FAIL":"1"},{"OS_LAB_WRITE_ZERO":"1"}]:
        run("io-ready-faults", status=1, env={**audit,**settings})

    def disk_reference(requests):
        remaining = list(enumerate(requests))
        current, nearest = 50, []
        while remaining:
            chosen = min(remaining,key=lambda item:(abs(current-item[1]),item[0]))
            nearest.append(chosen[1]); current = chosen[1]; remaining.remove(chosen)
        order = sorted(value for value in requests if value >= 50) + sorted((value for value in requests if value < 50),reverse=True)
        lines = []
        for label,path in [("FCFS",requests),("SSTF",nearest),("LOOK",order)]:
            steps = [50,*path]
            distance = sum(abs(b-a) for a,b in zip(steps,steps[1:]))
            lines.append(f"{label} path={'->'.join(map(str,steps))} distance={distance}\n")
        return "".join(lines)
    run("disk-schedule", output=disk_reference([90,10,20]))
    disk_cases = [[10,20,90],[50,50,50],[0,10,20],[80,90,100],[40,60,20]]
    for index,requests in enumerate(disk_cases):
        name = f"disk-variant-{index}"
        targets[name] = compile_program(name,programs["disk-schedule.c"].replace("{90, 10, 20}","{"+", ".join(map(str,requests))+"}"))
        run(name,output=disk_reference(requests))

    project_index = 0
    def project_case(settings=None,status=0,payload="new version",residual=False,trace=False):
        global project_index
        folder = root / f"project-{project_index}"
        project_index += 1
        folder.mkdir()
        destination = folder / "note.txt"
        destination.write_bytes(b"old version\n")
        settings = {**audit,**(settings or {})}
        if trace:
            settings["OS_LAB_TRACE"] = "1"
        result = run("atomic-note-faults",[folder,payload],status=status,
                     output="published_and_synced\n" if status == 0 else b"",env=settings)
        expected = b"old version\n" if status == 1 else payload.encode()+b"\n"
        check("publication boundary content " + str(project_index),destination.read_bytes() == expected)
        temporary_names = list(folder.glob(".note.tmp.*"))
        check("temporary name cleanup " + str(project_index),len(temporary_names) == (1 if residual else 0))
        if residual:
            check("cleanup failure explicitly reported","cleanup temporary name" in result.stderr)
            temporary_names[0].unlink()
        return result
    result = project_case(trace=True)
    events = re.findall(r"LAB_EVENT (\w+)",result.stderr)
    required = ["create_temp","sync_file","close_file","rename","sync_dir","close_dir"]
    check("save protocol calls in order",all(item in events for item in required) and [events.index(item) for item in required] == sorted(events.index(item) for item in required))
    for settings in [{"OS_LAB_OPENAT_FAIL":"1"},{"OS_LAB_WRITE_ZERO":"1"},{"OS_LAB_WRITE_SHORT":"1","OS_LAB_WRITE_FAIL_AFTER":"1"},
                     {"OS_LAB_SYNC_FILE_FAIL":"1"},{"OS_LAB_CLOSE_FILE_ERROR":"1"},{"OS_LAB_RENAME_FAIL":"1"},{"OS_LAB_TEMP_COLLISIONS":"64"}]:
        project_case(settings,status=1)
    for settings in [{"OS_LAB_SYNC_DIR_FAIL":"1"},{"OS_LAB_CLOSE_DIR_ERROR":"1"}]:
        project_case(settings,status=3)
    for settings in [{"OS_LAB_WRITE_EINTR":"1","OS_LAB_WRITE_SHORT":"1","OS_LAB_SYNC_EINTR":"1"},{"OS_LAB_TEMP_COLLISIONS":"1"}]:
        project_case(settings)
    project_case({"OS_LAB_WRITE_ZERO":"1","OS_LAB_UNLINK_FAIL":"1"},status=1,residual=True)
    project_case(payload="")
    project_case(payload="x"*1024)
    invalid = root / "project-invalid"
    invalid.mkdir()
    for args in [[],[invalid],[invalid,"x"*1025],[invalid,"ok","extra"]]:
        run("atomic-note",args,status=2,output=b"")
    check("argument failures create no files",not list(invalid.iterdir()))
    old = invalid / "note.txt"
    old.write_bytes(b"old retained\n")
    alias = invalid / "hard-old"
    os.link(old,alias)
    descriptor = os.open(old,os.O_RDONLY)
    try:
        run("atomic-note",[invalid,"published"],output="published_and_synced\n")
        check("old open reference still old",os.read(descriptor,100) == b"old retained\n")
        check("old hard link still old",alias.read_bytes() == b"old retained\n")
        check("new name now new object",old.read_bytes() == b"published\n" and old.stat().st_ino != alias.stat().st_ino)
    finally:
        os.close(descriptor)
    external = invalid / "external.txt"
    external.write_bytes(b"keep external\n")
    old.unlink(); old.symlink_to("external.txt")
    run("atomic-note",[invalid,"replace link name"],output="published_and_synced\n")
    check("rename replaces symlink itself",not old.is_symlink() and external.read_bytes() == b"keep external\n")
    run("atomic-note",[root / "does-not-exist","no"],status=1)
    run("atomic-note",[external,"no"],status=1)
    denied_folder = root / "project-readonly"
    denied_folder.mkdir()
    (denied_folder / "note.txt").write_bytes(b"keep readonly directory version\n")
    try:
        denied_folder.chmod(0o500)
        run("atomic-note-faults",[denied_folder,"new"],status=1,output=b"",env=audit)
    finally:
        denied_folder.chmod(0o700)
    check("actual permission failure preserves old version",(denied_folder / "note.txt").read_bytes() == b"keep readonly directory version\n")
    check("actual permission failure leaves no temporary",not list(denied_folder.glob(".note.tmp.*")))
    directory_target = root / "project-directory-target"
    directory_target.mkdir()
    (directory_target / "note.txt").mkdir()
    run("atomic-note-faults",[directory_target,"new"],status=1,output=b"",env=audit)
    check("cannot replace target directory and cleans temporary",(directory_target / "note.txt").is_dir() and not list(directory_target.glob(".note.tmp.*")))

report = {"date":"2026-11-10","passed":True,"checks":len(checks),"teachingPrograms":11,"mainExamples":1,
          "faultWrappedPrograms":8,"uid":os.geteuid(),"gid":os.getegid(),"directoryLimitTested":[1000,1001],
          "diskModelCases":6,"savePayloadBytes":[0,1024,1025],"publicationFailureStatuses":[1,3],
          "compiler":subprocess.check_output(["gcc","--version"],text=True).splitlines()[0],"platform":platform.platform(),
          "limitations":["All mutations use owned Linux temporary directories; no sudo or permission broadening", "Normal permissions are verified under the recorded ordinary UID, not every ACL/mount configuration", "Injected syscall failures test protocol behavior, not real power loss or hardware recovery", "Resource audit covers explicitly acquired descriptors/DIR/FILE handles, not libc internals", "Late close errors are simulated after actual close; cleanup-name failure is reported and tested separately", "No concurrent hostile-directory, remote NFS, real DMA or storage performance verification"],
          "details":checks}
(HERE / "详写第七批测试结果.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({key:value for key,value in report.items() if key != "details"},ensure_ascii=False))
