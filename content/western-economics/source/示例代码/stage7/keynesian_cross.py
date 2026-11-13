"""Chapter 39: fixed-interest goods equilibrium and a chosen inventory adjustment."""
from short_run import parameters,reduced_form,goods_equilibrium,components,adjustment_path

p=parameters()
print("Reduced form:",reduced_form(p))
for y in [600,800,1000]:
    r=components(y,p=p)
    print(f"Y={y:.2f}, planned={r['planned_expenditure']:.2f}, unplanned inventory={r['unplanned_inventory']:.2f}")
e=goods_equilibrium(p)
print(f"Equilibrium: Y={e['output']:.6f}, C={e['consumption']:.2f}, I={e['investment']:.2f}")
path=adjustment_path(steps=60,p=p)
print("Adjustment first six:",[round(r['output'],4) for r in path[:6]])
print(f"After 60 teaching steps: Y={path[-1]['output']:.6f}")
