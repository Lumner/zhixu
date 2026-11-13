"""Chapter 21: Slutsky compensation preserves affordability of the old bundle."""
from micro import slutsky_decomposition

result = slutsky_decomposition()
for name in ["initial", "compensated", "final"]:
    row = result[name]
    print(f"{name}: x={row['x']:.2f}, y={row['y']:.2f}, U={row['utility']:.6f}")
print(f"Compensated income: {result['compensated_income']:.2f}")
print(f"x effects: substitution={result['substitution_x']:.2f}, income={result['income_x']:.2f}, total={result['total_x']:.2f}")
