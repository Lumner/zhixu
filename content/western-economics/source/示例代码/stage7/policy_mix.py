"""Chapter 44: ordinary policy comparisons and an explicit piecewise rate floor."""
from short_run import parameters,is_lm,floor_equilibrium

for name,changes in [("base",{}),("fiscal",{"g":170}),("money",{"money":500}),("accommodated",{"g":170,"money":440})]:
    r=is_lm(parameters(**changes))
    print(f"{name}: Y={r['output']:.6f}, i={r['interest']:.6%}, total I={r['investment']:.6f}")
for name,changes in [("floor base",{"money":700}),("more money",{"money":800}),("floor fiscal",{"money":700,"g":170}),("exit floor",{"money":700,"g":200})]:
    r=floor_equilibrium(parameters(**changes))
    print(f"{name}: regime={r['regime']}, Y={r['output']:.6f}, i={r['interest']:.6%}, liquidity={r['liquidity_holdings']:.6f}")
