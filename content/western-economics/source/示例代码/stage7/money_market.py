"""Chapter 42: independent money-market arithmetic and a one-period bond."""
from short_run import parameters,money_market,bond_price

for y,money,price in [(700,400,1),(800,400,1),(700,500,1),(700,400,2)]:
    r=money_market(y,parameters(money=money,price=price))
    print(f"Y={y}, M={money}, P={price}: i={r['interest']:.6%}, real balances={r['real_money_supply']:.2f}")
for interest in [.04,.05]:
    print(f"One-period face 100, i={interest:.2%}: price={bond_price(100,interest):.6f}")
