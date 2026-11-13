"""Stage 5 independent teaching models; no external packages or real data."""
import math

PRICE_GAME = (((8, 8), (2, 10)), ((10, 2), (4, 4)))


def number(value, name, minimum=0, strict=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    invalid = value <= minimum if strict else value < minimum
    if invalid:
        raise ValueError(f"{name} outside model domain")
    return value


def monopoly(a=60, b=.5, mc=12, fixed=0):
    number(a,"a",strict=True)
    number(b,"b",strict=True)
    number(mc,"mc")
    number(fixed,"fixed")
    competitive_q=max(0,(a-mc)/b)
    q=competitive_q/2
    price=a-b*q if q else None
    producer_surplus=(price-mc)*q if q else 0
    cs=b*q*q/2
    competitive_ts=b*competitive_q**2/2
    total=producer_surplus+cs
    return {"quantity":q,"price":price,"consumer_surplus":cs,
            "producer_surplus":producer_surplus,"profit":producer_surplus-fixed,
            "total_surplus_gross":total,"total_surplus_net_fixed":total-fixed,
            "competitive_quantity":competitive_q,"competitive_price":mc if competitive_q else None,
            "competitive_total_surplus_gross":competitive_ts,"deadweight_loss":competitive_ts-total,
            "first_degree_quantity":competitive_q,"first_degree_producer_surplus":competitive_ts}


def segmented_monopoly(intercepts=(60,40), slopes=(1,1), mc=20):
    if len(intercepts)!=len(slopes) or not intercepts:
        raise ValueError("Provide matching nonempty demand parameters")
    groups=[monopoly(a,b,mc) for a,b in zip(intercepts,slopes)]
    return {"groups":groups,"quantity":sum(row["quantity"] for row in groups),
            "profit":sum(row["profit"] for row in groups),
            "consumer_surplus":sum(row["consumer_surplus"] for row in groups)}


def pure_nash(payoffs=PRICE_GAME, actions_a=("high","low"), actions_b=("high","low")):
    if not actions_a or not actions_b or len(payoffs)!=len(actions_a):
        raise ValueError("Nonempty actions and matching rows required")
    if len(set(actions_a))!=len(actions_a) or len(set(actions_b))!=len(actions_b):
        raise ValueError("Action names must be unique")
    for row in payoffs:
        if len(row)!=len(actions_b):
            raise ValueError("Payoff columns do not match actions")
        for pair in row:
            if len(pair)!=2:
                raise ValueError("Each cell needs two payoffs")
            for value in pair:
                number(value,"payoff",minimum=-1e100)
    result=[]
    for i,action_a in enumerate(actions_a):
        for j,action_b in enumerate(actions_b):
            best_a=max(payoffs[k][j][0] for k in range(len(actions_a)))
            best_b=max(payoffs[i][k][1] for k in range(len(actions_b)))
            if payoffs[i][j][0]==best_a and payoffs[i][j][1]==best_b:
                result.append({"a":action_a,"b":action_b,"payoffs":list(payoffs[i][j])})
    return result


def cournot(firms=2,a=60,b=.5,mc=12):
    if isinstance(firms,bool) or not isinstance(firms,int) or firms<1:
        raise ValueError("firms must be a positive integer")
    number(a,"a",strict=True)
    number(b,"b",strict=True)
    number(mc,"mc")
    each=max(0,(a-mc)/(b*(firms+1)))
    total=firms*each
    price=a-b*total if total else None
    return {"firms":firms,"quantity_each":each,"quantity":total,"price":price,
            "profit_each":(price-mc)*each if total else 0,
            "consumer_surplus":b*total*total/2}


def exchange_equilibrium(endowment_a=(8,2),endowment_b=(2,8)):
    if len(endowment_a)!=2 or len(endowment_b)!=2:
        raise ValueError("Each endowment has two goods")
    for value in (*endowment_a,*endowment_b):
        number(value,"endowment")
    total_x=endowment_a[0]+endowment_b[0]
    total_y=endowment_a[1]+endowment_b[1]
    if total_x<=0 or total_y<=0:
        raise ValueError("Both aggregate goods must be positive")
    px=total_y/total_x  # py is normalized to one.
    people=[]
    for endowment in [endowment_a,endowment_b]:
        wealth=px*endowment[0]+endowment[1]
        x,y=wealth/(2*px),wealth/2
        people.append({"wealth":wealth,"x":x,"y":y,"utility":math.sqrt(x*y),
                       "initial_utility":math.sqrt(endowment[0]*endowment[1])})
    return {"px":px,"py":1,"total_x":total_x,"total_y":total_y,"a":people[0],"b":people[1]}


def pareto_improves(candidate,baseline,tolerance=1e-12):
    if not candidate or len(candidate)!=len(baseline):
        raise ValueError("Compare the same nonempty list of people")
    number(tolerance,"tolerance")
    for value in (*candidate,*baseline):
        number(value,"utility",minimum=-1e100)
    return all(x>=y-tolerance for x,y in zip(candidate,baseline)) and any(x>y+tolerance for x,y in zip(candidate,baseline))


def exchange_grid(total_x=10,total_y=10):
    for count in [total_x,total_y]:
        if isinstance(count,bool) or not isinstance(count,int) or not 1<=count<=20:
            raise ValueError("Grid totals must be integers from 1 to 20")
    points=[]
    for x in range(total_x+1):
        for y in range(total_y+1):
            points.append({"x_a":x,"y_a":y,"utilities":(math.sqrt(x*y),math.sqrt((total_x-x)*(total_y-y)))})
    frontier=[p for p in points if not any(pareto_improves(other["utilities"],p["utilities"]) for other in points)]
    return {"points":len(points),"frontier":frontier}


def externality(a=60,b=.5,c=12,d=.25,damage_slope=.25):
    number(a,"a",strict=True)
    number(b,"b",strict=True)
    for name,value in [("c",c),("d",d),("damage_slope",damage_slope)]:
        number(value,name)
    private_q=max(0,(a-c)/(b+d))
    efficient_q=max(0,(a-c)/(b+d+damage_slope))
    def welfare(q):
        return (a-c)*q-(b+d+damage_slope)*q*q/2
    optimal_tax=damage_slope*efficient_q
    return {"private_quantity":private_q,"efficient_quantity":efficient_q,"optimal_unit_tax":optimal_tax,
            "consumer_price_at_optimum":a-b*efficient_q if efficient_q else None,
            "producer_price_at_optimum":c+d*efficient_q if efficient_q else None,
            "welfare_private":welfare(private_q),"welfare_efficient":welfare(efficient_q),
            "deadweight_loss":welfare(efficient_q)-welfare(private_q),
            "damage_private":damage_slope*private_q**2/2,"damage_efficient":damage_slope*efficient_q**2/2,
            "tax_revenue":optimal_tax*efficient_q}


def abatement(required=12,cost_a=2,cost_b=6,capacity_a=10,capacity_b=10):
    number(required,"required")
    number(cost_a,"cost_a",strict=True)
    number(cost_b,"cost_b",strict=True)
    number(capacity_a,"capacity_a")
    number(capacity_b,"capacity_b")
    if required>capacity_a+capacity_b:
        raise ValueError("Abatement exceeds combined capacity")
    lower=max(0,required-capacity_b)
    upper=min(capacity_a,required)
    qa=min(upper,max(lower,cost_b*required/(cost_a+cost_b)))
    qb=required-qa
    return {"a":qa,"b":qb,"marginal_cost_a":cost_a*qa,"marginal_cost_b":cost_b*qb,
            "cost":cost_a*qa*qa/2+cost_b*qb*qb/2,
            "interior":0<qa<capacity_a and 0<qb<capacity_b}


def public_good(valuations=(20,12),slopes=(1,1),unit_cost=16):
    if len(valuations)!=len(slopes) or not valuations:
        raise ValueError("Matching nonempty preferences required")
    number(unit_cost,"unit_cost",strict=True)
    for a,b in zip(valuations,slopes):
        number(a,"valuation")
        number(b,"slope",strict=True)
    def social_mb(q):
        return sum(max(0,a-b*q) for a,b in zip(valuations,slopes))
    lower,upper=0,max(a/b for a,b in zip(valuations,slopes))
    if social_mb(0)<=unit_cost:
        efficient=0
    else:
        for _ in range(80):
            middle=(lower+upper)/2
            if social_mb(middle)>unit_cost:
                lower=middle
            else:
                upper=middle
        efficient=(lower+upper)/2
    desired=[max(0,(a-unit_cost)/b) for a,b in zip(valuations,slopes)]
    voluntary=max(desired)
    def welfare(q):
        benefit=0
        for a,b in zip(valuations,slopes):
            amount=min(q,a/b)
            benefit+=a*amount-b*amount*amount/2
        return benefit-unit_cost*q
    return {"efficient_quantity":efficient,"voluntary_quantity":voluntary,
            "marginal_benefits_at_optimum":[max(0,a-b*efficient) for a,b in zip(valuations,slopes)],
            "welfare_efficient":welfare(efficient),"welfare_voluntary":welfare(voluntary),
            "private_desired_totals":desired}


def commons(users=2,net_return=8,crowding=1):
    if isinstance(users,bool) or not isinstance(users,int) or users<1:
        raise ValueError("users must be a positive integer")
    number(net_return,"net_return")
    number(crowding,"crowding",strict=True)
    each=net_return/(crowding*(users+1))
    total=users*each
    efficient=net_return/(2*crowding)
    return {"effort_each":each,"noncooperative_total_effort":total,"efficient_total_effort":efficient,
            "welfare_noncooperative":net_return*total-crowding*total*total,
            "welfare_efficient":net_return*efficient-crowding*efficient*efficient}


def lemons(high_value=200,low_value=100,high_cost=160,low_cost=80,high_share=.5):
    for name,value in [("high_value",high_value),("low_value",low_value),("high_cost",high_cost),("low_cost",low_cost)]:
        number(value,name)
    number(high_share,"high_share",strict=True)
    if high_share>=1 or high_value<low_value or high_cost<low_cost:
        raise ValueError("Require 0<share<1 and ordered values/reservation prices")
    types=[{"name":"high","value":high_value,"cost":high_cost,"share":high_share},
           {"name":"low","value":low_value,"cost":low_cost,"share":1-high_share}]
    active=types[:]
    trace=[]
    while active:
        mass=sum(row["share"] for row in active)
        price=sum(row["share"]*row["value"] for row in active)/mass
        trace.append({"active":[row["name"] for row in active],"offered_price":price})
        remaining=[row for row in active if row["cost"]<=price]
        if len(remaining)==len(active):
            break
        active=remaining
    return {"trace":trace,"active_types":[row["name"] for row in active],
            "price":price if active else None,"trade_share":sum(row["share"] for row in active),
            "full_information_gains":sum(row["share"]*max(0,row["value"]-row["cost"]) for row in types),
            "selection_gains":sum(row["share"]*(row["value"]-row["cost"]) for row in active)}


def hidden_action(coverage=.5,loss=100,effort_cost=4,p_no_effort=.3,p_effort=.1):
    for name,value in [("coverage",coverage),("loss",loss),("effort_cost",effort_cost),("p_no_effort",p_no_effort),("p_effort",p_effort)]:
        number(value,name)
    if coverage>1 or p_no_effort>1 or p_effort>p_no_effort:
        raise ValueError("Coverage/probability outside model domain")
    no_effort=(1-coverage)*p_no_effort*loss
    effort=effort_cost+(1-coverage)*p_effort*loss
    chosen=effort<=no_effort+1e-12
    probability=p_effort if chosen else p_no_effort
    return {"coverage":coverage,"no_effort_private_cost":no_effort,"effort_private_cost":effort,
            "choose_effort":chosen,"loss_probability":probability,
            "expected_claim":coverage*probability*loss,
            "social_cost":probability*loss+(effort_cost if chosen else 0)}


def signaling_incentives(high_cost=2,low_cost=8,wage_premium=6):
    for name,value in [("high_cost",high_cost),("low_cost",low_cost),("wage_premium",wage_premium)]:
        number(value,name)
    if high_cost>low_cost:
        raise ValueError("High type must have the lower signaling cost in this example")
    return {"high_type_net_gain":wage_premium-high_cost,"low_type_net_gain":wage_premium-low_cost,
            "incentive_conditions_met":high_cost<=wage_premium<low_cost}
