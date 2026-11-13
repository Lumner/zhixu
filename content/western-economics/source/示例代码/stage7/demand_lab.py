"""v0.4a fixed-price teaching CLI; fictional parameters, no empirical forecast."""
import argparse
import json
from short_run import parameters,goods_equilibrium,is_lm,floor_equilibrium,multipliers,banking_demo

def main():
    parser=argparse.ArgumentParser(description="Fixed-price demand lab v0.4a; synthetic parameters")
    parser.add_argument("--g-change",type=float,default=0)
    parser.add_argument("--money-change",type=float,default=0)
    parser.add_argument("--regime",choices=["ordinary","floor"],default="ordinary")
    parser.add_argument("--floor",type=float,default=0)
    parser.add_argument("--mpc",type=float,default=.75)
    parser.add_argument("--tax-rate",type=float,default=.2)
    parser.add_argument("--import-propensity",type=float,default=0)
    try:
        args=parser.parse_args()
        if args.regime=="ordinary" and args.floor!=0: raise ValueError("--floor applies only to --regime floor")
        base_parameters=parameters(mpc=args.mpc,tax_rate=args.tax_rate,import_propensity=args.import_propensity)
        changed=dict(base_parameters);changed["g"]+=args.g_change;changed["money"]+=args.money_change
        changed=parameters(**changed)
        def solve(p):
            if args.regime=="ordinary": return is_lm(p)
            return floor_equilibrium(p,args.floor)
        base=solve(base_parameters);scenario=solve(changed)
        report={"version":"0.4a","origin":"synthetic_teaching_parameters","scope":"Fixed prices, expected inflation zero, no causal estimate or real-world forecast",
                "units":{"flows":"same-period fixed-price teaching units","money":"nominal stock","interest":"decimal; 0.04 is 4%"},
                "base_parameters":base_parameters,"scenario_parameters":changed,"base":base,"scenario":scenario,
                "changes":{key:scenario[key]-base[key] for key in ["output","interest","consumption","investment","taxes"]},
                "fixed_zero_interest_goods_example":goods_equilibrium(base_parameters),"multipliers":multipliers(base_parameters),
                "independent_bank_ledger":banking_demo()}
        print(json.dumps(report,ensure_ascii=True,allow_nan=False,indent=2))
    except ValueError as exc: parser.error(str(exc))

if __name__=="__main__": main()
