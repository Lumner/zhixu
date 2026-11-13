"""Chapter 26: firm demand and a separate illustrative market."""
from micro import labor_choice, labor_market

for wage in [16, 20, 40, 50]:
    row = labor_choice(wage=wage)
    print(f"w={wage:2d} L={row['labor']:.2f} Q={row['output']:.2f} MRPL={row['marginal_revenue_product']:.2f} surplus_before_other_costs={row['surplus_before_other_costs']:.2f}")
market = labor_market()
print(f"Separate labor market: wage={market['wage']:.2f}, labor={market['labor']:.2f}")
