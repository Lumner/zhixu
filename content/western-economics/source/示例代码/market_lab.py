"""Chapter 18: v0.1 complete CLI; reads only synthetic model parameters."""
import argparse
import json
from econ import equilibrium, taxed_market, price_control


def main():
    parser = argparse.ArgumentParser(description="Synthetic linear market experiment")
    parser.add_argument("--tax", type=float, default=10)
    parser.add_argument("--ceiling", type=float, default=20)
    parser.add_argument("--floor", type=float, default=30)
    args = parser.parse_args()
    try:
        report = {
            "assumptions": "Qd=120-2Pc, Qs=3Ps; interior, competition, no externalities",
            "baseline": equilibrium(),
            "tax_scenario": taxed_market(args.tax),
            "ceiling_scenario": price_control("ceiling", args.ceiling),
            "floor_scenario": price_control("floor", args.floor),
        }
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
