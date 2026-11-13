"""Independent known answers, timing, signs, domains and clean-copy CLI checks."""
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
EXAMPLES=SOURCE/"示例代码/stage9"
sys.path.insert(0,str(EXAMPLES))
from open_growth import exchange_quote,uip_rate,external_accounts,mundell_fleming,doubling_time,growth_path
from open_growth import solow_steady,solow_path,golden_rule,growth_accounting,ak_growth,adjustment_comparison
RUNS=[]

class ExternalChecks(unittest.TestCase):
    def test_quote_reciprocal_and_real_baskets(self):
        r=exchange_quote()
        self.assertAlmostEqual(r["domestic_per_foreign_change"],.1)
        self.assertAlmostEqual(r["domestic_currency_foreign_value_change"],-1/11)
        self.assertAlmostEqual(r["real_exchange_rate"],1)
        self.assertAlmostEqual(exchange_quote(new=7,domestic_price=140)["real_exchange_rate"],1)

    def test_appreciation_and_uip_exact_cross_term(self):
        r=exchange_quote(old=8,new=7.2)
        self.assertAlmostEqual(r["domestic_per_foreign_change"],-.1)
        self.assertAlmostEqual(r["domestic_currency_foreign_value_change"],1/9)
        self.assertAlmostEqual(uip_rate(),.0608)
        self.assertNotAlmostEqual(uip_rate(),.06)

    def test_account_known_signs(self):
        r=external_accounts()
        self.assertEqual((r["net_exports"],r["current_account"],r["financial_account_net_lending"]),(20,18,20))
        self.assertTrue(r["consistent"]);self.assertEqual(r["residual"],0)

    def test_account_discrepancy_not_silently_filled(self):
        r=external_accounts(asset_acquisition=40)
        self.assertFalse(r["consistent"]);self.assertEqual((r["errors"],r["required_errors"],r["residual"]),(0,5,-5))
        self.assertTrue(external_accounts(asset_acquisition=40,errors=5)["consistent"])
        self.assertEqual(external_accounts(asset_acquisition=-10,liability_incurrence=-15)["financial_account_net_lending"],5)

    def test_invalid_quotes_and_accounts(self):
        for kwargs in [{"new":0},{"old":-1},{"domestic_price":0},{"foreign_price":math.nan}]:
            with self.assertRaises(ValueError): exchange_quote(**kwargs)
        with self.assertRaises(ValueError): uip_rate(foreign_interest=-1)
        with self.assertRaises(ValueError): external_accounts(exports=-1)
        with self.assertRaises(ValueError): external_accounts(errors=True)

    def test_open_base_and_residuals(self):
        r=mundell_fleming()
        self.assertEqual((r["output"],r["real_exchange_rate"],r["equilibrium_money"]),(700,1,400))
        self.assertEqual((r["consumption"],r["investment"],r["net_exports"]),(490,60,0))
        self.assertAlmostEqual(r["goods_residual"],0);self.assertAlmostEqual(r["money_residual"],0)

    def test_floating_fiscal_offsets_net_exports(self):
        for change,q,nx in [(10,.9,-10),(20,.8,-20)]:
            r=mundell_fleming(fiscal_change=change)
            self.assertEqual(r["output"],700);self.assertAlmostEqual(r["real_exchange_rate"],q)
            self.assertAlmostEqual(r["net_exports"],nx)
            self.assertEqual(r["private_investment"],40);self.assertEqual(r["public_investment"],20)

    def test_floating_money_expands_output_and_q(self):
        for money,y,q,nx in [(440,750,1.25,20),(480,800,1.5,40)]:
            r=mundell_fleming(money=money)
            self.assertEqual((r["output"],r["real_exchange_rate"],r["net_exports"]),(y,q,nx))
            self.assertIsNone(r["required_reversal_for_peg"])

    def test_fixed_fiscal_requires_money_accommodation(self):
        r=mundell_fleming("fixed",20)
        self.assertEqual((r["output"],r["equilibrium_money"],r["requested_money"]),(740,432,400))
        self.assertAlmostEqual(r["net_exports"],-4)
        self.assertAlmostEqual(r["goods_residual"],0)

    def test_fixed_money_attempt_not_independent_equilibrium(self):
        r=mundell_fleming("fixed",money=480)
        self.assertEqual((r["output"],r["equilibrium_money"],r["required_reversal_for_peg"]),(700,400,-80))
        self.assertEqual(r["real_exchange_rate"],1)

    def test_open_model_invalid_economic_domains(self):
        for kwargs in [{"regime":"unknown"},{"world_interest":.09},{"money":0},{"fiscal_change":-151},{"peg":0},{"money":math.inf}]:
            with self.assertRaises(ValueError): mundell_fleming(**kwargs)


class CompoundAndSolowChecks(unittest.TestCase):
    def test_compound_levels_and_per_capita_growth(self):
        rows=growth_path();last=rows[-1]
        self.assertEqual(len(rows),11)
        self.assertAlmostEqual(last["output"],1000*1.05**10)
        self.assertAlmostEqual(last["population"],100*1.02**10)
        self.assertAlmostEqual(last["per_capita"],10*(35/34)**10)
        self.assertAlmostEqual(last["per_capita_growth"],1/34)

    def test_independent_compound_exercise_and_declining_population(self):
        r=growth_path(output=500,population=50,output_growth=.04,population_growth=.01,years=2)[-1]
        self.assertAlmostEqual(r["output"],540.8);self.assertAlmostEqual(r["population"],51.005)
        self.assertAlmostEqual(r["per_capita"],540.8/51.005)
        self.assertGreater(growth_path(population_growth=-.02,years=1)[-1]["per_capita_growth"],.05)

    def test_exact_doubling_and_undefined_nonpositive_growth(self):
        t=doubling_time(.03)
        self.assertAlmostEqual(1.03**t,2)
        self.assertIsNone(doubling_time(0));self.assertIsNone(doubling_time(-.02))
        self.assertEqual(len(growth_path(years=0)),1)

    def test_compound_bad_inputs(self):
        for kwargs in [{"population":0},{"output_growth":-1},{"years":2.5},{"years":True},{"output":math.nan}]:
            with self.assertRaises(ValueError): growth_path(**kwargs)

    def test_solow_steady_and_independent_discrete_first_step(self):
        s=solow_steady();r=solow_path(years=1)
        self.assertAlmostEqual(s["capital_per_effective_worker"],4)
        self.assertAlmostEqual(s["output_per_effective_worker"],2)
        self.assertAlmostEqual(s["consumption_per_effective_worker"],1.6)
        self.assertAlmostEqual(r[1]["capital_per_effective_worker"],56/51)
        self.assertNotAlmostEqual(r[1]["capital_per_effective_worker"],1.12)

    def test_solow_saving_changes_level_and_consumption(self):
        for saving,k,y,c in [(.3,9,3,2.1),(.6,36,6,2.4)]:
            r=solow_steady(saving=saving)
            for key,value in [("capital_per_effective_worker",k),("output_per_effective_worker",y),("consumption_per_effective_worker",c)]: self.assertAlmostEqual(r[key],value)
            self.assertAlmostEqual(r["steady_residual"],0)

    def test_positive_initial_convergence_and_zero_absorbing_case(self):
        low=solow_path(initial=1,years=400)[-1]["capital_per_effective_worker"]
        high=solow_path(initial=9,years=400)[-1]["capital_per_effective_worker"]
        self.assertLess(abs(low-4),1e-6);self.assertLess(abs(high-4),1e-6)
        self.assertTrue(all(r["capital_per_effective_worker"]==0 for r in solow_path(initial=0,years=5)))

    def test_total_capital_timing_independent_of_reduced_form(self):
        rows=solow_path(years=10)
        for previous,current in zip(rows,rows[1:]):
            self.assertAlmostEqual(current["capital"],.92*previous["capital"]+.2*previous["output"])
            self.assertAlmostEqual(current["labor"],previous["labor"]*1.02)
            self.assertAlmostEqual(current["output"],math.sqrt(current["capital"]*current["labor"]))

    def test_golden_rule_steady_consumption_maximum(self):
        r=golden_rule()
        self.assertAlmostEqual(r["capital_per_effective_worker"],25)
        self.assertAlmostEqual(r["consumption_per_effective_worker"],2.5)
        for saving in [.2,.4,.49,.51,.6,.9]: self.assertLess(solow_steady(saving=saving)["consumption_per_effective_worker"],2.5)

    def test_solow_other_parameters_and_bad_domains(self):
        r=solow_steady(saving=.3,depreciation=.1,population_growth=0)
        self.assertAlmostEqual(r["capital_per_effective_worker"],9)
        for kwargs in [{"saving":1.1},{"alpha":1},{"alpha":0},{"population_growth":-.01},{"depreciation":0,"population_growth":0},{"alpha":.999999}]:
            with self.assertRaises(ValueError): solow_steady(**kwargs)


class TechnologyAndComparisonChecks(unittest.TestCase):
    def test_exact_effective_worker_dilution(self):
        r=solow_steady(technology_growth=.02)
        self.assertAlmostEqual(r["break_even_coefficient"],.1204)
        self.assertAlmostEqual(r["capital_per_effective_worker"],(500/301)**2)
        first=solow_path(years=1,technology_growth=.02)[1]
        self.assertAlmostEqual(first["capital_per_effective_worker"],1.12/(1.02*1.02))

    def test_balanced_effective_state_and_worker_total_growth(self):
        s=solow_steady(technology_growth=.02)
        rows=solow_path(initial=s["capital_per_effective_worker"],years=2,technology_growth=.02)
        for previous,current in zip(rows,rows[1:]):
            self.assertAlmostEqual(current["capital_per_effective_worker"],s["capital_per_effective_worker"])
            self.assertAlmostEqual(current["output_per_worker"]/previous["output_per_worker"]-1,.02)
            self.assertAlmostEqual(current["output"]/previous["output"]-1,.0404)

    def test_effective_worker_and_aggregate_identity(self):
        for r in solow_path(years=20,technology_growth=.03):
            self.assertAlmostEqual(r["capital"],r["capital_per_effective_worker"]*r["technology"]*r["labor"])
            self.assertAlmostEqual(r["output_per_worker"],r["output"]/r["labor"])

    def test_growth_accounting_exact_product_and_tfp_definition(self):
        r=growth_accounting()
        self.assertAlmostEqual(r["output_growth"],1.02*math.sqrt(1.1)-1)
        self.assertAlmostEqual(r["output_log_growth"],r["capital_log_contribution"]+r["labor_log_contribution"]+r["technology_log_contribution"])
        self.assertAlmostEqual(r["tfp_log_growth"],.5*math.log(1.02))
        self.assertNotAlmostEqual(r["output_growth"],.07)

    def test_growth_accounting_alternative_and_ak(self):
        self.assertAlmostEqual(growth_accounting(capital_growth=.21,labor_growth=0,technology_growth=0)["output_growth"],.1)
        self.assertAlmostEqual(ak_growth()["growth"],.05)
        self.assertAlmostEqual(ak_growth(saving=.6)["growth"],.07)
        with self.assertRaises(ValueError): growth_accounting(capital_growth=-1)
        with self.assertRaises(ValueError): ak_growth(depreciation=1.1)

    def test_comparison_numeric_residuals_and_ordering(self):
        rows=adjustment_comparison()
        self.assertAlmostEqual(rows[0]["output"],2200/3)
        self.assertAlmostEqual(rows[1]["price"],(340+math.sqrt(283600))/840)
        self.assertAlmostEqual(rows[-1]["price"],1.25)
        self.assertTrue(all(a["output"]>b["output"] for a,b in zip(rows,rows[1:])))
        for r in rows: self.assertAlmostEqual(r["ad_residual"],0)
        for r in rows[:3]: self.assertAlmostEqual(r["supply_residual"],0)
        self.assertIsNone(rows[-1]["supply_residual"])

    def test_comparison_zero_shift_and_invalid_long_run_domain(self):
        for r in adjustment_comparison(shift=0): self.assertAlmostEqual(r["output"],700)
        with self.assertRaises(ValueError): adjustment_comparison(shift=50)
        with self.assertRaises(ValueError): adjustment_comparison(shift=math.nan)


class DeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage9-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve(): raise RuntimeError("Unsafe temporary path")
        cls.copy=cls.root/"stage9";shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","my-results"))

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

    def test_six_chapter_entrypoints_from_other_directory(self):
        expected={"exchange_accounts.py":"6.080000%","open_economy.py":"fixed fiscal: Y=740.000000", "growth.py":"Per-capita growth: 2.941176%", "solow.py":"next k=1.098039215686", "technology.py":"aggregate: 4.040000%", "model_comparison.py":"steeper_supply: Y=717.881857"}
        for name,value in expected.items(): self.assertIn(value,self.run_program(name).stdout)

    def test_integrated_base_and_synthetic_identity(self):
        r=json.loads(self.run_program("global_growth_lab.py").stdout)
        self.assertEqual((r["version"],r["origin"]),("0.5a","synthetic_teaching_parameters"))
        self.assertEqual(r["small_open_economy"]["output"],700)
        self.assertAlmostEqual(r["steady_without_technology"]["capital_per_effective_worker"],4)
        self.assertEqual(len(r["compound_growth"]),21)

    def test_integrated_parameter_ownership_and_fixed_regime(self):
        r=json.loads(self.run_program("global_growth_lab.py",["--regime","fixed","--fiscal-change","20","--saving",".3","--years","5"]).stdout)
        self.assertEqual(r["small_open_economy"]["equilibrium_money"],432)
        self.assertAlmostEqual(r["steady_without_technology"]["capital_per_effective_worker"],9)
        self.assertAlmostEqual(r["ak_reference"]["growth"],.05)
        self.assertEqual(r["external_accounts"]["current_account"],18)

    def test_integrated_money_and_technology(self):
        r=json.loads(self.run_program("global_growth_lab.py",["--money","480","--technology-growth",".03","--years","2"]).stdout)
        self.assertEqual(r["small_open_economy"]["output"],800)
        self.assertAlmostEqual(r["steady_with_technology"]["break_even_coefficient"],.1306)
        self.assertAlmostEqual(r["compound_growth"][0]["per_capita_growth"],1/34)

    def test_cli_bad_inputs_and_help(self):
        for args in [["--saving","1.1"],["--money","nan"],["--years","0"],["--years","201"],["--years","2.5"],["--population-growth","-.02"],["--technology-growth","-1"],["--regime","unknown"]]:
            self.assertIn("error:",self.run_program("global_growth_lab.py",args,valid=False).stderr)
        self.assertIn("--regime",self.run_program("global_growth_lab.py",["--help"]).stdout)

    def test_previous_sources_unchanged(self):
        baseline=json.loads((COURSE/"maintenance/stages1-8-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),113)
        for name,expected in baseline.items(): self.assertEqual(hashlib.sha256((COURSE/name).read_bytes()).hexdigest(),expected,name)


if __name__=="__main__":
    stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":9,"chapters":[51,56],"python":sys.version,"platform":platform.platform(),
            "testsRun":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),"subprocessRuns":len(RUNS),"preservedPriorFiles":113,
            "testLog":stream.getvalue(),"runs":RUNS,"sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(EXAMPLES.glob("*.py"))},
            "notValidated":["fresh installation","all OS/Python versions","real exchange-rate forecasts","all current BOP formats","empirical capital mobility","growth causality","full school/DSGE implementations","scientific Python chapters 57-60","site build","browser UI"]}
    Path(__file__).with_name("stage9-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful(): print(stream.getvalue());raise SystemExit(1)
