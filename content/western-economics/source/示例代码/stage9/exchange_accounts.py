"""Chapter 51: fictional currency quote, baskets, UIP and external ledger."""
from open_growth import exchange_quote,uip_rate,external_accounts
r=exchange_quote()
print(f"e change={r['domestic_per_foreign_change']:.6%}; domestic foreign-value change={r['domestic_currency_foreign_value_change']:.6%}; q={r['real_exchange_rate']:.6f}")
print(f"UIP expected-return domestic rate: {uip_rate():.6%}")
print("External ledger:",external_accounts())
