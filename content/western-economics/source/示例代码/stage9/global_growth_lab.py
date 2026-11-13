"""v0.5a: independent open-economy and growth blocks; no real data or forecast."""
import argparse
import json
from open_growth import exchange_quote,external_accounts,mundell_fleming,growth_path,solow_path,solow_steady,growth_accounting,ak_growth,adjustment_comparison

def main():
    parser=argparse.ArgumentParser(description="Open-economy and growth teaching lab v0.5a")
    parser.add_argument("--regime",choices=["floating","fixed"],default="floating")
    parser.add_argument("--fiscal-change",type=float,default=0)
    parser.add_argument("--money",type=float,default=400)
    parser.add_argument("--saving",type=float,default=.2)
    parser.add_argument("--technology-growth",type=float,default=.02)
    parser.add_argument("--output-growth",type=float,default=.05)
    parser.add_argument("--population-growth",type=float,default=.02)
    parser.add_argument("--years",type=int,default=20)
    args=parser.parse_args()
    try:
        if not 1<=args.years<=200: raise ValueError("CLI years must be in [1,200]")
        solow_inputs={"saving":args.saving,"population_growth":args.population_growth}
        report={"version":"0.5a","origin":"synthetic_teaching_parameters","scope":"Independent external ledger, small-open-economy and growth experiments; no empirical forecast",
                "exchange_quote":exchange_quote(),"external_accounts":external_accounts(),
                "small_open_economy":mundell_fleming(args.regime,args.fiscal_change,args.money),
                "compound_growth":growth_path(years=args.years,output_growth=args.output_growth,population_growth=args.population_growth),
                "solow_without_technology":solow_path(years=args.years,**solow_inputs),
                "steady_without_technology":solow_steady(**solow_inputs),
                "solow_with_technology":solow_path(years=args.years,technology_growth=args.technology_growth,**solow_inputs),
                "steady_with_technology":solow_steady(technology_growth=args.technology_growth,**solow_inputs),
                "growth_accounting_reference":growth_accounting(),"ak_reference":ak_growth(),
                "price_adjustment_reference":adjustment_comparison()}
        print(json.dumps(report,ensure_ascii=True,allow_nan=False,indent=2))
    except ValueError as exc: parser.error(str(exc))

if __name__=="__main__": main()
