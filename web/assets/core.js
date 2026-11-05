(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TutorialCore=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validKey=value=>typeof value==='string'&&/^[a-z0-9-]+\/[a-z0-9-]+$/.test(value);
  const slug=text=>String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s+/g,'-')||'section';
  function createStore(storage){
    const key='zhixu-tutorial-library-v1';let raw={};
    try{const value=JSON.parse(storage?.getItem(key)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))raw=value;}catch(_){}
    const completed=new Set((Array.isArray(raw.completed)?raw.completed:[]).filter(validKey).slice(0,10000));
    const bookmarks=new Set((Array.isArray(raw.bookmarks)?raw.bookmarks:[]).filter(validKey).slice(0,1000));
    let last=raw.last&&validKey(raw.last.courseId+'/'+raw.last.docId)?{courseId:raw.last.courseId,docId:raw.last.docId}:null;
    const prefs={theme:['light','dark','system'].includes(raw.prefs?.theme)?raw.prefs.theme:'system',font:Number.isInteger(raw.prefs?.font)&&raw.prefs.font>=15&&raw.prefs.font<=22?raw.prefs.font:17,wrap:raw.prefs?.wrap===true};
    let persistent=!!storage;
    const snapshot=()=>({version:1,completed:[...completed],bookmarks:[...bookmarks],last:last?{...last}:null,prefs:{...prefs}});
    function save(){try{if(!storage)throw Error('Storage unavailable');storage.setItem(key,JSON.stringify(snapshot()));persistent=true;}catch(_){persistent=false;}}
    return{snapshot,persistent:()=>persistent,isComplete:k=>completed.has(k),isBookmarked:k=>bookmarks.has(k),
      toggleComplete(k){if(!validKey(k))return false;completed.has(k)?completed.delete(k):completed.add(k);save();return completed.has(k);},
      toggleBookmark(k){if(!validKey(k))return false;bookmarks.has(k)?bookmarks.delete(k):bookmarks.add(k);save();return bookmarks.has(k);},
      visit(courseId,docId){if(validKey(courseId+'/'+docId)){last={courseId,docId};save();}},
      preference(name,value){if(name==='theme'&&['light','dark','system'].includes(value))prefs.theme=value;if(name==='font'&&Number.isInteger(value)&&value>=15&&value<=22)prefs.font=value;if(name==='wrap'&&typeof value==='boolean')prefs.wrap=value;save();},
      progress(course){const lessons=course.documents.filter(d=>d.kind==='chapter'),done=lessons.filter(d=>completed.has(course.id+'/'+d.id)).length;return{done,total:lessons.length,percent:lessons.length?Math.round(done/lessons.length*100):0};}
    };
  }
  function search(query,index,limit=12){
    const q=String(query).normalize('NFKC').trim().toLowerCase().slice(0,100);if(!q)return[];
    const terms=q.split(/\s+/).filter(Boolean),matches=[];
    for(const row of index){const title=row.title.toLowerCase(),heading=row.heading.toLowerCase(),body=row.text.toLowerCase();if(!terms.every(term=>title.includes(term)||heading.includes(term)||body.includes(term)))continue;
      const score=(title.includes(q)?100:0)+(heading.includes(q)?80:0)+(title.startsWith(q)?30:0)+terms.reduce((n,t)=>n+(title.includes(t)?15:0)+(heading.includes(t)?10:0),0);
      const hit=Math.max(0,body.indexOf(terms[0])),start=Math.max(0,hit-35),snippet=(start?'…':'')+row.text.slice(start,start+125).replace(/\s+/g,' ')+(row.text.length>start+125?'…':'');
      matches.push({...row,score,snippet});
    }
    matches.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'zh'));const seen=new Set(),out=[];
    for(const row of matches){const key=row.courseId+'/'+row.docId+'/'+row.heading;if(seen.has(key))continue;seen.add(key);out.push(row);if(out.length>=limit)break;}return out;
  }
  function route(hash){
    try{const [pathname,query='']=String(hash||'#/home').replace(/^#\/?/,'').split('?');const parts=pathname.split('/').map(decodeURIComponent),params=new URLSearchParams(query);return{type:parts[0]||'home',courseId:parts[1]||null,docId:parts[2]||null,section:params.get('section'),category:parts[1]||null};}
    catch(_){return{type:'home',courseId:null,docId:null,section:null};}
  }
  return{escape,slug,createStore,search,route,validKey};
});
