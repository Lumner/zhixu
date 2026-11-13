"""Chapter 48: a nominal budget at externally given output, not a multiplier."""
from policy_models import fiscal_budget
for y in [700,630]:
    r=fiscal_budget(output=y)
    print(f"Y={y}: tax={r['gross_taxes']:.2f}, transfers={r['transfers']:.2f}, primary={r['primary_balance']:.2f}, overall={r['overall_balance']:.2f}, private disposable={r['private_disposable_income']:.2f}")
print("Output is externally given; this ledger alone does not forecast a fiscal output effect.")
