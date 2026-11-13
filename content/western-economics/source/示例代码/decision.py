"""Chapter 07: input validation and explicit branches."""
import math

try:
    income = float(input("Monthly income (yuan): "))
    expense = float(input("Monthly expense (yuan): "))
    if income < 0 or expense < 0:
        print("Income and expense must be non-negative.")
    elif not math.isfinite(income) or not math.isfinite(expense):
        print("Please enter finite numbers.")
    elif income >= expense:
        print(f"Balance: {income - expense:.2f} yuan")
    else:
        print(f"Shortfall: {expense - income:.2f} yuan")
except ValueError:
    print("Please enter a number, for example 1000.")
