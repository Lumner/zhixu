"""Chapter 59 complete CLI. A new output directory is required."""
import argparse
import json
from lab import build_project, defaults

def main():
    config = defaults()
    parser = argparse.ArgumentParser(description="Synthetic economics report v1.0; no causal policy forecast")
    parser.add_argument("--output", required=True, help="new directory; existing paths are refused")
    parser.add_argument("--seed", type=int, default=config["seed"])
    parser.add_argument("--replications", type=int, default=config["replications"])
    parser.add_argument("--income-change", type=float, default=config["income_change"])
    args = parser.parse_args()
    try:
        manifest = build_project(args.output, args.seed, args.replications, args.income_change)
    except (ValueError, FileExistsError) as exc:
        parser.error(str(exc))
    print(json.dumps({"version": manifest["version"], "origin": manifest["origin"], "outputs": len(manifest["outputs"])}))

if __name__ == "__main__": main()
