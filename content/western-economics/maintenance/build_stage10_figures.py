"""Author two explanatory diagrams; project builds its own three numeric figures."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path(__file__).resolve().parents[1] / "source/images"
plt.rcParams.update({"font.family": "Microsoft YaHei", "svg.fonttype": "path", "svg.hashsalt": "western-stage10"})

def diagram(name, title, boxes, footer):
    fig, ax = plt.subplots(figsize=(10, 4.1), layout="constrained")
    ax.set(xlim=(0, 10), ylim=(0, 4)); ax.axis("off")
    ax.text(5, 3.65, title, ha="center", fontsize=18, weight="bold")
    for i, (heading, body) in enumerate(boxes):
        x = .25 + i*3.3
        ax.text(x+1.45, 2.1, heading+"\n\n"+body, ha="center", va="center", fontsize=12,
                bbox={"boxstyle": "round,pad=.8", "facecolor": "#e9f2f5", "edgecolor": "#367284"})
        if i < 2: ax.annotate("", xy=(x+3.15, 2.1), xytext=(x+2.85, 2.1), arrowprops={"arrowstyle": "->", "lw": 2})
    ax.text(5, .4, footer, ha="center", va="center", fontsize=11, color="#444444")
    fig.savefig(OUT/(name+".svg"), metadata={"Date": None})
    fig.savefig(OUT/(name+".png"), dpi=150)
    plt.close(fig)

diagram("stage10-objects", "从数值数组到带含义的表格，再到图", [
    ("NumPy 数组", "相同类型的数\nshape 检查行列\n逐元素运算"),
    ("pandas 表格", "列名、行和单位\n清理前后留账\n明确缺失值"),
    ("Matplotlib 图", "Figure 包含 Axes\n横纵轴与图例\n保存可核对结果")], "对象不同，职责不同；能画图不代表数据口径或模型假设正确。")
diagram("stage10-reproduce", "复现检查：验证证据链，而非只看一张图", [
    ("冻结输入", "数据与字典\n源码、配置与版本\nSHA-256"),
    ("新目录重跑", "复制必要文件\n更换工作目录\n两个空输出目录"),
    ("比较与解释", "表、图、JSON 散列\n手算与残差\n限制与读者复盘")], "本课已验证同一环境重跑；新安装、跨平台和因果识别须分别提供证据。")
