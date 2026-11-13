"""Self-contained synthetic data/report lab. No real survey or causal estimate."""
from pathlib import Path
import hashlib
import json
import math
import platform
import sys
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
COLUMNS = ["id", "income", "consumption", "background"]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def integer(value, name, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, np.integer)) or not low <= value <= high:
        raise ValueError(f"{name} must be an integer in [{low},{high}]")
    return int(value)


def parameters(seed, replications, income_change):
    seed = integer(seed, "seed", 0, 2**32 - 2)
    replications = integer(replications, "replications", 100, 20000)
    if isinstance(income_change, bool) or not math.isfinite(float(income_change)) or abs(income_change) > 20:
        raise ValueError("income_change must be finite and between -20 and 20")
    return seed, replications, float(income_change)


def defaults():
    return json.loads((DATA / "config.json").read_text(encoding="utf-8"))


def clean_households(path=DATA / "households_raw.csv"):
    try:
        raw = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except pd.errors.EmptyDataError as exc:
        raise ValueError("empty CSV") from exc
    if list(raw.columns) != COLUMNS or raw.empty:
        raise ValueError("expected id,income,consumption,background and nonempty rows")
    for col in COLUMNS:
        raw[col] = raw[col].str.strip()
    if not raw["id"].str.fullmatch(r"H\d{2}").all():
        raise ValueError("IDs must use H followed by two digits")
    frame = raw.drop_duplicates().copy()
    duplicate_count = len(raw) - len(frame)
    if frame["id"].duplicated().any():
        raise ValueError("conflicting duplicate IDs; inspect source, do not average")
    for col in COLUMNS[1:]:
        frame[col] = pd.to_numeric(frame[col].replace({"": np.nan, "NA": np.nan}), errors="raise")
        nonmissing = frame[col].dropna().to_numpy(dtype=float)
        if not np.isfinite(nonmissing).all():
            raise ValueError("nonfinite numeric value: " + col)
    missing = frame[COLUMNS[1:]].isna().any(axis=1)
    missing_ids = sorted(frame.loc[missing, "id"].tolist())
    # Domain violations in observed values are errors, even if another field is missing.
    if (frame["income"].dropna() <= 0).any() or (frame["consumption"].dropna() < 0).any():
        raise ValueError("income must be positive and consumption nonnegative")
    if not frame["background"].dropna().isin([0, 1]).all():
        raise ValueError("background must be 0 or 1")
    frame = frame.loc[~missing].sort_values("id").reset_index(drop=True)
    if len(frame) < 4:
        raise ValueError("at least four complete rows required")
    frame["background"] = frame["background"].astype(int)
    audit = {"raw_rows": len(raw), "exact_duplicates_removed": duplicate_count,
             "missing_rows_removed": len(missing_ids), "missing_ids": missing_ids, "clean_rows": len(frame)}
    return frame, audit


def descriptive(values):
    a = np.asarray(values, dtype=float)
    if a.ndim != 1 or a.size < 2 or not np.isfinite(a).all():
        raise ValueError("at least two finite one-dimensional observations required")
    return {"n": int(a.size), "mean": float(a.mean()), "median": float(np.median(a)),
            "sample_variance": float(a.var(ddof=1)), "sample_std": float(a.std(ddof=1)),
            "min": float(a.min()), "max": float(a.max()), "mean_se_iid": float(a.std(ddof=1)/math.sqrt(a.size))}


def fit_ols(frame, predictors=("income",)):
    predictors = tuple(predictors)
    if not predictors or len(set(predictors)) != len(predictors) or not set(predictors) <= {"income", "background"}:
        raise ValueError("unique supported predictors required")
    x = frame[list(predictors)].to_numpy(dtype=float)
    y = frame["consumption"].to_numpy(dtype=float)
    design = np.column_stack([np.ones(len(y)), x])
    if len(y) <= design.shape[1] or not np.isfinite(design).all() or not np.isfinite(y).all():
        raise ValueError("finite data and n greater than parameter count required")
    beta, _, rank, _ = np.linalg.lstsq(design, y, rcond=None)
    if rank != design.shape[1]:
        raise ValueError("rank-deficient design: coefficients not uniquely identified")
    fitted = design @ beta
    residual = y - fitted
    sse = float(residual @ residual)
    sst = float((y-y.mean()) @ (y-y.mean()))
    p = design.shape[1]
    correlation = None
    if len(predictors) == 1 and np.ptp(x[:, 0]) > 0 and np.ptp(y) > 0:
        correlation = float(np.corrcoef(x[:, 0], y)[0, 1])
    return {"predictors": list(predictors), "coefficients": dict(zip(["intercept", *predictors], map(float, beta))),
            "n": len(y), "parameters": p, "degrees_of_freedom": len(y)-p, "sse": sse,
            "r_squared": 1-sse/sst if sst > 0 else None, "correlation": correlation,
            "rmse": math.sqrt(sse/len(y)), "residual_std": math.sqrt(sse/(len(y)-p)),
            "fitted": fitted.tolist(), "residuals": residual.tolist(),
            "residual_sum": float(residual.sum()), "normal_equation_max_abs": float(np.abs(design.T @ residual).max())}


def sampling_demo(seed=20261113, replications=2000):
    seed, replications, _ = parameters(seed, replications, 0)
    rng = np.random.default_rng(seed)
    population = np.arange(0, 12, 2, dtype=float)
    result = {}
    for n in [4, 64]:
        means = rng.choice(population, size=(replications, n), replace=True).mean(axis=1)
        result[str(n)] = {"mean_of_means": float(means.mean()), "variance_of_means": float(means.var(ddof=1)),
                          "theoretical_mean": 5.0, "theoretical_variance": float(population.var(ddof=0)/n),
                          "means": means.tolist()}
    return result


def bootstrap_mean(values, seed=20261114, replications=2000):
    seed, replications, _ = parameters(seed, replications, 0)
    a = np.asarray(values, dtype=float)
    descriptive(a)
    rng = np.random.default_rng(seed)
    means = rng.choice(a, size=(replications, len(a)), replace=True).mean(axis=1)
    interval = np.quantile(means, [.025, .975], method="linear")
    return {"method": "iid empirical-distribution bootstrap demonstration; not a real survey CI",
            "mean": float(a.mean()), "percentile_025": float(interval[0]), "percentile_975": float(interval[1]),
            "seed": seed, "replications": replications}


def analyze(seed=20261113, replications=2000, income_change=10):
    seed, replications, income_change = parameters(seed, replications, income_change)
    frame, audit = clean_households()
    simple = fit_ols(frame)
    controlled = fit_ols(frame, ("income", "background"))
    without_h08 = fit_ols(frame.loc[frame["id"] != "H08"])
    sampling = sampling_demo(seed, replications)
    change = frame["income"].to_numpy() + income_change
    outside = ((change < frame["income"].min()) | (change > frame["income"].max())).sum()
    summary = {"version": "1.0", "origin": "synthetic_teaching_data", "audit": audit,
               "parameters": {"seed": seed, "replications": replications, "income_change": income_change},
               "income": descriptive(frame["income"]), "consumption": descriptive(frame["consumption"]),
               "simple": simple, "controlled": controlled, "without_H08": without_h08,
               "conditional_fitted_change": {"income_change": income_change,
                   "simple": simple["coefficients"]["income"]*income_change,
                   "controlled": controlled["coefficients"]["income"]*income_change,
                   "outside_income_support": int(outside), "causal": False},
               "sampling": {k: {a:b for a,b in v.items() if a != "means"} for k,v in sampling.items()},
               "bootstrap": bootstrap_mean(frame["consumption"], seed+1, replications)}
    return frame, summary, sampling


def plot_results(output, frame, summary, sampling):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "DejaVu Sans", "svg.hashsalt": "western-economics-stage10", "font.size": 11})

    def save(fig, name):
        fig.savefig(output / (name+".svg"), metadata={"Date": None})
        fig.savefig(output / (name+".png"), dpi=150, metadata={"Software": "western-economics-v1.0"})
        plt.close(fig)

    fig, ax = plt.subplots(figsize=(7.6, 4.8), layout="constrained")
    for group, marker in [(0, "o"), (1, "s")]:
        part = frame.loc[frame["background"] == group]
        ax.scatter(part["income"], part["consumption"], marker=marker, s=65, label=f"Background {group}")
    grid = np.linspace(frame["income"].min(), frame["income"].max(), 100)
    b = summary["simple"]["coefficients"]
    ax.plot(grid, b["intercept"]+b["income"]*grid, color="black", label="Pooled OLS")
    b = summary["controlled"]["coefficients"]
    for group, style in [(0, "--"), (1, ":")]:
        ax.plot(grid, b["intercept"]+b["income"]*grid+b["background"]*group, style, label=f"Controlled, background {group}")
    ax.set(xlabel="Income (teaching currency / period)", ylabel="Consumption (teaching currency / period)", title="Synthetic cross-section: fits are not causal effects")
    ax.legend(fontsize=9)
    save(fig, "regression")

    fig, axes = plt.subplots(1, 2, figsize=(9, 4), sharex=True, sharey=True, layout="constrained")
    for ax, n in zip(axes, [4, 64]):
        ax.hist(sampling[str(n)]["means"], bins=np.linspace(0, 10, 31), density=True, color="#3b82a0", alpha=.85)
        ax.axvline(5, color="black", linestyle="--")
        ax.set(title=f"IID replacement sample, n={n}", xlabel="Sample mean (teaching units)", xlim=(0, 10))
    axes[0].set_ylabel("Density (per teaching unit)")
    save(fig, "sampling")

    fig, ax = plt.subplots(figsize=(7.6, 4.6), layout="constrained")
    names = ["Pooled", "With background", "Without H08"]
    values = [summary[k]["coefficients"]["income"] for k in ["simple", "controlled", "without_H08"]]
    ax.bar(names, values, color=["#3b82a0", "#4d9970", "#b47a45"])
    ax.axhline(.2, color="black", linestyle="--", label="Designed within-background slope 0.2")
    ax.set(ylim=(0, max(values)*1.28), ylabel="Fitted income slope (currency / currency)", title="Synthetic sensitivity: specification and one-row removal")
    ax.legend(fontsize=9)
    save(fig, "sensitivity")


def build_project(output, seed=20261113, replications=2000, income_change=10):
    # Validate and analyze before creating any output directory.
    frame, summary, sampling = analyze(seed, replications, income_change)
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    frame.to_csv(output / "clean.csv", index=False, lineterminator="\n")
    coefficient_rows = [{"model": name, "term": term, "coefficient": value}
                        for name in ["simple", "controlled", "without_H08"]
                        for term, value in summary[name]["coefficients"].items()]
    pd.DataFrame(coefficient_rows).to_csv(output / "coefficients.csv", index=False, lineterminator="\n")
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, allow_nan=False, indent=2)+"\n", encoding="utf-8")
    plot_results(output, frame, summary, sampling)
    a, b, c = [summary[k]["coefficients"]["income"] for k in ["simple", "controlled", "without_H08"]]
    change = summary["conditional_fitted_change"]
    report = f"""# 最终实践参考报告：收入与消费的拟合为何改变

## 问题与证据范围

同一组虚构横截面中，收入—消费斜率为何随背景控制而变化？本报告使用synthetic_households_v1，共一期、无真实地域或住户；收入与消费均为教学币/期。数据不是概率抽样，结论不外推真实总体，也不把横截面斜率称作宏观边际消费倾向。

## 数据与处理

原始10行先删除1行精确重复H03，再删除收入缺失的H09，保留8行，按ID排序。缺失未填0或均值；同一ID冲突、无穷、非数字与域错误拒绝。数据由10+.2income+6background+已知噪声构造，background非随机政策。输入和程序SHA-256、版本、参数见run-manifest.json；数据字典随原程序data/metadata.json提供。

## 方法与独立演算

带截距最小二乘最小化残差平方和，比较简单式、加入background及删H08后的简单式。手算income均值45、consumption均值22，Sxx1800、Sxy600，故简单斜率600/1800=1/3，截距22−45/3=7。设计噪声与收入和背景正交，控制式应恢复10、.2、6；这来自数据构造，不代表现实控制变量即可消除偏差。

## 结果、敏感性与图表

简单斜率{a:.6f}，控制后{b:.6f}，删H08后{c:.6f}。简单/控制SSE分别{summary['simple']['sse']:.6f}/{summary['controlled']['sse']:.6f}；R²分别{summary['simple']['r_squared']:.6f}/{summary['controlled']['r_squared']:.6f}。普通方程最大残差分别{summary['simple']['normal_equation_max_abs']:.3g}/{summary['controlled']['normal_equation_max_abs']:.3g}，反映数值求解检查，不是因果检验。

![虚构数据、分组与两种拟合](regression.svg)

![有放回抽样的均值分布](sampling.svg)

![模型规格与删行敏感性](sensitivity.svg)

在各拟合式中让收入统一改变{change['income_change']:.2f}、其余保持不变，预测消费改变量为{change['simple']:.6f}和{change['controlled']:.6f}。有{change['outside_income_support']}行超出原收入区间。这是条件代入和外推提示，不是识别出的税制改革效应。不能将两条斜率直接代入宏观乘数预测。

## 不确定性与限制

固定种子{summary['parameters']['seed']}、{summary['parameters']['replications']}次重复，有限人口抽样演示独立同分布有放回时均值方差随n下降；bootstrap区间仅是对8行经验分布的iid重抽样演示，不是真实调查置信区间。增加样本量不能消除覆盖偏差、遗漏因素或制度变化。

构造样本让我们知道机制；真实资料未必记录全部混杂因素。横截面收入可能内生，测量也可能出错；拟合、删除一行或提高R²不能独立证明因果。本项目未进行工具变量、实验或动态宏观估计。

## 复现与读者任务

在stage10目录执行python report_project.py --output my-results/base；目标目录必须尚不存在。再执行python reproduce.py --output my-results/reproduction，从新临时副本、不同cwd运行两次比较输出散列。实际维护者结果见课程验证记录。此参考报告由完整程序生成，不代替读者自己的参数比较、解释和毕业验收。
"""
    (output / "report.md").write_text(report, encoding="utf-8")
    import matplotlib
    versions = {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__, "matplotlib": matplotlib.__version__}
    inputs = [*sorted(DATA.glob("*")), *sorted(HERE.glob("*.py")), HERE / "requirements.txt"]
    manifest = {"version": "1.0", "origin": "synthetic_teaching_data", "versions": versions,
                "parameters": summary["parameters"], "inputs": {p.relative_to(HERE).as_posix(): sha256(p) for p in inputs},
                "outputs": {p.name: sha256(p) for p in sorted(output.iterdir()) if p.is_file()}}
    (output / "run-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    return manifest
