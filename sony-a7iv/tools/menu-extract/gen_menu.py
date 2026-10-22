# Шаг 5. menu-tree.json → shoot/menu-data.js. Здесь же ручные правки (склеенные значения, контейнеры, действия).
# python3 -I gen_menu.py menu-tree.json ../../shoot/menu-data.js
# Генерация shoot/menu-data.js из menu-tree.json (выгрузка из «Справочного руководства ILCE-7M4», ru)
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))

ICONS = {'Съемка': 'shoot', 'Экспозиция/Цвет': 'exp', 'Фокус': 'af', 'Воспроизв.': 'play', 'Сеть': 'net', 'Настройка': 'setup', 'Мое меню': 'my'}
# пункты, у которых в выгрузке вместо значений перечислены вложенные настройки — на камере это отдельный экран
CONTAINERS = {'Коррекц. объект.', 'Замед.&уск.наст.', 'Парамет. прокси', 'Настр.файл/пап.', 'Информац. о IPTC', 'Инф. об авт. правах',
  'Настр-ки файла', 'Установки брекет.', 'Фун. интер.съем.', 'НастБесшумРеж.', 'Настр. устран.мерц.', 'Скор. удал. увел.',
  'Настр. внеш.вспыш.', 'Рег.настр.съем.всп.', 'Нас.час.п./даты/вр.', 'Парамет.сохр./загр', 'Настройки тачпада',
  'Пр. чтения с экрана', 'Настр. выв. HDMI', 'Противопыл. функ.', 'Слайд-шоу', 'Защита', 'Регистрация лиц', 'Слайд-шоу'}
# точные списки значений там, где в выгрузке они склеены или неполны
OPTS = {
  'Формат файла@photo': ['RAW', 'RAW и JPEG', 'JPEG'],
  'Тип файла RAW': ['Несжато', 'Сж.б/потер.(L)', 'Сж.б/потер.(M)', 'Сж.б/потер.(S)', 'Сжато'],
  'Качество JPEG': ['Сверхвысокое', 'Высокое', 'Стандартное', 'Легкий'],
  'Качество HEIF': ['Сверхвысокое', 'Высокое', 'Стандартное', 'Легкий'],
  'Разм.изобр.JPEG': ['L: 33M', 'M: 14M', 'S: 8.2M'],
  'Разм. изобр.HEIF': ['L: 33M', 'M: 14M', 'S: 8.2M'],
  'ISO AUTO мин. выд.': ['SLOWER (Длиннее)', 'SLOW (Медленная)', 'STD (Стандартная)', 'FAST (Быстрая)', 'FASTER (Короче)'],
  'Баланс белого': ['Авто', 'Авто: Атмосф.', 'Авто: Белый', 'Дневной свет', 'Тень', 'Облачно', 'Лампа накал.', 'Флуор.:Теп.бел.', 'Флуор.:Хол.бел',
                   'Флуор.: Дн.бел.', 'Флуор.: Дн.свет', 'Вспышка', 'Под водой Авто', 'Цв.тмп./Ф-тр.', 'Пользоват. 1', 'Пользоват. 2', 'Пользоват. 3'],
  'Бесшоковый WB': ['Выкл', '1 (Быстрый)', '2', '3 (Медленный)'],
  'Чувств. след. AF': ['5(Чувствител.)', '4', '3(Стандартн.)', '2', '1(Зафиксиров.)'],
  'Ск. перехода AF': ['7 (Быстро)', '6', '5', '4', '3', '2', '1 (Медленно)'],
  'ЧувсСдвОбъекAF': ['5(Чувствител.)', '4', '3', '2', '1(Зафиксиров.)'],
  'Область фокус.': ['Широкая', 'Зонная фокус.', 'Фиксац. центра', 'Пятно: S', 'Пятно: M', 'Пятно: L', 'Расшир. пятно', 'Отслеживание'],
  'Индекс изображ.': ['9 изображений', '30 изображений'],
  'Авто.просмотр': ['10 сек.', '5 сек.', '2 сек.', 'Выкл'],
  'Монит. авт.ВЫКЛ': ['Не отключается', '2 сек.', '5 сек.', '10 сек.', '1 мин.'],
  'Время нач. энергоз.': ['Выкл', '30 мин.', '5 мин.', '2 мин.', '1 мин.', '10 сек.'],
  'Оптим. Д-диап.': ['Выкл', 'Опт.Д-диап.: Авто'],
  'Творческий Вид': ['ST', 'PT', 'NT', 'VV', 'VV2', 'FL', 'IN', 'SH', 'BW', 'SE'],
  'Отобр. Зебры': ['Вкл', 'Выкл'],
  'Уровень Зебры': ['70', '75', '80', '85', '90', '95', '100', '100+'],
  'Отоб.выдел.конт': ['Вкл', 'Выкл'],
  'Ур. выдел. конт.': ['Высокий', 'Средний', 'Низкий'],
  'Цвет выдел.конт.': ['Красный', 'Желтый', 'Синий', 'Белый'],
  'Автом. лупа в MF': ['Вкл', 'Выкл'], 'AF в фокус. лупе': ['Вкл', 'Выкл'],
  'Наст.DISP(Отоб.эк.)': ['Показ. всю инф.', 'Не показывать', 'Гистограмма', 'Уровень'],
  'Коррек.экспоз.': None,      # значения подставляет приложение (±5 EV с шагом 1/3)
  'ISO': None,
  'Отоб.рам.лиц/гл': ['Вкл', 'Выкл'],
  'Шаг экспозиции': ['0,3 EV', '0,5 EV'],
  'Фокус. расст.': None,
  'Исх. увел. фокус.': ['x1,0', 'x5,5'],
  'Цвет.темп. видоиск.': ['-2', '-1', '±0', '+1', '+2'],
  'Параметры громк.': [str(i) for i in range(0, 16)],
  'Уров. записи звука': [str(i) for i in range(0, 32)],
}
DEF = {'Разм.изобр.JPEG': 'L: 33M', 'Разм. изобр.HEIF': 'L: 33M', 'Оптим. Д-диап.': 'Опт.Д-диап.: Авто', 'Формат файла@photo': 'JPEG',
       'ISO AUTO мин. выд.': 'STD (Стандартная)', 'Уровень Зебры': '70', 'Отоб.выдел.конт': 'Выкл', 'Отобр. Зебры': 'Выкл'}
ACTIONS = {'Форматировать', 'Заводск. настройка', 'Удалить', 'Добавить пункт', 'Сортировать пункт', 'Удалить пункт', 'Удалить страницу', 'Удалить все',
           'Восстан.БД изоб.', 'Показ.инф.о нос.', 'Модель', 'Увеличить', 'Оценка', 'Обрезать', 'Повернуть', 'Копировать', 'Фотосъемка', 'Создать папку'}

def clean(s):
    return re.sub(r'\s*\*\s*$', '', (s or '').strip())

drive_vals = []
tabs = []
for ti, t in enumerate(d['tabs']):
    tab = {'id': ICONS.get(t['name'], f't{ti}'), 'name': t['name'], 'groups': []}
    for gi, g in enumerate(t['groups']):
        grp = {'name': clean(g['name']), 'items': []}
        seen = {}
        for ii, it in enumerate(g['items']):
            name = clean(it['name'])
            mode = it.get('mode') or 'all'
            mode = 'movie' if mode.startswith('movie') else mode
            parent = None
            if ': ' in name and name.split(': ')[0] in ('Настр.кач-ва изобр.', 'Настр. зап.носит.', 'Режим протяжки'):
                parent, name = name.split(': ', 1)
            if parent == 'Режим протяжки':          # варианты протяжки — значения одного пункта
                drive_vals.append(name)
                if 'Режим протяжки' in seen: continue
                item = {'id': f'{tab["id"]}{gi}_{ii}', 'name': 'Режим протяжки', 'mode': 'photo', 'kind': 'value',
                        'help': clean(it.get('help')), 'page': it.get('page'), 'opts': drive_vals, 'def': 'Покадр. съемка'}
                seen['Режим протяжки'] = item; grp['items'].append(item); continue
            key = name + ('@photo' if name == 'Формат файла' and mode == 'photo' else '')
            opts = OPTS.get(key, OPTS.get(name, 'x'))
            if opts == 'x': opts = [clean(o) for o in (it.get('options') or []) if len(clean(o)) < 60]
            dflt = DEF.get(key) or ((it.get('defaults') or [{}])[0].get('default'))
            dflt = clean(dflt) if dflt else None
            kind = 'container' if name in CONTAINERS else 'action' if name in ACTIONS else 'value'
            if kind == 'value' and opts == []: kind = 'info'
            item = {'id': f'{tab["id"]}{gi}_{ii}', 'name': name, 'mode': mode, 'kind': kind, 'help': clean(it.get('help')), 'page': it.get('page')}
            if kind in ('value',): item['opts'] = opts; item['def'] = dflt if (opts is None or dflt in (opts or [])) else (opts[0] if opts else None)
            if kind in ('container', 'action'): item['sub'] = [clean(o) for o in (it.get('options') or [])]
            if it.get('range'): item['range'] = it['range']
            dup = name + '|' + (parent or '')
            if parent:
                par = seen.get(parent)
                if not par:
                    par = {'id': f'{tab["id"]}{gi}_{ii}p', 'name': parent, 'mode': 'all', 'kind': 'group', 'help': '', 'page': it.get('page'), 'children': []}
                    seen[parent] = par; grp['items'].append(par)
                if dup in seen and mode == 'movie': continue          # видео-дубликат того же пункта
                par['children'].append(item); seen[dup] = item
                if mode != 'movie' and par['mode'] == 'movie': par['mode'] = mode
                continue
            if dup in seen:
                if mode == 'movie': continue
                if seen[dup]['mode'] == 'movie':
                    grp['items'][grp['items'].index(seen[dup])] = item; seen[dup] = item; continue
            seen[dup] = item
            grp['items'].append(item)
        tab['groups'].append(grp)
    tabs.append(tab)

# Ручные правки там, где выгрузка из PDF неточна (сверено с текстом справочника)
LV_HELP = 'Устанавливает, показывать или нет на экране изображения, измененные коррекцией экспозиции, балансом белого, Творческим Видом и т.п.'
def walk(items):
    for i in items:
        yield i
        yield from walk(i.get('children', []))
for t in tabs:
    for g in t['groups']:
        names = {}
        for i in list(walk(g['items'])):
            n = i['name']; names[n] = names.get(n, 0) + 1
            if names[n] == 2 and n in ('Наст.пол.кл/диск', 'Запис. носитель'): i['mode'] = 'movie'
            if i['id'] == 'shoot0_12': i['name'] = 'APS-C S35/пол.кадр'
            if n in ('Выб.в кам.и отпр.', 'Настр. удал. съем.', 'Ф. "Удаленный ПК"', 'Руч. настр. тчк дост.', 'Безопасн. (IPsec)', 'Настр. моего диска'):
                i['kind'] = 'container'; i['sub'] = i.pop('opts'); i.pop('def', None)
            if n in ('Наст.переход изобр', 'Наст.зв. башм.', 'Ск.увел.польз.кл.'):
                i['kind'] = 'info'; i.pop('opts', None); i.pop('def', None)
            if n == 'Диапаз.частот Wi-Fi': i['opts'] = ['2,4GHz', '5GHz']; i['def'] = '2,4GHz'
            if n == 'Наст.Отоб.Live View':
                i.pop('opts', None); i.pop('def', None); i['kind'] = 'group'; i['help'] = LV_HELP
                i['children'] = [
                  {'id': i['id'] + 'a', 'name': 'Отображ. Live View', 'mode': 'photo', 'kind': 'value', 'page': i['page'], 'opts': ['Отобр. парам.ВКЛ', 'Отоб.парам.ВЫКЛ'], 'def': 'Отобр. парам.ВКЛ',
                   'help': 'Отражать ли все настройки съемки на мониторе, чтобы Live View был близок к снимку, или показывать Live View без отражения настроек. При ВЫКЛ на экране появляется значок VIEW.'},
                  {'id': i['id'] + 'b', 'name': 'Эффект экспоз.', 'mode': 'photo', 'kind': 'value', 'page': i['page'], 'opts': ['Настр. эксп. и всп.', 'Тлк. настр. экспоз.'], 'def': 'Настр. эксп. и всп.',
                   'help': 'Учитывать ли в Live View экспозицию вспышки (только вспышки Sony).'},
                  {'id': i['id'] + 'c', 'name': 'Ниж.пр.част.кад.', 'mode': 'photo', 'kind': 'value', 'page': i['page'], 'opts': ['Вкл', 'Выкл'], 'def': 'Выкл',
                   'help': 'Не давать частоте кадров Live View сильно падать в темноте; изображение при этом может потемнеть.'}]

js = ('// Меню α7 IV: вкладки, группы, пункты и значения по «Справочному руководству ILCE-7M4» (рус.).\n'
      '// Сгенерировано из выгрузки справочника; page — страница справочника. Не редактировать вручную.\n'
      'export const MENU_TABS = ' + json.dumps(tabs, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'export const KEY_DEFAULTS = ' + json.dumps(d.get('customKeyDefaults'), ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out, 'w').write(js)
n = sum(len(g['items']) + sum(len(i.get('children', [])) for i in g['items']) for t in tabs for g in t['groups'])
print('tabs', len(tabs), 'groups', sum(len(t['groups']) for t in tabs), 'entries', n, 'bytes', len(js.encode()))
for t in tabs:
    for g in t['groups']:
        for i in g['items']:
            if i['kind'] == 'value' and i.get('def') is None and i.get('opts'): print('no default:', t['name'], '/', i['name'])
