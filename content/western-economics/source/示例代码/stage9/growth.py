"""Chapter 53: aggregate versus per-capita compound growth."""
from open_growth import growth_path,doubling_time
rows=growth_path()
for r in [rows[0],rows[-1]]:
    print(f"Year {r['year']}: Y={r['output']:.6f}, N={r['population']:.6f}, Y/N={r['per_capita']:.6f}")
print(f"Per-capita growth: {rows[0]['per_capita_growth']:.6%}")
print(f"Exact doubling at 3%: {doubling_time():.6f}; zero-growth case: {doubling_time(0)}")
