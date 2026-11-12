"""Author checks for this course only. Python 3.10+ and GCC required.

Run from the repository root:
    python content/data-structures-algorithms/source/验证/verify-stage1.py
Use --cc /path/to/gcc to choose an existing compiler; no installation is done.
"""
import argparse
import json
import os
from pathlib import Path
import random
import re
import subprocess
import tempfile
from datetime import datetime, timezone, timedelta

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
COURSE = SOURCE.parent
RESULT = HERE / "第一阶段检查结果.json"
checks = []


def check(label, condition, detail=""):
    checks.append({"name": label, "passed": bool(condition), "detail": detail})
    if not condition:
        raise AssertionError(f"{label}: {detail}")


def process(args, data=None):
    return subprocess.run(args, input=data, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=15)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cc", default="gcc")
    args = parser.parse_args()
    version = process([args.cc, "--version"])
    check("compiler starts", version.returncode == 0, version.stderr)
    compiler = version.stdout.splitlines()[0]
    programs = [
        ("02", "02-hello/hello.c"), ("03", "03-values/values.c"),
        ("04", "04-input/input.c"), ("05", "05-branches/branches.c"),
        ("06", "06-loops/sum.c"), ("07", "07-functions/functions.c"),
        ("08", "08-arrays/arrays.c"), ("answer", "stage1-stats/stats.c"),
    ]
    chapters = sorted(SOURCE.glob("[0-9][0-9]-*.md"))
    lessons = [p for p in chapters if 1 <= int(p.name[:2]) <= 98]
    stage1 = [p for p in lessons if int(p.name[:2]) <= 8]
    check("first eight stable main chapters", [p.name[:2] for p in stage1] == [f"{i:02d}" for i in range(1, 9)])
    for chapter in stage1:
        body = chapter.read_text(encoding="utf-8")
        for word in ["目标与先修", "常见错误", "练习与参考答案", "完成条件"]:
            check(f"{chapter.name}: {word}", word in body)
    for md in SOURCE.rglob("*.md"):
        for link in re.findall(r"\[[^\]]*\]\(([^)]+)\)", md.read_text(encoding="utf-8")):
            if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", link) or link.startswith("#"):
                continue
            target = (md.parent / link.split("#")[0]).resolve()
            check(f"local link: {md.name} -> {link}", target.is_relative_to(COURSE) and target.exists())
    if (COURSE / "course.json").exists():
        meta = json.loads((COURSE / "course.json").read_text(encoding="utf-8"))
        check("registered count and ongoing status", meta["stats"]["chapters"] == len(lessons) and meta["status"] == "ongoing")

    sources = {}
    for key, rel in programs:
        code = (SOURCE / "示例代码" / rel).read_text(encoding="utf-8")
        md = next(SOURCE.glob(f"{key}-*.md")) if key != "answer" else SOURCE / "第一阶段-参考答案.md"
        blocks = re.findall(r"```c\n(.*?)\n```", md.read_text(encoding="utf-8"), re.S)
        complete = [b for b in blocks if "int main(void)" in b]
        check(f"text/source match: {rel}", len(complete) == 1 and complete[0].strip() == code.strip())
        sources[key] = code

    # TemporaryDirectory only owns its newly created directory under the OS temp root.
    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix="dsa-stage1-", dir=temp_root) as folder:
        work = Path(folder).resolve()
        check("temporary directory contained", work.parent == temp_root and work.name.startswith("dsa-stage1-"))
        sequence = 0

        def compile_code(label, code, success=True):
            nonlocal sequence
            sequence += 1
            source = work / f"case{sequence}.c"
            output = work / (f"case{sequence}.exe" if os.name == "nt" else f"case{sequence}")
            source.write_text(code, encoding="utf-8")
            result = process([args.cc, "-std=c17", "-Wall", "-Wextra", "-Wpedantic", "-Werror", str(source), "-o", str(output)])
            check(f"compile: {label}", (result.returncode == 0) == success,
                  result.stderr if (result.returncode == 0) != success else "")
            return output

        def run(label, exe, expected, data=None, status=0):
            result = process([str(exe)], data)
            check(label, result.returncode == status and result.stdout == expected and result.stderr == "",
                  "" if (result.returncode == status and result.stdout == expected and result.stderr == "")
                  else repr({"status": result.returncode, "out": result.stdout, "err": result.stderr, "expected": expected}))

        exe = {key: compile_code(key, code) for key, code in sources.items()}
        run("hello output", exe["02"], "Hello, algorithms!\n")
        changed = compile_code("hello edited and rebuilt", sources["02"].replace("Hello, algorithms!", "I can rebuild C programs."))
        run("rebuilt output changes", changed, "I can rebuild C programs.\n")
        changed = compile_code("exit seven", sources["02"].replace("return 0;", "return 7;"))
        run("exit status independent of display", changed, "Hello, algorithms!\n", status=7)
        compile_code("missing semicolon rejected", sources["02"].replace('puts("Hello, algorithms!");', 'puts("Hello, algorithms!")'), False)
        compile_code("const write rejected", sources["03"].replace("    return 0;", "    minutes_per_hour = 30;\n    return 0;"), False)
        for value in [135, 0, 59, 60, 61]:
            selected = exe["03"] if value == 135 else compile_code(f"minutes {value}", sources["03"].replace("= 135;", f"= {value};"))
            expected = f"hours={value // 60}\nremaining={value % 60}\ninteger_average={value // 2}\naverage={value / 2:.2f}\nunit=m\nnew_total={value + 15}\n"
            run(f"conversion {value}", selected, expected)

        for digit in range(10):
            expected = f"hours={digit}\nminutes={digit * 60}\n"
            run(f"single digit {digit} newline", exe["04"], expected, f"{digit}\n")
            run(f"single digit {digit} EOF", exe["04"], expected, str(digit))
            level = "excellent" if digit >= 8 else "keep-going" if digit >= 5 else "start-small"
            run(f"branch threshold {digit}", exe["05"], level + "\n", f"{digit}\n")
        invalid_single = ["", "\n", "a\n", "12\n", " 3\n", "3 \n", "-1\n", "+1\n", "1.0\n", "3x\n"]
        for key in ["04", "05"]:
            for index, data in enumerate(invalid_single):
                run(f"{key} invalid line {index}", exe[key], "invalid input\n", data, 1)

        for n in [5, 0, 1, 100]:
            selected = exe["06"] if n == 5 else compile_code(f"loop n={n}", sources["06"].replace("int n = 5;", f"int n = {n};"))
            expected = "".join(f"i={i} total={i * (i + 1) // 2}\n" for i in range(1, n + 1)) + f"sum={n * (n + 1) // 2}\n"
            run(f"loop boundary {n}", selected, expected)
        def fragments(chapter):
            md = next(SOURCE.glob(chapter + "-*.md")).read_text(encoding="utf-8")
            return re.findall(r"```c\n(.*?)\n```", md, re.S)

        def snippet_program(fragment):
            return "#include <stdio.h>\nint main(void)\n{\n" + fragment + "\nreturn 0;\n}\n"

        loop_blocks = fragments("06")
        while_block = next(b for b in loop_blocks if b.startswith("int remaining = 3;"))
        do_block = next(b for b in loop_blocks if b.startswith("int remaining = 0;"))
        flow_block = next(b for b in loop_blocks if "continue;" in b)
        for label, block, expected in [("while countdown", while_block, "3\n2\n1\n"),
                                        ("while zero iterations", while_block.replace("= 3;", "= 0;"), ""),
                                        ("do while runs once", do_block, "0\n"),
                                        ("break and continue", flow_block, "1\n3\n")]:
            selected = compile_code(label, snippet_program(block))
            run(label, selected, expected)
        switch_block = next(b for b in fragments("05") if "switch (option)" in b)
        for option, expected in [(1, "add\n"), (2, "list\n"), (3, "unknown\n")]:
            selected = compile_code(f"switch option {option}", snippet_program(switch_block.replace("= 2;", f"= {option};")))
            run(f"switch branch {option}", selected, expected)
        selected = compile_code("switch intentional fallthrough", snippet_program(switch_block.replace("= 2;", "= 1;").replace("    break;\n", "    /* fall through */\n", 1)))
        run("switch fallthrough explanation", selected, "add\nlist\n")
        larger = next(b for b in fragments("07") if b.startswith("int larger("))
        selected = compile_code("larger definition fragment", "#include <stdio.h>\n" + larger + '\nint main(void) { printf("%d %d %d\\n", larger(3, 7), larger(8, 2), larger(5, 5)); return 0; }\n')
        run("larger including equality", selected, "7 8 5\n")
        run("value parameters leave caller unchanged", exe["07"], "minutes=30\nresult=45\ngoal=60\n")
        changed = compile_code("explicit result writeback", sources["07"].replace('    printf("minutes=', '    minutes = result;\n    printf("minutes='))
        run("explicit writeback changes caller", changed, "minutes=45\nresult=45\ngoal=60\n")

        array_cases = [([30, 0, 45, 15, 60], 45), ([], 45), ([45], 45), ([0, 0, 0], 45),
                       ([45, 15, 45], 45), ([10, 20, 45], 45), ([10, 20, 30], 45), ([1440] * 7, 1440)]
        for index, (values, target) in enumerate(array_cases):
            code = sources["08"].replace("{30, 0, 45, 15, 60}", "{" + ", ".join(map(str, values or [0])) + "}")
            code = code.replace("int count = 5;", f"int count = {len(values)};").replace("int target = 45;", f"int target = {target};")
            selected = exe["08"] if index == 0 else compile_code(f"array case {index}", code)
            if not values:
                expected = "empty\n"
            else:
                first = values.index(target) if target in values else -1
                expected = f"count={len(values)} total={sum(values)} min={min(values)} max={max(values)}\naverage={sum(values)/len(values):.2f} active={sum(v > 0 for v in values)} first={first}\n"
            run(f"array boundary {index}", selected, expected)

        def report(values, target):
            if not values:
                return "count=0\nempty\n"
            total = sum(values)
            active = sum(v > 0 for v in values)
            active_avg = f"{total / active:.2f}" if active else "NA"
            first = values.index(target) if target in values else -1
            return (f"count={len(values)}\ntotal={total}\nmin={min(values)}\nmax={max(values)}\n"
                    f"average={total / len(values):.2f}\nactive={active}\nactive_average={active_avg}\nfirst={first}\n")

        cases = array_cases + [([0], 0), ([30, 0, 45, 15, 60], 45), ([0] * 7, 0)]
        rng = random.Random(20261111)
        for _ in range(60):
            values = [rng.randrange(1441) for _ in range(rng.randrange(8))]
            target = rng.choice(values) if values and rng.randrange(2) else rng.randrange(1441)
            cases.append((values, target))
        for index, (values, target) in enumerate(cases):
            lines = [str(len(values))] + [str(v) for v in values] + ([str(target)] if values else [])
            for ending in ["\n", ""]:
                run(f"project normal {index} ending={ending!r}", exe["answer"], report(values, target), "\n".join(lines) + ending)
        run("leading zeros", exe["answer"], report([45], 45), "0001\n00045\n00045")
        run("long leading zeros without count overflow", exe["answer"], report([60], 60), "0" * 1000 + "1\n60\n60\n")
        invalid = ["8", "10", "-1", "+1", "", "a", "1.5", "1 2", " 1", "1 ", "2147483648", "9" * 5000]
        for index, value in enumerate(invalid):
            run(f"project invalid count {index}", exe["answer"], "invalid count\n", value + "\n", 1)
        invalid_values = ["1441", "-1", "+1", "", "a", "12x", "1.5", "1 2", " 1", "1 ", "2147483648", "9" * 5000]
        for index, value in enumerate(invalid_values):
            run(f"project invalid minutes {index}", exe["answer"], "invalid minutes\n", "1\n" + value + "\n0\n", 1)
            run(f"project invalid target {index}", exe["answer"], "invalid target\n", "1\n30\n" + value + "\n", 1)
        for data, message in [("", "count"), ("1\n", "minutes"), ("1\n30\n", "target")]:
            run(f"project missing {message}", exe["answer"], f"invalid {message}\n", data, 1)

        # Benign wrong variants demonstrate that the oracle distinguishes errors.
        changed = compile_code("wrong division order", sources["03"].replace("(double)total_minutes / 2", "total_minutes / 2"))
        result = process([str(changed)])
        check("oracle detects late floating conversion", result.returncode == 0 and "average=67.00\n" in result.stdout and "average=67.50\n" not in result.stdout)
        changed = compile_code("wrong last-match variant", sources["answer"].replace("value == target && first == -1", "value == target"))
        result = process([str(changed)], "3\n45\n15\n45\n45\n")
        check("oracle detects first/last confusion", result.returncode == 0 and result.stdout != report([45, 15, 45], 45) and result.stdout.endswith("first=2\n"))

    return compiler


if __name__ == "__main__":
    passed = False
    compiler = "not recorded"
    error = ""
    try:
        compiler = main()
        passed = True
    except Exception as exc:
        error = str(exc)
    payload = {
        "date": datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
        "platform": os.name, "compiler": compiler, "passed": passed,
        "checks": len(checks), "completePrograms": 8,
        "scope": "C17 stage 1, source/text consistency, normal/error outputs and bounded input; no installer or GUI automation",
        "error": error, "results": checks,
    }
    RESULT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in payload.items() if k != "results"}, ensure_ascii=True))
    raise SystemExit(0 if passed else 1)
