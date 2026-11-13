"""Independent teaching blocks for chapters 45-50; no real data or forecast.

AD-AS uses price levels; Phillips/rule blocks use period inflation rates.
Budgets and debt use nominal amounts; surplus ratios use current-period GDP.
"""
import math

def finite(value,name,minimum=None,strict=False):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(name+" must be a finite number")
    if minimum is not None and (value<=minimum if strict else value<minimum):
        raise ValueError(name+" outside the teaching domain")
    return value

def rate(value,name):
    return finite(value,name,-1,strict=True)

def share(value,name):
    finite(value,name,0)
    if value>1: raise ValueError(name+" must not exceed 1")
    return value

def series(values,name):
    if not isinstance(values,(list,tuple)) or not 1<=len(values)<=2000:
        raise ValueError(name+" must contain 1-2000 observations")
    for v in values: finite(v,name)
    return list(values)

def ad_at_price(price=1,a=320,money=400):
    finite(price,"price",0,strict=True);finite(a,"autonomous demand",0)
    finite(money,"nominal money",0,strict=True)
    y=(a+money/(4*price))/.6
    interest=(.8*y-money/price)/4000
    private=80-1000*interest
    if interest < -1e-10 or private < -1e-9:
        raise ValueError("AD point outside inherited ordinary-rate/nonnegative-investment domain")
    return {"price":price,"output":y,"interest":max(0,interest),"private_investment":max(0,private),
            "goods_residual":.4*y+1000*interest-a,"money_residual":money/price-(.8*y-4000*interest)}

def ad_as(a=320,money=400,expected_price=1,supply_slope=1,potential=700,cost=0):
    finite(a,"autonomous demand",0);finite(money,"nominal money",0,strict=True)
    finite(expected_price,"expected price",0,strict=True);finite(supply_slope,"supply slope",0)
    finite(potential,"potential output",0,strict=True);finite(cost,"cost shock")
    intercept=expected_price-supply_slope+cost
    b=intercept+supply_slope*a/(potential*.6)
    c=supply_slope*(money/4)/(potential*.6)
    price=(b+math.sqrt(b*b+4*c))/2
    finite(price,"equilibrium price",0,strict=True)
    result=ad_at_price(price,a,money)
    result.update(potential=potential,expected_price=expected_price,cost=cost,
                  output_gap=(result["output"]-potential)/potential,
                  supply_residual=price-(expected_price+supply_slope*(result["output"]-potential)/potential+cost))
    return result

def long_run_price(a=320,money=400,potential=700):
    finite(a,"autonomous demand",0);finite(money,"money",0,strict=True);finite(potential,"potential",0,strict=True)
    denominator=4*(.6*potential-a)
    if denominator<=0: raise ValueError("No positive long-run price for this AD and potential output")
    result=ad_at_price(money/denominator,a,money)
    result["potential"]=potential
    return result

def phillips(unemployment=.04,expected=.02,natural=.05,alpha=.5,shock=0):
    share(unemployment,"unemployment");share(natural,"natural unemployment")
    rate(expected,"expected inflation");finite(alpha,"alpha",0,strict=True);finite(shock,"inflation shock")
    inflation=expected-alpha*(unemployment-natural)+shock
    rate(inflation,"computed inflation")
    return {"unemployment":unemployment,"natural_unemployment":natural,"expected_inflation":expected,
            "inflation":inflation,"unemployment_gap":unemployment-natural,"shock":shock}

def inflation_path(unemployment=(.04,.04,.04,.04),expected=.02,weight=1,natural=.05,alpha=.5,shocks=None):
    people=series(unemployment,"unemployment path");share(weight,"expectation weight")
    shocks=[0]*len(people) if shocks is None else series(shocks,"inflation shocks")
    if len(shocks)!=len(people): raise ValueError("Unemployment and shocks must have matching lengths")
    result=[]
    for period,(u,shock) in enumerate(zip(people,shocks),1):
        row=phillips(u,expected,natural,alpha,shock)
        expected=expected+weight*(row["inflation"]-expected)
        row.update(period=period,next_expected_inflation=expected);result.append(row)
    return result

def disinflation_unemployment(expected=.04,target=.02,natural=.05,alpha=.5,shock=0):
    rate(target,"target inflation")
    phillips(natural,expected,natural,alpha,shock)
    unemployment=natural+(expected+shock-target)/alpha
    share(unemployment,"required unemployment")
    return {"unemployment":unemployment,"inflation":target,"unemployment_gap":unemployment-natural}

def propagation_path(shocks=(-.02,0,0,0,0,0,0,0,0,0,0,0),rho=.6,lag2=0,initial=0,previous=0,potential=700):
    values=series(shocks,"output shocks")
    for name,value in [("rho",rho),("lag2",lag2),("initial gap",initial),("previous gap",previous)]: finite(value,name)
    finite(potential,"potential output",0,strict=True)
    if min(1-rho-lag2,1+rho-lag2,1+lag2)<=1e-12:
        raise ValueError("The specified second-order propagation is not stable")
    if min(initial,previous)<=-1: raise ValueError("Initial gap implies nonpositive output")
    rows=[];last=initial;older=previous
    for period,shock in enumerate(values,1):
        gap=rho*last+lag2*older+shock
        finite(gap,"computed output gap",-1,strict=True)
        rows.append({"period":period,"shock":shock,"output_gap":gap,"output":potential*(1+gap)})
        older,last=last,gap
    return rows

def fiscal_budget(output=700,potential=700,tax0=40,tax_rate=.25,government_consumption=150,
                  public_investment=20,transfer0=20,cyclical_transfer=.2,debt_previous=560,interest=.05):
    for name,value in [("output",output),("tax0",tax0),("government consumption",government_consumption),
                       ("public investment",public_investment),("transfer0",transfer0),("cyclical transfer",cyclical_transfer),("previous debt",debt_previous)]: finite(value,name,0)
    finite(potential,"potential output",0,strict=True);share(tax_rate,"tax rate");rate(interest,"nominal interest")
    taxes=tax0+tax_rate*output
    transfers=transfer0+cyclical_transfer*max(potential-output,0)
    net_taxes=taxes-transfers
    primary=taxes-government_consumption-public_investment-transfers
    interest_bill=interest*debt_previous
    return {"output":output,"gross_taxes":taxes,"transfers":transfers,"net_taxes":net_taxes,
            "government_consumption":government_consumption,"public_investment":public_investment,
            "government_gross_saving":net_taxes-government_consumption,"primary_balance":primary,
            "interest_bill":interest_bill,"overall_balance":primary-interest_bill,
            "new_borrowing_no_other_adjustment":interest_bill-primary,"private_disposable_income":output-net_taxes}

def rule_equilibrium(demand=0,shock=0,expected=.02,target=.02,neutral=.02,sigma=1,kappa=.5,
                     phi_pi=.5,phi_x=.5,policy_shock=0,floor=0):
    for name,value in [("demand",demand),("supply inflation shock",shock),("policy shock",policy_shock)]: finite(value,name)
    for name,value in [("expected inflation",expected),("target inflation",target),("neutral real rate",neutral)]: rate(value,name)
    for name,value in [("sigma",sigma),("kappa",kappa)]: finite(value,name,0,strict=True)
    for name,value in [("phi_pi",phi_pi),("phi_x",phi_x),("floor",floor)]: finite(value,name,0)
    denominator=1+sigma*((1+phi_pi)*kappa+phi_x)
    gap=(demand-sigma*((1+phi_pi)*shock+phi_pi*(expected-target)+policy_shock))/denominator
    def prescriptions(x):
        inflation=expected+kappa*x+shock
        shadow=neutral+inflation+phi_pi*(inflation-target)+phi_x*x+policy_shock
        return inflation,shadow
    inflation,shadow=prescriptions(gap)
    if shadow<floor-1e-12:
        regime="floor";interest=floor
        gap=demand-sigma*(interest-expected-neutral)
        inflation,shadow=prescriptions(gap)
        if shadow>floor+1e-9: raise ValueError("Rate-floor branch is inconsistent")
    else: regime="ordinary";interest=max(floor,shadow)
    finite(gap,"output gap",-1,strict=True);rate(inflation,"computed inflation")
    real_linear=interest-expected
    return {"regime":regime,"output_gap":gap,"inflation":inflation,"expected_inflation":expected,
            "interest":interest,"real_rate_linear":real_linear,"shadow_rule_rate":shadow,
            "demand_residual":gap-(demand-sigma*(real_linear-neutral)),
            "phillips_residual":inflation-(expected+kappa*gap+shock),
            "rule_residual":interest-max(floor,shadow)}

def nominal_growth(real=.02,deflator=.02):
    rate(real,"real growth");rate(deflator,"GDP deflator growth")
    return (1+real)*(1+deflator)-1

def debt_step(previous=.8,interest=.05,growth=.04,primary_surplus=.01,stock_flow=0):
    finite(previous,"previous gross debt ratio",0);rate(interest,"nominal effective interest");rate(growth,"nominal GDP growth")
    finite(primary_surplus,"primary surplus/current GDP");finite(stock_flow,"stock-flow adjustment/current GDP")
    factor=(1+interest)/(1+growth)
    current=factor*previous-primary_surplus+stock_flow
    if current < -1e-12: raise ValueError("Negative gross debt: net asset positions are outside this model")
    current=max(0,current)
    return {"previous_ratio":previous,"debt_ratio":current,"ratio_change":current-previous,
            "interest_growth_contribution":(factor-1)*previous,"primary_contribution":-primary_surplus,
            "stock_flow_contribution":stock_flow,"stabilizing_primary_surplus":(factor-1)*previous+stock_flow}

def debt_path(years=10,initial=.8,initial_gdp=700,interest=.05,growth=.04,primary_surplus=.01,stock_flow=0):
    if isinstance(years,bool) or not isinstance(years,int) or not 1<=years<=100:
        raise ValueError("years must be an integer in [1,100]")
    finite(initial,"initial debt ratio",0);finite(initial_gdp,"initial nominal GDP",0,strict=True)
    ratio=initial;gdp=initial_gdp;debt=initial*gdp
    rows=[{"year":0,"gdp":gdp,"debt":debt,"debt_ratio":ratio}]
    for year in range(1,years+1):
        row=debt_step(ratio,interest,growth,primary_surplus,stock_flow)
        current_gdp=gdp*(1+growth)
        primary_amount=primary_surplus*current_gdp;adjustment_amount=stock_flow*current_gdp
        current_debt=(1+interest)*debt-primary_amount+adjustment_amount
        row.update(year=year,gdp=current_gdp,debt=current_debt,primary_amount=primary_amount,
                   stock_flow_amount=adjustment_amount,nominal_budget_residual=current_debt-row["debt_ratio"]*current_gdp)
        rows.append(row);gdp,debt,ratio=current_gdp,current_debt,row["debt_ratio"]
    return rows
