"""Author-maintained static plots for chapters 27-32, not learner dependencies."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT=Path(__file__).resolve().parents[1]/"source"/"images"
OUT.mkdir(exist_ok=True)
plt.rcParams.update({"font.family":"Microsoft YaHei","font.size":11,"svg.fonttype":"path"})
BLUE,RED,GREEN,AMBER="#2166ac","#b84343","#25856a","#c98a18"


def canvas(title,xlabel,ylabel):
    fig,ax=plt.subplots(figsize=(8.6,5.6),layout="constrained")
    ax.set(title=title,xlabel=xlabel,ylabel=ylabel)
    ax.spines[["top","right"]].set_visible(False)
    ax.grid(alpha=.15)
    return fig,ax


def finish(fig,ax,name):
    ax.legend(loc="upper right",frameon=True,facecolor="white",framealpha=1,edgecolor="none",fontsize=9)
    fig.savefig(OUT/(name+".svg"))
    fig.savefig(OUT/(name+".png"),dpi=140)
    plt.close(fig)


fig,ax=canvas("统一定价垄断：MR决定数量，需求决定价格","数量 Q（件/日）","价格 / 边际收益成本（元/件）")
q=np.linspace(0,110,300)
ax.plot(q,60-.5*q,color=BLUE,label="需求 P=60-0.5Q")
ax.plot(q,60-q,color=RED,label="MR=60-Q")
ax.axhline(12,color=GREEN,label="MC=12")
lost=np.linspace(48,96,100)
ax.fill_between(lost,12,60-.5*lost,color=RED,alpha=.18,label="无谓损失576")
ax.plot([48,48],[0,36],color="#88939b",linestyle="--",linewidth=1)
ax.scatter([48,48,96],[36,12,12],color="#18222b",zorder=5)
ax.annotate("垄断 (48,36)",(48,36),xytext=(58,44),arrowprops={"arrowstyle":"->"})
ax.annotate("竞争数量96",(96,12),xytext=(77,4),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,110),ylim=(0,65))
finish(fig,ax,"stage5-monopoly")

fig,ax=canvas("古诺两家企业：互为最佳反应","企业1产量 q1（件/日）","企业2产量 q2（件/日）")
ax.plot([0,48],[96,0],color=BLUE,label="企业1反应：q1=48-0.5q2")
ax.plot([0,96],[48,0],color=RED,label="企业2反应：q2=48-0.5q1")
ax.scatter([32],[32],color="#18222b",zorder=5)
ax.annotate("纳什均衡 (32,32)",(32,32),xytext=(43,43),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,100),ylim=(0,100),aspect="equal")
finish(fig,ax,"stage5-cournot")

fig,ax=canvas("两人交换：双方改善与有效分配","A的商品 x（份），B有10-x","A的商品 y（份），B有10-y")
x=np.linspace(.1,9.9,500)
lower,upper=16/x,10-16/(10-x)
mask=upper>=lower
ax.fill_between(x[mask],lower[mask],upper[mask],color=GREEN,alpha=.18,label="双方不差于初始的区域")
ax.plot(x,lower,color=BLUE,label="A初始无差异曲线 U_A=4")
ax.plot(x,upper,color=RED,label="B初始无差异曲线 U_B=4")
ax.plot([0,10],[0,10],color="#88939b",linestyle="--",label="合同曲线 y_A=x_A")
ax.scatter([8,5,9],[2,5,9],color="#18222b",zorder=5)
ax.annotate("初始 (8,2)",(8,2),xytext=(6.4,.55),arrowprops={"arrowstyle":"->"})
ax.annotate("竞争分配 (5,5)",(5,5),xytext=(5.8,6.2),arrowprops={"arrowstyle":"->"})
ax.annotate("有效但不均等 (9,9)",(9,9),xytext=(5.3,9.6),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,10),ylim=(0,10),aspect="equal")
ax.legend(loc="upper left",frameon=True,facecolor="white",framealpha=1,edgecolor="none",fontsize=8)
fig.savefig(OUT/"stage5-exchange.svg");fig.savefig(OUT/"stage5-exchange.png",dpi=140);plt.close(fig)

fig,ax=canvas("外部损害：私人数量与社会最优","数量 Q（单位/日）","边际收益 / 成本（元/单位）")
q=np.linspace(0,78,300)
ax.plot(q,60-.5*q,color=BLUE,label="MB=60-0.5Q")
ax.plot(q,12+.25*q,color=GREEN,label="MPC=12+0.25Q")
ax.plot(q,12+.5*q,color=RED,label="MSC=12+0.5Q")
lost=np.linspace(48,64,100)
ax.fill_between(lost,60-.5*lost,12+.5*lost,color=RED,alpha=.18,label="无谓损失128")
ax.scatter([64,48,48],[28,36,24],color="#18222b",zorder=5)
ax.annotate("私人 (64,28)",(64,28),xytext=(62,16),arrowprops={"arrowstyle":"->"})
ax.annotate("社会最优 (48,36)",(48,36),xytext=(16,55),arrowprops={"arrowstyle":"->"})
ax.annotate("",(48,36),(48,24),arrowprops={"arrowstyle":"<->","color":AMBER})
ax.text(38,28,"税楔12",color=AMBER)
ax.set(xlim=(0,78),ylim=(0,65))
finish(fig,ax,"stage5-externality")

fig,ax=canvas("总减排12：低成本方多减，但不能超过容量","A减排 zA；B减排=12-zA","边际减排成本（元/单位）")
z=np.linspace(0,12,300)
ax.axvspan(0,2,color="#c9cdd1",alpha=.3,label="容量约束外的不可行区域")
ax.axvspan(10,12,color="#c9cdd1",alpha=.3)
ax.plot(z,2*z,color=BLUE,label="MAC_A=2zA")
ax.plot(z,6*(12-z),color=RED,label="MAC_B=6(12-zA)")
ax.scatter([9],[18],color="#18222b",zorder=5)
ax.annotate("最优 A9 / B3，成本108",(9,18),xytext=(4.5,52),arrowprops={"arrowstyle":"->"})
ax.text(2.8,60,"均分 A6 / B6 的总成本144")
ax.set(xlim=(0,12),ylim=(0,78))
finish(fig,ax,"stage5-abatement")

fig,ax=canvas("公共品：同一供给水平下纵向加总收益","公共品供给 g（单位/日）","边际收益 / 成本（元/单位）")
g=np.linspace(0,22,350)
mba,mbb=np.maximum(0,20-g),np.maximum(0,12-g)
ax.plot(g,mba,color=BLUE,label="A的MB=max(0,20-g)")
ax.plot(g,mbb,color=GREEN,label="B的MB=max(0,12-g)")
ax.plot(g,mba+mbb,color=RED,label="合计MB")
ax.axhline(16,color=AMBER,label="MC=16")
gain=np.linspace(4,8,100)
ax.fill_between(gain,16,32-2*gain,color=GREEN,alpha=.15,label="不足供给的净损失16")
ax.scatter([4,8],[16,16],color="#18222b",zorder=5)
ax.annotate("自愿供给4",(4,16),xytext=(.8,8),arrowprops={"arrowstyle":"->"})
ax.annotate("社会最优8",(8,16),xytext=(8.8,23),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,22),ylim=(0,36))
finish(fig,ax,"stage5-public-good")

fig,ax=canvas("固定保费下：保障比例怎样影响努力激励","保障比例与本模型的选择","私人预期成本（同一货币单位）")
positions=np.arange(3)
left=ax.bar(positions-.18,[30,15,0],width=.36,color=BLUE,label="不努力")
right=ax.bar(positions+.18,[14,9,4],width=.36,color=GREEN,label="努力")
ax.bar_label(left,padding=3);ax.bar_label(right,padding=3)
ax.set_xticks(positions,["h=0\n选择努力","h=0.5\n选择努力","h=1\n选择不努力"])
ax.set(ylim=(0,36))
finish(fig,ax,"stage5-information")
print("Created seven stage-5 SVG/PNG figure sets")
