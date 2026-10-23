# Рендер стикеров Пикселя в WEBM VP9 с альфой (512×512, 30 к/с). Claude, 23.10.2026.
# python3 render.py <out_dir> <lang ru|uk> [id ...]  |  --preview id -> PNG-лист кадров
import os, sys, subprocess, shutil, json, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
UK = {'Привет!': 'Привіт!', 'Щёлк!': 'Клац!', 'Огонь!': 'Вогонь!', 'Спасибо!': 'Дякую!', 'ну вот…': 'ну от…', 'Фыр!': 'Пфф!'}
FPS = 30
PAGE = '''<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Russo One';src:url(RussoOne-Regular.ttf)}
@font-face{font-family:'Montserrat';font-weight:600;src:url(Montserrat-SemiBold-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+2116}
@font-face{font-family:'Montserrat';font-weight:600;src:url(Montserrat-SemiBold-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+25CB,U+25CF}
html,body{margin:0;background:transparent}svg{display:block}</style>
<body><svg id="s" width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"></svg>
<div style="font-family:'Russo One';position:absolute;left:-999px">АБВ abc ЇІ</div><div style="font-family:Montserrat;font-weight:600;position:absolute;left:-999px">АБВ abc ЇІ</div>
<script src="cat.js"></script><script src="stickers.js"></script></body>'''

def main():
    args = sys.argv[1:]
    preview = '--preview' in args
    if preview:
        args.remove('--preview')
    out, lang, ids = args[0], args[1], args[2:]
    os.makedirs(out, exist_ok=True)
    open(os.path.join(HERE, '_r.html'), 'w', encoding='utf-8').write(PAGE)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 512, 'height': 512})
        pg.goto('file://' + os.path.join(HERE, '_r.html'))
        pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(400)
        lst = pg.evaluate('PXS.list.map(x=>({id:x.id,dur:x.dur,emoji:x.emoji}))')
        pg.evaluate('window.UK=' + json.dumps(UK, ensure_ascii=False) + ';window.tr=function(s,l){if(l!=="uk")return s;for(var k in UK)s=s.split(">"+k+"<").join(">"+UK[k]+"<");return s;}')
        res = {}
        for st in lst:
            if ids and st['id'] not in ids:
                continue
            n = int(round(st['dur'] * FPS))
            tmp = tempfile.mkdtemp()
            idx = [round(i * (n - 1) / 5) for i in range(6)] if preview else range(n)
            for k, i in enumerate(idx):
                pg.evaluate('([id,t,l])=>{var x=PXS.list.find(s=>s.id===id);document.getElementById("s").innerHTML=tr(x.draw(t),l);}', [st['id'], i / n, lang])
                pg.locator('#s').screenshot(path=os.path.join(tmp, 'f%03d.png' % k), omit_background=True)
            if preview:
                o = os.path.join(out, '%s-%s-preview.png' % (st['id'], lang))
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=#d9d3c7:s=1536x1024', '-framerate', '1', '-i', os.path.join(tmp, 'f%03d.png'),
                                '-filter_complex', '[1:v]tile=3x2[t];[0:v][t]overlay', '-frames:v', '1', o], check=True)
            else:
                o = os.path.join(out, st['id'] + '.webm')
                for crf in (30, 36, 42, 48):
                    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%03d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                                    '-b:v', '0', '-crf', str(crf), '-deadline', 'good', '-an', '-t', '3', o], check=True)
                    if os.path.getsize(o) <= 250 * 1024:
                        break
            shutil.rmtree(tmp)
            res[st['id']] = os.path.getsize(o)
            print(st['id'], st['emoji'], res[st['id']], flush=True)
        b.close()

main()
