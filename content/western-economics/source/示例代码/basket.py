"""Chapter 10: fixed basket, all amounts are synthetic."""
items = [
    {"name": "rice", "quantity": 5, "base_price": 4, "current_price": 5},
    {"name": "milk", "quantity": 10, "base_price": 3, "current_price": 3.6},
]
base_cost = 0
current_cost = 0
for item in items:
    base_cost += item["quantity"] * item["base_price"]
    current_cost += item["quantity"] * item["current_price"]
index = current_cost / base_cost * 100
print(f"Base basket: {base_cost:.2f} yuan")
print(f"Current basket: {current_cost:.2f} yuan")
print(f"Basket index: {index:.2f} (base=100)")
