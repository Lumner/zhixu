"""Package 50 completed chapters; preserve five historical ZIPs byte-for-byte."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    metadata=ROOT/("maintenance/course-meta.json" if "--draft" in sys.argv else "course.json")
    meta=json.loads(metadata.read_text(encoding="utf-8"))
    if meta["stats"]!={"chapters":50,"examples":47}: raise RuntimeError("Requires completed 50-chapter metadata")
    target=(ROOT/meta["download"]).resolve()
    if target.parent!=(ROOT/"downloads").resolve() or target.name!="western-economics-stages-1-8.zip": raise RuntimeError("Unexpected archive target")
    previous=[]
    for end,chapters in [(3,18),(4,26),(5,32),(6,38),(7,44)]:
        name=f"western-economics-stages-1-{end}.zip";file=ROOT/"downloads"/name
        with zipfile.ZipFile(file) as archive:
            if json.loads(archive.read("western-economics/course.json"))["stats"]["chapters"]!=chapters: raise RuntimeError("Wrong historical ZIP identity")
        previous.append({"name":name,"sha256":digest(file)})
    for name in ["example-results.json","stage4-results.json","stage5-results.json","stage6-results.json","stage7-results.json","stage8-results.json","content-results-stage8.json"]:
        report=json.loads((ROOT/"source/验证"/name).read_text(encoding="utf-8"))
        if report.get("successful") is not True: raise RuntimeError("Validation failed: "+name)
        for relative,expected in report.get("sourceHashes",{}).items():
            if digest(ROOT/"source"/relative)!=expected: raise RuntimeError("Stale runtime source: "+relative)
    files=[(f,f.relative_to(ROOT).as_posix()) for f in sorted((ROOT/"source").rglob("*")) if f.is_file()]
    extras=["README.md","integration-notes.md","maintenance/stage1-3-baseline.json"]
    extras += [f"maintenance/stages1-{end}-baseline.json" for end in range(4,8)]
    extras += [f"maintenance/stage{stage}-contract.md" for stage in range(4,9)]
    extras += ["maintenance/build_figures.py"]+[f"maintenance/build_stage{stage}_figures.py" for stage in range(4,9)]
    extras += ["maintenance/package_stage8.py"]
    files.extend((ROOT/name,name) for name in extras);files.append((metadata,"course.json"))
    for file,name in files:
        if any(part in file.parts for part in ["__pycache__",".venv","output","my-results","node_modules"]): raise RuntimeError("Unexpected run artifact: "+name)
    manifest={"date":"2026-11-13","chapters":50,"files":{name:digest(file) for file,name in files},
              "exclusions":["original PPT/PDF textbooks","research screenshots","runtime caches","all downloads ZIPs"]}
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target,"w",compression=zipfile.ZIP_DEFLATED) as archive:
        for file,name in files: archive.writestr("western-economics/"+name,file.read_bytes())
        archive.writestr("western-economics/package-manifest.json",json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    smoke=[]
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None: raise RuntimeError("CRC failed")
        for name,expected in manifest["files"].items():
            if hashlib.sha256(archive.read("western-economics/"+name)).hexdigest()!=expected: raise RuntimeError("Archive member mismatch: "+name)
        with tempfile.TemporaryDirectory(prefix="stage8-package-temp-",dir=ROOT) as temporary:
            temp=Path(temporary).resolve()
            if temp.parent!=ROOT.resolve(): raise RuntimeError("Unsafe extraction directory")
            for name in archive.namelist():
                if not (temp/name).resolve().is_relative_to(temp): raise RuntimeError("Unsafe member path")
            archive.extractall(temp);unpacked=temp/"western-economics"
            baseline=json.loads((unpacked/"maintenance/stages1-7-baseline.json").read_text(encoding="utf-8"))
            if len(baseline)!=99: raise RuntimeError("Wrong prior baseline size")
            for name,expected in baseline.items():
                if digest(unpacked/name)!=expected: raise RuntimeError("Unpacked prior source mismatch: "+name)
            env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1","PYTHONIOENCODING":"utf-8"}
            programs=["market_lab.py","csv_io.py","stage4/micro_lab.py","stage5/policy_lab.py","stage6/macro_lab.py","stage7/demand_lab.py"]+["stage8/"+n for n in ["ad_as.py","expectations.py","cycles.py","fiscal.py","monetary_rule.py","debt.py","policy_lab.py"]]
            for relative in programs:
                result=subprocess.run([sys.executable,str(unpacked/"source/示例代码"/relative)],cwd=temp,env=env,capture_output=True,text=True,encoding="utf-8",timeout=15)
                if result.returncode: raise RuntimeError("Unpacked entrypoint failed: "+relative+result.stderr)
                if relative=="stage8/policy_lab.py":
                    row=json.loads(result.stdout)
                    if row["version"]!="0.4" or abs(row["ad_as"]["output"]-700)>1e-8 or abs(row["debt"][1]["debt"]-580.72)>1e-8 or row["origin"]!="synthetic_teaching_parameters": raise RuntimeError("Unpacked policy result mismatch")
                smoke.append({"program":relative,"exitCode":result.returncode})
    for old in previous:
        if digest(ROOT/"downloads"/old["name"])!=old["sha256"]: raise RuntimeError("Historical ZIP changed")
    checks={"date":"2026-11-13","successful":True,"archive":target.name,"filesInArchive":len(files)+1,"bytes":target.stat().st_size,
            "sha256":digest(target),"smokeRuns":smoke,"preservedArchives":previous,
            "verified":["CRC","all member SHA-256","thirteen clean-extraction entrypoints","ninety-nine prior source hashes","five unchanged historical ZIPs"]}
    (ROOT/"package-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (ROOT/"package-checks.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(checks))

if __name__=="__main__": main()
