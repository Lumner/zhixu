"""Verify executable examples extracted from the detailed edition, batch 01."""
from pathlib import Path
import datetime
import json
import platform
import re
import shlex
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


def section(file, heading):
    text = file.read_text(encoding="utf-8")
    for part in re.split(r"(?=^## )", text, flags=re.M):
        if part.startswith("## " + heading + "\n"):
            return part
    raise AssertionError("Section missing: " + heading)


def blocks(part, language):
    return re.findall(r"```" + language + r"\n(.*?)\n```", part, re.S)


def run(args, cwd, expected=0):
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=10)
    if result.returncode != expected:
        raise AssertionError((args, result.returncode, result.stdout, result.stderr))
    return result


if platform.system() != "Linux":
    raise SystemExit("Run inside Linux/WSL Ubuntu.")

chapter2 = next(SOURCE.glob("02-*.md"))
chapter3 = next(SOURCE.glob("03-*.md"))
worksheet = SOURCE / "详写第一批-练习与参考答案.md"

with tempfile.TemporaryDirectory(prefix="os-detailed-batch01-") as folder:
    root = Path(folder) / "learner workspace"
    root.mkdir()

    def bash(script, expected=0, cwd=None):
        # Only substitute the tutorial's own practice root; leave HOME unchanged.
        script = script.replace("~/os-lab", shlex.quote(str(root / "os-lab")))
        return run(["bash", "-c", "set -e\n" + script], cwd or root, expected)

    setup = blocks(section(chapter2, "2.10 第一步：确认位置，再建立练习目录"), "bash")
    result = bash("\n".join(setup))
    work = root / "os-lab" / "lesson02"
    check("chapter02 setup enters intended directory", result.stdout.splitlines()[-1] == str(work))
    create = blocks(section(chapter2, "2.12 第三步：创建一份能读回来的笔记"), "bash")
    result = bash(create[0], cwd=work)
    check("redirection prints nothing to terminal", result.stdout == "")
    check("redirection creates expected bytes", (work / "note.txt").read_bytes() == b"My first OS note\n")
    result = bash(create[2], cwd=work)
    check("cat reads saved note", result.stdout == "My first OS note\n")
    bash("mkdir -p notes", cwd=work)
    result = bash("cd notes\npwd", cwd=work)
    check("cd changes lookup origin", result.stdout.strip() == str(work / "notes"))
    result = bash("cd notes\ncat note.txt", expected=1, cwd=work)
    check("wrong relative path fails", bool(result.stderr))
    result = bash("cd notes\ncat ../note.txt", cwd=work)
    check("parent-relative path succeeds", result.stdout == "My first OS note\n")
    result = bash("cd notes\ncd ..\ncat note.txt", cwd=work)
    check("returning to parent restores relative lookup", result.stdout == "My first OS note\n")
    result = bash("cat Note.txt", expected=1, cwd=work)
    check("Linux temporary filesystem distinguishes filename case", bool(result.stderr))

    review_steps = blocks(section(worksheet, "六、参考答案：终端操作"), "bash")[0]
    result = bash(review_steps)
    check("worksheet commands find same file from three positions",
          result.stdout.splitlines()[1:] == ["I can find my files."] * 3)

    def compile_code(name, code, success=True):
        source = root / (name + ".c")
        source.write_text(code + "\n", encoding="utf-8")
        args = ["gcc", "-std=c17", "-Wall", "-Wextra", "-Wpedantic", "-Werror", "-g",
                str(source), "-o", str(root / name)]
        result = subprocess.run(args, cwd=root, text=True, capture_output=True, timeout=10)
        check("compilation " + name + (" succeeds" if success else " deliberately fails"),
              (result.returncode == 0) == success)
        if success:
            check("no compiler warnings: " + name, result.stderr == "")
        else:
            check("compiler identifies source: " + name, name + ".c" in result.stderr)
        return root / name

    hello_code = blocks(section(chapter3, "3.4 第一份完整程序 hello.c"), "c")[0]
    check("printed baseline matches downloadable hello.c",
          hello_code.strip() == (SOURCE / "示例代码" / "hello.c").read_text(encoding="utf-8").strip())
    hello = compile_code("hello", hello_code)
    check("baseline output", run([str(hello)], root).stdout == "Hello, operating systems!\n")

    two_lines = blocks(section(chapter3, "3.12 实验一：把输出改成两行"), "c")[0]
    (root / "hello.c").write_text(two_lines + "\n", encoding="utf-8")
    check("editing source alone leaves previous binary behavior",
          run([str(hello)], root).stdout == "Hello, operating systems!\n")
    hello = compile_code("hello", two_lines)
    expected_lines = "I am learning C.\nI can run my first program.\n"
    check("recompilation applies two-line edit", run([str(hello)], root).stdout == expected_lines)

    status_code = blocks(section(chapter3, "3.13 实验二：显示内容与退出状态是两回事"), "c")[0]
    status = compile_code("status", status_code)
    result = run([str(status)], root, 9)
    check("status experiment prints independent message", result.stdout == "This program returns 9.\n")
    # Inspect the nonzero status using a shell that continues to echo it.
    result = run(["bash", "-c", "./status\necho $?"] , root)
    check("immediate echo observes status 9", result.stdout == "This program returns 9.\n9\n")
    result = run(["bash", "-c", "./status\ntrue\necho $?"] , root)
    check("an intervening command replaces previous status", result.stdout.endswith("\n0\n"))
    status = compile_code("status", status_code.replace("return 9;", "return 0;"))
    check("changing return preserves displayed text", run([str(status)], root).stdout == "This program returns 9.\n")

    wrong = blocks(section(chapter3, "3.14 实验三：故意制造一个可理解的编译错误"), "c")[0]
    compile_code("broken", wrong, success=False)
    fixed = wrong.replace('printf("Can you find the missing symbol?\\n")',
                          'printf("Can you find the missing symbol?\\n");')
    check("repair changes exactly one missing semicolon", fixed != wrong)
    broken = compile_code("broken", fixed)
    check("fixed example runs", run([str(broken)], root).stdout == "Can you find the missing symbol?\n")

    review_code = blocks(section(worksheet, "七、参考答案：完整程序和编译"), "c")[0]
    review = compile_code("review", review_code)
    check("worksheet reference program", run([str(review)], root).stdout ==
          "I wrote this file myself.\nI can explain each step.\n")
    for value in ["5", "9"]:
        review = compile_code("review", review_code.replace("return 0;", "return " + value + ";"))
        check("worksheet nonzero status " + value,
              run([str(review)], root, int(value)).stdout.startswith("I wrote this file myself."))

report = {
    "date": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),
    "edition": "零基础详细版", "batch": 1, "chapters": ["01", "02", "03"],
    "passed": True, "checks": len(checks), "scenarios": checks,
    "compiler": subprocess.check_output(["gcc", "--version"], text=True).splitlines()[0],
    "limits": ["No fresh WSL installation", "No automated nano keystroke test",
               "Conceptual understanding is not certified by automated tests"],
}
(HERE / "详写第一批测试结果.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: report[key] for key in ["date", "batch", "chapters", "checks", "passed"]}, ensure_ascii=False))
