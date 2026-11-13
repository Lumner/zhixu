"""Chapter 55: effective workers, log accounting and a separate AK illustration."""
from open_growth import solow_steady,solow_path,growth_accounting,ak_growth
s=solow_steady(technology_growth=.02)
rows=solow_path(initial=s['capital_per_effective_worker'],years=1,technology_growth=.02)
print("Technology steady:",s)
print(f"Balanced per-worker growth: {rows[1]['output_per_worker']/rows[0]['output_per_worker']-1:.6%}; aggregate: {rows[1]['output']/rows[0]['output']-1:.6%}")
print("Exact log accounting:",growth_accounting())
print("Separate AK example:",ak_growth())
