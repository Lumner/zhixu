"""Stage 5 integrated CLI: independent micro models, not a real policy evaluator."""
import argparse
import json
from models import monopoly,cournot,pure_nash,exchange_equilibrium,externality
from models import abatement,public_good,commons,lemons,hidden_action,signaling_incentives


def main():
    parser=argparse.ArgumentParser(description="Microeconomics teaching experiments v0.2")
    parser.add_argument("--firms",type=int,default=2)
    parser.add_argument("--damage-slope",type=float,default=.25)
    parser.add_argument("--coverage",type=float,default=.5)
    args=parser.parse_args()
    try:
        report={"version":"0.2","scope":"Independent synthetic micro models; no macro or real-policy causal evaluation",
                "monopoly":monopoly(),"cournot":cournot(args.firms),"pure_nash":pure_nash(),
                "exchange":exchange_equilibrium(),"externality":externality(damage_slope=args.damage_slope),
                "abatement":abatement(),"public_good":public_good(),"commons":commons(),
                "lemons":lemons(),"hidden_action":hidden_action(args.coverage),"signaling":signaling_incentives()}
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report,indent=2,ensure_ascii=True,allow_nan=False))


if __name__=="__main__":
    main()
