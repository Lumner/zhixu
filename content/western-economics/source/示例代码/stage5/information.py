"""Chapter 32: participation, hidden effort and signaling incentives."""
from models import lemons,hidden_action,signaling_incentives

row=lemons()
print("Lemons trace:",row["trace"])
print(f"Remaining={row['active_types']}, price={row['price']:.2f}, trade share={row['trade_share']:.2f}")
for coverage in [0,.5,1]:
    action=hidden_action(coverage)
    print(f"Coverage={coverage:.1f}, effort={action['choose_effort']}, social cost={action['social_cost']:.2f}")
print("Signaling incentive conditions:",signaling_incentives())
