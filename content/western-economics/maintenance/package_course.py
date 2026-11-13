"""Build only this course's learning ZIP; never include supplied source textbooks."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "course.json"
if not META.exists():
    META = ROOT / "maintenance" / "course-meta.json"
OUTPUT = ROOT / "downloads" / "western-economics-stages-1-3.zip"


def main():
    current = json.loads(META.read_text(encoding="utf-8"))
    if current["stats"]["chapters"] != 18:
        raise RuntimeError("This exporter is for the historical 18-chapter batch; use package_stage4.py for the cumulative package")
    for name in ["example-results.json", "content-results.json"]:
        result = json.loads((ROOT / "source" / "验证" / name).read_text(encoding="utf-8"))
        if result.get("successful") is not True:
            raise RuntimeError(f"Validation not successful: {name}")
    sources = [(f, f.relative_to(ROOT).as_posix()) for f in sorted((ROOT / "source").rglob("*")) if f.is_file()]
    sources += [(ROOT / name, name) for name in ["README.md", "integration-notes.md"]]
    sources += [(META, "course.json")]
    for file, name in sources:
        if any(x in file.parts for x in ["__pycache__", ".venv", "output", "node_modules"]):
            raise RuntimeError("Unexpected run artifact: " + str(file))
    manifest = {
        "date": "2026-11-12", "chapters": 18,
        "files": {name: hashlib.sha256(file.read_bytes()).hexdigest() for file, name in sources},
        "exclusions": ["research screenshots", "local PPT/PDF textbooks", "runtime caches", "downloads ZIP itself"],
    }
    OUTPUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file, name in sources:
            archive.writestr("western-economics/" + name, file.read_bytes())
        archive.writestr("western-economics/package-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP CRC failure")
        for name, expected in manifest["files"].items():
            if hashlib.sha256(archive.read("western-economics/"+name)).hexdigest() != expected:
                raise RuntimeError("ZIP content mismatch: " + name)
        with tempfile.TemporaryDirectory(prefix="package-temp-", dir=ROOT) as temporary:
            temp_path = Path(temporary).resolve()
            if temp_path.parent != ROOT.resolve():
                raise RuntimeError("Unsafe extraction path")
            for name in archive.namelist():
                target = (temp_path / name).resolve()
                if not target.is_relative_to(temp_path):
                    raise RuntimeError("Archive path escapes temporary directory")
            archive.extractall(temp_path)
            examples = temp_path / "western-economics" / "source" / "示例代码"
            env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
            for name in ["market_lab.py", "debug_demo.py", "csv_io.py"]:
                result = subprocess.run([sys.executable, str(examples / name)], cwd=temp_path, env=env, text=True, encoding="utf-8", capture_output=True, timeout=15)
                if result.returncode != 0:
                    raise RuntimeError("Unpacked program failed: " + name + result.stderr)
                if name == "market_lab.py" and json.loads(result.stdout)["baseline"]["quantity"] != 72:
                    raise RuntimeError("Unpacked market output mismatch")
    check = {
        "date": "2026-11-12", "successful": True, "filesInArchive": len(sources)+1,
        "bytes": OUTPUT.stat().st_size, "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
        "archive": OUTPUT.name, "verified": ["ZIP CRC", "all member SHA-256", "course metadata", "source-only selection", "three entrypoints from clean extraction"],
    }
    (ROOT / "package-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (ROOT / "package-checks.json").write_text(json.dumps(check, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(check))


if __name__ == "__main__":
    main()
