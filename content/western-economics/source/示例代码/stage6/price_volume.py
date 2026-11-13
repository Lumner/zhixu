"""Chapter 34: fixed-base volume, not a general chain-index calculator."""
from macro import load_table,price_volume

result=price_volume(load_table("goods.csv"))
print(f"Nominal GDP: {result['base_nominal']:.2f} -> {result['current_nominal']:.2f}")
print(f"Current real GDP at base prices: {result['current_real_at_base_prices']:.2f}")
deflator=result['deflator_base_100']
price_growth=result['deflator_growth']
print("GDP deflator (base=100): "+(f"{deflator:.2f}" if deflator is not None else "undefined"))
price_text=f"{price_growth:.2%}" if price_growth is not None else "undefined"
print(f"Growth: nominal={result['nominal_growth']:.2%}, real={result['real_growth']:.2%}, deflator={price_text}")
