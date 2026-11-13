"""Independent hand answers, invalid data, artifacts and clean-copy reproduction."""
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
EXAMPLES = SOURCE / "示例代码/stage10"
REFERENCE = SOURCE / "最终实践参考结果"
sys.path.insert(0, str(EXAMPLES))
import numpy as np
import pandas as pd
from lab import clean_households, descriptive, fit_ols, sampling_demo, bootstrap_mean, analyze, parameters, sha256
RUNS = []
NESTED_RUNS = 0


class DataChecks(unittest.TestCase):
    def altered(self, transform):
        with tempfile.TemporaryDirectory(prefix="stage10-data-temp-", dir=COURSE) as temporary:
            target = Path(temporary) / "sample.csv"
            raw = pd.read_csv(EXAMPLES / "data/households_raw.csv", dtype=str, keep_default_na=False)
            transform(raw).to_csv(target, index=False)
            return clean_households(target)

    def test_cleaning_ledger_and_known_rows(self):
        f, audit = clean_households()
        self.assertEqual(audit, {"raw_rows": 10, "exact_duplicates_removed": 1, "missing_rows_removed": 1,
                                 "missing_ids": ["H09"], "clean_rows": 8})
        self.assertEqual(f["id"].tolist(), [f"H{i:02d}" for i in range(1, 9)])
        self.assertEqual(f["income"].tolist(), [20, 30, 40, 50, 40, 50, 60, 70])
        self.assertEqual(f["consumption"].tolist(), [15, 15, 17, 21, 25, 25, 27, 31])

    def test_whitespace_and_blank_missing_are_explicit(self):
        def change(f):
            f.loc[f["id"] == "H09", "income"] = " "
            f["id"] = " " + f["id"] + " "
            return f
        self.assertEqual(self.altered(change)[1]["missing_ids"], ["H09"])

    def test_conflicting_ids_refused(self):
        def change(f):
            f.loc[8, "consumption"] = "999"
            return f
        with self.assertRaisesRegex(ValueError, "conflicting"):
            self.altered(change)

    def test_bad_numeric_not_treated_as_missing(self):
        for value in ["typo", "NaN", "inf", "-inf"]:
            def change(f):
                f.loc[0, "income"] = value
                return f
            with self.assertRaises(ValueError): self.altered(change)

    def test_observed_invalid_domain_not_hidden_by_missing(self):
        for column, value in [("income", "0"), ("consumption", "-1"), ("background", "2"), ("background", ".5")]:
            def change(f):
                f.loc[f["id"] == "H09", column] = value
                return f
            with self.assertRaises(ValueError): self.altered(change)

    def test_schema_and_invalid_ids_refused(self):
        with self.assertRaises(ValueError): self.altered(lambda f: f.rename(columns={"income": "money"}))
        def change(f):
            f.loc[0, "id"] = "someone"
            return f
        with self.assertRaises(ValueError): self.altered(change)

    def test_insufficient_complete_rows_refused(self):
        with self.assertRaises(ValueError): self.altered(lambda f: f.iloc[:2])


class StatisticsChecks(unittest.TestCase):
    def setUp(self): self.frame, _ = clean_households()

    def test_independent_descriptive_answers(self):
        r = descriptive(self.frame["consumption"])
        self.assertEqual((r["n"], r["mean"], r["median"], r["min"], r["max"]), (8, 22, 23, 15, 31))
        self.assertAlmostEqual(r["sample_variance"], 248/7)
        self.assertAlmostEqual(r["mean_se_iid"], math.sqrt(31/7))
        self.assertAlmostEqual(descriptive(self.frame["income"])["sample_variance"], 1800/7)

    def test_ddof_and_invalid_descriptive_inputs(self):
        self.assertEqual(descriptive([1, 3])["sample_variance"], 2)
        for values in [[], [1], [1, math.nan], [[1, 2], [3, 4]]]:
            with self.assertRaises(ValueError): descriptive(values)

    def test_pooled_hand_sums_and_known_ols(self):
        r = fit_ols(self.frame)
        self.assertAlmostEqual(r["coefficients"]["income"], 600/1800)
        self.assertAlmostEqual(r["coefficients"]["intercept"], 7)
        self.assertAlmostEqual(r["sse"], 48)
        self.assertAlmostEqual(r["r_squared"], 25/31)
        self.assertAlmostEqual(r["correlation"], 600/math.sqrt(1800*248))
        self.assertAlmostEqual(r["rmse"], math.sqrt(6))
        self.assertAlmostEqual(r["residual_std"], math.sqrt(8))

    def test_controlled_known_construction_and_normal_equations(self):
        r = fit_ols(self.frame, ["income", "background"])
        for k, v in {"intercept": 10, "income": .2, "background": 6}.items():
            self.assertAlmostEqual(r["coefficients"][k], v)
        self.assertAlmostEqual(r["sse"], 8)
        self.assertAlmostEqual(r["r_squared"], 30/31)
        self.assertEqual(r["degrees_of_freedom"], 5)
        self.assertLess(r["normal_equation_max_abs"], 1e-8)
        self.assertAlmostEqual(r["residual_sum"], 0)

    def test_omitted_variable_formula_independent(self):
        # S_xz=40, S_xx=1800, so omitted-background term = 6*40/1800.
        self.assertAlmostEqual(fit_ols(self.frame)["coefficients"]["income"], .2+6*40/1800)

    def test_deleted_row_independent_fraction(self):
        r = fit_ols(self.frame.loc[self.frame["id"] != "H08"])
        self.assertAlmostEqual(r["coefficients"]["income"], 6/19)
        self.assertAlmostEqual(r["coefficients"]["intercept"], 145/19)
        self.assertAlmostEqual(r["sse"], 896/19)

    def test_other_line_and_constant_y(self):
        f = pd.DataFrame({"income": [1, 2, 3, 4], "consumption": [3, 5, 7, 9]})
        r = fit_ols(f)
        self.assertAlmostEqual(r["coefficients"]["intercept"], 1)
        self.assertAlmostEqual(r["coefficients"]["income"], 2)
        f["consumption"] = 7
        self.assertIsNone(fit_ols(f)["r_squared"])
        self.assertIsNone(fit_ols(f)["correlation"])

    def test_singular_and_invalid_regression_inputs(self):
        f = self.frame.copy(); f["income"] = 10
        with self.assertRaises(ValueError): fit_ols(f)
        for predictors in [[], ["income", "income"], ["unknown"]]:
            with self.assertRaises(ValueError): fit_ols(self.frame, predictors)
        with self.assertRaises(ValueError): fit_ols(self.frame.iloc[:3], ["income", "background"])
        f = self.frame.copy(); f.loc[0, "income"] = math.inf
        with self.assertRaises(ValueError): fit_ols(f)

    def test_population_sampling_theory_and_reproducibility(self):
        first = sampling_demo()
        self.assertEqual(first, sampling_demo())
        for n in [4, 64]:
            self.assertEqual(first[str(n)]["theoretical_mean"], 5)
            self.assertAlmostEqual(first[str(n)]["theoretical_variance"], 35/(3*n))
            self.assertTrue(all(0 <= v <= 10 for v in first[str(n)]["means"]))
        self.assertLess(first["64"]["variance_of_means"], first["4"]["variance_of_means"])

    def test_bootstrap_constant_and_valid_range(self):
        r = bootstrap_mean([7, 7, 7])
        self.assertEqual((r["percentile_025"], r["percentile_975"]), (7, 7))
        r = bootstrap_mean(self.frame["consumption"])
        self.assertLessEqual(15, r["percentile_025"])
        self.assertLessEqual(r["percentile_025"], r["percentile_975"])
        self.assertLessEqual(r["percentile_975"], 31)

    def test_parameter_domains(self):
        for args in [(-1, 2000, 10), (2**32-1, 2000, 10), (True, 2000, 10), (1, 0, 10), (1, 20100, 10), (1, 100, math.inf), (1, 100, 21)]:
            with self.assertRaises(ValueError): parameters(*args)

    def test_conditional_change_is_not_causal_and_support_flag(self):
        _, summary, _ = analyze(income_change=10)
        r = summary["conditional_fitted_change"]
        self.assertAlmostEqual(r["simple"], 10/3); self.assertAlmostEqual(r["controlled"], 2)
        self.assertFalse(r["causal"]); self.assertEqual(r["outside_income_support"], 1)
        _, other, _ = analyze(seed=7, replications=100, income_change=0)
        self.assertEqual(other["conditional_fitted_change"]["outside_income_support"], 0)
        self.assertEqual(other["simple"], summary["simple"])


class DeliveryChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = tempfile.TemporaryDirectory(prefix="stage10-verify-temp-", dir=COURSE)
        cls.temp = Path(cls.context.name).resolve()
        if cls.temp.parent != COURSE.resolve(): raise RuntimeError("unsafe temporary parent")
        cls.project = cls.temp / "project"
        cls.project.mkdir()
        for file in EXAMPLES.glob("*.py"): shutil.copy2(file, cls.project / file.name)
        shutil.copy2(EXAMPLES / "requirements.txt", cls.project / "requirements.txt")
        shutil.copytree(EXAMPLES / "data", cls.project / "data")
        cls.env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8", "MPLCONFIGDIR": str(cls.temp / "mpl")}

    @classmethod
    def tearDownClass(cls): cls.context.cleanup()

    def run_program(self, name, args=(), expected=0):
        result = subprocess.run([sys.executable, "-B", str(self.project / name), *map(str, args)],
                                cwd=self.temp, env=self.env, capture_output=True, text=True, encoding="utf-8", timeout=60)
        RUNS.append({"program": name, "args": [str(a) for a in args], "exitCode": result.returncode,
                     "stdout": result.stdout, "stderr": result.stderr})
        self.assertEqual(result.returncode, expected, result.stderr)
        return result

    def test_chapter_57_and_58_entrypoints(self):
        self.assertIn("68.0", self.run_program("arrays_tables.py").stdout)
        r = json.loads(self.run_program("statistics_demo.py").stdout)
        self.assertEqual(r["audit"]["clean_rows"], 8)

    def test_report_from_clean_copy_matches_reference_artifacts(self):
        output = self.temp / "base"
        r = self.run_program("report_project.py", ["--output", output])
        self.assertEqual(json.loads(r.stdout)["outputs"], 10)
        ref = json.loads((REFERENCE / "run-manifest.json").read_text(encoding="utf-8"))
        for name, expected in ref["outputs"].items(): self.assertEqual(sha256(output / name), expected)
        self.assertEqual(sha256(output / "run-manifest.json"), sha256(REFERENCE / "run-manifest.json"))
        before = sha256(output / "summary.json")
        self.run_program("report_project.py", ["--output", output], expected=2)
        self.assertEqual(sha256(output / "summary.json"), before)

    def test_alternative_parameters_change_owned_fields(self):
        output = self.temp / "alternative"
        self.run_program("report_project.py", ["--output", output, "--income-change", -10, "--seed", 7, "--replications", 100])
        r = json.loads((output / "summary.json").read_text(encoding="utf-8"))
        self.assertAlmostEqual(r["conditional_fitted_change"]["controlled"], -2)
        self.assertAlmostEqual(r["simple"]["coefficients"]["income"], 1/3)
        self.assertEqual(r["parameters"]["replications"], 100)

    def test_invalid_cli_writes_no_output_and_help(self):
        for index, args in enumerate([["--seed", -1], ["--seed", "nan"], ["--replications", 0], ["--replications", 20001], ["--income-change", "nan"], ["--income-change", 21]]):
            output = self.temp / f"invalid{index}"
            self.run_program("report_project.py", ["--output", output, *args], expected=2)
            self.assertFalse(output.exists())
        self.assertIn("Synthetic", self.run_program("report_project.py", ["--help"]).stdout)

    def test_two_run_clean_copy_reproduction(self):
        global NESTED_RUNS
        output = self.temp / "reproduction"
        r = self.run_program("reproduce.py", ["--output", output])
        self.assertEqual(json.loads(r.stdout)["matchingArtifacts"], 11)
        record = json.loads((output / "reproduction.json").read_text(encoding="utf-8"))
        self.assertTrue(record["successful"])
        NESTED_RUNS += len(record["runs"])
        self.run_program("reproduce.py", ["--output", output], expected=2)

    def test_frozen_old_content_and_reference_manifest(self):
        baseline = json.loads((COURSE / "maintenance/stages1-9-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(len(baseline), 127)
        for name, expected in baseline.items(): self.assertEqual(sha256(COURSE / name), expected)
        manifest = json.loads((REFERENCE / "run-manifest.json").read_text(encoding="utf-8"))
        for name, expected in manifest["inputs"].items(): self.assertEqual(sha256(EXAMPLES / name), expected)
        for name, expected in manifest["outputs"].items(): self.assertEqual(sha256(REFERENCE / name), expected)


def main():
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    import matplotlib
    assets = [p for p in EXAMPLES.rglob("*") if p.is_file() and p.suffix in [".py", ".csv", ".json", ".txt"]]
    report = {"verifiedDate": "2026-11-13", "timezone": "Asia/Shanghai", "stage": 10, "chapters": [57, 60],
              "python": sys.version, "platform": platform.platform(), "versions": {"numpy": np.__version__, "pandas": pd.__version__, "matplotlib": matplotlib.__version__},
              "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors), "successful": result.wasSuccessful(),
              "directSubprocessRuns": len(RUNS), "nestedSubprocessRuns": NESTED_RUNS, "subprocessRuns": len(RUNS)+NESTED_RUNS,
              "preservedPriorFiles": 127, "testLog": stream.getvalue(), "runs": RUNS,
              "sourceHashes": {p.relative_to(SOURCE).as_posix(): sha256(p) for p in sorted(assets)},
              "referenceHashes": {p.relative_to(SOURCE).as_posix(): sha256(p) for p in sorted(REFERENCE.iterdir()) if p.is_file()},
              "scope": "Existing Anaconda environment; no fresh pip installation, site build or cross-platform byte identity claim"}
    (Path(__file__).parent / "stage10-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(stream.getvalue())
    print(json.dumps({k: report[k] for k in ["successful", "testsRun", "failures", "errors", "subprocessRuns", "directSubprocessRuns", "nestedSubprocessRuns", "preservedPriorFiles"]}))
    return 0 if result.wasSuccessful() else 1

if __name__ == "__main__": raise SystemExit(main())
