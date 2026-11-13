"""Chapter 30: corrective tax and a separate least-cost abatement allocation."""
from models import externality,abatement

row=externality()
print(f"Private Q={row['private_quantity']:.2f}, efficient Q={row['efficient_quantity']:.2f}, tax={row['optimal_unit_tax']:.2f}")
print(f"Social welfare: {row['welfare_private']:.2f} -> {row['welfare_efficient']:.2f}; DWL={row['deadweight_loss']:.2f}")
allocation=abatement()
print(f"Separate abatement: A={allocation['a']:.2f}, B={allocation['b']:.2f}, cost={allocation['cost']:.2f}")
