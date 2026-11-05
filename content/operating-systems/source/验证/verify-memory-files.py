"""Run actual code extracted from detailed chapters 08-10 and batch 03."""
from pathlib import Path
import json
import os
import platform
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []
programs = {}
makefile = None
limits = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


def read(file):
    return file.read_text(encoding="utf-8").replace("\r\n", "\n")


for document in [next(SOURCE.glob(f"{n:02d}-*.md")) for n in [8, 9, 10]] + [SOURCE / "详写第三批-练习与参考答案.md"]:
    pattern = r"\*\*(完整程序|故意写错的完整程序|完整文件)：([^*]+)\*\*\s*```(c|makefile)\n(.*?)\n```"
    for kind, filename, language, code in re.findall(pattern, read(document), re.S):
        if language == "makefile":
            makefile = code
        else:
            check("unique example " + filename, filename not in programs)
            programs[filename] = (code, kind == "故意写错的完整程序")

if platform.system() != "Linux":
    raise SystemExit("Run inside Linux/WSL Ubuntu.")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch03-") as folder:
    root = Path(folder) / "learner workspace"
    root.mkdir()
    flags = ["gcc", "-std=c17", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g", "-O0"]

    def compile_code(name, code, fail=False, extra=None):
        source = root / name
        source.write_text(code + "\n", encoding="utf-8")
        target = root / source.stem
        result = subprocess.run(flags + [str(source)] + (extra or []) + ["-o", str(target)],
                                cwd=root, text=True, capture_output=True, timeout=20)
        check("compile " + name + (" must fail" if fail else " succeeds"),
              result.returncode != 0 if fail else result.returncode == 0)
        if not fail:
            check("no warnings " + name, not result.stderr)
        else:
            check("diagnostic identifies source " + name, name in result.stderr)
        return target

    def run(target, args=None, status=0, output=None, env=None):
        result = subprocess.run([str(target)] + [str(a) for a in (args or [])],
                                cwd=root, text=True, encoding="utf-8", capture_output=True,
                                timeout=10, env={**os.environ, **(env or {})})
        check("status " + target.name + "=" + str(status), result.returncode == status)
        if output is not None:
            check("output " + target.name, result.stdout == output)
        if status != 0:
            check("failure explained " + target.name, bool(result.stderr))
        check("balanced instrumented resources " + target.name, "LAB_UNBALANCED" not in result.stderr)
        return result

    executable = {}
    for name, (code, fail) in programs.items():
        executable[name] = compile_code(name, code, fail)

    expected = {
        "pointer-basics.c": "x=10 via_p=10\nafter=25\n",
        "pointer-alias.c": "value=15 first=15 second=15\n",
        "pointer-output.c": "ok=1 minutes=30 missing=0\n",
        "pointer-rebind.c": "inside=20\noutside=10\n",
        "array-pointer.c": "same=1 middle=20 last=30\n",
        "pointer-to-pointer.c": "before=10\nafter=20\n",
        "conversion-step.c": "value=125 rest=x\n",
        "struct-value.c": "id=1 minutes=30 done=0\nupdated=45 done=1\n",
        "heap-value.c": "value=42\n",
        "calloc-array.c": "initial=0,0,0\ncount=3 total=60\n",
        "realloc-grow.c": "count=4 first=10 last=40 total=100\n",
        "owned-output.c": "count=2 total=30\n",
    }
    for name, output in expected.items():
        run(executable[name], output=output)
    run(executable["arguments.c"], ["input.txt", "output.txt"], output="argc=3 first=input.txt second=output.txt\n")
    run(executable["arguments.c"], status=2)

    for name, output in [("pointers.c", "before=10,20\nafter=20,10\n"),
                         ("records.c", "records=3 total=60\n")]:
        executable[name] = compile_code(name, read(SOURCE / "示例代码" / name))
        run(executable[name], output=output)
    executable["copy.c"] = compile_code("copy.c", read(SOURCE / "示例代码" / "copy.c"))
    for count, total in [(3, 60), (5, 150)]:
        code = programs["realloc-grow.c"][0].replace("size_t new_count = 4;", f"size_t new_count = {count};")
        run(compile_code("grow-variant.c", code),
            output=f"count={count} first=10 last={count*10} total={total}\n")
    for count in [0, 2, 33]:
        code = programs["realloc-grow.c"][0].replace("size_t new_count = 4;", f"size_t new_count = {count};")
        run(compile_code("grow-rejected.c", code), status=2)

    note = root / "saved-note.txt"
    run(executable["write-note.c"], [note])
    check("new note exact content", note.read_bytes() == b"My saved note\n")
    run(executable["write-note.c"], [note], status=1)
    check("existing note preserved", note.read_bytes() == b"My saved note\n")
    run(executable["read-note.c"], [note], output="My saved note\n")
    run(executable["read-note.c"], [root / "missing"], status=1)
    run(executable["read-note.c"], [root], status=1)
    run(executable["write-note.c"], status=2)

    copy = executable["copy.c"]
    run(copy, status=2)
    for length in [0, 1, 4095, 4096, 4097, 10000]:
        data = bytes(i % 256 for i in range(length))
        source, target = root / f"copy-in-{length}", root / f"copy-out-{length}"
        source.write_bytes(data)
        run(copy, [source, target])
        check("binary copy including zeros " + str(length), target.read_bytes() == data)
        run(copy, [source, target], status=1)
        check("existing binary target preserved " + str(length), target.read_bytes() == data)
    source = root / "same-file"
    source.write_bytes(b"keep me\0\xff")
    run(copy, [source, source], status=1)
    check("same source and target not truncated", source.read_bytes() == b"keep me\0\xff")
    run(copy, [root / "missing-input", root / "missing-output"], status=1)
    check("missing input does not create target", not (root / "missing-output").exists())

    tool = executable["record-tool.c"]
    raw, cleaned = root / "raw minutes.txt", root / "clean minutes.txt"
    raw.write_text("30\n 45 \n0\n+60\n", encoding="utf-8")
    run(tool, [raw, cleaned], output="records=4 total=135\n")
    check("project normalizes text", cleaned.read_text() == "30\n45\n0\n60\n")
    second = root / "roundtrip.txt"
    run(tool, [cleaned, second], output="records=4 total=135\n")
    check("project output can be reloaded", second.read_bytes() == cleaned.read_bytes())
    run(tool, [raw, cleaned], status=1)
    check("project preserves existing output", cleaned.read_text() == "30\n45\n0\n60\n")
    run(tool, [raw, raw], status=1)
    check("project preserves same input path", raw.read_text() == "30\n 45 \n0\n+60\n")
    run(tool, status=2)

    for label, text, expected_output in [
        ("empty", "", "records=0 total=0\n"),
        ("max", "1440\n" * 32, "records=32 total=46080\n"),
        ("line-boundary", " " * 61 + "0\n", "records=1 total=0\n"),
    ]:
        source, target = root / (label + "-in"), root / (label + "-out")
        source.write_text(text)
        run(tool, [source, target], output=expected_output)
        check("project creates valid export " + label, target.exists())
    bad_inputs = ["-1\n", "1441\n", "12abc\n", "\n", " \t\n", "abc\n", "30",
                  "9" * 50 + "\n", " " * 62 + "0\n", "0\n" * 33, "1\n\n", "\x00\n"]
    for i, text in enumerate(bad_inputs):
        source, target = root / f"bad-{i}-in", root / f"bad-{i}-out"
        source.write_text(text)
        run(tool, [source, target], status=1)
        check("invalid project input creates no export " + str(i), not target.exists())
    run(tool, [root / "absent", root / "not-created"], status=1)

    # Failure injection tracks explicit allocations and opened streams for balance.
    functions = ["malloc", "calloc", "realloc", "free", "fopen", "fclose", "fgets", "fgetc",
                 "fread", "ferror", "fwrite", "fputs", "fputc", "fprintf"]
    shim = root / "fault-injection.c"
    shim.write_text(read(HERE / "fault-injection.c"), encoding="utf-8")
    wrap = [str(shim)] + ["-Wl,--wrap=" + name for name in functions]
    instrumented = {}
    for name in ["heap-value.c", "calloc-array.c", "realloc-grow.c", "owned-output.c", "record-tool.c", "write-note.c", "read-note.c", "copy.c"]:
        code = programs[name][0] if name in programs else read(SOURCE / "示例代码" / name)
        instrumented[name] = compile_code("tracked-" + name, code, extra=wrap)
    for name in ["heap-value.c", "calloc-array.c", "realloc-grow.c", "owned-output.c"]:
        run(instrumented[name], env={"OS_LAB_FAIL_ALLOC_AT": "1"}, status=1)
    run(instrumented["realloc-grow.c"], env={"OS_LAB_FAIL_ALLOC_AT": "2"}, status=1)
    for call in [1, 2, 3]:
        target = root / f"alloc-failure-{call}"
        many = root / "many-records.txt"
        many.write_text("10\n" * 8)
        run(instrumented["record-tool.c"], [many, target], status=1,
            env={"OS_LAB_FAIL_ALLOC_AT": str(call)})
        check("allocation failure creates no export " + str(call), not target.exists())

    for env_name in ["OS_LAB_FAIL_OPEN_AT", "OS_LAB_FAIL_READ_AT", "OS_LAB_FAIL_CLOSE_AT"]:
        target = root / (env_name + "-out")
        run(instrumented["record-tool.c"], [raw, target], status=1, env={env_name: "1"})
        check("input resource failure creates no export " + env_name, not target.exists())
    target = root / "open-second-failure"
    run(instrumented["record-tool.c"], [raw, target], status=1, env={"OS_LAB_FAIL_OPEN_AT": "2"})
    for env_name, call in [("OS_LAB_FAIL_WRITE_AT", "1"), ("OS_LAB_FAIL_CLOSE_AT", "2")]:
        target = root / (env_name + "-export-fail")
        run(instrumented["record-tool.c"], [raw, target], status=1, env={env_name: call})
    for env_name in ["OS_LAB_FAIL_WRITE_AT", "OS_LAB_FAIL_CLOSE_AT"]:
        target = root / (env_name + "-note")
        run(instrumented["write-note.c"], [target], status=1, env={env_name: "1"})
    for env_name in ["OS_LAB_FAIL_READ_AT", "OS_LAB_FAIL_WRITE_AT", "OS_LAB_FAIL_CLOSE_AT"]:
        run(instrumented["read-note.c"], [note], status=1, env={env_name: "1"})
    for env_name in ["OS_LAB_FAIL_READ_AT", "OS_LAB_FAIL_WRITE_AT", "OS_LAB_FAIL_CLOSE_AT"]:
        target = root / (env_name + "-copy")
        run(instrumented["copy.c"], [root / "copy-in-10000", target], status=1, env={env_name: "1"})

    # Build the actual Makefile from chapter 10 with its required two source files.
    check("tutorial Makefile extracted", makefile is not None)
    build = root / "make-project"
    build.mkdir()
    (build / "Makefile").write_text(makefile + "\n")
    (build / "copy.c").write_text(read(SOURCE / "示例代码" / "copy.c"))
    (build / "arguments.c").write_text(programs["arguments.c"][0])
    result = subprocess.run(["make", "all"], cwd=build, text=True, capture_output=True, timeout=20)
    check("Makefile builds both targets", result.returncode == 0 and not result.stderr)
    check("Makefile produced copy and arguments", (build / "copy").exists() and (build / "arguments").exists())
    result = subprocess.run(["make", "-q", "all"], cwd=build, capture_output=True)
    check("Makefile recognizes up-to-date targets", result.returncode == 0)

    gdb_commands = ["break swap", "run", "print *left", "print *right", "next", "print saved",
                    "next", "print *left", "continue"]
    args = ["gdb", "-nx", "-q", "-batch"]
    for command in gdb_commands:
        args += ["-ex", command]
    result = subprocess.run(args + ["--args", str(executable["pointers.c"])], cwd=root,
                            text=True, capture_output=True, timeout=20)
    values = re.findall(r"\$\d+ = (-?\d+)", result.stdout)
    check("GDB follows tutorial steps", result.returncode == 0 and values == ["10", "20", "10", "20"])
    check("GDB program completes with swapped values", "after=20,10" in result.stdout)

    # Sanitizer support is reported separately from ordinary program checks.
    sanitizer = root / "records-sanitized"
    result = subprocess.run(flags + [str(root / "records.c"), "-fsanitize=address,undefined",
                            "-fno-omit-frame-pointer", "-o", str(sanitizer)],
                            text=True, capture_output=True, timeout=20)
    check("sanitizer build supported", result.returncode == 0)
    result = subprocess.run([str(sanitizer)], cwd=root, text=True, capture_output=True, timeout=10,
                            env={**os.environ, "ASAN_OPTIONS": "detect_leaks=1"})
    check("normal records program passes address/UB/leak checks",
          result.returncode == 0 and result.stdout == "records=3 total=60\n" and not result.stderr)

report = {
    "date": "2026-11-05", "edition": "零基础详细版", "batch": 3,
    "chapters": ["08", "09", "10"], "passed": True, "checks": len(checks),
    "namedPrograms": len(programs), "makefiles": 1,
    "compiler": subprocess.check_output(["gcc", "--version"], text=True).splitlines()[0],
    "scenarios": checks, "limits": limits + ["No fresh environment install", "No power-loss test",
    "Injected failures model selected interfaces, not every operating-system failure",
    "No intentional execution of invalid pointer dereferences or signed overflow"],
}
(HERE / "详写第三批测试结果.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: report[k] for k in ["date", "batch", "chapters", "namedPrograms", "checks", "passed"]}, ensure_ascii=False))
