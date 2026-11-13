"""Stage 6 measurement examples. Synthetic samples and a separate official reading.

G denotes government final consumption; I includes public/private investment.
Functions perform accounting/measurement, not behavioral forecasting.
"""
import csv
import json
import math
from pathlib import Path

DATA=Path(__file__).resolve().parent/"data"
SCHEMAS={
    "value_added.csv":(("stage","output","intermediate"),("output","intermediate")),
    "goods.csv":(("good","base_price","base_quantity","current_price","current_quantity"),("base_price","base_quantity","current_price","current_quantity")),
    "producer_prices.csv":(("good","base_price","base_quantity","current_price"),("base_price","base_quantity","current_price")),
    "labour.csv":(("scenario","population","employed","unemployed","outside"),("population","employed","unemployed","outside")),
    "quarterly.csv":(("year","quarter","value"),("year","quarter","value")),
    "vintages.csv":(("vintage","year","quarter","value"),("year","quarter","value")),
}


def number(value,name,minimum=None,strict=False):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if minimum is not None and (value<=minimum if strict else value<minimum):
        raise ValueError(f"{name} outside measurement domain")
    return value


def read_table(path,columns,numeric_columns):
    rows=[]
    with Path(path).open(encoding="utf-8-sig",newline="") as handle:
        reader=csv.DictReader(handle)
        if reader.fieldnames!=list(columns):
            raise ValueError("Unexpected CSV columns")
        for line,row in enumerate(reader,start=2):
            if None in row or any(value is None or not value.strip() for value in row.values()):
                raise ValueError(f"Line {line}: missing or extra fields")
            for key in numeric_columns:
                try:
                    row[key]=float(row[key])
                except ValueError as exc:
                    raise ValueError(f"Line {line}: invalid {key}") from exc
                number(row[key],key)
            rows.append(row)
    if not rows:
        raise ValueError("CSV has no data rows")
    return rows


def load_table(name):
    if name not in SCHEMAS:
        raise ValueError("Unknown teaching table")
    columns,numeric=SCHEMAS[name]
    return read_table(DATA/name,columns,numeric)


def load_json(name):
    if name not in ("accounts.json","metadata.json","official_reading.json"):
        raise ValueError("Unknown teaching JSON")
    value=json.loads((DATA/name).read_text(encoding="utf-8"))
    if not isinstance(value,dict):
        raise ValueError("Expected a JSON object")
    return value


def load_accounts():
    result=load_json("accounts.json")
    expected={"y","c","g","i","x","m","t","net_primary_income","net_current_transfers"}
    if set(result)!=expected:
        raise ValueError("Unexpected national-account fields")
    return result


def growth_rate(current,previous):
    number(current,"current",0)
    number(previous,"previous",0)
    return current/previous-1 if previous>0 else None


def production_chain(rows):
    if not rows:
        raise ValueError("Need production records")
    stages=[]
    for row in rows:
        output=number(row["output"],"output",0)
        intermediate=number(row["intermediate"],"intermediate",0)
        stages.append({"stage":row["stage"],"value_added":output-intermediate})
    return {"stages":stages,"gdp":sum(r["value_added"] for r in stages),
            "naive_output_sum":sum(row["output"] for row in rows)}


def expenditure_gdp(c,i,g,x,m):
    for name,value in [("c",c),("g",g),("x",x),("m",m)]:
        number(value,name,0)
    number(i,"i")  # Inventory reduction can make investment negative.
    return c+i+g+x-m


def validate_goods(rows,require_current_quantity=False):
    if not rows:
        raise ValueError("Need a nonempty goods table")
    names=[]
    for row in rows:
        if not isinstance(row["good"],str) or not row["good"].strip():
            raise ValueError("Each good needs an identifier")
        names.append(row["good"])
        number(row["base_price"],"base_price",0,strict=True)
        number(row["current_price"],"current_price",0,strict=True)
        number(row["base_quantity"],"base_quantity",0)
        if require_current_quantity:
            number(row["current_quantity"],"current_quantity",0)
    if len(set(names))!=len(names):
        raise ValueError("Duplicate goods would double-count")


def price_volume(rows):
    validate_goods(rows,True)
    base=sum(r["base_price"]*r["base_quantity"] for r in rows)
    nominal=sum(r["current_price"]*r["current_quantity"] for r in rows)
    real=sum(r["base_price"]*r["current_quantity"] for r in rows)
    if base<=0:
        raise ValueError("Positive base-period output required")
    deflator=nominal/real*100 if real>0 else None
    return {"base_nominal":base,"current_nominal":nominal,"current_real_at_base_prices":real,
            "deflator_base_100":deflator,"nominal_growth":nominal/base-1,"real_growth":real/base-1,
            "deflator_growth":deflator/100-1 if deflator is not None else None}


def fixed_basket_index(rows):
    validate_goods(rows)
    base=sum(r["base_price"]*r["base_quantity"] for r in rows)
    current=sum(r["current_price"]*r["base_quantity"] for r in rows)
    if base<=0:
        raise ValueError("Positive base-basket cost required")
    return {"base_cost":base,"current_cost_of_base_basket":current,"index_base_100":current/base*100,
            "inflation_since_base":current/base-1,
            "base_expenditure_weights":{r["good"]:r["base_price"]*r["base_quantity"]/base for r in rows}}


def real_growth(nominal_growth,price_growth):
    number(nominal_growth,"nominal_growth",-1)
    number(price_growth,"price_growth",-1,strict=True)
    return (1+nominal_growth)/(1+price_growth)-1


def real_interest(nominal_rate,inflation):
    number(nominal_rate,"nominal_rate",-1,strict=True)
    return real_growth(nominal_rate,inflation)


def labour_indicators(employed,unemployed,outside,population=None):
    for name,value in [("employed",employed),("unemployed",unemployed),("outside",outside)]:
        number(value,name,0)
    total=employed+unemployed+outside
    if population is not None:
        number(population,"population",0)
        if not math.isclose(total,population,rel_tol=1e-10,abs_tol=1e-9):
            raise ValueError("Population does not equal E+U+N")
    force=employed+unemployed
    return {"population":total,"employed":employed,"unemployed":unemployed,"outside":outside,"labour_force":force,
            "unemployment_rate":unemployed/force if force>0 else None,
            "participation_rate":force/total if total>0 else None,
            "employment_population_ratio":employed/total if total>0 else None}


def national_accounts(y,c,g,i,x,m,t,net_primary_income=0,net_current_transfers=0):
    number(y,"y",0)
    expenditure=expenditure_gdp(c,i,g,x,m)
    for name,value in [("t",t),("net_primary_income",net_primary_income),("net_current_transfers",net_current_transfers)]:
        number(value,name)
    nx=x-m
    disposable=y+net_primary_income+net_current_transfers
    private_saving=disposable-t-c
    government_saving=t-g
    saving=private_saving+government_saving
    ca=nx+net_primary_income+net_current_transfers
    residual=y-expenditure
    return {"gdp_expenditure":expenditure,"gdp_residual":residual,
            "consistent":math.isclose(residual,0,abs_tol=1e-9),"net_exports":nx,
            "gross_national_disposable_income":disposable,"private_gross_saving":private_saving,
            "government_gross_saving":government_saving,"national_gross_saving":saving,
            "investment":i,"current_account":ca,"saving_investment_current_account_residual":saving-i-ca}


def period_key(row):
    year,quarter=row["year"],row["quarter"]
    number(year,"year",1)
    number(quarter,"quarter",1)
    if int(year)!=year or int(quarter)!=quarter or quarter>4:
        raise ValueError("Expected integer year and quarter 1-4")
    return int(year),int(quarter)


def ordered_quarters(rows):
    if not rows:
        raise ValueError("Need quarterly data")
    result=sorted(rows,key=period_key)
    serials=[]
    for row in result:
        year,quarter=period_key(row)
        number(row["value"],"quarterly value",0)
        serials.append(year*4+quarter-1)
    if any(b-a!=1 for a,b in zip(serials,serials[1:])):
        raise ValueError("Quarterly data contain duplicates or gaps")
    return result


def quarterly_rates(rows):
    ordered=ordered_quarters(rows)
    values={period_key(r):r["value"] for r in ordered}
    result=[]
    for row in ordered:
        year,quarter=period_key(row)
        previous=(year,quarter-1) if quarter>1 else (year-1,4)
        last_year=(year-1,quarter)
        result.append({"year":year,"quarter":quarter,"value":row["value"],
                       "qoq":growth_rate(row["value"],values[previous]) if previous in values else None,
                       "yoy":growth_rate(row["value"],values[last_year]) if last_year in values else None})
    return result


def adjust_with_known_factors(rows,factors=(1,1.1,1.05,1.25)):
    if len(factors)!=4:
        raise ValueError("Need four quarterly factors")
    for factor in factors:
        number(factor,"season factor",0,strict=True)
    average=sum(factors)/4
    return [{"year":period_key(r)[0],"quarter":period_key(r)[1],
             "value":r["value"]/(factors[period_key(r)[1]-1]/average)} for r in ordered_quarters(rows)]


def annual_totals(rows):
    grouped={}
    for row in ordered_quarters(rows):
        year,quarter=period_key(row)
        grouped.setdefault(year,[]).append((quarter,row["value"]))
    if any([q for q,_ in group]!=[1,2,3,4] for group in grouped.values()):
        raise ValueError("An annual total requires all four quarters")
    return {str(year):sum(value for _,value in group) for year,group in grouped.items()}


def cumulative_to_quarters(rows):
    result=[]
    previous_year=None
    previous_value=0
    for row in ordered_quarters(rows):
        year,quarter=period_key(row)
        if year!=previous_year:
            if quarter!=1:
                raise ValueError("Need Q1 to start a cumulative year")
            previous_value=0
        increment=row["value"]-previous_value
        if increment<0:
            raise ValueError("This non-negative output example cannot have falling cumulative totals")
        result.append({"year":year,"quarter":quarter,"value":increment})
        previous_year,previous_value=year,row["value"]
    return result


def vintage_growth(rows,vintage,older=(2023,1),newer=(2024,1)):
    values={}
    for row in rows:
        key=(row["vintage"],*period_key(row))
        if key in values:
            raise ValueError("Duplicate period within a vintage")
        number(row["value"],"vintage value",0)
        values[key]=row["value"]
    first=(vintage,*older)
    last=(vintage,*newer)
    if first not in values or last not in values:
        raise ValueError("Both observations must exist in the selected vintage")
    return growth_rate(values[last],values[first])
