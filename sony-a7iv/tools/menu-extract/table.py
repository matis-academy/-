# Шаг 1. Таблица «Поиск функций в MENU» (у α7 IV — стр. 95–104 PDF) → вкладки/группы/пункты.
# Читает геометрию страниц через PyMuPDF; номера страниц и значки режимов — под α7 IV, для другой камеры поправить.
# python3 -I table.py manual.pdf table-raw.json
import pymupdf,sys,json,re
doc=pymupdf.open(sys.argv[1]); out=sys.argv[2]
MODE={}
ICONS={}
def dig(info):
    d=info.get("digest"); return d.hex()[:10] if isinstance(d,(bytes,bytearray)) else str(d)[:10]
tabs=[]; cur_tab=None; cur_group=None
icon_examples={}
for pn in range(94,104):
    p=doc[pn]
    lines=[]
    for b in p.get_text("dict")["blocks"]:
        if b["type"]!=0: continue
        for l in b["lines"]:
            t="".join(s["text"] for s in l["spans"]).replace("\n"," ")
            if t.strip(): lines.append((l["bbox"],t))
    imgs=[(pymupdf.Rect(i["bbox"]),dig(i)) for i in p.get_image_info(xrefs=True)]
    links=[(l["from"],l.get("page")) for l in p.get_links() if l.get("page") is not None]
    hl=sorted(set(round(d["rect"].y0,1) for d in p.get_drawings() if d["rect"].x0<40 and 80<d["rect"].width<100 and d["rect"].height<2))
    # tab headings
    heads=[(bb,t) for bb,t in lines if t.strip().startswith("Вкладка")]
    tabnames=[(bb,t.strip()) for bb,t in lines if re.fullmatch(r"\(.+\)",t.strip())]
    gh=[bb[1] for bb,t in lines if t.strip()=="Группы"]
    top=gh[0] if pn==94 else 0
    # items
    events=[]
    for bb,t in heads:
        nm=[t2 for bb2,t2 in tabnames if abs(bb2[1]-bb[1])<6]
        events.append((bb[1],"tab",nm[0].strip("()") if nm else t))
    for bb,t in lines:
        x0,y0,x1,y1=bb
        if x0<124 and not t.strip().startswith(("Вкладка","Группы","*","Примечание","Порядок","Только","(")) and y0<800 and not re.fullmatch(r"\s*\d+\s*",t):
            if y0<top: continue
            events.append(((y0+y1)/2,"glabel",t.strip()))
    rows={}
    for bb,t in lines:
        x0,y0,x1,y1=bb
        if 180<x0<400 and t.strip() not in ("Пункты меню",) and y0<805 and "Copyright" not in t and not t.strip().startswith(("Только","(")):
            if y0<top+8: continue
            key=round((y0+y1)/2/4)
            # merge with existing row within 5pt
            k=next((k for k in rows if abs(k-(y0+y1)/2)<5),None)
            if k is None: k=(y0+y1)/2; rows[k]=[]
            rows[k].append((x0,"t",t))
    for r,dg in imgs:
        cy=(r.y0+r.y1)/2
        k=next((k for k in rows if abs(k-cy)<6),None)
        if r.x0>183 and k is not None:
            rows[k].append((r.x0,"i",dg))
        elif 125<r.x0<135 and k is not None:
            rows[k].append((0,"m",dg))
    for k,parts in rows.items():
        parts.sort()
        mode=[d for x,ty,d in parts if ty=="m"]
        name=" ".join(re.sub(r"\s+"," ",d).strip() for x,ty,d in parts if ty=="t").strip()
        name=re.sub(r"\s+"," ",name)
        icons=[d for x,ty,d in parts if ty=="i"]
        tgt=None
        for fr,pg in links:
            if fr.y0-3<k<fr.y1+3: tgt=pg
        events.append((k,"item",dict(name=name,modeDigest=mode[0] if mode else None,icons=icons,page=tgt+1 if tgt is not None else None,srcPage=pn+1)))
        for ic in icons: icon_examples.setdefault(ic,(pn+1,name))
    for y in hl: events.append((y,"line",None))
    events.sort(key=lambda e:(e[0],{"line":0,"tab":1,"glabel":2,"item":3}[e[1]]))
    # build cells: between lines
    cell_items=[]; cell_label=None
    def flush():
        global cur_group
        if not cell_items and cell_label is None: return
        if cell_label is not None:
            cur_group={"name":cell_label,"items":[]}; cur_tab["groups"].append(cur_group)
        for it in cell_items: cur_group["items"].append(it)
    for y,kind,v in events:
        if kind=="tab":
            flush(); cell_items=[]; cell_label=None
            cur_tab={"name":v,"groups":[]}; tabs.append(cur_tab); cur_group=None
        elif kind=="line":
            flush(); cell_items=[]; cell_label=None
        elif kind=="glabel":
            cell_label=v if cell_label is None else cell_label+" "+v
        elif kind=="item":
            cell_items.append(v)
    flush()
json.dump({"tabs":tabs,"iconExamples":icon_examples},open(out,"w"),ensure_ascii=False,indent=1)
for t in tabs:
    print("TAB",t["name"])
    for g in t["groups"]:
        print("  G",g["name"],len(g["items"]))
        for it in g["items"]: print("     ",it["modeDigest"],it["name"],it["icons"],it["page"])
print(icon_examples)
