"""Chapter 46: exogenously supplied unemployment, two expectation rules."""
from policy_models import inflation_path,disinflation_unemployment
for name,weight in [("adaptive",1),("fixed expectations",0)]:
    rows=inflation_path(weight=weight)
    print(name, [f"{r['inflation']:.3%}" for r in rows])
r=disinflation_unemployment()
print(f"One-period disinflation candidate: u={r['unemployment']:.3%}, inflation={r['inflation']:.3%}")
