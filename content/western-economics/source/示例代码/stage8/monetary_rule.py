"""Chapter 49: three-equation rate-rule model, linear real-rate approximation."""
from policy_models import rule_equilibrium
for name,inputs in [("base",{}),("demand +.02",{"demand":.02}),("supply +.01",{"shock":.01}),("policy +.01",{"policy_shock":.01}),("floor demand -.1",{"demand":-.1})]:
    r=rule_equilibrium(**inputs)
    print(f"{name}: {r['regime']}, gap={r['output_gap']:.6%}, inflation={r['inflation']:.6%}, i={r['interest']:.6%}, shadow={r['shadow_rule_rate']:.6%}")
