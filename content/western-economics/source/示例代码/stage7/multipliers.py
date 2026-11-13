"""Chapter 40: taxes, imports, spending and fixed-interest comparisons."""
from short_run import parameters,multipliers,goods_equilibrium

p=parameters();base=goods_equilibrium(p)
print("Multipliers:",multipliers(p))
for name,changes in [("G +20",{"g":170}),("t0 +20",{"t0":60}),("G,t0 both +20",{"g":170,"t0":60}),("Import propensity .1",{"import_propensity":.1})]:
    changed=dict(p);changed.update(changes)
    row=goods_equilibrium(changed)
    print(f"{name}: Y={row['output']:.6f}, change from closed base={row['output']-base['output']:.6f}")
