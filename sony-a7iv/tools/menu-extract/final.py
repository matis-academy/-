# Шаг 4. Сводит пункты и заводские значения в menu-tree.json (+ текстовая сводка для проверки глазами).
# OLD — прежний menu-tree.json, из него переносятся описание навигации и оглавление (можно передать {}).
# python3 -I final.py desc-raw.json defaults-raw.json old.json menu-tree.json summary.txt
import json,sys,re
D=json.load(open(sys.argv[1])); DEF=json.load(open(sys.argv[2])); OLD=json.load(open(sys.argv[3])); out=sys.argv[4]; summ=sys.argv[5]
def norm(s): return re.sub(r"[\s*]","",s or "").lower()
# defaults rows grouped by tab
cur=None; drows=[]
for r in DEF:
    if "tabHeader" in r: cur=r["tabHeader"]; continue
    if r["name"].startswith("("): continue
    if r["default"].startswith(")"):
        r["name"]+=")"; r["default"]=r["default"][1:].strip() or r.get("c3","")
    r["name"]=re.sub(r"\*\s*\*.*$","",r["name"]).strip()
    r["tab"]=cur; drows.append(r)
# custom key blocks: assign photo/movie by order of appearance
seen={}
for r in drows:
    if r["name"].startswith("Наст.пол.кл/диск ("):
        k=r["name"]; seen[k]=seen.get(k,0)+1
        r["variant"]="фото" if seen[k]==1 else "видео"
def split(rn):
    m=re.match(r"^(.*?)\s*\((.*)$",rn)
    if not m: return rn,"",""
    base=m.group(1); rest=m.group(2)
    depth=1; i=0
    while i<len(rest) and depth:
        if rest[i]=="(": depth+=1
        elif rest[i]==")": depth-=1
        i+=1
    return base,rest[:i-1],rest[i:].strip()
def match_defaults(it,tabname):
    name=it["name"]; parts=name.split(": ")
    full=norm(name); pre=norm(parts[0]); last=norm(parts[-1])
    res=[]
    for r in drows:
        if r["tab"]!=tabname: continue
        base,par,cond=split(r["name"])
        ok=False; setting=None
        if norm(r["name"])==full or (norm(base)==full and par):
            ok=True; setting=(par+(" "+cond if cond else "")).strip() or None
        elif norm(r["name"]).startswith(full+"("):
            ok=True; setting=re.sub(r"^\((.*)\)$",r"\1",r["name"][len(name):].strip())
        elif len(parts)>1 and norm(base)==pre and last in [norm(x) for x in par.split("/")]:
            ok=True; setting=cond or None
        elif name.startswith("Режим протяжки:") and norm(r["name"])==norm("Режим протяжки"):
            ok=True; setting="Режим протяжки"
        if ok:
            if it.get("variant") and r.get("variant") and r["variant"]!=it["variant"]: continue
            if it.get("variant") and not r.get("variant"):
                # rows without variant icon but sibling rows with icon exist -> skip ambiguous only if another row has the icon
                if any(norm(x["name"])==norm(r["name"]) and x.get("variant")==it["variant"] for x in drows if x is not r): continue
            res.append({"setting":setting,"default":r["default"]} if setting else {"default":r["default"]})
    return res
TABID={"Съемка":"shooting","Экспозиция/Цвет":"exposure_color","Фокус":"focus","Воспроизв.":"playback","Сеть":"network","Настройка":"setup","Мое меню":"my_menu"}
TABFULL={"Воспроизв.":"Воспроизведение"}
MODE={"фото+видео+S&Q":"all","фото":"photo","видео/S&Q":"movie/S&Q"}
def sent(t,n=2,cap=260):
    t=re.sub(r"\s+"," ",t).strip()
    ss=[];start=0
    for m in re.finditer(r"(?<=[.!?])\s+(?=[А-ЯA-Z\[“\"«])",t):
        pre=t[start:m.start()]
        if pre.count("[")!=pre.count("]") or pre.count("(")!=pre.count(")"): continue
        ss.append(pre); start=m.end()
    ss.append(t[start:])
    r=" ".join(ss[:n])
    if len(r)>cap: r=ss[0]
    if len(r)>cap: r=r[:cap].rsplit(" ",1)[0]+"…"
    return r
tabs=[]; stats=dict(items=0,help=0,options=0,defaults=0,groups=0)
for t in D["tabs"]:
    T={"id":TABID[t["name"]],"name":t["name"],"fullName":TABFULL.get(t["name"],t["name"]),"groups":[]}
    for g in t["groups"]:
        G={"name":g["name"].replace(" *","").replace("Mое","Мое") if False else g["name"],"items":[]}
        for it in g["items"]:
            d=it["desc"]; key=it["name"].split(": ")[-1]
            opts=list(d["options"]); help_=sent(d["lead"]); shared=False
            if key in opts and sum(1 for x in g["items"] if x["name"].split(": ")[-1] in opts)>=2:
                shared=True
                ld=d["labelDesc"].get(key,"")
                if ld: help_=sent(ld,1)
                opts=[]
            if it["name"].startswith("Режим протяжки:"):
                shared=True; ld=d["labelDesc"].get(key,""); help_=sent(ld,1) if ld else help_; opts=[]
            I={"name":it["name"],"mode":MODE.get(it["mode"],it["mode"])}
            if it.get("variant"): I["variant"]=it["variant"]
            if it.get("sepPhotoMovie"): I["separatePhotoMovie"]=True
            I["help"]=help_
            I["options"]=opts
            if it.get("subSettings"): I["subSettings"]=it["subSettings"]
            if d["range"]: I["range"]=d["range"]
            dv=match_defaults(it,t["name"])
            if dv: I["defaults"]=dv
            I["page"]=it["page"]; I["guideTitle"]=d["title"]
            if d["menuPath"]: I["menuPath"]=d["menuPath"]
            if shared: I["note"]="Описан в общем разделе вместе с соседними пунктами; значения см. на стр. %d."%it["page"]
            G["items"].append(I)
            stats["items"]+=1; stats["help"]+=bool(I["help"]); stats["options"]+=bool(I["options"] or I.get("subSettings") or I.get("range")); stats["defaults"]+=bool(dv)
        T["groups"].append(G); stats["groups"]+=1
    tabs.append(T)
# manual enrichments for tabular topics (values as printed in the guide's tables)
def find(name,variant=None):
    for T in tabs:
        for G in T["groups"]:
            for I in G["items"]:
                if I["name"]==name and (variant is None or I.get("variant")==variant): return I
fv=find("Формат файла","видео")
if fv: fv["options"]=["XAVC HS 4K","XAVC S 4K","XAVC S HD","XAVC S-I 4K","XAVC S-I HD"]
for n in ("Настр.кач-ва изобр.: Разм.изобр.JPEG","Настр.кач-ва изобр.: Разм. изобр.HEIF"):
    x=find(n)
    if x: x["options"]=["L","M","S"]; x["optionsByAspect"]={"3:2":["L: 33M","M: 14M","S: 8.2M"],"4:3":["L: 29M","M: 13M","S: 7.3M"],"16:9":["L: 28M","M: 12M","S: 6.9M"],"1:1":"см. стр. 237-238"}
x=find("Формат")
if x and not x["help"]: x["help"]="Выбор соотношения сторон (формата кадра) для фотоснимков."
for T in tabs:
    for G in T["groups"]:
        for I in G["items"]:
            if I["options"] and re.search(r"Пример при выборе",";".join(I["options"])):
                I["options"]=[o for o in I["options"] if not o.startswith("Пример")]
stats=dict(items=0,help=0,options=0,defaults=0,groups=sum(len(T["groups"]) for T in tabs))
for T in tabs:
    for G in T["groups"]:
        for I in G["items"]:
            stats["items"]+=1; stats["help"]+=bool(I["help"]); stats["options"]+=bool(I["options"]); stats["defaults"]+=bool(I.get("defaults"))
            stats.setdefault("optionsOrSubOrRange",0); stats["optionsOrSubOrRange"]+=bool(I["options"] or I.get("subSettings") or I.get("range"))
# custom keys
ck={"photo":{},"movie":{},"playback":{}}
for r in drows:
    m=re.match(r"Наст\.пол\.кл/диск \((.+)\)$",r["name"])
    if m: ck["photo" if r["variant"]=="фото" else "movie"][m.group(1).strip()]=r["default"]
    m=re.match(r"Наст\.Польз\.клав\. \((.+)\)$",r["name"])
    if m: ck["playback"][m.group(1).strip()]=r["default"]
ck["source"]="Список значений настроек по умолчанию, стр. 512-513 (вкладка Настройка). 'След. польз. (фото)' = как для фото; 'Сл. польз.' в воспроизведении = как при съемке."
ck["assignableKeys"]=["Кнопка AF-ON","Специал. кнопка 3","Специал. кнопка 1","Специал. кнопка 2","Кнопка MOVIE","Задн. диск L","Задн. диск R","Функц. кнопки AEL","Центральн. кнопка","Колесико управлен./Левая кнопка/Правая кнопка/Кнопка спуска","Специал. кнопка 4","Центр.кн. м-селект.","Fn/(отправка) кнопка","Передн. диск"]
ck["assignableKeysPage"]=334
ck["textMentions"]={"AEL":"Удержание AEL (стр. 38, 65)","Центр мульти-селектора":"Стандарт фокусир. (стр. 51)","C2":"Область фокус. (стр. 123)","C3 (воспроизведение)":"Защита (стр. 380)","Задн. диск R":"Коррек.экспоз. (стр. 179)"}
res={
 "source":"Sony ILCE-7M4 (α7 IV) Справочное руководство, 5-031-534-12(1), Google Drive print.pdf id 1lApRCFbE1g8gjNBUgvACuUSC6mFwds1I; полный текст извлечен локально (526 стр.). Таблица MENU: стр. 95-104; описания пунктов по ссылкам из таблицы; значения по умолчанию: 'Список значений настроек по умолчанию' стр. 499-513.",
 "complete":True,
 "notes":"Дерево MENU построено из таблицы 'Поиск функций в MENU' (стр. 95-104) по геометрии PDF: группы по ячейкам таблицы, порядок групп и пунктов как напечатано. Порядок вкладок в таблице отличается от реального порядка на экране (примечание стр. 104). mode: all = отображается при любом положении диска Фото/Видео/S&Q; photo = только в режиме фото; movie/S&Q = в режимах видео и S&Q. variant = значок фото/видео перед названием пункта (два пункта с одинаковым названием). separatePhotoMovie = пункт с значком раздельной настройки фото/видео (см. [Разл.настр. сн./вид.]). help = первые 1-2 предложения вступления описания (сокращенно). options = подписи значений из раздела 'Подробности пунктов меню' (как напечатано; '/'-группы оставлены как в руководстве). subSettings = подпункты из пути MENU. defaults = значение по умолчанию из таблицы стр. 499-513 (с подпараметром/условием). Пункты-действия (Форматировать, Удалить и т.п.) не имеют options. Пункты, описанные в общем разделе (TC/UB, Отображ. метки, Зебра, выделение контуров, Bluetooth, Проводная LAN, Режим протяжки), имеют пустые options и note. '*' в названии = только для некоторых моделей.",
 "navigation":OLD.get("navigation"),
 "tabs":tabs,
 "fnDefaults":{"photo":[],"movie":[],"note":"Руководство не перечисляет пункты меню Fn по умолчанию: в таблице значений по умолчанию для [Настройки меню Fn] указано '―', а пример меню функций (стр. 59) дан только картинкой. Известно: 12 пунктов для фото и 12 для видео; регистрация через MENU → (Настройка) → [Настр. операции] → [Настройки меню Fn] (стр. 343)."},
 "customKeyDefaults":ck,
 "stats":stats,
 "tocFunctionIndex":OLD.get("tocFunctionIndex"),
}
json.dump(res,open(out,"w"),ensure_ascii=False,indent=1)
# summary
L=["Sony α7 IV (ILCE-7M4) — дерево MENU из русского Справочного руководства (print.pdf, 526 стр.)",""]
L.append("Итого: %d вкладок, %d групп, %d пунктов; help у %d, options у %d (options/подпункты/диапазон у %d), значения по умолчанию у %d."%(len(tabs),stats["groups"],stats["items"],stats["help"],stats["options"],stats["optionsOrSubOrRange"],stats["defaults"]))
L.append("")
for T in tabs:
    L.append("[%s] %s"%(T["id"],T["fullName"]))
    for G in T["groups"]:
        L.append("  %s: %s"%(G["name"],"; ".join(I["name"]+(" (%s)"%I["variant"] if I.get("variant") else "") for I in G["items"])))
L.append("")
L.append("Пользовательские клавиши по умолчанию (фото): "+"; ".join("%s = %s"%kv for kv in ck["photo"].items()))
L.append("Воспроизведение: "+"; ".join("%s = %s"%kv for kv in ck["playback"].items()))
L.append("Меню Fn по умолчанию: в руководстве не перечислено.")
open(summ,"w").write("\n".join(L)+"\n")
print("\n".join(L[:3])); print(json.dumps(ck,ensure_ascii=False)[:1500])
