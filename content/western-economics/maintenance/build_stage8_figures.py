"""Author-only static figures, with the same transparent teaching equations."""
from pathlib import Path
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"source/示例代码/stage8"))
from policy_models import ad_as,inflation_path,propagation_path,fiscal_budget,rule_equilibrium,debt_path,debt_step
OUT=ROOT/"source/images"
plt.rcParams.update({"font.family":"Microsoft YaHei","font.size":11,"svg.fonttype":"path"})
BLUE,RED,GREEN,AMBER="#2166ac","#b84343","#25856a","#c98a18"

def style(ax):
    ax.spines[["top","right"]].set_visible(False);ax.grid(alpha=.15);ax.set_axisbelow(True)

def save(fig,name):
    fig.savefig(OUT/(name+".svg"));fig.savefig(OUT/(name+".png"),dpi=140);plt.close(fig)

fig,axes=plt.subplots(1,2,figsize=(11,5.7),layout="constrained")
y=np.linspace(650,800,300)
for ax in axes:
    ax.plot(y,100/(.6*y-320),color=BLUE,label="AD基准")
    ax.plot(y,y/700,color=GREEN,label="AS基准，Pe1")
    ax.scatter([700],[1],color="#1d2630",zorder=5)
    ax.set(xlim=(650,800),ylim=(.9,1.25),xlabel="实际产出Y（教学单位/期）",ylabel="价格水平P（基准=1）")
    style(ax)
axes[0].plot(y,100/(.6*y-340),color=RED,label="AD：A增加20")
r=ad_as(a=340);axes[0].scatter([r["output"]],[r["price"]],color=RED,zorder=5)
axes[0].annotate("727.12，1.03874",(r["output"],r["price"]),xytext=(711,1.17),arrowprops={"arrowstyle":"->"},fontsize=9)
axes[0].set_title("需求增加：产出与价格均上升")
axes[1].plot(y,y/700+.1,color=AMBER,label="AS：成本截距+.1")
r=ad_as(cost=.1);axes[1].scatter([r["output"]],[r["price"]],color=AMBER,zorder=5)
axes[1].annotate("687.37，1.08196",(r["output"],r["price"]),xytext=(708,1.17),arrowprops={"arrowstyle":"->"},fontsize=9)
axes[1].set_title("成本增加：价格上升、产出下降")
for ax in axes: ax.legend(loc="lower left",fontsize=9)
save(fig,"stage8-ad-as")

fig,ax=plt.subplots(figsize=(9,5.5),layout="constrained")
for weight,color,label in [(1,BLUE,"适应预期ω1"),(0,GREEN,"固定预期ω0（人为约定）")]:
    rows=inflation_path(weight=weight);ax.plot([r["period"] for r in rows],[100*r["inflation"] for r in rows],"o-",color=color,label=label)
ax.set(xticks=[1,2,3,4],ylim=(1.8,4.5),xlabel="教学期",ylabel="通胀率（%）",title="外部规定u始终4%、un5%：预期规则改变通胀路径")
ax.legend(loc="upper left");style(ax);save(fig,"stage8-expectations")

fig,ax=plt.subplots(figsize=(9.5,5.5),layout="constrained")
for a,b,color,label in [(.6,0,BLUE,"一阶a.6"),(.9,0,RED,"一阶a.9"),(1.2,-.5,GREEN,"二阶a1.2、b−.5")]:
    rows=propagation_path(rho=a,lag2=b);ax.plot([r["period"] for r in rows],[100*r["output_gap"] for r in rows],"o-",color=color,label=label)
ax.axhline(0,color="#68737d",linewidth=1)
ax.set(xticks=range(1,13),ylim=(-2.8,.8),xlabel="教学期（非实际季度）",ylabel="产出缺口（%）",title="同一次−2%冲击：持久性与延迟反应决定传播")
ax.legend(loc="lower right");style(ax);save(fig,"stage8-cycles")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.7),layout="constrained")
rows=[fiscal_budget(),fiscal_budget(output=630)];x=np.arange(2)
ax=axes[0]
for dx,values,color,label in [(-.25,[r["gross_taxes"] for r in rows],BLUE,"税收"),(0,[190,204],GREEN,"非利息支出"),(.25,[218,232],AMBER,"含利息总支出")]:
    bars=ax.bar(x+dx,values,.25,color=color,label=label);ax.bar_label(bars,fmt="%.1f",padding=3,fontsize=9)
ax.set(xticks=x,xticklabels=["Y700","Y630"],ylim=(0,290),ylabel="年度现价教学金额",title="支出包含G、J、转移；总额另加利息")
ax.legend(loc="upper left",fontsize=9);style(ax)
ax=axes[1]
for dx,key,color,label in [(-.16,"primary_balance",BLUE,"初级余额"),(.16,"overall_balance",RED,"总余额")]:
    bars=ax.bar(x+dx,[r[key] for r in rows],.32,color=color,label=label);ax.bar_label(bars,fmt="%.1f",padding=4)
ax.axhline(0,color="#68737d",linewidth=1)
ax.set(xticks=x,xticklabels=["Y700","Y630"],ylim=(-45,40),ylabel="盈余为正，赤字为负",title="相同规则随产出自动变化")
ax.legend(loc="upper right",fontsize=9);style(ax);save(fig,"stage8-fiscal")

fig,axes=plt.subplots(1,3,figsize=(12,5.5),layout="constrained")
labels=["基准","需求","成本","政策","下限"]
rows=[rule_equilibrium(),rule_equilibrium(demand=.02),rule_equilibrium(shock=.01),rule_equilibrium(policy_shock=.01),rule_equilibrium(demand=-.1)]
for ax,key,title,color,limits in [(axes[0],"output_gap","产出缺口",BLUE,(-7.5,2)),(axes[1],"inflation","通胀率",AMBER,(-2,4)),(axes[2],"interest","名义政策利率",GREEN,(-.8,7))]:
    bars=ax.bar(range(5),[r[key]*100 for r in rows],color=color);ax.bar_label(bars,fmt="%.2f",padding=4,fontsize=9)
    ax.axhline(0,color="#68737d",linewidth=1)
    ax.set(xticks=range(5),xticklabels=labels,ylim=limits,ylabel="%",title=title);style(ax)
fig.suptitle("独立三方程规则模型：每个冲击以自身含义单独改变")
save(fig,"stage8-rule")

fig,axes=plt.subplots(1,2,figsize=(11,5.7),layout="constrained")
ax=axes[0]
for dx,values,color,label in [(-.18,[560,580.72],BLUE,"名义债务"),(.18,[700,728],GREEN,"名义GDP")]:
    bars=ax.bar(np.arange(2)+dx,values,.36,color=color,label=label);ax.bar_label(bars,fmt="%.2f",padding=3,fontsize=9)
ax.set(xticks=[0,1],xticklabels=["初始","第1年"],ylim=(0,900),ylabel="年度现价教学金额",title="金额升高，比率80%→79.769%")
ax.legend(loc="upper left");style(ax)
ax=axes[1]
for inputs,color,label in [({},BLUE,"i5%、gN4%、pb1%"),({"interest":.08,"growth":.01,"primary_surplus":-.02},RED,"i8%、gN1%、pb−2%"),({"interest":.04,"growth":.04,"primary_surplus":0},GREEN,"i=gN、pb0")]:
    rows=debt_path(**inputs);ax.plot([r["year"] for r in rows],[100*r["debt_ratio"] for r in rows],"o-",color=color,label=label)
ax.set(xlabel="教学年",ylabel="总债务/当年GDP（%）",title="十年条件路径，不是真实预测")
ax.legend(loc="upper left",fontsize=9);style(ax);save(fig,"stage8-debt")

fig,ax=plt.subplots(figsize=(9,5.5),layout="constrained")
interest=[0,.02,.04,.06,.08];growth=[0,.02,.04,.06]
matrix=np.array([[debt_step(interest=i,growth=g)["stabilizing_primary_surplus"]*100 for g in growth] for i in interest])
bound=max(abs(matrix.min()),abs(matrix.max()))
heat=ax.imshow(matrix,cmap="RdBu_r",vmin=-bound,vmax=bound,aspect="auto")
for row in range(len(interest)):
    for col in range(len(growth)):
        ax.text(col,row,f"{matrix[row,col]:.2f}%",ha="center",va="center",color="white" if abs(matrix[row,col])>bound*.6 else "#17212b")
ax.set(xticks=range(4),xticklabels=["0%","2%","4%","6%"],yticks=range(5),yticklabels=["0%","2%","4%","6%","8%"],xlabel="名义GDP增长率gN",ylabel="名义有效利率i",title="初始债务率80%：当期稳定所需pb（sf0）")
fig.colorbar(heat,ax=ax,label="初级盈余 / 本期GDP（%）；非政策建议")
save(fig,"stage8-debt-sensitivity")
