"""Chapter 58 complete entrypoint: synthetic statistics, not causal inference."""
import json
from lab import analyze

def main():
    _, summary, _ = analyze()
    print(json.dumps(summary, ensure_ascii=False, allow_nan=False, indent=2))

if __name__ == "__main__": main()
