"""Stage 4 v0.2a integrated CLI: independent teaching models, not one economy."""
import argparse
import json
from micro import consumer_choice, slutsky_decomposition, insurance_summary
from micro import two_period_choice, competitive_firm, labor_choice, cost_minimization


def main():
    parser = argparse.ArgumentParser(description="Consumer and firm teaching experiments v0.2a")
    parser.add_argument("--income", type=float, default=120)
    parser.add_argument("--new-px", type=float, default=3)
    parser.add_argument("--price", type=float, default=30)
    parser.add_argument("--wage", type=float, default=16)
    args = parser.parse_args()
    try:
        report = {
            "version": "0.2a",
            "scope": "Independent synthetic models; no market structures or macroeconomics yet",
            "consumer": consumer_choice(income=args.income),
            "price_effects": slutsky_decomposition(income=args.income, new_px=args.new_px),
            "risk": insurance_summary(),
            "two_periods": two_period_choice(),
            "long_run_cost": cost_minimization(),
            "competitive_firm": competitive_firm(price=args.price),
            "labor_demand": labor_choice(wage=args.wage),
        }
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()
