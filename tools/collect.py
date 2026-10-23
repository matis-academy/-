import json, re, sys
from playwright.sync_api import sync_playwright
JS = r"""() => { const tc=" \t\n\r\u000b ﻿"; const tr=s=>{let a=0,b=s.length;while(a<b&&tc.includes(s[a]))a++;while(b>a&&tc.includes(s[b-1]))b--;return s.slice(a,b)};
 const out=new Set(); const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let n; while(n=w.nextNode()){ const p=n.parentElement; if(!p) continue; if(p.closest('script,style,noscript,textarea,[data-no-translation],.mlg,#wpadminbar')) continue;
   const t=tr(n.nodeValue); if(t && /[А-Яа-яЁё]/.test(t)) out.add(t); }
 document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e=>{ if(e.closest('[data-no-translation]')) return; ['placeholder','title','aria-label'].forEach(a=>{const v=e.getAttribute(a); if(v&&/[А-Яа-яЁё]/.test(v)) out.add(tr(v));});});
 return [...out]; }"""
urls=[l.strip() for l in open(sys.argv[1]) if l.strip()]
ck=json.load(open('ck.json')) if len(sys.argv)>2 else None
allS=set()
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(locale='ru-RU',viewport={'width':1366,'height':900})
    if ck: c.add_cookies([{'name':n,'value':v,'domain':'matis.academy','path':'/','secure':True,'httpOnly':True} for n,v in ck])
    for u in urls:
        pg=c.new_page()
        try:
            pg.goto('https://matis.academy'+u+('' if '#' in u else '?nolang=1'),wait_until='load',timeout=60000); pg.wait_for_timeout(4000 if ck else 1500)
            for y in range(25): pg.mouse.wheel(0,900); pg.wait_for_timeout(100)
            pg.wait_for_timeout(2000)
            # click through interactive trainer buttons a bit to reveal states
            s=pg.evaluate(JS); allS.update(s); print(u,len(s),flush=True)
        except Exception as e: print(u,'ERR',str(e)[:80],flush=True)
        pg.close()
    b.close()
json.dump(sorted(allS),open(sys.argv[1]+'.strings.json','w'),ensure_ascii=False)
print('TOTAL',len(allS))
