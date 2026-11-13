"""Stage 5 numerical, behavioral and clean-entrypoint checks; standard library."""
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
EXAMPLES=SOURCE/"示例代码"/"stage5"
sys.path.insert(0,str(EXAMPLES))
from models import monopoly,segmented_monopoly,pure_nash,cournot
from models import exchange_equilibrium,exchange_grid,pareto_improves
from models import externality,abatement,public_good,commons,lemons,hidden_action,signaling_incentives

RUNS=[]


class MarketPowerChecks(unittest.TestCase):
    def test_monopoly_known_answers(self):
        row=monopoly()
        self.assertEqual((row["quantity"],row["price"],row["profit"]),(48,36,1152))
        self.assertEqual((row["consumer_surplus"],row["total_surplus_gross"],row["deadweight_loss"]),(576,1728,576))
        self.assertEqual(row["competitive_quantity"],96)

    def test_monopoly_first_order_and_neighbor_profits(self):
        for a,b,c in [(60,.5,12),(50,1,10),(100,2,20)]:
            row=monopoly(a,b,c)
            self.assertAlmostEqual(a-2*b*row["quantity"],c)
            for q in [0,row["quantity"]*.8,row["quantity"]*1.2]:
                self.assertLessEqual((a-b*q-c)*q,row["profit"]+1e-10)

    def test_fixed_cost_and_first_degree(self):
        row=monopoly(fixed=100)
        self.assertEqual((row["quantity"],row["profit"]),(48,1052))
        self.assertEqual(row["first_degree_producer_surplus"],2304)
        self.assertEqual(row["total_surplus_net_fixed"],1628)

    def test_no_trade_monopoly(self):
        row=monopoly(mc=70)
        self.assertEqual(row["quantity"],0)
        self.assertIsNone(row["price"])
        self.assertEqual(row["deadweight_loss"],0)

    def test_segmented_known_example(self):
        row=segmented_monopoly()
        self.assertEqual([r["price"] for r in row["groups"]],[40,30])
        self.assertEqual((row["quantity"],row["profit"],row["consumer_surplus"]),(30,500,250))
        uniform_profit=(35-20)*((60-35)+(40-35))
        uniform_cs=((60-35)**2+(40-35)**2)/2
        self.assertEqual((uniform_profit,uniform_cs),(450,325))
        self.assertLess(row["profit"]+row["consumer_surplus"],uniform_profit+uniform_cs)

    def test_invalid_market_parameters(self):
        for kwargs in [{"b":0},{"a":math.nan},{"mc":-1},{"fixed":math.inf},{"a":True}]:
            with self.assertRaises(ValueError):
                monopoly(**kwargs)
        with self.assertRaises(ValueError):
            segmented_monopoly((60,),())

    def test_cournot_known_answers(self):
        row=cournot()
        self.assertEqual((row["quantity_each"],row["quantity"],row["price"],row["profit_each"]),(32,64,28,512))
        self.assertEqual(cournot(1)["quantity"],48)
        self.assertEqual(cournot(3)["quantity"],72)

    def test_cournot_unilateral_deviations(self):
        for firms in [1,2,3,5]:
            row=cournot(firms)
            others=row["quantity"]-row["quantity_each"]
            for own in [0,row["quantity_each"]*.8,row["quantity_each"]*1.2]:
                profit=(60-.5*(own+others)-12)*own
                self.assertLessEqual(profit,row["profit_each"]+1e-10)

    def test_cournot_more_firms_and_invalid_counts(self):
        self.assertLess(cournot(5)["price"],cournot(2)["price"])
        self.assertEqual(cournot(mc=70)["quantity"],0)
        for n in [0,-1,2.5,True]:
            with self.assertRaises(ValueError):
                cournot(n)

    def test_prisoners_dilemma(self):
        self.assertEqual(pure_nash(),[{"a":"low","b":"low","payoffs":[4,4]}])

    def test_multiple_and_tied_equilibria(self):
        coordination=(((3,3),(0,0)),((0,0),(2,2)))
        self.assertEqual(len(pure_nash(coordination)),2)
        tied=(((1,1),(1,1)),((1,1),(1,1)))
        self.assertEqual(len(pure_nash(tied)),4)

    def test_no_pure_equilibrium_and_bad_matrix(self):
        pennies=(((1,-1),(-1,1)),((-1,1),(1,-1)))
        self.assertEqual(pure_nash(pennies),[])
        with self.assertRaises(ValueError):
            pure_nash((((1,1),),))
        with self.assertRaises(ValueError):
            pure_nash(actions_a=("same","same"))


class ExchangeChecks(unittest.TestCase):
    def test_exchange_known_allocation(self):
        row=exchange_equilibrium()
        self.assertEqual((row["px"],row["py"]),(1,1))
        for name in ["a","b"]:
            self.assertEqual((row[name]["x"],row[name]["y"],row[name]["initial_utility"],row[name]["utility"]),(5,5,4,5))

    def test_feasibility_budget_and_mrs(self):
        for a,b in [((8,2),(2,8)),((9,9),(1,1)),((8,10),(2,10))]:
            row=exchange_equilibrium(a,b)
            self.assertAlmostEqual(row["a"]["x"]+row["b"]["x"],row["total_x"])
            self.assertAlmostEqual(row["a"]["y"]+row["b"]["y"],row["total_y"])
            for name in ["a","b"]:
                person=row[name]
                self.assertAlmostEqual(row["px"]*person["x"]+person["y"],person["wealth"])
                self.assertAlmostEqual(person["y"]/person["x"],row["px"])

    def test_efficiency_does_not_imply_equal_distribution(self):
        row=exchange_equilibrium((9,9),(1,1))
        self.assertEqual((row["a"]["utility"],row["b"]["utility"]),(9,1))
        self.assertFalse(pareto_improves((9,1),(4,4)))
        self.assertTrue(pareto_improves((6,4),(4,4)))

    def test_integer_frontier(self):
        grid=exchange_grid(4,4)
        self.assertEqual(grid["points"],25)
        expected=[(0,0),(1,1),(1,2),(2,1),(2,2),(2,3),(3,2),(3,3),(4,4)]
        self.assertEqual([(r["x_a"],r["y_a"]) for r in grid["frontier"]],expected)

    def test_grid_efficiency_differs_from_continuous_efficiency(self):
        grid=exchange_grid()
        self.assertEqual(len(grid["frontier"]),27)
        self.assertIn((1,2),[(r["x_a"],r["y_a"]) for r in grid["frontier"]])
        initial=(math.sqrt(1*2),math.sqrt(9*8))
        self.assertFalse(pareto_improves((1,9),initial))
        self.assertFalse(pareto_improves((2,8),initial))
        self.assertTrue(pareto_improves((1.5,8.5),initial))

    def test_invalid_exchange_and_pareto_comparisons(self):
        with self.assertRaises(ValueError):
            exchange_equilibrium((0,1),(0,2))
        with self.assertRaises(ValueError):
            exchange_equilibrium((-1,1),(2,2))
        with self.assertRaises(ValueError):
            exchange_grid(21,10)
        with self.assertRaises(ValueError):
            pareto_improves((1,2),(1,))


class PolicyChecks(unittest.TestCase):
    def test_externality_known_answers(self):
        row=externality()
        self.assertEqual((row["private_quantity"],row["efficient_quantity"],row["optimal_unit_tax"]),(64,48,12))
        self.assertEqual((row["welfare_private"],row["welfare_efficient"],row["deadweight_loss"]),(1024,1152,128))
        self.assertEqual((row["damage_private"],row["damage_efficient"],row["tax_revenue"]),(512,288,576))

    def test_externality_tax_wedge_and_marginal_conditions(self):
        for slope in [0,.1,.25,.5,1]:
            row=externality(damage_slope=slope)
            q=row["efficient_quantity"]
            self.assertAlmostEqual(60-.5*q,12+(.25+slope)*q)
            self.assertAlmostEqual(row["consumer_price_at_optimum"]-row["producer_price_at_optimum"],row["optimal_unit_tax"])
            self.assertGreaterEqual(row["welfare_efficient"]+1e-10,row["welfare_private"])

    def test_zero_damage_and_no_trade(self):
        row=externality(damage_slope=0)
        self.assertEqual((row["private_quantity"],row["efficient_quantity"],row["optimal_unit_tax"],row["deadweight_loss"]),(64,64,0,0))
        self.assertEqual(externality(c=70)["efficient_quantity"],0)
        with self.assertRaises(ValueError):
            externality(damage_slope=-1)

    def test_abatement_interior_and_equal_split_cost(self):
        row=abatement()
        self.assertEqual((row["a"],row["b"],row["cost"]),(9,3,108))
        self.assertEqual(row["marginal_cost_a"],row["marginal_cost_b"])
        self.assertLess(row["cost"],6*6+3*6*6)

    def test_abatement_capacity_boundary(self):
        row=abatement(18)
        self.assertEqual((row["a"],row["b"],row["cost"]),(10,8,292))
        self.assertFalse(row["interior"])
        self.assertNotEqual(row["marginal_cost_a"],row["marginal_cost_b"])

    def test_abatement_feasible_grid_cost_check(self):
        for required in [0,8,12,18,20]:
            row=abatement(required)
            self.assertAlmostEqual(row["a"]+row["b"],required)
            for index in range(101):
                qa=index/10
                qb=required-qa
                if 0<=qb<=10:
                    self.assertLessEqual(row["cost"],qa*qa+3*qb*qb+1e-10)
        with self.assertRaises(ValueError):
            abatement(21)

    def test_public_good_known_answers(self):
        row=public_good()
        self.assertAlmostEqual(row["efficient_quantity"],8)
        self.assertEqual(row["voluntary_quantity"],4)
        self.assertAlmostEqual(row["welfare_efficient"],64)
        self.assertEqual(row["welfare_voluntary"],48)
        self.assertAlmostEqual(sum(row["marginal_benefits_at_optimum"]),16)

    def test_public_good_kink_and_zero_boundaries(self):
        row=public_good((20,4),(1,1),6)
        self.assertAlmostEqual(row["efficient_quantity"],14)
        self.assertEqual(row["marginal_benefits_at_optimum"][1],0)
        self.assertAlmostEqual(row["welfare_efficient"],106)
        self.assertEqual(public_good(unit_cost=40)["efficient_quantity"],0)
        self.assertEqual(public_good((0,0))["efficient_quantity"],0)

    def test_public_good_invalid_inputs(self):
        for kwargs in [{"unit_cost":0},{"slopes":(1,0)},{"valuations":(-1,12)},{"valuations":(20,)}]:
            with self.assertRaises(ValueError):
                public_good(**kwargs)

    def test_commons_overuse_and_single_user(self):
        row=commons()
        self.assertAlmostEqual(row["noncooperative_total_effort"],16/3)
        self.assertEqual(row["efficient_total_effort"],4)
        self.assertAlmostEqual(row["welfare_noncooperative"],128/9)
        self.assertEqual(row["welfare_efficient"],16)
        self.assertEqual(commons(1)["noncooperative_total_effort"],4)
        with self.assertRaises(ValueError):
            commons(0)


class InformationChecks(unittest.TestCase):
    def test_lemons_known_selection(self):
        row=lemons()
        self.assertEqual([r["offered_price"] for r in row["trace"]],[150,100])
        self.assertEqual(row["active_types"],["low"])
        self.assertEqual((row["trade_share"],row["full_information_gains"],row["selection_gains"]),(.5,30,10))

    def test_pooling_and_no_trade(self):
        self.assertEqual(lemons(high_cost=140)["active_types"],["high","low"])
        self.assertEqual(lemons(high_share=.75)["price"],175)
        row=lemons(high_cost=250,low_cost=110)
        self.assertEqual(row["trade_share"],0)
        self.assertIsNone(row["price"])

    def test_invalid_lemons_domains(self):
        for kwargs in [{"high_share":0},{"high_share":1},{"high_value":50},{"high_cost":70},{"low_cost":math.nan}]:
            with self.assertRaises(ValueError):
                lemons(**kwargs)

    def test_hidden_action_known_choices(self):
        for coverage,chosen,social in [(0,True,14),(.5,True,14),(1,False,30)]:
            row=hidden_action(coverage)
            self.assertEqual(row["choose_effort"],chosen)
            self.assertAlmostEqual(row["social_cost"],social)
        self.assertAlmostEqual(hidden_action(1)["expected_claim"],30)

    def test_hidden_action_threshold_and_bad_inputs(self):
        self.assertTrue(hidden_action(.8)["choose_effort"])
        self.assertFalse(hidden_action(.8001)["choose_effort"])
        for kwargs in [{"coverage":1.1},{"coverage":-1},{"p_effort":.4},{"p_no_effort":1.1}]:
            with self.assertRaises(ValueError):
                hidden_action(**kwargs)

    def test_signaling_is_only_an_incentive_check(self):
        row=signaling_incentives()
        self.assertEqual((row["high_type_net_gain"],row["low_type_net_gain"]),(4,-2))
        self.assertTrue(row["incentive_conditions_met"])
        self.assertFalse(signaling_incentives(wage_premium=8)["incentive_conditions_met"])
        self.assertFalse(signaling_incentives(wage_premium=9)["incentive_conditions_met"])


class DeliveryChecks(unittest.TestCase):
    def test_independently_calculated_stage_exercise_answers(self):
        self.assertEqual(cournot(3,a=50,b=1,mc=10)["quantity"],30)
        pollution=externality(damage_slope=.5)
        self.assertAlmostEqual(pollution["welfare_private"],512)
        self.assertAlmostEqual(pollution["welfare_efficient"],921.6)
        self.assertAlmostEqual(pollution["deadweight_loss"],409.6)
        self.assertAlmostEqual(public_good(unit_cost=20)["efficient_quantity"],6)
        self.assertAlmostEqual(public_good(unit_cost=20)["welfare_efficient"],36)
        self.assertEqual(commons(3)["noncooperative_total_effort"],6)
        self.assertTrue(hidden_action(.9,effort_cost=2)["choose_effort"])

    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage5-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve():
            raise RuntimeError("Temporary path outside course")
        cls.copy=cls.root/"stage5"
        shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","output",".venv"))

    @classmethod
    def tearDownClass(cls):
        if cls.root.parent!=COURSE.resolve():
            raise RuntimeError("Unsafe temporary cleanup path")
        cls.temp.cleanup()

    def run_program(self,name,args=(),valid=True):
        env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1","PYTHONIOENCODING":"utf-8"}
        result=subprocess.run([sys.executable,str(self.copy/name),*args],cwd=self.root,env=env,capture_output=True,text=True,encoding="utf-8",timeout=15)
        RUNS.append({"program":name,"args":list(args),"exitCode":result.returncode,"stdout":result.stdout,"stderr":result.stderr})
        self.assertEqual(result.returncode,0 if valid else 2,result.stderr)
        return result

    def test_six_complete_entrypoints(self):
        known={"monopoly.py":"Monopoly: Q=48.00, P=36.00", "games.py":"total=64.00, price=28.00",
               "exchange.py":"Grid points: 121", "externalities.py":"Social welfare: 1024.00 -> 1152.00",
               "public_goods.py":"efficient g=8.00, voluntary g=4.00", "information.py":"Remaining=['low'], price=100.00"}
        for name,message in known.items():
            with self.subTest(name=name):
                self.assertIn(message,self.run_program(name).stdout)

    def test_integrated_default(self):
        report=json.loads(self.run_program("policy_lab.py").stdout)
        self.assertEqual(report["version"],"0.2")
        self.assertEqual(report["monopoly"]["deadweight_loss"],576)
        self.assertEqual(report["externality"]["optimal_unit_tax"],12)

    def test_integrated_parameter_ownership(self):
        report=json.loads(self.run_program("policy_lab.py",["--firms","3","--damage-slope","0","--coverage","1"]).stdout)
        self.assertEqual(report["cournot"]["quantity"],72)
        self.assertEqual(report["externality"]["optimal_unit_tax"],0)
        self.assertFalse(report["hidden_action"]["choose_effort"])
        self.assertEqual(report["monopoly"]["quantity"],48)

    def test_cli_bad_inputs_and_help(self):
        for args in [["--firms","0"],["--firms","-1"],["--firms","1.5"],["--damage-slope","-1"],["--damage-slope","nan"],["--coverage","1.1"],["--coverage","inf"],["--coverage","oops"]]:
            with self.subTest(args=args):
                self.assertIn("error:",self.run_program("policy_lab.py",args,valid=False).stderr)
        self.assertIn("--coverage",self.run_program("policy_lab.py",["--help"]).stdout)

    def test_previous_chapters_examples_and_data_unchanged(self):
        baseline=json.loads((COURSE/"maintenance"/"stages1-4-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),48)
        for relative,expected in baseline.items():
            self.assertEqual(hashlib.sha256((COURSE/relative).read_bytes()).hexdigest(),expected,relative)


if __name__=="__main__":
    stream=io.StringIO()
    suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":5,"chapters":[27,32],
            "python":sys.version,"platform":platform.platform(),"testsRun":result.testsRun,
            "failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),
            "subprocessRuns":len(RUNS),"preservedPriorFiles":48,"testLog":stream.getvalue(),"runs":RUNS,
            "sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(EXAMPLES.glob("*.py"))},
            "notValidated":["fresh installation","all operating systems/Python versions","mixed-strategy solver","general price discrimination","real policy causality","full information-contract equilibrium","macro chapters 33-60","full-site build","browser UI"]}
    Path(__file__).with_name("stage5-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful():
        print(stream.getvalue())
        raise SystemExit(1)
