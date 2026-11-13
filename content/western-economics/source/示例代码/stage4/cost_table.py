"""Chapter 24: average costs are undefined when output is zero."""
from micro import costs, cost_minimization

for q in [0, 5, 10, 15]:
    row = costs(q)
    avc = "undefined" if row["average_variable_cost"] is None else f"{row['average_variable_cost']:.3f}"
    atc = "undefined" if row["average_total_cost"] is None else f"{row['average_total_cost']:.3f}"
    print(f"q={q:2d} VC={row['variable_cost']:.2f} TC={row['total_cost']:.2f} AVC={avc} ATC={atc} MC={row['marginal_cost']:.2f}")

minimum = cost_minimization()
print(f"Separate long-run cost minimum: L={minimum['labor']:.2f}, K={minimum['capital']:.2f}, cost={minimum['cost']:.2f}")
