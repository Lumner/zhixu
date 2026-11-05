const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lines(text,size=13) {
  const chars=Array.from(text), result=[];
  for(let i=0;i<chars.length;i+=size)result.push(chars.slice(i,i+size).join(''));
  return result;
}
function label(text,x,y,size=13) {
  const rows=lines(text,size);
  return '<text x="'+x+'" y="'+(y-(rows.length-1)*8)+'" text-anchor="middle">'+rows.map((row,i)=>'<tspan x="'+x+'" dy="'+(i?16:0)+'">'+escape(row)+'</tspan>').join('')+'</text>';
}
function flow(text,id) {
  const rows=text.trim().split(/\r?\n/), header=/^flowchart\s+(TD|LR)$/.exec(rows.shift().trim());
  if(!header)return null;
  const nodes=new Map(), edges=[];
  for(const raw of rows) {
    const line=raw.trim();if(!line)continue;
    const match=/^([A-Za-z]\w*)(?:\[([^\]]+)\])?\s*-->\s*([A-Za-z]\w*)(?:\[([^\]]+)\])?$/.exec(line);
    if(!match)return null;
    for(const [key,name] of [[match[1],match[2]],[match[3],match[4]]])if(name||!nodes.has(key))nodes.set(key,name||key);
    edges.push([match[1],match[3]]);
  }
  const degree=new Map([...nodes.keys()].map(key=>[key,0])),rank=new Map([...nodes.keys()].map(key=>[key,0]));
  for(const [,to] of edges)degree.set(to,degree.get(to)+1);
  const queue=[...nodes.keys()].filter(key=>!degree.get(key));let visited=0;
  while(queue.length){const key=queue.shift();visited++;for(const [from,to]of edges)if(from===key){rank.set(to,Math.max(rank.get(to),rank.get(from)+1));degree.set(to,degree.get(to)-1);if(!degree.get(to))queue.push(to);}}
  if(visited!==nodes.size||nodes.size>40)return null;
  const groups=[];for(const key of nodes.keys())(groups[rank.get(key)]||=[]).push(key);
  const lr=header[1]==='LR', max=Math.max(...groups.map(g=>g.length)),depth=groups.length;
  const width=lr?depth*208+32:max*208+32,height=lr?max*98+40:depth*98+32,positions=new Map();
  for(let r=0;r<groups.length;r++)groups[r].forEach((key,i)=>positions.set(key,lr?{x:120+r*208,y:64+i*98}:{x:width/2+(i-(groups[r].length-1)/2)*208,y:48+r*98}));
  const marker='diagram-arrow-'+id;
  let body='<defs><marker id="'+marker+'" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor"/></marker></defs>';
  for(const [from,to]of edges){const a=positions.get(from),b=positions.get(to);body+='<path class="diagram-edge" marker-end="url(#'+marker+')" d="'+(lr?'M'+(a.x+86)+' '+a.y+' C'+(a.x+126)+' '+a.y+','+(b.x-126)+' '+b.y+','+(b.x-90)+' '+b.y:'M'+a.x+' '+(a.y+28)+' C'+a.x+' '+(a.y+55)+','+b.x+' '+(b.y-55)+','+b.x+' '+(b.y-32))+'"/>';}
  for(const [key,name]of nodes){const p=positions.get(key);body+='<rect x="'+(p.x-86)+'" y="'+(p.y-27)+'" width="172" height="54" rx="10"/>'+label(name,p.x,p.y+4);}
  return '<svg class="course-diagram '+(lr?'diagram-wide':'')+'" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="课程流程图">'+body+'</svg>';
}
function sequence(text,id) {
  const rows=text.trim().split(/\r?\n/);if(rows.shift().trim()!=='sequenceDiagram')return null;
  const participants=[],events=[];
  for(const raw of rows){const line=raw.trim();if(!line)continue;const p=/^participant\s+(\w+)\s+as\s+(.+)$/.exec(line);if(p){participants.push({id:p[1],name:p[2]});continue;}const e=/^(\w+)(-->>|->>)(\w+):\s*(.+)$/.exec(line);if(!e)return null;events.push({from:e[1],to:e[3],name:e[4],dashed:e[2]==='-->>'});}
  if(participants.length>8||events.length>40)return null;
  const width=Math.max(620,participants.length*190),height=events.length*76+100,marker='diagram-arrow-'+id;
  const pos=new Map(participants.map((p,i)=>[p.id,(i+0.5)*width/participants.length]));
  if(events.some(e=>!pos.has(e.from)||!pos.has(e.to)))return null;
  let body='<defs><marker id="'+marker+'" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor"/></marker></defs>';
  for(const p of participants){const x=pos.get(p.id);body+='<path class="diagram-lifeline" d="M'+x+' 58V'+(height-20)+'"/><rect x="'+(x-78)+'" y="10" width="156" height="42" rx="9"/>'+label(p.name,x,36);}
  events.forEach((e,i)=>{const y=104+i*76,a=pos.get(e.from),b=pos.get(e.to),isSelf=a===b;body+=label(e.name,isSelf?a-28:(a+b)/2,y-18,34)+'<path class="diagram-edge '+(e.dashed?'dashed':'')+'" marker-end="url(#'+marker+')" d="'+(isSelf?'M'+a+' '+y+'h44v20h-40':'M'+a+' '+y+'H'+(b+(b>a?-5:5)))+'"/>';});
  return '<svg class="course-diagram diagram-wide" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="订阅回执顺序图">'+body+'</svg>';
}
function diagram(text,id){return flow(text,id)||sequence(text,id);}
module.exports={diagram,escape};
