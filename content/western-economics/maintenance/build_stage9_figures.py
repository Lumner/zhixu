"""Author-only plots for independent fictional open/growth examples."""
from pathlib import Path
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"source/images"
sys.path.insert(0,str(ROOT/"source/示例代码/stage9"))
from open_growth import mundell_fleming,growth_path,solow_path,solow_steady,golden_rule,growth_accounting,adjustment_comparison
plt.rcParams.update({"font.family":"Microsoft YaHei","font.size":11,"svg.fonttype":"path"})
BLUE,RED,GREEN,AMBER="#2166ac","#b84343","#25856a","#c98a18"

def style(ax):
    ax.spines[["top","right"]].set_visible(False);ax.grid(alpha=.15);ax.set_axisbelow(True)

def save(fig,name):
    fig.savefig(OUT/(name+".svg"));fig.savefig(OUT/(name+".png"),dpi=140);plt.close(fig)

fig,axes=plt.subplots(1,2,figsize=(10.5,5.6),layout="constrained")
ax=axes[0];bars=ax.bar([0,1],[7,7.7],color=[BLUE,RED],width=.5);ax.bar_label(bars,padding=4)
ax.set(xticks=[0,1],xticklabels=["初始","后来"],ylim=(0,9.5),ylabel="虚构报价D/F",title="e升10%：本币贬值；倒数价值降9.09%")
style(ax);ax=axes[1]
for dx,values,color,label in [(-.18,[140,154],BLUE,"外国篮子折本币eP*"),(.18,[140,154],GREEN,"本国篮子P")]:
    bars=ax.bar(np.arange(2)+dx,values,.36,color=color,label=label);ax.bar_label(bars,padding=3)
ax.set(xticks=[0,1],xticklabels=["初始q1","后来q仍1"],ylim=(0,195),ylabel="同类篮子的D币金额",title="国内篮子也涨10%：名义与实际变化不同")
ax.legend(loc="upper left",fontsize=9);style(ax);save(fig,"stage9-exchange")

fig,axes=plt.subplots(1,3,figsize=(12,5.7),layout="constrained")
rows=[mundell_fleming(fiscal_change=20),mundell_fleming(money=480),mundell_fleming("fixed",20),mundell_fleming("fixed",money=480)]
labels=["浮动财政","浮动货币","固定财政","固定尝试货币"]
for ax,values,title,ylabel,color,limits in [(axes[0],[r["output"]-700 for r in rows],"产出增量","教学产出/期",BLUE,(0,130)),(axes[1],[r["real_exchange_rate"] for r in rows],"实际汇率q","基准1；上升为贬值",GREEN,(0,1.9)),(axes[2],[r["equilibrium_money"]-400 for r in rows],"均衡货币增量","教学货币存量",AMBER,(0,110))]:
    bars=ax.bar(range(4),values,color=color);ax.bar_label(bars,fmt="%.2f",padding=4,fontsize=9)
    ax.set(xticks=range(4),xticklabels=labels,ylim=limits,ylabel=ylabel,title=title);ax.tick_params(axis="x",rotation=22);style(ax)
fig.suptitle("极端资本流动与固定价格：固定制度的尝试+80不成为额外独立控制量")
save(fig,"stage9-regimes")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.7),layout="constrained")
rows=growth_path(years=20);ax=axes[0]
for key,initial,color,label in [("output",1000,BLUE,"总量年增5%"),("population",100,GREEN,"人口年增2%"),("per_capita",10,RED,"人均年增2.941176%")]:
    ax.plot([r["year"] for r in rows],[r[key]/initial*100 for r in rows],color=color,label=label)
ax.set(xlabel="教学期",ylabel="各自初始=100",title="总量、人口、人均分别复利");ax.legend(loc="upper left",fontsize=9);style(ax)
ax=axes[1];t=np.arange(31)
ax.plot(t,100*1.01**t,color=GREEN,label="恒定人均1%")
ax.plot(t,100*1.03**t,color=BLUE,label="恒定人均3%")
ax.set(xlabel="教学期",ylabel="初始=100",title="长期小差异逐步放大，非真实国家预测");ax.legend(loc="upper left");style(ax);save(fig,"stage9-compound")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.7),layout="constrained")
ax=axes[0];k=np.linspace(0,10,300)
ax.plot(k,.2*np.sqrt(k),color=BLUE,label="投资s√k，s.2")
ax.plot(k,.1*k,color=RED,label="补平(δ+n)k，δ+n=.1")
ax.scatter([4],[.4],color="#19242c",zorder=5);ax.annotate("稳态k4",(4,.4),xytext=(5,.22),arrowprops={"arrowstyle":"->"})
ax.set(xlabel="每劳动资本k",ylabel="每劳动投资/期",title="技术固定1：正资本从两侧靠近稳态")
ax.legend(loc="upper left",fontsize=9);style(ax);ax=axes[1]
for initial,color in [(1,BLUE),(9,GREEN)]:
    path=solow_path(initial=initial,years=100);ax.plot([r["year"] for r in path],[r["capital_per_effective_worker"] for r in path],color=color,label=f"初始k{initial}")
ax.axhline(4,color=RED,linestyle="--",label="解析稳态4")
ax.set(xlabel="教学期",ylabel="每劳动资本k",title="有限步接近，不冒称精确抵达")
ax.legend(loc="upper right",fontsize=9);style(ax);save(fig,"stage9-solow")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.5),layout="constrained")
s=np.linspace(0,1,300);ax=axes[0];ax.plot(s,10*s,color=BLUE)
ax.set(xlabel="储蓄率s",ylabel="稳态每劳动产出",title="更高储蓄提高稳态产出");style(ax)
ax=axes[1];ax.plot(s,10*s*(1-s),color=GREEN)
ax.scatter([.5],[2.5],color=RED,zorder=5);ax.annotate("黄金规则s.5、c2.5",(.5,2.5),xytext=(.51,1.8),arrowprops={"arrowstyle":"->"},fontsize=10)
ax.scatter([.6],[2.4],color=AMBER,zorder=5)
ax.set(xlabel="储蓄率s",ylabel="稳态每劳动消费",ylim=(0,3),title="消费并非越高储蓄越多；不等于最优过渡")
style(ax);save(fig,"stage9-saving-consumption")

fig,axes=plt.subplots(1,2,figsize=(11,5.7),layout="constrained")
steady=solow_steady(technology_growth=.02)
rows=solow_path(initial=steady["capital_per_effective_worker"],years=20,technology_growth=.02)
ax=axes[0]
for key,color,label in [("capital_per_effective_worker",GREEN,"每有效劳动资本不变"),("output_per_worker",BLUE,"每劳动产出增2%"),("output",RED,"总产出增4.04%")]:
    ax.plot([r["year"] for r in rows],[r[key]/rows[0][key]*100 for r in rows],color=color,label=label)
ax.set(xlabel="教学期",ylabel="各自初始=100",title="从有效劳动稳态出发的平衡路径")
ax.legend(loc="upper left",fontsize=9);style(ax)
ax=axes[1];r=growth_accounting();values=[r[k]*100 for k in ["capital_log_contribution","labor_log_contribution","technology_log_contribution"]]
bars=ax.bar(range(3),values,color=[BLUE,GREEN,AMBER]);ax.bar_label(bars,fmt="%.6f",padding=4,fontsize=9)
ax.set(xticks=range(3),xticklabels=["资本","劳动","劳动增进技术"],ylim=(0,6.2),ylabel="100×对数贡献",title="对数合计6.745772；普通增长6.978503%")
style(ax);save(fig,"stage9-technology")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.7),layout="constrained")
rows=adjustment_comparison();labels=["固定价","部分调整","供给更陡","长期潜在"]
for ax,key,title,color,limits in [(axes[0],"output","相同需求变化：产出增量",BLUE,(0,43)),(axes[1],"price","相同需求变化：价格分担",AMBER,(0,1.5))]:
    values=[r[key]-700 if key=="output" else r[key] for r in rows]
    bars=ax.bar(range(4),values,color=color);ax.bar_label(bars,fmt="%.4f",padding=4,fontsize=9)
    ax.set(xticks=range(4),xticklabels=labels,ylim=limits,title=title,ylabel="ΔY（基准Y700）" if key=="output" else "价格水平P")
    style(ax)
fig.suptitle("仅比较价格调整假设，不给四行贴成四个完整学派")
save(fig,"stage9-comparison")
