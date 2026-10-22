# Шаг 7. help-*.json от агентов → shoot/menu-help.js (с проверкой, что ключи значений совпадают с меню).
# python3 -I merge_help.py helpwork ../../shoot/menu-help.js
# Сборка shoot/menu-help.js из helpwork/help-*.json с проверкой ключей
import json, sys, glob, os
wd, out = sys.argv[1], sys.argv[2]
items = {}
for f in glob.glob(os.path.join(wd, 'items-*.json')):
    for it in json.load(open(f)): items[it['id']] = it
help_ = {}
for f in sorted(glob.glob(os.path.join(wd, 'help-*.json'))):
    help_.update(json.load(open(f)))
missing = [i for i in items if i not in help_]
extra = [i for i in help_ if i not in items]
bad = []
res = {}
for i, h in help_.items():
    if i not in items: continue
    it = items[i]
    labels = set(it.get('opts') or []) | set(it.get('sub') or [])
    o = {k: v.strip() for k, v in (h.get('opts') or {}).items() if k in labels or k == '_range'}
    bad += [(i, k) for k in (h.get('opts') or {}) if k not in labels and k != '_range']
    e = {'what': h.get('what', '').strip(), 'use': h.get('use', '').strip()}
    if o: e['opts'] = o
    res[i] = e
print('items', len(items), 'help', len(res), 'missing', missing, 'extra', extra)
print('bad option keys', bad)
nolabels = [i for i, it in items.items() if it.get('opts') and it['kind'] == 'value' and i in res and not res[i].get('opts')]
print('value items without option texts', nolabels)
js = ('// Понятная справка к пунктам MENU для учеников: что это, когда менять, что значит каждое значение.\n'
      '// Составлено по «Справочному руководству ILCE-7M4»; собирается скриптом, не править вручную.\n'
      'export const HELP = ' + json.dumps(res, ensure_ascii=False, indent=0, separators=(',', ':')) + ';\n')
open(out, 'w').write(js)
print('bytes', len(js.encode()))
