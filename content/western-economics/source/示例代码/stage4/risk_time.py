"""Chapter 22: expected log utility and a two-period consumption example."""
from micro import insurance_summary, two_period_choice

risk = insurance_summary()
for name in ["expected_wealth", "certainty_equivalent", "risk_premium", "max_full_insurance_premium"]:
    print(f"{name}: {risk[name]:.6f}")
print("Fair full insurance weakly preferred:", risk["insurance_weakly_preferred"])
time = two_period_choice()
print(f"Two periods: c0={time['c0']:.2f}, c1={time['c1']:.2f}, saving={time['saving']:.2f}")
