/* Amaliy mashg‘ulotlar uchun trenajyorlar: 5–6 (yer ishlari), 7 (Gantt), 10 (EVM), 11 (risklar) */
(function(){
"use strict";
const C = window.MLB_CORE;
let A = null; // app.js yordamchilari (window.MLB_APP)

const fmt = (x, d=2) => (Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toLocaleString("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:d}).replace(/ /g," ");
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const rnd = (a,b) => a+Math.floor(Math.random()*(b-a+1));
const rf = (a,b) => a+Math.random()*(b-a);
const numIn = (id, ph) => A.h("input",{type:"text",inputmode:"decimal",autocomplete:"off",id,placeholder:ph||"",class:"in-num"});
const mark = ok => A.h("span",{class:"pill "+(ok?"open":"bad"),text:ok?"To‘g‘ri":"Xato"});

/* ---------- umumiy qobiq ---------- */
function shell(o){
  const {h} = A;
  const box = h("div",{class:"trainer",id:"trainer"});
  const taskArea = h("div",{class:"stack"}), out = h("div",{class:"stack"});
  const submit = h("button",{type:"submit",class:"btn primary",text:"Tekshirish"});
  const form = h("form",{class:"stack",novalidate:true});
  let cur = null;
  function fresh(){
    cur = o.make();
    taskArea.replaceChildren(...o.renderTask(cur.d));
    form.replaceChildren(o.renderInputs(cur.d), h("div",{class:"row"},submit,h("button",{type:"button",class:"btn",text:"Yangi variant",onclick:fresh})));
    submit.disabled=false; out.replaceChildren();
  }
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    if(submit.disabled) return;
    if(!A.hasId()){ A.go("natijalar"); return; }
    const ans = o.read(form, cur.d);
    if(ans===null){ out.replaceChildren(h("div",{class:"notice warn",text:"Barcha maydonlarni to‘ldiring."})); return; }
    submit.disabled=true;
    const g = o.grade(cur.d, ans);
    const at=new Date().toISOString(), id=A.newId(), P=A.profile();
    const att={id,type:"trainer",key:o.key,score:g.score,max:g.max,at,sent:false};
    const payload={id,type:"trainer",key:o.key,topic:o.key,fio:P.fio,guruh:P.guruh,device:A.device(),at,d:cur.d,answers:ans};
    const note=h("p",{class:"muted",text:"Yuborilmoqda…"});
    out.replaceChildren(
      h("div",{class:"panel stack"},
        h("div",{class:"score"},h("span",{class:"big num",text:`${g.score}/${g.max}`}),h("span",{class:"muted",text:"ball"})),
        h("ul",{class:"checklist"},g.items.map(([name,ok])=>h("li",null,mark(ok)," ",name)))),
      note, h("h3",{text:"Yechim"}), ...o.solution(cur.d, g.sol, ans),
      h("div",{class:"row"},h("button",{class:"btn primary",type:"button",text:"Yangi variant",onclick:()=>{fresh();box.scrollIntoView({block:"start"});}})));
    const res = await A.submitAttempt(att,payload);
    note.replaceWith(A.sendNote(res));
  });
  box.append(
    h("div",{class:"stack"},h("span",{class:"eyebrow",text:"Interaktiv trenajyor"}),h("h2",{text:o.title}),h("p",{class:"muted",text:o.intro})),
    A.gate(), taskArea, h("div",{class:"panel"},form), out);
  fresh();
  return box;
}
function factList(pairs){ return A.h("dl",{class:"facts"},pairs.flatMap(([k,v])=>[A.h("dt",{text:k}),A.h("dd",{text:v})])); }
function table(head, rows, opts={}){
  const {h}=A;
  return h("div",{class:"tbl-wrap"},h("table",{class:"t"+(opts.cls?" "+opts.cls:"")},
    h("thead",null,h("tr",null,head.map(x=>h("th",{class:x.num?"num":null,text:x.t||x})))),
    h("tbody",null,rows.map(r=>h("tr",{class:r.cls||null},r.cells.map(c=>c&&c.nodeType?c:h("td",{class:c&&c.num?"num":null,text:c&&c.t!==undefined?c.t:c})))))));
}
const td=(node,cls)=>A.h("td",{class:cls||null},node);

/* ============ 10: EVM ============ */
const EVM = {
  key:"A10", title:"Qabul qilingan qiymat usuli (EVM)",
  intro:"Hisobot sanasidagi ma’lumotlar asosida PV, EV, CV, SV, CPI, SPI, EAC va VAC ni hisoblang hamda loyiha holatini aniqlang. Pul qiymatlari mln so‘mda, indekslar 2 xona aniqlikda.",
  make(){
    const n=rnd(8,12), bac=rnd(8,24)*10, scurve=Math.random()<0.5;
    const s=x=>scurve?3*x*x-2*x*x*x:x;
    const pv=[]; for(let i=1;i<=n;i++) pv.push(i===n?bac:C.r1(bac*s(i/n)));
    const m=rnd(3,n-2);
    const planPct=pv[m-1]/bac*100;
    let evPct=Math.round(planPct*rf(0.72,1.15)); if(Math.abs(evPct-planPct)<1) evPct+=pick([-2,2]); evPct=Math.min(95,Math.max(5,evPct));
    const ev=C.r1(bac*evPct/100);
    let ac=C.r1(ev*rf(0.82,1.3)); if(Math.abs(ac-ev)<0.5) ac=C.r1(ev*1.08);
    const len=pick([6,8,10,12,15]);
    return {d:{bac,n,pv,m,evPct,ac,len}};
  },
  renderTask(d){
    const {h}=A;
    return [
      factList([["Loyiha",`${d.len} km avtomobil yo‘li qurilishi`],["Jami byudjet (BAC)",`${fmt(d.bac)} mln so‘m`],["Rejalashtirilgan muddat",`${d.n} oy`],["Hisobot sanasi",`${d.m}-oyning oxiri`],["Haqiqatda bajarilgan ish",`umumiy hajmning ${d.evPct}%`],["Haqiqiy xarajatlar (AC)",`${fmt(d.ac,1)} mln so‘m`]]),
      h("h3",{text:"Oylar bo‘yicha reja (yig‘ma PV, mln so‘m)"}),
      table([{t:"Oy"},...d.pv.map((_,i)=>({t:String(i+1),num:1}))],[{cells:[h("td",{text:"PV"}),...d.pv.map(v=>({t:fmt(v,1),num:1}))]}])
    ];
  },
  renderInputs(d){
    const {h}=A;
    const f=(lab,id)=>h("label",{class:"field"},lab,numIn("evm-"+id));
    return h("div",{class:"stack"},
      h("div",{class:"grid4"},f("PV, mln so‘m","pv"),f("EV, mln so‘m","ev"),f("CV = EV − AC","cv"),f("SV = EV − PV","sv"),f("CPI = EV / AC","cpi"),f("SPI = EV / PV","spi"),f("EAC = BAC / CPI","eac"),f("VAC = BAC − EAC","vac")),
      h("label",{class:"field"},"Loyiha holati",h("select",{id:"evm-state"},h("option",{value:"",text:"— tanlang —"}),C.evm.STATES.map(s=>h("option",{value:s.k,text:s.t})))));
  },
  read(form){
    const a={}; for(const k of ["pv","ev","cv","sv","cpi","spi","eac","vac"]){ const v=A.$("#evm-"+k,form).value.trim(); if(v==="") return null; a[k]=v; }
    a.state=A.$("#evm-state",form).value; if(!a.state) return null; return a;
  },
  grade:(d,a)=>C.evm.grade(d,a),
  solution(d,s){
    const {h}=A;
    const st=C.evm.STATES.find(x=>x.k===s.state).t;
    return [table(["Ko‘rsatkich","Hisob","Qiymat"],[
      {cells:["PV",`${d.m}-oy bo‘yicha reja`,{t:fmt(s.pv,1),num:1}]},
      {cells:["EV",`${fmt(d.bac)} × ${d.evPct}%`,{t:fmt(s.ev,1),num:1}]},
      {cells:["CV",`${fmt(s.ev,1)} − ${fmt(d.ac,1)}`,{t:fmt(s.cv,1),num:1}]},
      {cells:["SV",`${fmt(s.ev,1)} − ${fmt(s.pv,1)}`,{t:fmt(s.sv,1),num:1}]},
      {cells:["CPI",`${fmt(s.ev,1)} / ${fmt(d.ac,1)}`,{t:fmt(s.cpi,2),num:1}]},
      {cells:["SPI",`${fmt(s.ev,1)} / ${fmt(s.pv,1)}`,{t:fmt(s.spi,2),num:1}]},
      {cells:["EAC",`${fmt(d.bac)} / ${fmt(s.cpi,3)}`,{t:fmt(s.eac,1),num:1}]},
      {cells:["ETC","EAC − AC",{t:fmt(s.etc,1),num:1}]},
      {cells:["VAC",`${fmt(d.bac)} − ${fmt(s.eac,1)}`,{t:fmt(s.vac,1),num:1}]}]),
      evmChart(d,s),
      h("p",null,h("b",{text:"Xulosa: "}),`${st}. `,s.vac<0?`Joriy samaradorlik saqlansa, loyiha byudjetdan taxminan ${fmt(-s.vac,1)} mln so‘mga oshib ketadi.`:`Joriy samaradorlik saqlansa, taxminan ${fmt(s.vac,1)} mln so‘m tejaladi.`)];
  }
};
function evmChart(d,s){
  const NS="http://www.w3.org/2000/svg", W=640,H=260,L=56,R=16,T=16,B=36;
  const mk=(t,a,txt)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e;};
  const maxY=Math.max(d.bac,s.eac,d.ac)*1.05;
  const x=i=>L+(W-L-R)*i/d.n, y=v=>T+(H-T-B)*(1-v/maxY);
  const svg=mk("svg",{viewBox:`0 0 ${W} ${H}`,width:"100%",role:"img","aria-label":"PV, EV va AC grafigi",style:"max-width:640px;display:block"});
  for(let k=0;k<=4;k++){const v=maxY*k/4; svg.append(mk("line",{x1:L,x2:W-R,y1:y(v),y2:y(v),stroke:"var(--line)"}),mk("text",{x:L-6,y:y(v)+4,"text-anchor":"end","font-size":"11",fill:"var(--muted)"},fmt(v,0)));}
  for(let i=0;i<=d.n;i++) svg.append(mk("text",{x:x(i),y:H-B+16,"text-anchor":"middle","font-size":"11",fill:"var(--muted)"},String(i)));
  svg.append(mk("text",{x:W-R,y:H-4,"text-anchor":"end","font-size":"11",fill:"var(--muted)"},"oy"));
  const pts=[[0,0],...d.pv.map((v,i)=>[i+1,v])].map(([i,v])=>`${x(i)},${y(v)}`).join(" ");
  svg.append(mk("polyline",{points:pts,fill:"none",stroke:"var(--accent)","stroke-width":"2.5"}));
  svg.append(mk("line",{x1:x(0),y1:y(0),x2:x(d.m),y2:y(s.ev),stroke:"var(--ok)","stroke-width":"2","stroke-dasharray":"5 4"}));
  svg.append(mk("line",{x1:x(0),y1:y(0),x2:x(d.m),y2:y(d.ac),stroke:"var(--bad)","stroke-width":"2","stroke-dasharray":"5 4"}));
  svg.append(mk("line",{x1:x(d.m),x2:x(d.m),y1:T,y2:H-B,stroke:"var(--muted)","stroke-dasharray":"2 3"}));
  [[s.pv,"var(--accent)","PV"],[s.ev,"var(--ok)","EV"],[d.ac,"var(--bad)","AC"]].forEach(([v,c,t],i)=>{svg.append(mk("circle",{cx:x(d.m),cy:y(v),r:4.5,fill:c}),mk("text",{x:x(d.m)+8,y:y(v)+4+(i===1&&Math.abs(y(s.ev)-y(d.ac))<12?12:0),"font-size":"12","font-weight":"600",fill:c},t));});
  return A.h("div",{class:"net-wrap"},svg);
}

/* ============ 5–6: yer ishlari ============ */
const EARTH = {
  key:"A5", title:"Yer ishlari hajmlarini hisoblash",
  intro:"Ishchi belgilar h = H(loyiha) − H(mavjud), ko‘ndalang kesim yuzalari F = b·|h| + m·h² va o‘rtacha maydon usuli V = (F₁+F₂)/2 × L bo‘yicha o‘yma va ko‘tarma hajmlarini toping. O‘ymadan ko‘tarmaga o‘tish uchastkasida hajmning yarmi o‘yma, yarmi ko‘tarma deb olinadi.",
  make(){
    const n=5, L=pick([25,50,100]), b=rnd(8,12), k=1.5;
    let hm=[], hl=[], ok=false;
    while(!ok){
      hm=[]; hl=[]; let g=rf(100,140); const i=rf(-0.02,0.02); let z=C.r2(g);
      for(let j=0;j<n;j++){
        const design=C.r2(z+i*L*j);
        const h=C.r2(pick([-1,1])*rf(0.3,2.2));
        hl.push(design); hm.push(C.r2(design-h));
      }
      const hs=hl.map((v,j)=>C.r2(v-hm[j]));
      ok = hs.some(x=>x<0) && hs.some(x=>x>0) && hs.every(x=>Math.abs(x)>=0.2);
    }
    return {d:{hl,hm,b,k,L}};
  },
  renderTask(d){
    const {h}=A;
    return [factList([["Yo‘l poyi kengligi b",`${d.b} m`],["Qiyalik koeffitsienti m",`1 : ${String(d.k).replace(".",",")}`],["Kesimlar orasidagi masofa L",`${d.L} m`]]),
      table(["Kesim","Piket, m",{t:"H loyiha, m",num:1},{t:"H mavjud, m",num:1}],d.hl.map((v,i)=>({cells:[String(i+1),String(i*d.L),{t:fmt(v,2),num:1},{t:fmt(d.hm[i],2),num:1}]})))];
  },
  renderInputs(d){
    const {h}=A;
    return h("div",{class:"stack"},
      h("div",{class:"tbl-wrap"},h("table",{class:"t"},
        h("thead",null,h("tr",null,h("th",{text:"Kesim"}),h("th",{text:"h, m (ishora bilan)"}),h("th",{text:"F, m²"}))),
        h("tbody",null,d.hl.map((_,i)=>h("tr",null,h("td",{text:String(i+1)}),td(numIn("ea-h"+i,"masalan −0,80")),td(numIn("ea-F"+i))))))),
      h("div",{class:"grid3"},
        h("label",{class:"field"},"O‘yma jami, m³",numIn("ea-cut")),
        h("label",{class:"field"},"Ko‘tarma jami, m³",numIn("ea-fill")),
        h("label",{class:"field"},"Balans: ko‘tarma − o‘yma, m³",numIn("ea-bal"))));
  },
  read(form,d){
    const a={h:[],F:[]}; const g=id=>A.$("#"+id,form).value.trim();
    for(let i=0;i<d.hl.length;i++){ const x=g("ea-h"+i), y=g("ea-F"+i); if(x===""||y==="") return null; a.h.push(x); a.F.push(y); }
    for(const k of ["cut","fill","bal"]){ const v=g("ea-"+k); if(v==="") return null; a[k]=v; }
    return a;
  },
  grade:(d,a)=>C.earth.grade(d,a),
  solution(d,s){
    const {h}=A;
    return [table(["Kesim",{t:"h, m",num:1},{t:"F, m²",num:1},"Xarakter"],s.h.map((x,i)=>({cells:[String(i+1),{t:(x>0?"+":"")+fmt(x,2),num:1},{t:fmt(s.F[i],3),num:1},x<0?"O‘yma":"Ko‘tarma"]}))),
      table(["Uchastka",{t:"V, m³",num:1},{t:"O‘yma, m³",num:1},{t:"Ko‘tarma, m³",num:1}],[
        ...s.seg.map((g,i)=>({cells:[`${i+1}–${i+2}`,{t:fmt(g.v,2),num:1},{t:fmt(g.cut,2),num:1},{t:fmt(g.fill,2),num:1}]})),
        {cls:"crit",cells:["Jami","",{t:fmt(s.cut,2),num:1},{t:fmt(s.fill,2),num:1}]}]),
      h("p",null,`Balans: ${fmt(s.fill,2)} − ${fmt(s.cut,2)} = ${fmt(s.bal,2)} m³. `,s.bal>0?`Taxminan ${fmt(s.bal,0)} m³ grunt keltirish kerak (10 m³ li samosval bilan ≈ ${Math.ceil(s.bal/10)} reys).`:`Taxminan ${fmt(-s.bal,0)} m³ ortiqcha grunt olib ketiladi yoki boshqa uchastkaga ishlatiladi.`)];
  }
};

/* ============ 7: Gantt ============ */
function depText(t,d){
  return t.dep.length? t.dep.map(([id,type,lag])=>{ const l=typeof lag==="number"?lag:d[lag]; return type==="FS"?`${id} tugagach`:`${id} boshlangandan ${l} kun keyin`; }).join("; ") : "—";
}
const GANTT = {
  key:"A7", title:"Kalendar reja va Gantt diagrammasi",
  intro:"Ishlar uzluksiz kalendar kunlarda bajariladi. Loyihaning 1-kuni — boshlanish sanasi. «Tugagach» (FS) — keyingi kundan boshlanadi; «boshlangandan N kun keyin» (SS) — oldingi ish boshlangan kunga N qo‘shiladi. Tugash kuni = boshlanish kuni + davomiylik − 1.",
  make(){
    const dur={}; C.gantt.TASKS.forEach(t=>dur[t.id]=rnd(t.r[0],t.r[1]));
    const st=new Date(Date.UTC(2026,rnd(3,8),rnd(1,25)));
    const start=st.toISOString().slice(0,10);
    return {d:{dur,start,lag4:rnd(1,5),lag7:rnd(1,4)}};
  },
  renderTask(d){
    const p=d.start.split("-");
    return [factList([["Loyiha boshlanishi",`${p[2]}.${p[1]}.${p[0]} (1-kun)`]]),
      table(["№","Ish","Bog‘liqlik",{t:"Davomiylik, kun",num:1}],C.gantt.TASKS.map(t=>({cells:[String(t.id),t.name,depText(t,d),{t:String(d.dur[t.id]),num:1}]})))];
  },
  renderInputs(d){
    const {h}=A;
    return h("div",{class:"stack"},
      h("div",{class:"tbl-wrap"},h("table",{class:"t"},
        h("thead",null,h("tr",null,h("th",{text:"№"}),h("th",{text:"Ish"}),h("th",{text:"Boshlanish kuni"}),h("th",{text:"Tugash kuni"}))),
        h("tbody",null,C.gantt.TASKS.map(t=>h("tr",null,h("td",{text:String(t.id)}),h("td",{text:t.name}),td(numIn("ga-s"+t.id)),td(numIn("ga-f"+t.id))))))),
      h("div",{class:"grid3"},
        h("label",{class:"field"},"Loyiha davomiyligi, kun",numIn("ga-T")),
        h("label",{class:"field"},"Loyiha tugash sanasi",h("input",{type:"date",id:"ga-end"}))));
  },
  read(form){
    const a={s:{},f:{}}; const g=id=>A.$("#"+id,form).value.trim();
    for(const t of C.gantt.TASKS){ const x=g("ga-s"+t.id), y=g("ga-f"+t.id); if(x===""||y==="") return null; a.s[t.id]=x; a.f[t.id]=y; }
    a.T=g("ga-T"); a.end=g("ga-end"); if(a.T===""||!a.end) return null; return a;
  },
  grade:(d,a)=>C.gantt.grade(d,a),
  solution(d,s){
    const {h}=A; const e=s.end.split("-");
    return [table(["№","Ish",{t:"Boshlanish",num:1},{t:"Tugash",num:1},"Kritik"],C.gantt.TASKS.map(t=>({cls:s.crit[t.id]?"crit":null,cells:[String(t.id),t.name,{t:String(s.s[t.id]),num:1},{t:String(s.f[t.id]),num:1},s.crit[t.id]?"ha":"—"]}))),
      ganttChart(d,s),
      h("p",null,`Loyiha davomiyligi ${s.T} kun, tugash sanasi ${e[2]}.${e[1]}.${e[0]}. Sariq rang — kritik ishlar: ularning kechikishi butun loyihani kechiktiradi.`)];
  }
};
function ganttChart(d,s){
  const NS="http://www.w3.org/2000/svg", rows=C.gantt.TASKS.length, L=34, R=26, T=24, RH=26;
  const W=Math.max(560,L+R+s.T*14), H=T+rows*RH+10, cw=(W-L-R)/s.T;
  const mk=(t,a,txt)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e;};
  const svg=mk("svg",{viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:"img","aria-label":"Gantt diagrammasi"});
  for(let k=0;k<=s.T;k+=5){ const x=L+k*cw; svg.append(mk("line",{x1:x,x2:x,y1:T-6,y2:H-6,stroke:"var(--line)"}),mk("text",{x:x+2,y:T-10,"font-size":"10",fill:"var(--muted)"},String(k+1))); }
  C.gantt.TASKS.forEach((t,i)=>{
    const y=T+i*RH, c=s.crit[t.id];
    svg.append(mk("text",{x:L-8,y:y+16,"text-anchor":"end","font-size":"12",fill:"var(--muted)"},String(t.id)));
    svg.append(mk("rect",{x:L+(s.s[t.id]-1)*cw,y:y+4,width:d.dur[t.id]*cw,height:RH-10,rx:3,fill:c?"var(--mark)":"var(--accent)",opacity:c?1:.75}));
  });
  return A.h("div",{class:"net-wrap"},svg);
}

/* ============ 11: risklar ============ */
const ZN={q:"Qizil",s:"Sariq",y:"Yashil"};
const RISK = {
  key:"A11", title:"Risk matritsasi",
  intro:"Shkalalar bo‘yicha har bir risk uchun ehtimollik P va ta’sir I ni (1–3) aniqlang, risk darajasini R = P × I hisoblang va zonani belgilang: R = 9 — qizil, R = 4…6 — sariq, R ≤ 3 — yashil.",
  make(){
    const ids=C.risk.LIST.map(r=>r.id).sort(()=>Math.random()-.5).slice(0,6);
    const budget=rnd(8,20)*10;
    const pBand=[[8,27],[34,57],[64,90]], iBand=[[0.4,1.8],[2.3,4.7],[5.4,9.5]];
    const items=ids.map(id=>{ const pb=pick(pBand), ib=pick(iBand); return {id,p:rnd(pb[0],pb[1]),c:C.r1(budget*rf(ib[0],ib[1])/100)}; });
    return {d:{budget,items}};
  },
  renderTask(d){
    const {h}=A; const byId=id=>C.risk.LIST.find(r=>r.id===id);
    return [factList([["Loyiha","15 km avtomobil yo‘li uchastkasini qurish"],["Loyiha byudjeti",`${d.budget} mlrd so‘m`]]),
      h("div",{class:"grid2"},
        table(["Ehtimollik","P"],[{cells:["≤ 30%","1"]},{cells:["31–60%","2"]},{cells:["> 60%","3"]}]),
        table(["Oqibat (byudjetdan)","I"],[{cells:["≤ 2%","1"]},{cells:["2–5%","2"]},{cells:["> 5%","3"]}])),
      table(["№","Risk","Toifa",{t:"Ehtimollik",num:1},{t:"Oqibat, mlrd so‘m",num:1}],d.items.map((it,i)=>{const r=byId(it.id);return {cells:[String(i+1),r.name,r.cat,{t:it.p+"%",num:1},{t:fmt(it.c,1),num:1}]};}))];
  },
  renderInputs(d){
    const {h}=A;
    const sel=(id,opts)=>h("select",{id},h("option",{value:"",text:"—"}),opts.map(([v,t])=>h("option",{value:v,text:t})));
    return h("div",{class:"tbl-wrap"},h("table",{class:"t"},
      h("thead",null,h("tr",null,h("th",{text:"№"}),h("th",{text:"P"}),h("th",{text:"I"}),h("th",{text:"R = P × I"}),h("th",{text:"Zona"}))),
      h("tbody",null,d.items.map((_,i)=>h("tr",null,h("td",{text:String(i+1)}),
        td(sel("rk-P"+i,[["1","1"],["2","2"],["3","3"]])),td(sel("rk-I"+i,[["1","1"],["2","2"],["3","3"]])),td(numIn("rk-R"+i)),
        td(sel("rk-z"+i,[["q","Qizil"],["s","Sariq"],["y","Yashil"]])))))));
  },
  read(form,d){
    const a={rows:[]}; const g=id=>A.$("#"+id,form).value.trim();
    for(let i=0;i<d.items.length;i++){ const r={P:g("rk-P"+i),I:g("rk-I"+i),R:g("rk-R"+i),z:g("rk-z"+i)}; if(!r.P||!r.I||r.R===""||!r.z) return null; a.rows.push(r); }
    return a;
  },
  grade:(d,a)=>C.risk.grade(d,a),
  solution(d,s){
    const {h}=A; const byId=id=>C.risk.LIST.find(r=>r.id===id);
    const cellNums=(P,I)=>s.rows.map((r,i)=>r.P===P&&r.I===I?i+1:null).filter(Boolean).join(", ");
    const zc=R=>R>=9?"cell-lo":R>=4?"cell-mid":"cell-hi";
    const matrix=h("div",{class:"tbl-wrap",style:"max-width:520px"},h("table",{class:"t mx"},
      h("thead",null,h("tr",null,h("th",{text:"P \\ I"}),[1,2,3].map(I=>h("th",{class:"num",text:String(I)})))),
      h("tbody",null,[3,2,1].map(P=>h("tr",null,h("th",{text:String(P)}),[1,2,3].map(I=>h("td",{class:"c "+zc(P*I),text:cellNums(P,I)||"·"})))))));
    return [table(["№","Risk",{t:"P",num:1},{t:"I",num:1},{t:"R",num:1},"Zona"],s.rows.map((r,i)=>({cells:[String(i+1),byId(r.id).name,{t:String(r.P),num:1},{t:String(r.I),num:1},{t:String(r.R),num:1},ZN[r.z]]}))),
      matrix,
      h("h3",{text:"Javob choralari (namuna)"}),
      table(["№","Risk","Javob turi va choralar"],s.rows.filter(r=>r.z!=="y").map(r=>({cells:[String(s.rows.indexOf(r)+1),byId(r.id).name,byId(r.id).resp]}))),
      h("p",{class:"muted",text:"Yashil zonadagi risklar faol choralarsiz kuzatiladi, qizil va sariq zonadagilar uchun javob rejasi tuziladi."})];
  }
};

window.TRAINERS = {
  "05": app=>{ A=app; return shell(EARTH); },
  "07": app=>{ A=app; return shell(GANTT); },
  "10": app=>{ A=app; return shell(EVM); },
  "11": app=>{ A=app; return shell(RISK); }
};
})();
