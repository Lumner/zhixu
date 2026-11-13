"""Known answers and model domains, not an empirical macro validation."""
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
EXAMPLES=SOURCE/"示例代码"/"stage7"
sys.path.insert(0,str(EXAMPLES))
from short_run import BASE,parameters,reduced_form,components,goods_equilibrium,adjustment_path,multipliers
from short_run import money_market,bond_price,is_lm,floor_equilibrium,banking_demo,deposit_ratios

RUNS=[]

class GoodsAndMultiplierChecks(unittest.TestCase):
    def test_reduced_form_independently_known_coefficients(self):
        r=reduced_form()
        self.assertEqual(r["a"],320)
        self.assertAlmostEqual(r["ae_income_slope"],.6)
        self.assertAlmostEqual(r["leakage"],.4)

    def test_fixed_rate_goods_known_components(self):
        r=goods_equilibrium()
        for key,value in [("output",800),("taxes",200),("consumption",550),("investment",100),("private_saving",50),("government_saving",50)]:
            self.assertAlmostEqual(r[key],value)
        self.assertAlmostEqual(r["goods_residual"],0)

    def test_unplanned_inventory_and_ex_post_identity(self):
        for y,ae,inventory in [(600,680,-80),(700,740,-40),(1000,920,80)]:
            r=components(y)
            self.assertAlmostEqual(r["planned_expenditure"],ae)
            self.assertAlmostEqual(r["unplanned_inventory"],inventory)
            self.assertAlmostEqual(r["national_saving"],r["actual_investment_including_unplanned_inventory"]+r["net_exports"])

    def test_adjustment_rule_first_steps_and_convergence(self):
        rows=adjustment_path(steps=60)
        for r,value in zip(rows,[600,640,672,697.6,718.08,734.464]): self.assertAlmostEqual(r["output"],value)
        self.assertAlmostEqual(rows[-1]["output"],800-200*.8**60)
        self.assertLess(abs(rows[-1]["output"]-800),.001)

    def test_adjustment_rejects_unstable_and_bad_steps(self):
        for kwargs in [{"alpha":0},{"alpha":5},{"alpha":6},{"steps":-1},{"steps":2.5},{"steps":True},{"steps":2001}]:
            with self.assertRaises(ValueError): adjustment_path(**kwargs)
        self.assertEqual(len(adjustment_path(steps=0)),1)

    def test_spending_tax_and_combined_changes(self):
        for p,value in [(parameters(g=170),850),(parameters(t0=60),762.5),(parameters(g=170,t0=60),812.5)]:
            self.assertAlmostEqual(goods_equilibrium(p)["output"],value)
        m=multipliers()
        self.assertAlmostEqual(m["fixed_interest_spending"],2.5)
        self.assertAlmostEqual(m["fixed_interest_net_lump_tax"],-1.875)
        self.assertAlmostEqual(m["equal_g_and_t0"],.625)

    def test_realized_tax_balance_is_a_different_constraint(self):
        base=goods_equilibrium()
        same=goods_equilibrium(parameters(g=170,t0=60))
        self.assertAlmostEqual(same["taxes"]-base["taxes"],22.5)
        balanced=goods_equilibrium(parameters(g=170,t0=56))
        self.assertAlmostEqual(balanced["output"]-base["output"],20)
        self.assertAlmostEqual(balanced["taxes"]-base["taxes"],20)

    def test_import_leakage_and_different_base(self):
        p=parameters(import_propensity=.1)
        self.assertAlmostEqual(goods_equilibrium(p)["output"],640)
        self.assertAlmostEqual(goods_equilibrium(parameters(**{**p,"g":170}))["output"],680)
        self.assertAlmostEqual(multipliers(p)["fixed_interest_spending"],2)

    def test_public_investment_is_not_government_consumption(self):
        r=goods_equilibrium(parameters(public_investment=40))
        self.assertAlmostEqual(r["output"],850)
        self.assertEqual(r["government_consumption"],150)
        self.assertEqual(r["public_investment"],40)

    def test_independent_stage_exercise_goods(self):
        p=parameters(c0=60,mpc=.8,t0=20,tax_rate=.25,private0=70,public_investment=20,g=100,b=0)
        self.assertAlmostEqual(goods_equilibrium(p)["output"],585)
        self.assertAlmostEqual(components(500,p=p)["unplanned_inventory"],-34)

    def test_parameters_do_not_mutate_defaults(self):
        before=dict(BASE);p=parameters(g=170);p["g"]=999
        self.assertEqual(BASE,before);self.assertEqual(parameters()["g"],150)

    def test_invalid_parameter_domains_and_unknown_keys(self):
        for values in [{"mpc":1},{"mpc":-.1},{"tax_rate":1.1},{"import_propensity":-1},{"price":0},{"h":0},{"money":-1},{"g":True},{"b":math.nan},{"k":math.inf},{"unknown":1}]:
            with self.assertRaises(ValueError): parameters(**values)

    def test_linear_consumption_investment_and_output_domains(self):
        for kwargs in [{"y":-1},{"y":700,"interest":.09},{"y":700,"interest":-.01},{"y":0,"p":parameters(c0=0,t0=40)}]:
            with self.assertRaises(ValueError): components(**kwargs)
        self.assertAlmostEqual(components(600,interest=.08)["private_investment"],0)


class MoneyAndJointChecks(unittest.TestCase):
    def test_four_independent_money_market_examples(self):
        for y,money,price,rate in [(700,400,1,.04),(800,400,1,.06),(700,500,1,.015),(700,400,2,.09)]:
            r=money_market(y,parameters(money=money,price=price))
            self.assertAlmostEqual(r["interest"],rate)
            self.assertAlmostEqual(r["money_residual"],0)

    def test_bond_price_and_inverse_relation(self):
        self.assertAlmostEqual(bond_price(100,.04),1250/13)
        self.assertAlmostEqual(bond_price(100,.05),2000/21)
        self.assertGreater(bond_price(100,.04),bond_price(100,.05))
        for args in [(0,.04),(100,-.01),(100,math.inf)]:
            with self.assertRaises(ValueError): bond_price(*args)

    def test_money_zero_and_negative_implied_rate(self):
        self.assertEqual(money_market(500)["interest"],0)
        with self.assertRaises(ValueError): money_market(400)

    def test_joint_known_answer_and_both_residuals(self):
        r=is_lm()
        for key,value in [("output",700),("interest",.04),("taxes",180),("consumption",490),("private_investment",40),("public_investment",20),("investment",60),("national_saving",60)]: self.assertAlmostEqual(r[key],value)
        self.assertAlmostEqual(r["goods_residual"],0);self.assertAlmostEqual(r["money_residual"],0)

    def test_one_market_solution_is_not_joint_equilibrium(self):
        self.assertAlmostEqual(components(800,interest=.06)["unplanned_inventory"],60)
        self.assertAlmostEqual(.8*800-4000*0,640)
        self.assertNotEqual(640,400)

    def test_joint_alternative_parameters_independent_elimination(self):
        p=parameters(c0=80,mpc=.5,t0=0,tax_rate=0,private0=80,public_investment=20,g=100,b=500,k=.5,h=2000,money=200)
        r=is_lm(p)
        self.assertAlmostEqual(r["output"],528);self.assertAlmostEqual(r["interest"],.032)
        self.assertAlmostEqual(.5*r["output"]+500*r["interest"],280)
        self.assertAlmostEqual(.5*r["output"]-2000*r["interest"],200)

    def test_fiscal_crowding_out_and_output_feedback(self):
        base=is_lm();fiscal=is_lm(parameters(g=170))
        self.assertAlmostEqual(fiscal["output"],2200/3)
        self.assertAlmostEqual(fiscal["interest"],7/150)
        self.assertAlmostEqual(base["investment"]-fiscal["investment"],20/3)
        self.assertAlmostEqual(750-fiscal["output"],(base["investment"]-fiscal["investment"])*2.5)

    def test_money_expansion_and_accommodation(self):
        r=is_lm(parameters(money=500))
        self.assertAlmostEqual(r["output"],2225/3);self.assertAlmostEqual(r["interest"],7/300)
        r=is_lm(parameters(g=170,money=440))
        self.assertAlmostEqual(r["output"],750);self.assertAlmostEqual(r["interest"],.04)
        self.assertAlmostEqual(r["investment"],60)

    def test_multiplier_matches_finite_policy_change(self):
        base=is_lm();m=multipliers()
        self.assertAlmostEqual((is_lm(parameters(g=162))["output"]-base["output"])/12,m["ordinary_is_lm_g"])
        self.assertAlmostEqual((is_lm(parameters(money=424))["output"]-base["output"])/24,m["ordinary_is_lm_real_money"])

    def test_zero_investment_sensitivity_and_price_scaling(self):
        r=is_lm(parameters(b=0));self.assertAlmostEqual(r["output"],800);self.assertAlmostEqual(r["interest"],.06)
        scaled=is_lm(parameters(money=800,price=2));base=is_lm()
        self.assertAlmostEqual(scaled["output"],base["output"]);self.assertAlmostEqual(scaled["interest"],base["interest"])

    def test_ordinary_rejects_negative_rate_and_negative_private_investment(self):
        with self.assertRaises(ValueError): is_lm(parameters(money=700))
        with self.assertRaises(ValueError): is_lm(parameters(money=0))


class FloorAndBankingChecks(unittest.TestCase):
    def test_floor_extra_liquidity_and_money_ineffectiveness_in_branch(self):
        for money,extra in [(700,60),(800,160)]:
            r=floor_equilibrium(parameters(money=money))
            self.assertEqual(r["regime"],"floor");self.assertAlmostEqual(r["output"],800);self.assertEqual(r["interest"],0)
            self.assertAlmostEqual(r["linear_money_gap"],extra);self.assertAlmostEqual(r["liquidity_holdings"],extra)
            self.assertAlmostEqual(r["money_residual"],0);self.assertAlmostEqual(r["goods_residual"],0)

    def test_floor_boundary_continuity_and_ordinary_branch(self):
        r=floor_equilibrium(parameters(money=640))
        self.assertEqual(r["regime"],"floor");self.assertAlmostEqual(r["liquidity_holdings"],0)
        near=floor_equilibrium(parameters(money=639.99))
        self.assertEqual(near["regime"],"ordinary");self.assertLess(abs(near["output"]-r["output"]),.01)
        self.assertAlmostEqual(floor_equilibrium()["output"],is_lm()["output"])

    def test_fiscal_in_floor_and_exit_check(self):
        r=floor_equilibrium(parameters(money=700,g=170))
        self.assertEqual(r["regime"],"floor");self.assertAlmostEqual(r["output"],850);self.assertAlmostEqual(r["liquidity_holdings"],20)
        r=floor_equilibrium(parameters(money=700,g=200))
        self.assertEqual(r["regime"],"ordinary");self.assertAlmostEqual(r["output"],2725/3);self.assertAlmostEqual(r["interest"],1/150)

    def test_positive_floor_and_invalid_floor(self):
        r=floor_equilibrium(floor=.05)
        self.assertEqual(r["regime"],"floor");self.assertAlmostEqual(r["output"],675);self.assertAlmostEqual(r["liquidity_holdings"],60)
        for floor in [-1,math.nan,.09]:
            with self.assertRaises(ValueError): floor_equilibrium(floor=floor)

    def test_bank_balances_at_every_event(self):
        rows=banking_demo()
        for r in rows:
            for key in ["bank_a","bank_b"]:
                bank=r[key];self.assertEqual(bank["reserves"]+bank["loans"],bank["deposits"]+bank["equity"])
        self.assertEqual([r["money_cash_plus_deposits"] for r in rows],[160,220,220,210,210])
        self.assertEqual([r["base_cash_plus_reserves"] for r in rows],[200]*5)

    def test_bank_transfer_repayment_withdrawal_and_history_snapshots(self):
        rows=banking_demo();last=rows[-1]
        self.assertEqual(last["totals"],{"reserves":180,"loans":50,"deposits":190,"equity":40})
        self.assertEqual(last["public_cash"],20)
        self.assertEqual(rows[0]["bank_a"]["deposits"],100)
        self.assertEqual(rows[2]["bank_b"]["reserves"],120)

    def test_bank_alternative_exercise_and_bad_funding(self):
        r=banking_demo(50,30,10,15)[-1]
        self.assertEqual(r["totals"],{"reserves":185,"loans":40,"deposits":185,"equity":40})
        self.assertEqual((r["public_cash"],r["money_cash_plus_deposits"]),(15,200))
        for args in [(-1,0,0,0),(30,40,0,0),(60,40,30,0),(300,200,0,0),(60,40,10,100)]:
            with self.assertRaises(ValueError): banking_demo(*args)

    def test_ratio_model_both_examples_and_identity(self):
        for kwargs,d,c,r,m in [({},1000,0,100,1000),({"currency_ratio":.2,"excess_ratio":.1},250,50,50,300),({"base":120,"reserve_ratio":.2,"currency_ratio":.1,"excess_ratio":.1},300,30,90,330)]:
            row=deposit_ratios(**kwargs)
            for key,value in [("deposits",d),("currency",c),("reserves",r),("money",m)]: self.assertAlmostEqual(row[key],value)
            self.assertAlmostEqual(row["currency"]+row["reserves"],row["base"])

    def test_ratio_model_undefined_and_invalid_ratios(self):
        for kwargs in [{"reserve_ratio":0},{"reserve_ratio":.8,"excess_ratio":.3},{"currency_ratio":-1},{"base":math.inf}]:
            with self.assertRaises(ValueError): deposit_ratios(**kwargs)


class DeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage7-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve(): raise RuntimeError("Unsafe temporary path")
        cls.copy=cls.root/"stage7";shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","my-results"))

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

    def test_six_complete_chapter_entrypoints(self):
        expected={"keynesian_cross.py":"Equilibrium: Y=800.000000","multipliers.py":"G,t0 both +20: Y=812.500000", "banking.py":"withdrawal: R=180.00, L=50.00, D=190.00", "money_market.py":"i=9.000000%", "is_lm.py":"Joint equilibrium: Y=700.000000, i=4.000000%", "policy_mix.py":"exit floor: regime=ordinary, Y=908.333333"}
        for name,value in expected.items(): self.assertIn(value,self.run_program(name).stdout)

    def test_integrated_base_and_source_identity(self):
        r=json.loads(self.run_program("demand_lab.py").stdout)
        self.assertEqual(r["version"],"0.4a");self.assertEqual(r["origin"],"synthetic_teaching_parameters")
        self.assertAlmostEqual(r["base"]["output"],700)
        self.assertAlmostEqual(r["fixed_zero_interest_goods_example"]["output"],800)
        self.assertEqual(r["independent_bank_ledger"][-1]["money_cash_plus_deposits"],210)

    def test_integrated_fiscal_accommodation_and_structural_parameter(self):
        fiscal=json.loads(self.run_program("demand_lab.py",["--g-change","20"]).stdout)
        self.assertAlmostEqual(fiscal["changes"]["output"],100/3)
        joint=json.loads(self.run_program("demand_lab.py",["--g-change","20","--money-change","40"]).stdout)
        self.assertAlmostEqual(joint["scenario"]["output"],750);self.assertAlmostEqual(joint["changes"]["interest"],0)
        opened=json.loads(self.run_program("demand_lab.py",["--import-propensity",".1"]).stdout)
        self.assertAlmostEqual(opened["base"]["output"],600);self.assertAlmostEqual(opened["base"]["interest"],.02)

    def test_integrated_floor_money_and_exit(self):
        r=json.loads(self.run_program("demand_lab.py",["--regime","floor","--money-change","300"]).stdout)
        self.assertEqual(r["scenario"]["regime"],"floor");self.assertAlmostEqual(r["scenario"]["liquidity_holdings"],60)
        r=json.loads(self.run_program("demand_lab.py",["--regime","floor","--money-change","300","--g-change","50"]).stdout)
        self.assertEqual(r["scenario"]["regime"],"ordinary");self.assertAlmostEqual(r["scenario"]["output"],2725/3)

    def test_cli_invalid_inputs_and_help(self):
        for args in [["--mpc","1"],["--money-change","nan"],["--g-change","-200"],["--money-change","300"],["--floor",".01"],["--regime","unknown"],["--tax-rate","-1"],["--import-propensity","oops"],["--regime","floor","--floor","inf"]]:
            self.assertIn("error:",self.run_program("demand_lab.py",args,valid=False).stderr)
        self.assertIn("--regime",self.run_program("demand_lab.py",["--help"]).stdout)

    def test_previous_chapters_programs_and_data_unchanged(self):
        baseline=json.loads((COURSE/"maintenance/stages1-6-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),85)
        for name,expected in baseline.items(): self.assertEqual(hashlib.sha256((COURSE/name).read_bytes()).hexdigest(),expected,name)


if __name__=="__main__":
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":7,"chapters":[39,44],"python":sys.version,"platform":platform.platform(),
            "testsRun":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),
            "subprocessRuns":len(RUNS),"preservedPriorFiles":85,"testLog":stream.getvalue(),"runs":RUNS,
            "sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(EXAMPLES.glob("*.py"))},
            "notValidated":["fresh install","all OS/Python versions","real bank regulation","actual money aggregates/interest rates","estimated multipliers","nonlinear investment corners","inflation expectations","supply/capacity","government debt financing","chapters 45-60","site build","browser UI"]}
    Path(__file__).with_name("stage7-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful(): print(stream.getvalue());raise SystemExit(1)
