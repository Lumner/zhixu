"""Author-maintained static economics plots, not a learner dependency."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parents[1] / "source" / "images"
OUT.mkdir(exist_ok=True)
plt.rcParams.update({"font.family": "Microsoft YaHei", "font.size": 11, "svg.fonttype": "path"})
BLUE, RED, GREEN, AMBER = "#2166ac", "#b84343", "#25856a", "#dc9b27"
q = np.linspace(0, 120, 301)
pd, ps = 60 - q / 2, q / 3


def canvas(title, ymax=65):
    fig, ax = plt.subplots(figsize=(8.4, 5.5), layout="constrained")
    ax.set(xlim=(0, 125), ylim=(0, ymax), xlabel="数量 Q（杯/日）", ylabel="价格 P（元/杯）", title=title)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(alpha=.15)
    return fig, ax


fig, ax = canvas("供求均衡与需求右移", 80)
ax.plot(q, pd, color=BLUE, label="原需求：P = 60 - Q/2")
ax.plot(q, 75 - q / 2, color=BLUE, linestyle="--", label="新需求：P = 75 - Q/2")
ax.plot(q, ps, color=RED, label="供给：P = Q/3")
ax.scatter([72, 90], [24, 30], color="#18222b", zorder=5)
ax.annotate("原均衡 (72, 24)", (72, 24), xytext=(44, 11), arrowprops={"arrowstyle": "->"})
ax.annotate("新均衡 (90, 30)", (90, 30), xytext=(92, 46), arrowprops={"arrowstyle": "->"})
ax.legend(loc="upper right", frameon=False)
fig.savefig(OUT / "market-shift.svg")
fig.savefig(OUT / "market-shift.png", dpi=140)
plt.close(fig)

fig, ax = canvas("无税竞争均衡：两类剩余")
x = np.linspace(0, 72, 200)
ax.fill_between(x, 24, 60-x/2, color=BLUE, alpha=.18, label="消费者剩余 CS = 1296")
ax.fill_between(x, x/3, 24, color=GREEN, alpha=.22, label="生产者剩余 PS = 864")
ax.plot(q, pd, color=BLUE, label="需求")
ax.plot(q, ps, color=RED, label="供给")
ax.plot([0, 72, 72], [24, 24, 0], color="#5d6872", linestyle="--", linewidth=1)
ax.scatter([72], [24], color="#18222b", zorder=5)
ax.annotate("均衡 (72, 24)", (72, 24), xytext=(78, 17), arrowprops={"arrowstyle": "->"})
ax.legend(loc="upper right", frameon=False)
fig.savefig(OUT / "market-surplus.svg")
fig.savefig(OUT / "market-surplus.png", dpi=140)
plt.close(fig)

fig, ax = canvas("每杯单位税10元：价格楔与福利分解")
x = np.linspace(0, 60, 200)
lost = np.linspace(60, 72, 100)
ax.fill_between(x, 30, 60-x/2, color=BLUE, alpha=.18, label="税后 CS = 900")
ax.fill_between(x, x/3, 20, color=GREEN, alpha=.22, label="税后 PS = 600")
ax.fill_between(x, 20, 30, color=AMBER, alpha=.25, label="税收 = 600")
ax.fill_between(lost, lost/3, 60-lost/2, color=RED, alpha=.3, label="无谓损失 = 60")
ax.plot(q, pd, color=BLUE, label="需求")
ax.plot(q, ps, color=RED, label="供给")
ax.plot([0, 60, 60], [30, 30, 0], color="#5d6872", linestyle="--", linewidth=1)
ax.plot([0, 60], [20, 20], color="#5d6872", linestyle="--", linewidth=1)
ax.annotate("买方价30", (60, 30), xytext=(76, 36), arrowprops={"arrowstyle": "->"})
ax.annotate("卖方价20", (60, 20), xytext=(78, 12), arrowprops={"arrowstyle": "->"})
ax.legend(loc="upper right", frameon=False, fontsize=9)
fig.savefig(OUT / "market-tax.svg")
fig.savefig(OUT / "market-tax.png", dpi=140)
plt.close(fig)
print("Created three SVG and three PNG economics plots")
