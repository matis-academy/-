/* Подбор сетапа — Matis Academy (Claude, 29.10.2026). Бета. Данные и фото: GP_BASE (папка загрузок). */
(function(){"use strict";
const GP_BASE=(window.GP_BASE||"").replace(/\/?$/,"/");
const UK=/^uk/i.test(document.documentElement.lang||"")||/^\/uk\//.test(location.pathname);
/* ---------- ширина колонки (BRAND_KIT 4.1): narrow 880 · std 1200 · full ---------- */
function getW(){try{return localStorage.getItem("mvc-w")||"std"}catch(e){return "std"}}
function setW(v){document.documentElement.setAttribute("data-mvc-w",v);try{localStorage.setItem("mvc-w",v)}catch(e){}document.querySelectorAll("[data-gpw]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.gpw===v)))}
document.documentElement.setAttribute("data-mvc-w",getW());
/* ---------- разметка разделов ---------- */
function mount(){
 const root=document.getElementById("gp-app");if(!root)return;
 root.classList.add("gp");root.setAttribute("data-no-translation","");
 const W=getW();
 const sw=`<div class="gp-wsw" role="group" aria-label="Ширина страницы"><span aria-hidden="true">↔</span>${[["narrow","Узко"],["std","Стандарт"],["full","Весь экран"]].map(([v,l])=>`<button type="button" data-gpw="${v}" aria-pressed="${v===W}">${l}</button>`).join("")}</div>`;
 const sec=(n,id,band,title,sub,body,extra)=>`<section class="gp-sec${band?" band":""}" id="${id}"><div class="gp-w">${extra||""}<div class="head"><div class="no">${n}</div><h2>${title}</h2><p class="sub">${sub}</p></div>${body}</div></section>`;
 root.innerHTML=
  sec("01","gp-s1",0,"Камера","Выбери, для чего снимаешь, и задай бюджет — сверху окажутся камеры, которые лучше подходят под задачу.",`<div class="wid" id="camF"></div><div class="grid" id="camG"></div><button class="btn more" id="camMore" type="button" hidden></button>`,sw)+
  sec("02","gp-s2",1,"Объектив","Только под байонет и матрицу камеры: к полному кадру — полнокадровые, к кропу — под APS-C. Фокусное пересчитано под матрицу.",`<div id="lensBody"><div class="locked">Сначала выбери камеру — покажем объективы под её байонет.</div></div>`)+
  sec("03","gp-s3",0,"Карты памяти","Тип карты — под слот камеры, класс скорости — под битрейт режима, в котором ты будешь снимать.",`<div id="cardBody"><div class="locked">Сначала выбери камеру — покажем подходящие карты.</div></div>`)+
  sec("04","gp-s4",1,"Гимбал","Считаем вес камеры с объективом и аксессуарами и сравниваем с нагрузкой стабилизатора.",`<div id="gimBody"><div class="locked">Выбери камеру и объектив — посчитаем вес сетапа.</div></div>`)+
  sec("05","gp-s5",0,"Мой сетап","Итоговый список с ценами. Скопируй его и сравни цены в магазинах перед покупкой.",`<div id="sumBody"><div class="locked">Здесь появится твой комплект.</div></div>`)+
  sec("?","gp-s6",1,"Почему её нет в списке","Эти камеры популярны, но для старта в видео не подходят.",`<div class="excl" id="gpExcl"></div><p class="foot" id="gpFoot"></p>`);
 const bar=document.createElement("div");bar.className="gp-bar";bar.id="gpBar";bar.hidden=true;bar.setAttribute("data-no-translation","");
 bar.innerHTML=`<div class="bar-in"><div class="bthumbs" id="bthumbs"></div><button class="cmpb" id="cmpBtn" type="button" hidden></button><div class="btot"><b id="btot"></b><span>сетап, ориентир</span></div></div>`;
 const ov=document.createElement("div");ov.className="gp-ov";ov.id="gpOv";ov.hidden=true;ov.setAttribute("data-no-translation","");
 ov.innerHTML=`<div class="gp-modal modal" id="gpModal" role="dialog" aria-modal="true"></div>`;
 document.body.appendChild(bar);document.body.appendChild(ov);
 const map=document.getElementById("gpMap");if(map)map.setAttribute("data-no-translation","");
 if(UK)[root,bar,ov,map].forEach(n=>n&&i18nWatch(n));
}
/* ---------- украинская версия: перевод текстов интерфейса и данных ---------- */
const UA=window.GP_UA||{};const RX=window.GP_UA_RX||[];
const NUM=/\d+(?:[   ]\d{3})*(?:[.,]\d+)?/g;
function trS(s){const t=s.trim();if(!t||!/[А-Яа-яЁё]/.test(t))return s;
 if(UA[t])return s.replace(t,UA[t]);
 const nums=t.match(NUM)||[];const k=t.replace(NUM,"{n}");const v=UA[k];
 if(v){let i=0;return s.replace(t,v.replace(/\{n\}/g,()=>nums[i++]??""))}
 for(const [p,r] of RX){const re=new RegExp(p);if(re.test(t))return s.replace(t,t.replace(re,r))}
 return s}
function trNode(n){if(n.nodeType===3){const v=trS(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;return}
 if(n.nodeType!==1)return;["placeholder","aria-label","title","alt"].forEach(a=>{if(n.hasAttribute&&n.hasAttribute(a)){const v=trS(n.getAttribute(a));if(v!==n.getAttribute(a))n.setAttribute(a,v)}});
 if(n.tagName==="OPTION"||n.childNodes)n.childNodes.forEach(trNode)}
function i18nWatch(root){trNode(root);new MutationObserver(ms=>ms.forEach(m=>{if(m.type==="characterData")trNode(m.target);else m.addedNodes.forEach(trNode)})).observe(root,{childList:true,subtree:true,characterData:true})}
const L=s=>UK?trS(s):s;

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const nb=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f");
const usd=n=>n==null?"—":"$"+nb(n);
const cx=x=>String(x).replace(".",",")+"x";
const has=(c,f)=>c.flags.some(x=>x===f||x.startsWith(f+":"));
const flagVal=(c,f)=>{const x=c.flags.find(x=>x.startsWith(f+":"));return x?parseFloat(x.split(":")[1]):null};
const SENSOR={"FF":"Полный кадр","APS-C":"APS-C","S35":"Super 35","MF":"Средний формат"};
let META, CAMS=[], LENS={}, CARDS=[], GIMS=[];
const ST={cam:null,lens:null,cards:[],gim:null,noGim:false,cmp:[]};

/* ---------- камера ---------- */
const TASKS=[
 {id:"wedding",name:"Свадьба",note:"выше — два слота, стабилизация и камеры без перегрева",
  score:c=>(c.slots>1?4:0)+(c.ibis?2:0)+(c.k60==="full"?1:0)+(c.bit===10?1:0)+(c.evf?1:0)-(has(c,"overheat")?3:0),
  why:c=>[c.slots>1&&"2 слота",c.ibis&&"стабилизация",!has(c,"overheat")&&"без перегрева",c.k60==="full"&&"4K 60p без кропа"]},
 {id:"reels",name:"Reels и контент",note:"выше — лёгкие камеры с замедлением и 4K 60p",
  score:c=>(c.weight<500?3:c.weight<650?1:-1)+(c.fhd>=120?1:0)+(c.k60!=="none"?1:0)+(c.bit===10?1:0)+(c.price<=1500?1:0),
  why:c=>[c.weight<500&&"лёгкая",c.fhd>=120&&"замедление",c.k60!=="none"&&"4K 60p"]},
 {id:"interview",name:"Интервью",note:"выше — камеры без перегрева и с запасом под цвет: дубль может идти час",
  score:c=>(has(c,"overheat")?-4:2)+(c.bit===10?2:0)+(c.log?1:0)+(c.slots>1?1:0)+(has(c,"cinema")?1:0),
  why:c=>[!has(c,"overheat")&&"без перегрева",c.bit===10&&"10 бит",has(c,"cinema")&&"вентилятор"]},
 {id:"commerce",name:"Коммерция",note:"выше — 10 бит, лог и 4K 60p без кропа: картинка под покраску",
  score:c=>(c.bit===10?3:0)+(c.log?2:0)+(c.k60==="full"?2:0)+(c.fhd>=120?1:0)+(c.ibis?1:0),
  why:c=>[c.bit===10&&"10 бит",c.log&&"лог",c.k60==="full"&&"4K 60p без кропа",c.fhd>=120&&"замедление"]}];
const CF={task:null,budget:7500,k60:false,bit:false,log:false,ibis:false,slots:false,evf:false,sensor:"all",avail:"all",brand:"all",q:"",sort:"price",shown:24};
const CF0=structuredClone(CF);
const taskO=()=>TASKS.find(t=>t.id===CF.task);
function k60T(c){return c.k60==="full"?"без кропа":c.k60==="crop"?(c.k60crop?"кроп "+cx(c.k60crop):"с кропом"):"нет"}
function camWarn(c){const w=[];
 if(c.slots===1)w.push({t:"1 слот — риск для свадьбы",r:!CF.task||CF.task==="wedding"});
 if(has(c,"overheat"))w.push({t:"Может перегреваться на долгой записи",r:CF.task==="interview"});
 if(has(c,"hdmi10"))w.push({t:"10 бит и лог — только на внешний рекордер"});
 const k=flagVal(c,"k30crop");if(k)w.push({t:"4K 30p с кропом "+cx(k)});
 if(c.k60==="crop")w.push({t:"В 4K 60p кадр обрезается — объектив «удлиняется»"});
 if(has(c,"rolling"))w.push({t:"Заметный rolling shutter на панорамах"});
 if(has(c,"deadmount"))w.push({t:"Байонет EF-M не развивается — мало новой оптики"});
 if(has(c,"logpaid"))w.push({t:"Лог-профиль — платная опция"});
 if(has(c,"dslr"))w.push({t:"Зеркалка: тяжелее и неудобнее на гимбале"});
 return w}
function camList(){const q=CF.q.trim().toLowerCase().replace(/[\s-]/g,"");
 let L=CAMS.filter(c=>c.price<=CF.budget&&(!CF.k60||c.k60==="full")&&(!CF.bit||c.bit===10)&&(!CF.log||(c.log&&!has(c,"hdmi10")))&&(!CF.ibis||c.ibis)&&(!CF.slots||c.slots>1)&&(!CF.evf||c.evf)&&(CF.sensor==="all"||c.sensor===CF.sensor)&&(CF.avail==="all"||c.avail===CF.avail)&&(CF.brand==="all"||c.brand===CF.brand)&&(!q||(c.brand+c.model).toLowerCase().replace(/[\s-]/g,"").includes(q)));
 const t=taskO();const by={price:(a,b)=>a.price-b.price,"-price":(a,b)=>b.price-a.price,"-year":(a,b)=>b.year-a.year||a.price-b.price,weight:(a,b)=>a.weight-b.weight,fit:(a,b)=>t?(t.score(b)-t.score(a))||a.price-b.price:a.price-b.price};
 return L.sort(by[CF.sort]||by.price)}
function chips(items,cur,attr){return items.map(([v,l])=>`<button type="button" class="chip" data-${attr}="${esc(v)}" aria-pressed="${cur(v)}">${esc(l)}</button>`).join("")}
function renderCamF(){
 const brands=[...new Set(CAMS.map(c=>c.brand))];
 const sorts=[["fit","Под задачу"],["price","Сначала дешевле"],["-price","Сначала дороже"],["-year","Сначала новые"],["weight","Сначала лёгкие"]].filter(s=>s[0]!=="fit"||CF.task);
 $("#camF").innerHTML=`
  <div class="wrow"><span class="wl">Для чего</span><div class="cg">${chips(TASKS.map(t=>[t.id,t.name]),v=>CF.task===v,"task")}</div></div>
  <div class="wrow"><span class="wl">Бюджет</span><div class="rng"><input type="range" id="cBud" min="300" max="7500" step="100" value="${CF.budget}" aria-label="Бюджет на камеру"><span>до <b>${CF.budget>=7500?"без лимита":usd(CF.budget)}</b></span></div>
    <div class="cg">${chips([[1000,"до $1000"],[2000,"до $2000"],[3000,"до $3000"],[7500,"без лимита"]],v=>CF.budget==v,"bud")}</div></div>
  <div class="wrow"><span class="wl">Важно</span><div class="cg">${chips([["k60","4K 60p без кропа"],["bit","10 бит"],["log","Лог-профиль"],["ibis","Стабилизация"],["slots","2 слота"],["evf","Видоискатель"]],v=>CF[v],"tog")}</div></div>
  <div class="wrow"><span class="wl">Матрица</span><div class="cg">${chips([["all","Все"],["FF","Полный кадр"],["APS-C","APS-C"]],v=>CF.sensor===v,"sensor")}</div>
    <span class="wl">Состояние</span><div class="cg">${chips([["all","Все"],["new","Новые"],["used","Только б/у"]],v=>CF.avail===v,"avail")}</div></div>
  <div class="wrow"><span class="wl">Бренд</span><div class="cg">${chips([["all","Все"],...brands.map(b=>[b,b])],v=>CF.brand===v,"brand")}</div></div>
  <div class="wfoot"><input type="search" id="cQ" placeholder="Найти модель: A6400, R6, Z6…" value="${esc(CF.q)}" aria-label="Поиск камеры">
    <span id="cCount"></span>
    <select id="cSort" aria-label="Сортировка">${sorts.map(s=>`<option value="${s[0]}"${s[0]===CF.sort?" selected":""}>${s[0]==="fit"?"Под задачу: "+taskO().name.toLowerCase():s[1]}</option>`).join("")}</select>
    <button class="lnk" type="button" id="cReset">Сбросить</button></div>`;
}
function img(src,alt,cls){if(src&&!/^(data:|https?:)/.test(src))src=GP_BASE+src;return src?`<img src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async"${cls?` class="${cls}"`:""}>`:""}
function camCard(c){const t=taskO();const why=t?t.why(c).filter(Boolean).slice(0,3):[];const w=camWarn(c).slice(0,3);const sel=ST.cam&&ST.cam.id===c.id;const inC=ST.cmp.includes(c.id);
 return `<article class="pc${sel?" sel":""}">
  <div class="ph${c.img?"":" none"}">${c.img?img(c.img,c.brand+" "+c.model):"фото скоро"}</div>
  <div class="badges"><span>${has(c,"anton")?'<span class="bd anton">Выбор Антона</span>':has(c,"new2026")?'<span class="bd new">Новинка 2026</span>':""}</span><span>${c.avail==="used"?'<span class="bd used">только б/у</span>':""}</span></div>
  <div><div class="brand">${esc(c.brand)}</div><div class="name">${esc(c.model)}</div><div class="meta">${c.year} · ${SENSOR[c.sensor]} · ${esc(c.mount)}</div></div>
  <dl class="specs"><dt>Максимум</dt><dd>${esc(c.top)}</dd><dt>4K 60p</dt><dd class="${c.k60==="full"?"c-ok":c.k60==="crop"?"c-warn":"c-no"}">${k60T(c)}</dd>
   <dt>Full HD</dt><dd>до ${c.fhd}p</dd><dt>Цвет</dt><dd class="${c.bit===10?"c-ok":"c-no"}">${c.bit} бит</dd>
   <dt>Лог</dt><dd class="${c.log?(has(c,"hdmi10")?"c-warn":"c-ok"):"c-no"}">${c.log?esc(c.log)+(has(c,"hdmi10")?" (HDMI)":""):"нет"}</dd><dt>Стабилизация</dt><dd class="${c.ibis?"c-ok":"c-no"}">${c.ibis?"есть":"нет"}</dd></dl>
  ${why.length?`<div class="why">${why.map(x=>`<span>${x}</span>`).join("")}</div>`:""}
  ${w.length?`<div class="flags">${w.map(x=>`<div class="fl${x.r?" risk":""}">${x.t}</div>`).join("")}</div>`:""}
  <div class="pb"><div class="price">${usd(c.price)}<small>${c.avail==="used"?"≈ б/у":c.priceSrc==="ek"?"корпус, от, Украина":"≈ корпус"}</small></div>
   <div class="btns"><button class="btn" type="button" data-cmp="${c.id}" aria-pressed="${inC}">${inC?"В сравнении":"Сравнить"}</button><button class="btn" type="button" data-cam-open="${c.id}">Подробнее</button><button class="btn pri" type="button" data-cam="${c.id}">${sel?"Выбрана":"Выбрать"}</button></div></div>
 </article>`}
function renderCams(){const L=camList();const t=taskO();
 $("#cCount").innerHTML=`Подходит <b>${L.length}</b> из ${CAMS.length}${t&&CF.sort==="fit"?` · <span class="tnote">${t.name}: ${t.note}</span>`:""}`;
 const q=CF.q.trim().toLowerCase().replace(/[\s-]/g,"");let ex="";
 if(q.length>=2&&!L.length){const h=META.excluded.find(e=>e.models.toLowerCase().replace(/[\s-]/g,"").includes(q));if(h)ex=`<div class="empty"><b>${esc(CF.q)}</b> — в группе «${esc(h.group)}». ${esc(h.reason)}</div>`}
 $("#camG").innerHTML=ex||(L.length?L.slice(0,CF.shown).map(camCard).join(""):`<div class="empty">Под эти условия камер нет. Подними бюджет или сними пару фильтров.</div>`);
 const mb=$("#camMore");mb.hidden=L.length<=CF.shown;mb.textContent=`Показать ещё ${Math.min(24,L.length-CF.shown)}`}
function camUI(){renderCamF();renderCams()}

/* ---------- объективы ---------- */
const MOUNT={ "Sony E":{nat:["Sony E"]},"Canon RF":{nat:["Canon RF","Canon RF-S"],ad:["Canon EF","Canon EF-S"],adName:"переходник Canon EF-EOS R"},
 "Canon EF-M":{nat:["Canon EF-M"],ad:["Canon EF","Canon EF-S"],adName:"переходник Canon EF-EOS M"},"Canon EF":{nat:["Canon EF","Canon EF-S"]},
 "Nikon Z":{nat:["Nikon Z"],ad:["Nikon F"],adName:"переходник Nikon FTZ II"},"Nikon F":{nat:["Nikon F"]},"Fujifilm X":{nat:["Fujifilm X"]},"Fujifilm G":{nat:["Fujifilm G"]},"L-Mount":{nat:["L-Mount"]}};
const FILE={"Sony E":"sony-e","Canon RF":"canon","Canon EF-M":"canon","Canon EF":"canon","Nikon Z":"nikon","Nikon F":"nikon","Fujifilm X":"fuji","Fujifilm G":"fuji","L-Mount":"l-mount"};
const LF0={ffOnCrop:false,kind:"all",ap:"all",ois:false,sealed:false,src:"nat",brand:"all",budget:4000,q:"",sort:"pop",shown:24,eq:"all"};
let LF=structuredClone(LF0);
function cropOf(c){return c.sensor==="FF"?1:c.sensor==="MF"?0.79:(c.brand==="Canon"&&c.sensor==="APS-C")?1.6:1.5}
function lensFits(c,l){const m=MOUNT[c.mount];const nat=l.mounts.some(x=>m.nat.includes(x));const ad=!nat&&m.ad&&l.mounts.some(x=>m.ad.includes(x));
 if(!nat&&!ad)return null;
 if(c.mount==="Canon EF"&&c.sensor==="FF"&&l.mounts.length===1&&l.mounts[0]==="Canon EF-S")return null;
 if(c.mount==="Nikon Z"&&ad&&l.screw)return null;
 const cls=camFmt(c);
 if(c.mount==="Fujifilm X")return {ad,ffOnCrop:false};
 if(cls==="ff"&&l.fmt!=="ff")return null;
 if(cls==="apsc"&&l.fmt!=="apsc"&&!(LF.ffOnCrop&&l.fmt==="ff"))return null;
 return {ad,ffOnCrop:cls==="apsc"&&l.fmt==="ff"}}
function camFmt(c){return c.sensor==="FF"?"ff":c.sensor==="MF"?"mf":"apsc"}
function eqF(c,l,f){return Math.round(f*cropOf(c))}
function eqStr(c,l){const a=eqF(c,l,l.f1),b=eqF(c,l,l.f2);return l.zoom?`${a}–${b} мм`:`${a} мм`}
function fStr(l){return l.zoom?`${nb(l.f1)}–${nb(l.f2)} мм`:`${nb(l.f1)} мм`}
function lensPool(){const c=ST.cam;const out=[];(LENS[FILE[c.mount]]||[]).forEach((l,i)=>{const f=lensFits(c,l);if(f)out.push(Object.assign({},l,{fit:f,rank:i}))});return out}
function eqBucket(c,l){const a=eqF(c,l,l.f1),b=eqF(c,l,l.f2);return {wide:a<=20,std:a<=35&&b>=50,port:!l.zoom&&a>=70&&a<=140||l.zoom&&a>=70&&b<=210,tele:b>=200}}
function picks(pool){const c=ST.cam;const P0=pool.filter(l=>!l.fit.ad&&!l.fit.ffOnCrop).sort((a,b)=>a.rank-b.rank);const P=[...P0.filter(l=>l.img),...P0.filter(l=>!l.img)];
 const used=new Set();const f=(lab,why,fn)=>{const l=P.find(x=>!used.has(x.id)&&fn(x));if(l)used.add(l.id);return l?{lab,why,l}:null};
 return [f("Универсальный зум","на каждый день и свадьбу",l=>l.zoom&&eqF(c,l,l.f1)<=30&&eqF(c,l,l.f2)>=70&&l.apn<=4),
  f("Светлый фикс","размытый фон в темноте",l=>!l.zoom&&l.apn<=1.8&&eqF(c,l,l.f1)>=30&&eqF(c,l,l.f1)<=60),
  f("Портретник","крупные планы и детали",l=>!l.zoom&&l.apn<=2&&eqF(c,l,l.f1)>=75&&eqF(c,l,l.f1)<=140),
  f("Широкий","интерьеры, влог, гимбал",l=>eqF(c,l,l.f1)<=20&&l.apn<=4),
  f("Лёгкий для гимбала","до 400 г",l=>l.weight&&l.weight<=400&&eqF(c,l,l.f1)<=40)].filter(Boolean)}
function lensList(pool){const q=LF.q.trim().toLowerCase();const c=ST.cam;
 let L=pool.filter(l=>(LF.src==="all"||(LF.src==="nat"?!l.fit.ad:l.fit.ad))&&(LF.kind==="all"||(LF.kind==="zoom"?l.zoom:!l.zoom))&&(LF.ap==="all"||l.apn<=parseFloat(LF.ap))&&(!LF.ois||l.ois)&&(!LF.sealed||l.sealed)&&l.price<=LF.budget&&(LF.brand==="all"||(LF.brand==="native"?l.brand.toLowerCase()===c.brand.toLowerCase()||(c.brand==="Panasonic"&&/Panasonic|Leica|Sigma/.test(l.brand)):l.brand.toLowerCase()!==c.brand.toLowerCase()))&&(!q||l.name.toLowerCase().includes(q))&&(LF.eq==="all"||eqBucket(c,l)[LF.eq]));
 const by={pop:(a,b)=>a.rank-b.rank,price:(a,b)=>a.price-b.price,"-price":(a,b)=>b.price-a.price,weight:(a,b)=>(a.weight||9999)-(b.weight||9999),ap:(a,b)=>a.apn-b.apn||a.rank-b.rank};
 return L.sort(by[LF.sort])}
function lensWarn(l){const w=[];const c=ST.cam;
 if(l.fit.ad)w.push({t:"Через "+MOUNT[c.mount].adName});
 if(l.fit.ffOnCrop)w.push({t:"Полнокадровый: тяжелее и дороже, зато останется при переходе на полный кадр"});
 if(c.k60==="crop"&&c.k60crop){const a=Math.round(l.f1*cropOf(c)*c.k60crop);w.push({t:`В 4K 60p ≈ ${a}${l.zoom?"–"+Math.round(l.f2*cropOf(c)*c.k60crop):""} мм`})}
 return w}
function lensCard(l){const c=ST.cam;const sel=ST.lens&&ST.lens.id===l.id;const w=lensWarn(l);
 return `<article class="pc${sel?" sel":""}">
  <div class="ph${l.img?"":" none"}">${l.img?img(l.img,l.name):"фото скоро"}</div>
  <div class="badges"><span>${l.ois?'<span class="bd ok">стаб.</span>':""}</span><span>${l.fit.ad?'<span class="bd warn">переходник</span>':l.fit.ffOnCrop?'<span class="bd">полный кадр</span>':""}</span></div>
  <div><div class="brand">${esc(l.brand)}</div><div class="name">${esc(l.name.replace(new RegExp("^"+l.brand+"\\s*","i"),""))}</div></div>
  <dl class="specs"><dt>Фокусное</dt><dd>${fStr(l)}</dd>${cropOf(c)!==1?`<dt>На этой камере</dt><dd>≈ ${eqStr(c,l)}</dd>`:""}
   <dt>Светосила</dt><dd class="${l.apn<=2?"c-ok":""}">${esc(l.ap)}</dd><dt>Вес</dt><dd>${l.weight?l.weight+" г":"—"}</dd><dt>Фильтр</dt><dd>${l.filter?l.filter+" мм":"—"}</dd></dl>
  ${w.length?`<div class="flags">${w.map(x=>`<div class="fl${x.r?" risk":""}">${esc(x.t)}</div>`).join("")}</div>`:""}
  <div class="pb"><div class="price">${usd(l.price)}<small>от, Украина</small></div>
   <div class="btns"><a class="btn" href="${l.url}" target="_blank" rel="noopener">Цены</a><button class="btn pri" type="button" data-lens="${l.id}">${sel?"Выбран":"Выбрать"}</button></div></div>
 </article>`}
function renderLens(){const c=ST.cam;const box=$("#lensBody");
 if(!c){box.innerHTML=`<div class="locked">Сначала выбери камеру — покажем объективы под её байонет.</div>`;return}
 const key=FILE[c.mount];
 if(!LENS[key]){box.innerHTML=`<div class="locked">Загружаю объективы ${esc(c.mount)}…</div>`;loadLens(key);return}
 const pool=lensPool();const pk=picks(pool);const L=lensList(pool);const ad=MOUNT[c.mount].ad;
 const brands=c.brand;
 box.innerHTML=`
  <div class="chosen">${img(c.img,c.model)}<div><b>${esc(c.brand)} ${esc(c.model)}</b><br><span>Байонет ${esc(c.mount)} · ${SENSOR[c.sensor]}${cropOf(c)!==1?` · кроп ${cx(cropOf(c))}`:""} · оптика ${camFmt(c)==="ff"?"под полный кадр":camFmt(c)==="mf"?"под средний формат":"под APS-C"} · подходит ${pool.length}</span></div></div>
  ${pk.length?`<div class="k">Подборка для старта</div><div class="picks">${pk.map(p=>`<button type="button" class="pick${ST.lens&&ST.lens.id===p.l.id?" sel":""}" data-lens="${p.l.id}"><span class="pk">${p.lab}</span><div class="ph${p.l.img?"":" none"}">${p.l.img?img(p.l.img,p.l.name):"фото скоро"}</div><b>${esc(p.l.name)}</b><small>${p.why} · ≈ ${eqStr(c,p.l)} · ${usd(p.l.price)}</small></button>`).join("")}</div>`:""}
  <div class="wid">
   <div class="wrow"><span class="wl">Тип</span><div class="cg">${chips([["all","Все"],["zoom","Зумы"],["prime","Фиксы"]],v=>LF.kind===v,"lkind")}</div>
    <span class="wl">Задача</span><div class="cg">${chips([["all","Любая"],["wide","Широкий"],["std","Стандартный"],["port","Портрет"],["tele","Теле"]],v=>LF.eq===v,"leq")}</div></div>
   <div class="wrow"><span class="wl">Светосила</span><div class="cg">${chips([["all","Любая"],["1.4","f/1.4 и светлее"],["2","до f/2"],["2.8","до f/2.8"],["4","до f/4"]],v=>LF.ap===v,"lap")}</div>
    <div class="cg">${chips([["ois","Стабилизация"],["sealed","Защита от влаги"]],v=>LF[v],"ltog")}</div></div>
   <div class="wrow"><span class="wl">Бренд</span><div class="cg">${chips([["all","Все"],["native",c.brand],["third","Сторонние"]],v=>LF.brand===v,"lbrand")}</div>
    ${camFmt(c)==="apsc"&&c.mount!=="Fujifilm X"?`<span class="wl">Формат</span><div class="cg">${chips([["0","Под APS-C"],["1","+ полнокадровые"]],v=>String(+LF.ffOnCrop)===v,"lff")}</div>`:""}
    ${ad?`<span class="wl">Байонет</span><div class="cg">${chips([["nat","Родной"],["ad","Через переходник"],["all","Все"]],v=>LF.src===v,"lsrc")}</div>`:""}</div>
   <div class="wrow"><span class="wl">Бюджет</span><div class="rng"><input type="range" id="lBud" min="100" max="4000" step="50" value="${LF.budget}" aria-label="Бюджет на объектив"><span>до <b>${LF.budget>=4000?"без лимита":usd(LF.budget)}</b></span></div></div>
   <div class="wfoot"><input type="search" id="lQ" placeholder="Найти: 24-70, Sigma, 50mm…" value="${esc(LF.q)}" aria-label="Поиск объектива"><span>Найдено <b>${L.length}</b> из ${pool.length}</span>
    <select id="lSort" aria-label="Сортировка">${[["pop","Популярные"],["price","Сначала дешевле"],["-price","Сначала дороже"],["ap","Самые светлые"],["weight","Самые лёгкие"]].map(s=>`<option value="${s[0]}"${s[0]===LF.sort?" selected":""}>${s[1]}</option>`).join("")}</select>
    <button class="lnk" type="button" id="lReset">Сбросить</button></div>
  </div>
  <div class="grid sm">${L.length?L.slice(0,LF.shown).map(lensCard).join(""):`<div class="empty">Ничего не нашлось. Сними пару фильтров.</div>`}</div>
  ${L.length>LF.shown?`<button class="btn more" type="button" id="lMore">Показать ещё ${Math.min(24,L.length-LF.shown)}</button>`:""}`;
}
async function loadLens(key){try{const r=await fetch(GP_BASE+"data/lenses-"+key+".json");LENS[key]=await r.json()}catch(e){LENS[key]=[];toast("Не удалось загрузить объективы")}renderLens()}

/* ---------- карты ---------- */
const BR=[["100","4K 30p, 8 бит",100],["150","4K 30p, 10 бит",150],["200","4K 60p, 10 бит",200],["600","All-I / ProRes",600],["1500","RAW",1500]];
let CRD={rate:null,gb:128,type:"all"};
function slotTypes(c){const s=c.cards;const t=new Set();if(/CFexpress A/.test(s))t.add("CFexpress A");if(/CFexpress B|XQD/.test(s))t.add("CFexpress B");if(/XQD/.test(s))t.add("XQD");
 if(/(^|[^o])SD/.test(s.replace(/microSD/g,"")))["SD V30","SD V60","SD V90"].forEach(x=>t.add(x));if(/microSD/.test(s))t.add("microSD");if(/(^|\+ )CF( \+|$)/.test(s))t.add("CF");return t}
function needClass(c){const raw=/RAW/.test(c.top);const hi=c.bit===10&&c.k60!=="none";return {min:hi?"SD V60":"SD V30",best:raw&&/CFexpress/.test(c.cards)?"CFexpress":hi?"SD V90":"SD V60",uhs1:/UHS-I(?!I)/.test(c.cards)}}
function cardVerdict(c,k){const n=needClass(c);const order={"SD V30":1,"SD V60":2,"SD V90":3};
 if(/CFexpress|XQD/.test(k.type))return {t:"для самых тяжёлых режимов",cls:"ok"};
 if(k.type==="CF"||k.type==="microSD")return {t:"для второго слота",cls:"ok"};
 if(n.uhs1)return k.type==="SD V30"?{t:"хватит для этой камеры",cls:"ok"}:{t:"слот UHS-I — быстрее не запишет",cls:"warn"};
 const o=order[k.type],m=order[n.min];return o<m?{t:"медленная для 4K 60p 10 бит",cls:"no"}:o===m?{t:"минимум для камеры",cls:"warn"}:{t:"с запасом",cls:"ok"}}
function cardCard(k){const c=ST.cam;const v=cardVerdict(c,k);const n=ST.cards.filter(x=>x.id===k.id).length;
 return `<article class="pc${n?" sel":""}">
  <div class="ph${k.img?"":" none"}">${k.img?img(k.img,k.name):"фото скоро"}</div>
  <div class="badges"><span><span class="bd ${v.cls}">${v.t}</span></span><span>${n?`<span class="bd anton">× ${n}</span>`:""}</span></div>
  <div><div class="brand">${esc(k.type)}</div><div class="name">${esc(k.name)}</div></div>
  <dl class="specs"><dt>Объём</dt><dd>${k.cap?k.cap+" ГБ":"—"}</dd><dt>Запись</dt><dd>${esc(k.write||"—")}</dd><dt>Чтение</dt><dd>${esc(k.read||"—")}</dd></dl>
  <div class="pb"><div class="price">${usd(k.price)}<small>от, Украина</small></div>
   <div class="btns"><a class="btn" href="${k.url}" target="_blank" rel="noopener">Цены</a>${n?`<button class="btn" type="button" data-card-del="${k.id}">−</button>`:""}<button class="btn pri" type="button" data-card="${k.id}">${n?"+ ещё":"Добавить"}</button></div></div>
 </article>`}
function renderCards(){const c=ST.cam;const box=$("#cardBody");if(!c){box.innerHTML=`<div class="locked">Сначала выбери камеру — покажем подходящие карты.</div>`;return}
 const T=slotTypes(c);const n=needClass(c);
 if(CRD.rate==null)CRD.rate=/RAW/.test(c.top)&&false?1500:(c.bit===10&&c.k60!=="none"?200:c.bit===10?150:100);
 const L=CARDS.filter(k=>T.has(k.type)&&(CRD.type==="all"||k.type===CRD.type)).sort((a,b)=>{const va=cardVerdict(c,a).cls,vb=cardVerdict(c,b).cls;const o={ok:0,warn:1,no:2};return o[va]-o[vb]||a.price-b.price});
 const mins=Math.floor(CRD.gb*8000/CRD.rate/60);
 box.innerHTML=`
  <div class="chosen">${img(c.img,c.model)}<div><b>${esc(c.brand)} ${esc(c.model)}</b><br><span>Слоты: ${c.slots===2?"два":"один"} — ${esc(c.cards)}</span></div></div>
  <div class="thesis">Для этой камеры минимум — <b>${esc(n.uhs1?"SD V30":n.min)}</b>${n.uhs1?" (слот UHS-I, быстрее карта не запишет)":`, с запасом — <b>${esc(n.best)}</b>`}. ${c.slots===2?"Два слота: вставь две карты и включи дублирование записи — так на свадьбе ничего не потеряется.":"Слот один — на важных съёмках меняй карты чаще и сразу копируй материал."}</div>
  <div class="calc"><div><div class="cl">Режим съёмки</div><div class="cg" style="margin-top:8px">${chips(BR.map(b=>[b[2],b[1]]),v=>CRD.rate==v,"rate")}</div></div>
   <div><div class="cl">Объём карты</div><div class="cg" style="margin-top:8px">${chips([[64,"64 ГБ"],[128,"128 ГБ"],[256,"256 ГБ"],[512,"512 ГБ"]],v=>CRD.gb==v,"gb")}</div></div>
   <div><div class="cl">Влезет видео</div><div class="cv">${mins>=60?Math.floor(mins/60)+" ч "+(mins%60)+" мин":mins+" мин"}</div><div style="font-size:12px;color:#9d9488;margin-top:6px">при ${CRD.rate} Мбит/с — ориентир</div></div></div>
  <div class="wid"><div class="wrow"><span class="wl">Тип</span><div class="cg">${chips([["all","Все подходящие"],...[...T].filter(t=>CARDS.some(k=>k.type===t)).map(t=>[t,t])],v=>CRD.type===v,"ctype")}</div></div></div>
  <div class="grid sm">${L.length?L.map(cardCard).join(""):`<div class="empty">Для этого слота карт в базе пока нет.</div>`}</div>`}

/* ---------- гимбал ---------- */
const ACC=150;
function setupW(){const c=ST.cam,l=ST.lens;return (c?c.weight:0)+(l&&l.weight?l.weight:0)+ACC}
function gVerdict(g,w){if(!g.payload)return {t:"нагрузка не указана",cls:"warn",o:3};const p=w/g.payload;return p<=0.7?{t:"с запасом",cls:"ok",o:0}:p<=0.9?{t:"подходит",cls:"ok",o:1}:p<=1?{t:"на пределе",cls:"warn",o:2}:{t:"не потянет",cls:"no",o:4}}
function gimCard(g,w){const v=gVerdict(g,w);const sel=ST.gim&&ST.gim.id===g.id;const pct=g.payload?Math.round(w/g.payload*100):null;
 return `<article class="pc${sel?" sel":""}">
  <div class="ph${g.img?"":" none"}">${g.img?img(g.img,g.name):"фото скоро"}</div>
  <div class="badges"><span><span class="bd ${v.cls}">${v.t}</span></span><span></span></div>
  <div><div class="brand">${esc(g.name.split(" ")[0])}</div><div class="name">${esc(g.name.split(" ").slice(1).join(" "))}</div></div>
  <dl class="specs"><dt>Нагрузка</dt><dd>${g.payload?(g.payload/1000).toString().replace(".",",")+" кг":"—"}</dd><dt>Сетап от нагрузки</dt><dd class="c-${v.cls==="ok"?"ok":v.cls==="warn"?"warn":"no"}">${pct!=null?pct+"%":"—"}</dd><dt>Вес гимбала</dt><dd>${g.weight?nb(g.weight)+" г":"—"}</dd></dl>
  <div class="pb"><div class="price">${usd(g.price)}<small>от, Украина</small></div>
   <div class="btns"><a class="btn" href="${g.url}" target="_blank" rel="noopener">Цены</a><button class="btn pri" type="button" data-gim="${g.id}">${sel?"Выбран":"Выбрать"}</button></div></div>
 </article>`}
function renderGim(){const box=$("#gimBody");const c=ST.cam,l=ST.lens;if(!c){box.innerHTML=`<div class="locked">Выбери камеру и объектив — посчитаем вес сетапа.</div>`;return}
 const w=setupW();const long=l&&((l.zoom&&l.f2>=150)||(l.weight&&l.weight>1000));
 const L=GIMS.slice().sort((a,b)=>gVerdict(a,w).o-gVerdict(b,w).o||a.price-b.price);
 box.innerHTML=`
  <div class="calc"><div><div class="cl">Камера</div><div class="cv">${nb(c.weight)} г</div><div style="font-size:12px;color:#9d9488;margin-top:6px">${esc(c.model)}, с батареей</div></div>
   <div><div class="cl">Объектив</div><div class="cv">${l&&l.weight?nb(l.weight)+" г":"—"}</div><div style="font-size:12px;color:#9d9488;margin-top:6px">${l?esc(l.name):"не выбран"}</div></div>
   <div><div class="cl">Сетап на гимбале</div><div class="cv">≈ ${nb(w)} г</div><div style="font-size:12px;color:#9d9488;margin-top:6px">+${ACC} г: площадка, ND-фильтр, карта</div></div></div>
  ${long?`<div class="note"><b>Длинный или тяжёлый объектив.</b> Балансировка будет сложной даже при подходящей нагрузке: бери гимбал с запасом и удлинённую площадку.</div>`:""}
  ${!l?`<div class="note">Объектив ещё не выбран — считаем только камеру. Выбери объектив выше, чтобы расчёт был точным.</div>`:""}
  ${has(c,"dslr")?`<div class="note"><b>Зеркалка.</b> На гимбале тяжелее и неудобнее, чем беззеркалка: проверь вес с объективом особенно внимательно.</div>`:""}
  <div class="wid"><div class="wfoot" style="border:0;padding:0"><span>Зелёные — нагрузка с запасом: сетап занимает до 70% от заявленного. Заявленная нагрузка — максимум для идеального баланса.</span><button class="lnk" type="button" id="noGim">${ST.noGim?"Вернуть гимбал в сетап":"Гимбал не нужен"}</button></div></div>
  <div class="grid sm">${L.map(g=>gimCard(g,w)).join("")}</div>`}

/* ---------- итог ---------- */
function items(){const c=ST.cam,l=ST.lens;const r=[];if(c)r.push({k:"Камера",n:c.brand+" "+c.model,p:c.price,img:c.img,x:c.avail==="used"?"б/у, ориентир":"корпус",a:"#gp-s1"});
 if(l)r.push({k:"Объектив",n:l.name,p:l.price,img:l.img,x:l.fit.ad?"+ "+MOUNT[c.mount].adName:fStr(l),a:"#gp-s2"});
 if(l&&l.fit.ad)r.push({k:"Переходник",n:MOUNT[c.mount].adName,p:{"Canon RF":100,"Canon EF-M":100,"Nikon Z":250}[c.mount],img:null,x:"ориентир",a:"#gp-s2"});
 const grp={};ST.cards.forEach(k=>{grp[k.id]=grp[k.id]||{k,q:0};grp[k.id].q++});Object.values(grp).forEach(({k,q})=>r.push({k:"Карта памяти",n:k.name+(k.cap?" "+k.cap+" ГБ":""),p:k.price*q,img:k.img,x:q>1?q+" шт.":k.type,a:"#gp-s3"}));
 if(ST.gim&&!ST.noGim)r.push({k:"Гимбал",n:ST.gim.name,p:ST.gim.price,img:ST.gim.img,x:"",a:"#gp-s4"});
 return r}
function renderSum(){const box=$("#sumBody");const it=items();if(!it.length){box.innerHTML=`<div class="locked">Здесь появится твой комплект.</div>`;return}
 const tot=it.reduce((s,i)=>s+(i.p||0),0);const l=ST.lens;const c=ST.cam;
 const tips=[];if(l&&l.filter)tips.push(`ND-вариатор под резьбу <b>${l.filter} мм</b> — чтобы снимать на открытой диафрагме днём.`);
 if(c)tips.push(`Запасные аккумуляторы: 2–3 штуки — на свадьбе одна батарея не доживает до банкета.`);
 if(c&&c.slots===2&&ST.cards.length<2)tips.push(`У камеры два слота — добавь вторую карту для дублирования записи.`);
 if(c&&c.slots===1)tips.push(`Один слот — <b>риск для свадьбы</b>: копируй материал сразу после каждого блока съёмки.`);
 box.innerHTML=`<div class="sum"><div class="slist">${it.map(i=>`<div class="srow"><a href="${i.a}">${i.img?img(i.img,i.n):""}</a><div><div class="sk">${i.k}</div><b>${esc(i.n)}</b><span class="sx">${esc(i.x)}</span></div><div class="sp">${usd(i.p)}</div></div>`).join("")}</div>
  <div class="total"><div class="k" style="color:#fbe0c8">Итого, ориентир</div><div class="tv">${usd(tot)}</div><p>≈ ${nb(tot*META.usd)} грн по курсу НБУ ${META.usdDate}. Цены — минимальные в магазинах Украины по e-каталогу; б/у — средний ориентир.</p>
   <button class="btn" type="button" id="gpCopy">Скопировать список</button></div></div>
  ${tips.length?`<div class="thesis">${tips.map(t=>`<div>${t}</div>`).join("")}</div>`:""}`}
function renderBar(){const it=items();const bar=$("#gpBar");const cb=$("#cmpBtn");cb.hidden=ST.cmp.length<2;cb.textContent=`Сравнить камеры (${ST.cmp.length})`;
 if(!it.length&&ST.cmp.length<2){bar.hidden=true;return}bar.hidden=false;
 $("#bthumbs").innerHTML=it.filter(i=>i.img).map(i=>`<a href="${i.a}" title="${esc(i.n)}">${img(i.img,i.n)}</a>`).join("");
 $("#btot").textContent=it.length?usd(it.reduce((s,i)=>s+(i.p||0),0)):"—"}
function renderMap(){const st=[["Камера",ST.cam&&ST.cam.model],["Объектив",ST.lens&&ST.lens.name],["Карты",ST.cards.length?ST.cards.length+" шт.":null],["Гимбал",ST.noGim?"не нужен":ST.gim&&ST.gim.name],["Сетап",null]];
 const cur=!ST.cam?0:!ST.lens?1:!ST.cards.length?2:!(ST.gim||ST.noGim)?3:4;
 $("#gpMap").innerHTML=st.map((s,i)=>`<a href="#gp-s${i+1}" class="${i===cur?"on":s[1]?"done":""}"><b>0${i+1}</b>${s[0]}<span>${esc(s[1]||(i===cur?"сейчас":"—"))}</span></a>`).join("")}
function renderAll(){renderMap();renderLens();renderCards();renderGim();renderSum();renderBar()}

/* ---------- модалки ---------- */
function vq(c,k){return c.verify&&c.verify.includes(k)?`<span class="vq">уточняется</span>`:""}
function openCam(id){const c=CAMS.find(x=>x.id===id);const w=camWarn(c);
 const rows=[["Матрица",SENSOR[c.sensor]],["Байонет",c.mount],["Максимальный режим",c.top],["4K 60p",k60T(c)+vq(c,"k60")+vq(c,"k60crop")],["Full HD","до "+c.fhd+"p"+vq(c,"fhd")],["Цвет",c.bit+" бит"],["Лог-профиль",c.log?c.log+(has(c,"hdmi10")?" — только по HDMI":""):"нет"],["Стабилизация матрицы",c.ibis?"есть":"нет"],["Слоты карт",(c.slots===2?"2: ":"1: ")+c.cards],["Видоискатель",c.evf?"есть":"нет"],["Вес с батареей","≈ "+c.weight+" г"+vq(c,"weight")],[c.avail==="used"?"Цена б/у":"Цена корпуса",usd(c.price)+(c.priceSrc==="ek"?" — от, магазины Украины":" — ориентир")],["Год",c.year]];
 modal(`<div class="mh"><div><div class="brand">${esc(c.brand)}</div><h2 style="font-size:30px">${esc(c.model)}</h2></div><button class="x" type="button" data-close aria-label="Закрыть">×</button></div>
  <div class="mimg">${img(c.img,c.model)}</div>${c.note?`<p style="margin:0">${esc(c.note)}</p>`:""}
  <div class="tbl"><table><tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join("")}</tbody></table></div>
  ${w.length?`<div class="flags">${w.map(x=>`<div class="fl${x.r?" risk":""}">${x.t}</div>`).join("")}</div>`:""}
  <div class="btns">${c.url?`<a class="btn" href="${c.url}" target="_blank" rel="noopener">Цены на e-каталоге</a>`:""}<button class="btn" type="button" data-cmp="${c.id}" aria-pressed="${ST.cmp.includes(c.id)}">${ST.cmp.includes(c.id)?"В сравнении":"Сравнить"}</button><button class="btn pri" type="button" data-cam="${c.id}">Выбрать эту камеру</button></div>`)}
function openCmp(){const cs=ST.cmp.map(id=>CAMS.find(x=>x.id===id));
 const rows=[["Цена",c=>usd(c.price)+(c.avail==="used"?" б/у":"")],["Матрица",c=>SENSOR[c.sensor]],["Байонет",c=>c.mount],["Максимум",c=>c.top],["4K 60p",c=>k60T(c)],["Full HD",c=>"до "+c.fhd+"p"],["Цвет",c=>c.bit+" бит"],["Лог",c=>c.log||"нет"],["Стабилизация",c=>c.ibis?"есть":"нет"],["Слоты",c=>String(c.slots)],["Видоискатель",c=>c.evf?"есть":"нет"],["Вес",c=>"≈ "+c.weight+" г"],["Год",c=>String(c.year)]];
 modal(`<div class="mh"><h2>Сравнение камер</h2><button class="x" type="button" data-close aria-label="Закрыть">×</button></div><p style="margin:0;color:var(--muted)">Подсвечены строки, где камеры отличаются.</p>
  <div class="tbl"><table><thead><tr><th></th>${cs.map(c=>`<th style="color:var(--ink)">${img(c.img,c.model,"cmpimg")}${esc(c.brand)} ${esc(c.model)}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(([n,f])=>{const v=cs.map(f);return `<tr class="${new Set(v).size>1?"diff":""}"><th>${n}</th>${v.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`}).join("")}
  <tr><th>Пометки</th>${cs.map(c=>`<td style="font-size:12px;color:var(--muted)">${camWarn(c).map(w=>esc(w.t)).join("<br>")||"—"}</td>`).join("")}</tr></tbody></table></div>
  <div class="btns"><button class="btn" type="button" id="cmpClear">Очистить сравнение</button></div>`,true)}
let lastF=null;
function modal(h,wide){lastF=document.activeElement;const m=$("#gpModal");m.className="gp-modal modal"+(wide?" wide":"");m.innerHTML=h;$("#gpOv").hidden=false;document.body.style.overflow="hidden";m.querySelector("[data-close]").focus()}
function closeM(){$("#gpOv").hidden=true;document.body.style.overflow="";try{lastF&&lastF.focus()}catch(e){}}
function toast(t){const d=document.createElement("div");d.className="gp-toast";d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function go(id){const el=$(id);if(el)el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"})}

/* ---------- события ---------- */
document.addEventListener("click",e=>{if(!e.target.closest(".gp,.gp-ov,.gp-bar,.gp-hero"))return;const t=e.target.closest("button,[data-close]");if(!t){if(e.target.id==="gpOv")closeM();return}const d=t.dataset;
 if(d.task!=null){CF.task=CF.task===d.task?null:d.task;CF.sort=CF.task?"fit":(CF.sort==="fit"?"price":CF.sort);CF.shown=24;camUI()}
 else if(d.bud!=null){CF.budget=+d.bud;CF.shown=24;camUI()}
 else if(d.tog!=null){CF[d.tog]=!CF[d.tog];CF.shown=24;camUI()}
 else if(d.sensor!=null){CF.sensor=d.sensor;camUI()}else if(d.avail!=null){CF.avail=d.avail;camUI()}else if(d.brand!=null){CF.brand=d.brand;camUI()}
 else if(t.id==="cReset"){Object.assign(CF,structuredClone(CF0));camUI()}
 else if(t.id==="camMore"){CF.shown+=24;renderCams()}
 else if(d.camOpen){openCam(d.camOpen)}
 else if(d.cmp){const id=d.cmp;ST.cmp=ST.cmp.includes(id)?ST.cmp.filter(x=>x!==id):[...ST.cmp.slice(-2),id];const inM=!$("#gpOv").hidden;renderCams();renderBar();if(inM)openCam(id)}
 else if(t.id==="cmpBtn"){openCmp()}else if(t.id==="cmpClear"){ST.cmp=[];closeM();renderCams();renderBar()}
 else if(d.cam){const c=CAMS.find(x=>x.id===d.cam);const changed=!ST.cam||ST.cam.mount!==c.mount||camFmt(ST.cam)!==camFmt(c);ST.cam=c;if(changed){ST.lens=null;LF=structuredClone(LF0)}ST.cards=[];CRD={rate:null,gb:128,type:"all"};closeM();renderCams();renderAll();go("#gp-s2")}
 else if(d.lkind!=null){LF.kind=d.lkind;LF.shown=24;renderLens()}else if(d.leq!=null){LF.eq=d.leq;LF.shown=24;renderLens()}else if(d.lap!=null){LF.ap=d.lap;LF.shown=24;renderLens()}
 else if(d.ltog!=null){LF[d.ltog]=!LF[d.ltog];LF.shown=24;renderLens()}else if(d.lbrand!=null){LF.brand=d.lbrand;LF.shown=24;renderLens()}else if(d.lsrc!=null){LF.src=d.lsrc;LF.shown=24;renderLens()}else if(d.lff!=null){LF.ffOnCrop=d.lff==="1";LF.shown=24;renderLens()}
 else if(t.id==="lReset"){LF=structuredClone(LF0);renderLens()}else if(t.id==="lMore"){LF.shown+=24;renderLens()}
 else if(d.lens){const p=lensPool().find(x=>x.id===d.lens);ST.lens=ST.lens&&ST.lens.id===d.lens?null:p;renderAll();if(ST.lens)go("#gp-s3")}
 else if(d.rate!=null){CRD.rate=+d.rate;renderCards()}else if(d.gb!=null){CRD.gb=+d.gb;renderCards()}else if(d.ctype!=null){CRD.type=d.ctype;renderCards()}
 else if(d.card){const k=CARDS.find(x=>x.id===d.card);ST.cards.push(k);renderAll()}
 else if(d.cardDel){const i=ST.cards.findIndex(x=>x.id===d.cardDel);if(i>=0)ST.cards.splice(i,1);renderAll()}
 else if(d.gim){const g=GIMS.find(x=>x.id===d.gim);ST.gim=ST.gim&&ST.gim.id===d.gim?null:g;ST.noGim=false;renderAll();if(ST.gim)go("#gp-s5")}
 else if(t.id==="noGim"){ST.noGim=!ST.noGim;if(ST.noGim)ST.gim=null;renderAll();if(ST.noGim)go("#gp-s5")}
 else if(t.id==="gpCopy"){const it=items();const tx="Мой сетап (Matis Academy)\n"+it.map(i=>`• ${i.k}: ${i.n}${i.x?" ("+i.x+")":""} — ${usd(i.p)}`).join("\n")+`\nИтого ≈ ${usd(it.reduce((s,i)=>s+(i.p||0),0))}`;
   navigator.clipboard.writeText(tx).then(()=>toast("Список скопирован")).catch(()=>{modal(`<div class="mh"><h2>Список</h2><button class="x" type="button" data-close aria-label="Закрыть">×</button></div><textarea style="width:100%;min-height:200px;border-radius:12px;border:1px solid var(--line);padding:12px" readonly>${esc(tx)}</textarea>`)})}
 else if(t.hasAttribute("data-close"))closeM();
});
document.addEventListener("input",e=>{const id=e.target.id;
 if(id==="cBud"){CF.budget=+e.target.value;CF.shown=24;const p=e.target.parentElement.querySelector("b");p.textContent=CF.budget>=7500?"без лимита":usd(CF.budget);renderCams()}
 else if(id==="cQ"){CF.q=e.target.value;CF.shown=24;renderCams()}
 else if(id==="lBud"){LF.budget=+e.target.value;LF.shown=24;const pos=e.target.selectionStart;renderLens();const n=$("#lBud");n&&n.focus()}
 else if(id==="lQ"){LF.q=e.target.value;LF.shown=24;renderLens();const n=$("#lQ");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}}});
document.addEventListener("change",e=>{if(e.target.id==="cSort"){CF.sort=e.target.value;renderCams()}else if(e.target.id==="lSort"){LF.sort=e.target.value;renderLens()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#gpOv").hidden)closeM()});
document.addEventListener("click",e=>{const w=e.target.closest("[data-gpw]");if(w)setW(w.dataset.gpw)});

(async function boot(){
 mount();
 renderMap();
 try{
  const [m,c,k,g]=await Promise.all(["meta","cams","cards","gimbals"].map(f=>fetch(GP_BASE+"data/"+f+".json").then(r=>r.json())));
  META=m;CAMS=c;CARDS=k.filter(x=>!x.cap||x.cap>=32);GIMS=g;
 }catch(e){$("#camG").innerHTML=`<div class="empty">Не удалось загрузить базу камер. Обнови страницу.</div>`;return}
 camUI();renderAll();
 $("#gpExcl").innerHTML=META.excluded.map(e=>`<div class="ex"><h3>${esc(e.group)}</h3><p>${esc(e.models)}</p><p>${esc(e.reason)}</p></div>`).join("");
 $("#gpFoot").innerHTML=`База: ${CAMS.length} камер, ${META.lensCount} объективов, ${CARDS.length} карт, ${GIMS.length} гимбалов. Цены — минимальные в магазинах Украины по <a href="https://ek.ua" target="_blank" rel="noopener">e-каталогу</a> на ${META.date}, пересчёт в $ по курсу НБУ ${META.usd} грн (${META.usdDate}); у снятых с производства камер — средняя цена б/у. Вес камер — с батареей, ориентир. Пометка «уточняется» — значение сверяется с официальной спецификацией. Фото — изображения производителей из e-каталога.`;
})();
})();
