"""Stage 6 v0.3 CLI: measurement and accounting, no forecast model."""
import argparse
import json
from macro import load_table,load_json,load_accounts,production_chain,price_volume,fixed_basket_index
from macro import labour_indicators,national_accounts,real_interest,quarterly_rates,annual_totals,vintage_growth


def main():
    parser=argparse.ArgumentParser(description="Synthetic macro measurement experiments v0.3")
    parser.add_argument("--scenario",choices=["base","discouraged","job_growth"],default="base")
    parser.add_argument("--nominal-rate",type=float,default=.1)
    parser.add_argument("--inflation",type=float,default=.05)
    parser.add_argument("--vintage",choices=["initial","revised"],default="revised")
    args=parser.parse_args()
    try:
        people=next(row for row in load_table("labour.csv") if row["scenario"]==args.scenario)
        goods=load_table("goods.csv")
        quarters=load_table("quarterly.csv")
        report={"version":"0.3","scope":"Independent synthetic accounting examples; no behavioral forecast; official excerpt kept separate",
                "production_chain":production_chain(load_table("value_added.csv")),
                "price_volume":price_volume(goods),"consumer_basket":fixed_basket_index(goods),
                "producer_basket":fixed_basket_index(load_table("producer_prices.csv")),
                "real_interest":real_interest(args.nominal_rate,args.inflation),
                "labour":labour_indicators(people["employed"],people["unemployed"],people["outside"],people["population"]),
                "accounts":national_accounts(**load_accounts()),"quarterly":quarterly_rates(quarters),
                "annual_totals":annual_totals(quarters),"vintage":args.vintage,
                "vintage_growth":vintage_growth(load_table("vintages.csv"),args.vintage),
                "data_origin":load_json("metadata.json")["kind"],"official_reading":load_json("official_reading.json")}
    except (ValueError,OSError) as exc:
        parser.error(str(exc))
    print(json.dumps(report,indent=2,ensure_ascii=True,allow_nan=False))


if __name__=="__main__":
    main()
