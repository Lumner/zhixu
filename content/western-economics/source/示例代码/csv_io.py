"""Chapter 11: locate source data from this file, not the current directory."""
import csv
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read_prices(path):
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["scenario", "price"]:
            raise ValueError("Expected columns: scenario,price")
        for line, row in enumerate(reader, start=2):
            if None in row or not row["scenario"] or row["price"] is None:
                raise ValueError(f"Line {line}: incomplete or extra fields")
            try:
                price = float(row["price"])
            except ValueError as exc:
                raise ValueError(f"Line {line}: invalid price") from exc
            if not math.isfinite(price) or price < 0:
                raise ValueError(f"Line {line}: price must be finite and non-negative")
            rows.append({"scenario": row["scenario"], "price": price})
    if not rows:
        raise ValueError("No price rows")
    return rows


def main():
    rows = read_prices(HERE / "data" / "prices.csv")
    output = HERE / "output"
    output.mkdir(exist_ok=True)
    target = output / "demand-results.csv"
    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["scenario", "price", "quantity"])
        writer.writeheader()
        for row in rows:
            quantity = max(0, 120 - 2 * row["price"])
            writer.writerow({**row, "quantity": quantity})
    print("Wrote output/demand-results.csv")


if __name__ == "__main__":
    main()
