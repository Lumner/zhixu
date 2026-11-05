"""Extract and verify detailed C chapters 04-07 and the batch 02 worksheet."""
from pathlib import Path
import datetime
import json
import platform
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []
programs = {}
split_files = {}


def check(name, value):
    if not value:
        raise AssertionError(name)
    checks.append(name)


def read(file):
    return file.read_text(encoding="utf-8").replace("\r\n", "\n")


documents = [next(SOURCE.glob(f"{n:02d}-*.md")) for n in range(4, 8)]
documents.append(SOURCE / "详写第二批-练习与参考答案.md")
for document in documents:
    text = read(document)
    pattern = r"\*\*(完整程序|故意写错的完整程序|完整文件)：([^*]+)\*\*\s*```c\n(.*?)\n```"
    for kind, filename, code in re.findall(pattern, text, re.S):
        if kind == "完整文件":
            split_files[filename] = code
        else:
            check("unique example " + filename, filename not in programs)
            programs[filename] = (code, kind == "故意写错的完整程序")

if platform.system() != "Linux":
    raise SystemExit("Run in Linux/WSL Ubuntu.")

with tempfile.TemporaryDirectory(prefix="os-detailed-batch02-") as folder:
    root = Path(folder) / "learner workspace"
    root.mkdir()
    flags = ["gcc", "-std=c17", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g"]

    def compile_code(name, code, fails=False):
        source = root / name
        source.write_text(code + "\n", encoding="utf-8")
        executable = root / source.stem
        result = subprocess.run(flags + [str(source), "-o", str(executable)],
                                text=True, capture_output=True, timeout=10)
        check("compile " + name + (" must fail" if fails else " succeeds"),
              (result.returncode != 0) if fails else (result.returncode == 0))
        if fails:
            check("diagnostic names source " + name, name in result.stderr)
        else:
            check("no warnings " + name, result.stderr == "")
        return executable

    def run(executable, text="", status=0, output=None):
        result = subprocess.run([str(executable)], input=text, text=True,
                                encoding="utf-8", capture_output=True, cwd=root, timeout=5)
        check("exit status " + executable.name + "=" + str(status), result.returncode == status)
        if output is not None:
            check("output " + executable.name, result.stdout == output)
        if status != 0:
            check("failure explains itself " + executable.name, bool(result.stderr))
        return result

    executables = {}
    for name, (code, fails) in programs.items():
        executables[name] = compile_code(name, code, fails)
    check("scope error is deliberately diagnosed", programs["scope-error.c"][1])

    expected = {
        "variables.c": "before=90\nafter=120\n",
        "types.c": "count=3 total=12345\naverage=2.50 grade=A finished=0\n",
        "arithmetic.c": "125 minutes = 2 h 5 min\n7/2=3 7/2.0=3.5\n",
        "branch.c": "goal reached\nchecked=35\n",
        "levels.c": "long session\n",
        "repeat.c": "day=1\nday=2\nday=3\nfinished\n",
        "sum-days.c": "day=1 minutes=10 total=10\nday=2 minutes=20 total=30\nday=3 minutes=30 total=60\nsum=60\n",
        "countdown.c": "left=3\nleft=2\nleft=1\ndone\n",
        "at-least-once.c": "count=1\n",
        "skip-stop.c": "used=1\nused=2\nused=4\nused=5\ntotal=12\n",
        "calls.c": "morning=30 evening=70 total=100\n",
        "parameter-copy.c": "inside=30\noutside=20 result=30\n",
        "show-goal.c": "goal=30 minutes\n",
        "prototype.c": "sum=5\n",
        "array-stats.c": "count=5 total=150 active=4\n",
        "array-function.c": "all=90 first_two=50 empty=0\n",
        "strings.c": "capacity=4 length=3\nchanged=aXc\n",
        "compare.c": "same\n",
        "week-review.c": "days=7 active=5 total=170 max=60\ncalendar_average=24.29\nactive_average=34.00\n",
    }
    for name, output in expected.items():
        run(executables[name], output=output)

    prompt = "Type one character, then press Enter: "
    run(executables["character.c"], "7\n", output=prompt + "character=7 code=55\n")
    run(executables["character.c"], "A\n", output=prompt + "character=A code=65\n")
    run(executables["character.c"], "", status=1, output=prompt)

    for minutes, label in [(29, "keep going"), (30, "goal reached"), (31, "goal reached")]:
        code = programs["branch.c"][0].replace("int minutes = 35;", f"int minutes = {minutes};")
        exe = compile_code("branch-boundary.c", code)
        run(exe, output=f"{label}\nchecked={minutes}\n")
    for minutes, label in [(29, "short"), (30, "regular"), (59, "regular"), (60, "long")]:
        code = programs["levels.c"][0].replace("int minutes = 70;", f"int minutes = {minutes};")
        exe = compile_code("level-boundary.c", code)
        run(exe, output=label + " session\n")

    for total in [0, 59, 60, 61, 1440]:
        code = programs["arithmetic.c"][0].replace("int total = 125;", f"int total = {total};")
        exe = compile_code("arithmetic-boundary.c", code)
        run(exe, output=f"{total} minutes = {total//60} h {total%60} min\n7/2=3 7/2.0=3.5\n")
    code = programs["arithmetic.c"][0].replace("int total = 125;", "minutes_per_hour = 30;\n    int total = 125;")
    compile_code("const-error.c", code, fails=True)

    code = programs["repeat.c"][0].replace("int day = 1", "int day = 4")
    run(compile_code("zero-iterations.c", code), output="finished\n")
    code = programs["repeat.c"][0].replace("day <= 3", "day < 3")
    run(compile_code("last-boundary.c", code), output="day=1\nday=2\nfinished\n")
    code = programs["countdown.c"][0].replace("int left = 3;", "int left = 0;")
    run(compile_code("zero-while.c", code), output="done\n")
    code = programs["skip-stop.c"][0].replace("day == 6", "day == 1")
    run(compile_code("immediate-break.c", code), output="total=0\n")

    for name, output in [("control.c", "total=250\n"), ("functions.c", "sum=90\n"),
                         ("arrays.c", "count=4 sum=120 length=6\n")]:
        code = read(SOURCE / "示例代码" / name)
        run(compile_code(name, code), output=output)
    control = read(SOURCE / "示例代码" / "control.c")
    run(compile_code("strict-goal.c", control.replace("minutes >= 30", "minutes > 30")), output="total=220\n")
    run(compile_code("missing-day.c", control.replace("day <= 7", "day < 7")), output="total=180\n")

    code = programs["parameter-copy.c"][0].replace("int result = increase(minutes);",
            "int result = increase(minutes);\n    minutes = result;")
    run(compile_code("explicit-return-update.c", code), output="inside=30\noutside=30 result=30\n")

    split = root / "split"
    split.mkdir()
    check("all three split files extracted", set(split_files) == {"stats.h", "stats.c", "main.c"})
    for name, code in split_files.items():
        (split / name).write_text(code + "\n", encoding="utf-8")
    result = subprocess.run(flags + ["main.c", "stats.c", "-o", "split-demo"], cwd=split,
                            text=True, capture_output=True, timeout=10)
    check("split project compiles and links", result.returncode == 0 and not result.stderr)
    run(split / "split-demo", output="sum=5\n")
    result = subprocess.run(flags + ["main.c", "-o", "missing-demo"], cwd=split,
                            text=True, capture_output=True, timeout=10)
    check("declaration without implementation fails at link", result.returncode != 0 and "add" in result.stderr)

    code = programs["array-stats.c"][0]
    for values, output in [("0, 0, 0", "count=3 total=0 active=0\n"), ("45", "count=1 total=45 active=1\n")]:
        changed = code.replace("15, 0, 45, 30, 60", values)
        run(compile_code("array-boundary.c", changed), output=output)
    code = programs["strings.c"][0].replace('word[4] = "abc"', 'word[16] = "abc"')
    run(compile_code("capacity-vs-length.c", code), output="capacity=16 length=3\nchanged=aXc\n")
    code = programs["compare.c"][0].replace('right[] = "os"', 'right[] = "OS"')
    run(compile_code("case-comparison.c", code), output="different\n")

    line = executables["line-input.c"]
    for text, output in [("hello\n", "text=hello bytes=5\n"), ("\n", "text= bytes=0\n"),
                         ("A中\n", "text=A中 bytes=4\n"), ("a" * 30 + "\n", "text=" + "a" * 30 + " bytes=30\n")]:
        run(line, text, output=output)
    for text in ["", "hello", "a" * 31 + "\n", "a" * 200 + "\n"]:
        run(line, text, status=1)

    week = programs["week-review.c"][0]
    fixture = "15, 0, 45, 30, 60, 0, 20"
    for values, output in [
        ("0, 0, 0", "days=3 active=0 total=0 max=0\ncalendar_average=0.00\nactive_average=n/a\n"),
        ("60", "days=1 active=1 total=60 max=60\ncalendar_average=60.00\nactive_average=60.00\n"),
    ]:
        run(compile_code("week-boundary.c", week.replace(fixture, values)), output=output)
    for values in ["-1", "1441"]:
        run(compile_code("week-invalid.c", week.replace(fixture, values)), status=1)
    run(compile_code("week-too-many.c", week.replace(fixture, "1,2,3,4,5,6,7,8")), status=2)
    empty = week.replace("size_t count = sizeof days / sizeof days[0];", "size_t count = 0;")
    run(compile_code("week-empty.c", empty), output="days=0 active=0 total=0 max=0\ncalendar_average=n/a\nactive_average=n/a\n")

report = {
    "date": "2026-11-05", "edition": "零基础详细版", "batch": 2,
    "chapters": ["04", "05", "06", "07"], "passed": True,
    "namedPrograms": len(programs), "splitFiles": len(split_files), "checks": len(checks),
    "compiler": subprocess.check_output(["gcc", "--version"], text=True).splitlines()[0],
    "scenarios": checks,
    "limits": ["No claim of reader understanding", "No WSL installation or editor keystroke automation",
               "No intentional execution of undefined array accesses or signed overflow"],
}
(HERE / "详写第二批测试结果.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: report[k] for k in ["date", "batch", "chapters", "namedPrograms", "splitFiles", "checks", "passed"]}, ensure_ascii=False))
