import sys, re, json
from playwright.sync_api import sync_playwright
paths=[l.strip() for l in open(sys.argv[1]) if l.strip()]
res={}
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(locale='uk-UA',viewport={'width':1366,'height':900})
    for path in paths:
        pg=c.new_page()
        try:
            pg.goto('https://matis.academy/uk'+path+'?trpcrawl=2',wait_until='load',timeout=60000)
            for y in range(25): pg.mouse.wheel(0,900); pg.wait_for_timeout(100)
            pg.wait_for_timeout(3000)
            txt=pg.evaluate("document.body.innerText")
            lines=[l.strip() for l in txt.split('\n') if re.search('[А-Яа-яЁёІіЇїЄє]{3,}',l)]
            ru=[l for l in lines if re.search('[ЫыЭэЁёЪъ]',l)]
            res[path]=ru
            print(path,len(lines),'ru:',len(ru),'|',' / '.join(x[:50] for x in ru[:3]),flush=True)
        except Exception as e: print(path,'ERR',str(e)[:80],flush=True)
        pg.close()
    b.close()
json.dump(res,open('ru_left.json','w'),ensure_ascii=False,indent=1)
