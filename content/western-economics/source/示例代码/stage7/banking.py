"""Chapter 41: a two-bank balance-sheet example and a separate static ratio model."""
from short_run import banking_demo,deposit_ratios

for r in banking_demo():
    print(f"{r['event']}: R={r['totals']['reserves']:.2f}, L={r['totals']['loans']:.2f}, D={r['totals']['deposits']:.2f}, cash={r['public_cash']:.2f}, money={r['money_cash_plus_deposits']:.2f}, base={r['base_cash_plus_reserves']:.2f}")
print("Separate zero-cash, zero-excess ratio model:",deposit_ratios())
print("Separate currency/excess ratio model:",deposit_ratios(currency_ratio=.2,excess_ratio=.1))
