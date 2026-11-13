"""Chapter 19: budget-line combinations and a grid search."""
from micro import utility, consumer_grid

income, px, py = 120, 6, 3
for x in [0, 5, 10, 15, 20]:
    y = (income - px*x) / py
    print(f"x={x:5.1f} y={y:5.1f} spending={px*x+py*y:6.2f} U={utility(x,y):.6f}")
best = consumer_grid(income, px, py)
print(f"Grid best: x={best['x']:.2f}, y={best['y']:.2f}, U={best['utility']:.6f}")
