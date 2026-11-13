"""Chapter 60: copy this project, run from another cwd, compare every artifact."""
from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from lab import HERE, sha256

def main():
    parser = argparse.ArgumentParser(description="Same-environment clean-copy reproducibility check")
    parser.add_argument("--output", required=True, help="new directory for the evidence JSON")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists(): parser.error("output path already exists")
    output.parent.mkdir(parents=True, exist_ok=True)
    runs = []
    # This temporary directory is ours, and its resolved parent is checked before use/cleanup.
    with tempfile.TemporaryDirectory(prefix="stage10-reproduce-", dir=output.parent) as temporary:
        temp = Path(temporary).resolve()
        if temp.parent != output.parent: raise RuntimeError("unsafe temporary parent")
        project = temp / "project"
        project.mkdir()
        for file in HERE.glob("*.py"): shutil.copy2(file, project / file.name)
        shutil.copy2(HERE / "requirements.txt", project / "requirements.txt")
        shutil.copytree(HERE / "data", project / "data")
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8", "MPLCONFIGDIR": str(temp / "mpl")}
        for name in ["first", "second"]:
            result = subprocess.run([sys.executable, "-B", str(project / "report_project.py"), "--output", str(temp / name)],
                                    cwd=temp, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)
            if result.returncode: raise RuntimeError(result.stderr)
            runs.append({"run": name, "exitCode": result.returncode, "stdout": result.stdout.strip()})
        first = {p.name: sha256(p) for p in (temp / "first").iterdir() if p.is_file()}
        second = {p.name: sha256(p) for p in (temp / "second").iterdir() if p.is_file()}
        if first != second: raise RuntimeError("artifact hashes differ between clean-copy runs")
        record = {"successful": True, "scope": "same interpreter/libraries; new project copy and different cwd; not a fresh dependency install",
                  "runs": runs, "artifactHashes": first}
    output.mkdir(exist_ok=False)
    (output / "reproduction.json").write_text(json.dumps(record, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"successful": True, "runs": len(runs), "matchingArtifacts": len(first)}))

if __name__ == "__main__": main()
