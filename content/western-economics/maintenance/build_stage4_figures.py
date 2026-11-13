"""Static authoring plots for chapters 19-26; not a learner dependency."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parents[1] / "source" / "images"
OUT.mkdir(exist_ok=True)
plt.rcParams.update({"font.family": "Microsoft YaHei", "font.size": 11, "svg.fonttype": "path"})
BLUE, RED, GREEN, AMBER = "#2166ac", "#b84343", "#25856a", "#c98a18"


def decorate(ax, title, xlabel, ylabel):
    ax.set(title=title, xlabel=xlabel, ylabel=ylabel)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(alpha=.15)


def save(fig, name):
    fig.savefig(OUT / (name + ".svg"))
    fig.savefig(OUT / (name + ".png"), dpi=140)
    plt.close(fig)


fig, ax = plt.subplots(figsize=(8.4, 5.5), layout="constrained")
x = np.linspace(.2, 22, 500)
ax.plot([0,20], [40,0], color=BLUE, label="预算线：y = 40 - 2x")
for u, style, color in [(10, "--", "#8c98a1"), (np.sqrt(200), "-", GREEN), (18,"--", AMBER)]:
    ax.plot(x, u*u/x, color=color, linestyle=style, label=f"无差异曲线 U = {u:.2f}")
ax.scatter([10], [20], color="#18222b", zorder=5)
ax.annotate("最优 (10, 20)", (10,20), xytext=(13,27), arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,22), ylim=(0,45))
decorate(ax,"预算、偏好与可行最优", "商品 x（份）", "商品 y（份）")
ax.legend(loc="upper right", frameon=False, fontsize=10)
save(fig,"stage4-budget")

fig, ax = plt.subplots(figsize=(8.4, 5.5), layout="constrained")
ax.plot([0,20], [40,0], color=BLUE, label="原预算：6x + 3y = 120")
ax.plot([0,30], [30,0], color=AMBER, linestyle="--", label="补偿预算：3x + 3y = 90")
ax.plot([0,40], [40,0], color=GREEN, label="新预算：3x + 3y = 120")
for name, point, label in [("A",(10,20),(2,27)),("B",(15,15),(16,7)),("C",(20,20),(25,25))]:
    ax.scatter([point[0]], [point[1]], color="#18222b", zorder=5)
    ax.annotate(f"{name} {point}", point, xytext=label, arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,42), ylim=(0,45))
decorate(ax,"斯勒茨基分解：原组合可买，不要求效用不变", "商品 x（份）", "商品 y（份）")
ax.legend(loc="upper right", frameon=False, fontsize=10)
save(fig,"stage4-effects")

fig, axes = plt.subplots(1,2,figsize=(11,4.8),layout="constrained")
labor=np.arange(9)
outputs=np.array([0,12,28,42,52,60,66,70,72])
axes[0].plot(labor,outputs,marker="o",color=BLUE)
decorate(axes[0],"总产量仍然增加", "劳动 L（同等工时人数）", "总产量（份/日）")
axes[1].plot(labor[1:], outputs[1:]/labor[1:],marker="o",color=GREEN,label="平均产量 AP")
axes[1].plot(labor[1:], np.diff(outputs),marker="s",color=RED,label="离散边际产量 MP")
decorate(axes[1],"边际量可先升后降", "劳动 L（同等工时人数）", "每劳动单位产量")
axes[1].legend(frameon=False)
save(fig,"stage4-production")

fig, ax = plt.subplots(figsize=(8.4,5.5),layout="constrained")
q=np.linspace(.75,20,400)
for values,color,label in [(100/q,"#8c98a1","AFC = 100/q"),(4+q,GREEN,"AVC = 4 + q"),(100/q+4+q,BLUE,"ATC = 100/q + 4 + q"),(4+2*q,RED,"MC = 4 + 2q")]:
    ax.plot(q,values,color=color,label=label)
ax.scatter([10],[24],color="#18222b",zorder=5)
ax.annotate("最低 ATC：q=10，成本24",(10,24),xytext=(7,48),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,20),ylim=(0,70))
decorate(ax,"平均与边际成本：q=0时平均量未定义", "产量 q（件/日）", "平均/边际成本（元/件）")
ax.legend(loc="upper right",frameon=False,fontsize=10)
save(fig,"stage4-costs")

fig, ax = plt.subplots(figsize=(8.4,5.5),layout="constrained")
l=np.linspace(1,30,500)
ax.plot(l,36/l,color=BLUE,label="目标产出12：K = 36/L")
ax.plot([0,24],[6,0],color=GREEN,label="最低等成本线：3L + 12K = 72")
ax.plot([0,30],[10,2.5],color=AMBER,linestyle="--",label="较高成本线：3L + 12K = 120")
ax.scatter([4,12],[9,3],color="#18222b",zorder=5)
ax.annotate("原组合 (L=4,K=9)",(4,9),xytext=(8,11),arrowprops={"arrowstyle":"->"})
ax.annotate("成本最低 (L=12,K=3)",(12,3),xytext=(15,4.5),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,30),ylim=(0,15))
decorate(ax,"长期：保持产出，比较投入成本", "劳动 L（同一期间单位）", "资本服务 K（同一期间单位）")
ax.legend(loc="upper right",frameon=False,fontsize=9)
save(fig,"stage4-isocost")

fig, ax = plt.subplots(figsize=(8.4,5.5),layout="constrained")
q=np.linspace(0,17,400)
for price,color in [(30,GREEN),(24,BLUE),(20,AMBER),(3,RED)]:
    ax.plot(q,(price-4)*q-q*q-100,color=color,label=f"P={price}")
    best=max(0,(price-4)/2)
    profit=(price-4)*best-best*best-100
    ax.scatter([best],[profit],color=color,zorder=5)
ax.axhline(0,color="#8c98a1",linewidth=1,linestyle="--")
ax.annotate("亏损最小：q=8，利润-36",(8,-36),xytext=(.6,25),arrowprops={"arrowstyle":"->"})
ax.annotate("P=3：停产仍亏100",(0,-100),xytext=(3,-145),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(-.4,17),ylim=(-180,100))
decorate(ax,"利润最大化包含亏损最小化", "产量 q（件/日）", "经济利润（元/日）")
ax.legend(loc="upper right",frameon=True,facecolor="white",framealpha=1,edgecolor="none")
save(fig,"stage4-competition")

fig, axes = plt.subplots(1,2,figsize=(11,5),layout="constrained")
l=np.linspace(0,10,200)
axes[0].plot(l,40-4*l,color=BLUE,label="MRPL = 40 - 4L")
axes[0].axhline(16,color=GREEN,label="工资 w=16")
axes[0].axhline(50,color=RED,linestyle="--",label="工资 w=50，最优L=0")
axes[0].scatter([6],[16],color="#18222b",zorder=5)
axes[0].annotate("(6,16)",(6,16),xytext=(6.5,27),arrowprops={"arrowstyle":"->"})
axes[0].set(xlim=(0,11),ylim=(0,58))
decorate(axes[0],"单个企业：其他投入固定", "用工 L（全职当量人数）", "工资/边际收益（元/人日）")
axes[0].legend(loc="upper right",frameon=True,facecolor="white",framealpha=1,edgecolor="none",fontsize=9)
l=np.linspace(0,100,200)
axes[1].plot(l,50-l/2,color=BLUE,label="市场劳动需求")
axes[1].plot(l[l>=20],(l[l>=20]-20)/2,color=RED,label="市场劳动供给")
axes[1].scatter([60],[20],color="#18222b",zorder=5)
axes[1].annotate("均衡 (60,20)",(60,20),xytext=(32,9),arrowprops={"arrowstyle":"->"})
axes[1].axhline(25,color=AMBER,linestyle="--",label="工资25：需求50、供给70")
axes[1].set(xlim=(0,105),ylim=(0,55))
decorate(axes[1],"另一个独立市场模型", "市场劳动单位", "工资（对应单位）")
axes[1].legend(loc="upper right",frameon=False,fontsize=9)
save(fig,"stage4-labor")
print("Created seven stage-4 SVG/PNG figure sets")
