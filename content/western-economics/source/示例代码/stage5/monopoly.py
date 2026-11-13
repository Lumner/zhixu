"""Chapter 27: uniform monopoly and an independent segmented example."""
from models import monopoly,segmented_monopoly

row=monopoly()
print(f"Monopoly: Q={row['quantity']:.2f}, P={row['price']:.2f}, profit={row['profit']:.2f}")
print(f"CS={row['consumer_surplus']:.2f}, gross TS={row['total_surplus_gross']:.2f}, DWL={row['deadweight_loss']:.2f}")
print(f"Competitive Q={row['competitive_quantity']:.2f}; first-degree gross seller surplus={row['first_degree_producer_surplus']:.2f}")
groups=segmented_monopoly()
print(f"Separate two-group discrimination: Q={groups['quantity']:.2f}, profit={groups['profit']:.2f}, CS={groups['consumer_surplus']:.2f}")
