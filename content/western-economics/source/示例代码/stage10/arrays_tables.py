"""Chapter 57 complete entrypoint: print array/table examples; no files written."""
import numpy as np
from lab import clean_households

def main():
    prices = np.array([2, 3, 4], dtype=float)
    quantities = np.array([10, 8, 6], dtype=float)
    print("shape:", prices.shape, "dtype:", prices.dtype)
    print("revenues:", (prices*quantities).tolist(), "sum:", float((prices*quantities).sum()))
    print("matrix shape:", np.column_stack([prices, quantities]).shape)
    frame, audit = clean_households()
    print("audit:", audit)
    print(frame.to_string(index=False))
    print("mean income:", float(frame["income"].mean()))

if __name__ == "__main__": main()
