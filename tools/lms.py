import json, re, sys
from playwright.sync_api import sync_playwright
ck=json.load(open('ck.json'))  # cookies тестового студента: [[name,value],...] (wp_generate_auth_cookie), не коммитить
L="1108 1110 1108 1111 1108 1112 1113 1115 1113 1119 1113 1126 1113 1133 1113 1137 1113 1144 1113 1149 1113 1154 1113 1159 1113 1116 1113 1120 1113 1127 1113 1134 1113 1138 1113 1145 1113 1150 1113 1155 1113 1160 1113 1117 1113 1121 1113 1128 1113 1135 1113 1139 1113 1146 1113 1151 1113 1156 1113 1161 1113 1122 1113 1129 1113 1140 1113 1147 1113 1152 1113 1157 1113 1162 1113 1123 1113 1130 1113 1141 1113 1163 1113 1124 1113 1131 1113 1142".split()
slug={'1108':'mini-course-lms-test','1113':'professiya-videograf'}
urls=['/uk/account/','/uk/account/#/courses','/uk/account/#/profile','/uk/account/#/order-history']
urls+=['/uk/learn/course/%s/#/course/%s/lesson/%s'%(slug[L[i]],L[i],L[i+1]) for i in range(0,len(L),2)]
if len(sys.argv)>1: urls=urls[:int(sys.argv[1])]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(locale='uk-UA',viewport={'width':1366,'height':900})
    c.add_cookies([{'name':n,'value':v,'domain':'matis.academy','path':'/','secure':True,'httpOnly':True} for n,v in ck])
    for u in urls:
        pg=c.new_page()
        try:
            pg.goto('https://matis.academy'+u,wait_until='load',timeout=60000); pg.wait_for_timeout(6000)
            for y in range(15): pg.mouse.wheel(0,900); pg.wait_for_timeout(120)
            pg.wait_for_timeout(2500)
            t=pg.evaluate("document.body.innerText"); lines=[l for l in t.split('\n') if re.search('[А-Яа-яЁёІіЇїЄє]{3,}',l)]
            ru=[l for l in lines if re.search('[ЫыЭэЁёЪъ]',l)]
            print(u, pg.url[-60:], 'lines',len(lines),'ru',len(ru),'|',' / '.join(x[:40] for x in lines[:4]),flush=True)
        except Exception as e: print(u,'ERR',str(e)[:80],flush=True)
        pg.close()
    b.close()
