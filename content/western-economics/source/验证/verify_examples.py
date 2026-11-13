"""Run course examples in an isolated copy; standard library only."""
from pathlib import Path
import csv
import hashlib
import io
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1]
COURSE = SOURCE.parent
EXAMPLES = SOURCE / "示例代码"
sys.path.insert(0, str(EXAMPLES))
from econ import equilibrium, taxed_market, price_control, welfare
from elasticity import midpoint_elasticity
from functions import demand
from csv_io import read_prices

RUNS = []


class ModelChecks(unittest.TestCase):
    def test_baseline(self):
        self.assertEqual(equilibrium(), {"price": 24, "quantity": 72})

    def test_demand_shift(self):
        self.assertEqual(equilibrium(a=150), {"price": 30, "quantity": 90})

    def test_cost_shift(self):
        result = equilibrium(c=-12)
        self.assertAlmostEqual(result["price"], 26.4)
        self.assertAlmostEqual(result["quantity"], 67.2)

    def test_baseline_welfare(self):
        self.assertEqual(welfare(24, 24, 72), {"consumer_surplus": 1296, "producer_surplus": 864})

    def test_tax_ten_known_answer(self):
        expected = {"consumer_price": 30, "seller_price": 20, "quantity": 60,
                    "consumer_surplus": 900, "producer_surplus": 600,
                    "tax_revenue": 600, "deadweight_loss": 60,
                    "baseline_total_surplus": 2160, "after_total_including_tax": 2100}
        self.assertEqual(taxed_market(10), expected)

    def test_tax_five_known_answer(self):
        x = taxed_market(5)
        self.assertEqual((x["consumer_price"], x["seller_price"], x["quantity"], x["tax_revenue"], x["deadweight_loss"]), (27, 22, 66, 330, 15))

    def test_zero_tax(self):
        x = taxed_market(0)
        self.assertEqual((x["consumer_price"], x["seller_price"], x["quantity"], x["deadweight_loss"]), (24, 24, 72, 0))

    def test_tax_accounting_and_market_residuals(self):
        for tax in [0, 0.1, 1, 5, 10, 20, 40, 59]:
            with self.subTest(tax=tax):
                x = taxed_market(tax)
                self.assertAlmostEqual(x["consumer_price"] - x["seller_price"], tax)
                self.assertAlmostEqual(120 - 2*x["consumer_price"], x["quantity"])
                self.assertAlmostEqual(3*x["seller_price"], x["quantity"])
                self.assertAlmostEqual(x["after_total_including_tax"] + x["deadweight_loss"], 2160)

    def test_alternative_stage_exercise(self):
        self.assertEqual(equilibrium(a=100, d=2), {"price": 25, "quantity": 50})
        x = taxed_market(10, a=100, d=2)
        self.assertEqual((x["consumer_price"], x["seller_price"], x["quantity"], x["tax_revenue"], x["deadweight_loss"]), (30, 20, 40, 400, 50))

    def test_negative_supply_intercept(self):
        x = taxed_market(10, c=-12)
        self.assertAlmostEqual(120-2*x["consumer_price"], -12+3*x["seller_price"])
        self.assertAlmostEqual(x["baseline_total_surplus"], x["after_total_including_tax"]+x["deadweight_loss"])

    def test_ceiling_binding(self):
        x = price_control("ceiling", 20)
        self.assertTrue(x["binding"])
        self.assertEqual((x["demand"], x["supply"], x["shortage"], x["transaction_upper_bound"]), (80, 60, 20, 60))

    def test_floor_binding(self):
        x = price_control("floor", 30)
        self.assertTrue(x["binding"])
        self.assertEqual((x["demand"], x["supply"], x["surplus"], x["transaction_upper_bound"]), (60, 90, 30, 60))

    def test_nonbinding_controls_and_exact_boundary(self):
        for kind, price in [("ceiling", 30), ("ceiling", 24), ("floor", 20), ("floor", 24)]:
            x = price_control(kind, price)
            self.assertFalse(x["binding"])
            self.assertEqual((x["price"], x["demand"], x["supply"]), (24, 72, 72))

    def test_no_trade_control(self):
        self.assertEqual(price_control("floor", 70)["transaction_upper_bound"], 0)
        self.assertEqual(price_control("ceiling", 0)["transaction_upper_bound"], 0)

    def test_invalid_parameters_and_no_interior(self):
        for kwargs in [{"b": 0}, {"d": -1}, {"a": 0}, {"c": 1}, {"a": math.nan}, {"b": math.inf}, {"a": True}, {"c": -180}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                equilibrium(**kwargs)

    def test_tax_rejects_unsupported_regimes(self):
        for value in [-1, 60, 100, math.inf, math.nan, True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                taxed_market(value)

    def test_control_rejects_invalid_values(self):
        for kind, price in [("unknown", 20), ("floor", -1), ("ceiling", math.nan)]:
            with self.assertRaises(ValueError):
                price_control(kind, price)

    def test_arc_elasticity(self):
        self.assertAlmostEqual(midpoint_elasticity(20, 80, 30, 60), -5/7)
        self.assertAlmostEqual(midpoint_elasticity(30, 60, 20, 80), -5/7)
        self.assertAlmostEqual(midpoint_elasticity(25, 50, 30, 40), -11/9)

    def test_elasticity_invalid_inputs(self):
        for args in [(20, 0, 30, 60), (20, 80, 20, 60), (math.nan, 80, 30, 60), (20, 80, math.inf, 60)]:
            with self.assertRaises(ValueError):
                midpoint_elasticity(*args)

    def test_intro_demand_boundaries(self):
        self.assertEqual([demand(p) for p in [0, 24, 60, 70]], [120, 72, 0, 0])


class FileAndProgramChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="verify-temp-", dir=COURSE)
        cls.root = Path(cls.temp.name).resolve()
        if cls.root.parent != COURSE.resolve():
            raise RuntimeError("Temporary path outside course")
        cls.copy = cls.root / "examples"
        shutil.copytree(EXAMPLES, cls.copy, ignore=shutil.ignore_patterns("__pycache__", "output", ".venv"))

    @classmethod
    def tearDownClass(cls):
        if cls.root.parent != COURSE.resolve():
            raise RuntimeError("Unsafe temporary cleanup path")
        cls.temp.cleanup()

    def run_program(self, name, args=(), input_text=None, expected_status=0, cwd=None):
        command = [sys.executable, str(self.copy / name), *args]
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(command, input=input_text, capture_output=True, text=True, encoding="utf-8", cwd=cwd or self.root, env=env, timeout=15)
        RUNS.append({"program": name, "args": list(args), "input": input_text, "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        if expected_status == 0:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def test_fixed_entrypoints(self):
        known = {
            "hello.py": "2 + 3 = 5",
            "budget.py": "Food share: 40.0%",
            "demand_table.py": "Sum across hypothetical scenarios: 420",
            "functions.py": "Revenue: 1728",
            "basket.py": "Basket index: 122.00",
            "debug_demo.py": "Four demand checks passed.",
            "elasticity.py": "Signed midpoint elasticity: -0.714286",
        }
        for name, expected in known.items():
            with self.subTest(name=name):
                self.assertIn(expected, self.run_program(name).stdout)

    def test_interactive_decision_cases(self):
        cases = [("1000\n800\n", "Balance: 200.00"), ("800\n1000\n", "Shortfall: 200.00"),
                 ("1000\n1000\n", "Balance: 0.00"), ("-1\n100\n", "must be non-negative"),
                 ("abc\n", "Please enter a number"), ("nan\n100\n", "finite numbers"), ("inf\n100\n", "finite numbers")]
        for input_text, message in cases:
            with self.subTest(input=input_text):
                self.assertIn(message, self.run_program("decision.py", input_text=input_text).stdout)

    def test_csv_run_from_different_working_directory(self):
        self.run_program("csv_io.py", cwd=COURSE)
        target = self.copy / "output" / "demand-results.csv"
        with target.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual([float(row["quantity"]) for row in rows], [80, 72, 60])

    def test_bad_csv_cases(self):
        cases = ["wrong,price\na,20\n", "scenario,price\na,abc\n", "scenario,price\na,-1\n",
                 "scenario,price\na,nan\n", "scenario,price\na,inf\n", "scenario,price\na\n",
                 "scenario,price\na,20,extra\n", "scenario,price\n", "scenario,price\n,20\n"]
        for index, content in enumerate(cases):
            target = self.root / f"bad-{index}.csv"
            target.write_text(content, encoding="utf-8")
            with self.subTest(index=index), self.assertRaises(ValueError):
                read_prices(target)

    def test_utf8_bom_csv(self):
        target = self.root / "bom.csv"
        target.write_text("scenario,price\n测试,24\n", encoding="utf-8-sig")
        self.assertEqual(read_prices(target), [{"scenario": "测试", "price": 24}])

    def test_market_cli_default(self):
        report = json.loads(self.run_program("market_lab.py").stdout)
        self.assertEqual(report["baseline"], {"price": 24, "quantity": 72})
        self.assertEqual(report["tax_scenario"]["tax_revenue"], 600)
        self.assertEqual(report["ceiling_scenario"]["shortage"], 20)

    def test_market_cli_nonbinding(self):
        report = json.loads(self.run_program("market_lab.py", ["--tax", "5", "--ceiling", "30", "--floor", "20"]).stdout)
        self.assertEqual(report["tax_scenario"]["quantity"], 66)
        self.assertFalse(report["ceiling_scenario"]["binding"])
        self.assertFalse(report["floor_scenario"]["binding"])

    def test_market_cli_bad_inputs(self):
        for args in [["--tax", "-1"], ["--tax", "60"], ["--tax", "nan"], ["--ceiling", "-1"], ["--floor", "inf"]]:
            with self.subTest(args=args):
                result = self.run_program("market_lab.py", args, expected_status=2)
                self.assertIn("error:", result.stderr)

    def test_complete_in_chapter_exercises(self):
        specs = [
            ("06-变量数值字符串与输入.md", "text = input", "1000\n", "Income: 1000.00"),
            ("13-需求供给与曲线移动.md", "prices =", None, "20 80 110 30"),
            ("第二阶段-练习与参考答案.md", "import math", "1200\n900\n", "Balance: 300.00"),
        ]
        for index, (file, start, stdin, expected) in enumerate(specs):
            blocks = re.findall(r"```python\n(.*?)```", (SOURCE / file).read_text(encoding="utf-8"), re.S)
            code = next(x for x in blocks if x.startswith(start))
            name = f"embedded-{index}.py"
            (self.copy / name).write_text(code, encoding="utf-8")
            with self.subTest(file=file):
                self.assertIn(expected, self.run_program(name, input_text=stdin).stdout)


if __name__ == "__main__":
    stream = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    files = sorted(EXAMPLES.rglob("*.py")) + sorted((EXAMPLES / "data").glob("*.csv"))
    report = {
        "verifiedDate": "2026-11-12", "timezone": "Asia/Shanghai",
        "python": sys.version, "platform": platform.platform(),
        "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
        "successful": result.wasSuccessful(), "subprocessRuns": len(RUNS),
        "testLog": stream.getvalue(), "runs": RUNS,
        "sourceHashes": {str(f.relative_to(SOURCE)).replace("\\", "/"): hashlib.sha256(f.read_bytes()).hexdigest() for f in files},
        "notValidated": ["fresh Python installation", "all Python versions", "browser UI", "full-site build", "macroeconomic models", "real market evidence"],
    }
    target = Path(__file__).with_name("example-results.json")
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["testsRun", "failures", "errors", "successful", "subprocessRuns"]}))
    if not result.wasSuccessful():
        print(stream.getvalue())
        raise SystemExit(1)
