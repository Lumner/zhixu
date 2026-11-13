"""Chapter 36: an unchanged eligible population, different labor-force states."""
from macro import load_table,labour_indicators

def percent(value):
    return f"{value:.6%}" if value is not None else "undefined"

for row in load_table("labour.csv"):
    result=labour_indicators(row["employed"],row["unemployed"],row["outside"],row["population"])
    print(f"{row['scenario']}: E={result['employed']:.0f}, U={result['unemployed']:.0f}, LF={result['labour_force']:.0f}, unemployment={percent(result['unemployment_rate'])}, participation={percent(result['participation_rate'])}, E/pop={percent(result['employment_population_ratio'])}")
