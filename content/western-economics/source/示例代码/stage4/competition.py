"""Chapter 25: losses need not imply immediate shutdown."""
from micro import competitive_firm

for price in [30, 24, 20, 4, 3]:
    row = competitive_firm(price)
    print(f"P={price:2d} q={row['quantity']:.2f} profit={row['profit']:.2f} operate={row['operate']} exit_signal={row['long_run_exit_signal_at_unchanged_prices']}")
