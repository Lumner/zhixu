"""Chapter 20: finite differences, a smooth optimum and a corner."""
from micro import forward_difference, linear_choice


def square(x):
    return x*x


def net_benefit(q):
    return 8*q - q*q


if __name__ == "__main__":
    for h in [1, .1, .01, .001]:
        print(f"h={h:.3f}, forward difference={forward_difference(square,3,h):.6f}")
    candidates = [0, 2, 4, 6, 10]
    for q in candidates:
        print(f"q={q:2d}, net benefit={net_benefit(q):.2f}")
    corner = linear_choice()
    print(f"Linear-utility corner: x={corner['x']:.2f}, y={corner['y']:.2f}")
