"""Interior linear competitive market, synthetic parameters, no external packages.

Demand: Qd=max(0,a-b*Pc); supply: Qs=max(0,c+d*Ps).
Surplus functions require c<=0 so the supply intercept is non-negative.
Zero/negative trade and negative seller-price tax regimes are rejected.
"""
import math


def finite(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return value


def parameters(a, b, c, d):
    for name, value in [("a", a), ("b", b), ("c", c), ("d", d)]:
        finite(value, name)
    if a <= 0 or b <= 0 or d <= 0 or c > 0:
        raise ValueError("Require a>0, b>0, d>0, c<=0")


def equilibrium(a=120, b=2, c=0, d=3):
    parameters(a, b, c, d)
    price = (a - c) / (b + d)
    quantity = a - b * price
    if price < 0 or quantity <= 0:
        raise ValueError("No positive interior equilibrium in this model")
    return {"price": price, "quantity": quantity}


def welfare(consumer_price, seller_price, quantity, a=120, b=2, c=0, d=3):
    consumer_surplus = (a / b - consumer_price) * quantity / 2
    producer_surplus = (seller_price + c / d) * quantity / 2
    return {"consumer_surplus": consumer_surplus, "producer_surplus": producer_surplus}


def taxed_market(tax, a=120, b=2, c=0, d=3):
    base = equilibrium(a, b, c, d)
    finite(tax, "tax")
    if tax < 0:
        raise ValueError("This experiment accepts non-negative taxes only")
    consumer_price = (a - c + d * tax) / (b + d)
    seller_price = consumer_price - tax
    quantity = a - b * consumer_price
    if seller_price < 0 or quantity <= 0:
        raise ValueError("Tax outside the positive-trade interior model")
    before = welfare(base["price"], base["price"], base["quantity"], a, b, c, d)
    after = welfare(consumer_price, seller_price, quantity, a, b, c, d)
    revenue = tax * quantity
    loss = tax * (base["quantity"] - quantity) / 2
    return {
        "consumer_price": consumer_price,
        "seller_price": seller_price,
        "quantity": quantity,
        **after,
        "tax_revenue": revenue,
        "deadweight_loss": loss,
        "baseline_total_surplus": sum(before.values()),
        "after_total_including_tax": sum(after.values()) + revenue,
    }


def price_control(kind, price, a=120, b=2, c=0, d=3):
    base = equilibrium(a, b, c, d)
    finite(price, "control price")
    if price < 0 or kind not in ("ceiling", "floor"):
        raise ValueError("Require a non-negative price and ceiling or floor")
    binding = price < base["price"] if kind == "ceiling" else price > base["price"]
    actual_price = price if binding else base["price"]
    demand = max(0, a - b * actual_price)
    supply = max(0, c + d * actual_price)
    return {
        "binding": binding,
        "price": actual_price,
        "demand": demand,
        "supply": supply,
        "transaction_upper_bound": min(demand, supply),
        "shortage": max(0, demand - supply),
        "surplus": max(0, supply - demand),
    }
