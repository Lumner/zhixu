"""Chapter 38: synthetic quarterly/vintage data, separate official release facts."""
from macro import load_table,load_json,quarterly_rates,adjust_with_known_factors,annual_totals,vintage_growth

rows=load_table("quarterly.csv")
raw=quarterly_rates(rows)
adjusted=quarterly_rates(adjust_with_known_factors(rows))
first=next(row for row in raw if (row["year"],row["quarter"])==(2024,1))
second=next(row for row in adjusted if (row["year"],row["quarter"])==(2024,1))
print(f"Synthetic 2024Q1: raw QoQ={first['qoq']:.2%}, YoY={first['yoy']:.2%}, known-factor adjusted QoQ={second['qoq']:.2%}")
print("Synthetic full-year totals:",annual_totals(rows))
vintages=load_table("vintages.csv")
print(f"Same-vintage growth: initial={vintage_growth(vintages,'initial'):.6%}, revised={vintage_growth(vintages,'revised'):.6%}")
official=load_json("official_reading.json")
print(f"Historical official excerpt: period={official['referencePeriod']}; published={official['publishedDate']}; nominal GDP={official['nominalGdpAsPublished']} (unit: 100 million yuan)")
print("Official excerpt is not a synthetic model input and is not labeled as latest GDP.")
