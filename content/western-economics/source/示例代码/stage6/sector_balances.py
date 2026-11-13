"""Chapter 37: accounting identities and an external-income extension."""
from macro import load_accounts,national_accounts

inputs=load_accounts()
result=national_accounts(**inputs)
print(f"GDP residual: {result['gdp_residual']:.6f}")
print(f"Saving: private={result['private_gross_saving']:.2f}, government={result['government_gross_saving']:.2f}, national={result['national_gross_saving']:.2f}")
print(f"I + NX = {result['investment']:.2f} + {result['net_exports']:.2f}")
extended=dict(inputs)
extended["net_primary_income"]=10
extended["net_current_transfers"]=-5
row=national_accounts(**extended)
print(f"External-income variant: GNDI={row['gross_national_disposable_income']:.2f}, saving={row['national_gross_saving']:.2f}, current account={row['current_account']:.2f}")
