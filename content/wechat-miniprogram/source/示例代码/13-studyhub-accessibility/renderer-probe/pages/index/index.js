Page({
  data:{rendererText:'未知',windowHeight:600,top:48,heading:'渲染器隔离实验',rows:Array.from({length:16},(_,i)=>({id:'row_'+i,title:'固定教学行 '+(i+1)}))},
  onLoad(){this.measure();},onResize(){this.measure();},
  measure(){let info={};try{if(typeof wx.getWindowInfo==='function')info=wx.getWindowInfo();}catch(_){}
    const height=Number.isFinite(info.windowHeight)&&info.windowHeight>0?info.windowHeight:600;
    const status=Number.isFinite(info.statusBarHeight)&&info.statusBarHeight>=0?info.statusBarHeight:24;
    let bottom=status+44;try{if(typeof wx.getMenuButtonBoundingClientRect==='function'){const r=wx.getMenuButtonBoundingClientRect();if(Number.isFinite(r.bottom)&&r.bottom>status&&r.bottom<height)bottom=r.bottom+8;}}catch(_){}
    const top=Math.min(Math.max(0,height-1),Math.max(48,bottom));
    this.setData({rendererText:['webview','skyline'].includes(this.renderer)?this.renderer:'未知',windowHeight:height,top});
  }
});
