"""Chapter 45: price-level equilibrium; inflation is not the vertical axis."""
from policy_models import ad_as,long_run_price
for name,inputs in [("base",{}),("demand +20",{"a":340}),("cost +.1",{"cost":.1})]:
    r=ad_as(**inputs)
    print(f"{name}: Y={r['output']:.6f}, P={r['price']:.6f}, goods residual={r['goods_residual']:.9f}, supply residual={r['supply_residual']:.9f}")
r=long_run_price(a=340)
print(f"Demand +20, fixed potential long-run candidate: Y={r['output']:.6f}, P={r['price']:.6f}; expectations must also adjust")
