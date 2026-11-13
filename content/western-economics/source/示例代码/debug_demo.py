"""Chapter 12: import a function and check independently known answers."""
from functions import demand

assert demand(0) == 120
assert demand(24) == 72
assert demand(60) == 0
assert demand(70) == 0
print("Four demand checks passed.")
