"""Chapter 31: public provision and a separate common-resource effort game."""
from models import public_good,commons

row=public_good()
print(f"Public good: efficient g={row['efficient_quantity']:.2f}, voluntary g={row['voluntary_quantity']:.2f}")
print(f"Net welfare: {row['welfare_efficient']:.2f} vs {row['welfare_voluntary']:.2f}")
resource=commons()
print(f"Separate commons: Nash effort={resource['noncooperative_total_effort']:.6f}, efficient effort={resource['efficient_total_effort']:.6f}")
