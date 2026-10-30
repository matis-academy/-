/* Компьютер для DaVinci Resolve — Matis Academy (Claude, 30.10.2026). Бета. Стиль MVC. Цены: PC_BASE/data/prices.json (ek.ua, $ по курсу НБУ). */
(function(){"use strict";
var BASE=(window.PC_BASE||"").replace(/\/?$/,"/");
var UK=/^uk/i.test(document.documentElement.lang||"")||/^\/uk\//.test(location.pathname);
var t=function(ru,uk){return UK?uk:ru;};
var $=function(s,r){return (r||document).querySelector(s);};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});};
var nf=function(x,d){return Number(x).toLocaleString(UK?"uk-UA":"ru-RU",{maximumFractionDigits:d==null?0:d});};
var lim=function(v,a,b){return Math.min(b,Math.max(a,v));};
var worst=function(a){return a.indexOf("bad")>=0?"bad":a.indexOf("warn")>=0?"warn":"ok";};
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ширина колонки (BRAND_KIT 4.1) */
function getW(){try{return localStorage.getItem("mvc-w")||"std";}catch(e){return "std";}}
function setW(v){document.documentElement.setAttribute("data-mvc-w",v);try{localStorage.setItem("mvc-w",v);}catch(e){}document.querySelectorAll("[data-pcw]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.pcw===v));});}
document.documentElement.setAttribute("data-mvc-w",getW());

/* ================= данные ================= */
var FAM={
 hevc422:{n:t("H.265 4:2:2 10 бит","H.265 4:2:2 10 біт"),lg:1},
 hevc420:{n:t("H.265 4:2:0 10 бит","H.265 4:2:0 10 біт"),lg:1},
 h264_422:{n:t("H.264 4:2:2 10 бит","H.264 4:2:2 10 біт"),lg:1},
 h264_10:{n:t("H.264 4:2:0 10 бит","H.264 4:2:0 10 біт"),lg:1},
 h264_420:{n:t("H.264 4:2:0 8 бит","H.264 4:2:0 8 біт"),lg:1},
 intra:{n:t("All-Intra 4:2:2 10 бит","All-Intra 4:2:2 10 біт"),lg:0},
 prores:{n:"ProRes 422 HQ",lg:0},
 braw:{n:"Blackmagic RAW",lg:0},
 raw:{n:"RAW (Cinema RAW, N-RAW, ProRes RAW)",lg:0}};
var DEC_COLS=[t("Intel Quick Sync<br>(встроенная графика)","Intel Quick Sync<br>(вбудована графіка)"),"Intel Arc","NVIDIA<br>RTX 50","NVIDIA<br>RTX 20–40","AMD<br>Radeon","Apple<br>Silicon"];
var DEC={hevc422:"yyynny",hevc420:"yyyyyy",h264_422:"nnynny",h264_10:"nnynny",h264_420:"yyyyyy",intra:"cccccc",prores:"ccccc y".replace(" ",""),braw:"gggggg",raw:"gggggg"};
var DEC_TXT={y:t("да","так"),n:t("нет","ні"),c:t("ЦП","ЦП"),g:"GPU"};
var F_=function(f,tr,tu,sr,su,m,d){return {f:f,t:UK?tu:tr,s:UK?su:sr,m:m,d:d};};
var CAMS=[
 {id:"sony",n:"Sony",sub:t("α и FX","α і FX"),models:"A7 IV, A7S III, A7 V, A1 II, FX3, FX30, A6700, ZV-E1",card:t("CFexpress Type A и/или SD — зависит от модели","CFexpress Type A та/або SD — залежить від моделі"),fmts:[
  F_("hevc422","XAVC HS","XAVC HS","H.265 4:2:2 10 бит, S-Log3","H.265 4:2:2 10 біт, S-Log3",200,1),
  F_("h264_422","XAVC S","XAVC S","H.264 4:2:2 10 бит, S-Log3","H.264 4:2:2 10 біт, S-Log3",200),
  F_("intra","XAVC S-I","XAVC S-I","All-Intra H.264 4:2:2 10 бит","All-Intra H.264 4:2:2 10 біт",600),
  F_("h264_420","XAVC S 8 бит","XAVC S 8 біт","H.264 4:2:0 8 бит","H.264 4:2:0 8 біт",100)]},
 {id:"canon",n:"Canon",sub:t("EOS R и Cinema","EOS R і Cinema"),models:"R5, R5 Mark II, R6 Mark II, R6 Mark III, R8, C70",card:t("CFexpress Type B и/или SD — зависит от модели","CFexpress Type B та/або SD — залежить від моделі"),fmts:[
  F_("hevc422","H.265 IPB","H.265 IPB","4:2:2 10 бит, C-Log 3","4:2:2 10 біт, C-Log 3",200,1),
  F_("hevc422","H.265 ALL-I","H.265 ALL-I","4:2:2 10 бит, внутрикадровый, высокий битрейт","4:2:2 10 біт, внутрішньокадровий, високий бітрейт",600),
  F_("h264_420","H.264 IPB","H.264 IPB","4:2:0 8 бит","4:2:0 8 біт",120),
  F_("raw","Cinema RAW Light","Cinema RAW Light","R5, R5 Mark II, C70","R5, R5 Mark II, C70",1000)]},
 {id:"pana",n:"Panasonic",sub:t("Lumix S и GH","Lumix S і GH"),models:"S5 II, S5 IIX, S1 II, GH6, GH7",card:t("SD и/или CFexpress Type B — зависит от модели","SD та/або CFexpress Type B — залежить від моделі"),fmts:[
  F_("h264_422","MOV LongGOP 4:2:2","MOV LongGOP 4:2:2","H.264 4:2:2 10 бит, V-Log","H.264 4:2:2 10 біт, V-Log",150,1),
  F_("hevc420","MOV H.265","MOV H.265","4:2:0 10 бит, V-Log","4:2:0 10 біт, V-Log",200),
  F_("intra","ALL-I 4:2:2","ALL-I 4:2:2","H.264 4:2:2 10 бит, внутрикадровый","H.264 4:2:2 10 біт, внутрішньокадровий",400),
  F_("prores","ProRes 422 HQ","ProRes 422 HQ","S5 IIX, S1 II, GH6, GH7","S5 IIX, S1 II, GH6, GH7",1400)]},
 {id:"nikon",n:"Nikon",sub:"Z",models:"Z6 III, Z8, Z9, Zf",card:t("CFexpress Type B и/или SD — зависит от модели","CFexpress Type B та/або SD — залежить від моделі"),fmts:[
  F_("hevc420","H.265 10 бит","H.265 10 біт","4:2:0 10 бит, N-Log","4:2:0 10 біт, N-Log",200,1),
  F_("prores","ProRes 422 HQ","ProRes 422 HQ","Z6 III, Z8, Z9","Z6 III, Z8, Z9",1400),
  F_("raw","N-RAW / ProRes RAW","N-RAW / ProRes RAW","Z6 III, Z8, Z9","Z6 III, Z8, Z9",1600),
  F_("h264_420","H.264 8 бит","H.264 8 біт","4:2:0 8 бит","4:2:0 8 біт",120)]},
 {id:"fuji",n:"Fujifilm",sub:"X",models:"X-H2S, X-H2, X-T5, X-S20, X-M5",card:t("CFexpress Type B и/или SD — зависит от модели","CFexpress Type B та/або SD — залежить від моделі"),fmts:[
  F_("hevc422","MOV H.265","MOV H.265","4:2:2 10 бит, F-Log2","4:2:2 10 біт, F-Log2",200,1),
  F_("h264_422","MOV H.264","MOV H.264","4:2:2 10 бит, F-Log2","4:2:2 10 біт, F-Log2",200),
  F_("prores","ProRes 422 HQ","ProRes 422 HQ","X-H2S, X-H2","X-H2S, X-H2",1400)]},
 {id:"dji",n:"DJI",sub:t("дроны и Osmo","дрони й Osmo"),models:"Mavic 4 Pro, Mavic 3 Pro, Air 3S, Osmo Pocket 3, Osmo Action",card:t("microSD (UHS-I V30 и выше)","microSD (UHS-I V30 і вище)"),fmts:[
  F_("hevc420","H.265 10 бит","H.265 10 біт","4:2:0 10 бит, D-Log M","4:2:0 10 біт, D-Log M",150,1),
  F_("h264_10","H.264 10 бит","H.264 10 біт","4:2:0 10 бит, D-Log M","4:2:0 10 біт, D-Log M",150)]},
 {id:"iphone",n:"iPhone",sub:"15 / 16 / 17 Pro",models:"iPhone 15 Pro, 16 Pro, 17 Pro",card:t("USB-C и внешний SSD для ProRes","USB-C і зовнішній SSD для ProRes"),fmts:[
  F_("hevc420","HEVC 10 бит","HEVC 10 біт","4:2:0 10 бит, Dolby Vision HDR","4:2:0 10 біт, Dolby Vision HDR",100,1),
  F_("prores","ProRes 422 HQ Log","ProRes 422 HQ Log","Apple Log, запись 4K60 — на внешний SSD","Apple Log, запис 4K60 — на зовнішній SSD",1400)]},
 {id:"bm",n:"Blackmagic",sub:t("Pocket и Cinema","Pocket і Cinema"),models:"Pocket 4K / 6K, Cinema Camera 6K, PYXIS 6K",card:t("CFexpress B, CFast или USB-C SSD — зависит от модели","CFexpress B, CFast або USB-C SSD — залежить від моделі"),fmts:[
  F_("braw","Blackmagic RAW 12:1","Blackmagic RAW 12:1","родной RAW Resolve, лёгкий в работе","рідний RAW Resolve, легкий у роботі",500,1),
  F_("prores","ProRes 422 HQ","ProRes 422 HQ","4:2:2 10 бит","4:2:2 10 біт",1400)]},
 {id:"other",n:t("Другая","Інша"),sub:t("выбрать кодек","обрати кодек"),models:t("Выберите кодек вручную: он указан в меню камеры или в свойствах файла (MediaInfo).","Оберіть кодек вручну: він указаний у меню камери або у властивостях файлу (MediaInfo)."),card:t("Кард-ридер под карты вашей камеры, USB 3.2 10 Гбит/с и быстрее","Кардрідер під карти вашої камери, USB 3.2 10 Гбіт/с і швидше"),fmts:[
  F_("hevc422","H.265 4:2:2 10 бит","H.265 4:2:2 10 біт","HEVC, Long GOP","HEVC, Long GOP",200,1),
  F_("h264_422","H.264 4:2:2 10 бит","H.264 4:2:2 10 біт","AVC, Long GOP","AVC, Long GOP",200),
  F_("hevc420","H.265 4:2:0 10 бит","H.265 4:2:0 10 біт","HEVC, Long GOP","HEVC, Long GOP",150),
  F_("h264_10","H.264 4:2:0 10 бит","H.264 4:2:0 10 біт","AVC, Long GOP","AVC, Long GOP",150),
  F_("h264_420","H.264 4:2:0 8 бит","H.264 4:2:0 8 біт","AVC, Long GOP","AVC, Long GOP",100),
  F_("intra","All-Intra 10 бит","All-Intra 10 біт","внутрикадровый H.264/H.265","внутрішньокадровий H.264/H.265",500),
  F_("prores","ProRes 422 / HQ","ProRes 422 / HQ","внутрикадровый","внутрішньокадровий",1400),
  F_("raw","RAW","RAW","Cinema RAW, N-RAW, ProRes RAW, ARRIRAW и др.","Cinema RAW, N-RAW, ProRes RAW, ARRIRAW тощо",1500)]}];

var CPU_I=[
 {id:"u250",n:"Intel Core Ultra 5 250K Plus",s:t("18 ядер (6P + 12E), LGA1851, плата B860 / Z890","18 ядер (6P + 12E), LGA1851, плата B860 / Z890"),perf:1.7},
 {id:"u270",n:"Intel Core Ultra 7 270K Plus",s:t("24 ядра (8P + 16E), LGA1851, плата Z890","24 ядра (8P + 16E), LGA1851, плата Z890"),perf:2.35},
 {id:"u285",n:"Intel Core Ultra 9 285K",s:t("24 ядра (8P + 16E), LGA1851, плата Z890","24 ядра (8P + 16E), LGA1851, плата Z890"),perf:2.5}];
var CPU_A=[
 {id:"r96",n:"AMD Ryzen 5 9600X",s:t("6 ядер / 12 потоков, AM5, плата B850","6 ядер / 12 потоків, AM5, плата B850"),perf:1.1},
 {id:"r97",n:"AMD Ryzen 7 9700X",s:t("8 ядер / 16 потоков, AM5, плата B850","8 ядер / 16 потоків, AM5, плата B850"),perf:1.4},
 {id:"r99",n:"AMD Ryzen 9 9900X",s:t("12 ядер / 24 потока, AM5, плата B850 / X870","12 ядер / 24 потоки, AM5, плата B850 / X870"),perf:2.0},
 {id:"r995",n:"AMD Ryzen 9 9950X",s:t("16 ядер / 32 потока, AM5, плата X870","16 ядер / 32 потоки, AM5, плата X870"),perf:2.6},
 {id:"r995x3d",n:"AMD Ryzen 9 9950X3D",s:t("16 ядер / 32 потока, кэш 3D V-Cache, AM5","16 ядер / 32 потоки, кеш 3D V-Cache, AM5"),perf:2.7}];
/* hevc — H.265 4:2:2; h264 — H.264 4:2:2/10 бит; ai — шумодав и AI; perf — сила в эффектах. По цене. */
var GPUS=[
 {id:"b580",n:"Intel Arc B580 12 ГБ",sh:"Arc B580",v:12,psu:550,hevc:1,h264:0,ai:1,perf:1.15},
 {id:"9060xt",n:"AMD Radeon RX 9060 XT 16 ГБ",sh:"RX 9060 XT",v:16,psu:600,hevc:0,h264:0,ai:0,perf:1.3},
 {id:"5060ti",n:"NVIDIA RTX 5060 Ti 16 ГБ",sh:"RTX 5060 Ti",v:16,psu:650,hevc:1,h264:1,ai:2,perf:1.4},
 {id:"5070",n:"NVIDIA RTX 5070 12 ГБ",sh:"RTX 5070",v:12,psu:750,hevc:1,h264:1,ai:2,perf:2},
 {id:"9070xt",n:"AMD Radeon RX 9070 XT 16 ГБ",sh:"RX 9070 XT",v:16,psu:750,hevc:0,h264:0,ai:0,perf:2.2},
 {id:"5070ti",n:"NVIDIA RTX 5070 Ti 16 ГБ",sh:"RTX 5070 Ti",v:16,psu:850,hevc:1,h264:1,ai:3,perf:3},
 {id:"5080",n:"NVIDIA RTX 5080 16 ГБ",sh:"RTX 5080",v:16,psu:850,hevc:1,h264:1,ai:3,perf:3.5},
 {id:"5090",n:"NVIDIA RTX 5090 32 ГБ",sh:"RTX 5090",v:32,psu:1000,hevc:1,h264:1,ai:3,perf:5}];
GPUS.forEach(function(g){g.n=g.n.replace("ГБ",t("ГБ","ГБ"));});
var PERF_NEED=[0.9,1.1,1.9,2.9,4.5];
var H=function(id,g,n,v,psu,hevc,h264,ai,perf,old){return {id:id,g:g,n:n,v:v,psu:psu,hevc:hevc,h264:h264,ai:ai,perf:perf,old:old};};
var HAVE=[{id:"none",n:t("Нет, подбираю новую","Ні, підбираю нову")},
 H("1070","GTX 10","GTX 1070 / 1070 Ti 8 ГБ",8,550,0,0,0,.5,1),H("1080ti","GTX 10","GTX 1080 Ti 11 ГБ",11,650,0,0,0,.8,1),
 H("2070s","RTX 20","RTX 2070 Super / 2080 8 ГБ",8,650,0,0,2,.8),H("2080ti","RTX 20","RTX 2080 Ti 11 ГБ",11,650,0,0,2,1),
 H("3060","RTX 30","RTX 3060 12 ГБ",12,550,0,0,2,.9),H("3070","RTX 30","RTX 3070 / 3070 Ti 8 ГБ",8,650,0,0,2,1.1),H("3080","RTX 30","RTX 3080 10–12 ГБ",10,750,0,0,2,1.6),H("3090","RTX 30","RTX 3090 / 3090 Ti 24 ГБ",24,850,0,0,2,2),
 H("4060","RTX 40","RTX 4060 / 4060 Ti 8 ГБ",8,550,0,0,2,.9),H("4060ti16","RTX 40","RTX 4060 Ti 16 ГБ",16,550,0,0,2,1.1),H("4070","RTX 40","RTX 4070 / 4070 Super 12 ГБ",12,650,0,0,2,1.6),H("4070tis","RTX 40","RTX 4070 Ti Super 16 ГБ",16,750,0,0,2,2.3),H("4080","RTX 40","RTX 4080 / 4080 Super 16 ГБ",16,850,0,0,3,2.8),H("4090","RTX 40","RTX 4090 24 ГБ",24,1000,0,0,3,4),
 H("5060ti8","RTX 50","RTX 5060 / 5060 Ti 8 ГБ",8,550,1,1,2,1.2),H("5060ti","RTX 50","RTX 5060 Ti 16 ГБ",16,650,1,1,2,1.4),H("5070","RTX 50","RTX 5070 12 ГБ",12,750,1,1,2,2),H("5070ti","RTX 50","RTX 5070 Ti / 5080 16 ГБ",16,850,1,1,3,3),H("5090","RTX 50","RTX 5090 32 ГБ",32,1000,1,1,3,5),
 H("6800xt","AMD Radeon","RX 6800 XT / 7800 XT 16 ГБ",16,750,0,0,0,1.3),H("7900xtx","AMD Radeon","RX 7900 XT / XTX 20–24 ГБ",20,850,0,0,0,2),H("9070xt","AMD Radeon","RX 9060 XT / 9070 / 9070 XT 16 ГБ",16,750,0,0,0,1.8),
 H("a770","Intel Arc","Arc A770 16 ГБ",16,650,1,0,1,1),H("b580","Intel Arc","Arc B570 / B580 10–12 ГБ",12,550,1,0,1,1.1)];
var MAC_D=[
 {id:"mini6",n:"Mac mini M6",mem:[16,24,32],perf:1},
 {id:"mini5p",n:"Mac mini M5 Pro",mem:[24,48,64],perf:2},
 {id:"studio5m",n:"Mac Studio M5 Max",mem:[36,48,64,128],perf:3},
 {id:"studio5u",n:"Mac Studio M5 Ultra",mem:[96,256,512],perf:4.5}];
var MAC_L=[
 {id:"mbp5",n:"MacBook Pro 14″ M5",mem:[16,24,32],perf:.9},
 {id:"mbp5p",n:"MacBook Pro 14″ / 16″ M5 Pro",mem:[24,48,64],perf:2},
 {id:"mbp5m",n:"MacBook Pro 14″ / 16″ M5 Max",mem:[36,48,64,128],perf:3}];
var M=function(id,d,n,sr,su,lv,p3){return {id:id,d:d,n:n,s:UK?su:sr,lv:lv,p3:p3};};
var MONS=[
 M("pa248qv",24,"ASUS ProArt PA248QV","24,1″ 1920×1200, 100% sRGB / Rec.709, заводская калибровка ΔE < 2","24,1″ 1920×1200, 100% sRGB / Rec.709, заводське калібрування ΔE < 2",1,0),
 M("sw240",24,"BenQ SW240","24,1″ 1920×1200, 99% Adobe RGB, 95% DCI-P3, ΔE ≤ 2, аппаратная калибровка","24,1″ 1920×1200, 99% Adobe RGB, 95% DCI-P3, ΔE ≤ 2, апаратне калібрування",3,95),
 M("pa278qv",27,"ASUS ProArt PA278QV","27″ 2560×1440, 100% sRGB / Rec.709, заводская калибровка ΔE < 2","27″ 2560×1440, 100% sRGB / Rec.709, заводське калібрування ΔE < 2",1,0),
 M("cb272k",27,"Acer CB272K","27″ 4K, 100% sRGB, заводская калибровка ΔE < 1","27″ 4K, 100% sRGB, заводське калібрування ΔE < 1",1,0),
 M("pa279crv",27,"ASUS ProArt PA279CRV","27″ 4K, 99% DCI-P3, 99% Adobe RGB, заводская калибровка ΔE < 2","27″ 4K, 99% DCI-P3, 99% Adobe RGB, заводське калібрування ΔE < 2",2,99),
 M("u2725qe",27,"Dell UltraSharp U2725QE","27″ 4K 120 Гц, 99% DCI-P3, заводская калибровка ΔE < 1,5","27″ 4K 120 Гц, 99% DCI-P3, заводське калібрування ΔE < 1,5",2,99),
 M("sw272u",27,"BenQ SW272U","27″ 4K, 99% Adobe RGB и DCI-P3, аппаратная калибровка, профиль в мониторе","27″ 4K, 99% Adobe RGB і DCI-P3, апаратне калібрування, профіль у моніторі",3,99),
 M("cs2740",27,"EIZO ColorEdge CS2740","27″ 4K, 99% Adobe RGB, ~90% DCI-P3, аппаратная калибровка (16-бит 3D LUT)","27″ 4K, 99% Adobe RGB, ~90% DCI-P3, апаратне калібрування (16-біт 3D LUT)",3,90),
 M("pd3205u",32,"BenQ PD3205U","31,5″ 4K, 99% sRGB / Rec.709, заводская калибровка","31,5″ 4K, 99% sRGB / Rec.709, заводське калібрування",1,0),
 M("pa329crv",32,"ASUS ProArt PA329CRV","31,5″ 4K, 98% DCI-P3, заводская калибровка ΔE < 2","31,5″ 4K, 98% DCI-P3, заводське калібрування ΔE < 2",2,98),
 M("u3226qer",32,"Dell UltraSharp U3226QER","31,5″ 4K, 99% DCI-P3, заводская калибровка ΔE < 1,5","31,5″ 4K, 99% DCI-P3, заводське калібрування ΔE < 1,5",2,99),
 M("pa32ucdm",32,"ASUS ProArt PA32UCDM","31,5″ 4K QD-OLED, 99% DCI-P3, для HDR","31,5″ 4K QD-OLED, 99% DCI-P3, для HDR",2,99),
 M("sw321c",32,"BenQ SW321C","32″ 4K, 99% Adobe RGB, 95% DCI-P3, аппаратная калибровка","32″ 4K, 99% Adobe RGB, 95% DCI-P3, апаратне калібрування",3,95)];

/* цены */
var PR={items:{},rate:null,rate_date:""};
function price(id){var p=PR.items[id];return p&&p.usd?p:null;}
function ptxt(id){var p=price(id);return p?"$"+nf(p.usd)+" · "+nf(p.uah)+" грн":t("цену уточняем","ціну уточнюємо");}
function pshort(id){var p=price(id);return p?"$"+nf(p.usd):"—";}

/* ================= состояние ================= */
var DEF={platform:"pc",cpu:"intel",form:"desktop",cam:"sony",fmt:0,mbps:200,fps:60,color:true,nr:false,streams:1,studio:true,hours:6,parallel:3,monthly:4,have:"none",diag:27,gamut:1,budget:"rec",sel:{}};
var S=JSON.parse(JSON.stringify(DEF));
try{var sv=JSON.parse(localStorage.getItem("pcp-state")||"null");if(sv&&typeof sv==="object")Object.keys(DEF).forEach(function(k){if(k in sv)S[k]=sv[k];});}catch(e){}
if(!HAVE.some(function(h){return h.id===S.have;}))S.have="none";
if(!S.sel||typeof S.sel!=="object")S.sel={};
function save(){try{localStorage.setItem("pcp-state",JSON.stringify(S));}catch(e){}}
function cam(){return CAMS.filter(function(c){return c.id===S.cam;})[0]||CAMS[0];}
if(S.fmt>=cam().fmts.length)S.fmt=0;

function ladder(key,list,rec){
 var last=list.length-1;
 var labels=list.map(function(_,i){var a=[];if(i===0)a.push(t("минимум","мінімум"));if(i===rec)a.push(t("рекомендую","рекомендую"));if(i===last&&last>0)a.push(t("топ","топ"));if(!a.length)a.push(i>rec?t("с запасом","із запасом"):t("подходит","підходить"));return a.join(" · ");});
 var idx=-1;list.forEach(function(x,i){if(x.id===S.sel[key])idx=i;});
 if(idx<0)idx=S.budget==="min"?0:S.budget==="top"?last:rec;
 return {idx:idx,labels:labels};
}

/* ================= разметка ================= */
var CAT='<svg viewBox="0 0 200 220" aria-hidden="true"><path d="M140 206 C180 208 192 168 168 146" stroke="#1f1f23" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M56 210 C44 168 64 126 100 126 C136 126 156 168 144 210 Z" fill="#1f1f23"/><ellipse cx="80" cy="208" rx="17" ry="10" fill="#f7f5f0"/><ellipse cx="120" cy="208" rx="17" ry="10" fill="#f7f5f0"/><path d="M74 204 v6 M86 204 v6 M114 204 v6 M126 204 v6" stroke="#c9c4ba" stroke-width="1.8" stroke-linecap="round"/><path d="M48 80 Q36 20 58 14 Q82 22 94 46 Z" fill="#1f1f23"/><path d="M152 80 Q164 20 142 14 Q118 22 106 46 Z" fill="#1f1f23"/><path d="M58 64 Q52 32 62 27 Q77 34 84 48 Z" fill="#4a4a52"/><path d="M142 64 Q148 32 138 27 Q123 34 116 48 Z" fill="#4a4a52"/><ellipse cx="100" cy="90" rx="60" ry="50" fill="#1f1f23"/><g class="lid"><ellipse cx="74" cy="84" rx="15" ry="17" fill="#a8d86a"/><ellipse cx="75" cy="86" rx="6" ry="12" fill="#0b0b0d"/><circle cx="79" cy="78" r="4.5" fill="#fff"/><circle cx="70" cy="94" r="2" fill="#fff"/></g><g class="lid"><ellipse cx="126" cy="84" rx="15" ry="17" fill="#a8d86a"/><ellipse cx="127" cy="86" rx="6" ry="12" fill="#0b0b0d"/><circle cx="131" cy="78" r="4.5" fill="#fff"/><circle cx="122" cy="94" r="2" fill="#fff"/></g><ellipse cx="100" cy="111" rx="15" ry="12" fill="#f7f5f0"/><path d="M94 104 h12 q-1 4.5 -6 7 q-5 -2.5 -6 -7 Z" fill="#f0a0ac"/><path d="M100 111 v3 M93 115 q3.5 4 7 0 q3.5 4 7 0" stroke="#1f1f23" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="62" cy="110" rx="8" ry="5" fill="#f0a0ac" opacity="0.35"/><ellipse cx="138" cy="110" rx="8" ry="5" fill="#f0a0ac" opacity="0.35"/><path d="M78 112 L46 106 M78 118 L48 124 M122 112 L154 106 M122 118 L152 124" stroke="#8d8d95" stroke-width="1.6" stroke-linecap="round"/></svg>';
function opt(group,val,label,on,extra){return '<button type="button" class="opt" data-g="'+group+'" data-v="'+esc(val)+'" aria-pressed="'+(on?"true":"false")+'">'+label+(extra||"")+'</button>';}
function stepper(id,label,min,max,stp){return '<div class="num"><label for="pcp-'+id+'">'+label+'</label><div class="stepper"><button type="button" data-step="'+id+'" data-d="-'+stp+'" aria-label="'+t("Меньше","Менше")+'">−</button><input type="number" id="pcp-'+id+'" data-num="'+id+'" min="'+min+'" max="'+max+'" value="'+S[id]+'"><button type="button" data-step="'+id+'" data-d="'+stp+'" aria-label="'+t("Больше","Більше")+'">+</button></div></div>';}
function sec(n,id,band,title,sub,body,extra){return '<section class="pcp-sec'+(band?" band":"")+'" id="'+id+'"><div class="pcp-w">'+(extra||"")+'<div class="head"><div class="no">'+n+'</div><h2>'+title+'</h2><p class="sub">'+sub+'</p></div>'+body+'</div></section>';}

function mount(){
 var root=document.getElementById("pc-app");if(!root)return false;
 root.classList.add("pcp");root.setAttribute("data-no-translation","");document.body.classList.add("pcp-page");
 var W=getW();
 var sw='<div class="wsw" role="group" aria-label="'+t("Ширина страницы","Ширина сторінки")+'"><span aria-hidden="true">↔</span>'+[["narrow",t("Узко","Вузько")],["std",t("Стандарт","Стандарт")],["full",t("Весь экран","Увесь екран")]].map(function(a){return '<button type="button" data-pcw="'+a[0]+'" aria-pressed="'+(a[0]===W)+'">'+a[1]+'</button>';}).join("")+'</div>';
 var steps=
  '<div class="step" id="pcp-st1"><div class="sh"><span class="sn">01</span><h3>'+t("Платформа","Платформа")+'</h3></div><div class="seg" id="pcp-pl"></div><div id="pcp-pcopts" class="rows" style="gap:10px"></div></div>'+
  '<div class="step" id="pcp-st2"><div class="sh"><span class="sn">02</span><h3>'+t("Камера и формат","Камера й формат")+'</h3></div><div class="cams" id="pcp-cams"></div><p class="models" id="pcp-models"></p><span class="lbl">'+t("В каком формате снимаете","У якому форматі знімаєте")+'</span><div class="rows" id="pcp-fmts"></div><div class="nums">'+stepper("mbps",t("Битрейт, Мбит/с","Бітрейт, Мбіт/с"),20,3000,50)+'<div class="num"><span class="nl">'+t("Кадров в секунду","Кадрів на секунду")+'</span><div class="seg" id="pcp-fps"></div></div></div></div>'+
  '<div class="step" id="pcp-st3"><div class="sh"><span class="sn">03</span><h3>'+t("Задачи","Задачі")+'</h3></div><div class="rows" id="pcp-tasks"></div><div class="nums">'+stepper("streams",t("Камер в мультикаме","Камер у мультикамі"),1,6,1)+'</div></div>'+
  '<div class="step" id="pcp-st4"><div class="sh"><span class="sn">04</span><h3>Resolve</h3></div><div class="seg" id="pcp-rs"></div><p class="hint" id="pcp-rshint"></p></div>'+
  '<div class="step" id="pcp-st5"><div class="sh"><span class="sn">05</span><h3>'+t("Объём работы","Обсяг роботи")+'</h3></div><p class="hint">'+t("Нужно, чтобы посчитать диски. Учитывайте материал со всех камер и дрона.","Потрібно, щоб порахувати диски. Враховуйте матеріал з усіх камер і дрона.")+'</p><div class="nums">'+stepper("hours",t("Часов материала на проект","Годин матеріалу на проєкт"),1,40,1)+stepper("parallel",t("Проектов в работе одновременно","Проєктів у роботі одночасно"),1,20,1)+stepper("monthly",t("Проектов в месяц","Проєктів на місяць"),1,40,1)+'</div></div>'+
  '<div class="step" id="pcp-st6"><div class="sh"><span class="sn">06</span><h3>'+t("Монитор","Монітор")+'</h3></div><span class="lbl">'+t("Диагональ","Діагональ")+'</span><div class="seg" id="pcp-diag"></div><span class="lbl">'+t("Цветовой охват","Колірне охоплення")+'</span><div class="rows" id="pcp-gamut"></div></div>';
 var panel='<aside class="panel" aria-live="polite"><div class="res" id="pcp-res"></div><div class="slist" id="pcp-items"></div><p class="toast" id="pcp-toast"></p></aside>';
 root.innerHTML=
  sec("01","pcp-s1",0,t("Конструктор","Конструктор"),t("Слева — ваш материал и задачи, справа — сборка. В каждом пункте сборки список: только подходящие модели, от минимума до топа.","Ліворуч — ваш матеріал і задачі, праворуч — збірка. У кожному пункті збірки список: лише відповідні моделі, від мінімуму до топу."),'<div class="grid2"><div class="steps">'+steps+'</div>'+panel+'</div>',sw)+
  sec("02","pcp-s2",1,t("Кто разжимает ваш кодек","Хто розпаковує ваш кодек"),t("H.264 и H.265 сильно сжаты, и процессору тяжело разжимать их на лету. Поэтому важно, есть ли в системе аппаратный декодер именно под ваш вариант: 4:2:0 или 4:2:2, 8 или 10 бит. Строка вашего формата подсвечена.","H.264 і H.265 сильно стиснуті, і процесору важко розпаковувати їх на льоту. Тому важливо, чи є в системі апаратний декодер саме під ваш варіант: 4:2:0 або 4:2:2, 8 або 10 біт. Рядок вашого формату підсвічено."),
   '<div class="tbl"><table id="pcp-dec"></table></div><div class="legend"><span><span class="c c-y">'+DEC_TXT.y+'</span> '+t("аппаратный декодер","апаратний декодер")+'</span><span><span class="c c-n">'+DEC_TXT.n+'</span> '+t("ляжет на процессор","ляже на процесор")+'</span><span><span class="c c-c">ЦП</span> '+t("внутрикадровый формат, процессор справляется","внутрішньокадровий формат, процесор справляється")+'</span><span><span class="c c-g">GPU</span> '+t("RAW проявляет видеокарта","RAW проявляє відеокарта")+'</span></div><p class="note">'+t("<b>Важно для Windows:</b> аппаратное декодирование H.264/H.265 работает только в DaVinci Resolve Studio. На Mac оно есть и в бесплатной версии. Видеокарты RTX 50 разжимают 4:2:2 начиная с Resolve Studio 20.","<b>Важливо для Windows:</b> апаратне декодування H.264/H.265 працює лише в DaVinci Resolve Studio. На Mac воно є й у безкоштовній версії. Відеокарти RTX 50 розпаковують 4:2:2 починаючи з Resolve Studio 20.")+'</p>')+
  sec("03","pcp-s3",0,t("Какой нужен монитор","Який потрібен монітор"),t("Цвет вы оцениваете глазами, поэтому монитор — часть сборки, а не аксессуар.","Колір ви оцінюєте очима, тому монітор — частина збірки, а не аксесуар."),
   '<div class="key"><div><b>100%</b><strong>sRGB / Rec.709</strong><p>'+t("Охват стандарта, в котором смотрят YouTube, Instagram и свадебные фильмы. Для HDR — от 95% DCI-P3.","Охоплення стандарту, у якому дивляться YouTube, Instagram і весільні фільми. Для HDR — від 95% DCI-P3.")+'</p></div><div><b>ΔE &lt; 2</b><strong>'+t("Заводская калибровка","Заводське калібрування")+'</strong><p>'+t("Отчёт калибровки в коробке и режимы Rec.709 и sRGB с гаммой 2.4 и 2.2.","Звіт калібрування в коробці й режими Rec.709 і sRGB з гамою 2.4 і 2.2.")+'</p></div><div><b>1–2</b><strong>'+t("месяца — проверка","місяці — перевірка")+'</strong><p>'+t("Калибратором (Calibrite Display Pro HL, SpyderX2 Ultra): заводская калибровка со временем уходит.","Калібратором (Calibrite Display Pro HL, SpyderX2 Ultra): заводське калібрування з часом зміщується.")+'</p></div></div>'+
   '<div class="cards"><div class="card"><h4>'+t("Матрица","Матриця")+'</h4><p>'+t("IPS или OLED, 27″ 4K или 32″ 4K, матовое покрытие. 10 бит или 8 бит + FRC.","IPS або OLED, 27″ 4K або 32″ 4K, матове покриття. 10 біт або 8 біт + FRC.")+'</p></div><div class="card"><h4>'+t("Аппаратная калибровка","Апаратне калібрування")+'</h4><p>'+t("Калибровка пишется в сам монитор (LUT), плюс компенсация равномерности. Нужна для коммерческого цвета.","Калібрування записується в сам монітор (LUT), плюс компенсація рівномірності. Потрібне для комерційного кольору.")+'</p></div><div class="card"><h4>'+t("Вывод через карту","Вивід через карту")+'</h4><p>'+t("Для сдачи цвета клиентам картинку выводят через Blackmagic UltraStudio Monitor или DeckLink на отдельный монитор в Rec.709.","Для здачі кольору клієнтам картинку виводять через Blackmagic UltraStudio Monitor або DeckLink на окремий монітор у Rec.709.")+'</p></div><div class="card no"><h4>'+t("Не берите","Не беріть")+'</h4><p>'+t("Игровые VA/TN, глянец и «HDR400» как признак качества.","Ігрові VA/TN, глянець і «HDR400» як ознаку якості.")+'</p></div></div>')+
  sec("04","pcp-s4",1,t("Как считали","Як рахували"),t("Чтобы вы могли проверить каждую цифру.","Щоб ви могли перевірити кожну цифру."),
   '<div class="foot" id="pcp-foot"></div><div class="next"><span class="nk">'+t("Дальше","Далі")+'</span><h3>'+t("Подбор сетапа","Підбір сетапу")+'</h3><p>'+t("Компьютер есть — теперь камера, объектив, карты памяти и гимбал, которые подходят друг к другу.","Комп’ютер є — тепер камера, об’єктив, карти пам’яті й гімбал, які підходять одне одному.")+'</p><a href="'+(UK?"/uk":"")+'/wiki/podbor-setapa/">'+t("Подобрать сетап →","Підібрати сетап →")+'</a></div>');
 var g=document.createElement("div");g.className="pcp-guide";g.id="pcp-guide";g.setAttribute("data-no-translation","");
 g.innerHTML='<div class="gb" role="region" aria-label="'+t("Пиксель подсказывает","Піксель підказує")+'"><div class="gk"><span>'+t("Пиксель","Піксель")+'</span><button type="button" class="gx" data-act="min" aria-label="'+t("Свернуть","Згорнути")+'">×</button></div><p class="say" id="pcp-say" aria-live="polite"></p><div class="acts" id="pcp-acts"></div></div><button type="button" class="cat" id="pcp-cat" aria-label="'+t("Пиксель","Піксель")+'">'+CAT+'</button>';
 document.body.appendChild(g);
 return true;
}

function drawStatic(){
 $("#pcp-pl").innerHTML=opt("platform","pc",t("ПК на Windows","ПК на Windows"),S.platform==="pc")+opt("platform","mac","Mac",S.platform==="mac");
 var pc=S.platform==="pc";
 var hv='<option value="none">'+esc(HAVE[0].n)+'</option>';var grp={};var order=[];
 HAVE.slice(1).forEach(function(h){if(!grp[h.g]){grp[h.g]=[];order.push(h.g);}grp[h.g].push(h);});
 order.forEach(function(k){hv+='<optgroup label="'+esc(k)+'">'+grp[k].map(function(h){return '<option value="'+h.id+'"'+(h.id===S.have?" selected":"")+'>'+esc(h.n)+'</option>';}).join("")+'</optgroup>';});
 $("#pcp-pcopts").innerHTML=pc?
  '<span class="lbl">'+t("Процессор","Процесор")+'</span><div class="seg">'+opt("cpu","intel",t("Intel (рекомендуем)","Intel (рекомендуємо)"),S.cpu==="intel")+opt("cpu","amd","AMD Ryzen",S.cpu==="amd")+'</div><label class="lbl" for="pcp-have">'+t("Какая видеокарта у вас уже есть","Яка відеокарта у вас уже є")+'</label><select id="pcp-have">'+hv+'</select><span class="hint">'+t("Если ваша карта справится, конструктор так и скажет, менять её не придётся.","Якщо ваша карта впорається, конструктор так і скаже, міняти її не доведеться.")+'</span>':
  '<span class="lbl">'+t("Форм-фактор","Форм-фактор")+'</span><div class="seg">'+opt("form","desktop",t("Настольный","Настільний"),S.form==="desktop")+opt("form","laptop",t("Ноутбук","Ноутбук"),S.form==="laptop")+'</div>';
 $("#pcp-cams").innerHTML=CAMS.map(function(c){return opt("cam",c.id,esc(c.n),c.id===S.cam,'<small>'+esc(c.sub)+'</small>');}).join("");
 var c=cam();$("#pcp-models").textContent=c.models;
 $("#pcp-fmts").innerHTML=c.fmts.map(function(f,i){return '<button type="button" class="row" data-g="fmt" data-v="'+i+'" aria-pressed="'+(i===S.fmt)+'"><span><span class="t">'+esc(f.t)+'</span><span class="s">'+esc(f.s)+'</span></span><span class="m">≈'+nf(f.m)+' '+t("Мбит/с","Мбіт/с")+'</span></button>';}).join("");
 $("#pcp-fps").innerHTML=[[30,"24–30"],[60,"50–60"],[120,"100–120"]].map(function(a){return opt("fps",a[0],a[1],S.fps===a[0]);}).join("");
 $("#pcp-tasks").innerHTML=
  '<div class="row chk" role="checkbox" aria-checked="true" aria-disabled="true"><span><span class="t">'+t("Монтаж","Монтаж")+'</span><span class="s">'+t("Нарезка, переходы, титры, звук. Включено всегда.","Нарізка, переходи, титри, звук. Увімкнено завжди.")+'</span></span><span></span></div>'+
  '<button type="button" class="row chk" data-g="color" role="checkbox" aria-checked="'+S.color+'"><span><span class="t">'+t("Цветокоррекция","Кольорокорекція")+'</span><span class="s">'+t("Перевод лога в Rec.709, ноды, LUT, маски, трекинг.","Переведення логу в Rec.709, ноди, LUT, маски, трекінг.")+'</span></span><span></span></button>'+
  '<button type="button" class="row chk" data-g="nr" role="checkbox" aria-checked="'+S.nr+'"><span><span class="t">'+t("Шумодав, AI-инструменты, Fusion","Шумодав, AI-інструменти, Fusion")+'</span><span class="s">'+t("Temporal NR, Magic Mask, стабилизация, композитинг. Сильнее всего нагружают видеопамять.","Temporal NR, Magic Mask, стабілізація, композитинг. Найбільше навантажують відеопам’ять.")+'</span></span><span></span></button>';
 $("#pcp-rs").innerHTML=opt("studio","1",t("Studio (платный)","Studio (платний)"),S.studio)+opt("studio","0",t("Бесплатный","Безкоштовний"),!S.studio);
 $("#pcp-rshint").textContent=S.platform==="mac"?t("На Mac аппаратное декодирование H.264/H.265 есть и в бесплатной версии. Studio нужен ради шумодава, AI-инструментов и экспорта выше UHD.","На Mac апаратне декодування H.264/H.265 є й у безкоштовній версії. Studio потрібен заради шумодава, AI-інструментів і експорту вище UHD."):t("На Windows аппаратное декодирование H.264/H.265 (Quick Sync и NVDEC) работает только в Studio. Без него 4K60 4:2:2 10 бит разжимает один процессор.","На Windows апаратне декодування H.264/H.265 (Quick Sync і NVDEC) працює лише в Studio. Без нього 4K60 4:2:2 10 біт розпаковує сам процесор.");
 $("#pcp-diag").innerHTML=[24,27,32].map(function(d){return opt("diag",d,d+"″",S.diag===d);}).join("");
 $("#pcp-gamut").innerHTML=[[1,"100% sRGB / Rec.709",t("YouTube, Instagram, свадебные фильмы. Стандарт, в котором смотрят почти всё.","YouTube, Instagram, весільні фільми. Стандарт, у якому дивляться майже все.")],[2,t("DCI-P3 от 95%","DCI-P3 від 95%"),t("HDR, кино, ролики для экранов Apple и смартфонов.","HDR, кіно, ролики для екранів Apple і смартфонів.")],[3,t("С аппаратной калибровкой","З апаратним калібруванням"),t("Калибровка пишется в сам монитор. Для коммерческого цвета и сдачи клиентам.","Калібрування записується в сам монітор. Для комерційного кольору й здачі клієнтам.")]].map(function(a){return '<button type="button" class="row" data-g="gamut" data-v="'+a[0]+'" aria-pressed="'+(S.gamut===a[0])+'"><span><span class="t">'+a[1]+'</span><span class="s">'+a[2]+'</span></span><span></span></button>';}).join("");
 ["mbps","streams","hours","parallel","monthly"].forEach(function(k){var el=$("#pcp-"+k);if(el)el.value=S[k];});
}

/* ================= расчёт ================= */
function compute(){
 var c=cam(),f=c.fmts[S.fmt],fam=f.f,F=FAM[fam],mac=S.platform==="mac";
 var heavyRaw=fam==="raw";
 var fpsK=S.fps<=30?.6:S.fps<=60?1:2, fpsG=S.fps<=30?-.5:S.fps<=60?0:1;
 var heavyLG=(fam==="hevc422"||fam==="h264_422"||fam==="h264_10");
 var per=F.lg?((!mac&&!S.studio)?3:(fam==="h264_420"?.3:.6)):({intra:1.6,prores:1.4,braw:.6,raw:1}[fam]);
 var cpuLoad=1.5+per*fpsK*S.streams+(S.color?.5:0)+(S.nr?1:0)+(!F.lg&&S.mbps>400?.4:0);
 var gpuLoad=1+(S.color?1:0)+(S.nr?2:0)+({braw:1,raw:2}[fam]||0)+fpsG+(S.streams-1)*.6+(heavyLG?.5:0);
 var gpuBase=gpuLoad<2?0:gpuLoad<3?1:gpuLoad<4?2:gpuLoad<5.5?3:4;
 var macLoad=1+(S.color?1:0)+(S.nr?2:0)+({braw:.5,raw:2}[fam]||0)+fpsG+(S.streams-1)*.8+((fam==="h264_422"||fam==="h264_10")?.6:0)+(fam==="intra"?.5:0);
 var macBase=macLoad<2.5?0:macLoad<4.5?1:macLoad<6.5?2:3;
 var items=[],out={},sum={usd:0,uah:0,miss:0};
 function addP(id){var p=price(id);if(p){sum.usd+=p.usd;sum.uah+=p.uah;}else sum.miss++;}
 var vram=8;if(S.color)vram=12;if(S.nr||heavyRaw)vram=16;if((S.nr&&S.streams>=3)||(heavyRaw&&S.nr))vram=24;

 /* видеокарта */
 var perfNeed=PERF_NEED[gpuBase];
 var h264Need=S.studio&&(fam==="h264_422"||fam==="h264_10");
 var hevcNeed=S.studio&&fam==="hevc422"&&S.cpu!=="intel";
 function gIss(g,pn){var r=[];
  if(h264Need&&!g.h264)r.push({st:"bad",t:t("не разжимает ","не розпаковує ")+F.n+t(" — это умеют только RTX 50"," — це вміють лише RTX 50")});
  if(hevcNeed&&!g.hevc)r.push({st:"bad",t:t("не разжимает H.265 4:2:2, а у Ryzen нет Quick Sync — нужна RTX 50 или Intel Arc","не розпаковує H.265 4:2:2, а в Ryzen немає Quick Sync — потрібна RTX 50 або Intel Arc")});
  if(g.v<vram)r.push({st:"bad",t:t("мало видеопамяти: ","мало відеопам’яті: ")+g.v+t(" ГБ, нужно от "," ГБ, потрібно від ")+vram});
  if(S.nr&&g.ai<2)r.push({st:"warn",t:t("шумодав и AI-инструменты на ней работают очень медленно","шумодав і AI-інструменти на ній працюють дуже повільно")});
  if(g.perf<pn)r.push({st:"warn",t:t("мощности не хватит для вашей нагрузки","потужності не вистачить для вашого навантаження")});
  return r;}
 var have=HAVE.filter(function(h){return h.id===S.have;})[0]||HAVE[0];
 var haveIss=have.id==="none"?null:gIss(have,perfNeed*.8);
 var keep=!!(haveIss&&haveIss.length===0);
 var gl=GPUS.filter(function(g){return !gIss(g,perfNeed).length;});
 if(haveIss&&!keep){var up=gl.filter(function(g){return g.perf>=have.perf;});if(up.length)gl=up;}
 var gEmpty=false;if(!gl.length){gl=[GPUS[GPUS.length-1]];gEmpty=true;}
 var topI=-1;gl.forEach(function(g,i){if(topI<0&&g.perf>=gl[0].perf*2.4)topI=i;});if(topI<0)topI=gl.length-1;gl=gl.slice(0,topI+1);
 var gRec=-1;gl.forEach(function(g,i){if(gRec<0&&i>0&&g.perf>=perfNeed*1.15)gRec=i;});if(gRec<0)gRec=gl.length>1?1:0;
 var gL=ladder("gpu",gl,gRec),gpu=gl[gL.idx],ac=keep?have:gpu;

 /* декодирование */
 var dSt="ok",dN,dW;
 if(mac){dN=t("Медиадвижок Apple Silicon","Медіарушій Apple Silicon");
  if(fam==="hevc422"||fam==="hevc420")dW=t("Аппаратно разжимает <b>","Апаратно розпаковує <b>")+F.n+t("</b>, в том числе в бесплатном Resolve.","</b>, зокрема в безкоштовному Resolve.");
  else if(fam==="h264_422"||fam==="h264_10")dW="<b>"+F.n+t("</b> разжимается аппаратно, но это самый тяжёлый вариант Long GOP. Для мультикама на 3 камеры и больше берите чип уровня Pro и выше.","</b> розпаковується апаратно, але це найважчий варіант Long GOP. Для мультикаму на 3 камери й більше беріть чип рівня Pro і вище.");
  else if(fam==="h264_420")dW=t("Аппаратно, нагрузка минимальная.","Апаратно, навантаження мінімальне.");
  else if(fam==="prores")dW=t("Отдельный ProRes-движок в чипе: ProRes на Mac — родной и лёгкий формат.","Окремий ProRes-рушій у чипі: ProRes на Mac — рідний і легкий формат.");
  else if(fam==="braw")dW=t("Blackmagic RAW считается на графике чипа и работает плавно даже на базовых M.","Blackmagic RAW рахується на графіці чипа й працює плавно навіть на базових M.");
  else dW=t("RAW проявляет графика чипа. Чем больше графических ядер и памяти, тем плавнее.","RAW проявляє графіка чипа. Що більше графічних ядер і пам’яті, то плавніше.");
 } else {
  var hasQ=S.cpu==="intel"&&DEC[fam][0]==="y";
  var hasG=(fam==="h264_422"||fam==="h264_10")?ac.h264:fam==="hevc422"?ac.hevc:true;
  if(F.lg){
   if(!S.studio){dN=t("Только процессор","Лише процесор");dSt=(fam==="h264_420"||(fam==="hevc420"&&S.fps<=30))?"warn":"bad";
    dW=t("В бесплатном Resolve на Windows H.264/H.265 разжимает только процессор, видеокарта и Quick Sync в этом не участвуют. ","У безкоштовному Resolve на Windows H.264/H.265 розпаковує лише процесор, відеокарта й Quick Sync у цьому не беруть участі. ")+F.n+t(" в 4K будет тормозить. Решение — <b>Resolve Studio</b>."," у 4K гальмуватиме. Рішення — <b>Resolve Studio</b>.");}
   else{var L=[];if(hasQ)L.push("Quick Sync "+t("процессора","процесора"));if(hasG)L.push(t("декодер ","декодер ")+(ac.sh||ac.n));
    dN=L.length?L.join(" + "):t("Нет аппаратного декодера","Немає апаратного декодера");
    if(!L.length){dSt="bad";dW="<b>"+F.n+t("</b> не разжимает аппаратно ни процессор, ни видеокарта: таймлайн будет тормозить.","</b> не розпаковує апаратно ні процесор, ні відеокарта: таймлайн гальмуватиме.");}
    else if(L.length===2)dW=t("Два аппаратных декодера для <b>","Два апаратні декодери для <b>")+F.n+t("</b>: при мультикаме и на таймлайне они делят нагрузку.","</b>: на мультикамі й таймлайні вони ділять навантаження.");
    else if(fam==="h264_422"||fam==="h264_10")dW="<b>"+F.n+t("</b> из всех ПК-решений аппаратно разжимает только <b>RTX 50</b>. Поэтому видеокарта здесь — только RTX 50.","</b> з усіх ПК-рішень апаратно розпаковує лише <b>RTX 50</b>. Тому відеокарта тут — лише RTX 50.");
    else if(fam==="hevc422"&&!hasQ)dW=t("Встроенная графика Ryzen не разжимает 4:2:2, поэтому эту работу делает видеокарта. Подходят RTX 50 и Intel Arc.","Вбудована графіка Ryzen не розпаковує 4:2:2, тому цю роботу робить відеокарта. Підходять RTX 50 і Intel Arc.");
    else if(fam==="hevc422")dW="<b>"+F.n+t("</b> разжимает Quick Sync процессора. Видеокарте разжимать не нужно, поэтому она может быть любой, если хватает памяти и мощности.","</b> розпаковує Quick Sync процесора. Відеокарті розпаковувати не треба, тому вона може бути будь-якою, якщо вистачає пам’яті й потужності.");
    else dW=t("Аппаратно разжимает <b>","Апаратно розпаковує <b>")+F.n+"</b>.";}
  } else if(fam==="intra"||fam==="prores"){dN=t("Процессор","Процесор");dW=F.n+t(" — внутрикадровый формат: процессору разжимать его легко. Узкое место — <b>скорость диска</b>: "," — внутрішньокадровий формат: процесору розпаковувати його легко. Вузьке місце — <b>швидкість диска</b>: ")+nf(S.mbps/8)+t(" МБ/с на каждую камеру."," МБ/с на кожну камеру.");}
  else {dN=t("Видеокарта (дебайер RAW)","Відеокарта (дебаєр RAW)");dW=fam==="braw"?t("Blackmagic RAW — родной формат Resolve, работает и в бесплатной версии. Нужна видеокарта с запасом памяти.","Blackmagic RAW — рідний формат Resolve, працює й у безкоштовній версії. Потрібна відеокарта із запасом пам’яті."):t("RAW проявляет видеокарта. Важен объём видеопамяти, а сами файлы очень тяжёлые для дисков.","RAW проявляє відеокарта. Важливий обсяг відеопам’яті, а самі файли дуже важкі для дисків.");}
 }
 items.push({k:t("Декодирование","Декодування"),name:dN,st:dSt,why:dW});

 /* диски */
 var gbh=S.mbps*.45,proj=gbh*S.hours,workTB=proj*S.parallel*1.25/1000,mbs=S.mbps/8,need=mbs*S.streams*2;
 var ws=[1,2,4,8,16].filter(function(x){return x>=workTB;})[0]||16;
 var yearTB=proj*S.monthly*12/1000, hdd=[4,8,12,16,20,24].filter(function(x){return x>=yearTB;})[0];
 var spT,spSt="ok";
 if(need<=450)spT=t("хватит даже SATA SSD, NVMe — с запасом","вистачить навіть SATA SSD, NVMe — із запасом");else if(need<=2500)spT=t("нужен NVMe (PCIe 4.0)","потрібен NVMe (PCIe 4.0)");else{spT=t("нужен NVMe PCIe 4.0/5.0, лучше RAID из двух","потрібен NVMe PCIe 4.0/5.0, краще RAID із двох");spSt="warn";}
 var arch=hdd?"HDD "+hdd+t(" ТБ × 2"," ТБ × 2"):t("NAS / несколько HDD","NAS / кілька HDD");
 var archS="≈ "+nf(yearTB,1)+t(" ТБ за год. Две копии на разных дисках плюс одна вне дома (правило 3-2-1)."," ТБ на рік. Дві копії на різних дисках плюс одна поза домом (правило 3-2-1).");
 var calc={gbh:gbh,proj:proj,mbs:mbs};
 var monLevel=1;
 if(!mac){
  var CP=S.cpu==="intel"?CPU_I:CPU_A, cNeed=Math.min(cpuLoad*.62,CP[CP.length-1].perf);
  var cl=CP.filter(function(x){return x.perf>=cNeed-1e-9;});
  var cRec=-1;cl.forEach(function(x,i){if(cRec<0&&x.perf>=cNeed*1.25)cRec=i;});if(cRec<0)cRec=cl.length-1;
  var cL=ladder("cpu",cl,cRec),cpu=cl[cL.idx];
  var cW;
  if(S.cpu==="intel"){cW=t("Встроенная графика Intel (Quick Sync) аппаратно разжимает H.265 4:2:2 10 бит. <b>Не берите модели с буквой F/KF</b>: у них нет встроенной графики, а значит и Quick Sync.","Вбудована графіка Intel (Quick Sync) апаратно розпаковує H.265 4:2:2 10 біт. <b>Не беріть моделі з літерою F/KF</b>: у них немає вбудованої графіки, а отже й Quick Sync.");
   if(fam==="h264_422"||fam==="h264_10")cW=t("Quick Sync не разжимает H.264 10 бит, эту работу берёт RTX 50. Процессор нужен для эффектов, цвета и экспорта. Модели без F/KF всё равно лучше: Quick Sync пригодится для H.265 с дрона или телефона.","Quick Sync не розпаковує H.264 10 біт, цю роботу бере RTX 50. Процесор потрібен для ефектів, кольору й експорту. Моделі без F/KF все одно кращі: Quick Sync знадобиться для H.265 з дрона чи телефона.");
   if(fam==="intra"||fam==="prores")cW=t("Внутрикадровые форматы процессор разжимает сам: чем больше ядер, тем больше потоков мультикама без подтормаживаний.","Внутрішньокадрові формати процесор розпаковує сам: що більше ядер, то більше потоків мультикаму без пригальмовувань.");
  } else cW=t("Встроенная графика Ryzen не разжимает 4:2:2 и H.264 10 бит, эта работа ляжет на видеокарту. С Intel выбор видеокарт шире, и есть второй аппаратный декодер.","Вбудована графіка Ryzen не розпаковує 4:2:2 і H.264 10 біт, ця робота ляже на відеокарту. З Intel вибір відеокарт ширший, і є другий апаратний декодер.");
  items.push({k:t("Процессор","Процесор"),st:"ok",sel:{key:"cpu",opts:cl.map(function(x,i){return {id:x.id,t:x.n+" — "+cL.labels[i]+" · "+pshort(x.id)};}),cur:cpu.id},name:cpu.n,price:cpu.id,sub:cpu.s,why:cW,use:cNeed/cpu.perf});
  out.cpu=cpu.n;addP(cpu.id);
  if(have.id!=="none"){
   items.push({k:t("Ваша карта","Ваша карта"),name:have.n,st:keep?"ok":worst(haveIss.map(function(x){return x.st;})),tag:keep?t("оставляем","залишаємо"):null,
    why:keep?t("Менять не нужно: памяти, мощности и декодирования хватает для вашего материала и задач.","Міняти не потрібно: пам’яті, потужності й декодування вистачає для вашого матеріалу й задач.")+(have.old?t(" Учтите: по данным NVIDIA, ветка драйверов 580 — последняя для GTX 10."," Врахуйте: за даними NVIDIA, гілка драйверів 580 — остання для GTX 10."):""):
     t("Для вашего материала не подойдёт: ","Для вашого матеріалу не підійде: ")+haveIss.map(function(x){return x.t;}).join("; ")+"."+(have.old?t(" К тому же, по данным NVIDIA, ветка драйверов 580 — последняя для GTX 10."," До того ж, за даними NVIDIA, гілка драйверів 580 — остання для GTX 10."):"")});
   out.have=have.n;
  }
  if(!keep){
   var gw=t("В Resolve видеокарта считает цвет, шумодав и эффекты. ","У Resolve відеокарта рахує колір, шумодав і ефекти. ");
   if(h264Need)gw+=t("Ваш формат <b>","Ваш формат <b>")+F.n+t("</b> аппаратно разжимает только RTX 50, поэтому в списке только они. ","</b> апаратно розпаковує лише RTX 50, тому в списку лише вони. ");
   else if(S.studio&&fam==="hevc422"&&S.cpu==="intel")gw+=t("H.265 4:2:2 разжимает Quick Sync процессора, поэтому подходят и недорогие карты. ","H.265 4:2:2 розпаковує Quick Sync процесора, тому підходять і недорогі карти. ");
   else if(hevcNeed)gw+=t("У Ryzen нет Quick Sync, поэтому H.265 4:2:2 должна разжимать видеокарта: RTX 50 или Intel Arc. ","У Ryzen немає Quick Sync, тому H.265 4:2:2 має розпаковувати відеокарта: RTX 50 або Intel Arc. ");
   if(S.nr)gw+=t("Для шумодава и AI-инструментов — только NVIDIA: на Radeon они работают очень медленно, на Arc — средне. ","Для шумодава й AI-інструментів — лише NVIDIA: на Radeon вони працюють дуже повільно, на Arc — середньо. ");
   if(haveIss&&!keep)gw+=t("В списке — только карты не слабее вашей нынешней. ","У списку — лише карти не слабші за вашу нинішню. ");
   gw+=t("<b>Версии на 8 ГБ не берите</b>: для 4K с цветом их мало.","<b>Версії на 8 ГБ не беріть</b>: для 4K з кольором їх мало.");
   items.push({k:have.id==="none"?t("Видеокарта","Відеокарта"):t("Замена","Заміна"),st:gEmpty?"warn":"ok",sel:{key:"gpu",opts:gl.map(function(x,i){return {id:x.id,t:x.n+" — "+gL.labels[i]+" · "+pshort(x.id)};}),cur:gpu.id},name:gpu.n,price:gpu.id,sub:t("видеопамяти нужно от ","відеопам’яті потрібно від ")+vram+" ГБ",why:gw,use:perfNeed/gpu.perf});
   out.gpu=gpu.n;addP(gpu.id);
  }
  var ram=32;if(S.nr||S.streams>=3||heavyRaw||cpu.perf>=2.5)ram=64;if(heavyRaw&&S.nr&&S.streams>=3)ram=96;
  items.push({k:t("Память","Пам’ять"),name:ram+" ГБ DDR5",st:"ok",sub:ram===96?"2 × 48 ГБ":"2 × "+(ram/2)+" ГБ",why:t("Blackmagic: минимум 16 ГБ, с Fusion — 32 ГБ. Для 4K-цвета комфорт начинается с 32 ГБ, с шумодавом и мультикамом — 64 ГБ. Ставьте две планки, а не четыре: так стабильнее частота.","Blackmagic: мінімум 16 ГБ, з Fusion — 32 ГБ. Для 4K-кольору комфорт починається з 32 ГБ, із шумодавом і мультикамом — 64 ГБ. Ставте дві планки, а не чотири: так стабільніша частота.")});
  out.ram=ram+" ГБ DDR5";
  items.push({k:t("Диски","Диски"),calc:calc,st:spSt,disks:[
   [t("Система и программы","Система й програми"),"NVMe 1 ТБ",t("Windows, Resolve, плагины. Медиа сюда не кладём.","Windows, Resolve, плагіни. Медіа сюди не кладемо.")],
   [t("Кэш","Кеш"),"NVMe "+((gpuLoad>=3||S.streams>=2)?2:1)+" ТБ",t("Render cache, кэш воспроизведения, база проектов. Отдельный диск, чтобы не мешать чтению исходников.","Render cache, кеш відтворення, база проєктів. Окремий диск, щоб не заважати читанню вихідників.")],
   [t("Рабочие исходники","Робочі вихідники"),"SSD "+ws+" ТБ",spT+t(". Нужно ~",". Потрібно ~")+nf(need)+t(" МБ/с, проекты в работе ≈ "," МБ/с, проєкти в роботі ≈ ")+nf(workTB,1)+" ТБ."],
   [t("Архив","Архів"),arch,archS]]});
  var psu=ac.psu+(cpu.perf>=2.5?100:0);
  items.push({k:t("Питание","Живлення"),name:psu+t(" Вт, ATX 3.1, 80+ Gold"," Вт, ATX 3.1, 80+ Gold"),st:"ok",why:t("Под ","Під ")+(ac.sh||ac.n)+t(" и процессор, с запасом на пики."," і процесор, із запасом на піки.")+(/RTX 5/.test(ac.sh||ac.n)?t(" Нужен родной разъём 12V-2x6 для видеокарты."," Потрібен рідний роз’єм 12V-2x6 для відеокарти."):"")});
  items.push({k:t("Охлаждение","Охолодження"),name:cpu.perf<2?t("Башенный кулер, 2 вентилятора","Баштовий кулер, 2 вентилятори"):t("Водянка 360 мм или топовый башенный кулер","Водянка 360 мм або топовий баштовий кулер"),st:"ok",why:t("Экспорт и шумодав грузят систему на десятки минут. Без нормального охлаждения процессор сбросит частоты.","Експорт і шумодав навантажують систему на десятки хвилин. Без нормального охолодження процесор скине частоти.")});
 } else {
  var mem=24;if(S.color)mem=32;if(S.nr||S.streams>=3)mem=48;if(heavyRaw)mem=64;if(heavyRaw&&S.nr)mem=96;
  var ML=S.form==="laptop"?MAC_L:MAC_D, mNeed=[.9,1.9,2.9,4.4][macBase];
  var ml=ML.filter(function(m){return m.perf>=mNeed&&m.mem[m.mem.length-1]>=mem;});
  var mE=false;if(!ml.length){ml=[ML[ML.length-1]];mE=true;}
  var mT=-1;ml.forEach(function(m,i){if(mT<0&&m.perf>=mNeed*3)mT=i;});if(mT<0)mT=ml.length-1;ml=ml.slice(0,mT+1);
  var mR=-1;ml.forEach(function(m,i){if(mR<0&&i>0&&m.perf>=mNeed*1.5)mR=i;});if(mR<0)mR=0;
  var mL=ladder("mac",ml,mR),mc=ml[mL.idx];
  items.push({k:t("Компьютер","Комп’ютер"),st:mE?"bad":"ok",sel:{key:"mac",opts:ml.map(function(x,i){return {id:x.id,t:x.n+" — "+mL.labels[i]+" · "+pshort(x.id)};}),cur:mc.id},name:mc.n,price:mc.id,sub:t("цена базовой конфигурации, память больше — дороже","ціна базової конфігурації, більше пам’яті — дорожче"),use:mNeed/mc.perf,
   why:S.form==="laptop"?t("У MacBook Pro есть вентиляторы и экран XDR с заводской калибровкой. <b>MacBook Air</b> подходит для лёгкого монтажа, но без вентилятора на долгом экспорте и цвете он сбрасывает частоты.","У MacBook Pro є вентилятори й екран XDR із заводським калібруванням. <b>MacBook Air</b> підходить для легкого монтажу, але без вентилятора на довгому експорті й кольорі він скидає частоти."):t("Настольный Mac тише и дешевле ноутбука той же мощности. Монитор покупается отдельно.","Настільний Mac тихіший і дешевший за ноутбук тієї ж потужності. Монітор купується окремо.")});
  addP(mc.id);
  var mm=mc.mem.filter(function(x){return x>=mem;}).map(function(x){return {id:"m"+x,v:x};});
  if(!mm.length)mm=[{id:"m"+mc.mem[mc.mem.length-1],v:mc.mem[mc.mem.length-1]}];
  var meR=-1;mm.forEach(function(x,i){if(meR<0&&x.v>=mem*1.4)meR=i;});if(meR<0)meR=0;
  var meL=ladder("mem",mm,meR),me=mm[meL.idx];
  items.push({k:t("Память","Пам’ять"),st:me.v>=mem?"ok":"bad",sel:{key:"mem",opts:mm.map(function(x,i){return {id:x.id,t:x.v+" ГБ — "+meL.labels[i]};}),cur:me.id},name:me.v+" ГБ",sub:t("ваша задача: от ","ваша задача: від ")+mem+" ГБ",why:t("На Mac память общая: она работает и как оперативная, и как видеопамять. <b>Докупить её потом нельзя</b>, поэтому берите с запасом. Варианты, которых у этого чипа нет, в список не попадают.","На Mac пам’ять спільна: вона працює і як оперативна, і як відеопам’ять. <b>Докупити її потім не можна</b>, тому беріть із запасом. Варіанти, яких у цього чипа немає, до списку не потрапляють.")});
  out.mac=mc.n+", "+me.v+" ГБ";
  items.push({k:t("Диски","Диски"),calc:calc,st:spSt,disks:[
   [t("Встроенный SSD","Вбудований SSD"),mc.perf>=2?"2 ТБ":"1 ТБ",t("Система, Resolve, кэш и база проектов. Апгрейд у Apple дорогой, поэтому исходники — на внешнем диске.","Система, Resolve, кеш і база проєктів. Апгрейд в Apple дорогий, тому вихідники — на зовнішньому диску.")],
   [t("Рабочие исходники","Робочі вихідники"),"NVMe "+ws+t(" ТБ в корпусе Thunderbolt"," ТБ у корпусі Thunderbolt"),t("Thunderbolt 4/5 даёт 2,5–6 ГБ/с. Нужно ~","Thunderbolt 4/5 дає 2,5–6 ГБ/с. Потрібно ~")+nf(need)+t(" МБ/с, проекты в работе ≈ "," МБ/с, проєкти в роботі ≈ ")+nf(workTB,1)+t(" ТБ. USB на 5 Гбит/с для работы не подходит."," ТБ. USB на 5 Гбіт/с для роботи не підходить.")],
   [t("Архив","Архів"),arch,archS]]});
 }
 /* монитор */
 var mons=MONS.filter(function(m){return m.d===S.diag&&m.lv>=S.gamut&&(S.gamut!==2||m.p3>=95);});
 if(!mons.length)mons=MONS.filter(function(m){return m.d===S.diag;});
 var moR=-1;if(S.gamut<3)mons.forEach(function(m,i){if(moR<0&&m.lv>S.gamut)moR=i;});else moR=1;if(moR<0||moR>=mons.length)moR=0;
 var moL=ladder("mon",mons,moR),mon=mons[moL.idx];monLevel=mon.lv;
 var mW="";
 if(mac&&S.form==="laptop")mW=t("Экран MacBook Pro откалиброван на заводе и имеет эталонные режимы. Внешний монитор нужен для работы дома и сдачи цвета клиенту. ","Екран MacBook Pro відкалібровано на заводі, і він має еталонні режими. Зовнішній монітор потрібен для роботи вдома й здачі кольору клієнту. ");
 if(mac&&S.form==="desktop")mW=t("Apple Studio Display (P3, заводская калибровка) тоже подходит, но аппаратной калибровки у него нет. ","Apple Studio Display (P3, заводське калібрування) теж підходить, але апаратного калібрування в нього немає. ");
 if(S.diag===24&&S.gamut===2)mW+=t("Среди 24″ мониторов с охватом P3 почти нет: подходящая модель — с аппаратной калибровкой. ","Серед 24″ моніторів з охопленням P3 майже немає: відповідна модель — з апаратним калібруванням. ");
 mW+=t("Требования — в разделе «Какой нужен монитор».","Вимоги — у розділі «Який потрібен монітор».");
 items.push({k:t("Монитор","Монітор"),st:"ok",sel:{key:"mon",opts:mons.map(function(x,i){return {id:x.id,t:x.n+" — "+moL.labels[i]+" · "+pshort(x.id)};}),cur:mon.id},name:mon.n,price:mon.id,sub:mon.s,why:mW});
 out.mon=mon.n;addP(mon.id);
 items.push({k:t("Калибратор","Калібратор"),name:"Calibrite Display Pro HL "+t("или","або")+" Datacolor SpyderX2 Ultra",st:"ok",why:t("Проверка раз в 1–2 месяца, цель — Rec.709, гамма 2.4, 100 нит.","Перевірка раз на 1–2 місяці, ціль — Rec.709, гама 2.4, 100 ніт.")});
 if(S.color&&monLevel>=2)items.push({k:t("Вывод цвета","Вивід кольору"),name:mac?"Blackmagic UltraStudio Monitor 3G":"Blackmagic DeckLink Mini Monitor 4K",st:"ok",tag:t("по желанию","за бажанням"),why:t("Если сдаёте цвет как услугу: карта выводит чистый сигнал Rec.709 в обход цветовой системы ОС на откалиброванный монитор.","Якщо здаєте колір як послугу: карта виводить чистий сигнал Rec.709 в обхід колірної системи ОС на відкалібрований монітор.")});
 /* Resolve и прочее */
 var rS="ok",rW;
 if(S.studio)rW=mac?t("На Mac Studio нужен ради шумодава, AI-инструментов и экспорта выше UHD.","На Mac Studio потрібен заради шумодава, AI-інструментів і експорту вище UHD."):t("Studio включает аппаратное декодирование H.264/H.265, шумодав, AI-инструменты и работу с несколькими видеокартами.","Studio вмикає апаратне декодування H.264/H.265, шумодав, AI-інструменти й роботу з кількома відеокартами.");
 else{rW=mac?t("Аппаратное декодирование на Mac работает и в бесплатной версии.","Апаратне декодування на Mac працює й у безкоштовній версії."):t("В бесплатной версии на Windows нет аппаратного декодирования H.264/H.265.","У безкоштовній версії на Windows немає апаратного декодування H.264/H.265.");
  if(S.nr){rS="bad";rW+=t(" <b>Шумоподавление и большинство AI-инструментов есть только в Studio.</b>"," <b>Шумозаглушення й більшість AI-інструментів є лише в Studio.</b>");}else if(!mac&&F.lg)rS="warn";}
 items.push({k:"Resolve",name:S.studio?"DaVinci Resolve Studio":t("DaVinci Resolve (бесплатный)","DaVinci Resolve (безкоштовний)"),st:rS,why:rW});
 items.push({k:t("Кард-ридер","Кардрідер"),name:c.card,st:"ok",why:t("Скорость сброса карт — часть рабочего дня. Ридер подключайте в порт USB 3.2 10 Гбит/с или Thunderbolt.","Швидкість скидання карт — частина робочого дня. Рідер підключайте в порт USB 3.2 10 Гбіт/с або Thunderbolt.")});
 items.push({k:t("Ещё","Ще"),name:t("ИБП, бэкап 3-2-1, нейтральный свет","ДБЖ, бекап 3-2-1, нейтральне світло"),st:"ok",why:(mac&&S.form==="laptop"?"":t("ИБП (line-interactive, 1000–1500 ВА) спасает проект при отключении света. ","ДБЖ (line-interactive, 1000–1500 ВА) рятує проєкт під час вимкнення світла. "))+t("Исходники должны жить минимум в двух местах до сдачи и после. Свет в комнате — нейтральный, около 6500 K.","Вихідники мають жити щонайменше у двох місцях до здачі й після. Світло в кімнаті — нейтральне, близько 6500 K.")});
 return {c:c,f:f,F:F,fam:fam,items:items,verdict:worst(items.map(function(x){return x.st;})),mac:mac,keep:keep,have:have,haveIss:haveIss,out:out,sum:sum};
}

/* ================= вывод ================= */
var R=null,prev={};
var pill=function(st,tx){return '<span class="pill p-'+st+'">'+(tx||({ok:t("тянет","тягне"),warn:t("на грани","на межі"),bad:t("не потянет","не потягне")})[st])+'</span>';};
function render(){
 R=compute();
 var V={ok:[t("Сборка тянет ваш материал","Збірка тягне ваш матеріал"),t("Монтаж и цвет в реальном времени, без прокси.","Монтаж і колір у реальному часі, без проксі.")],warn:[t("Работать можно, но есть узкие места","Працювати можна, але є вузькі місця"),t("Смотрите пункты с «!»: там написано, что поменять.","Дивіться пункти з «!»: там написано, що змінити.")],bad:[t("Есть несовместимость","Є несумісність"),t("Пункты с «✕» нужно исправить, иначе таймлайн будет тормозить или нужной функции не будет.","Пункти з «✕» потрібно виправити, інакше таймлайн гальмуватиме або потрібної функції не буде.")]}[R.verdict];
 var f=R.f,s=R.sum;
 var mat=R.c.n+" "+f.t+" · "+R.F.n+" · 4K "+(S.fps===30?"24–30p":S.fps===60?"50–60p":"100–120p")+" · "+nf(S.mbps)+t(" Мбит/с"," Мбіт/с");
 var totLbl=R.mac?t("Mac и монитор","Mac і монітор"):t("Процессор, видеокарта и монитор","Процесор, відеокарта й монітор");
 if(!R.mac&&R.keep)totLbl=t("Процессор и монитор","Процесор і монітор");
 $("#pcp-res").innerHTML='<span class="rk">'+esc(mat)+'</span><h3>'+V[0]+'</h3><p>'+V[1]+'</p>'+
  '<div class="tot"><span class="tv">$'+nf(s.usd)+'</span><span class="tu">≈ '+nf(s.uah)+' грн</span><span class="tn">'+totLbl+(s.miss?t(" (у одной позиции цену уточняем)"," (в однієї позиції ціну уточнюємо)"):"")+t(". Плата, память, диски и корпус — отдельно. Минимальные цены магазинов Украины, курс НБУ ",". Плата, пам’ять, диски й корпус — окремо. Мінімальні ціни магазинів України, курс НБУ ")+(PR.rate?nf(PR.rate,2)+" "+t("грн/$ на ","грн/$ на ")+PR.rate_date:"")+'.</span></div>'+
  '<div class="rb"><button type="button" class="rbtn" id="pcp-copy">'+t("Скопировать список","Скопіювати список")+'</button>'+(window.MCAT&&window.MCAT.open?'<button type="button" class="rbtn ghost" id="pcp-ask">'+t("Спросить Пикселя","Запитати Пікселя")+'</button>':'')+'</div>';
 var now={};
 $("#pcp-items").innerHTML=R.items.map(function(it){
  now[it.k]=it.name||JSON.stringify(it.disks||"");
  var chg=(prev[it.k]!==undefined&&prev[it.k]!==now[it.k])?" chg":"";
  if(it.disks){
   return '<div class="it'+chg+'"><div class="k">'+it.k+'</div><div class="v"><div class="name">'+t("По ролям","За ролями")+' '+pill(it.st,it.st==="ok"?t("скорости хватает","швидкості вистачає"):t("нужен быстрый массив","потрібен швидкий масив"))+'</div><div class="calc3"><div><b>'+nf(it.calc.gbh)+' ГБ</b><span>'+t("час материала","година матеріалу")+'</span></div><div><b>'+nf(it.calc.proj)+' ГБ</b><span>'+t("один проект","один проєкт")+'</span></div><div><b>'+nf(it.calc.mbs)+' МБ/с</b><span>'+t("поток одной камеры","потік однієї камери")+'</span></div></div><div class="disks">'+it.disks.map(function(d){return '<div class="disk"><b>'+esc(d[0])+'</b><i>'+esc(d[1])+'</i><span>'+esc(d[2])+'</span></div>';}).join("")+'</div></div></div>';
  }
  var head;
  if(it.sel)head='<select data-key="'+it.sel.key+'" aria-label="'+esc(it.k)+'">'+it.sel.opts.map(function(o){return '<option value="'+o.id+'"'+(o.id===it.sel.cur?" selected":"")+'>'+esc(o.t)+'</option>';}).join("")+'</select><div class="name">'+(it.price?'<span class="pr">'+ptxt(it.price).replace(" · ",' <small>≈ ')+(price(it.price)?'</small>':'')+'</span>':'')+pill(it.st,it.st==="ok"?(it.sel.opts.length>1?t("подходит · вариантов: ","підходить · варіантів: ")+it.sel.opts.length:t("подходит","підходить")):null)+'</div>';
  else head='<div class="name">'+esc(it.name)+' '+(it.tag?'<span class="pill p-ok">'+it.tag+'</span>':pill(it.st))+'</div>';
  var meter="";
  if(it.use!=null){var pc=Math.round(Math.min(1,it.use)*100);meter='<div class="meter'+(pc>90?" hot":"")+'"><span style="width:'+pc+'%"></span></div><div class="sub2">'+t("загрузка под вашу задачу ≈ ","завантаження під вашу задачу ≈ ")+pc+"%"+(pc>90?t(" — впритык"," — впритул"):pc<45?t(" — большой запас"," — великий запас"):"")+'</div>';}
  return '<div class="it'+chg+'"><div class="k">'+it.k+'</div><div class="v">'+head+(it.sub?'<div class="sub2">'+esc(it.sub)+'</div>':'')+meter+(it.why?'<div class="why">'+it.why+'</div>':'')+'</div></div>';
 }).join("");
 prev=now;
 var order=["hevc422","h264_422","hevc420","h264_10","h264_420","intra","prores","braw","raw"];
 $("#pcp-dec").innerHTML='<thead><tr><th>'+t("Кодек","Кодек")+'</th>'+DEC_COLS.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>'+order.map(function(k){return '<tr class="'+(k===R.fam?"cur":"")+'"><td>'+FAM[k].n+'</td>'+DEC[k].split("").map(function(v){return '<td><span class="c c-'+v+'">'+DEC_TXT[v]+'</span></td>';}).join("")+'</tr>';}).join("")+'</tbody>';
 save();
}
function drawFoot(){
 $("#pcp-foot").innerHTML=
  '<p><b>'+t("Объём.","Обсяг.")+'</b> '+t("Битрейт × 0,45 = ГБ на час материала (200 Мбит/с ≈ 90 ГБ/ч). Скорость рабочего диска: битрейт ÷ 8 × число камер × 2 (запас на перемотку и кэш).","Бітрейт × 0,45 = ГБ на годину матеріалу (200 Мбіт/с ≈ 90 ГБ/год). Швидкість робочого диска: бітрейт ÷ 8 × кількість камер × 2 (запас на перемотування й кеш).")+'</p>'+
  '<p><b>'+t("Процессор и видеокарта","Процесор і відеокарта")+'</b> '+t("оцениваются отдельно: что каждый из них разжимает сам, частота кадров, цвет, шумодав, число камер. Видеопамять: 8 ГБ на монтаж, 12 ГБ с цветом, 16 ГБ с шумодавом и RAW, 24 ГБ и больше с шумодавом на мультикаме. Официальный минимум Blackmagic (4 ГБ видеопамяти, 16 ГБ ОЗУ на Windows) рассчитан на лёгкие проекты, не на 4K-цвет.","оцінюються окремо: що кожен із них розпаковує сам, частота кадрів, колір, шумодав, кількість камер. Відеопам’ять: 8 ГБ на монтаж, 12 ГБ з кольором, 16 ГБ із шумодавом і RAW, 24 ГБ і більше із шумодавом на мультикамі. Офіційний мінімум Blackmagic (4 ГБ відеопам’яті, 16 ГБ ОЗП на Windows) розрахований на легкі проєкти, не на 4K-колір.")+'</p>'+
  '<p><b>'+t("Цены","Ціни")+'</b> — '+t("минимальные в магазинах Украины по e-каталогу (ek.ua), в $ по курсу НБУ","мінімальні в магазинах України за e-каталогом (ek.ua), у $ за курсом НБУ")+(PR.rate?" "+nf(PR.rate,2)+" грн/$ "+t("на ","на ")+PR.rate_date:"")+t(". У Mac — цена базовой конфигурации. Перед покупкой сравните цены в магазинах.",". У Mac — ціна базової конфігурації. Перед купівлею порівняйте ціни в магазинах.")+'</p>'+
  '<p><b>'+t("Источники:","Джерела:")+'</b> <a href="https://www.blackmagicdesign.com/support/content/readme/556428253a0c4b3291aa553137d9c5f2" target="_blank" rel="noopener">Blackmagic — DaVinci Resolve 21</a> · <a href="https://www.pugetsystems.com/labs/articles/What-H-264-and-H-265-Hardware-Decoding-is-Supported-in-DaVinci-Resolve-Studio-2122/" target="_blank" rel="noopener">Puget Systems — '+t("декодирование в Resolve Studio","декодування в Resolve Studio")+'</a> · <a href="https://www.pugetsystems.com/labs/articles/amd-radeon-rx-9070-xt-content-creation-review/" target="_blank" rel="noopener">Puget Systems — Radeon RX 9070 XT</a> · <a href="https://intel.com/content/www/us/en/develop/articles/onevpl-codecs-for-intel-hardware.html" target="_blank" rel="noopener">Intel — Quick Sync</a> · <a href="https://www.displayninja.com/best-monitors-for-photo-editing-and-video-editing/" target="_blank" rel="noopener">Display Ninja — '+t("мониторы для монтажа","монітори для монтажу")+'</a> · <a href="https://ek.ua/" target="_blank" rel="noopener">e-каталог</a></p>';
}

/* ================= копирование ================= */
function plain(){
 if(!R)return "";var strip=function(s){return String(s||"").replace(/<[^>]+>/g,"");};
 var L=[t("Компьютер для DaVinci Resolve — Matis Academy","Комп’ютер для DaVinci Resolve — Matis Academy"),R.c.n+" "+R.f.t+" ("+R.F.n+"), 4K "+(S.fps===30?"24–30p":S.fps===60?"50–60p":"100–120p")+", "+S.mbps+t(" Мбит/с, камер: "," Мбіт/с, камер: ")+S.streams,""];
 R.items.forEach(function(it){if(it.k===t("Декодирование","Декодування"))return;
  if(it.disks){L.push(it.k+":");it.disks.forEach(function(d){L.push("  • "+d[0]+": "+d[1]);});}
  else L.push(it.k+": "+strip(it.name)+(it.price?" — "+ptxt(it.price):""));});
 L.push("",t("Ориентир: $","Орієнтир: $")+nf(R.sum.usd)+" ≈ "+nf(R.sum.uah)+" грн","https://matis.academy"+(UK?"/uk":"")+"/wiki/kompyuter-dlya-davinci/");
 return L.join("\n");
}
function toast(x){var e=$("#pcp-toast");e.textContent=x;setTimeout(function(){e.textContent="";},2400);}
function copy(){var tx=plain();var ok=function(){toast(t("Список скопирован","Список скопійовано"));};
 try{navigator.clipboard.writeText(tx).then(ok).catch(function(){fb(tx,ok);});}catch(e){fb(tx,ok);}}
function fb(tx,ok){var ta=document.createElement("textarea");ta.value=tx;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var r=false;try{r=document.execCommand("copy");}catch(e){}document.body.removeChild(ta);if(r)ok();else toast(t("Не удалось скопировать: выделите список вручную.","Не вдалося скопіювати: виділіть список вручну."));}

/* ================= Пиксель-гид ================= */
var STEPS=[
 ["pcp-st1",t("<b>Шаг 1.</b> На чём будешь монтировать: ПК на Windows или Mac? Если ПК — выбери марку процессора и скажи, какая видеокарта уже стоит. Вдруг её и менять не надо.","<b>Крок 1.</b> На чому монтуватимеш: ПК на Windows чи Mac? Якщо ПК — обери марку процесора й скажи, яка відеокарта вже стоїть. Раптом її й міняти не треба.")],
 ["pcp-st2",t("<b>Шаг 2.</b> Чем снимаешь? Нажми на бренд камеры, а ниже выбери формат, в котором пишешь. Не помнишь — посмотри в меню камеры, раздел «Формат файла».","<b>Крок 2.</b> Чим знімаєш? Натисни на бренд камери, а нижче обери формат, у якому пишеш. Не пам’ятаєш — подивись у меню камери, розділ «Формат файлу».")],
 ["pcp-st3",t("<b>Шаг 3.</b> Что будешь делать с материалом? Лог без цветокора не живёт, так что галочку я уже поставил. Шумодав включай, если часто снимаешь в темноте.","<b>Крок 3.</b> Що робитимеш із матеріалом? Лог без кольорокору не живе, тож галочку я вже поставив. Шумодав вмикай, якщо часто знімаєш у темряві.")],
 ["pcp-st4",t("<b>Шаг 4.</b> Resolve бесплатный или Studio? На Windows это важно: без Studio видеокарта не помогает разжимать H.264 и H.265.","<b>Крок 4.</b> Resolve безкоштовний чи Studio? На Windows це важливо: без Studio відеокарта не допомагає розпаковувати H.264 і H.265.")],
 ["pcp-st5",t("<b>Шаг 5.</b> Сколько материала? Это нужно для дисков. Свадьба с двух камер — обычно 4–8 часов.","<b>Крок 5.</b> Скільки матеріалу? Це потрібно для дисків. Весілля з двох камер — зазвичай 4–8 годин.")],
 ["pcp-st6",t("<b>Шаг 6.</b> Монитор. Выбери диагональ и охват. Для YouTube и свадеб хватает 100% sRGB, для HDR — DCI-P3.","<b>Крок 6.</b> Монітор. Обери діагональ і охоплення. Для YouTube і весіль вистачає 100% sRGB, для HDR — DCI-P3.")]];
var P={mode:"intro",step:0};
function say(html,acts,force){
 var g=$("#pcp-guide");
 if(P.muted&&!force){$("#pcp-say").innerHTML=html;$("#pcp-acts").innerHTML="";var d=$("#pcp-cat .dot");if(!d){d=document.createElement("span");d.className="dot";$("#pcp-cat").appendChild(d);}return;}
 g.classList.remove("min");
 $("#pcp-say").innerHTML=html;
 $("#pcp-acts").innerHTML=(acts||[]).map(function(a){return '<button type="button" class="act'+(a.m?" main":"")+'" data-act="'+a.a+'">'+esc(a.t)+'</button>';}).join("");
 var c=$("#pcp-cat");c.classList.remove("hop");void c.getBoundingClientRect();c.classList.add("hop");
}
function focusStep(id){document.querySelectorAll(".pcp .step.focus").forEach(function(x){x.classList.remove("focus");});if(!id)return;var el=document.getElementById(id);if(!el)return;el.classList.add("focus");el.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});}
function showPanel(){focusStep(null);var p=$(".pcp .panel");if(p)p.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});}
var A=function(a,tx,m){return {a:a,t:tx,m:m};};
function intro(){P.mode="intro";focusStep(null);say(t("Привет! Я Пиксель. Давай подберём тебе железо под DaVinci Resolve. Пройдём шесть шагов вместе — или я соберу всё сам, если ответишь на три вопроса.","Привіт! Я Піксель. Давай підберемо тобі залізо під DaVinci Resolve. Пройдемо шість кроків разом — або я зберу все сам, якщо відповіси на три запитання."),[A("guide",t("Пройти по шагам","Пройти за кроками"),1),A("quick",t("Собери за меня","Збери за мене"))]);}
function step(i){P.mode="guide";P.step=i;if(i>=STEPS.length){done();return;}
 say(STEPS[i][1],[A("next",i===STEPS.length-1?t("Готово, покажи сборку","Готово, покажи збірку"):t("Дальше","Далі"),1),A("quick",t("Собери за меня","Збери за мене"))]);focusStep(STEPS[i][0]);}
function done(){P.mode="done";say(t("Готово! Справа твоя сборка","Готово! Праворуч твоя збірка")+(R&&R.verdict==="ok"?t(", и она тянет твой материал",", і вона тягне твій матеріал"):"")+t(". В процессоре, видеокарте и мониторе можно открыть список: там только подходящие модели, от минимума до топа.",". У процесорі, відеокарті й моніторі можна відкрити список: там лише відповідні моделі, від мінімуму до топу."),[A("show",t("Показать сборку","Показати збірку"),1)].concat(askBtn()).concat([A("intro",t("Начать сначала","Почати спочатку"))]));showPanel();}
function askBtn(){return window.MCAT&&window.MCAT.open?[A("ask",t("Спросить в чате","Запитати в чаті"))]:[];}
function quick(){P.mode="quick";say(t("Окей, три вопроса. <b>Первый:</b> на чём монтируешь?","Окей, три запитання. <b>Перше:</b> на чому монтуєш?"),[A("q-pc",t("ПК на Windows","ПК на Windows"),1),A("q-mac","Mac")]);}
function quickCam(){say(t("<b>Второй:</b> чем снимаешь? Возьму самый частый формат для лога, потом поправишь, если что.","<b>Друге:</b> чим знімаєш? Візьму найчастіший формат для логу, потім поправиш, якщо що."),CAMS.filter(function(c){return c.id!=="other";}).map(function(c){return A("q-cam-"+c.id,c.n);}));}
function quickBudget(){say(t("<b>Третий:</b> как по деньгам?","<b>Третє:</b> як щодо грошей?"),[A("q-b-min",t("Подешевле, но чтобы тянуло","Дешевше, але щоб тягнуло")),A("q-b-rec",t("Оптимально","Оптимально"),1),A("q-b-top",t("С запасом на годы","Із запасом на роки"))]);}
function setCam(id){S.cam=id;var c=cam(),di=0;c.fmts.forEach(function(x,i){if(x.d)di=i;});S.fmt=di;S.mbps=c.fmts[di].m;}
function quickFinish(b){S.budget=b;S.sel={};S.color=true;S.nr=false;S.streams=1;S.studio=true;S.have="none";drawStatic();render();
 var f=cam().fmts[S.fmt],pick=S.platform==="mac"?R.out.mac:R.out.cpu+" + "+R.out.gpu;P.mode="done";
 say(t("Собрал! ","Зібрав! ")+esc(cam().n)+t(" в "," у ")+esc(f.t)+" ("+esc(FAM[f.f].n)+t("), монтаж и цвет. Основа: <b>","), монтаж і колір. Основа: <b>")+esc(pick)+t("</b>, монитор — <b>","</b>, монітор — <b>")+esc(R.out.mon)+t("</b>. Ориентир — $","</b>. Орієнтир — $")+nf(R.sum.usd)+t(". Справа всё по пунктам, в списках можно сменить модель.",". Праворуч усе за пунктами, у списках можна змінити модель."),[A("show",t("Показать сборку","Показати збірку"),1),A("guide",t("Уточнить по шагам","Уточнити за кроками"))].concat(askBtn()));showPanel();}
function react(kind){
 if(!R||P.mode==="quick")return;var tx=null,nm=cam().fmts[S.fmt];
 if(kind==="fmt"||kind==="cam"||kind==="cpu"){
  if(S.platform==="pc"&&(nm.f==="h264_422"||nm.f==="h264_10"))tx=esc(nm.t)+t(" — это "," — це ")+FAM[nm.f].n+t(". На ПК его аппаратно тянут только RTX 50, список видеокарт я уже отфильтровал.",". На ПК його апаратно тягнуть лише RTX 50, список відеокарт я вже відфільтрував.");
  else if(S.platform==="pc"&&nm.f==="hevc422"&&S.cpu==="intel")tx=esc(nm.t)+t(" — это H.265 4:2:2. Его разжимает Quick Sync в процессоре Intel, так что видеокарту можно взять подешевле."," — це H.265 4:2:2. Його розпаковує Quick Sync у процесорі Intel, тож відеокарту можна взяти дешевшу.");
  else if(S.platform==="pc"&&nm.f==="hevc422")tx=t("У Ryzen нет Quick Sync для 4:2:2, поэтому разжимать будет видеокарта: RTX 50 или Intel Arc.","У Ryzen немає Quick Sync для 4:2:2, тому розпаковуватиме відеокарта: RTX 50 або Intel Arc.");
  else if(nm.f==="raw")tx=t("RAW — тяжёлый зверь: видеокарте нужно много памяти, а дискам — скорость. Поднял планку.","RAW — важкий звір: відеокарті потрібно багато пам’яті, а дискам — швидкість. Підняв планку.");
  else if(nm.f==="intra"||nm.f==="prores")tx=t("Внутрикадровый формат: процессору легко, а вот дискам тяжело. Смотри блок «Диски».","Внутрішньокадровий формат: процесору легко, а от дискам важко. Дивись блок «Диски».");}
 if(kind==="platform")tx=S.platform==="mac"?t("Mac — хороший выбор: аппаратное декодирование работает даже в бесплатном Resolve. Главное — памяти с запасом, докупить её потом нельзя.","Mac — гарний вибір: апаратне декодування працює навіть у безкоштовному Resolve. Головне — пам’яті із запасом, докупити її потім не можна."):t("ПК так ПК. Процессор Intel даёт лишний аппаратный декодер, поэтому я советую его.","ПК так ПК. Процесор Intel дає зайвий апаратний декодер, тому я раджу його.");
 if(kind==="have"&&R.have.id!=="none")tx=R.keep?t("Твоя ","Твоя ")+esc(R.have.n)+t(" справится, менять не надо!"," впорається, міняти не треба!"):t("Твою ","Твою ")+esc(R.have.n)+t(" придётся менять: "," доведеться міняти: ")+esc(R.haveIss[0].t)+".";
 if(kind==="nr"&&S.nr)tx=t("Шумодав любит видеопамять и NVIDIA. Поднял планку видеокарты.","Шумодав любить відеопам’ять і NVIDIA. Підняв планку відеокарти.");
 if(kind==="studio"&&!S.studio&&S.platform==="pc")tx=t("Осторожно: в бесплатном Resolve на Windows аппаратного декодирования нет. Для 4K60 10 бит бери Studio.","Обережно: у безкоштовному Resolve на Windows апаратного декодування немає. Для 4K60 10 біт бери Studio.");
 if(kind==="streams"&&S.streams>=3)tx=t("Мультикам на ","Мультикам на ")+S.streams+t(" камеры — нагрузка растёт. Поднял процессор и память."," камери — навантаження зростає. Підняв процесор і пам’ять.");
 if(kind==="mon")tx=S.gamut===1?t("100% sRGB хватает для YouTube, Instagram и свадеб. Вот модели этой диагонали.","100% sRGB вистачає для YouTube, Instagram і весіль. Ось моделі цієї діагоналі."):S.gamut===2?t("DCI-P3 нужен для HDR. Подобрал модели с охватом от 95%.","DCI-P3 потрібен для HDR. Підібрав моделі з охопленням від 95%."):t("Аппаратная калибровка — уровень коммерческого цвета. Калибровка пишется в сам монитор.","Апаратне калібрування — рівень комерційного кольору. Калібрування записується в сам монітор.");
 if(!tx)return;
 if(P.mode==="guide")say(tx,[A("next",P.step===STEPS.length-1?t("Готово, покажи сборку","Готово, покажи збірку"):t("Дальше","Далі"),1)]);
 else say(tx,[A("show",t("Показать сборку","Показати збірку"),1),A("intro",t("Начать сначала","Почати спочатку"))]);
}

/* ================= события ================= */
function clampN(k,v){var el=$("#pcp-"+k);return Math.min(+el.max,Math.max(+el.min,v));}
function onClick(e){
 var w=e.target.closest("[data-pcw]");if(w){setW(w.dataset.pcw);return;}
 var st=e.target.closest("button[data-step]");if(st){var k=st.dataset.step;S[k]=clampN(k,(S[k]||0)+ +st.dataset.d);drawStatic();render();if(k==="streams")react("streams");return;}
 var b=e.target.closest("[data-g]");if(!b||b.getAttribute("aria-disabled")==="true")return;
 var g=b.dataset.g,v=b.dataset.v,kind=null;
 if(g==="platform"){S.platform=v;kind="platform";}
 else if(g==="cpu"){S.cpu=v;delete S.sel.cpu;kind="cpu";}
 else if(g==="form"){S.form=v;delete S.sel.mac;delete S.sel.mem;}
 else if(g==="cam"){setCam(v);kind="cam";}
 else if(g==="fmt"){S.fmt=+v;S.mbps=cam().fmts[S.fmt].m;kind="fmt";}
 else if(g==="fps"){S.fps=+v;}
 else if(g==="studio"){S.studio=v==="1";kind="studio";}
 else if(g==="diag"){S.diag=+v;delete S.sel.mon;kind="mon";}
 else if(g==="gamut"){S.gamut=+v;delete S.sel.mon;kind="mon";}
 else if(g==="color"){S.color=!S.color;}
 else if(g==="nr"){S.nr=!S.nr;kind="nr";}
 drawStatic();render();react(kind);
}
function onChange(e){
 var t_=e.target;
 if(t_.id==="pcp-have"){S.have=t_.value;drawStatic();render();react("have");return;}
 if(t_.dataset&&t_.dataset.num){var k=t_.dataset.num,v=parseInt(t_.value,10);S[k]=isNaN(v)?S[k]:clampN(k,v);drawStatic();render();if(k==="streams")react("streams");return;}
 if(t_.dataset&&t_.dataset.key){S.sel[t_.dataset.key]=t_.value;render();}
}
function onGuide(e){
 if(e.target.closest("#pcp-cat")){var g=$("#pcp-guide"),d=$("#pcp-cat .dot");if(d)d.remove();if(g.classList.contains("min")){P.muted=false;if(!$("#pcp-acts").children.length){if(P.mode==="guide")step(P.step);else if(P.mode==="intro")intro();else done();}else g.classList.remove("min");}else{g.classList.add("min");P.muted=true;}return;}
 var b=e.target.closest("button[data-act]");if(!b)return;var a=b.dataset.act;
 if(a==="min"){$("#pcp-guide").classList.add("min");P.muted=true;}
 else if(a==="guide")step(0);else if(a==="next")step(P.step+1);else if(a==="quick")quick();else if(a==="intro")intro();else if(a==="show")showPanel();
 else if(a==="ask"){if(window.MCAT&&window.MCAT.open)window.MCAT.open();}
 else if(a==="q-pc"||a==="q-mac"){S.platform=a==="q-pc"?"pc":"mac";drawStatic();render();quickCam();}
 else if(a.indexOf("q-cam-")===0){setCam(a.slice(6));drawStatic();render();quickBudget();}
 else if(a.indexOf("q-b-")===0)quickFinish(a.slice(4));
}

function start(){
 if(!mount())return;
 var root=$("#pc-app");
 root.addEventListener("click",function(e){if(e.target.closest("#pcp-copy")){copy();return;}if(e.target.closest("#pcp-ask")){if(window.MCAT&&window.MCAT.open)window.MCAT.open();return;}onClick(e);});
 root.addEventListener("change",onChange);
 $("#pcp-guide").addEventListener("click",onGuide);
 drawStatic();drawFoot();render();intro();
 fetch(BASE+"data/prices.json",{cache:"no-cache"}).then(function(r){return r.json();}).then(function(d){PR=d||PR;drawFoot();render();}).catch(function(){});
 /* чат сайта подгружается позже — показать кнопку «Спросить Пикселя», когда он появится */
 var tries=0,iv=setInterval(function(){tries++;if(window.MCAT&&window.MCAT.open){clearInterval(iv);render();}else if(tries>20)clearInterval(iv);},500);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
