"""Chapter 35: two independent baskets and real purchasing power."""
from macro import load_table,fixed_basket_index,real_interest,real_growth,growth_rate

consumer=fixed_basket_index(load_table("goods.csv"))
producer=fixed_basket_index(load_table("producer_prices.csv"))
print(f"Teaching consumer basket index: {consumer['index_base_100']:.2f}")
print(f"Independent producer basket index: {producer['index_base_100']:.2f}")
print(f"Exact real interest at i=10%, inflation=5%: {real_interest(.1,.05):.6%}")
print(f"Real income change with nominal +10%, prices +35%: {real_growth(.1,.35):.6%}")
print(f"Separate index sequence 100 -> 135 -> 140.4: {growth_rate(135,100):.1%}, then {growth_rate(140.4,135):.1%}")
