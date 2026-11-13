"""Stage 4 teaching models. Synthetic parameters; standard library only.

Each model is independent: the production table, quadratic cost function and
labor production function are not asserted to describe the same enterprise.
"""
import math

OUTPUT_TABLE = (0, 12, 28, 42, 52, 60, 66, 70, 72)


def number(value, name, minimum=None, strict=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if minimum is not None and (value <= minimum if strict else value < minimum):
        symbol = ">" if strict else ">="
        raise ValueError(f"{name} must be {symbol} {minimum}")
    return value


def utility(x, y):
    number(x, "x", 0)
    number(y, "y", 0)
    return math.sqrt(x * y)


def consumer_choice(income=120, px=6, py=3):
    number(income, "income", 0)
    number(px, "px", 0, strict=True)
    number(py, "py", 0, strict=True)
    x, y = income / (2 * px), income / (2 * py)
    return {"x": x, "y": y, "spending": px * x + py * y, "utility": utility(x, y)}


def consumer_grid(income=120, px=6, py=3, step=1):
    consumer_choice(income, px, py)  # Validate the same domain.
    number(step, "step", 0, strict=True)
    upper = income / px
    count = math.floor(upper / step)
    if count > 100000:
        raise ValueError("Grid has too many points; increase step")
    xs = [min(index * step, upper) for index in range(count + 1)]
    if xs[-1] < upper:
        xs.append(upper)
    best = None
    for x in xs:
        y = max(0, (income - px * x) / py)
        candidate = {"x": x, "y": y, "utility": utility(x, y)}
        if best is None or candidate["utility"] > best["utility"]:
            best = candidate
    return {**best, "spending": px * best["x"] + py * best["y"], "step": step, "points": len(xs)}


def linear_choice(income=120, px=6, py=2, vx=2, vy=1):
    consumer_choice(income, px, py)
    number(vx, "vx", 0)
    number(vy, "vy", 0)
    if vx == 0 and vy == 0:
        raise ValueError("At least one utility coefficient must be positive")
    score_x, score_y = vx / px, vy / py
    x, y = (income / px, 0) if score_x >= score_y else (0, income / py)
    return {"x": x, "y": y, "utility": vx*x + vy*y,
            "multiple_optima": score_x == score_y and income > 0}


def forward_difference(function, x, h):
    number(x, "x")
    number(h, "h", 0, strict=True)
    first, second = function(x), function(x + h)
    number(first, "f(x)")
    number(second, "f(x+h)")
    return (second - first) / h


def slutsky_decomposition(income=120, old_px=6, new_px=3, py=3):
    initial = consumer_choice(income, old_px, py)
    final = consumer_choice(income, new_px, py)
    compensated_income = income + (new_px - old_px) * initial["x"]
    compensated = consumer_choice(compensated_income, new_px, py)
    result = {"initial": initial, "compensated": compensated, "final": final,
              "compensated_income": compensated_income}
    for good in ("x", "y"):
        result["substitution_" + good] = compensated[good] - initial[good]
        result["income_" + good] = final[good] - compensated[good]
        result["total_" + good] = final[good] - initial[good]
    return result


def insurance_summary(wealth=100, loss=36, probability=.25, premium=9):
    number(wealth, "wealth", 0, strict=True)
    number(loss, "loss", 0)
    number(probability, "probability", 0)
    number(premium, "premium", 0)
    if probability > 1 or loss >= wealth or premium >= wealth:
        raise ValueError("Require probability<=1, loss<wealth and premium<wealth")
    expected_wealth = wealth - probability * loss
    expected_log_utility = probability * math.log(wealth-loss) + (1-probability) * math.log(wealth)
    certainty_equivalent = math.exp(expected_log_utility)
    insured_wealth = wealth - premium
    insured_log_utility = math.log(insured_wealth)
    return {"expected_wealth": expected_wealth, "expected_loss": probability*loss,
            "expected_log_utility": expected_log_utility,
            "certainty_equivalent": certainty_equivalent,
            "risk_premium": expected_wealth-certainty_equivalent,
            "max_full_insurance_premium": wealth-certainty_equivalent,
            "insured_wealth": insured_wealth, "insured_log_utility": insured_log_utility,
            "insurance_weakly_preferred": insured_log_utility >= expected_log_utility - 1e-12}


def two_period_choice(y0=80, y1=132, rate=.1, beta=1):
    number(y0, "y0", 0)
    number(y1, "y1", 0)
    number(rate, "rate", -1, strict=True)
    number(beta, "beta", 0, strict=True)
    resources = y0 + y1 / (1 + rate)
    if resources <= 0:
        raise ValueError("Positive lifetime resources required")
    c0 = resources / (1 + beta)
    c1 = (1 + rate) * beta * resources / (1 + beta)
    return {"present_value_resources": resources, "c0": c0, "c1": c1,
            "saving": y0-c0, "utility": math.log(c0)+beta*math.log(c1)}


def production_rows(outputs=OUTPUT_TABLE):
    if not isinstance(outputs, (list, tuple)) or len(outputs) < 2 or outputs[0] != 0:
        raise ValueError("Supply at least two outputs, beginning at zero labor/output")
    result = []
    for labor, output in enumerate(outputs):
        number(output, "output", 0)
        result.append({"labor": labor, "output": output,
                       "average_product": output/labor if labor else None,
                       "marginal_product": output-outputs[labor-1] if labor else None})
    return result


def costs(quantity, fixed=100, linear=4, quadratic=1):
    number(quantity, "quantity", 0)
    number(fixed, "fixed", 0)
    number(linear, "linear", 0)
    number(quadratic, "quadratic", 0, strict=True)
    variable = linear*quantity + quadratic*quantity**2
    total = fixed + variable
    return {"quantity": quantity, "fixed_cost": fixed, "variable_cost": variable,
            "total_cost": total, "marginal_cost": linear+2*quadratic*quantity,
            "average_fixed_cost": fixed/quantity if quantity else None,
            "average_variable_cost": variable/quantity if quantity else None,
            "average_total_cost": total/quantity if quantity else None}


def cost_minimization(output=12, wage=3, rental=12):
    """Long-run minimum for Q=2*sqrt(K*L), constant input service prices."""
    number(output, "output", 0)
    number(wage, "wage", 0, strict=True)
    number(rental, "rental", 0, strict=True)
    labor = output/2 * math.sqrt(rental/wage)
    capital = output/2 * math.sqrt(wage/rental)
    total = wage*labor + rental*capital
    return {"target_output": output, "labor": labor, "capital": capital,
            "cost": total, "average_cost": total/output if output else None,
            "marginal_rate_of_technical_substitution": capital/labor if labor else None}


def competitive_firm(price=30, fixed=100, linear=4, quadratic=1):
    number(price, "price", 0)
    costs(0, fixed, linear, quadratic)
    quantity = max(0, (price-linear)/(2*quadratic))
    result = costs(quantity, fixed, linear, quadratic)
    revenue = price * quantity
    break_even_price = linear + 2*math.sqrt(fixed*quadratic)
    return {**result, "price": price, "revenue": revenue, "profit": revenue-result["total_cost"],
            "operate": quantity > 0, "shutdown_profit": -fixed,
            "break_even_price": break_even_price,
            "long_run_exit_signal_at_unchanged_prices": price < break_even_price}


def labor_choice(price=2, wage=16, productivity=20, curvature=1):
    number(price, "price", 0)
    number(wage, "wage", 0)
    number(productivity, "productivity", 0, strict=True)
    number(curvature, "curvature", 0, strict=True)
    labor = max(0, (productivity-wage/price)/(2*curvature)) if price else 0
    output = productivity*labor - curvature*labor**2
    marginal_product = productivity - 2*curvature*labor
    revenue = price*output
    wage_bill = wage*labor
    return {"labor": labor, "output": output, "marginal_product": marginal_product,
            "marginal_revenue_product": price*marginal_product,
            "revenue": revenue, "wage_bill": wage_bill,
            "surplus_before_other_costs": revenue-wage_bill}


def labor_market(demand_intercept=100, demand_slope=2, supply_intercept=20, supply_slope=2):
    number(demand_intercept, "demand_intercept", 0, strict=True)
    number(demand_slope, "demand_slope", 0, strict=True)
    number(supply_intercept, "supply_intercept", 0)
    number(supply_slope, "supply_slope", 0, strict=True)
    wage = (demand_intercept-supply_intercept)/(demand_slope+supply_slope)
    labor = demand_intercept-demand_slope*wage
    if wage < 0 or labor <= 0:
        raise ValueError("No positive interior labor-market equilibrium")
    return {"wage": wage, "labor": labor}
