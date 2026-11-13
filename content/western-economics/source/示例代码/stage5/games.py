"""Chapter 28: pure Nash equilibria and symmetric Cournot."""
from models import pure_nash,cournot

print("Pure Nash:",pure_nash())
for n in [1,2,5]:
    row=cournot(n)
    print(f"Cournot n={n}: each={row['quantity_each']:.2f}, total={row['quantity']:.2f}, price={row['price']:.2f}")
