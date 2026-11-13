"""Chapter 47: a supplied shock and alternative stable propagation rules."""
from policy_models import propagation_path
for name,rho,lag2 in [("less persistence",.6,0),("more persistence",.9,0),("damped oscillation",1.2,-.5)]:
    rows=propagation_path(rho=rho,lag2=lag2)
    print(name, [round(r['output_gap'],7) for r in rows[:8]])
print("Teaching periods and constructed shocks; not an estimated business-cycle chronology.")
