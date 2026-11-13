"""Chapter 33: value added, inventory, and an imported-input variant."""
from macro import load_table,production_chain,expenditure_gdp

rows=load_table("value_added.csv")
result=production_chain(rows)
for row in result["stages"]:
    print(f"{row['stage']}: value added={row['value_added']:.2f}")
print(f"GDP={result['gdp']:.2f}; naive sales sum={result['naive_output_sum']:.2f}")
print(f"Final expenditure: {expenditure_gdp(c=230,i=20,g=0,x=0,m=0):.2f}")
imported=[dict(row) for row in rows]
imported[0]["intermediate"]=20
print(f"Imported-input variant: production={production_chain(imported)['gdp']:.2f}, expenditure={expenditure_gdp(c=230,i=20,g=0,x=0,m=20):.2f}")
