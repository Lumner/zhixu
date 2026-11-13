"""v0.4: independent macro-policy teaching experiments; no real-world forecast."""
import argparse
import json
from policy_models import ad_as,inflation_path,propagation_path,fiscal_budget,rule_equilibrium,debt_path

def main():
    parser=argparse.ArgumentParser(description="Independent macro-policy teaching blocks v0.4")
    parser.add_argument("--ad-shift",type=float,default=0)
    parser.add_argument("--cost-shock",type=float,default=0)
    parser.add_argument("--demand-gap",type=float,default=0)
    parser.add_argument("--inflation-shock",type=float,default=0)
    parser.add_argument("--interest",type=float,default=.05)
    parser.add_argument("--nominal-growth",type=float,default=.04)
    parser.add_argument("--primary-surplus",type=float,default=.01)
    parser.add_argument("--years",type=int,default=10)
    args=parser.parse_args()
    try:
        report={"version":"0.4","origin":"synthetic_teaching_parameters",
                "scope":"Independent price-level, inflation, cycle, nominal budget and debt blocks; no empirical forecast",
                "ad_as":ad_as(a=320+args.ad_shift,cost=args.cost_shock),
                "adaptive_expectations":inflation_path(),"propagation":propagation_path(),
                "budget_normal":fiscal_budget(),"budget_slump":fiscal_budget(output=630),
                "interest_rule":rule_equilibrium(demand=args.demand_gap,shock=args.inflation_shock),
                "debt":debt_path(years=args.years,interest=args.interest,growth=args.nominal_growth,primary_surplus=args.primary_surplus)}
        print(json.dumps(report,ensure_ascii=True,allow_nan=False,indent=2))
    except ValueError as exc: parser.error(str(exc))

if __name__=="__main__": main()
