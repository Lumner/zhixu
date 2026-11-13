"""Fixed-price teaching models. G is consumption; total I includes public investment.

Interest is decimal, expected inflation is zero, no risk premium is modeled.
Money is a stock; expenditure/output are same-period flows. No real data or forecast.
"""
import math

BASE={"c0":100,"mpc":.75,"t0":40,"tax_rate":.2,"private0":80,"public_investment":20,
      "b":1000,"g":150,"exports":0,"imports0":0,"import_propensity":0,
      "k":.8,"h":4000,"money":400,"price":1}

def finite(value,name,minimum=None,strict=False):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(name+" must be a finite number")
    if minimum is not None and (value<=minimum if strict else value<minimum):
        raise ValueError(name+" outside the teaching domain")
    return value

def parameters(**overrides):
    if set(overrides)-set(BASE): raise ValueError("Unknown model parameter")
    p=dict(BASE);p.update(overrides)
    for key,value in p.items(): finite(value,key)
    for key in ["c0","private0","public_investment","b","g","exports","imports0","k","money"]:
        finite(p[key],key,0)
    for key in ["h","price"]: finite(p[key],key,0,strict=True)
    if not 0<=p["mpc"]<1: raise ValueError("mpc must be in [0,1)")
    if not 0<=p["tax_rate"]<=1: raise ValueError("tax_rate must be in [0,1]")
    if not 0<=p["import_propensity"]<=1: raise ValueError("import_propensity must be in [0,1]")
    return p

def config(p):
    return parameters(**({} if p is None else p))

def reduced_form(p=None):
    p=config(p)
    a=p["c0"]-p["mpc"]*p["t0"]+p["private0"]+p["public_investment"]+p["g"]+p["exports"]-p["imports0"]
    slope=p["mpc"]*(1-p["tax_rate"])-p["import_propensity"]
    return {"a":a,"ae_income_slope":slope,"leakage":1-slope}

def components(y,interest=0,p=None):
    p=config(p);finite(y,"output",0);finite(interest,"interest",0)
    taxes=p["t0"]+p["tax_rate"]*y
    consumption=p["c0"]+p["mpc"]*(y-taxes)
    private=p["private0"]-p["b"]*interest
    if consumption < -1e-9 or private < -1e-9:
        raise ValueError("Negative consumption/private investment: outside the linear model domain")
    consumption=max(0,consumption);private=max(0,private)  # Roundoff only, not a corner solver.
    investment=private+p["public_investment"]
    imports=p["imports0"]+p["import_propensity"]*y
    nx=p["exports"]-imports
    planned=consumption+investment+p["g"]+nx
    inventory=y-planned
    private_saving=y-taxes-consumption
    government_saving=taxes-p["g"]
    return {"output":y,"interest":interest,"taxes":taxes,"disposable_income":y-taxes,
            "consumption":consumption,"private_investment":private,"public_investment":p["public_investment"],
            "investment":investment,"government_consumption":p["g"],"net_exports":nx,
            "planned_expenditure":planned,"unplanned_inventory":inventory,
            "actual_investment_including_unplanned_inventory":investment+inventory,
            "private_saving":private_saving,"government_saving":government_saving,
            "national_saving":private_saving+government_saving}

def goods_equilibrium(p=None,interest=0):
    p=config(p);finite(interest,"interest",0)
    r=reduced_form(p)
    y=(r["a"]-p["b"]*interest)/r["leakage"]
    result=components(y,interest,p)
    result["goods_residual"]=result["output"]-result["planned_expenditure"]
    return result

def adjustment_path(initial=600,alpha=.5,steps=10,p=None,interest=0):
    p=config(p);finite(initial,"initial output",0);finite(alpha,"alpha",0,strict=True)
    if isinstance(steps,bool) or not isinstance(steps,int) or not 0<=steps<=2000:
        raise ValueError("steps must be an integer in [0,2000]")
    factor=1-alpha*reduced_form(p)["leakage"]
    if abs(factor)>=1-1e-12: raise ValueError("This adjustment rule does not converge within numerical tolerance")
    y=initial;rows=[]
    for step in range(steps+1):
        row=components(y,interest,p);row["step"]=step;rows.append(row)
        if step<steps: y=y-alpha*row["unplanned_inventory"]
    return rows

def multipliers(p=None):
    p=config(p);d=reduced_form(p)["leakage"]
    return {"fixed_interest_spending":1/d,"fixed_interest_net_lump_tax":-p["mpc"]/d,
            "equal_g_and_t0":(1-p["mpc"])/d,
            "ordinary_is_lm_g":1/(d+p["b"]*p["k"]/p["h"]),
            "ordinary_is_lm_real_money":(p["b"]/p["h"])/(d+p["b"]*p["k"]/p["h"])}

def money_market(y,p=None):
    p=config(p);finite(y,"output",0)
    real_money=p["money"]/p["price"]
    interest=(p["k"]*y-real_money)/p["h"]
    if interest < -1e-12: raise ValueError("Negative implied rate; use an explicit interest-floor model")
    interest=max(0,interest)
    demand=p["k"]*y-p["h"]*interest
    return {"output":y,"interest":interest,"real_money_supply":real_money,"linear_money_demand":demand,
            "money_residual":real_money-demand}

def bond_price(face=100,interest=.04):
    finite(face,"face",0,strict=True);finite(interest,"interest",0)
    return face/(1+interest)

def linear_solution(p):
    r=reduced_form(p);real_money=p["money"]/p["price"]
    y=(r["a"]+p["b"]*real_money/p["h"])/(r["leakage"]+p["b"]*p["k"]/p["h"])
    interest=(p["k"]*y-real_money)/p["h"]
    return y,interest

def combined_report(y,interest,p,regime,liquidity=0):
    result=components(y,interest,p)
    linear_demand=p["k"]*y-p["h"]*interest
    if linear_demand < -1e-9: raise ValueError("Negative linear money demand outside teaching domain")
    real_money=p["money"]/p["price"]
    result.update(regime=regime,real_money_supply=real_money,linear_money_demand=linear_demand,
                  liquidity_holdings=liquidity,total_money_demand=linear_demand+liquidity,
                  linear_money_gap=real_money-linear_demand,
                  money_residual=real_money-linear_demand-liquidity,
                  goods_residual=y-result["planned_expenditure"])
    return result

def is_lm(p=None):
    p=config(p);y,interest=linear_solution(p)
    if interest < -1e-12: raise ValueError("Ordinary solution has negative interest; select the floor model")
    return combined_report(y,max(0,interest),p,"ordinary")

def floor_equilibrium(p=None,floor=0):
    p=config(p);finite(floor,"interest floor",0)
    y,interest=linear_solution(p)
    if interest>floor+1e-12: return combined_report(y,interest,p,"ordinary")
    y=goods_equilibrium(p,interest=floor)["output"]
    liquidity=p["money"]/p["price"]-(p["k"]*y-p["h"]*floor)
    if liquidity < -1e-9: raise ValueError("Floor branch does not clear the specified piecewise model")
    return combined_report(y,floor,p,"floor",max(0,liquidity))

def deposit_ratios(base=100,reserve_ratio=.1,currency_ratio=0,excess_ratio=0):
    for name,value in [("base",base),("reserve_ratio",reserve_ratio),("currency_ratio",currency_ratio),("excess_ratio",excess_ratio)]: finite(value,name,0)
    if reserve_ratio+excess_ratio>1: raise ValueError("Reserve ratios cannot exceed deposits in this example")
    denominator=reserve_ratio+currency_ratio+excess_ratio
    if denominator<=0: raise ValueError("No finite ratio-model solution")
    deposits=base/denominator
    currency=currency_ratio*deposits
    reserves=(reserve_ratio+excess_ratio)*deposits
    return {"base":base,"deposits":deposits,"currency":currency,"reserves":reserves,
            "money":currency+deposits,"multiplier":(1+currency_ratio)/denominator,
            "loans_zero_equity_example":deposits-reserves}

def banking_demo(loan=60,transfer=40,repayment=10,withdrawal=20):
    for name,value in [("loan",loan),("transfer",transfer),("repayment",repayment),("withdrawal",withdrawal)]: finite(value,name,0)
    if transfer>loan or repayment>loan-transfer:
        raise ValueError("Borrower payment/repayment exceeds the unused new-loan deposit")
    a={"reserves":120,"loans":0,"deposits":100,"equity":20}
    b={"reserves":80,"loans":0,"deposits":60,"equity":20}
    cash=0;rows=[]
    def record(event):
        totals={key:a[key]+b[key] for key in a}
        for bank in [a,b]:
            if not math.isclose(bank["reserves"]+bank["loans"],bank["deposits"]+bank["equity"],abs_tol=1e-9): raise ValueError("Unbalanced ledger")
        rows.append({"event":event,"bank_a":dict(a),"bank_b":dict(b),"totals":totals,
                     "public_cash":cash,"money_cash_plus_deposits":cash+totals["deposits"],
                     "base_cash_plus_reserves":cash+totals["reserves"]})
    record("initial")
    a["loans"]+=loan;a["deposits"]+=loan;record("loan")
    if transfer>a["reserves"]: raise ValueError("A lacks settlement reserves in this closed ledger")
    a["reserves"]-=transfer;a["deposits"]-=transfer
    b["reserves"]+=transfer;b["deposits"]+=transfer;record("transfer")
    a["loans"]-=repayment;a["deposits"]-=repayment;record("principal_repayment")
    if withdrawal>min(a["reserves"],a["deposits"]): raise ValueError("A lacks cash/reserves or deposits for withdrawal")
    a["reserves"]-=withdrawal;a["deposits"]-=withdrawal;cash+=withdrawal;record("withdrawal")
    return rows
