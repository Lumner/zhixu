"""Run stage-4 models and entrypoints in isolated copies; standard library only."""
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

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1]
COURSE = SOURCE.parent
EXAMPLES = SOURCE / "示例代码" / "stage4"
sys.path.insert(0, str(EXAMPLES))
from micro import consumer_choice, consumer_grid, linear_choice, utility
from micro import forward_difference, slutsky_decomposition, insurance_summary
from micro import two_period_choice, production_rows, costs, competitive_firm, cost_minimization
from micro import labor_choice, labor_market

RUNS = []


class ConsumerChecks(unittest.TestCase):
    def test_known_choice_and_utility(self):
        row = consumer_choice()
        self.assertEqual((row["x"], row["y"], row["spending"]), (10, 20, 120))
        self.assertAlmostEqual(row["utility"], math.sqrt(200))

    def test_budget_residuals_and_first_order_condition(self):
        for m, px, py in [(120,6,3), (150,6,3), (80,5,2), (100,3,7)]:
            with self.subTest(m=m, px=px, py=py):
                row = consumer_choice(m, px, py)
                self.assertAlmostEqual(px*row["x"]+py*row["y"], m)
                self.assertAlmostEqual(row["y"]/row["x"], px/py)
                for factor in [.25,.5,1.5,1.75]:
                    x=row["x"]*factor
                    y=(m-px*x)/py
                    self.assertLessEqual(utility(x,y), row["utility"]+1e-10)

    def test_nominal_rescaling_invariant(self):
        initial = consumer_choice(120,6,3)
        scaled = consumer_choice(360,18,9)
        self.assertEqual((initial["x"],initial["y"]), (scaled["x"],scaled["y"]))

    def test_zero_income(self):
        self.assertEqual(consumer_choice(0)["utility"],0)
        self.assertEqual(consumer_grid(0)["points"],1)

    def test_grid_approximation(self):
        exact=consumer_choice(150)
        coarse=consumer_grid(150,step=1)
        fine=consumer_grid(150,step=.1)
        self.assertLess(coarse["utility"], exact["utility"])
        self.assertAlmostEqual(fine["x"],12.5)
        self.assertAlmostEqual(fine["utility"],exact["utility"])

    def test_grid_endpoint_is_available(self):
        row=consumer_grid(income=3,px=2,py=1,step=1)
        self.assertEqual(row["points"],3)  # x=0,1,1.5.
        self.assertLessEqual(row["spending"],3+1e-12)

    def test_linear_corner_and_tie(self):
        self.assertEqual((linear_choice()["x"],linear_choice()["y"]),(0,60))
        tied=linear_choice(py=3)
        self.assertTrue(tied["multiple_optima"])
        self.assertEqual((tied["x"],tied["y"]),(20,0))

    def test_finite_difference_known_values(self):
        for h in [1,.1,.01,.001]:
            self.assertAlmostEqual(forward_difference(lambda x:x*x,3,h),6+h)

    def test_invalid_consumer_and_difference_inputs(self):
        for kwargs in [{"income":-1},{"px":0},{"py":-1},{"income":math.nan},{"income":True},{"px":math.inf}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                consumer_choice(**kwargs)
        for step in [0,-1,1e-10]:
            with self.assertRaises(ValueError):
                consumer_grid(step=step)
        with self.assertRaises(ValueError):
            forward_difference(lambda x:x*x,3,0)
        with self.assertRaises(ValueError):
            utility(-1,2)

    def test_slutsky_known_answers(self):
        row=slutsky_decomposition()
        self.assertEqual(row["compensated_income"],90)
        self.assertEqual((row["compensated"]["x"],row["compensated"]["y"]),(15,15))
        self.assertEqual((row["substitution_x"],row["income_x"],row["total_x"]),(5,5,10))
        self.assertGreater(row["compensated"]["utility"],row["initial"]["utility"])

    def test_slutsky_price_rise_and_no_change(self):
        row=slutsky_decomposition(new_px=12)
        self.assertEqual((row["substitution_x"],row["income_x"],row["total_x"]),(-2.5,-2.5,-5))
        same=slutsky_decomposition(new_px=6)
        self.assertEqual((same["substitution_x"],same["income_x"],same["total_x"]),(0,0,0))

    def test_slutsky_affordability_and_add_up(self):
        for m, old, new, py in [(120,6,3,3),(150,6,9,3),(180,6,12,3),(70,4,2,1)]:
            row=slutsky_decomposition(m,old,new,py)
            self.assertAlmostEqual(new*row["initial"]["x"]+py*row["initial"]["y"],row["compensated_income"])
            for good in ["x","y"]:
                self.assertAlmostEqual(row["substitution_"+good]+row["income_"+good],row["total_"+good])


class RiskAndTimeChecks(unittest.TestCase):
    def test_default_risk_known_answers(self):
        row=insurance_summary()
        self.assertEqual(row["expected_wealth"],91)
        self.assertAlmostEqual(row["certainty_equivalent"],89.44271909999159)
        self.assertAlmostEqual(row["max_full_insurance_premium"],10.557280900008408)
        self.assertTrue(row["insurance_weakly_preferred"])

    def test_half_probability_independent_geometric_mean(self):
        row=insurance_summary(probability=.5,premium=20)
        self.assertAlmostEqual(row["certainty_equivalent"],math.sqrt(64*100))
        self.assertAlmostEqual(row["risk_premium"],2)
        self.assertTrue(row["insurance_weakly_preferred"])

    def test_expensive_insurance_and_jensen(self):
        row=insurance_summary(premium=12)
        self.assertFalse(row["insurance_weakly_preferred"])
        self.assertLess(row["expected_log_utility"],math.log(row["expected_wealth"]))
        self.assertAlmostEqual(row["max_full_insurance_premium"],row["expected_loss"]+row["risk_premium"])

    def test_deterministic_risk_boundaries(self):
        for p in [0,1]:
            row=insurance_summary(probability=p,premium=p*36)
            self.assertAlmostEqual(row["certainty_equivalent"],100-p*36)
            self.assertAlmostEqual(row["risk_premium"],0)
            self.assertTrue(row["insurance_weakly_preferred"])

    def test_risk_rejects_invalid_states(self):
        for kwargs in [{"wealth":0},{"loss":100},{"probability":1.1},{"probability":-.1},{"premium":100},{"premium":-1},{"wealth":math.nan}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                insurance_summary(**kwargs)

    def test_two_period_borrowing_and_budget(self):
        row=two_period_choice()
        self.assertAlmostEqual(row["c0"],100)
        self.assertAlmostEqual(row["c1"],110)
        self.assertAlmostEqual(row["saving"],-20)
        self.assertAlmostEqual(row["c1"],132+1.1*row["saving"])
        self.assertAlmostEqual(row["c0"]+row["c1"]/1.1,200)

    def test_two_period_equal_present_value(self):
        for y0,y1,saving in [(100,110,0),(60,154,-40)]:
            row=two_period_choice(y0,y1)
            self.assertAlmostEqual(row["c0"],100)
            self.assertAlmostEqual(row["c1"],110)
            self.assertAlmostEqual(row["saving"],saving)

    def test_two_period_beta_and_negative_rate_domain(self):
        for rate,beta in [(0,.8),(.1,1.2),(-.2,1)]:
            row=two_period_choice(80,132,rate,beta)
            self.assertAlmostEqual(row["c0"]+row["c1"]/(1+rate),80+132/(1+rate))
            self.assertAlmostEqual(1/row["c0"],beta*(1+rate)/row["c1"])

    def test_two_period_invalid_inputs(self):
        for kwargs in [{"rate":-1},{"beta":0},{"y0":-1},{"y0":0,"y1":0},{"y1":math.inf}]:
            with self.assertRaises(ValueError):
                two_period_choice(**kwargs)


class ProducerChecks(unittest.TestCase):
    def test_production_known_values(self):
        rows=production_rows()
        self.assertIsNone(rows[0]["average_product"])
        self.assertEqual([row["marginal_product"] for row in rows[1:]],[12,16,14,10,8,6,4,2])
        self.assertEqual(rows[6]["average_product"],11)

    def test_production_can_show_negative_marginal(self):
        row=production_rows([0,12,10])[-1]
        self.assertEqual(row["marginal_product"],-2)
        self.assertEqual(row["average_product"],5)

    def test_invalid_production(self):
        for outputs in [[],[0],[1,2],[0,-1],[0,math.nan]]:
            with self.assertRaises(ValueError):
                production_rows(outputs)

    def test_cost_zero_and_known_table(self):
        self.assertIsNone(costs(0)["average_total_cost"])
        row=costs(10)
        self.assertEqual((row["total_cost"],row["average_total_cost"],row["marginal_cost"]),(240,24,24))
        self.assertEqual(costs(10)["total_cost"]-costs(9)["total_cost"],23)

    def test_average_total_cost_minimum(self):
        for fixed in [100,144]:
            q=math.sqrt(fixed)
            best=costs(q,fixed)["average_total_cost"]
            self.assertAlmostEqual(best,costs(q,fixed)["marginal_cost"])
            self.assertGreater(costs(q*.8,fixed)["average_total_cost"],best)
            self.assertGreater(costs(q*1.2,fixed)["average_total_cost"],best)

    def test_long_run_cost_minimum_known_answer(self):
        row=cost_minimization()
        self.assertEqual((row["labor"],row["capital"],row["cost"]),(12,3,72))
        self.assertAlmostEqual(2*math.sqrt(row["labor"]*row["capital"]),12)
        self.assertAlmostEqual(row["marginal_rate_of_technical_substitution"],3/12)
        self.assertLess(row["cost"],3*4+12*9)

    def test_long_run_cost_residuals_scaling_and_invalid_inputs(self):
        for output,wage,rental in [(20,3,12),(12,3,3),(5,4,9)]:
            row=cost_minimization(output,wage,rental)
            self.assertAlmostEqual(2*math.sqrt(row["labor"]*row["capital"]),output)
            self.assertAlmostEqual(row["cost"],output*math.sqrt(wage*rental))
            self.assertAlmostEqual(row["capital"]/row["labor"],wage/rental)
        self.assertIsNone(cost_minimization(0)["average_cost"])
        with self.assertRaises(ValueError):
            cost_minimization(wage=0)

    def test_firm_known_price_scenarios(self):
        for p,q,profit in [(30,13,69),(24,10,0),(20,8,-36),(16,6,-64),(4,0,-100),(3,0,-100)]:
            row=competitive_firm(p)
            self.assertEqual((row["quantity"],row["profit"]),(q,profit))
            self.assertGreaterEqual(row["profit"],row["shutdown_profit"])

    def test_firm_maximum_against_neighbor_outputs(self):
        for p in [3,4,12,20,30]:
            row=competitive_firm(p)
            for q in [0,max(0,row["quantity"]-.1),row["quantity"]+.1,20]:
                alternative=p*q-(100+4*q+q*q)
                self.assertLessEqual(alternative,row["profit"]+1e-10)

    def test_fixed_cost_changes_profit_not_short_run_output(self):
        row=competitive_firm(20,fixed=144)
        self.assertEqual((row["quantity"],row["profit"],row["shutdown_profit"]),(8,-80,-144))
        self.assertEqual(row["break_even_price"],28)
        self.assertTrue(row["long_run_exit_signal_at_unchanged_prices"])

    def test_producer_invalid_inputs(self):
        for kwargs in [{"quantity":-1},{"quantity":1,"quadratic":0},{"quantity":1,"fixed":-1}]:
            with self.assertRaises(ValueError):
                costs(**kwargs)
        with self.assertRaises(ValueError):
            competitive_firm(-1)

    def test_labor_known_answers(self):
        row=labor_choice()
        self.assertEqual((row["labor"],row["output"],row["marginal_revenue_product"],row["surplus_before_other_costs"]),(6,84,16,72))
        alternate=labor_choice(price=3,wage=18)
        self.assertEqual((alternate["labor"],alternate["output"],alternate["surplus_before_other_costs"]),(7,91,147))

    def test_labor_boundaries_and_no_revenue(self):
        for kwargs in [{"wage":40},{"wage":50},{"price":0},{"price":0,"wage":0}]:
            row=labor_choice(**kwargs)
            self.assertEqual(row["labor"],0)
        self.assertEqual(labor_choice(wage=0)["labor"],10)

    def test_labor_optimality_against_neighbors(self):
        for wage in [0,16,20,40,50]:
            row=labor_choice(wage=wage)
            for labor in [0,2,6,10]:
                alternative=2*(20*labor-labor*labor)-wage*labor
                self.assertLessEqual(alternative,row["surplus_before_other_costs"]+1e-10)

    def test_market_labor_equilibrium(self):
        self.assertEqual(labor_market(),{"wage":20,"labor":60})
        self.assertEqual(labor_market(demand_intercept=120),{"wage":25,"labor":70})
        with self.assertRaises(ValueError):
            labor_market(supply_intercept=200)
        with self.assertRaises(ValueError):
            labor_choice(wage=-1)


class DeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage4-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve():
            raise RuntimeError("Temporary path outside course")
        cls.copy=cls.root/"stage4"
        shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","output",".venv"))

    @classmethod
    def tearDownClass(cls):
        if cls.root.parent!=COURSE.resolve():
            raise RuntimeError("Unsafe temporary cleanup")
        cls.temp.cleanup()

    def run_program(self,name,args=(),valid=True):
        env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1","PYTHONIOENCODING":"utf-8"}
        result=subprocess.run([sys.executable,str(self.copy/name),*args],cwd=self.root,env=env,capture_output=True,text=True,encoding="utf-8",timeout=15)
        RUNS.append({"program":name,"args":list(args),"exitCode":result.returncode,"stdout":result.stdout,"stderr":result.stderr})
        if valid:
            self.assertEqual(result.returncode,0,result.stderr)
        else:
            self.assertEqual(result.returncode,2,result.stderr)
        return result

    def test_eight_chapter_entrypoints(self):
        known={"consumer_budget.py":"Grid best: x=10.00, y=20.00", "marginal_derivative.py":"forward difference=6.001000",
               "consumer_effects.py":"Compensated income: 90.00", "risk_time.py":"certainty_equivalent: 89.442719",
               "production_table.py":"Separate scale example: 12.00 -> 24.00", "cost_table.py":"ATC=24.000",
               "competition.py":"P=20 q=8.00 profit=-36.00 operate=True", "labor.py":"w=16 L=6.00 Q=84.00"}
        for file,expected in known.items():
            with self.subTest(file=file):
                self.assertIn(expected,self.run_program(file).stdout)

    def test_integrated_default_report(self):
        row=json.loads(self.run_program("micro_lab.py").stdout)
        self.assertEqual(row["version"],"0.2a")
        self.assertEqual(row["competitive_firm"]["profit"],69)
        self.assertEqual(row["price_effects"]["total_x"],10)

    def test_integrated_changed_parameters(self):
        row=json.loads(self.run_program("micro_lab.py",["--income","180","--new-px","12","--price","20","--wage","20"]).stdout)
        self.assertEqual(row["consumer"]["x"],15)
        self.assertEqual(row["price_effects"]["substitution_x"],-3.75)
        self.assertEqual(row["competitive_firm"]["profit"],-36)
        self.assertEqual(row["labor_demand"]["labor"],5)

    def test_cli_invalid_inputs_and_help(self):
        for args in [["--income","-1"],["--income","nan"],["--new-px","0"],["--price","-1"],["--wage","inf"],["--wage","oops"]]:
            with self.subTest(args=args):
                self.assertIn("error:",self.run_program("micro_lab.py",args,valid=False).stderr)
        self.assertIn("--income",self.run_program("micro_lab.py",["--help"]).stdout)

    def test_prior_chapters_and_examples_unchanged(self):
        baseline=json.loads((COURSE/"maintenance"/"stage1-3-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),30)
        for relative,expected in baseline.items():
            with self.subTest(file=relative):
                self.assertEqual(hashlib.sha256((COURSE/relative).read_bytes()).hexdigest(),expected)


if __name__=="__main__":
    stream=io.StringIO()
    suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
    files=sorted(EXAMPLES.glob("*.py"))
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":4,"chapters":[19,26],
            "python":sys.version,"platform":platform.platform(),"testsRun":result.testsRun,
            "failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),
            "subprocessRuns":len(RUNS),"preservedPriorFiles":30,"testLog":stream.getvalue(),"runs":RUNS,
            "sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in files},
            "notValidated":["fresh Python installation","all platforms/versions","borrowing constraints","general-equilibrium economy","market structures 27-32","macroeconomic models","browser UI","full-site build"]}
    Path(__file__).with_name("stage4-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful():
        print(stream.getvalue())
        raise SystemExit(1)
