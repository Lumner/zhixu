"""Open-economy and growth teaching blocks. No real exchange rates or forecasts.

e is domestic currency per foreign currency; FA is assets minus liabilities.
Solow capital is per effective worker; timing uses exact discrete dilution.
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
    if value>1: raise ValueError(name+" must be at most 1")
    return value

def horizon(years):
    if isinstance(years,bool) or not isinstance(years,int) or not 0<=years<=500:
        raise ValueError("years must be an integer in [0,500]")

def exchange_quote(old=7,new=7.7,foreign_price=20,domestic_price=154):
    for name,value in [("old quote",old),("new quote",new),("foreign basket price",foreign_price),("domestic basket price",domestic_price)]: finite(value,name,0,strict=True)
    return {"e_old":old,"e_new":new,"domestic_per_foreign_change":new/old-1,
            "domestic_currency_foreign_value_change":old/new-1,
            "real_exchange_rate":new*foreign_price/domestic_price}

def uip_rate(spot=7,expected=7.14,foreign_interest=.04):
    finite(spot,"spot",0,strict=True);finite(expected,"expected future quote",0,strict=True);rate(foreign_interest,"foreign interest")
    return (1+foreign_interest)*expected/spot-1

def external_accounts(exports=120,imports=100,primary_income=-5,current_transfers=3,
                      capital_account=2,asset_acquisition=35,liability_incurrence=15,errors=0):
    for name,value in [("exports",exports),("imports",imports)]: finite(value,name,0)
    for name,value in [("primary income",primary_income),("current transfers",current_transfers),("capital account",capital_account),
                       ("asset acquisition",asset_acquisition),("liability incurrence",liability_incurrence),("errors",errors)]: finite(value,name)
    nx=exports-imports;ca=nx+primary_income+current_transfers
    fa=asset_acquisition-liability_incurrence
    residual=ca+capital_account-fa+errors
    return {"net_exports":nx,"current_account":ca,"capital_account":capital_account,
            "financial_account_net_lending":fa,"errors":errors,"required_errors":fa-ca-capital_account,
            "residual":residual,"consistent":math.isclose(residual,0,abs_tol=1e-9)}

def mundell_fleming(regime="floating",fiscal_change=0,money=400,peg=1,world_interest=.04):
    if regime not in ("floating","fixed"): raise ValueError("Unknown exchange-rate regime")
    finite(fiscal_change,"government consumption change");finite(money,"money level/attempt",0)
    finite(peg,"real exchange-rate peg",0,strict=True);finite(world_interest,"world interest",0)
    g=150+fiscal_change;finite(g,"government consumption",0)
    private=80-1000*world_interest
    if private < -1e-9: raise ValueError("World rate implies negative private investment")
    a=390+fiscal_change
    if regime=="floating":
        y=(money+4000*world_interest)/.8
        q=1+(.5*y-a+1000*world_interest)/100
        actual_money=money
    else:
        q=peg;y=(a-1000*world_interest+100*(q-1))/.5
        actual_money=.8*y-4000*world_interest
    finite(y,"output",0);finite(q,"real exchange rate",0,strict=True);finite(actual_money,"required money",0)
    taxes=40+.2*y;consumption=100+.75*(y-taxes)
    finite(consumption,"consumption",0)
    investment=max(0,private)+20
    nx=70+100*(q-1)-.1*y
    return {"regime":regime,"output":y,"real_exchange_rate":q,"interest":world_interest,
            "government_consumption":g,"private_investment":max(0,private),"public_investment":20,
            "net_exports":nx,"consumption":consumption,"investment":investment,
            "requested_money":money,"equilibrium_money":actual_money,
            "required_reversal_for_peg":actual_money-money if regime=="fixed" else None,
            "goods_residual":y-(consumption+investment+g+nx),
            "money_residual":actual_money-(.8*y-4000*world_interest)}

def doubling_time(growth=.03):
    rate(growth,"growth")
    return math.log(2)/math.log1p(growth) if growth>0 else None

def growth_path(output=1000,population=100,output_growth=.05,population_growth=.02,years=10):
    finite(output,"initial real output",0,strict=True);finite(population,"initial population",0,strict=True)
    rate(output_growth,"output growth");rate(population_growth,"population growth");horizon(years)
    rows=[]
    for year in range(years+1):
        finite(output,"output",0,strict=True);finite(population,"population",0,strict=True)
        per_capita=output/population;finite(per_capita,"per capita",0,strict=True)
        rows.append({"year":year,"output":output,"population":population,"per_capita":per_capita,
                     "per_capita_growth":(1+output_growth)/(1+population_growth)-1})
        output*=1+output_growth;population*=1+population_growth
    return rows

def solow_parameters(saving,alpha,depreciation,population_growth,technology_growth):
    share(saving,"saving");share(depreciation,"depreciation")
    finite(alpha,"alpha",0,strict=True)
    if alpha>=1: raise ValueError("Solow alpha must be less than 1")
    finite(population_growth,"population growth",0);finite(technology_growth,"labor-augmenting technology growth",0)
    dilution=(1+population_growth)*(1+technology_growth)
    break_even=dilution-(1-depreciation)
    if break_even<=0: raise ValueError("This lesson requires a positive replacement/dilution coefficient")
    return dilution,break_even

def solow_steady(saving=.2,alpha=.5,depreciation=.08,population_growth=.02,technology_growth=0):
    _,break_even=solow_parameters(saving,alpha,depreciation,population_growth,technology_growth)
    try: k=(saving/break_even)**(1/(1-alpha))
    except OverflowError as exc: raise ValueError("Steady capital exceeds floating-point range") from exc
    finite(k,"steady capital",0)
    y=k**alpha
    return {"capital_per_effective_worker":k,"output_per_effective_worker":y,
            "consumption_per_effective_worker":(1-saving)*y,"break_even_coefficient":break_even,
            "steady_residual":saving*y-break_even*k}

def solow_path(initial=1,years=200,saving=.2,alpha=.5,depreciation=.08,population_growth=.02,technology_growth=0):
    finite(initial,"initial effective-worker capital",0);horizon(years)
    dilution,break_even=solow_parameters(saving,alpha,depreciation,population_growth,technology_growth)
    k=initial;technology=1;labor=1;rows=[]
    for year in range(years+1):
        finite(k,"effective-worker capital",0)
        finite(technology,"technology",0,strict=True);finite(labor,"labor",0,strict=True)
        effective_output=k**alpha
        finite(k*technology*labor,"aggregate capital",0)
        finite(effective_output*technology*labor,"aggregate output",0)
        rows.append({"year":year,"capital_per_effective_worker":k,"output_per_effective_worker":effective_output,
                     "consumption_per_effective_worker":(1-saving)*effective_output,
                     "technology":technology,"labor":labor,"capital":k*technology*labor,
                     "output":effective_output*technology*labor,"output_per_worker":technology*effective_output,
                     "investment_per_effective_worker":saving*effective_output,"break_even_investment":break_even*k})
        k=((1-depreciation)*k+saving*effective_output)/dilution
        technology*=1+technology_growth;labor*=1+population_growth
    return rows

def golden_rule(alpha=.5,depreciation=.08,population_growth=.02,technology_growth=0):
    return solow_steady(alpha,alpha,depreciation,population_growth,technology_growth)

def growth_accounting(capital_growth=.1,labor_growth=.02,technology_growth=.02,alpha=.5):
    finite(alpha,"alpha",0,strict=True)
    if alpha>=1: raise ValueError("alpha must be less than 1")
    for name,value in [("capital growth",capital_growth),("labor growth",labor_growth),("labor-augmenting technology growth",technology_growth)]: rate(value,name)
    capital=alpha*math.log1p(capital_growth)
    labor=(1-alpha)*math.log1p(labor_growth)
    technology=(1-alpha)*math.log1p(technology_growth)
    total=capital+labor+technology
    return {"capital_log_contribution":capital,"labor_log_contribution":labor,"technology_log_contribution":technology,
            "tfp_log_growth":technology,"output_log_growth":total,"output_growth":math.expm1(total)}

def ak_growth(productivity=.2,saving=.5,depreciation=.05):
    finite(productivity,"AK output/capital coefficient",0,strict=True);share(saving,"saving");share(depreciation,"depreciation")
    return {"growth":saving*productivity-depreciation,"capital_factor":1+saving*productivity-depreciation}

def adjustment_comparison(shift=20):
    finite(shift,"autonomous demand change")
    a=320+shift;finite(a,"autonomous demand",0)
    rows=[]
    for slope,label in [(0,"fixed_prices"),(1,"partial_adjustment"),(4,"steeper_supply")]:
        b=1-slope+slope*a/420;c=slope*100/420
        price=(b+math.sqrt(b*b+4*c))/2
        finite(price,"comparison price",0,strict=True)
        y=(a+100/price)/.6
        interest=(a-.4*y)/1000
        if interest < -1e-9 or interest>.08+1e-9: raise ValueError("Comparison outside inherited ordinary investment domain")
        rows.append({"case":label,"supply_slope":slope,"output":y,"price":price,
                     "ad_residual":.6*y-a-100/price,"supply_residual":price-(1+slope*(y-700)/700)})
    if 420-a<=0: raise ValueError("No positive fixed-potential price")
    long_interest=(a-.4*700)/1000
    if long_interest < -1e-9 or long_interest>.08+1e-9: raise ValueError("Long-run comparison outside inherited investment domain")
    long_price=100/(420-a)
    rows.append({"case":"fixed_potential_long_run","supply_slope":None,"output":700,"price":long_price,
                 "ad_residual":.6*700-a-100/long_price,"supply_residual":None})
    return rows
