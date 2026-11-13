"""Chapter 23: total, average and discrete marginal products."""
import math
from micro import production_rows

for row in production_rows():
    average = "undefined" if row["average_product"] is None else f"{row['average_product']:.3f}"
    marginal = "undefined" if row["marginal_product"] is None else f"{row['marginal_product']:.3f}"
    print(f"L={row['labor']} Q={row['output']} AP={average} MP={marginal}")
base = 2*math.sqrt(9*4)
scaled = 2*math.sqrt(18*8)
print(f"Separate scale example: {base:.2f} -> {scaled:.2f}")
