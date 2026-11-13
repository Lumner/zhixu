(function(){
  'use strict';
  const {escape:e,slug,createStore,search,route}=window.TutorialCore;
  const catalog=window.TUTORIAL_CATALOG,{site,courses}=catalog,app=document.getElementById('app');
  let storage;try{storage=window.localStorage;}catch(_){}
  const store=createStore(storage),ui={sort:'updated',resourceType:'exercise',sidebarTab:'chapters',current:null,token:0,searchRows:null,searchCursor:-1,searchResults:[]};
  const kindNames={chapter:'章节正文',guide:'课程导览',exercise:'练习答案',checklist:'验收清单',code:'源码附录',validation:'验证记录',project:'示例说明',reference:'参考资料',capstone:'综合实践'};
  const paths={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book:'<path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/><path d="M6 7h3m-3 4h3m6-4h3m-3 4h3"/>',
    code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    window:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01m3 0h.01M7 13h4m-4 3h7"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
    layers:'<path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
    tool:'<path d="m14 6 4 4m-4-4 1-4a7 7 0 0 1 7 8l-4 1-9 9a4 4 0 0 1-5-5l9-9Z"/><path d="m5 17 2 2"/>',
    path:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h7a5 5 0 0 1 0 10H9a4 4 0 0 0 0 8m-4-16v10m0 0 3-3m-3 3-3-3"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
    check:'<path d="m5 12 4 4L20 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    folder:'<path d="M3 6V4h6l3 3h9v13H3V6Z"/><path d="M7 12h10m-10 4h6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    leaf:'<path d="M5 20C2 9 8 3 21 3c0 14-7 19-16 17Zm0 0L16 9"/>',
    home:'<path d="m3 10 9-8 9 8v12H3V10Z"/><path d="M9 22v-8h6v8"/>',
    wrap:'<path d="M3 5h18M3 10h13a4 4 0 1 1 0 8h-4m0 0 3-3m-3 3 3 3M3 15h4"/>',
    file:'<path d="M5 2h9l5 5v15H5V2Z"/><path d="M14 2v6h5M9 12h6m-6 4h6"/>',
    star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
    close:'<path d="m5 5 14 14M5 19 19 5"/>'
  };
  const icon=(name,cls='')=>'<svg class="icon '+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.book)+'</svg>';
  const courseBy=id=>courses.find(c=>c.id===id),docBy=(c,id)=>c?.documents.find(d=>d.id===id),href=(c,d)=>'#/learn/'+c.id+'/'+d.id;
  const chapterLabel=d=>d.number===0?'导览':d.number!==null?'第'+String(d.number).padStart(2,'0')+'章':kindNames[d.kind];
  const displayTitle=d=>d.title.replace(/^第\s*\d+\s*章[：:、\s]*/,'').replace(/^\d{2}[、.\s]+/,'');
  const chapterRange=docs=>'第 '+docs[0].number+(docs.length>1?'—'+docs[docs.length-1].number:'')+' 章';
  function resume(c){const last=store.snapshot().last;return last?.courseId===c.id&&docBy(c,last.docId)?docBy(c,last.docId):c.documents.find(d=>d.number===0)||c.documents.find(d=>d.kind==='chapter');}
  function prefs(){const p=store.snapshot().prefs;document.documentElement.dataset.theme=p.theme==='system'?(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):p.theme;document.documentElement.style.setProperty('--font-size',p.font+'px');document.documentElement.classList.toggle('wrap-code',p.wrap);}
  prefs();
  function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2600);}
  function stateMessage(text){toast(text+(store.persistent()?'':'；本次浏览有效，浏览器暂不允许长期保存'));}
  function header(active='home'){
    return'<header class="site-header"><button class="icon-button menu-button" data-menu aria-label="打开导航" aria-expanded="false">'+icon('menu')+'</button><a class="brand" href="#/home" aria-label="知序首页"><img src="assets/favicon.svg" alt=""><span><span class="brand-name">'+e(site.name)+'</span><span class="brand-en">'+e(site.englishName)+'</span></span></a><nav class="header-nav" aria-label="主导航"><a href="#/home" class="'+(['home','category','course','learn'].includes(active)?'active':'')+'">探索教程</a><a href="#/paths" class="'+(active==='paths'?'active':'')+'">学习路径</a><a href="#/bookshelf" class="'+(active==='bookshelf'?'active':'')+'">我的书架</a></nav><div class="header-actions"><button class="search-trigger" data-search-open aria-label="搜索知识点">'+icon('search')+'<span>搜索知识点</span><kbd>Ctrl K</kbd></button><button class="icon-button" data-theme-toggle aria-label="切换明暗主题" title="切换明暗主题">'+icon(document.documentElement.dataset.theme==='dark'?'sun':'moon')+'</button></div></header>';
  }
  function footer(){return'<footer class="site-footer"><span>知序 · 让知识有序，让学习持续。</span><span>LEARN · BUILD · UNDERSTAND</span></footer>';}
  function globalSidebar(r){
    return'<aside class="sidebar" id="sidebar" aria-label="知识库导航"><div class="nav-label">知识库</div><a class="sidebar-link '+(r.type==='home'?'active':'')+'" href="#/home">'+icon('grid')+'<span>全部教程</span><span class="count">'+courses.length+'</span></a><a class="sidebar-link '+(r.type==='paths'?'active':'')+'" href="#/paths">'+icon('path')+'<span>学习路径</span></a><a class="sidebar-link '+(r.type==='bookshelf'?'active':'')+'" href="#/bookshelf">'+icon('bookmark')+'<span>我的书架</span></a><div class="nav-label">按知识领域浏览</div>'+site.categories.map(cat=>'<a href="#/category/'+cat.id+'" class="sidebar-link '+(r.type==='category'&&r.category===cat.id?'active':'')+'">'+icon(cat.icon)+'<span>'+e(cat.name)+'</span><span class="count">'+courses.filter(c=>c.category===cat.id).length+'</span></a>').join('')+'<div class="sidebar-note">'+icon('leaf')+'<div>知识库持续生长<br>让每门教程都有清晰的位置。</div><a href="#/about">了解知识库 '+icon('arrow')+'</a></div><div class="sidebar-bottom"><strong>保持好奇，循序渐进。</strong>从一个问题开始，向一个项目前进。</div></aside>';
  }
  function shell(r,body,sidebar){return header(r.type)+'<div class="layout '+(r.type==='learn'?'reader-layout':'')+'">'+(sidebar||globalSidebar(r))+'<main id="main" tabindex="-1">'+body+'</main></div><div class="mobile-overlay" data-menu-close></div>';}
  function heroArt(){return'<div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-sheet back"></div><div class="art-sheet front"><div class="art-sheet-top"><i></i><i></i><i></i><span>LEARN / BUILD</span></div><div class="art-code"><div><span>01</span> const <em>curiosity</em> = true;</div><div><span>02</span> learn( foundations );</div><div><span>03</span> build( something );</div><div><span>04</span> keep( growing );</div></div></div><div class="art-tag one">'+icon('code')+'从基础语法开始</div><div class="art-tag two">'+icon('check')+'在项目中理解知识</div><div class="art-small">'+icon('star')+'</div></div>';}
  function courseCard(c){
    const p=store.progress(c),last=store.snapshot().last,cat=site.categories.find(x=>x.id===c.category),cover=c.cover||{};
    return'<article class="course-card"><a href="#/course/'+c.id+'" class="course-cover" aria-label="查看'+e(c.title)+'"><div class="cover-type">'+e(cover.eyebrow||'KNOWLEDGE / LEARNING')+'<strong>'+(cover.lines||[c.shortTitle||c.title,'从理解到实践']).map(e).join('<br>')+'</strong></div><div class="cover-icon">'+icon(cover.icon||'book')+'</div><span class="cover-badge">'+(c.status==='complete'?'完整学习主线':'持续更新')+'</span></a><div class="course-card-body"><div class="course-kicker">'+e(cat?.name||'知识领域')+'<i></i>'+e(c.level||'循序渐进')+'</div><h3><a href="#/course/'+c.id+'">'+e(c.title)+'</a></h3><p>'+e(c.summary)+'</p><div class="tags">'+(c.tags||[]).map(t=>'<span class="tag">'+e(t)+'</span>').join('')+'</div><div class="course-card-meta"><span>'+icon('book')+c.chapterCount+' 章</span><span>'+icon('layers')+(c.stats?.examples||'配套')+' 组示例</span><span>'+icon('clock')+e(c.duration||'自定节奏')+'</span></div><div class="course-card-footer"><div class="card-progress"><small>'+(p.done?p.done+' / '+p.total+' 章已完成':'尚未开始 · 循序渐进')+'</small><div class="progress-line"><span style="width:'+p.percent+'%"></span></div></div><a class="primary-button" href="'+href(c,resume(c))+'">'+(last?.courseId===c.id?'继续学习':'开始学习')+icon('arrow')+'</a></div></div></article>';
  }
  function growthCard(){return'<div class="growth-card"><div class="growth-symbol">'+icon('folder')+'</div><h3>为下一门知识，留一个位置</h3><p>计算机、经济学与更多领域，<br>在清晰的分类中逐步丰富你的知识地图。</p><a href="#/about">了解知识库的收录方式 '+icon('arrow')+'</a></div>';}
  function empty(title,text,button='浏览全部教程'){return'<div class="empty-state">'+icon('book')+'<h3>'+e(title)+'</h3><p>'+e(text)+'</p><a href="#/home" class="secondary-button">'+button+icon('arrow')+'</a></div>';}
  function sortedCourses(list){return list.slice().sort(ui.sort==='title'?(a,b)=>a.title.localeCompare(b.title,'zh'):(a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  function homePage(r){
    const cat=r.type==='category'?site.categories.find(c=>c.id===r.category):null,filtered=cat?courses.filter(c=>c.category===cat.id):courses,total=courses.reduce((n,c)=>n+c.chapterCount,0);
    const hero=cat?'<div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'<span>'+e(cat.name)+'</span></div><div class="eyebrow">KNOWLEDGE / '+cat.id.toUpperCase()+'</div><h1 class="page-title">'+e(cat.name)+'</h1><p class="page-description">'+e(cat.description)+'，找到适合自己的下一步。</p>':'<section class="hero"><div><div class="eyebrow">A GROWING KNOWLEDGE LIBRARY</div><h1>把知识连成线，<br><span>让学习有章可循。</span></h1><p>从基础概念到完整项目，把零散的知识放回清晰的路径。<br>慢慢理解，亲手实践，建立自己的知识体系。</p><div class="hero-meta"><span><b>'+courses.length+'</b> 门课程</span><span><b>'+total+'</b> 个主线章节</span><span><b>∞</b> 保持好奇</span></div></div>'+heroArt()+'</section>';
    const filters='<div class="category-filters"><a class="filter-button '+(!cat?'active':'')+'" href="#/home">'+icon('grid')+'全部</a>'+site.categories.map(c=>'<a class="filter-button '+(cat?.id===c.id?'active':'')+'" href="#/category/'+c.id+'">'+icon(c.icon)+e(c.name)+'</a>').join('')+'</div>';
    return'<div class="page">'+hero+'<section aria-labelledby="library-heading"><div class="section-head"><div><h2 class="section-title" id="library-heading">课程图书馆</h2><p class="section-subtitle">'+(cat?'在这个领域中，找到适合自己的学习路径。':'选择一门教程，沿着目录开始。')+'</p></div><label><span class="visually-hidden">课程排序</span><select data-sort><option value="updated" '+(ui.sort==='updated'?'selected':'')+'>最近更新</option><option value="title" '+(ui.sort==='title'?'selected':'')+'>按标题排序</option></select></label></div>'+filters+'<div class="catalog-grid">'+(filtered.length?sortedCourses(filtered).map(courseCard).join('')+(!cat?growthCard():''):empty('这里的内容还在生长','该分类暂未收录教程，先从已有课程开始探索。'))+'</div></section><section class="learning-strip"><div class="strip-icon">'+icon('path')+'</div><div><h3>跟随路径，少一点迷路</h3><p>基础概念 → 语言与工具 → 分阶段实验 → 综合项目 → 验证与复盘</p></div><a class="quiet-link" href="#/paths">查看学习路径 '+icon('arrow')+'</a></section>'+footer()+'</div>';
  }
  function resources(c,type=ui.resourceType){
    const list=c.documents.filter(d=>!['chapter','guide'].includes(d.kind)&&(type==='all'||d.kind===type));
    return'<div class="resource-list">'+list.map(d=>'<a class="resource-item" href="'+href(c,d)+'">'+icon(d.kind==='code'?'code':d.kind==='exercise'?'file':d.kind==='capstone'?'star':'book')+'<span>'+e(displayTitle(d))+'</span><small>'+e(kindNames[d.kind])+'</small></a>').join('')+(list.length?'':empty('暂时没有这类资料','可以先查看章节正文。'))+'</div>';
  }
  function resourceFilters(){return'<div class="category-filters resource-tabs">'+[['exercise','练习答案'],['checklist','验收清单'],['code','源码附录'],['capstone','综合实践'],['reference','参考资料'],['validation','验证记录'],['project','示例说明'],['all','全部资料']].map(([id,name])=>'<button class="filter-button '+(id===ui.resourceType?'active':'')+'" data-resource-type="'+id+'">'+name+'</button>').join('')+'</div>';}
  function coursePage(c){
    const p=store.progress(c),capstone=c.documents.find(d=>d.kind==='capstone');
    return'<div class="page"><div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'<a href="#/category/'+c.category+'">'+e(site.categories.find(x=>x.id===c.category)?.name)+'</a>'+icon('chevron')+'<span>课程概览</span></div><section class="course-hero"><div><div class="eyebrow">LEARNING PATH / '+e(c.level||'系统学习')+'</div><h1>'+e(c.title)+'</h1><p>'+e(c.summary)+'<br>按顺序阅读、动手修改，在练习和验收中建立自己的理解。</p><div class="course-actions"><a class="primary-button" href="'+href(c,resume(c))+'">'+(store.snapshot().last?.courseId===c.id?'继续学习':'开始学习')+icon('arrow')+'</a>'+(c.download?'<a class="secondary-button" href="'+e(c.download)+'" download>'+icon('download')+'完整教程与代码</a>':'')+(capstone?'<a class="secondary-button" href="'+href(c,capstone)+'">'+icon('star')+'综合实践</a>':'')+'</div></div><div class="course-stamp" aria-hidden="true">'+icon(c.cover?.icon||'book')+'</div></section><div class="course-stats"><div><b>'+c.chapterCount+'</b><span>个主线章节</span></div><div><b>'+(c.stats?.books||c.groups.length)+'</b><span>'+(c.stats?.books?'册配套教材':'个学习阶段')+'</span></div><div><b>'+(c.stats?.examples||'—')+'</b><span>组代码示例</span></div><div><b>'+p.percent+'%</b><span>本机学习进度</span></div></div><section><div class="section-head"><div><h2 class="section-title">循序渐进的学习框架</h2><p class="section-subtitle">从最小的例子开始，逐步连接成完整应用。</p></div><span class="quiet-link">'+(c.groups||[]).length+' 个阶段</span></div><div class="module-grid">'+(c.groups||[]).map((g,i)=>{const lessons=c.documents.filter(d=>d.kind==='chapter'&&d.group===g.id),first=lessons[0];return first?'<a class="module-card" href="'+href(c,first)+'"><div class="module-number">'+String(i+1).padStart(2,'0')+'</div><div><h3>'+e(g.name)+'</h3><p>'+e(g.summary||'')+'</p><small>'+chapterRange(lessons)+' · '+lessons.length+' 节</small></div>'+icon('arrow')+'</a>':'';}).join('')+'</div></section><div class="notice-line">建议投入：'+e(c.duration||'按自己的节奏学习')+'。阅读进度与收藏保存在当前浏览器；章节完成由你手动确认。</div><section><div class="section-head"><div><h2 class="section-title">配套学习资料</h2><p class="section-subtitle">正文之外，保留每个阶段的练习、源码与实际验收。</p></div></div>'+resourceFilters()+'<div id="resources">'+resources(c)+'</div></section>'+footer()+'</div>';
  }
  function docLink(c,d,current){const complete=store.isComplete(c.id+'/'+d.id);return'<a class="doc-link '+(d.id===current?.id?'active':'')+'" href="'+href(c,d)+'" data-doc-key="'+c.id+'/'+d.id+'"><span class="doc-number">'+(d.number!==null?String(d.number).padStart(2,'0'):'·')+'</span><span>'+e(displayTitle(d))+'</span><span class="doc-check">'+(complete?icon('check'):'')+'</span></a>';}
  function readerSidebar(c,d){
    const p=store.progress(c),active=ui.sidebarTab;
    let body='';
    if(active==='chapters'){
      body+=c.documents.filter(x=>x.number===0).map(x=>docLink(c,x,d)).join('');
      for(const g of c.groups||[]){const list=c.documents.filter(x=>x.kind==='chapter'&&x.group===g.id);body+='<details class="chapter-group" '+(d.group===g.id?'open':'')+'><summary>'+icon('chevron')+'<span>'+e(g.name)+'</span><small>'+list.length+'</small></summary>'+list.map(x=>docLink(c,x,d)).join('')+'</details>';}
    }else{
      for(const kind of ['exercise','checklist','code','capstone','reference','validation','project']){const list=c.documents.filter(x=>x.kind===kind);if(list.length)body+='<details class="chapter-group" '+(d.kind===kind?'open':'')+'><summary>'+icon('chevron')+'<span>'+e(kindNames[kind])+'</span><small>'+list.length+'</small></summary>'+list.map(x=>docLink(c,x,d)).join('')+'</details>';}
    }
    return'<aside class="sidebar reader-sidebar" id="sidebar" aria-label="课程章节导航"><a class="course-back" href="#/course/'+c.id+'">'+icon('back')+'返回课程概览</a><div class="sidebar-course"><div class="sidebar-course-label">COURSE / '+e(c.level||'教程')+'</div><h2>'+e(c.shortTitle||c.title)+'</h2><small data-course-progress>'+p.done+' / '+p.total+' 章已完成</small><div class="progress-line"><span data-course-progress-bar style="width:'+p.percent+'%"></span></div></div><div class="sidebar-tabs"><button data-sidebar-tab="chapters" class="'+(active==='chapters'?'active':'')+'">章节目录</button><button data-sidebar-tab="resources" class="'+(active==='resources'?'active':'')+'">配套资料</button></div>'+body+'</aside>';
  }
  const contentCache=new Map(),pendingContent=new Map();
  window.TutorialContent={register(key,value){contentCache.set(key,value);while(contentCache.size>5)contentCache.delete(contentCache.keys().next().value);}};
  function scriptLoad(url){
    return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=url;tag.onload=()=>{tag.remove();resolve();};tag.onerror=()=>{tag.remove();reject(Error('资源未能加载'));};document.head.appendChild(tag);});
  }
  function loadDocument(c,d){
    const key=c.id+'/'+d.id;if(contentCache.has(key))return Promise.resolve(contentCache.get(key));if(pendingContent.has(key))return pendingContent.get(key);
    const job=scriptLoad('data/content/'+encodeURIComponent(c.id)+'/'+encodeURIComponent(d.id)+'.js').then(()=>{const value=contentCache.get(key);if(!value)throw Error('正文数据缺失');return value;}).finally(()=>pendingContent.delete(key));pendingContent.set(key,job);return job;
  }
  function tocLinks(data){return data.toc.map(t=>'<a href="#" data-heading="'+e(t.id)+'" class="'+(t.level===3?'sub':'')+'">'+e(t.text)+'</a>').join('');}
  function readerBody(c,d,data){
    const key=c.id+'/'+d.id,saved=store.isBookmarked(key),done=store.isComplete(key),list=c.documents.filter(x=>x.kind==='chapter'||x.number===0),index=list.findIndex(x=>x.id===d.id),previous=index>0?list[index-1]:null,next=index>=0?list[index+1]:null,capstone=c.documents.find(x=>x.kind==='capstone');
    return'<div class="read-progress" id="read-progress"></div><div class="reading-wrap"><div class="reading-column"><div class="reader-topline"><div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'<a href="#/course/'+c.id+'">'+e(c.shortTitle||c.title)+'</a></div><div class="reader-controls"><button data-font="-1" aria-label="减小正文字号" title="减小字号">A−</button><button data-font="1" aria-label="增大正文字号" title="增大字号">A+</button><button data-wrap aria-label="切换代码自动换行" aria-pressed="'+store.snapshot().prefs.wrap+'" title="代码自动换行">'+icon('wrap')+'</button></div></div><div class="article-eyebrow">'+(d.kind==='chapter'?'CHAPTER '+String(d.number).padStart(2,'0'):e(kindNames[d.kind]).toUpperCase())+'</div><h1 class="article-title">'+e(displayTitle(d))+'</h1><div class="article-meta"><span>'+icon('book')+e(kindNames[d.kind])+'</span>'+(d.kind==='chapter'||d.kind==='guide'?'<span>'+icon('clock')+'约 '+data.minutes+' 分钟阅读</span>':'')+'<span>更新于 '+e(c.updatedAt)+'</span></div><div class="article-actions"><button class="secondary-button '+(saved?'is-saved':'')+'" data-bookmark="'+key+'" aria-pressed="'+saved+'">'+icon('bookmark')+'<span>'+(saved?'已收藏':'收藏本节')+'</span></button><a class="secondary-button" href="'+e(data.raw)+'" download>'+icon('file')+'Markdown 原文</a><a class="secondary-button" href="#/course/'+c.id+'">'+icon('layers')+'课程资料</a></div><details class="reader-mobile-toc"><summary>本页目录 · '+data.toc.length+' 个小节</summary><nav aria-label="本页目录">'+tocLinks(data)+'</nav></details><article class="article" id="article">'+data.html+'</article><div class="chapter-bottom">'+(d.kind==='chapter'?'<div class="completion-box"><div><h3>理解之后，再向前一步</h3><p>读完、动手试过，再记录这节的完成状态。</p></div><button class="primary-button" data-complete="'+key+'" aria-pressed="'+done+'">'+icon(done?'check':'book')+'<span>'+(done?'已完成本章':'标记本章完成')+'</span></button></div>':'')+'<nav class="chapter-navigation" aria-label="前后章节">'+(previous?'<a href="'+href(c,previous)+'"><small>← 上一节 · '+chapterLabel(previous)+'</small>'+e(displayTitle(previous))+'</a>':'<a href="#/course/'+c.id+'"><small>返回</small>课程概览</a>')+(next?'<a href="'+href(c,next)+'"><small>下一节 · '+chapterLabel(next)+' →</small>'+e(displayTitle(next))+'</a>':capstone&&capstone.id!==d.id?'<a href="'+href(c,capstone)+'"><small>下一步 →</small>最终综合实践</a>':'<a href="#/course/'+c.id+'"><small>返回 →</small>全部章节与资料</a>')+'</nav></div>'+footer()+'</div><aside class="reading-toc" aria-label="本页目录"><h2>本页目录</h2>'+tocLinks(data)+'<div class="toc-footer">一步一步，理解每一部分。<br><a href="#/course/'+c.id+'">返回课程概览</a></div></aside></div>';
  }
  function pathsPage(){
    return'<div class="page"><div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'学习路径</div><div class="eyebrow">FROM FUNDAMENTALS TO PRACTICE</div><h1 class="page-title">让每一步，都连接下一步</h1><p class="page-description">先建立基础，再连接业务，最后理解工程。每条路径都对应一门完整课程。</p>'+courses.map(c=>'<section><div class="section-head"><h2 class="section-title">'+e(c.shortTitle||c.title)+'</h2><a href="#/course/'+c.id+'" class="quiet-link">课程概览 '+icon('arrow')+'</a></div><div class="path-list">'+(c.groups||[]).map((g,i)=>{const docs=c.documents.filter(d=>d.kind==='chapter'&&d.group===g.id);return docs.length?'<div class="path-item"><div class="path-dot">'+String(i+1).padStart(2,'0')+'</div><div class="path-content"><div><h3>'+e(g.name)+'</h3><p>'+e(g.summary||'')+' · '+chapterRange(docs)+'</p></div><a href="'+href(c,docs[0])+'" class="quiet-link">进入阶段 '+icon('arrow')+'</a></div></div>':'';}).join('')+'</div></section>').join('')+footer()+'</div>';
  }
  function bookshelfPage(){
    const state=store.snapshot(),lastCourse=state.last&&courseBy(state.last.courseId),lastDoc=lastCourse&&docBy(lastCourse,state.last.docId);
    const saved=state.bookmarks.map(key=>{const [cid,did]=key.split('/'),c=courseBy(cid),d=docBy(c,did);return c&&d?{key,c,d}:null;}).filter(Boolean).reverse();
    return'<div class="page"><div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'我的书架</div><div class="eyebrow">YOUR OWN LEARNING SPACE</div><h1 class="page-title">把值得回看的，留在这里</h1><p class="page-description">最近阅读、完成状态与章节收藏，仅保存在当前浏览器中。</p><section><div class="section-head"><h2 class="section-title">继续上次阅读</h2></div>'+(lastDoc?'<div class="learning-strip"><div class="strip-icon">'+icon('book')+'</div><div><h3>'+e(displayTitle(lastDoc))+'</h3><p>'+e(lastCourse.shortTitle||lastCourse.title)+' · '+e(chapterLabel(lastDoc))+'</p></div><a class="quiet-link" href="'+href(lastCourse,lastDoc)+'">继续阅读 '+icon('arrow')+'</a></div>':empty('还没有阅读记录','从一门课程开始，这里会记住你的下一步。'))+'</section><section style="margin-top:34px"><div class="section-head"><h2 class="section-title">收藏的章节</h2><span class="quiet-link">'+saved.length+' 条收藏</span></div><div class="saved-list">'+(saved.length?saved.map(({key,c,d})=>'<div class="saved-item"><div class="strip-icon">'+icon('bookmark')+'</div><a href="'+href(c,d)+'"><small>'+e(c.shortTitle||c.title)+' / '+e(chapterLabel(d))+'</small><h3>'+e(displayTitle(d))+'</h3></a><button class="icon-button" data-bookmark="'+key+'" data-remove-saved aria-label="取消收藏'+e(displayTitle(d))+'">'+icon('close')+'</button></div>').join(''):empty('把重要章节，放进书架','阅读时点击“收藏本节”，就能在这里快速找到。'))+'</div></section>'+footer()+'</div>';
  }
  function aboutPage(){return'<div class="page"><div class="breadcrumb"><a href="#/home">知识库</a>'+icon('chevron')+'关于知序</div><div class="eyebrow">A PLACE FOR WHAT YOU LEARN</div><h1 class="page-title">知识在生长，结构先清晰</h1><p class="page-description">把教程按领域与课程组织，让每一次学习都能找到起点，也能找到下一步。</p><div class="about-grid"><section class="about-card">'+icon('layers')+'<h2>领域 → 课程 → 阶段 → 章节</h2><p>语言、前端、后端、计算机基础、经济与社会科学及工程工具各有位置；每门课程独立管理目录、练习与配套资料。</p></section><section class="about-card">'+icon('bookmark')+'<h2>属于自己的阅读节奏</h2><p>章节收藏、手动完成状态、最近阅读与阅读偏好保存在当前浏览器，不需要账号。换浏览器或清除数据后不会自动同步。</p></section><section class="about-card wide">'+icon('folder')+'<h2>以后如何加入新的教程</h2><p>在网站的<code>content</code>下新增课程文件夹，放入<code>course.json</code>与<code>source</code>教材。分类由<code>site.config.json</code>统一管理；课程可使用数字章节，或在清单中明确指定章节顺序。</p><pre>content/\n  wechat-miniprogram/\n    course.json\n    source/\n  your-next-course/\n    course.json\n    source/\n      01-开始.md\n      02-下一步.md</pre><p>然后在网站目录运行<code>npm ci --ignore-scripts</code>、<code>npm run build</code>，重新打开入口。详细模板与内容约定见网站根目录的<code>添加教程.md</code>。</p></section><section class="about-card wide">'+icon('info')+'<h2>关于第一门课程</h2><p>微信小程序教程的36章主线、练习、源码与验收资料完整保留。主工程与扩展实验的测试范围见课程原文；真实微信、云环境和正式交付条件仍需按教材实际验收。</p><a class="quiet-link" href="#/course/'+(courses.find(c=>c.id==='wechat-miniprogram')?.id||courses[0].id)+'">查看完整课程 '+icon('arrow')+'</a></section></div>'+footer()+'</div>';}
  let observer,scrollFrame=false;
  function watchHeadings(data){
    observer?.disconnect();if(!('IntersectionObserver'in window))return;
    const headings=document.querySelectorAll('#article h2,#article h3');
    observer=new IntersectionObserver(entries=>{const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(!visible.length)return;const id=visible[0].target.id;document.querySelectorAll('.reading-toc [data-heading]').forEach(a=>a.toggleAttribute('aria-current',false));document.querySelectorAll('.reading-toc [data-heading]').forEach(a=>{if(a.dataset.heading===id)a.setAttribute('aria-current','location');});},{rootMargin:'-95px 0px -65% 0px'});headings.forEach(h=>observer.observe(h));
  }
  function headingScroll(id){let target=document.getElementById(id)||document.getElementById(slug(id));if(!target){const all=[...document.querySelectorAll('#article h2,#article h3,#article h4')];target=all.find(h=>slug(h.textContent)===slug(id));}if(target)target.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  function closeMenu(){document.getElementById('sidebar')?.classList.remove('open');document.querySelector('.mobile-overlay')?.classList.remove('open');document.querySelector('[data-menu]')?.setAttribute('aria-expanded','false');if(!document.getElementById('search-dialog').open)document.body.classList.remove('body-lock');}
  async function render(){
    const r=route(location.hash),token=++ui.token,c=courseBy(r.courseId);if(r.type==='learn'&&ui.current?.key===r.courseId+'/'+r.docId&&r.section&&document.getElementById('article')){closeMenu();headingScroll(r.section);return;}closeMenu();observer?.disconnect();document.querySelector('.read-progress')?.remove();
    if(r.type==='learn'&&c){const d=docBy(c,r.docId);if(!d){app.innerHTML=shell(r,'<div class="page">'+empty('没有找到这一节','可能是链接已变更，请回到课程目录。')+'</div>');return;}
      if(ui.current?.key===c.id+'/'+d.id&&r.section&&document.getElementById('article')){headingScroll(r.section);return;}
      ui.current={c,d,key:c.id+'/'+d.id};ui.sidebarTab=['chapter','guide'].includes(d.kind)?'chapters':'resources';
      app.innerHTML=shell(r,'<div class="loading-state">正在打开这一节…</div>',readerSidebar(c,d));window.scrollTo(0,0);
      try{const data=await loadDocument(c,d);if(token!==ui.token)return;store.visit(c.id,d.id);app.innerHTML=shell(r,readerBody(c,d,data),readerSidebar(c,d));document.title=displayTitle(d)+' · '+site.name;watchHeadings(data);requestAnimationFrame(()=>{const sidebar=document.getElementById('sidebar'),active=sidebar?.querySelector('.doc-link.active');if(active)sidebar.scrollTop=Math.max(0,active.offsetTop-sidebar.clientHeight/2);if(r.section)headingScroll(r.section);});}
      catch(_){if(token===ui.token)app.innerHTML=shell(r,'<div class="page">'+empty('正文暂时未能打开','请确认网站内容已生成，再刷新重试。')+'</div>',readerSidebar(c,d));}return;
    }
    ui.current=null;
    const body=r.type==='course'&&c?coursePage(c):r.type==='paths'?pathsPage():r.type==='bookshelf'?bookshelfPage():r.type==='about'?aboutPage():homePage(r);
    app.innerHTML=shell(r,body);document.title=(r.type==='course'&&c?c.title:r.type==='paths'?'学习路径':r.type==='bookshelf'?'我的书架':r.type==='about'?'关于知序':'教程知识库')+' · '+site.name;window.scrollTo(0,0);
  }
  function updateCompletion(key){
    const done=store.isComplete(key);
    document.querySelectorAll('[data-complete]').forEach(button=>{if(button.dataset.complete===key){button.setAttribute('aria-pressed',String(done));button.innerHTML=icon(done?'check':'book')+'<span>'+(done?'已完成本章':'标记本章完成')+'</span>';}});
    document.querySelectorAll('[data-doc-key]').forEach(a=>{if(a.dataset.docKey===key)a.querySelector('.doc-check').innerHTML=done?icon('check'):'';});
    if(ui.current){const p=store.progress(ui.current.c);document.querySelector('[data-course-progress]')?.replaceChildren(document.createTextNode(p.done+' / '+p.total+' 章已完成'));const bar=document.querySelector('[data-course-progress-bar]');if(bar)bar.style.width=p.percent+'%';}
  }
  async function copyCode(button){
    const text=button.closest('.code-block')?.querySelector('pre code')?.textContent||'';
    try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else{const old=document.activeElement,area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();old?.focus();if(!ok)throw Error();}const span=button.querySelector('.copy-label');if(span){span.textContent='已复制';setTimeout(()=>{span.textContent='复制';},1600);}toast('代码已复制');}catch(_){toast('浏览器未允许复制，可选中代码后手动复制');}
  }
  const dialog=document.getElementById('search-dialog'),input=document.getElementById('search-input'),results=document.getElementById('search-results');
  document.getElementById('search-icon').innerHTML=icon('search');
  async function ensureSearch(){if(window.TUTORIAL_SEARCH)return window.TUTORIAL_SEARCH;if(!ensureSearch.job)ensureSearch.job=scriptLoad('data/search.js').then(()=>window.TUTORIAL_SEARCH).catch(error=>{ensureSearch.job=null;throw error;});return ensureSearch.job;}
  function highlighted(text,query){const words=query.trim().split(/\s+/).filter(Boolean);if(!words.length)return e(text);const safe=e(text),escaped=words.map(w=>e(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));try{return safe.replace(new RegExp('('+escaped.join('|')+')','gi'),'<mark>$1</mark>');}catch(_){return safe;}}
  async function runSearch(){
    const query=input.value.slice(0,100);ui.searchCursor=-1;
    if(!query.trim()){ui.searchResults=[];results.innerHTML='<div class="search-hint"><strong>想理解哪个知识点？</strong><div class="category-filters" style="justify-content:center">'+['JavaScript','setData','生命周期','云开发','草稿','TypeScript'].map(t=>'<button class="filter-button" data-search-suggestion="'+e(t)+'">'+t+'</button>').join('')+'</div></div>';return;}
    try{const index=await ensureSearch();if(input.value.slice(0,100)!==query)return;const hits=search(query,index);ui.searchResults=hits;results.innerHTML=hits.length?hits.map((row,i)=>{const c=courseBy(row.courseId),d=docBy(c,row.docId);if(!c||!d)return'';return'<a class="search-result" data-search-result="'+i+'" href="'+href(c,d)+(row.heading&&row.heading!==row.title?'?section='+encodeURIComponent(slug(row.heading)):'')+'"><small>'+e(c.shortTitle||c.title)+' · '+e(kindNames[row.kind])+'</small><h3>'+highlighted(row.heading||row.title,query)+'</h3><p>'+highlighted(row.snippet,query)+'</p></a>';}).join(''):'<div class="search-hint"><strong>没有找到相关内容</strong>试试更短的关键词，或从课程目录开始。</div>';}
    catch(_){results.innerHTML='<div class="search-hint">搜索索引暂时未能打开，请刷新后重试。</div>';}
  }
  function openSearch(){if(!dialog.open)dialog.showModal();document.body.classList.add('body-lock');runSearch();setTimeout(()=>input.focus(),0);}
  function closeSearch(){if(dialog.open)dialog.close();if(!document.getElementById('sidebar')?.classList.contains('open'))document.body.classList.remove('body-lock');}
  input.addEventListener('input',()=>{clearTimeout(runSearch.timer);runSearch.timer=setTimeout(runSearch,100);});
  dialog.addEventListener('close',()=>{if(!document.getElementById('sidebar')?.classList.contains('open'))document.body.classList.remove('body-lock');});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeSearch();});
  input.addEventListener('keydown',event=>{const links=[...results.querySelectorAll('.search-result')];if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!links.length)return;ui.searchCursor=(ui.searchCursor+(event.key==='ArrowDown'?1:-1)+links.length)%links.length;links.forEach((a,i)=>a.classList.toggle('selected',i===ui.searchCursor));links[ui.searchCursor].scrollIntoView({block:'nearest'});}else if(event.key==='Enter'&&links.length){event.preventDefault();links[Math.max(0,ui.searchCursor)].click();}});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,a,[data-menu-close]');if(!button)return;
    if(button.matches('.skip-link')){event.preventDefault();const main=document.getElementById('main');main?.focus();main?.scrollIntoView({block:'start'});return;}
    if(button.matches('[data-menu]')){const panel=document.getElementById('sidebar'),open=!panel.classList.contains('open');panel.classList.toggle('open',open);document.querySelector('.mobile-overlay').classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));document.body.classList.toggle('body-lock',open);}
    if(button.matches('[data-menu-close]'))closeMenu();
    if(button.matches('[data-search-open]'))openSearch();if(button.matches('[data-search-close]'))closeSearch();
    if(button.matches('[data-search-suggestion]')){input.value=button.dataset.searchSuggestion;runSearch();input.focus();}
    if(button.matches('[data-search-result]'))closeSearch();
    if(button.matches('[data-theme-toggle]')){store.preference('theme',document.documentElement.dataset.theme==='dark'?'light':'dark');prefs();document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.innerHTML=icon(document.documentElement.dataset.theme==='dark'?'sun':'moon'));}
    if(button.matches('[data-font]')){store.preference('font',Math.max(15,Math.min(22,store.snapshot().prefs.font+Number(button.dataset.font))));prefs();toast('正文字号：'+store.snapshot().prefs.font+'px');}
    if(button.matches('[data-wrap]')){store.preference('wrap',!store.snapshot().prefs.wrap);prefs();button.setAttribute('aria-pressed',String(store.snapshot().prefs.wrap));toast(store.snapshot().prefs.wrap?'代码已自动换行':'代码保持原始行宽');}
    if(button.matches('[data-copy]'))copyCode(button);
    if(button.matches('[data-complete]')){const key=button.dataset.complete,done=store.toggleComplete(key);updateCompletion(key);stateMessage(done?'已记录本章完成':'已取消完成状态');}
    if(button.matches('[data-bookmark]')){const key=button.dataset.bookmark,saved=store.toggleBookmark(key);if(button.hasAttribute('data-remove-saved'))render();else{button.classList.toggle('is-saved',saved);button.setAttribute('aria-pressed',String(saved));button.querySelector('span').textContent=saved?'已收藏':'收藏本节';}stateMessage(saved?'已加入我的书架':'已取消收藏');}
    if(button.matches('[data-resource-type]')){ui.resourceType=button.dataset.resourceType;document.querySelectorAll('[data-resource-type]').forEach(b=>b.classList.toggle('active',b===button));const c=courseBy(route(location.hash).courseId);if(c)document.getElementById('resources').innerHTML=resources(c);}
    if(button.matches('[data-sidebar-tab]')&&ui.current){ui.sidebarTab=button.dataset.sidebarTab;const old=document.getElementById('sidebar'),open=old.classList.contains('open');old.outerHTML=readerSidebar(ui.current.c,ui.current.d);if(open)document.getElementById('sidebar').classList.add('open');}
    const heading=event.target.closest('[data-heading]');if(heading&&ui.current){event.preventDefault();headingScroll(heading.dataset.heading);const path=href(ui.current.c,ui.current.d)+'?section='+encodeURIComponent(heading.dataset.heading);history.replaceState(null,'',path);}
    if(button.tagName==='A'&&button.getAttribute('href')?.startsWith('#/')&&!button.hasAttribute('data-heading'))closeMenu();
  });
  document.addEventListener('change',event=>{if(event.target.matches('[data-sort]')){ui.sort=event.target.value;render();}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}if(event.key==='Escape')closeMenu();});
  window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=true;requestAnimationFrame(()=>{scrollFrame=false;const article=document.getElementById('article'),bar=document.getElementById('read-progress');if(article&&bar){const rect=article.getBoundingClientRect(),total=Math.max(1,article.offsetHeight-window.innerHeight+160);bar.style.width=Math.min(100,Math.max(0,-rect.top+100)/total*100)+'%';}});},{passive:true});
  window.addEventListener('hashchange',render);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(store.snapshot().prefs.theme==='system')prefs();});
  render();
})();
