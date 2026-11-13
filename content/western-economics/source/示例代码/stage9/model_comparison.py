"""Chapter 56: change a price-adjustment assumption, not an entire school label."""
from open_growth import adjustment_comparison
for r in adjustment_comparison():
    print(f"{r['case']}: Y={r['output']:.6f}, P={r['price']:.6f}")
print("These are assumption comparisons, not complete implementations of macroeconomic schools.")
