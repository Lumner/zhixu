"""Chapter 52: extreme mobility, fixed prices, static small-open-economy model."""
from open_growth import mundell_fleming
for name,inputs in [("float base",{}),("float fiscal",{"fiscal_change":20}),("float money",{"money":480}),
                    ("fixed fiscal",{"regime":"fixed","fiscal_change":20}),("fixed money attempt",{"regime":"fixed","money":480})]:
    r=mundell_fleming(**inputs)
    print(f"{name}: Y={r['output']:.6f}, q={r['real_exchange_rate']:.6f}, NX={r['net_exports']:.6f}, money={r['equilibrium_money']:.6f}, reversal={r['required_reversal_for_peg']}")
