"""Сборка данных страницы (v2): bundle/ (с ПК) + img/*.webp (после cutout.py) -> site/data/*.json
Курс НБУ — USD ниже; цены новых камер — минимальные на ek.ua, если не набор с объективом и не дальше ×0,55…1,8 от ориентира."""
import json,base64,os,re
from lens_format import lens_format
B='bundle/data/'; USD=45.5923
cams=json.load(open('cameras.json',encoding='utf-8')); ek=json.load(open(B+'cams_ek.json',encoding='utf-8'))
def uri(kind,key):
    p='img/%s__%s.webp'%(kind,key)
    if not os.path.exists(p): return None
    return p if os.environ.get('GP_URLS') else 'data:image/webp;base64,'+base64.b64encode(open(p,'rb').read()).decode()
out=[]
for c in cams['cameras']:
    key=c['brand']+' '+c['model']; e=ek.get(key); slug=re.sub(r'[^a-z0-9]+','-',key.lower()).strip('-')
    c=dict(c); c['img']=uri('cam',slug); c['url']=('https://ek.ua'+e['url']) if e else None; c['priceSrc']='est'
    if c['avail']=='new' and e and e.get('pmin') and not e.get('kit'):
        p=round(e['pmin']/USD)
        if 0.55*c['price']<=p<=1.8*c['price']: c['price']=p; c['priceSrc']='ek'
    out.append(c)
OUT=os.environ.get('GP_OUT','site/data'); os.makedirs(OUT,exist_ok=True); json.dump(out,open(OUT+'/cams.json','w'),ensure_ascii=False,separators=(',',':'))
lens=json.load(open(B+'lenses.json',encoding='utf-8'))
FILE={'Sony E':'sony-e','Canon RF':'canon','Canon RF-S':'canon','Canon EF':'canon','Canon EF-S':'canon','Canon EF-M':'canon','Nikon Z':'nikon','Nikon F':'nikon','Fujifilm X':'fuji','Fujifilm G':'fuji','L-Mount':'l-mount'}
groups={}
for l in lens:
    l=dict(l); l['img']=uri('lens',l['id']); l['fmt']=lens_format(l)
    for f in sorted({FILE[m] for m in l['mounts']}): groups.setdefault(f,[]).append(l)
for f,L in groups.items(): json.dump(L,open(OUT+'/lenses-%s.json'%f,'w'),ensure_ascii=False,separators=(',',':'))
cards=json.load(open(B+'cards.json',encoding='utf-8'))
for k in cards: k['img']=uri('card',k['id'])
json.dump(cards,open(OUT+'/cards.json','w'),ensure_ascii=False,separators=(',',':'))
fix={'DJI RS 4 Pro':4500,'Zhiyun Weebill-S':3000,'Zhiyun Crane 3S':6500}  # нагрузка по данным производителя
G=[]
for x in json.load(open(B+'gimbals.json',encoding='utf-8')):
    if 'Lab Creator' in x['name']: continue
    if x['name'] in fix: x['payload']=fix[x['name']]
    x['img']=uri('gimbal',x['id']); G.append(x)
json.dump(G,open(OUT+'/gimbals.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(dict(usd=USD,usdDate='29.10.2026',date='28.10.2026',excluded=cams['excluded'],lensCount=len(lens)),open(OUT+'/meta.json','w'),ensure_ascii=False)
