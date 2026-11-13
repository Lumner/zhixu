"""Chapter 08: list, iteration and a quantity floor."""
prices = [0, 10, 20, 30, 40, 50, 60, 70]
total_quantity = 0
for price in prices:
    quantity = max(0, 120 - 2 * price)
    total_quantity += quantity
    print(f"P={price:2d}, Qd={quantity:3d}")
print("Sum across hypothetical scenarios:", total_quantity)
