"""Author-only static figures; no additional learner dependencies."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT=Path(__file__).resolve().parents[1]/"source"/"images"
plt.rcParams.update({"font.family":"Microsoft YaHei","font.size":11,"svg.fonttype":"path"})
BLUE,RED,GREEN,AMBER="#2166ac","#b84343","#25856a","#c98a18"

def style(ax):
    ax.spines[["top","right"]].set_visible(False)
    ax.grid(alpha=.15);ax.set_axisbelow(True)

def save(fig,name):
    fig.savefig(OUT/(name+".svg"));fig.savefig(OUT/(name+".png"),dpi=140);plt.close(fig)

fig,ax=plt.subplots(figsize=(9,5.8),layout="constrained")
y=np.linspace(400,1100,200)
ax.plot(y,y,color="#67737d",label="45度线：支出=Y")
ax.plot(y,320+.6*y,color=BLUE,label="计划支出AE=320+0.6Y")
ax.scatter([600,800,1000],[680,800,920],color=RED,zorder=5)
ax.plot([600,600],[600,680],color=RED,linestyle="--")
ax.plot([1000,1000],[920,1000],color=RED,linestyle="--")
ax.annotate("均衡(800,800)",(800,800),xytext=(830,710),arrowprops={"arrowstyle":"->"})
ax.text(490,710,"Y600：意外存货−80",color=RED)
ax.text(840,1035,"Y1000：意外存货+80",color=RED)
ax.set(xlim=(400,1100),ylim=(400,1130),xlabel="产出Y（固定教学价格/期）",ylabel="计划或实际支出（同单位/期）",title="固定利率0：计划实现时，AE与45度线相交")
ax.legend(loc="upper left");style(ax);save(fig,"stage7-cross")

fig,axes=plt.subplots(1,2,figsize=(10.5,5.7),layout="constrained")
ax=axes[0];n=np.arange(8);feedback=20*.6**n
ax.bar(n,feedback,color=BLUE,label="该轮诱发支出")
ax.plot(n,np.cumsum(feedback),"o-",color=GREEN,label="前若干轮累计")
ax.axhline(50,color=RED,linestyle="--",label="无限和50")
ax.set(xlabel="数学反馈轮次（非日历时期）",ylabel="新增教学支出",ylim=(0,58),title="G增加20：20+12+7.2+…=50")
ax.legend(loc="center right",fontsize=9);style(ax)
ax=axes[1];bars=ax.bar([0,1,2,3],[50,-37.5,12.5,40],color=[BLUE,RED,GREEN,AMBER]);ax.bar_label(bars,padding=4)
ax.axhline(0,color="#67737d",linewidth=1)
ax.set(xticks=[0,1,2,3],xticklabels=["G+20","t0+20","G与t0\n各+20","m=.1时\nG+20"],ylim=(-50,65),ylabel="相对各自基准的ΔY",title="固定利率；最后一列以开放情景为基准")
style(ax);save(fig,"stage7-multiplier")

fig,axes=plt.subplots(1,2,figsize=(11,5.7),layout="constrained")
x=np.arange(5);labels=["初始","贷款60","跨行支付40","还本10","提款20"]
ax=axes[0];ax.bar(x,[160,220,220,210,190],color=BLUE,label="公众存款D")
ax.bar(x,[0,0,0,0,20],bottom=[160,220,220,210,190],color=AMBER,label="公众现金")
for pos,value in zip(x,[160,220,220,210,210]): ax.text(pos,value+5,str(value),ha="center")
ax.set(xticks=x,xticklabels=labels,ylim=(0,275),ylabel="时点教学金额",title="现金+存款：贷款增加、还本减少")
ax.tick_params(axis="x",rotation=20);ax.legend(loc="upper left",fontsize=9);style(ax)
ax=axes[1];ax.plot(x,[200,200,200,200,200],"o-",color=GREEN,label="准备金+现金（基础货币）")
ax.plot(x,[0,60,60,50,50],"s--",color=RED,label="贷款余额")
ax.set(xticks=x,xticklabels=labels,ylim=(-10,260),ylabel="时点教学金额",title="跨行支付重分准备金，提款改变形态")
ax.tick_params(axis="x",rotation=20);ax.legend(loc="upper left",fontsize=9);style(ax);save(fig,"stage7-banking")

fig,ax=plt.subplots(figsize=(9,5.7),layout="constrained")
i=np.linspace(0,.14,200)
ax.plot(560-4000*i,i*100,color=BLUE,label="Y700时L=560−4000i")
ax.axvline(400,color=RED,label="实际供给400")
ax.axvline(500,color=GREEN,linestyle="--",label="实际供给500")
ax.scatter([400,500],[4,1.5],color="#1d2630",zorder=5)
ax.annotate("4%",(400,4),xytext=(330,5.5),arrowprops={"arrowstyle":"->"})
ax.annotate("1.5%",(500,1.5),xytext=(510,3.8),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(0,610),ylim=(0,15),xlabel="实际货币余额（存量）",ylabel="名义利率i（%）",title="给定Y700：增加实际货币供给降低均衡利率")
ax.legend(loc="upper right");style(ax);save(fig,"stage7-money")

fig,ax=plt.subplots(figsize=(9,5.7),layout="constrained")
y=np.linspace(600,800,100);ax.plot(y,(.32-.0004*y)*100,color=BLUE,label="IS：0.4Y+1000i=320")
y=np.linspace(500,900,100);ax.plot(y,(.0002*y-.1)*100,color=GREEN,label="LM：0.8Y−4000i=400")
ax.scatter([700],[4],color=RED,zorder=5)
ax.plot([500,700],[4,4],"--",color="#8b969e",linewidth=1)
ax.plot([700,700],[0,4],"--",color="#8b969e",linewidth=1)
ax.annotate("共同均衡Y700、i4%",(700,4),xytext=(730,6.5),arrowprops={"arrowstyle":"->"})
ax.set(xlim=(500,910),ylim=(0,9),xlabel="产出Y（固定教学价格/期）",ylabel="利率i（%）",title="在有效区间内同时满足两个市场，而非拼接两个点")
ax.legend(loc="upper left");style(ax);save(fig,"stage7-is-lm")

fig,ax=plt.subplots(figsize=(9.5,6),layout="constrained")
for a,color,label in [(320,BLUE,"IS基准"),(340,RED,"IS：G增加20")]:
    y=np.linspace((a-80)/.4,a/.4,100);ax.plot(y,(a-.4*y)/1000*100,color=color,label=label)
for money,color,label,ls in [(400,GREEN,"LM：Ms400","-"),(440,AMBER,"LM配合：Ms440","--")]:
    y=np.linspace(money/.8,(money+320)/.8,100);ax.plot(y,(.8*y-money)/4000*100,color=color,linestyle=ls,label=label)
ax.scatter([700,733.333333,750],[4,4.666667,4],color="#1d2630",zorder=5)
for xy,text,position in [((700,4),"基准700、4%",(560,2.7)),((733.333333,4.666667),"仅G：733.33、4.67%",(755,6.1)),((750,4),"配合：750、4%",(790,2.3))]:
    ax.annotate(text,xy,xytext=position,arrowprops={"arrowstyle":"->"},fontsize=10,bbox={"facecolor":"white","edgecolor":"none","pad":2})
ax.set(xlim=(530,950),ylim=(0,9.2),xlabel="产出Y（固定教学价格/期）",ylabel="利率i（%）",title="同一财政冲击：固定货币与维持利率的结果不同")
ax.legend(loc="upper right",fontsize=9);style(ax);save(fig,"stage7-policy")

fig,ax=plt.subplots(figsize=(10,6),layout="constrained")
for a,color,label in [(320,BLUE,"IS基准A320"),(370,RED,"IS：G增加50，A370")]:
    y=np.linspace((a-80)/.4,a/.4,100);ax.plot(y,(a-.4*y)/1000*100,color=color,label=label)
y=np.linspace(600,1050,250)
ax.plot(y,np.maximum(0,(.8*y-700)/4000)*100,color=GREEN,label="分段LM：Ms700，下限0")
ax.plot(y,np.maximum(0,(.8*y-800)/4000)*100,color=AMBER,linestyle="--",label="Ms800：水平区间延长")
ax.scatter([800,908.333333],[0,.666667],color="#1d2630",zorder=5)
ax.annotate("Ms700或800：Y800、i0\n额外持币分别60或160",(800,0),xytext=(620,2.4),arrowprops={"arrowstyle":"->"},fontsize=10)
ax.annotate("G+50退出下限\nY908.33、i0.667%",(908.333333,.666667),xytext=(920,3.1),arrowprops={"arrowstyle":"->"},fontsize=10)
ax.set(xlim=(600,1050),ylim=(-.5,8.5),xlabel="产出Y（固定教学价格/期）",ylabel="利率i（%）",title="显式分段：下限处允许额外流动性持有")
ax.legend(loc="upper right",fontsize=9);style(ax);save(fig,"stage7-floor")
