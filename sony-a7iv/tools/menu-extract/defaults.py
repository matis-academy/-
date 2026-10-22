# Шаг 3. «Список значений настроек по умолчанию» (у α7 IV — стр. 499–513) → заводские значения.
# python3 -I defaults.py manual.pdf defaults-raw.json
import pymupdf,sys,json,re
doc=pymupdf.open(sys.argv[1]); out=sys.argv[2]
def dig(i):
    d=i.get("digest"); return d.hex()[:10]
VAR={"7fde179f66":"фото","50bc3c43f5":"видео"}
rows=[]; tab=None
for pn in range(498,516):
    p=doc[pn]
    D=[dr["rect"] for dr in p.get_drawings()]
    hl=sorted(set(round(r.y0) for r in D if r.height<1.5 and r.x0<40 and r.width>100 and r.y0>20))
    vx=sorted(set(round(r.x0) for r in D if r.width<1.5 and r.height>5 and r.y0>20))
    vx=[x for i,x in enumerate(vx) if i==0 or x-vx[i-1]>5]
    if len(vx)<3: continue
    X1,X2=vx[1]-5,vx[2]-5
    L=[]
    for b in p.get_text("dict")["blocks"]:
        if b["type"]!=0: continue
        for l in b["lines"]:
            t="".join(s["text"] for s in l["spans"]).replace("\n"," ").strip()
            if t: L.append((l["bbox"],t))
    imgs=[(pymupdf.Rect(i["bbox"]),dig(i)) for i in p.get_image_info(xrefs=True)]
    # tab headings: lines like "(Съемка)" outside table at x<200
    for i in range(len(hl)-1):
        y0,y1=hl[i],hl[i+1]
        if y1-y0>120: continue
        c1=[(bb,t) for bb,t in L if y0<(bb[1]+bb[3])/2<y1 and bb[0]<X1]
        c2=[(bb,t) for bb,t in L if y0<(bb[1]+bb[3])/2<y1 and X1<=bb[0]<X2]
        c3=[(bb,t) for bb,t in L if y0<(bb[1]+bb[3])/2<y1 and bb[0]>=X2]
        ic=[(r,d) for r,d in imgs if y0<(r.y0+r.y1)/2<y1]
        name=" ".join(t for bb,t in sorted(c1,key=lambda x:(round(x[0][1]),x[0][0])))
        name=re.sub(r"\s+"," ",name).replace("( ","(").replace("[ ","[")
        if not name or name.startswith("Пункты MENU"): continue
        if re.fullmatch(r"\(.+\)",name): continue
        val=re.sub(r"\s+"," "," ".join(t for bb,t in sorted(c2,key=lambda x:(round(x[0][1]),x[0][0])))).strip()
        if not val and c3: val=re.sub(r"\s+"," "," ".join(t for bb,t in c3)).strip(); c3=[]
        var=[VAR[d] for r,d in ic if r.x0<X1 and d in VAR]
        reset=[d for r,d in ic if r.x0>=X2]
        rows.append(dict(page=pn+1,y=y0,name=name,default=val,variant=var[0] if var else None,resetIcon=bool(reset) or bool(c3),c3=" ".join(t for _,t in c3)))
    # tab headers
    for bb,t in L:
        m=re.fullmatch(r"\((Съемка|Экспозиция/Цвет|Фокус|Воспроизв.|Сеть|Настройка|Мое меню)\)",t)
        if m: rows.append(dict(page=pn+1,y=bb[1],tabHeader=m.group(1)))
rows.sort(key=lambda r:(r["page"],r["y"]))
json.dump(rows,open(out,"w"),ensure_ascii=False,indent=0)
print(len(rows))
for r in rows: print(r.get("tabHeader") or f'{r["name"][:75]:75} | {r["default"]} | {r["variant"]} | {r["c3"]}')
