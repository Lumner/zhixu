"""Package the completed 26-chapter batch, preserving the first learning ZIP."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    metadata = ROOT / ("maintenance/course-meta.json" if "--draft" in sys.argv else "course.json")
    meta = json.loads(metadata.read_text(encoding="utf-8"))
    if meta["stats"]["chapters"] != 26:
        raise RuntimeError("This package requires the completed 26-chapter batch")
    target = (ROOT / meta["download"]).resolve()
    if target.parent != (ROOT / "downloads").resolve() or target.name != "western-economics-stages-1-4.zip":
        raise RuntimeError("Unexpected download target")
    previous = ROOT / "downloads" / "western-economics-stages-1-3.zip"
    previous_hash = digest(previous)
    for name in ["example-results.json", "stage4-results.json", "content-results-stage4.json"]:
        result = json.loads((ROOT / "source" / "验证" / name).read_text(encoding="utf-8"))
        if result.get("successful") is not True:
            raise RuntimeError("Missing successful validation: " + name)
        for relative, expected in result.get("sourceHashes", {}).items():
            if digest(ROOT / "source" / relative) != expected:
                raise RuntimeError("Stale runtime source: " + relative)
    sources = [(f, f.relative_to(ROOT).as_posix()) for f in sorted((ROOT / "source").rglob("*")) if f.is_file()]
    for name in ["README.md", "integration-notes.md", "maintenance/stage1-3-baseline.json", "maintenance/build_stage4_figures.py", "maintenance/stage4-contract.md", "maintenance/package_stage4.py"]:
        sources.append((ROOT/name, name))
    sources.append((metadata, "course.json"))
    for file, name in sources:
        if any(item in file.parts for item in ["__pycache__", ".venv", "output", "node_modules"]):
            raise RuntimeError("Unexpected run artifact: " + name)
    manifest = {"date":"2026-11-13", "chapters":26,
                "files":{name:digest(file) for file,name in sources},
                "exclusions":["research screenshots", "reference PPT/PDF", "runtime caches", "downloads ZIPs"]}
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target,"w",compression=zipfile.ZIP_DEFLATED) as archive:
        for file,name in sources:
            archive.writestr("western-economics/"+name,file.read_bytes())
        archive.writestr("western-economics/package-manifest.json",json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    smoke=[]
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP CRC check failed")
        for name,expected in manifest["files"].items():
            if hashlib.sha256(archive.read("western-economics/"+name)).hexdigest()!=expected:
                raise RuntimeError("ZIP member hash mismatch: "+name)
        with tempfile.TemporaryDirectory(prefix="stage4-package-temp-",dir=ROOT) as temporary:
            temp_path=Path(temporary).resolve()
            if temp_path.parent != ROOT.resolve():
                raise RuntimeError("Unsafe temporary path")
            for name in archive.namelist():
                if not (temp_path/name).resolve().is_relative_to(temp_path):
                    raise RuntimeError("Archive path escapes extraction root")
            archive.extractall(temp_path)
            unpacked=temp_path/"western-economics"
            baseline=json.loads((unpacked/"maintenance"/"stage1-3-baseline.json").read_text(encoding="utf-8"))
            for name,expected in baseline.items():
                if digest(unpacked/name)!=expected:
                    raise RuntimeError("Unpacked prior-source mismatch: "+name)
            env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1","PYTHONIOENCODING":"utf-8"}
            for relative in ["market_lab.py","debug_demo.py","csv_io.py","stage4/micro_lab.py","stage4/cost_table.py","stage4/consumer_effects.py"]:
                result=subprocess.run([sys.executable,str(unpacked/"source"/"示例代码"/relative)],cwd=temp_path,env=env,capture_output=True,text=True,encoding="utf-8",timeout=15)
                if result.returncode:
                    raise RuntimeError("Unpacked program failed: "+relative+result.stderr)
                if relative=="stage4/micro_lab.py":
                    report=json.loads(result.stdout)
                    if report["competitive_firm"]["profit"]!=69 or report["long_run_cost"]["cost"]!=72:
                        raise RuntimeError("Unpacked micro lab result mismatch")
                smoke.append({"program":relative,"exitCode":result.returncode})
    if digest(previous)!=previous_hash:
        raise RuntimeError("Historical learning package changed")
    checks={"date":"2026-11-13","successful":True,"archive":target.name,
            "filesInArchive":len(sources)+1,"bytes":target.stat().st_size,"sha256":digest(target),
            "verified":["CRC","all archive member hashes","six clean-extraction entrypoints","thirty preserved prior files"],
            "smokeRuns":smoke,"preservedArchive":{"name":previous.name,"sha256":previous_hash}}
    (ROOT/"package-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (ROOT/"package-checks.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(checks))


if __name__=="__main__":
    main()
