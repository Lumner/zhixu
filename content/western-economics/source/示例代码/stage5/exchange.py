"""Chapter 29: pure exchange and an integer-grid Pareto comparison."""
from models import exchange_equilibrium,exchange_grid

row=exchange_equilibrium()
print(f"Prices: px={row['px']:.2f}, py={row['py']:.2f}")
for name in ["a","b"]:
    person=row[name]
    print(f"{name}: x={person['x']:.2f}, y={person['y']:.2f}, U={person['utility']:.2f}, initial U={person['initial_utility']:.2f}")
grid=exchange_grid()
print("Grid points:",grid["points"])
print("Grid-efficient A bundles:",[(p["x_a"],p["y_a"]) for p in grid["frontier"]])
