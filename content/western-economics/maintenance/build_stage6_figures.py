"""Author-only figures; learners use the standard-library examples."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT=Path(__file__).resolve().parents[1]/"source"/"images"
plt.rcParams.update({"font.family":"Microsoft YaHei","font.size":11,"svg.fonttype":"path"})
BLUE,RED,GREEN,AMBER="#2166ac","#b84343","#25856a","#c98a18"

def finish(fig,name):
    fig.savefig(OUT/(name+".svg"))
    fig.savefig(OUT/(name+".png"),dpi=140)
    plt.close(fig)

def style(ax):
    ax.spines[["top","right"]].set_visible(False)
    ax.grid(axis="y",alpha=.15)
    ax.set_axisbelow(True)

fig,ax=plt.subplots(figsize=(9,5.5),layout="constrained")
x=np.arange(3)
for dx,values,label,color in [(-.25,[100,160,250],"总产出",BLUE),(0,[0,100,160],"中间投入",AMBER),(.25,[100,60,90],"增加值",GREEN)]:
    bars=ax.bar(x+dx,values,.25,label=label,color=color)
    ax.bar_label(bars,padding=3)
ax.set(xticks=x,xticklabels=["农场","面粉厂","面包店"],ylim=(0,300),ylabel="同一时期的教学金额",title="只加增加值：100+60+90=250；总产出相加510会重复")
ax.legend(ncol=3,loc="upper left");style(ax);finish(fig,"stage6-value-added")

fig,axes=plt.subplots(1,2,figsize=(10,5.5),layout="constrained")
ax=axes[0]
for dx,values,label,color in [(-.18,[1000,1500],"名义GDP",BLUE),(.18,[1000,1200],"基期价格的实际GDP",GREEN)]:
    bars=ax.bar(np.arange(2)+dx,values,.36,label=label,color=color);ax.bar_label(bars,padding=3)
ax.set(xticks=[0,1],xticklabels=["基期","现期"],ylim=(0,1850),ylabel="教学金额",title="数量按基期价格计算增长20%")
ax.legend(loc="upper left",fontsize=9);style(ax)
ax=axes[1];bars=ax.bar([0,1],[100,125],color=[AMBER,RED],width=.5);ax.bar_label(bars,padding=3)
ax.set(xticks=[0,1],xticklabels=["基期","现期"],ylim=(0,155),ylabel="平减指数（基期=100）",title="现期1500÷1200×100=125");style(ax)
fig.suptitle("名义增长50% = (1+实际增长20%)×(1+价格增长25%)−1")
finish(fig,"stage6-price-volume")

fig,ax=plt.subplots(figsize=(9,5.5),layout="constrained")
bars=ax.bar([0,1,2],[135,108,125],color=[BLUE,GREEN,AMBER],width=.5);ax.bar_label(bars,padding=5)
ax.axhline(100,color="#63727d",linestyle="--",label="各自基期=100")
ax.set(xticks=[0,1,2],xticklabels=["教学消费篮子\n基期支出权重","教学生产者篮子\n另一组商品","教学GDP平减指数\n现期产出结构"],ylim=(0,165),ylabel="各自的价格指数",title="范围与权重不同：本例排序不是普遍规律")
ax.legend();style(ax);finish(fig,"stage6-price-indexes")

fig,axes=plt.subplots(1,2,figsize=(11,5.7),layout="constrained")
ax=axes[0];bottom=np.zeros(3)
for values,label,color in [([600,600,620],"就业E",BLUE),([60,40,40],"失业U",RED),([340,360,340],"非劳动力N",AMBER)]:
    bars=ax.bar(np.arange(3),values,bottom=bottom,color=color,label=label,width=.55)
    ax.bar_label(bars,label_type="center",fontsize=10);bottom+=np.array(values)
ax.set(xticks=[0,1,2],xticklabels=["基准","停止求职","找到工作"],ylim=(0,1170),ylabel="调查范围人数（总计1000）",title="失业减少20人的两条路径")
ax.legend(ncol=3,loc="upper left",fontsize=9);style(ax)
ax=axes[1]
for dx,values,label,color in [(-.22,[60/660*100,40/640*100,40/660*100],"失业率 U/L",RED),(0,[66,64,66],"参与率 L/P",GREEN),(.22,[60,60,62],"就业人口比 E/P",BLUE)]:
    bars=ax.bar(np.arange(3)+dx,values,.22,label=label,color=color)
    ax.bar_label(bars,fmt="%.2f",padding=3,fontsize=8)
ax.set(xticks=[0,1,2],xticklabels=["基准","停止求职","找到工作"],ylim=(0,85),ylabel="百分比（%）",title="失业率下降不等于就业增加")
ax.legend(loc="upper left",fontsize=9);style(ax);finish(fig,"stage6-labour")

fig,axes=plt.subplots(1,2,figsize=(10,5.7),layout="constrained")
ax=axes[0];bottom=0
for value,label,color in [(600,"C 居民消费600",BLUE),(180,"G 政府消费180",GREEN),(200,"I 总资本形成200",AMBER),(20,"NX 净出口20",RED)]:
    ax.bar(0,value,bottom=bottom,label=label,color=color,width=.5);bottom+=value
ax.set(xticks=[0],xticklabels=["GDP = 1000"],ylim=(0,1100),xlim=(-1,1),ylabel="同一时期教学金额",title="G只含政府消费；I含公共投资")
ax.legend(loc="upper left",bbox_to_anchor=(-.02,-.08),fontsize=9);style(ax)
ax=axes[1]
for x,value,bottom,label,color in [(0,180,0,"私人储蓄180",BLUE),(0,40,180,"政府储蓄40",GREEN),(1,200,0,"投资200",AMBER),(1,20,200,"净出口20",RED)]:
    ax.bar(x,value,bottom=bottom,color=color,label=label,width=.5)
    ax.text(x,bottom+value/2,str(value),ha="center",va="center",color="white",fontsize=10)
ax.set(xticks=[0,1],xticklabels=["Sp+Sg=220","I+NX=220"],ylim=(0,260),ylabel="同一时期教学金额",title="境外两项净收入合计为0时：S=I+NX")
ax.legend(loc="upper left",bbox_to_anchor=(-.02,-.08),fontsize=9,ncol=2);style(ax);finish(fig,"stage6-balances")

fig,ax=plt.subplots(figsize=(10,5.7),layout="constrained")
values=np.array([100,110,105,125,108,118.8,113.4,135,112.32,123.552,117.936,140.4])
adjusted=values/(np.tile([1,1.1,1.05,1.25],3)/1.1)
ax.plot(range(12),values,"o-",color=BLUE,label="未调整的虚构季度数据")
ax.plot(range(12),adjusted,"s--",color=GREEN,label="除以已知、均值为1的季节因子")
ax.annotate("2024Q1\n原始环比−13.6%\n调整后环比8%",(4,108),xytext=(4.7,91),arrowprops={"arrowstyle":"->"},fontsize=10)
ax.set(xticks=range(12),xticklabels=[f"{y}Q{q}" for y in [2023,2024,2025] for q in [1,2,3,4]],ylim=(85,150),ylabel="固定教学价格的季度量",title="纯教学季调：因子事先已知，不是官方估计程序")
ax.tick_params(axis="x",rotation=45);ax.legend(loc="upper left");style(ax);finish(fig,"stage6-seasonal")

fig,ax=plt.subplots(figsize=(9,5.5),layout="constrained")
bars=ax.bar([0,1,2],[8,(109/101-1)*100,9],color=[BLUE,GREEN,RED],width=.5)
ax.bar_label(bars,fmt="%.6f%%",padding=5)
ax.set(xticks=[0,1,2],xticklabels=["初版108/100−1","修订版109/101−1","错误混版109/100−1"],ylim=(0,11),ylabel="同比增长率（%）",title="比较基数也会修订：虚构版本，勿拼接旧值与新值")
style(ax);finish(fig,"stage6-vintages")
