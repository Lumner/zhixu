"""Chapter 15: midpoint elasticity with explicit denominator checks."""
import math


def midpoint_elasticity(p1, q1, p2, q2):
    for value in (p1, q1, p2, q2):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("Finite numeric inputs required")
    if min(p1, p2, q1, q2) <= 0 or p1 == p2:
        raise ValueError("Positive prices/quantities and distinct prices required")
    quantity_change = (q2 - q1) / ((q1 + q2) / 2)
    price_change = (p2 - p1) / ((p1 + p2) / 2)
    return quantity_change / price_change


if __name__ == "__main__":
    value = midpoint_elasticity(20, 80, 30, 60)
    print(f"Signed midpoint elasticity: {value:.6f}")
    print(f"Absolute elasticity: {abs(value):.6f}")
    print(f"Revenue: {20 * 80} -> {30 * 60}")
