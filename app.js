/* Muhandislik loyihalarini boshqarish — onlayn kurs (v2) */
(function(){
"use strict";

const SCRIPT_URL = (window.CONFIG && window.CONFIG.SCRIPT_URL) || "";

/* ---------- CPM trenajyor ma’lumotlari (Code.gs dagi ACTS bilan bir xil) ---------- */
const ACTS = [
  {id:"A", name:"Tayyorgarlik ishlari (geodezik bo‘lish, trassani tozalash)", pre:[],        r:[4,7]},
  {id:"B", name:"Yer polotnosi uchun qazish ishlari",                        pre:["A"],     r:[8,13]},
  {id:"C", name:"Suv o‘tkazuvchi quvurlarni o‘rnatish",                      pre:["A"],     r:[5,14]},
  {id:"D", name:"Yer polotnosini to‘kish va zichlash",                       pre:["B"],     r:[5,9]},
  {id:"E", name:"Qum-shag‘al asos qatlami",                                  pre:["C","D"], r:[6,10]},
  {id:"F", name:"Chaqiq tosh asos qatlami",                                  pre:["E"],     r:[4,8]},
  {id:"G", name:"Asfaltbeton qoplama yotqizish",                             pre:["F"],     r:[4,7]},
  {id:"H", name:"Yo‘l yoqasi va kyuvetlarni shakllantirish",                 pre:["D"],     r:[3,16]},
  {id:"I", name:"Yo‘l belgilari va chiziqlarini o‘rnatish",                  pre:["G","H"], r:[2,4]}
];
const POS = {A:[0,1],B:[1,0],C:[1,2],D:[2,0],E:[3,1],F:[4,1],G:[5,1],H:[4,0],I:[6,1]};

/* ---------- yordamchilar ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
function h(tag, attrs, ...kids){
  const e=document.createElement(tag);
  if(attrs) for(const k in attrs){ const v=attrs[k]; if(v==null||v===false) continue;
    if(k==="class") e.className=v; else if(k==="text") e.textContent=v; else if(k==="html") e.innerHTML=v; else if(k.startsWith("on")) e.addEventListener(k.slice(2),v); else e.setAttribute(k,v===true?"":v); }
  for(const k of kids.flat()){ if(k==null||k===false) continue; e.append(k.nodeType?k:document.createTextNode(String(k))); }
  return e;
}
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function fmtDate(iso){ const d=new Date(iso); if(isNaN(d)) return String(iso||""); const p=n=>String(n).padStart(2,"0"); return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const newId=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
const app=()=>$("#app");
const reduce=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- holat ---------- */
const S={
  course:null, meta:null,
  profile: lsGet("mlb.profile",{fio:"",guruh:""}),
  attempts: lsGet("mlb.attempts",[]),
  pending: lsGet("mlb.pending",[]),
  device: lsGet("mlb.device",null) || (()=>{ const d=newId(); lsSet("mlb.device",d); return d; })()
};
function saveLocal(){ lsSet("mlb.profile",S.profile); lsSet("mlb.attempts",S.attempts); lsSet("mlb.pending",S.pending); }
const hasId=()=>!!(S.profile.fio&&S.profile.guruh);

function setStatus(kind){
  const el=$("#status"), t=$("span",el);
  el.dataset.s=kind==="ok"?"ok":kind==="wait"?"wait":"local";
  t.textContent = kind==="ok" ? "Jurnalga ulangan" : kind==="demo" ? "Jurnal ulanmagan" : kind==="offline" ? "Aloqa yo‘q: natijalar keyin yuboriladi" : "Tekshirilmoqda…";
}

/* ---------- server bilan aloqa ---------- */
async function api(params){
  const r=await fetch(SCRIPT_URL+"?"+new URLSearchParams(params).toString());
  return r.json();
}
async function post(payload){
  if(!SCRIPT_URL) return {mode:"demo"};
  const body=JSON.stringify(payload);
  try{
    const r=await fetch(SCRIPT_URL,{method:"POST",body,headers:{"Content-Type":"text/plain;charset=utf-8"}});
    const j=await r.json();
    return j&&j.ok ? {mode:"ok",server:j} : {mode:"error",msg:(j&&j.error)||"Noma’lum xato"};
  }catch(e){
    try{ await fetch(SCRIPT_URL,{method:"POST",mode:"no-cors",body}); return {mode:"sent"}; }
    catch(e2){ return {mode:"offline"}; }
  }
}
async function submitAttempt(att,payload){
  S.attempts.push(att); saveLocal();
  const res=await post(payload);
  if(res.mode==="ok"||res.mode==="sent"){ att.sent=true; if(res.server&&typeof res.server.score==="number"){ att.score=res.server.score; att.max=res.server.max; } setStatus("ok"); }
  else if(res.mode==="offline"){ S.pending.push(payload); setStatus("offline"); }
  else if(res.mode==="error"){ att.error=res.msg; }
  saveLocal();
  return res;
}
let flushing=false;
async function flushPending(){
  if(flushing||!SCRIPT_URL||!S.pending.length) return;
  flushing=true;
  const left=[];
  for(const p of S.pending){
    const r=await post(p);
    const a=S.attempts.find(x=>x.id===p.id);
    if(r.mode==="ok"||r.mode==="sent"){ if(a){ a.sent=true; if(r.server&&typeof r.server.score==="number"){a.score=r.server.score;a.max=r.server.max;} } }
    else if(r.mode==="offline") left.push(p);
    else if(a) a.error=r.msg;
  }
  S.pending=left; saveLocal();
  setStatus(left.length?"offline":"ok");
  flushing=false;
  if(currentRoute==="natijalar") render();
}
window.addEventListener("online",flushPending);

function sendNote(res){
  if(res.mode==="ok"||res.mode==="sent") return h("div",{class:"notice ok",text:"Natija o‘qituvchi jurnaliga yuborildi."});
  if(res.mode==="demo") return h("div",{class:"notice warn",text:"Sayt jurnalga ulanmagan: natija faqat shu qurilmada saqlandi."});
  if(res.mode==="offline") return h("div",{class:"notice warn",text:"Internet aloqasi yo‘q. Natija saqlandi va aloqa tiklanganda avtomatik yuboriladi."});
  return h("div",{class:"notice bad",text:"Natija qabul qilinmadi: "+res.msg});
}

/* ---------- kontent ---------- */
const fragCache={};
async function frag(path){
  if(fragCache[path]) return fragCache[path];
  const r=await fetch(path,{cache:"no-cache"});
  if(!r.ok) throw new Error(r.status);
  return (fragCache[path]=await r.text());
}
async function loadMeta(){
  if(!SCRIPT_URL){ S.meta={counts:{},materials:[]}; return; }
  try{
    const j=await api({action:"meta"});
    if(j.ok){ S.meta={counts:j.counts||{},materials:j.materials||[]}; lsSet("mlb.meta",S.meta); setStatus(S.pending.length?"offline":"ok"); }
  }catch(e){ S.meta=lsGet("mlb.meta",{counts:{},materials:[]}); setStatus("offline"); }
}
const lectures=()=>S.course.maruzalar;
const practicals=()=>S.course.amaliy;
const lecture=n=>lectures().find(x=>x.n===n);
const practical=id=>practicals().find(x=>x.id===id);
const qCount=n=>(S.meta&&S.meta.counts&&S.meta.counts[n])||0;
function matsFor(key){
  const list=(S.meta&&S.meta.materials)||[];
  const norm=k=>String(k).toUpperCase().replace(/^A0*/,"A").replace(/^0+/,"");
  return list.filter(m=>norm(m.topic)===norm(key));
}

/* ---------- materiallar (taqdimotlar) ---------- */
function embedUrl(u){
  let m;
  if((m=u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if((m=u.match(/drive\.google\.com\/open\?id=([\w-]+)/))) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if((m=u.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/))) return `https://docs.google.com/presentation/d/${m[1]}/embed`;
  if((m=u.match(/docs\.google\.com\/(document|spreadsheets)\/d\/([\w-]+)/))) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  if((m=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/))) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}
function matsBlock(key){
  const list=matsFor(key);
  if(!list.length) return null;
  return h("div",{class:"mats"},
    h("h3",{text:"Taqdimot va materiallar"}),
    list.map((m,i)=>{
      const emb=embedUrl(m.url);
      const box=h("div",{class:"mat"});
      const frame=()=>h("iframe",{src:emb,loading:"lazy",allow:"autoplay; fullscreen",allowfullscreen:true,title:m.title||m.type});
      const toggle=emb?h("button",{class:"btn small",type:"button",text:i===0?"Yopish":"Shu yerda ko‘rish",onclick:e=>{
        const f=$("iframe",box); if(f){ f.remove(); e.target.textContent="Shu yerda ko‘rish"; } else { box.append(frame()); e.target.textContent="Yopish"; }
      }}):null;
      box.append(h("div",{class:"mat-h"},
        h("div",{class:"row",style:"gap:8px"},h("span",{class:"pill acc",text:m.type||"Material"}),h("b",{text:m.title||"Material"})),
        h("div",{class:"row",style:"gap:6px"},toggle,h("a",{class:"btn small",href:m.url,target:"_blank",rel:"noopener",text:"Ochish ↗"}))));
      if(emb&&i===0) box.append(frame());
      return box;
    }));
}

/* ---------- navigatsiya ---------- */
let currentRoute="kurs";
function go(route){ if(location.hash.slice(1)===route) render(); else location.hash=route; }
window.addEventListener("hashchange",()=>render());
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-tab]"); if(t){ go(t.dataset.tab); return; }
  const g=e.target.closest("[data-go]"); if(g){ e.preventDefault(); go(g.dataset.go); }
});
function setTab(name){ for(const b of $$(".tab")) b.setAttribute("aria-selected",b.dataset.tab===name?"true":"false"); }

async function render(){
  const r=(location.hash||"#kurs").slice(1)||"kurs";
  currentRoute=r;
  let m;
  try{
    if(r==="kurs"){ setTab("kurs"); viewHome(); }
    else if(r==="maruzalar"){ setTab("maruzalar"); viewLectureList(); }
    else if(r==="amaliy"){ setTab("amaliy"); viewPracticalList(); }
    else if(r==="testlar"){ setTab("testlar"); viewTestList(); }
    else if(r==="natijalar"){ setTab("natijalar"); viewResults(); }
    else if(r==="oqituvchi"){ $("#tab-teacher").hidden=false; setTab("oqituvchi"); viewTeacher(); }
    else if(r==="adabiyot"){ setTab("maruzalar"); await viewLiterature(); }
    else if((m=r.match(/^maruza-(\d+)$/))){ setTab("maruzalar"); await viewLecture(+m[1]); }
    else if((m=r.match(/^amaliy-(\d+)$/))){ setTab("amaliy"); await viewPractical(m[1].padStart(2,"0")); }
    else if((m=r.match(/^test-(\d+)$/))){ setTab("testlar"); viewTest(+m[1]); }
    else { setTab("kurs"); viewHome(); }
  }catch(e){
    app().replaceChildren(h("div",{class:"notice bad",text:"Sahifani yuklab bo‘lmadi. Internetni tekshirib, sahifani yangilang."}));
  }
  if(!/^(maruza|amaliy)-/.test(r)) window.scrollTo(0,0);
}

/* ---------- bosh sahifa ---------- */
function lectureRow(L){
  const c=qCount(L.n), mats=matsFor(L.n).length;
  return h("li",null,h("span",{class:"n",text:String(L.n).padStart(2,"0")}),
    h("span",{class:"t"},h("a",{href:"#maruza-"+L.n,text:L.title})),
    h("span",{class:"acts"},
      mats?h("span",{class:"pill acc",text:"Taqdimot"}):null,
      c?h("a",{class:"pill open",href:"#test-"+L.n,text:`Test · ${c}`}):null));
}
function practicalRow(P){
  const mats=matsFor("A"+(+P.id)).length;
  return h("li",null,h("span",{class:"n",text:P.label}),
    h("span",{class:"t"},h("a",{href:"#amaliy-"+P.id,text:P.title})),
    h("span",{class:"acts"},mats?h("span",{class:"pill acc",text:"Material"}):null,hasTrainer(P.id)?h("span",{class:"pill crit",text:"Trenajyor"}):null));
}
function viewHome(){
  const intro=h("div",{class:"prose",html:"<p class='muted'>Yuklanmoqda…</p>"});
  frag("content/kirish.html").then(t=>{ intro.innerHTML=t; }).catch(()=>{ intro.textContent=""; });
  app().replaceChildren(h("section",{class:"view"},
    h("ol",{class:"steps"},
      h("li",null,h("h3",{text:"Ism va guruhingizni kiriting"}),h("p",{class:"muted"},"«Natijalarim» bo‘limida bir marta to‘ldiriladi.")),
      h("li",null,h("h3",{text:"Ma’ruzani o‘qing"}),h("p",{class:"muted"},"15 ta mavzu, taqdimotlar bilan.")),
      h("li",null,h("h3",{text:"Test va amaliy topshiriqlarni bajaring"}),h("p",{class:"muted"},"Ballar o‘qituvchi jurnaliga avtomatik tushadi."))),
    h("div",{class:"home-grid"},
      h("div",{class:"stack"},h("h2",{text:"Ma’ruzalar"}),h("ul",{class:"list"},lectures().map(lectureRow)),
        h("p",null,h("a",{href:"#adabiyot",text:"Tavsiya etiladigan adabiyotlar"}))),
      h("div",{class:"stack",style:"align-content:start"},h("h2",{text:"Amaliy mashg‘ulotlar"}),h("ul",{class:"list"},practicals().map(practicalRow)))),
    h("div",{class:"stack",style:"padding-top:12px;border-top:1px solid var(--line)"},h("span",{class:"eyebrow",text:"Fan haqida"}),intro)
  ));
}
function viewLectureList(){
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"stack"},h("h2",{text:"Ma’ruzalar"}),h("p",{class:"muted",text:"Mavzuni tanlang. Har bir mavzu oxirida nazorat savollari, keyin esa test bor."})),
    h("ul",{class:"list"},lectures().map(lectureRow)),
    h("p",null,h("a",{href:"#adabiyot",text:"Tavsiya etiladigan adabiyotlar ro‘yxati"}))));
}
function viewPracticalList(){
  const intro=h("div",{class:"prose"});
  frag("content/amaliy-kirish.html").then(t=>{ intro.innerHTML=t; }).catch(()=>{});
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"stack"},h("h2",{text:"Amaliy mashg‘ulotlar"})),
    h("ul",{class:"list"},practicals().map(practicalRow)),
    h("details",null,h("summary",{class:"linkbtn",text:"Fan haqida qisqacha ma’lumot va kirish"}),h("div",{style:"padding-top:14px"},intro))));
}
function viewTestList(){
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"stack"},h("h2",{text:"Testlar"}),h("p",{class:"muted",text:"Har bir testda mavzu bo‘yicha savollar bankidan tasodifiy savollar beriladi. Testni bir necha marta topshirish mumkin, jurnalda eng yaxshi natija hisobga olinadi."})),
    !SCRIPT_URL?h("div",{class:"notice warn",text:"Testlar Google-jadvaldan yuklanadi. Sayt hali jadvalga ulanmagan."}):null,
    h("ul",{class:"list"},lectures().map(L=>{
      const c=qCount(L.n);
      return h("li",null,h("span",{class:"n",text:String(L.n).padStart(2,"0")}),
        h("span",{class:"t"},c?h("a",{href:"#test-"+L.n,text:L.title}):h("span",{class:"muted",text:L.title})),
        h("span",{class:"acts"},h("span",{class:"pill"+(c?" open":""),text:c?`${c} ta savol`:"Savollar yo‘q"})));
    }))));
}

/* ---------- o‘qish sahifalari ---------- */
function addToc(container){
  const hs=$$("h2",container);
  hs.forEach((x,i)=>{ x.id="b"+(i+1); });
  if(hs.length<2) return null;
  return h("nav",{class:"toc","aria-label":"Mundarija"},h("span",{class:"eyebrow",text:"Mundarija"}),hs.map(x=>h("a",{href:"#",text:x.textContent,onclick:e=>{e.preventDefault();x.scrollIntoView({behavior:reduce()?"auto":"smooth",block:"start"});}})));
}
async function viewLecture(n){
  const L=lecture(n); if(!L){ go("maruzalar"); return; }
  app().replaceChildren(h("p",{class:"loading",text:"Ma’ruza yuklanmoqda…"}));
  const html=await frag(`content/maruza/${String(n).padStart(2,"0")}.html`);
  const body=h("article",{class:"prose",html});
  const prev=lecture(n-1), next=lecture(n+1), c=qCount(n);
  const toc=addToc(body);
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"page-head"},
      h("span",{class:"eyebrow",text:`${n}-mavzu · Ma’ruza`}),
      h("h1",{text:L.title}),
      h("div",{class:"row"},c?h("a",{class:"btn primary small",href:"#test-"+n,text:`Mavzu bo‘yicha test (${c})`}):null,h("a",{class:"btn small",href:"#maruzalar",text:"Barcha mavzular"}))),
    matsBlock(n),
    h("div",{class:"reader"},
      h("div",{class:"stack",style:"min-width:0"},body,
        h("div",{class:"pager"},
          prev?h("a",{class:"btn",href:"#maruza-"+prev.n,text:"← "+prev.n+"-mavzu"}):h("span"),
          c?h("a",{class:"btn primary",href:"#test-"+n,text:"Testni topshirish"}):null,
          next?h("a",{class:"btn",href:"#maruza-"+next.n,text:next.n+"-mavzu →"}):h("span"))),
      toc)));
  window.scrollTo(0,0);
}
async function viewPractical(id){
  const P=practical(id); if(!P){ go("amaliy"); return; }
  app().replaceChildren(h("p",{class:"loading",text:"Yuklanmoqda…"}));
  const html=await frag(`content/amaliy/${id}.html`);
  const body=h("article",{class:"prose",html});
  const list=practicals(), i=list.indexOf(P), prev=list[i-1], next=list[i+1];
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"page-head"},
      h("span",{class:"eyebrow",text:`${P.label}-amaliy mashg‘ulot`}),
      h("h1",{text:P.title}),
      hasTrainer(id)?h("div",{class:"row"},h("button",{class:"btn primary small",type:"button",text:"Trenajyorga o‘tish",onclick:()=>$("#trainer").scrollIntoView({behavior:reduce()?"auto":"smooth"})})):null),
    matsBlock("A"+(+id)),
    h("div",{class:"stack",style:"min-width:0"},body,
      id==="04"?trainer():(window.TRAINERS&&window.TRAINERS[id]?window.TRAINERS[id](appApi()):null),
      h("div",{class:"pager"},
        prev?h("a",{class:"btn",href:"#amaliy-"+prev.id,text:"← "+prev.label+"-mashg‘ulot"}):h("span"),
        next?h("a",{class:"btn",href:"#amaliy-"+next.id,text:next.label+"-mashg‘ulot →"}):h("span")))));
  window.scrollTo(0,0);
}
async function viewLiterature(){
  const [a,b]=await Promise.all([frag("content/adabiyot.html"),frag("content/amaliy-adabiyot.html").catch(()=>"")]);
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"page-head"},h("h1",{text:"Tavsiya etiladigan adabiyotlar"})),
    h("article",{class:"prose",html:a}),
    b?h("h2",{text:"Amaliy mashg‘ulotlar uchun adabiyotlar"}):null,
    b?h("article",{class:"prose",html:b}):null));
}

/* ---------- talaba ---------- */
function gate(){
  if(hasId()) return h("p",{class:"muted",style:"font-size:.9rem"},"Talaba: ",h("b",{text:S.profile.fio}),` · ${S.profile.guruh}-guruh  `,h("a",{href:"#natijalar",text:"o‘zgartirish"}));
  return h("div",{class:"notice warn"},"Natija jurnalga tushishi uchun avval ",h("a",{href:"#natijalar",text:"familiya, ism va guruhingizni kiriting"}),".");
}
const PR_KEYS=[["A4","CPM"],["A5","Yer ishlari"],["A7","Gantt"],["A10","EVM"],["A11","Risklar"]];
function attemptLabel(a){
  if(a.type==="test") return `Test · ${a.topic}-mavzu`;
  if(a.type==="trainer"){ const k=PR_KEYS.find(x=>x[0]===a.key); return `Trenajyor: ${k?k[1]:a.key} (${String(a.key).slice(1)}-amaliy)`; }
  return "CPM trenajyor (4-amaliy)";
}
function hasTrainer(id){ return id==="04"||!!(window.TRAINERS&&window.TRAINERS[id]); }
function appApi(){ return {h,$,$$,gate,hasId,go,submitAttempt,sendNote,newId,profile:()=>S.profile,device:()=>S.device}; }
function prVal(r,k){ const p=r.pr||{}; if(p[k]!==undefined&&p[k]!=="") return p[k]; return k==="A4"?r.cpm:""; }
function viewResults(){
  const fio=h("input",{type:"text",id:"id-fio",maxlength:"80",autocomplete:"name",placeholder:"Masalan: Karimov Jasur",value:S.profile.fio||""});
  const gr=h("input",{type:"text",id:"id-guruh",maxlength:"20",placeholder:"Masalan: 312-21",value:S.profile.guruh||""});
  const msg=h("p",{class:"muted",style:"margin-top:10px;font-size:.88rem","aria-live":"polite"});
  const form=h("form",{class:"panel",novalidate:true},
    h("div",{class:"fields"},h("label",{class:"field"},"Familiya, ism",fio),h("label",{class:"field"},"Guruh",gr),h("button",{class:"btn primary",type:"submit",text:"Saqlash"})),msg);
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const f=fio.value.trim().replace(/\s+/g," "), g=gr.value.trim().replace(/\s+/g,"");
    if(f.length<3){ msg.textContent="Familiya va ismingizni to‘liq kiriting."; return; }
    if(!g){ msg.textContent="Guruh raqamini kiriting."; return; }
    S.profile={fio:f,guruh:g}; saveLocal(); msg.textContent="Saqlandi. Endi test va topshiriqlarni bajarishingiz mumkin.";
  });
  const n=S.pending.length;
  const rows=S.attempts.slice().reverse();
  app().replaceChildren(h("section",{class:"view",style:"max-width:880px"},
    h("div",{class:"stack"},h("h2",{text:"Natijalarim"}),h("p",{class:"muted",text:"Familiya, ism va guruhingiz o‘qituvchi jurnalida shu ko‘rinishda chiqadi. Har doim bir xil yozing."})),
    form,
    h("div",{class:"stack"},h("h3",{text:"Urinishlar"}),
      n?h("div",{class:"notice warn row between"},h("span",{text:`${n} ta natija hali yuborilmagan.`}),h("button",{class:"btn small",type:"button",text:"Qayta yuborish",onclick:flushPending})):null,
      h("div",{class:"tbl-wrap"},h("table",{class:"t"},
        rows.length?[
          h("thead",null,h("tr",null,h("th",{text:"Sana"}),h("th",{text:"Topshiriq"}),h("th",{class:"num",text:"Ball"}),h("th",{text:"Holat"}))),
          h("tbody",null,rows.map(a=>h("tr",null,
            h("td",{class:"mono",style:"white-space:nowrap",text:fmtDate(a.at)}),
            h("td",{text:attemptLabel(a)}),
            h("td",{class:"num",text:a.score==null?"—":`${a.score}/${a.max}`}),
            h("td",null,h("span",{class:"pill"+(a.sent?" open":a.error?" crit":""),text:a.sent?"Yuborilgan":a.error?"Qabul qilinmadi":SCRIPT_URL?"Kutilmoqda":"Shu qurilmada"})))))
        ]:h("tbody",null,h("tr",null,h("td",{class:"empty",text:"Hali urinishlar yo‘q. Test yoki trenajyorni bajaring, natija shu yerda paydo bo‘ladi."}))))))));
}

/* ---------- test ---------- */
function viewTest(n){
  const L=lecture(n); if(!L){ go("testlar"); return; }
  const area=h("div",{class:"stack"});
  app().replaceChildren(h("section",{class:"view",style:"max-width:880px"},
    h("div",{class:"stack"},h("span",{class:"eyebrow",text:`${n}-mavzu · Test`}),h("h2",{text:L.title}),
      h("p",{class:"muted",text:"Har bir to‘g‘ri javob 1 ball. Yuborganingizdan keyin to‘g‘ri javoblar va izohlar ko‘rsatiladi."})),
    gate(), area));
  loadTest(n,area);
}
async function loadTest(n,area){
  if(!SCRIPT_URL){ area.replaceChildren(h("div",{class:"notice warn",text:"Testlar Google-jadvaldan yuklanadi. Sayt hali jadvalga ulanmagan."})); return; }
  area.replaceChildren(h("p",{class:"loading",text:"Savollar yuklanmoqda…"}));
  let j;
  try{ j=await api({action:"questions",topic:n}); }
  catch(e){ area.replaceChildren(h("div",{class:"notice bad",text:"Savollarni yuklab bo‘lmadi. Internetni tekshiring."}),h("button",{class:"btn",type:"button",text:"Qayta urinish",onclick:()=>loadTest(n,area)})); return; }
  if(!j.ok){ area.replaceChildren(h("div",{class:"notice bad",text:"Xato: "+j.error})); return; }
  const qs=j.questions||[];
  if(!qs.length){ area.replaceChildren(h("div",{class:"notice warn",text:"Bu mavzu bo‘yicha hali savollar qo‘shilmagan."})); return; }
  const form=h("form",{class:"stack",novalidate:true});
  const left=h("span",{class:"muted",style:"font-size:.9rem"});
  const upd=()=>{ const k=qs.filter(q=>$(`input[name="${CSS.escape(q.id)}"]:checked`,form)).length; left.textContent=`Javob berildi: ${k}/${qs.length}`; };
  const submit=h("button",{class:"btn primary",type:"submit",text:"Javoblarni yuborish"});
  form.append(...qs.map((q,i)=>h("fieldset",{class:"q","data-id":q.id},
    h("legend",{class:"q-h",style:"padding:0;float:left;width:100%"},h("span",{class:"n",text:`${i+1}/${qs.length}`}),h("span",{style:"font-weight:600",text:q.q})),
    h("div",{class:"opts",style:"clear:both"},shuffle(q.options).map(o=>h("label",{class:"opt","data-k":o.k},
      h("input",{type:"radio",name:q.id,value:o.k}),h("span",{text:o.t})))))),
    h("div",{class:"row"},submit,left));
  form.addEventListener("change",upd); upd();
  const result=h("div",{class:"stack"});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(submit.disabled) return;
    if(!hasId()){ go("natijalar"); return; }
    const answers={};
    for(const q of qs){ const c=$(`input[name="${CSS.escape(q.id)}"]:checked`,form); if(c) answers[q.id]=c.value; }
    const miss=qs.length-Object.keys(answers).length;
    if(miss){ left.textContent=`Yana ${miss} ta savolga javob bering.`; return; }
    submit.disabled=true; $$("input",form).forEach(i=>i.disabled=true);
    result.replaceChildren(h("p",{class:"muted",text:"Tekshirilmoqda…"}));
    const at=new Date().toISOString(), id=newId();
    const att={id,type:"test",topic:n,score:null,max:qs.length,at,sent:false};
    const payload={id,type:"test",topic:n,fio:S.profile.fio,guruh:S.profile.guruh,device:S.device,at,answers};
    const res=await submitAttempt(att,payload);
    const sv=res.server;
    if(sv&&sv.results){
      for(const q of qs){
        const fs=$(`[data-id="${CSS.escape(q.id)}"]`,form), r=sv.results[q.id]; if(!r) continue;
        for(const l of $$(".opt",fs)){ if(l.dataset.k===r.right) l.classList.add("right"); else if(l.dataset.k===answers[q.id]) l.classList.add("wrong"); }
        if(r.izoh) fs.append(h("p",{class:"izoh",text:r.izoh}));
      }
    }
    const sc=sv&&typeof sv.score==="number";
    result.replaceChildren(
      sc?h("div",{class:"panel score"},h("span",{class:"big num",text:`${sv.score}/${sv.max}`}),h("span",{class:"muted",text:grade(sv.score/sv.max)})):null,
      sendNote(res),
      h("div",{class:"row"},h("button",{class:"btn",type:"button",text:"Testni qayta topshirish",onclick:()=>{ viewTest(n); }}),
        lecture(n+1)?h("a",{class:"btn",href:"#maruza-"+(n+1),text:`${n+1}-mavzuga o‘tish →`}):null));
    result.scrollIntoView({behavior:reduce()?"auto":"smooth",block:"nearest"});
  });
  area.replaceChildren(form,result);
}
const grade=r=>r>=.86?"A’lo":r>=.71?"Yaxshi":r>=.55?"Qoniqarli":"Mavzuni qayta o‘qib chiqing";

/* ---------- CPM ---------- */
function cpm(d){
  const r={};
  for(const a of ACTS){ const es=a.pre.length?Math.max(...a.pre.map(p=>r[p].ef)):0; r[a.id]={t:d[a.id],es,ef:es+d[a.id]}; }
  const T=Math.max(...ACTS.map(a=>r[a.id].ef));
  for(const a of ACTS.slice().reverse()){
    const succ=ACTS.filter(s=>s.pre.includes(a.id));
    const lf=succ.length?Math.min(...succ.map(s=>r[s.id].ls)):T;
    r[a.id].lf=lf; r[a.id].ls=lf-d[a.id]; r[a.id].tf=r[a.id].ls-r[a.id].es;
  }
  return {r,T,crit:ACTS.filter(a=>r[a.id].tf===0).map(a=>a.id)};
}
const SVGNS="http://www.w3.org/2000/svg";
function s(tag,attrs,text){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!=null)e.textContent=text;return e;}
let svgN=0;
function netEl(res){
  svgN++;
  const CW=136, RH=104, NW=112, NH=72, PX=12, PY=14;
  const W=7*CW-(CW-NW)+PX*2, H=3*RH-(RH-NH)+PY*2;
  const svg=s("svg",{viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:"img","aria-label":"Tarmoq grafigi"});
  const defs=s("defs",{});
  for(const [id,col] of [["arr","var(--muted)"],["arrc","var(--mark)"]]){
    const m=s("marker",{id:id+"-"+svgN,viewBox:"0 0 10 10",refX:"9",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"});
    m.append(s("path",{d:"M0,0 L10,5 L0,10 z",fill:col})); defs.append(m);
  }
  svg.append(defs);
  const xy=id=>[PX+POS[id][0]*CW, PY+POS[id][1]*RH];
  for(const a of ACTS) for(const p of a.pre){
    const [x1,y1]=xy(p),[x2,y2]=xy(a.id);
    const c=res.r[p].tf===0&&res.r[a.id].tf===0&&res.r[p].ef===res.r[a.id].es;
    svg.append(s("line",{x1:x1+NW,y1:y1+NH/2,x2:x2-2,y2:y2+NH/2,stroke:c?"var(--mark)":"var(--muted)","stroke-width":c?3:1.4,"marker-end":`url(#${c?"arrc":"arr"}-${svgN})`}));
  }
  for(const a of ACTS){
    const [x,y]=xy(a.id), v=res.r[a.id], c=v.tf===0;
    const g=s("g",{});
    g.append(s("rect",{x,y,width:NW,height:NH,rx:8,fill:c?"var(--crit-bg)":"var(--surface)",stroke:c?"var(--mark)":"var(--line)","stroke-width":c?2:1.2}));
    g.append(s("line",{x1:x,y1:y+22,x2:x+NW,y2:y+22,stroke:c?"var(--mark)":"var(--line)"}));
    g.append(s("line",{x1:x,y1:y+NH-22,x2:x+NW,y2:y+NH-22,stroke:c?"var(--mark)":"var(--line)"}));
    const T=(tx,ty,str,ex)=>s("text",Object.assign({x:tx,y:ty,"text-anchor":"middle",fill:"var(--ink)","font-family":"JetBrains Mono, ui-monospace, monospace","font-size":"12"},ex||{}),str);
    g.append(T(x+18,y+15,v.es),T(x+NW/2,y+15,v.t,{fill:"var(--muted)"}),T(x+NW-18,y+15,v.ef));
    g.append(T(x+NW/2,y+NH/2+6,a.id,{"font-size":"17","font-weight":"600","font-family":"Golos Text, system-ui, sans-serif",fill:c?"var(--crit-ink)":"var(--ink)"}));
    g.append(T(x+18,y+NH-7,v.ls),T(x+NW/2,y+NH-7,v.tf,{fill:c?"var(--crit-ink)":"var(--muted)","font-weight":c?"600":"400"}),T(x+NW-18,y+NH-7,v.lf));
    svg.append(g);
  }
  return svg;
}
function fullTable(res){
  return h("table",{class:"t"},
    h("thead",null,h("tr",null,h("th",{text:"Ish"}),h("th",{text:"Nomi"}),h("th",{text:"Oldingi"}),...["t","ES","EF","LS","LF","TF"].map(x=>h("th",{class:"num",text:x})))),
    h("tbody",null,ACTS.map(a=>{const v=res.r[a.id];return h("tr",{class:v.tf===0?"crit":null},
      h("td",{class:"mono",text:a.id}),h("td",{text:a.name}),h("td",{class:"mono",text:a.pre.join(", ")||"—"}),
      ...[v.t,v.es,v.ef,v.ls,v.lf,v.tf].map(n=>h("td",{class:"num",text:n})));})));
}
function trainer(){
  const box=h("div",{class:"trainer",id:"trainer"});
  const taskTbl=h("div",{class:"tbl-wrap"}), out=h("div",{class:"stack"});
  const inT=h("input",{type:"number",id:"cpm-T",min:"0",step:"1",inputmode:"numeric"});
  const inF=h("input",{type:"number",id:"cpm-TF",min:"0",step:"1",inputmode:"numeric"});
  const tfLabel=h("span");
  const checks=h("div",{class:"checks"});
  const submit=h("button",{type:"submit",class:"btn primary",text:"Tekshirish"});
  let task=null;
  function newTask(){
    const d={}; ACTS.forEach(a=>d[a.id]=rnd(a.r[0],a.r[1]));
    const res=cpm(d);
    const pool=ACTS.filter(a=>res.r[a.id].tf>0).map(a=>a.id);
    const ask=(pool.length?pool:ACTS.map(a=>a.id))[Math.floor(Math.random()*(pool.length||ACTS.length))];
    task={d,res,ask};
    taskTbl.replaceChildren(h("table",{class:"t"},
      h("thead",null,h("tr",null,h("th",{text:"Ish"}),h("th",{text:"Nomi"}),h("th",{text:"Oldingi ishlar"}),h("th",{class:"num",text:"t, kun"}))),
      h("tbody",null,ACTS.map(a=>h("tr",null,h("td",{class:"mono",text:a.id}),h("td",{text:a.name}),h("td",{class:"mono",text:a.pre.join(", ")||"—"}),h("td",{class:"num",text:d[a.id]}))))));
    tfLabel.textContent=`3. ${ask} ishning to‘liq zaxirasi TF, kun`;
    inT.value=""; inF.value="";
    checks.replaceChildren(...ACTS.map(a=>h("label",{class:"chk"},h("input",{type:"checkbox",value:a.id,id:"cc-"+a.id}),a.id)));
    submit.disabled=false; out.replaceChildren();
  }
  const form=h("form",{class:"panel stack",novalidate:true},
    h("div",{class:"task-grid"},h("label",{class:"field"},"1. Loyiha davomiyligi T, kun",inT),h("label",{class:"field"},tfLabel,inF)),
    h("div",{class:"stack",style:"gap:8px"},h("span",{class:"muted",style:"font-size:.88rem",text:"2. Kritik yo‘ldagi ishlarni belgilang"}),checks),
    h("div",{class:"row"},submit,h("button",{type:"button",class:"btn",text:"Yangi variant",onclick:newTask})));
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!task||submit.disabled) return;
    if(!hasId()){ go("natijalar"); return; }
    const T=inT.value, TF=inF.value, picked=$$("input:checked",checks).map(i=>i.value).sort();
    if(T===""||TF===""||!picked.length){ out.replaceChildren(h("div",{class:"notice warn",text:"Uchala savolga ham javob bering."})); return; }
    submit.disabled=true;
    const {res,ask,d}=task;
    const okT=+T===res.T, okC=picked.join()===res.crit.slice().sort().join(), okF=+TF===res.r[ask].tf;
    const score=[okT,okC,okF].filter(Boolean).length;
    const mark=(ok,txt,right)=>h("li",null,h("span",{class:"pill "+(ok?"open":"crit"),text:ok?"To‘g‘ri":"Xato"})," ",txt, ok?"":h("span",{class:"muted",text:` — to‘g‘ri javob: ${right}`}));
    const at=new Date().toISOString(), id=newId();
    const att={id,type:"cpm",score,max:3,at,sent:false};
    const payload={id,type:"cpm",topic:"A4",fio:S.profile.fio,guruh:S.profile.guruh,device:S.device,at,d,ask,answers:{T:+T,crit:picked,tf:+TF}};
    const note=h("p",{class:"muted",text:"Yuborilmoqda…"});
    out.replaceChildren(
      h("div",{class:"panel stack"},h("div",{class:"score"},h("span",{class:"big num",text:`${score}/3`}),h("span",{class:"muted",text:"ball"})),
        h("ul",{style:"margin:0;padding:0;list-style:none;display:grid;gap:8px"},
          mark(okT,"Loyiha davomiyligi",`${res.T} kun`),mark(okC,"Kritik yo‘l",res.crit.join(" → ")),mark(okF,`${ask} ishning zaxirasi`,`${res.r[ask].tf} kun`))),
      note, h("h3",{text:"Yechim"}), h("div",{class:"tbl-wrap"},fullTable(res)), h("div",{class:"net-wrap"},netEl(res)),
      h("div",{class:"legend"},h("span",null,h("b",{style:"background:var(--mark)"}),"kritik bog‘liqlik"),h("span",null,h("b",{style:"background:var(--muted)"}),"oddiy bog‘liqlik"),h("span",{class:"mono",text:"ES | t | EF  ·  LS | TF | LF"})),
      h("div",{class:"row"},h("button",{class:"btn primary",type:"button",text:"Yangi variant",onclick:()=>{newTask();box.scrollIntoView({block:"start"});}})));
    const sres=await submitAttempt(att,payload);
    note.replaceWith(sendNote(sres));
  });
  box.append(
    h("div",{class:"stack"},h("span",{class:"eyebrow",text:"Interaktiv trenajyor"}),h("h2",{text:"Kritik yo‘lni toping"}),
      h("p",{class:"muted",text:"Ishlar «ish tugunda» (AON) ko‘rinishida berilgan. Har bir variantda davomiyliklar har xil. Jadval asosida hisoblang va javoblarni kiriting. Topshiriq 3 ballik va jurnalga yoziladi."})),
    gate(), taskTbl, form, out);
  newTask();
  return box;
}

/* ---------- o‘qituvchi paneli ---------- */
let jrows=[];
function viewTeacher(){
  const key=h("input",{type:"password",id:"t-key",autocomplete:"current-password"});
  try{ key.value=sessionStorage.getItem("mlb.key")||""; }catch(e){}
  const msg=h("p",{class:"muted",style:"margin-top:10px;font-size:.88rem","aria-live":"polite"});
  const body=h("div",{class:"stack",hidden:true});
  const sel=h("select",{id:"t-group"},h("option",{value:"",text:"Barcha guruhlar"}));
  const kpis=h("div",{class:"kpis"}), tbl=h("div",{class:"tbl-wrap"});
  const filtered=()=>jrows.filter(r=>!sel.value||r.guruh===sel.value);
  function cell(v){ if(v===""||v==null) return h("td",{class:"c muted",text:"·"}); const p=Math.round(+v); return h("td",{class:"c "+(p>=86?"cell-hi":p>=55?"cell-mid":"cell-lo"),text:p}); }
  function draw(){
    const g=sel.value, groups=[...new Set(jrows.map(r=>r.guruh).filter(Boolean))].sort();
    sel.replaceChildren(h("option",{value:"",text:"Barcha guruhlar"}),...groups.map(x=>h("option",{value:x,text:x}))); sel.value=groups.includes(g)?g:"";
    const list=filtered();
    const all=[]; list.forEach(r=>Object.values(r.tests||{}).forEach(v=>all.push(+v)));
    kpis.replaceChildren(
      h("div",{class:"kpi"},h("span",{class:"eyebrow",text:"Talabalar"}),h("span",{class:"v num",text:list.length})),
      h("div",{class:"kpi"},h("span",{class:"eyebrow",text:"Testlar o‘rtachasi"}),h("span",{class:"v num",text:all.length?Math.round(all.reduce((a,b)=>a+b,0)/all.length)+"%":"—"})),
      h("div",{class:"kpi"},h("span",{class:"eyebrow",text:"Urinishlar jami"}),h("span",{class:"v num",text:list.reduce((a,r)=>a+(r.n||0),0)})));
    if(!list.length){ tbl.replaceChildren(h("p",{class:"empty",text:"Hozircha natijalar yo‘q."})); return; }
    const T=lectures().map(L=>L.n);
    tbl.replaceChildren(h("table",{class:"t mx"},
      h("thead",null,h("tr",null,h("th",{class:"sticky-col",text:"Talaba"}),h("th",{text:"Guruh"}),...T.map(t=>h("th",{class:"num",title:lecture(t).title,text:"T"+t})),...PR_KEYS.map(([k,n])=>h("th",{class:"num",title:n,text:k})),h("th",{text:"Oxirgi"}))),
      h("tbody",null,list.map(r=>h("tr",null,h("td",{class:"sticky-col",style:"white-space:nowrap",text:r.fio}),h("td",{class:"mono",text:r.guruh}),
        ...T.map(t=>cell((r.tests||{})[t])),...PR_KEYS.map(([k])=>cell(prVal(r,k))),h("td",{class:"mono",style:"white-space:nowrap;font-size:.82rem",text:r.last?fmtDate(r.last):"—"}))))));
  }
  async function load(){
    if(!SCRIPT_URL){ msg.textContent="Sayt Google-jadvalga ulanmagan: config.js faylida SCRIPT_URL ni to‘ldiring."; return; }
    if(!key.value.trim()){ msg.textContent="Kalitni kiriting."; return; }
    msg.textContent="Yuklanmoqda…";
    try{
      const j=await api({action:"journal",key:key.value.trim()});
      if(!j.ok){ msg.textContent=j.error==="bad_key"?"Kalit noto‘g‘ri.":"Xato: "+j.error; return; }
      try{ sessionStorage.setItem("mlb.key",key.value.trim()); }catch(e){}
      jrows=j.rows||[]; msg.textContent=`Yangilandi: ${fmtDate(new Date().toISOString())}. Kataklarda — eng yaxshi natija, %.`;
      body.hidden=false; draw();
    }catch(e){ msg.textContent="Jadvalga ulanib bo‘lmadi. Internetni tekshiring."; }
  }
  sel.addEventListener("change",draw);
  const form=h("form",{class:"panel",novalidate:true},
    h("div",{class:"fields",style:"grid-template-columns:1fr auto"},h("label",{class:"field"},"O‘qituvchi kaliti",key),h("button",{class:"btn primary",type:"submit",text:"Jurnalni yuklash"})),msg);
  form.addEventListener("submit",e=>{e.preventDefault();load();});
  const csv=h("button",{class:"btn",type:"button",text:"CSV yuklab olish",onclick:()=>{
    const q=v=>`"${String(v==null?"":v).replace(/"/g,'""')}"`;
    const T=lectures().map(L=>L.n);
    const lines=[["Talaba","Guruh",...T.map(t=>"T"+t+" %"),...PR_KEYS.map(([k,n])=>`${k} ${n} %`),"Urinishlar","Oxirgi faollik"].map(q).join(";")]
      .concat(filtered().map(r=>[r.fio,r.guruh,...T.map(t=>(r.tests||{})[t]??""),...PR_KEYS.map(([k])=>prVal(r,k)),r.n,r.last?fmtDate(r.last):""].map(q).join(";")));
    const a=h("a",{href:URL.createObjectURL(new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"})),download:"jurnal.csv"});
    document.body.append(a); a.click(); a.remove();
  }});
  body.append(kpis,h("div",{class:"row between"},h("label",{class:"field",style:"width:min(240px,100%)"},"Guruh",sel),h("div",{class:"row"},h("button",{class:"btn",type:"button",text:"Yangilash",onclick:load}),csv)),tbl);
  app().replaceChildren(h("section",{class:"view"},
    h("div",{class:"stack"},h("h2",{text:"O‘qituvchi paneli"}),h("p",{class:"muted",text:"T1–T15 — mavzular bo‘yicha testlar; A4, A5, A7, A10, A11 — amaliy mashg‘ulotlar trenajyorlari (A4 — CPM, A5 — yer ishlari, A7 — Gantt, A10 — EVM, A11 — risklar). Batafsil ma’lumotlar Google-jadvalning «Urinishlar» varag‘ida."})),
    form, body));
  if(key.value) load();
}

/* ---------- ishga tushirish ---------- */
(async function boot(){
  setStatus(SCRIPT_URL?"wait":"demo");
  try{ S.course=await (await fetch("content/course.json",{cache:"no-cache"})).json(); }
  catch(e){ app().replaceChildren(h("div",{class:"notice bad",text:"Kurs materiallarini yuklab bo‘lmadi. «content» papkasi saytga yuklanganini tekshiring."})); return; }
  S.meta=lsGet("mlb.meta",{counts:{},materials:[]});
  render();
  await loadMeta();
  if(!/^test-/.test(currentRoute)) render();
  flushPending();
})();
})();
