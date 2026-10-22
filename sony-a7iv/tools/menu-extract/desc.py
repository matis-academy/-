# Шаг 2. Для каждого пункта находит его страницу описания: краткая справка, варианты значений, путь MENU.
# python3 -I desc.py manual.pdf table-raw.json desc-raw.json
import pymupdf,sys,json,re
doc=pymupdf.open(sys.argv[1]); raw=json.load(open(sys.argv[2])); out=sys.argv[3]
N=doc.page_count
def is_topic_start(i):
    t=doc[i].get_text("text").lstrip()
    return t.startswith("Справочное руководство")
starts=[i for i in range(N) if is_topic_start(i)]
def topic_pages(p0):
    nxt=[s for s in starts if s>p0]
    end=nxt[0] if nxt else N
    return list(range(p0,end))
def lines_of(pages):
    L=[]
    for i in pages:
        for b in doc[i].get_text("dict")["blocks"]:
            if b["type"]!=0: continue
            for l in b["lines"]:
                sp=[s for s in l["spans"] if s["text"].strip()]
                if not sp: continue
                t=re.sub(r"\s+"," ","".join(s["text"] for s in l["spans"])).strip()
                if "Copyright" in t or re.fullmatch(r"\d+",t): continue
                bold=all("Bold" in s["font"] for s in sp)
                size=max(s["size"] for s in sp)
                L.append(dict(p=i,y=l["bbox"][1],x=l["bbox"][0],t=t,bold=bold,size=size))
    L.sort(key=lambda d:(d["p"],round(d["y"]/3),d["x"]))
    # merge same-row fragments
    M=[]
    for d in L:
        if M and M[-1]["p"]==d["p"] and abs(M[-1]["y"]-d["y"])<3 and M[-1]["bold"]==d["bold"]:
            M[-1]["t"]=(M[-1]["t"]+" "+d["t"]).strip()
        else: M.append(dict(d))
    return M
def sentences(txt,n=2,cap=280):
    ss=re.split(r"(?<=[.!?])\s+(?=[А-ЯA-Z\[“\"])",txt)
    r=" ".join(ss[:n]).strip()
    if len(r)>cap: r=" ".join(ss[:1]).strip()
    return r
cache={}
def parse(pg):
    if pg in cache: return cache[pg]
    pages=topic_pages(pg-1)
    L=lines_of(pages)
    # skip header
    i=0
    while i<len(L) and not (L[i]["bold"] and L[i]["size"]>12): i+=1
    title=L[i]["t"] if i<len(L) else None
    j=i+1
    while j<len(L) and L[j]["bold"] and L[j]["size"]>12: title+=" "+L[j]["t"]; j+=1
    lead=[]
    while j<len(L) and not L[j]["bold"] and L[j]["x"]<45:
        lead.append(L[j]["t"]); j+=1
    paths=[]
    for k,d in enumerate(L):
        if d["bold"] and "MENU →" in d["t"]:
            s=d["t"][d["t"].index("MENU →"):]; kk=k+1
            while not re.search(r"\.\s*$",s) and kk<len(L) and L[kk]["bold"] and kk<k+3:
                s+=" "+L[kk]["t"]; kk+=1
            s=re.sub(r"\[\s+","[",re.sub(r"\s+"," ",s))
            if s not in paths: paths.append(s)
    path=paths[0] if paths else None
    opts=[]; sect=False; secnames=[]; first_plain={}; labdesc={}
    for d in L[j:]:
        if d["bold"] and d["size"]>10.5:
            sect = d["t"].startswith("Подробности пунктов меню")
            if sect: secnames.append(d["t"]); cur=d["t"]
            continue
        if d["t"] in ("Примечание","Совет","См. также") : sect=False; continue
        if sect and not d["bold"] and cur not in first_plain: first_plain[cur]=d["t"]
        if sect and not d["bold"] and opts:
            labdesc.setdefault(opts[-1],[]).append(d["t"])
        if sect and d["bold"] and d["size"]<10.5 and not d["t"].startswith("MENU"):
            o=d["t"].rstrip(":").strip()
            if opts and opts[-1].endswith("/") and not labdesc.get(opts[-1]):
                opts[-1]=opts[-1]+" "+o if not o.startswith("/") else opts[-1]+o; continue
            if o.startswith("/"): o="APS-C S35"+o
            if re.match(r"(Если|Значения настроек|Количество пикселей|Част. кадров зап.\s+Параметры)",o): continue
            if o and o not in opts: opts.append(o)
    fallback=False
    if not opts:
        for d in L[j:]:
            if d["bold"] and d["size"]<10.5 and d["t"].endswith(":") and len(d["t"])<40 and not d["t"].startswith("MENU"):
                o=d["t"].rstrip(":").strip()
                if o not in opts: opts.append(o); fallback=True
    if not opts:
        for v in first_plain.values():
            if " / " in v and len(v)<120: opts=[x.strip() for x in v.split(" / ") if x.strip()]; break
    full=" ".join(x["t"] for x in L[j:] if not x["bold"])
    dflt=[]
    for m in re.finditer(r"[^.]*по умолчанию[^.]*\.",(" ".join(lead))+" "+full):
        s=m.group(0).strip()
        if len(s)<220 and s not in dflt: dflt.append(s)
    full_all=" ".join(x["t"] for x in L)
    rng=[m.group(0) for m in re.finditer(r"(?:в диапазоне |значение )от [^;]{2,40}? до [+\-–]?\d+(?:,\d+)?(?: ?EV)?(?: с шагом [\d/]+ ?EV)?",full_all)]
    r=dict(range=rng[:2],fallbackLabels=fallback,labelDesc={k:" ".join(v) for k,v in labdesc.items()},plain=" ".join(x["t"] for x in L),paths=paths,title=title,lead=" ".join(lead),help=sentences(" ".join(lead)),menuPath=path,options=opts,defaultNotes=dflt[:3],topicPages=[p+1 for p in pages])
    cache[pg]=r; return r
MODE={"c5df5e1bfb":"фото+видео+S&Q","e9926033de":"фото","fa20ed7421":"видео/S&Q"}
ICON={"7fde179f66":"фото","50bc3c43f5":"видео"}
res=[]
for t in raw["tabs"]:
    for g in t["groups"]:
        for it in g["items"]:
            it["mode"]=MODE.get(it.pop("modeDigest"))
            v=[ICON[x] for x in it["icons"] if x in ICON]
            it["variant"]=v[0] if v else None
            it["sepPhotoMovie"]="a29bbfe6c3" in it["icons"]
            d=parse(it["page"]); it["desc"]=d
            # sub-settings: bracket after the item's own bracket in any MENU path
            subs=[]
            key=it["name"].split(": ")[-1]
            for pth in d["paths"]:
                br=re.findall(r"\[([^\]]+)\]",pth)
                br=[b.strip() for b in br]
                for i2,b in enumerate(br):
                    if b==key and i2+1<len(br) and br[i2+1] not in subs: subs.append(br[i2+1])
            it["subSettings"]=subs
json.dump(raw,open(out,"w"),ensure_ascii=False,indent=1)
