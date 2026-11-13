"""Known answers, economic domains, independent ledgers and clean CLI execution."""
from pathlib import Path
import hashlib
import io
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode=True
SOURCE=Path(__file__).resolve().parents[1]
COURSE=SOURCE.parent
EXAMPLES=SOURCE/"示例代码/stage8"
sys.path.insert(0,str(EXAMPLES))
from policy_models import ad_at_price,ad_as,long_run_price,phillips,inflation_path,disinflation_unemployment
from policy_models import propagation_path,fiscal_budget,rule_equilibrium,nominal_growth,debt_step,debt_path
RUNS=[]

class DemandSupplyChecks(unittest.TestCase):
    def test_ad_base_and_three_residuals(self):
        r=ad_as()
        self.assertAlmostEqual(r["output"],700);self.assertAlmostEqual(r["price"],1)
        self.assertAlmostEqual(r["interest"],.04)
        for key in ["goods_residual","money_residual","supply_residual"]: self.assertAlmostEqual(r[key],0)

    def test_demand_shock_independent_quadratic(self):
        r=ad_as(a=340)
        p=(340+math.sqrt(283600))/840
        self.assertAlmostEqual(r["price"],p);self.assertAlmostEqual(r["output"],700*p)
        self.assertLess(r["output"],(340+100)/.6)

    def test_supply_cost_and_flat_supply(self):
        r=ad_as(cost=.1)
        self.assertLess(r["output"],700);self.assertGreater(r["price"],1)
        self.assertAlmostEqual(r["price"],r["output"]/700+.1)
        flat=ad_as(a=340,supply_slope=0)
        self.assertAlmostEqual(flat["price"],1);self.assertAlmostEqual(flat["output"],2200/3)

    def test_long_run_candidate_requires_changed_expectations(self):
        r=long_run_price(a=340)
        self.assertAlmostEqual(r["price"],1.25);self.assertAlmostEqual(r["output"],700)
        adjusted=ad_as(a=340,expected_price=1.25)
        self.assertAlmostEqual(adjusted["output"],700)
        self.assertNotAlmostEqual(1.25,1+(700-700)/700)

    def test_long_run_money_scaling_and_no_positive_price(self):
        r=long_run_price(money=500)
        self.assertAlmostEqual(r["price"],1.25);self.assertAlmostEqual(r["interest"],.04)
        with self.assertRaises(ValueError): long_run_price(a=420)

    def test_ad_inherited_domains_and_bad_inputs(self):
        self.assertAlmostEqual(ad_at_price(2.5)["private_investment"],0)
        for kwargs in [{"price":0},{"price":.1},{"price":20},{"money":0},{"a":math.nan},{"price":True}]:
            with self.assertRaises(ValueError): ad_at_price(**kwargs)
        for kwargs in [{"potential":0},{"expected_price":0},{"supply_slope":-1},{"cost":math.inf}]:
            with self.assertRaises(ValueError): ad_as(**kwargs)


class ExpectationsCycleChecks(unittest.TestCase):
    def test_phillips_known_points_and_supply_shock(self):
        self.assertAlmostEqual(phillips()["inflation"],.025)
        self.assertAlmostEqual(phillips(.07,expected=.03)["inflation"],.02)
        self.assertAlmostEqual(phillips(.05,shock=.01)["inflation"],.03)

    def test_adaptive_and_fixed_paths(self):
        adaptive=inflation_path();fixed=inflation_path(weight=0)
        for r,value in zip(adaptive,[.025,.03,.035,.04]): self.assertAlmostEqual(r["inflation"],value)
        for r in fixed: self.assertAlmostEqual(r["inflation"],.025)
        self.assertAlmostEqual(adaptive[1]["expected_inflation"],adaptive[0]["inflation"])

    def test_partial_expectations_and_nonmutation(self):
        unemployment=[.05,.05];shocks=[.02,0]
        rows=inflation_path(unemployment,weight=.5,shocks=shocks)
        self.assertAlmostEqual(rows[0]["inflation"],.04)
        self.assertAlmostEqual(rows[1]["expected_inflation"],.03)
        self.assertEqual(unemployment,[.05,.05]);self.assertEqual(shocks,[.02,0])

    def test_disinflation_candidate_and_impossible_unemployment(self):
        self.assertAlmostEqual(disinflation_unemployment()["unemployment"],.09)
        self.assertAlmostEqual(disinflation_unemployment(expected=.03)["unemployment"],.07)
        with self.assertRaises(ValueError): disinflation_unemployment(target=.5)

    def test_bad_inflation_paths_and_rates(self):
        for kwargs in [{"unemployment":[]},{"unemployment":[.04,.04],"shocks":[0]},{"weight":1.1},{"expected":-1},{"alpha":0},{"unemployment":[1.1]},{"shocks":[0,0,0,math.nan]}]:
            with self.assertRaises(ValueError): inflation_path(**kwargs)

    def test_first_order_persistence_and_output(self):
        rows=propagation_path()
        for n,r in enumerate(rows): self.assertAlmostEqual(r["output_gap"],-.02*.6**n)
        self.assertAlmostEqual(rows[0]["output"],686)
        self.assertAlmostEqual(rows[1]["output"],691.6)
        slower=propagation_path(rho=.9)
        self.assertGreater(abs(slower[-1]["output_gap"]),abs(rows[-1]["output_gap"]))

    def test_second_order_history_and_overshoot(self):
        rows=propagation_path(rho=1.2,lag2=-.5)
        for r,value in zip(rows,[-.02,-.024,-.0188,-.01056,-.003272,.0013536]): self.assertAlmostEqual(r["output_gap"],value)
        self.assertGreater(rows[5]["output_gap"],0)

    def test_cycle_stability_and_output_domains(self):
        for kwargs in [{"rho":1},{"rho":0,"lag2":-1},{"rho":2,"lag2":0},{"initial":-1},{"shocks":[-2]},{"potential":0},{"shocks":[]}]:
            with self.assertRaises(ValueError): propagation_path(**kwargs)


class BudgetAndRuleChecks(unittest.TestCase):
    def test_both_nominal_budgets(self):
        for y,tax,tr,pb,overall,disposable in [(700,215,20,25,-3,505),(630,197.5,34,-6.5,-34.5,466.5)]:
            r=fiscal_budget(output=y)
            for key,value in [("gross_taxes",tax),("transfers",tr),("primary_balance",pb),("overall_balance",overall),("private_disposable_income",disposable)]: self.assertAlmostEqual(r[key],value)
            self.assertAlmostEqual(r["primary_balance"],r["government_gross_saving"]-20)
            self.assertAlmostEqual(r["new_borrowing_no_other_adjustment"],-overall)

    def test_automatic_income_cushion_and_exogenous_output(self):
        auto=fiscal_budget(output=630)
        fixed=fiscal_budget(output=630,tax0=215,tax_rate=0,cyclical_transfer=0)
        self.assertAlmostEqual(auto["private_disposable_income"]-fixed["private_disposable_income"],31.5)
        discretionary=fiscal_budget(output=630,government_consumption=170)
        self.assertAlmostEqual(discretionary["primary_balance"],-26.5)
        self.assertEqual(discretionary["output"],630)

    def test_fiscal_exercise_and_boom_transfer_floor(self):
        r=fiscal_budget(output=660)
        self.assertAlmostEqual(r["primary_balance"],7);self.assertAlmostEqual(r["overall_balance"],-21)
        self.assertEqual(fiscal_budget(output=800)["transfers"],20)
        for kwargs in [{"tax_rate":1.1},{"public_investment":-1},{"debt_previous":math.inf}]:
            with self.assertRaises(ValueError): fiscal_budget(**kwargs)

    def test_rule_base_and_all_three_residuals(self):
        r=rule_equilibrium()
        self.assertAlmostEqual(r["output_gap"],0);self.assertAlmostEqual(r["inflation"],.02);self.assertAlmostEqual(r["interest"],.04)
        for key in ["demand_residual","phillips_residual","rule_residual"]: self.assertAlmostEqual(r[key],0)

    def test_demand_supply_policy_shocks_independent_answers(self):
        for kwargs,gap,inflation,interest in [({"demand":.02},2/225,11/450,23/450),({"shock":.01},-1/150,2/75,7/150),({"policy_shock":.01},-1/225,4/225,2/45)]:
            r=rule_equilibrium(**kwargs)
            self.assertAlmostEqual(r["output_gap"],gap);self.assertAlmostEqual(r["inflation"],inflation);self.assertAlmostEqual(r["interest"],interest)
            for key in ["demand_residual","phillips_residual","rule_residual"]: self.assertAlmostEqual(r[key],0)

    def test_rule_floor_recomputed_and_shadow_checked(self):
        r=rule_equilibrium(demand=-.1)
        self.assertEqual(r["regime"],"floor");self.assertEqual(r["interest"],0)
        self.assertAlmostEqual(r["output_gap"],-.06);self.assertAlmostEqual(r["inflation"],-.01);self.assertAlmostEqual(r["shadow_rule_rate"],-.035)
        self.assertAlmostEqual(r["demand_residual"],0);self.assertAlmostEqual(r["rule_residual"],0)

    def test_rule_boundary_continuity_positive_floor_and_linear_rate(self):
        boundary=rule_equilibrium(demand=-.072)
        lower=rule_equilibrium(demand=-.0720001)
        self.assertAlmostEqual(boundary["interest"],0);self.assertLess(abs(lower["output_gap"]-boundary["output_gap"]),1e-6)
        high=rule_equilibrium(floor=.05)
        self.assertEqual(high["regime"],"floor");self.assertAlmostEqual(high["output_gap"],-.01)
        self.assertNotAlmostEqual(.04-.02,(1.04/1.02)-1)

    def test_rule_domains(self):
        for kwargs in [{"sigma":0},{"kappa":0},{"phi_pi":-1},{"floor":-1},{"expected":-1},{"demand":math.nan},{"demand":-5}]:
            with self.assertRaises(ValueError): rule_equilibrium(**kwargs)


class DebtChecks(unittest.TestCase):
    def test_one_year_nominal_amounts_and_ratio(self):
        r=debt_path(years=1)[1]
        self.assertAlmostEqual(r["gdp"],728);self.assertAlmostEqual(r["primary_amount"],7.28);self.assertAlmostEqual(r["debt"],580.72)
        self.assertAlmostEqual(r["debt_ratio"],580.72/728)
        self.assertLess(r["debt_ratio"],.8);self.assertGreater(r["debt"],560)

    def test_debt_contribution_sum_and_stabilizing_balance(self):
        r=debt_step(stock_flow=.01)
        self.assertAlmostEqual(r["ratio_change"],r["interest_growth_contribution"]+r["primary_contribution"]+r["stock_flow_contribution"])
        stable=debt_step(primary_surplus=r["stabilizing_primary_surplus"],stock_flow=.01)
        self.assertAlmostEqual(stable["debt_ratio"],.8)

    def test_stress_equal_rates_and_exercise(self):
        self.assertAlmostEqual(debt_step(interest=.08,growth=.01,primary_surplus=-.02)["debt_ratio"],.8*108/101+.02)
        self.assertEqual(debt_step(interest=.03,growth=.03,primary_surplus=0)["debt_ratio"],.8)
        r=debt_path(years=1,initial=.6,initial_gdp=500,interest=.04,growth=.05,primary_surplus=.02)[1]
        self.assertAlmostEqual(r["debt"],301.5);self.assertAlmostEqual(r["debt_ratio"],301.5/525)

    def test_current_gdp_flow_denominator(self):
        r=debt_path(years=1)[1]
        wrong=(560*1.05-.01*700)/728
        self.assertNotAlmostEqual(r["debt_ratio"],wrong)
        self.assertAlmostEqual(r["primary_amount"],.01*r["gdp"])

    def test_multiyear_amount_ratio_residuals_and_stock_flow(self):
        rows=debt_path(years=10,stock_flow=.005)
        for old,new in zip(rows,rows[1:]):
            self.assertAlmostEqual(new["debt"],1.05*old["debt"]-.01*new["gdp"]+.005*new["gdp"])
            self.assertAlmostEqual(new["nominal_budget_residual"],0)
        self.assertEqual(rows[0]["year"],0);self.assertNotIn("primary_amount",rows[0])

    def test_exact_nominal_growth_and_invalid_gross_debt(self):
        self.assertAlmostEqual(nominal_growth(),.0404)
        for kwargs in [{"growth":-1},{"interest":-1},{"previous":-1},{"primary_surplus":2},{"stock_flow":math.nan}]:
            with self.assertRaises(ValueError): debt_step(**kwargs)
        for kwargs in [{"years":0},{"years":101},{"years":True},{"initial_gdp":0}]:
            with self.assertRaises(ValueError): debt_path(**kwargs)


class DeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage8-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve(): raise RuntimeError("Unsafe temporary directory")
        cls.copy=cls.root/"stage8";shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","my-results"))

    @classmethod
    def tearDownClass(cls):
        if cls.root.parent!=COURSE.resolve(): raise RuntimeError("Unsafe cleanup path")
        cls.temp.cleanup()

    def run_program(self,name,args=(),valid=True):
        env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1","PYTHONIOENCODING":"utf-8"}
        r=subprocess.run([sys.executable,str(self.copy/name),*args],cwd=self.root,env=env,capture_output=True,text=True,encoding="utf-8",timeout=15)
        RUNS.append({"program":name,"args":list(args),"exitCode":r.returncode,"stdout":r.stdout,"stderr":r.stderr})
        self.assertEqual(r.returncode,0 if valid else 2,r.stderr)
        return r

    def test_six_complete_entrypoints_cross_directory(self):
        expected={"ad_as.py":"Y=727.117565, P=1.038739","expectations.py":"u=9.000%", "cycles.py":"damped oscillation", "fiscal.py":"primary=-6.50, overall=-34.50", "monetary_rule.py":"gap=-6.000000%", "debt.py":"ratio=79.769231%"}
        for name,value in expected.items(): self.assertIn(value,self.run_program(name).stdout)

    def test_integrated_default_identity_and_units(self):
        r=json.loads(self.run_program("policy_lab.py").stdout)
        self.assertEqual((r["version"],r["origin"]),("0.4","synthetic_teaching_parameters"))
        self.assertAlmostEqual(r["ad_as"]["output"],700)
        self.assertEqual(len(r["debt"]),11)
        self.assertAlmostEqual(r["budget_slump"]["primary_balance"],-6.5)

    def test_independent_cli_parameter_ownership(self):
        r=json.loads(self.run_program("policy_lab.py",["--ad-shift","20","--demand-gap",".02","--years","5"]).stdout)
        self.assertAlmostEqual(r["ad_as"]["price"],(340+math.sqrt(283600))/840)
        self.assertAlmostEqual(r["interest_rule"]["output_gap"],2/225)
        self.assertAlmostEqual(r["budget_normal"]["primary_balance"],25)
        self.assertAlmostEqual(r["debt"][1]["debt"],580.72)

    def test_cli_stress_and_rule_floor(self):
        r=json.loads(self.run_program("policy_lab.py",["--interest",".08","--nominal-growth",".01","--primary-surplus","-.02","--years","2"]).stdout)
        self.assertAlmostEqual(r["debt"][1]["debt_ratio"],.8*108/101+.02)
        self.assertAlmostEqual(r["interest_rule"]["interest"],.04)
        r=json.loads(self.run_program("policy_lab.py",["--demand-gap","-.1"]).stdout)
        self.assertEqual(r["interest_rule"]["regime"],"floor")

    def test_cli_bad_inputs_and_help(self):
        for args in [["--ad-shift","nan"],["--cost-shock","inf"],["--nominal-growth","-1"],["--interest","-1"],["--primary-surplus","2"],["--years","0"],["--years","2.5"],["--years","101"]]:
            self.assertIn("error:",self.run_program("policy_lab.py",args,valid=False).stderr)
        self.assertIn("--nominal-growth",self.run_program("policy_lab.py",["--help"]).stdout)

    def test_prior_sources_unchanged(self):
        baseline=json.loads((COURSE/"maintenance/stages1-7-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),99)
        for name,expected in baseline.items(): self.assertEqual(hashlib.sha256((COURSE/name).read_bytes()).hexdigest(),expected,name)


if __name__=="__main__":
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":8,"chapters":[45,50],"python":sys.version,"platform":platform.platform(),
            "testsRun":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),"subprocessRuns":len(RUNS),"preservedPriorFiles":99,
            "testLog":stream.getvalue(),"runs":RUNS,"sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(EXAMPLES.glob("*.py"))},
            "notValidated":["fresh installation","all OS/Python versions","estimated potential/natural rates","real policy causality","full joint macro model","bank-credit transmission","official fiscal/debt definitions by country","real forecasting","chapters 51-60","site build","browser UI"]}
    Path(__file__).with_name("stage8-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful(): print(stream.getvalue());raise SystemExit(1)
