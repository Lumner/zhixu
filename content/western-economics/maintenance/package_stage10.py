"""Package the complete 60-chapter course and verify a clean extraction."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
HISTORICAL = [
    (3, 18, "29d3efa11f687f9ca1e48eab2ce2cfa1e80de3f7c2e0db19f7a4474659fdd7cc"),
    (4, 26, "1ba3ba4db6255a5cd1b63b452454c01fc37521ea86a534390c84d4b1ebc51585"),
    (5, 32, "cb497fb2c7ae19c99791e253af3b81e34c63dc512b013580d5180663414c3697"),
    (6, 38, "18ef6ed6d339571744692bc3e691c281391d67c0faab99f47b57bcdb0b2b846a"),
    (7, 44, "118e4e5d158c2fc10d2e6a208e2a6cc0ad3018156f831b8545bff00b1cbf7aa0"),
    (8, 50, "3d3913001ce877000ae60a966b96e5c856c49726321863b9c1b5f5865e2a5e86"),
    (9, 56, "336e5ad7dc4bf45a911502626ae4901c9ab44e68978681aaad507f6f34b92121"),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    metadata = ROOT / ("maintenance/course-meta.json" if "--draft" in sys.argv else "course.json")
    meta = json.loads(metadata.read_text(encoding="utf-8"))
    if meta["stats"] != {"chapters": 60, "examples": 58} or meta["status"] != "complete":
        raise RuntimeError("Requires completed 60-chapter metadata")
    target = (ROOT / meta["download"]).resolve()
    if target.parent != (ROOT / "downloads").resolve() or target.name != "western-economics-complete.zip":
        raise RuntimeError("Unexpected archive target")
    previous = []
    for end, chapters, expected in HISTORICAL:
        name = f"western-economics-stages-1-{end}.zip"
        file = ROOT / "downloads" / name
        if digest(file) != expected: raise RuntimeError("Historical ZIP changed: " + name)
        with zipfile.ZipFile(file) as archive:
            if json.loads(archive.read("western-economics/course.json"))["stats"]["chapters"] != chapters:
                raise RuntimeError("Wrong historical ZIP identity")
        previous.append({"name": name, "sha256": expected})
    reports = ["example-results.json"] + [f"stage{n}-results.json" for n in range(4, 11)] + ["content-results-stage10.json"]
    for name in reports:
        report = json.loads((ROOT / "source/验证" / name).read_text(encoding="utf-8"))
        if report.get("successful") is not True: raise RuntimeError("Validation failed: " + name)
        for relative, expected in {**report.get("sourceHashes", {}), **report.get("referenceHashes", {})}.items():
            if digest(ROOT / "source" / relative) != expected: raise RuntimeError("Stale verified source/output: " + relative)

    files = [(f, f.relative_to(ROOT).as_posix()) for f in sorted((ROOT / "source").rglob("*")) if f.is_file()]
    extras = [".gitignore", "README.md", "integration-notes.md", "maintenance/stage1-3-baseline.json"]
    extras += [f"maintenance/stages1-{end}-baseline.json" for end in range(4, 10)]
    extras += [f"maintenance/stage{stage}-contract.md" for stage in range(4, 11)]
    extras += ["maintenance/build_figures.py"] + [f"maintenance/build_stage{stage}_figures.py" for stage in range(4, 11)]
    extras += ["maintenance/package_stage10.py"]
    files.extend((ROOT / name, name) for name in extras)
    files.append((metadata, "course.json"))
    for file, name in files:
        if any(part in file.parts for part in ["__pycache__", ".venv", ".venv-economics", "output", "my-results", "node_modules", ".cache"]):
            raise RuntimeError("Unexpected run artifact: " + name)
    manifest = {"date": "2026-11-13", "chapters": 60, "files": {name: digest(file) for file, name in files},
                "exclusions": ["original PPT/PDF textbooks", "research screenshots", "runtime caches", "Python and third-party packages", "all downloads ZIPs"]}
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file, name in files: archive.writestr("western-economics/" + name, file.read_bytes())
        archive.writestr("western-economics/package-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    smoke = []
    nested = 0
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None: raise RuntimeError("CRC failed")
        for name, expected in manifest["files"].items():
            if hashlib.sha256(archive.read("western-economics/" + name)).hexdigest() != expected:
                raise RuntimeError("Archive member mismatch: " + name)
        with tempfile.TemporaryDirectory(prefix="stage10-package-temp-", dir=ROOT) as temporary:
            temp = Path(temporary).resolve()
            if temp.parent != ROOT.resolve(): raise RuntimeError("Unsafe extraction directory")
            for name in archive.namelist():
                if not (temp / name).resolve().is_relative_to(temp): raise RuntimeError("Unsafe member path")
            archive.extractall(temp)
            unpacked = temp / "western-economics"
            baseline = json.loads((unpacked / "maintenance/stages1-9-baseline.json").read_text(encoding="utf-8"))
            if len(baseline) != 127: raise RuntimeError("Wrong prior baseline size")
            for name, expected in baseline.items():
                if digest(unpacked / name) != expected: raise RuntimeError("Unpacked prior source mismatch: " + name)
            env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8", "MPLCONFIGDIR": str(temp / "mpl")}
            programs = [(n, []) for n in ["market_lab.py", "csv_io.py", "stage4/micro_lab.py", "stage5/policy_lab.py", "stage6/macro_lab.py", "stage7/demand_lab.py", "stage8/policy_lab.py", "stage9/global_growth_lab.py", "stage10/arrays_tables.py", "stage10/statistics_demo.py"]]
            programs += [("stage10/report_project.py", ["--output", str(temp / "report-output")]),
                         ("stage10/reproduce.py", ["--output", str(temp / "reproduction-output")])]
            for relative, args in programs:
                result = subprocess.run([sys.executable, "-B", str(unpacked / "source/示例代码" / relative), *args],
                                        cwd=temp, env=env, capture_output=True, text=True, encoding="utf-8", timeout=60)
                if result.returncode: raise RuntimeError("Unpacked entrypoint failed: " + relative + result.stderr)
                if relative == "stage10/report_project.py":
                    reference = unpacked / "source/最终实践参考结果"
                    for file in reference.iterdir():
                        if file.is_file() and digest(file) != digest(temp / "report-output" / file.name):
                            raise RuntimeError("Unpacked reference differs: " + file.name)
                if relative == "stage10/reproduce.py":
                    record = json.loads((temp / "reproduction-output/reproduction.json").read_text(encoding="utf-8"))
                    if not record["successful"] or len(record["artifactHashes"]) != 11: raise RuntimeError("Unpacked reproduction failed")
                    nested += len(record["runs"])
                smoke.append({"program": relative, "exitCode": result.returncode})
    for old in previous:
        if digest(ROOT / "downloads" / old["name"]) != old["sha256"]: raise RuntimeError("Historical ZIP changed")
    checks = {"date": "2026-11-13", "successful": True, "archive": target.name, "filesInArchive": len(files)+1,
              "bytes": target.stat().st_size, "sha256": digest(target), "smokeRuns": smoke,
              "directSubprocessRuns": len(smoke), "nestedSubprocessRuns": nested, "subprocessRuns": len(smoke)+nested,
              "preservedArchives": previous, "verified": ["CRC", "all member SHA-256", "12 extracted entrypoints plus 2 internal reproduction runs",
                  "11 generated reference artifacts", "127 prior source hashes", "seven unchanged historical ZIPs"]}
    (ROOT / "package-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (ROOT / "package-checks.json").write_text(json.dumps(checks, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(checks))


if __name__ == "__main__": main()
