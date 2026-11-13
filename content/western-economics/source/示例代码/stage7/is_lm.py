"""Chapter 43: two equations solved jointly, both residuals reported."""
from short_run import is_lm

r=is_lm()
print(f"Joint equilibrium: Y={r['output']:.6f}, i={r['interest']:.6%}")
print(f"C={r['consumption']:.2f}, private I={r['private_investment']:.2f}, public I={r['public_investment']:.2f}, G={r['government_consumption']:.2f}")
print(f"Residuals: goods={r['goods_residual']:.9f}, money={r['money_residual']:.9f}")
print(f"Saving={r['national_saving']:.2f}, planned investment={r['investment']:.2f}")
