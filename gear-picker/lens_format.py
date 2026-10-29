"""Формат объектива: 'ff' (полный кадр), 'apsc' (кроп), 'mf' (средний формат GFX).
Порядок: ручные исправления → маркировка APS-C → маркировка полного кадра → разметка e-каталога."""
import re
FIX={
 # e-каталог ошибается
 'Sigma 28-45mm f/1.8 Art HSM DC':'ff','Viltrox AF 85mm f/1.8 II':'ff','Viltrox AF 85mm f/1.8':'ff','Viltrox AF 85mm f/2.0 Evo':'ff',
 'Nikon 8-15mm f/3.5-4.5E AF-S ED Nikkor-Fisheye':'ff','Sony 16-35mm f/4 ZA FE OSS Vario-Tessar T*':'ff',
 'SIRUI 23mm f/1.2':'apsc','SIRUI 33mm f/1.2':'apsc','TTArtisan 27mm f/2.8':'apsc',
 'Sony 18-135mm f/3.5-5.6 G FE OSS':'apsc','Tamron 18-200mm f/3.5-6.3 VC Di III':'apsc',
 'Nikon 40mm f/2.8G AF-S Micro-Nikkor':'apsc',
}
APSC=re.compile(r'\b(DC|DT|DX)\b|Di III-A|Di II\b|RF-S|EF-S|EF-M|Touit|OSS LE')
def lens_format(l):
    n=l['name']; m=l['mounts']
    if all(x=='Fujifilm G' for x in m): return 'mf'
    if all(x=='Fujifilm X' for x in m): return 'apsc'
    if n in FIX: return FIX[n]
    if APSC.search(n): return 'apsc'
    if l['brand']=='Sony' and re.search(r'\bE\b',n) and not re.search(r'\bFE\b',n): return 'apsc'
    if re.search(r'\bFE\b|\bDG\b',n): return 'ff'
    if l['brand']=='Panasonic': return 'ff'
    if l['brand']=='Canon' and re.search(r'\b(RF|EF)\b',n): return 'ff'
    if l['brand']=='Nikon' and re.search(r'\bZ\b|AF-S|AF-P',n): return 'ff'
    return 'ff' if l['ff'] else 'apsc'
