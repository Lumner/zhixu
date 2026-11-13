"""Chapter 50: effective nominal interest, nominal growth, current-GDP balances."""
from policy_models import debt_path,debt_step,nominal_growth
r=debt_path(years=1)[1]
print(f"Base year1: GDP={r['gdp']:.2f}, debt={r['debt']:.2f}, ratio={r['debt_ratio']:.6%}, primary={r['primary_amount']:.2f}")
print(f"Stabilizing primary surplus/GDP: {r['stabilizing_primary_surplus']:.6%}")
stress=debt_step(interest=.08,growth=.01,primary_surplus=-.02)
print(f"Independent stress ratio: {stress['debt_ratio']:.6%}")
print(f"Real +2%, GDP deflator +2% -> nominal growth {nominal_growth():.6%}")
