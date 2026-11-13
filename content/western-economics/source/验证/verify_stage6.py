"""Stage 6 known answers, measurement boundaries, data and clean-copy CLI checks."""
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
from unittest.mock import patch

sys.dont_write_bytecode=True
SOURCE=Path(__file__).resolve().parents[1]
COURSE=SOURCE.parent
EXAMPLES=SOURCE/"示例代码"/"stage6"
sys.path.insert(0,str(EXAMPLES))
import macro
from macro import load_table,load_json,load_accounts,production_chain,expenditure_gdp,price_volume,fixed_basket_index
from macro import real_growth,real_interest,labour_indicators,national_accounts,growth_rate
from macro import quarterly_rates,adjust_with_known_factors,annual_totals,cumulative_to_quarters,vintage_growth

RUNS=[]

def people(scenario):
    row=next(r for r in load_table("labour.csv") if r["scenario"]==scenario)
    return labour_indicators(row["employed"],row["unemployed"],row["outside"],row["population"])


class OutputAndPriceChecks(unittest.TestCase):
    def test_production_expenditure_and_double_count(self):
        row=production_chain(load_table("value_added.csv"))
        self.assertEqual([r["value_added"] for r in row["stages"]],[100,60,90])
        self.assertEqual((row["gdp"],row["naive_output_sum"]),(250,510))
        self.assertEqual(expenditure_gdp(230,20,0,0,0),250)

    def test_imported_input_changes_domestic_value_added(self):
        rows=load_table("value_added.csv");rows[0]["intermediate"]=20
        self.assertEqual(production_chain(rows)["gdp"],230)
        self.assertEqual(expenditure_gdp(230,20,0,0,20),230)

    def test_inventory_reduction_and_negative_value_added_allowed(self):
        self.assertEqual(expenditure_gdp(100,-10,0,0,0),90)
        self.assertEqual(production_chain([{"stage":"loss","output":10,"intermediate":20}])["gdp"],-10)

    def test_production_invalid_inputs(self):
        for rows in [[],[{"stage":"a","output":-1,"intermediate":0}],[{"stage":"a","output":math.nan,"intermediate":0}]]:
            with self.assertRaises(ValueError): production_chain(rows)
        for args in [(-1,0,0,0,0),(0,0,0,0,math.inf),(True,0,0,0,0)]:
            with self.assertRaises(ValueError): expenditure_gdp(*args)

    def test_nominal_real_and_deflator(self):
        r=price_volume(load_table("goods.csv"))
        self.assertEqual((r["base_nominal"],r["current_nominal"],r["current_real_at_base_prices"],r["deflator_base_100"]),(1000,1500,1200,125))
        self.assertAlmostEqual((1+r["real_growth"])*(1+r["deflator_growth"]),1+r["nominal_growth"])

    def test_constant_prices_and_constant_quantities(self):
        rows=load_table("goods.csv")
        for r in rows: r["current_price"]=r["base_price"]
        result=price_volume(rows)
        self.assertEqual((result["current_nominal"],result["current_real_at_base_prices"],result["deflator_base_100"]),(1200,1200,100))
        rows=load_table("goods.csv")
        for r in rows: r["current_quantity"]=r["base_quantity"]
        result=price_volume(rows)
        self.assertEqual((result["current_nominal"],result["current_real_at_base_prices"],result["deflator_base_100"]),(1350,1000,135))

    def test_zero_current_volume_is_not_zero_deflator(self):
        rows=load_table("goods.csv")
        for r in rows: r["current_quantity"]=0
        r=price_volume(rows)
        self.assertIsNone(r["deflator_base_100"]);self.assertIsNone(r["deflator_growth"])
        self.assertEqual((r["nominal_growth"],r["real_growth"]),(-1,-1))

    def test_price_table_invalid_domains_and_duplicate_goods(self):
        for key,value in [("base_price",0),("current_price",-1),("base_quantity",-1),("current_quantity",math.nan),("good","")]:
            rows=load_table("goods.csv");rows[0][key]=value
            with self.assertRaises(ValueError): price_volume(rows)
        rows=load_table("goods.csv");rows[1]["good"]=rows[0]["good"]
        with self.assertRaises(ValueError): price_volume(rows)
        for r in rows: r["base_quantity"]=0
        rows[1]["good"]="different"
        with self.assertRaises(ValueError): price_volume(rows)

    def test_baskets_and_weights(self):
        c=fixed_basket_index(load_table("goods.csv"));p=fixed_basket_index(load_table("producer_prices.csv"))
        self.assertEqual((c["base_cost"],c["current_cost_of_base_basket"],c["index_base_100"],p["index_base_100"]),(1000,1350,135,108))
        self.assertEqual(list(c["base_expenditure_weights"].values()),[.5,.5])

    def test_fixed_basket_independent_of_current_quantities(self):
        rows=load_table("goods.csv");expected=fixed_basket_index(rows)
        for r in rows: r["current_quantity"]*=17
        self.assertEqual(fixed_basket_index(rows),expected)

    def test_exact_real_rates_and_disinflation(self):
        self.assertAlmostEqual(real_interest(.1,.05),1/21)
        self.assertAlmostEqual(real_growth(.1,.35),-5/27)
        self.assertAlmostEqual(growth_rate(140.4,135),.04)
        self.assertAlmostEqual(growth_rate(135,100),.35)
        self.assertIsNone(growth_rate(5,0))

    def test_rate_boundaries(self):
        self.assertEqual(real_growth(-1,0),-1)
        for args in [(0,-1),(math.nan,0),(0,math.inf),(-1.01,0)]:
            with self.assertRaises(ValueError): real_growth(*args)
        with self.assertRaises(ValueError): real_interest(-1,.02)


class PopulationAndAccountsChecks(unittest.TestCase):
    def test_three_labor_scenarios(self):
        for scenario,e,u,n,force,rate,part,epop in [("base",600,60,340,660,1/11,.66,.60),("discouraged",600,40,360,640,.0625,.64,.60),("job_growth",620,40,340,660,2/33,.66,.62)]:
            r=people(scenario)
            self.assertEqual((r["employed"],r["unemployed"],r["outside"],r["labour_force"]),(e,u,n,force))
            self.assertAlmostEqual(r["unemployment_rate"],rate)
            self.assertAlmostEqual(r["participation_rate"],part)
            self.assertAlmostEqual(r["employment_population_ratio"],epop)

    def test_labor_indicator_identity(self):
        for name in ["base","discouraged","job_growth"]:
            r=people(name)
            self.assertAlmostEqual(r["employment_population_ratio"],r["participation_rate"]*(1-r["unemployment_rate"]))

    def test_labor_zero_denominators(self):
        r=labour_indicators(0,0,100)
        self.assertIsNone(r["unemployment_rate"]);self.assertEqual(r["participation_rate"],0)
        r=labour_indicators(0,0,0)
        for key in ["unemployment_rate","participation_rate","employment_population_ratio"]: self.assertIsNone(r[key])
        self.assertEqual(labour_indicators(10,0,0)["unemployment_rate"],0)

    def test_labor_invalid_counts_and_population(self):
        for args in [(-1,1,1),(1,math.nan,0),(True,1,1),(1,1,1,4)]:
            with self.assertRaises(ValueError): labour_indicators(*args)

    def test_account_known_totals_and_residuals(self):
        r=national_accounts(**load_accounts())
        self.assertTrue(r["consistent"])
        self.assertEqual((r["gdp_expenditure"],r["private_gross_saving"],r["government_gross_saving"],r["national_gross_saving"],r["current_account"]),(1000,180,40,220,20))
        self.assertEqual(r["saving_investment_current_account_residual"],0)

    def test_foreign_income_requires_current_account(self):
        inputs=load_accounts();inputs.update(net_primary_income=10,net_current_transfers=-5)
        r=national_accounts(**inputs)
        self.assertEqual((r["gross_national_disposable_income"],r["national_gross_saving"],r["current_account"],r["net_exports"]),(1005,225,25,20))
        self.assertEqual(r["national_gross_saving"]-r["investment"],r["current_account"])

    def test_tax_reallocation_does_not_forecast_behavior(self):
        inputs=load_accounts();inputs["t"]=240;r=national_accounts(**inputs)
        self.assertEqual((r["private_gross_saving"],r["government_gross_saving"],r["national_gross_saving"]),(160,60,220))

    def test_inconsistent_accounts_are_reported_not_repaired(self):
        inputs=load_accounts();inputs["g"]=190;r=national_accounts(**inputs)
        self.assertFalse(r["consistent"])
        self.assertEqual((r["gdp_residual"],r["saving_investment_current_account_residual"]),(-10,-10))
        self.assertEqual(inputs["y"],1000)

    def test_stage_exercises_independent_parameters(self):
        r=national_accounts(1200,700,200,260,100,60,250,net_primary_income=-12,net_current_transfers=2)
        self.assertEqual((r["gross_national_disposable_income"],r["national_gross_saving"],r["current_account"]),(1190,290,30))
        r=labour_indicators(740,40,220)
        self.assertAlmostEqual(r["unemployment_rate"],2/39)
        self.assertAlmostEqual(real_growth(.08,.06),1/53)


class TimeAndProvenanceChecks(unittest.TestCase):
    def test_quarterly_yoy_and_qoq_and_initial_missing(self):
        rows=quarterly_rates(load_table("quarterly.csv"));r=rows[4]
        self.assertAlmostEqual(r["qoq"],-.136);self.assertAlmostEqual(r["yoy"],.08)
        self.assertIsNone(rows[0]["qoq"])
        self.assertTrue(all(r["yoy"] is None for r in rows[:4]))

    def test_annual_totals_and_growth(self):
        r=annual_totals(load_table("quarterly.csv"))
        for key,value in [("2023",440),("2024",475.2),("2025",494.208)]: self.assertAlmostEqual(r[key],value)
        self.assertAlmostEqual(growth_rate(r["2025"],r["2024"]),.04)

    def test_known_factor_adjustment_and_special_annual_preservation(self):
        raw=load_table("quarterly.csv");adjusted=adjust_with_known_factors(raw)
        for year,value in [(2023,110),(2024,118.8),(2025,123.552)]:
            for row in adjusted:
                if row["year"]==year: self.assertAlmostEqual(row["value"],value)
        rates=quarterly_rates(adjusted)
        self.assertAlmostEqual(rates[4]["qoq"],.08);self.assertAlmostEqual(rates[5]["qoq"],0)
        for year,total in annual_totals(raw).items(): self.assertAlmostEqual(annual_totals(adjusted)[year],total)

    def test_normalization_does_not_preserve_arbitrary_annual_totals(self):
        rows=[{"year":2024,"quarter":q,"value":100} for q in range(1,5)]
        self.assertNotAlmostEqual(annual_totals(adjust_with_known_factors(rows))["2024"],400)
        for factors in [(1,1),(0,1,1,1),(1,math.inf,1,1)]:
            with self.assertRaises(ValueError): adjust_with_known_factors(rows,factors)

    def test_period_gaps_duplicates_and_invalid_quarters(self):
        rows=load_table("quarterly.csv")
        for bad in [rows[:2]+rows[3:],rows+[rows[-1]],[],[{"year":2024,"quarter":5,"value":1}],[{"year":2024,"quarter":1.5,"value":1}],[{"year":2024,"quarter":1,"value":-1}]]:
            with self.assertRaises(ValueError): quarterly_rates(bad)
        self.assertEqual(quarterly_rates(list(reversed(rows))),quarterly_rates(rows))

    def test_annual_total_rejects_incomplete_year(self):
        with self.assertRaises(ValueError): annual_totals(load_table("quarterly.csv")[:-1])

    def test_cumulative_to_quarterly_resets_at_new_year(self):
        rows=[{"year":2023,"quarter":q,"value":v} for q,v in enumerate([100,210,315,440],1)]
        rows.append({"year":2024,"quarter":1,"value":108})
        self.assertEqual([r["value"] for r in cumulative_to_quarters(rows)],[100,110,105,125,108])
        with self.assertRaises(ValueError): cumulative_to_quarters(rows[1:])
        with self.assertRaises(ValueError): cumulative_to_quarters([{"year":2024,"quarter":1,"value":100},{"year":2024,"quarter":2,"value":90}])

    def test_vintage_consistency_and_mixed_error(self):
        rows=load_table("vintages.csv")
        self.assertAlmostEqual(vintage_growth(rows,"initial"),.08)
        self.assertAlmostEqual(vintage_growth(rows,"revised"),8/101)
        self.assertNotAlmostEqual(vintage_growth(rows,"revised"),109/100-1)
        with self.assertRaises(ValueError): vintage_growth(rows,"missing")
        with self.assertRaises(ValueError): vintage_growth(rows+[rows[0]],"initial")

    def test_data_provenance_and_official_manual_excerpt(self):
        m=load_json("metadata.json");o=load_json("official_reading.json")
        self.assertEqual(m["kind"],"synthetic_teaching_data")
        self.assertEqual(o["kind"],"official_publication_excerpt")
        self.assertFalse(o["usedAsSyntheticModelInput"])
        self.assertEqual((o["publishedDate"],o["nominalGdpAsPublished"],o["nominalRevisionVersusPreliminary"],o["realGrowthRateAsPublished"]),("2025-12-26",1348066,-1018,.05))


class FileAndDeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix="stage6-verify-temp-",dir=COURSE)
        cls.root=Path(cls.temp.name).resolve()
        if cls.root.parent!=COURSE.resolve(): raise RuntimeError("Unsafe temporary path")
        cls.copy=cls.root/"stage6"
        shutil.copytree(EXAMPLES,cls.copy,ignore=shutil.ignore_patterns("__pycache__","my-results"))

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

    def test_csv_bom_and_invalid_structure(self):
        file=self.root/"csv-check.csv"
        cases=[("good,base_price,base_quantity,current_price\na,1,2,3\n",True),
               ("wrong,header\na,1\n",False),("good,base_price,base_quantity,current_price\n",False),
               ("good,base_price,base_quantity,current_price\na,1,,3\n",False),
               ("good,base_price,base_quantity,current_price\na,1,2,3,4\n",False),
               ("good,base_price,base_quantity,current_price\na,1,2\n",False),
               ("good,base_price,base_quantity,current_price\na,nan,2,3\n",False),
               ("good,base_price,base_quantity,current_price\na,no,2,3\n",False)]
        for text,valid in cases:
            file.write_text(text,encoding="utf-8-sig")
            if valid: self.assertEqual(macro.read_table(file,*macro.SCHEMAS["producer_prices.csv"])[0]["base_price"],1)
            else:
                with self.assertRaises(ValueError): macro.read_table(file,*macro.SCHEMAS["producer_prices.csv"])

    def test_json_shape_account_keys_and_whitelist(self):
        data=self.root/"json-check";data.mkdir(exist_ok=True)
        with patch.object(macro,"DATA",data):
            (data/"accounts.json").write_text("[]",encoding="utf-8")
            with self.assertRaises(ValueError): load_accounts()
            (data/"accounts.json").write_text('{"y":1}',encoding="utf-8")
            with self.assertRaises(ValueError): load_accounts()
        with self.assertRaises(ValueError): load_json("../accounts.json")
        with self.assertRaises(ValueError): load_table("../goods.csv")

    def test_six_chapter_entrypoints_from_other_directory(self):
        expected={"gdp_accounting.py":"GDP=250.00; naive sales sum=510.00","price_volume.py":"GDP deflator (base=100): 125.00", "inflation.py":"-18.518519%","labour.py":"unemployment=6.250000%","sector_balances.py":"current account=25.00","data_reading.py":"raw QoQ=-13.60%, YoY=8.00%"}
        for name,message in expected.items():
            with self.subTest(name=name): self.assertIn(message,self.run_program(name).stdout)

    def test_zero_volume_and_zero_labor_entrypoint_formatting(self):
        file=self.copy/"data"/"goods.csv";original=file.read_bytes()
        try:
            file.write_text("good,base_price,base_quantity,current_price,current_quantity\na,5,100,6,0\nb,10,50,15,0\n",encoding="utf-8")
            self.assertIn("undefined",self.run_program("price_volume.py").stdout)
        finally: file.write_bytes(original)
        file=self.copy/"data"/"labour.csv";original=file.read_bytes()
        try:
            file.write_text("scenario,population,employed,unemployed,outside\nbase,100,0,0,100\n",encoding="utf-8")
            self.assertIn("unemployment=undefined",self.run_program("labour.py").stdout)
        finally: file.write_bytes(original)

    def test_integrated_default_with_separate_origins(self):
        r=json.loads(self.run_program("macro_lab.py").stdout)
        self.assertEqual(r["version"],"0.3")
        self.assertEqual(r["production_chain"]["gdp"],250)
        self.assertEqual(r["accounts"]["national_gross_saving"],220)
        self.assertEqual(r["data_origin"],"synthetic_teaching_data")
        self.assertFalse(r["official_reading"]["usedAsSyntheticModelInput"])
        self.assertIsNone(r["quarterly"][0]["yoy"])

    def test_integrated_independent_parameter_effects(self):
        r=json.loads(self.run_program("macro_lab.py",["--scenario","discouraged","--vintage","initial","--nominal-rate","0.03","--inflation","0.05"]).stdout)
        self.assertEqual(r["labour"]["unemployment_rate"],.0625)
        self.assertAlmostEqual(r["real_interest"],-2/105)
        self.assertAlmostEqual(r["vintage_growth"],.08)
        self.assertEqual(r["price_volume"]["deflator_base_100"],125)
        r=json.loads(self.run_program("macro_lab.py",["--scenario","job_growth"]).stdout)
        self.assertEqual(r["labour"]["employed"],620)

    def test_cli_bad_parameters_and_help(self):
        for args in [["--scenario","unknown"],["--vintage","mixed"],["--nominal-rate","-1"],["--inflation","-1"],["--inflation","nan"],["--nominal-rate","inf"],["--inflation","oops"]]:
            self.assertIn("error:",self.run_program("macro_lab.py",args,valid=False).stderr)
        self.assertIn("--vintage",self.run_program("macro_lab.py",["--help"]).stdout)

    def test_previous_chapters_examples_and_data_unchanged(self):
        baseline=json.loads((COURSE/"maintenance"/"stages1-5-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline),62)
        for relative,expected in baseline.items(): self.assertEqual(hashlib.sha256((COURSE/relative).read_bytes()).hexdigest(),expected,relative)


if __name__=="__main__":
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    assets=sorted(f for f in EXAMPLES.rglob("*") if f.is_file() and f.suffix in (".py",".csv",".json"))
    report={"verifiedDate":"2026-11-13","timezone":"Asia/Shanghai","stage":6,"chapters":[33,38],
            "python":sys.version,"platform":platform.platform(),"testsRun":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),"successful":result.wasSuccessful(),
            "subprocessRuns":len(RUNS),"preservedPriorFiles":62,"testLog":stream.getvalue(),"runs":RUNS,
            "sourceHashes":{f.relative_to(SOURCE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in assets},
            "notValidated":["fresh installation","all OS/Python versions","official seasonal estimation","full official data snapshot","live API","current youth subgroup unemployment","causal macro forecasts","chapters 39-60","site build","browser UI"]}
    Path(__file__).with_name("stage6-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ["testsRun","failures","errors","successful","subprocessRuns","preservedPriorFiles"]}))
    if not result.wasSuccessful():
        print(stream.getvalue());raise SystemExit(1)
