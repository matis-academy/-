import sys, time
from playwright.sync_api import sync_playwright
paths = [l.strip() for l in open(sys.argv[1]) if l.strip()]
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(locale='uk-UA', viewport={'width': 1366, 'height': 900})
    for path in paths:
        pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:120]))
        t = time.time()
        try:
            r = pg.goto('https://matis.academy/uk' + path + '?trpcrawl=' + str(int(t)), wait_until='load', timeout=60000)
            for y in range(0, 30):
                pg.mouse.wheel(0, 900); pg.wait_for_timeout(120)
            pg.wait_for_timeout(2500)
            print(path, r.status, round(time.time() - t, 1), pg.evaluate('document.documentElement.lang'), errs[:2], flush=True)
        except Exception as e:
            print(path, 'ERR', str(e)[:100], flush=True)
        pg.close()
    b.close()
