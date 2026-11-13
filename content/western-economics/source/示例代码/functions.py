"""Chapter 09: return values and local variables."""
def demand(price, intercept=120, slope=2):
    quantity = max(0, intercept - slope * price)
    return quantity


if __name__ == "__main__":
    q = demand(24)
    print(f"Quantity: {q}")
    print(f"Revenue: {24 * q}")
