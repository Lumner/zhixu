"""Chapter 54: exact discrete per-worker capital and steady consumption."""
from open_growth import solow_path,solow_steady,golden_rule
rows=solow_path()
print(f"Initial k={rows[0]['capital_per_effective_worker']:.6f}; next k={rows[1]['capital_per_effective_worker']:.12f}; year200 k={rows[-1]['capital_per_effective_worker']:.6f}")
for saving in [.2,.3,.6]: print(f"Saving={saving:.1f} steady:",solow_steady(saving=saving))
print("Steady-consumption golden rule:",golden_rule())
