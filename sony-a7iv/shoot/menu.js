// MENU и Fn камеры α7 IV. Структура, названия, значения и справка — из «Справочного руководства ILCE-7M4»
// (menu-data.js); значки и оформление свои. Пункты, которые влияют на картинку симулятора, связаны
// с состоянием S через привязки (makeBindings), остальные просто запоминают выбранное значение.
import * as O from './optics.js?v=3';
import { MENU_TABS, KEY_DEFAULTS } from './menu-data.js?v=2';
import { HELP } from './menu-help.js?v=1';

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  shoot: svg('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>'),
  exp: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M7 9h4M9 7v4M13 15h4"/><path d="M20 4L4 20"/>'),
  af: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
  play: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'),
  net: svg('<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.5 7.5 0 0 1 11 0M9.5 16a3.2 3.2 0 0 1 5 0"/><circle cx="12" cy="18.6" r="1" fill="currentColor"/>'),
  setup: svg('<rect x="3.5" y="7" width="17" height="12" rx="1.5"/><path d="M9 7V5h6v2M3.5 12h17M11 12v2h2v-2"/>'),
  my: svg('<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>'),
};
const SHORT = { shoot: 'Съемка', exp: 'Эксп./цвет', af: 'Фокус', play: 'Воспр.', net: 'Сеть', setup: 'Настр.', my: 'Мое меню' };

// Все пункты по id (с вложенными)
const INDEX = new Map();
for (const t of MENU_TABS) t.groups.forEach((g, gi) => (function walk(items) { for (const it of items) { INDEX.set(it.id, { it, tab: t, group: gi }); if (it.children) walk(it.children); } })(g.items));

export const FN_DEFAULT = ['af0_0', 'af1_0', 'af2_0', 'exp1_0', 'exp0_1', 'exp2_0', 'exp4_0', 'exp5_1', 'shoot5_0', 'shoot9_0', 'exp6_0', 'af4_0'];
const STORE = 'a7sim-menu';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ───────────── Привязки пунктов меню к симулятору ─────────────
// api: { S, set(key, value), act(name, arg) }. X — сохранённые значения пунктов без привязки и «память» подписей.
export function makeBindings(api, X) {
  const S = api.S, B = {};
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b);
  // несколько подписей могут вести к одному значению: показываем ту, что выбрали последней
  const map = (id, key, table, extra = {}) => {
    B[id] = {
      key,
      opts: () => Object.keys(table),
      get: () => {
        const mem = X.vals[id];
        if (mem in table && same(table[mem], S[key])) return mem;
        return Object.keys(table).find((l) => same(table[l], S[key])) ?? String(S[key]);
      },
      set: (l) => { X.vals[id] = l; api.set(key, table[l]); },
      ...extra,
    };
  };
  const onOff = { Вкл: true, Выкл: false };
  const tbl = (labels, values) => Object.fromEntries(labels.map((l, i) => [l, values[i]]));

  map('shoot0_1', 'fileFormat', { RAW: 'RAW', 'RAW и JPEG': 'RAW+JPEG', JPEG: 'JPEG' },
    { sim: 'Симулятор сохраняет снимок в JPEG; RAW отмечается в разборе кадра.' });
  map('shoot0_5', 'jpegSize', { 'L: 33M': 'L', 'M: 14M': 'M', 'S: 8.2M': 'S' }, { sim: 'Меняет размер сохранённого снимка.' });
  map('shoot0_7', 'aspect', tbl(['3:2', '4:3', '16:9', '1:1'], ['3:2', '4:3', '16:9', '1:1']), { sim: 'Видоискатель показывает рамку, снимок обрезается.' });
  map('shoot0_14', 'nr', { Нормальная: 1, Низкий: 1.35, Выкл: 1.8 }, { sim: 'Чем слабее шумоподавление, тем заметнее шум на высоких ISO.' });
  map('shoot5_0', 'drive', tbl(['Покадр. съемка', 'Непрер. съемка', 'А/спуск (Один)', 'А/спуск (непр.)', 'Непрер. брекет.', 'Покадр. брекет.', 'Брекетинг WB', 'Брекетинг DRO'],
    ['single', 'burst', 'timer', 'timerC', 'bracketC', 'bracketS', 'bracketWB', 'bracketDRO']), {
    sim: 'Работают все режимы: серия, автоспуск, брекетинг экспозиции, баланса белого и DRO.',
    after: () => {
      const d = S.drive, out = [];
      if (d === 'burst') out.push({ id: 'x_burst', name: 'Скорость серии', help: 'На камере выбирается кнопками ◀▶ прямо в списке режимов протяжки. Hi+ — до 10 кадров/с.', opts: ['Hi+', 'Hi', 'Mid', 'Lo'], def: 'Hi' });
      if (d === 'timer' || d === 'timerC') out.push({ id: 'x_timer', name: 'Задержка автоспуска', help: 'На камере выбирается кнопками ◀▶ в списке режимов протяжки.', opts: ['10 сек.', '5 сек.', '2 сек.'], def: '10 сек.' });
      if (d === 'bracketC' || d === 'bracketS') out.push({ id: 'x_brk', name: 'Шаг брекетинга', help: 'Три кадра: 0, −шаг, +шаг. На камере выбирается кнопками ◀▶ в списке режимов протяжки.', opts: ['0,3EV', '0,5EV', '0,7EV', '1,0EV', '2,0EV', '3,0EV'], def: '0,3EV' });
      return out;
    },
  });
  map('x_burst', 'burstFps', { 'Hi+': 10, Hi: 8, Mid: 6, Lo: 3 }, { help: {
    what: 'Сколько кадров в секунду снимает камера, пока зажата кнопка спуска в режиме «Непрер. съемка».',
    use: 'Быстрее — больше шансов поймать удачный момент в спорте и с детьми, но больше лишних кадров. Для неспешной серии хватит Mid или Lo.',
    opts: { 'Hi+': 'Максимальная скорость, до 10 кадров в секунду.', Hi: 'Высокая скорость, около 8 кадров в секунду.', Mid: 'Средняя скорость, около 6 кадров в секунду.', Lo: 'Низкая скорость, около 3 кадров в секунду.' } } });
  map('x_timer', 'timerSec', { '10 сек.': 10, '5 сек.': 5, '2 сек.': 2 }, { help: {
    what: 'Через сколько секунд после нажатия кнопки спуска камера сделает снимок.',
    use: '10 секунд — чтобы успеть встать в кадр самому. 2 секунды — чтобы камера на штативе успокоилась после нажатия и снимок не смазался.',
    opts: { '10 сек.': 'Успеете добежать и встать в кадр.', '5 сек.': 'Промежуточный вариант.', '2 сек.': 'Для штатива: убирает дрожь от нажатия кнопки.' } } });
  map('x_brk', 'brStep', { '0,3EV': 1 / 3, '0,5EV': 0.5, '0,7EV': 2 / 3, '1,0EV': 1, '2,0EV': 2, '3,0EV': 3 }, { help: {
    what: 'На сколько ступеней экспозиции отличаются кадры брекетинга: обычный, темнее и светлее.',
    use: 'Маленький шаг — чтобы выбрать лучший из похожих кадров. Большой (2–3 EV) — чтобы потом склеить HDR из тёмного, нормального и светлого кадра.',
    opts: { '0,3EV': 'Почти незаметная разница — страховка экспозиции.', '1,0EV': 'Заметная разница: в два раза темнее и в два раза светлее.', '2,0EV': 'Сильная разница — для HDR в контрастной сцене.', '3,0EV': 'Очень сильная разница — для HDR с солнцем в кадре.' } } });
  map('shoot9_0', 'steady', onOff, { sim: 'Стабилизатор: до 5,5 ступени выдержки с рук.' });
  map('shoot11_0', 'gridOn', onOff, { sim: 'Линии сетки поверх кадра.' });
  map('shoot11_1', 'grid', { 'Сетка 3x3': 'thirds', 'Квадратн. сетка': 'square', 'Диаг.+квад.сет.': 'diag' }, { sim: 'Вид сетки.' });
  map('shoot11_2a', 'lvOff', { 'Отобр. парам.ВКЛ': false, 'Отоб.парам.ВЫКЛ': true }, { sim: 'При ВЫКЛ видоискатель всегда показывает «правильную» яркость без баланса белого и стиля — снимок может отличаться.' });
  map('exp0_1', 'iso', Object.fromEntries([['ISO AUTO', 'AUTO'], ...O.ISOS.map((v) => [String(v), v])]), { sim: 'Чувствительность: светлее и шумнее.' });
  map('exp0_3', 'autoMinSS', { 'SLOWER (Длиннее)': 'slower', 'SLOW (Медленная)': 'slow', 'STD (Стандартная)': 'std', 'FAST (Быстрая)': 'fast', 'FASTER (Короче)': 'faster' },
    { sim: 'Порог выдержки, после которого ISO AUTO поднимает ISO: STD — 1/f, SLOW — 1/(f/2), SLOWER — 1/(f/4), FAST — 1/(2f), FASTER — 1/(4f).' });
  map('exp1_0', 'ec', Object.fromEntries(O.ECS.map((v) => [O.fmtEV(v), v])), { sim: 'Сдвигает экспозицию автоматических режимов.' });
  map('exp2_0', 'meter', { Мульти: 'multi', Центр: 'center', Точечный: 'spot', 'Сред. всего экр.': 'average', Выделение: 'highlight' }, { sim: 'По-разному взвешивает яркость кадра.' });
  map('exp2_2', 'spotLink', { Центр: 'center', 'Подкл. тчк.фок.': 'focus' }, { sim: 'Где мерить свет в точечном режиме.' });
  map('exp4_0', 'wb', tbl(MENU_ITEM('exp4_0').opts, ['AWB', 'AWBa', 'AWBw', 'day', 'shade', 'cloudy', 'tungsten', 'fluorWW', 'fluorCW', 'fluorDW', 'fluorD', 'flash', 'uw', 'K', 'c1', 'c2', 'c3']), {
    sim: 'Пересчитывает цвета снимка. «Пользоват.» в симуляторе — как будто вы замерили баланс по серой карте под светом сцены.',
    after: () => (S.wb === 'K' ? [{ id: 'x_wbk', name: 'Цв. температура', help: 'На камере значение выбирается кнопкой ▶ у пункта «Цв.тмп./Ф-тр.». 2500–9900 K.', opts: [2500, 2800, 3000, 3200, 3600, 4000, 4500, 5000, 5500, 6000, 6500, 7500, 8500, 9900].map((k) => `${k}K`), def: '5500K' }] : []),
  });
  map('x_wbk', 'wbK', Object.fromEntries([2500, 2800, 3000, 3200, 3600, 4000, 4500, 5000, 5500, 6000, 6500, 7500, 8500, 9900].map((k) => [`${k}K`, k])), { help: {
    what: 'Цветовая температура в кельвинах (K), под которую настроен баланс белого.',
    use: 'Ставьте число, равное температуре света: лампа накаливания ≈ 3200 K, день ≈ 5500 K, тень ≈ 7500 K. Меньше число — снимок холоднее (синее), больше — теплее (желтее).',
    opts: { _range: '2500 K — убирает очень тёплый свет свечей и натриевых фонарей; 5500 K — дневной свет; 9900 K — сильно затенённые места и пасмурное небо.' } } });
  map('exp4_1', 'awbPri', { Стандартная: 'std', Атмосфера: 'amb', Белый: 'white' }, { sim: 'Сколько «тёплого» света оставляет AWB.' });
  map('exp5_0', 'dro', { Выкл: false, 'Опт.Д-диап.: Авто': true }, { sim: 'Вытягивает тени.' });
  map('exp5_1', 'look', tbl(MENU_ITEM('exp5_1').opts, MENU_ITEM('exp5_1').opts), { sim: 'Стиль цвета и контраста.' });
  map('exp6_0', 'zebraOn', onOff, { sim: 'Штриховка ярких мест в видоискателе.' });
  map('exp6_1', 'zebraLvl', { 70: 70, 75: 75, 80: 80, 85: 85, 90: 90, 95: 95, 100: 100, '100+': 101 }, { sim: 'Порог яркости зебры.' });
  map('af0_0', 'fm', { 'Покадровый AF': 'AF-S', 'Автоматич. AF': 'AF-A', 'Непрерывн. AF': 'AF-C', DMF: 'DMF', 'Ручной фокус': 'MF' },
    { sim: 'AF-A сам переходит в AF-C, когда объект движется. DMF фокусирует как AF-S.' });
  map('af1_0', 'area', { Широкая: 'wide', 'Зонная фокус.': 'zone', 'Фиксац. центра': 'center', 'Пятно: S': 'spotS', 'Пятно: M': 'point', 'Пятно: L': 'spotL', 'Расшир. пятно': 'spotX', Отслеживание: 'track' },
    { sim: 'Как камера выбирает, на что фокусироваться.' });
  map('af1_3', 'focusColor', { Белый: 'white', Красный: 'red' }, { sim: 'Цвет рамки фокусировки.' });
  map('af2_0', 'eyeAF', onOff, { sim: 'Камера находит глаз и фокусируется на нём.' });
  map('af2_1', 'eyeSubj', { Человек: 'human', Животное: 'animal', Птица: 'bird' }, { sim: 'В сценах только люди: при «Животное» и «Птица» глаз не найдётся.' });
  map('af4_0', 'peakOn', onOff, { sim: 'Подсветка резких контуров.' });
  map('af4_1', 'peakLvl', { Высокий: 0.6, Средний: 1, Низкий: 1.5 }, { sim: 'Чем выше уровень, тем больше контуров подсвечено.' });
  map('af4_2', 'peakColor', { Красный: 'red', Желтый: 'yellow', Синий: 'blue', Белый: 'white' }, { sim: 'Цвет подсветки контуров.' });
  map('setup2_5', 'disp', { 'Показ. всю инф.': 'all', 'Не показывать': 'none', Гистограмма: 'hist', Уровень: 'level' },
    { sim: 'На камере здесь отмечают экраны, между которыми переключает кнопка DISP; в симуляторе пункт сразу выбирает экран.' });
  map('setup4_0', 'touch', { Вкл: 'on', 'Вкл: Тлк. воспр.': 'play', Выкл: 'off' }, { sim: 'Касание кадра в симуляторе — это касание экрана камеры.' });
  map('setup4_3', 'touchFn', { 'Сенсорн. фокус': 'focus', 'Сенс. отслежив.': 'track', 'Сенсорн.затвор': 'shutter', Выкл: 'off' }, { sim: 'Что делает касание кадра.' });
  map('setup7_4', 'review', { '10 сек.': 10, '5 сек.': 5, '2 сек.': 2, Выкл: 0 }, { sim: 'Показ снимка сразу после съемки.' });
  map('setup9_2', 'beep', onOff, { sim: 'Сигнал фокусировки.' });

  // разделы с вложенными пунктами
  B.shoot0_1p = { help: { what: 'Раздел качества снимка: формат файла (RAW или JPEG), тип RAW, качество и размер JPEG/HEIF.', use: 'Загляните сюда, чтобы решить, в каком виде камера сохранит снимок: RAW — для обработки в редакторе, JPEG — чтобы сразу показать или опубликовать.' } };
  B.shoot1_1p = { help: { what: 'Раздел выбора карты памяти: в какое гнездо записывать фото и видео и переходить ли автоматически на вторую карту.', use: 'Нужно, если в камере две карты: можно писать на обе сразу для надёжности или продолжать на второй, когда первая заполнится.' } };
  B.shoot11_2 = { help: { what: 'Как экран показывает картинку: с учётом настроек (экспокоррекция, баланс белого, Творческий Вид) или всегда в «нормальной» яркости.', use: 'Обычно оставляют отображение настроек — тогда на экране видно, каким выйдет снимок. Выключают при студийной вспышке, когда без неё экран слишком тёмный.' } };
  // значения, которые подставляет приложение
  B.shoot9_3 = { opts: () => ['8mm', '10mm', '12mm', '16mm', '20mm', '24mm', '28mm', '35mm', '50mm', '70mm', '85mm', '100mm', '135mm', '200mm', '300mm', '400mm', '500mm', '1000mm'] };

  // действия
  const confirm = (title, run) => ({ confirm: title, run });
  B.shoot1_0 = { act: () => confirm('Все снимки на карте будут удалены. Форматировать?', () => api.act('clear')), sim: 'Очищает галерею снимков.' };
  B.play1_0 = { act: () => api.act('gallery'), sim: 'Открывает последний снимок.' };
  B.play3_0 = {
    sim: 'Удаляет снимки из галереи.',
    sub: (name) => confirm(name === 'Все, кроме дан. изобр.' ? 'Удалить все снимки, кроме последнего?' : 'Удалить все снимки?', () => api.act(name === 'Все, кроме дан. изобр.' ? 'clearOld' : 'clear')),
  };
  B.setup1_0 = {
    sim: 'Возвращает настройки симулятора к исходным.',
    sub: (name) => (name === 'Инициализировать'
      ? confirm('Инициализировать? Будут сброшены все настройки, Мое меню, меню Fn и удалены снимки.', () => api.act('init'))
      : confirm('Сбросить настройки камеры?', () => api.act('reset'))),
  };
  return B;
}
function MENU_ITEM(id) { return INDEX.get(id).it; }

// ───────────── Интерфейс ─────────────
export class CameraMenu {
  constructor(root, api) {
    this.root = root;
    this.api = api;
    this.X = { vals: {}, my: [], fn: [...FN_DEFAULT] };
    try { Object.assign(this.X, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* хранилище недоступно */ }
    this.X.my = this.X.my.filter((id) => INDEX.has(id));
    if (this.X.fn.length !== 12 || !this.X.fn.every((id) => INDEX.has(id))) this.X.fn = [...FN_DEFAULT];
    this.B = makeBindings(api, this.X);
    this.mode = null;            // 'menu' | 'fn' | null
    this.tab = 0; this.group = 0; this.row = 0; this.col = 'items';
    this.stack = [];             // вложенные экраны: { title, rows: () => [], row, opts? }
    this.fnSel = 0; this.note = ''; this.noteT = 0;
    root.addEventListener('click', (e) => this.onClick(e));
    // справка по наведению мыши (на сенсорных экранах — по выбору пункта)
    root.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.mode === 'fn') return this.hoverFn(e);
      const row = e.target.closest?.('.mn-row');
      if (row) this.hoverRow(+row.dataset.row);
    });
    root.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'touch' || root.contains(e.relatedTarget) && e.relatedTarget.closest?.(this.mode === 'fn' ? '.fn-tile, .fn-list button' : '.mn-row')) return;
      if (this.mode === 'fn') this.hoverFn(e); else this.hoverRow(null);
    });
    document.addEventListener('keydown', (e) => this.onKey(e));
  }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.X)); } catch (e) { /* хранилище недоступно */ } }
  resetStore(all) {
    this.X.vals = {};
    if (all) { this.X.my = []; this.X.fn = [...FN_DEFAULT]; }
    this.save();
  }
  get open() { return !!this.mode; }

  toggle(mode) {
    if (this.mode === mode) return this.close();
    this.mode = mode; this.stack = [];
    if (mode === 'menu' && this.X.my.length && this.value(MENU_ITEM('my0_5')) === 'Вкл') { this.tab = MENU_TABS.findIndex((t) => t.id === 'my'); this.group = 0; this.row = 0; }
    this.render();
  }
  close() { this.mode = null; this.stack = []; this.render(); }

  // ── значения пунктов ──
  opts(it) { return this.B[it.id]?.opts?.() || it.opts || []; }
  value(it) {
    const b = this.B[it.id];
    if (b?.get) return b.get();
    return this.X.vals[it.id] ?? it.def ?? this.opts(it)[0] ?? '';
  }
  setValue(it, label) {
    const b = this.B[it.id];
    if (b?.set) b.set(label); else this.X.vals[it.id] = label;
    this.save();
    if (!b?.set) this.render();          // привязанные пункты перерисует setKey
  }
  bound(it) { const b = this.B[it.id]; return !!(b && (b.set || b.act || b.sub)); }
  movieOnly(it) { return it.mode === 'movie'; }
  // пункт и его «хвост» (подпункты, которые на камере выбираются стрелками рядом со значением)
  expand(items) {
    const out = [];
    for (const it of items) { out.push(it); for (const x of this.B[it.id]?.after?.() || []) out.push({ ...x, kind: 'value', mode: 'photo', page: it.page, child: true }); }
    return out;
  }

  // ── страницы «Мое меню» ──
  groupsOf(t) {
    if (t.id !== 'my') return t.groups.map((g) => ({ name: g.name, items: g.items }));
    const pages = [];
    for (let i = 0; i < this.X.my.length; i += 6) pages.push({ name: `Стр. ${pages.length + 1}`, items: this.X.my.slice(i, i + 6).map((id) => INDEX.get(id).it), page: pages.length });
    return [...pages, { name: t.groups[0].name, items: t.groups[0].items }];
  }
  get groups() { return this.groupsOf(MENU_TABS[this.tab]); }

  rowOf(it) {
    const dim = this.movieOnly(it);
    let val = '';
    if (it.kind === 'value') val = dim ? '' : this.value(it);
    else if (it.kind !== 'info') val = '›';
    return { name: it.name, val, dim, sim: this.bound(it), child: it.child, item: it, act: () => this.activate(it) };
  }
  mainRows() {
    const g = this.groups[Math.min(this.group, this.groups.length - 1)];
    return this.expand(g.items).map((it) => this.rowOf(it));
  }
  push(scr) { this.stack.push({ row: 0, ...scr }); this.render(); }
  pop() { this.stack.pop(); this.render(); }
  flash(text) {
    this.note = text; clearTimeout(this.noteT);
    this.noteT = setTimeout(() => { this.note = ''; if (this.mode) this.render(); }, 2600);
    this.render();
  }

  activate(it) {
    if (this.movieOnly(it)) return this.flash(`«${it.name}» — пункт для видеосъемки. В режиме фото он недоступен.`);
    const b = this.B[it.id];
    if (it.id.startsWith('my') && it.kind === 'action') return this.myAction(it);
    if (it.id === 'setup2_3') return this.fnEditor();
    if (it.id === 'setup2_0' || it.id === 'setup3_0') return this.keysScreen(it);
    if (it.kind === 'value') {
      const cur = this.value(it), list = this.opts(it);
      return this.push({
        title: it.name, item: it, row: Math.max(0, list.indexOf(cur)), opts: true,
        rows: () => this.opts(it).map((l) => ({ name: l, opt: l, item: it, on: l === this.value(it), def: l === it.def, act: () => { this.setValue(it, l); this.pop(); } })),
      });
    }
    if (it.kind === 'group') return this.push({ title: it.name, item: it, rows: () => this.expand(it.children).map((c) => this.rowOf(c)) });
    if (it.kind === 'action' && b?.act) {
      const r = b.act();
      if (r?.confirm) this.confirm(it, r);
      return;
    }
    if ((it.kind === 'action' || it.kind === 'container') && it.sub?.length) {
      return this.push({
        title: it.name, item: it,
        rows: () => it.sub.map((name) => ({
          name, opt: name, val: b?.sub ? '›' : '', dim: !b?.sub, item: it,
          act: () => (b?.sub ? this.confirm(it, b.sub(name)) : this.flash(`«${name}» — подпункт «${it.name}». В симуляторе не настраивается, описание — в справочнике, стр. ${it.page}.`)),
        })),
      });
    }
    this.flash(`«${it.name}» — в симуляторе нет экрана этой функции. Описание — в справочнике, стр. ${it.page}.`);
  }
  confirm(it, c) {
    this.push({
      title: it.name, item: it, text: c.confirm,
      rows: () => [{ name: 'Ввод', act: () => { this.stack = []; c.run(); this.render(); } }, { name: 'Отмена', act: () => this.pop() }],
    });
  }

  // ── Мое меню ──
  addToMy(it) {
    if (this.X.my.includes(it.id)) { this.X.my = this.X.my.filter((x) => x !== it.id); this.save(); return this.flash(`«${it.name}» удалён из Мое меню`); }
    if (this.X.my.length >= 30) return this.flash('В Мое меню уже 30 пунктов — это максимум.');
    this.X.my.push(it.id); this.save();
    this.flash(`«${it.name}» добавлен в Мое меню`);
  }
  myAction(it) {
    const name = (id) => INDEX.get(id).it.name;
    if (it.id === 'my0_0') {                                   // выбор пункта: вкладка → группа → пункт
      return this.push({
        title: 'Добавить пункт',
        rows: () => MENU_TABS.filter((t) => t.id !== 'my').map((t) => ({
          name: t.name, val: '›',
          act: () => this.push({
            title: t.name,
            rows: () => t.groups.map((g) => ({
              name: g.name, val: '›',
              act: () => this.push({
                title: g.name,
                rows: () => g.items.map((x) => ({ name: x.name, val: this.X.my.includes(x.id) ? '★' : '', dim: this.movieOnly(x), act: () => { if (!this.X.my.includes(x.id)) this.addToMy(x); else this.flash('Этот пункт уже в Мое меню'); } })),
              }),
            })),
          }),
        })),
      });
    }
    if (!this.X.my.length) return this.flash('Мое меню пусто: сначала добавьте пункты.');
    if (it.id === 'my0_1') {
      return this.push({
        title: 'Сортировать пункт',
        rows: () => this.X.my.map((id, i) => ({ name: `${i + 1}. ${name(id)}`, val: i ? '▲' : '', act: () => { if (!i) return; const a = this.X.my; [a[i - 1], a[i]] = [a[i], a[i - 1]]; this.save(); this.stack.at(-1).row = i - 1; this.render(); } })),
      });
    }
    if (it.id === 'my0_2') {
      return this.push({ title: 'Удалить пункт', rows: () => this.X.my.map((id) => ({ name: name(id), val: '✕', act: () => { this.X.my = this.X.my.filter((x) => x !== id); this.save(); if (!this.X.my.length) this.stack = []; this.render(); } })) });
    }
    if (it.id === 'my0_3') {
      const pages = this.groups.filter((g) => g.page != null);
      return this.push({ title: 'Удалить страницу', rows: () => pages.map((p) => ({ name: p.name, val: `${p.items.length} пункт.`, act: () => this.confirm(it, { confirm: `Удалить ${p.name}?`, run: () => { const ids = p.items.map((x) => x.id); this.X.my = this.X.my.filter((x) => !ids.includes(x)); this.save(); this.group = 0; } }) })) });
    }
    if (it.id === 'my0_4') return this.confirm(it, { confirm: 'Удалить все пункты Мое меню?', run: () => { this.X.my = []; this.save(); this.group = 0; } });
  }

  // ── Настройки меню Fn: 12 ячеек, в каждую можно поставить любой пункт, влияющий на кадр ──
  fnEditor() {
    const choices = [...INDEX.values()].map((e) => e.it).filter((x) => x.kind === 'value' && this.B[x.id]?.set && !x.id.startsWith('x_'));
    this.push({
      title: 'Настройки меню Fn',
      text: 'Выберите ячейку (верхний ряд 1–6, нижний 7–12), затем функцию для нее.',
      rows: () => this.X.fn.map((id, i) => ({
        name: `${i + 1}. ${MENU_ITEM(id).name}`, val: '›',
        act: () => this.push({
          title: `Ячейка ${i + 1}`, row: Math.max(0, choices.findIndex((c) => c.id === id)), opts: true,
          rows: () => choices.map((c) => ({ name: c.name, on: c.id === this.X.fn[i], act: () => { this.X.fn[i] = c.id; this.save(); this.pop(); } })),
        }),
      })),
    });
  }
  // назначения пользовательских клавиш по умолчанию (справочник, стр. 512–513)
  keysScreen(it) {
    const keys = KEY_DEFAULTS?.photo || {};
    this.push({ title: it.name, item: it, text: 'Функции кнопок и дисков при фотосъемке (заводские). Переназначение в симуляторе недоступно.', rows: () => Object.entries(keys).map(([k, v]) => ({ name: k, val: v, act: () => this.render() })) });
  }

  // ── справка: «что это», «когда менять», расшифровка значений (menu-help.js) ──
  helpOf(it) { return HELP[it.id] || this.B[it.id]?.help || {}; }
  optText(it, label) { const o = this.helpOf(it).opts; return o ? o[label] || '' : ''; }
  // панель справки для пункта it; opt — вариант, на который указывают (в списке значений или подпунктов)
  infoHtml(it, opt) {
    if (!it) return this.stack.at(-1)?.text ? `<p class="mi-what">${esc(this.stack.at(-1).text)}</p>` : '';
    const h = this.helpOf(it), movie = this.movieOnly(it);
    const what = h.what || it.help || '';
    let val = '';
    if (opt != null) {
      const ex = this.optText(it, opt);
      val = `<div class="mi-val"><span>${it.kind === 'value' ? 'Вариант' : 'Подпункт'}: <b>${esc(opt)}</b>${opt === it.def ? ' <i>заводское</i>' : ''}</span>${ex ? `<p>${esc(ex)}</p>` : ''}</div>`;
    } else if (it.kind === 'value' && !movie) {
      const cur = this.value(it), ex = this.optText(it, cur);
      val = `<div class="mi-val"><span>Сейчас: <b>${esc(cur)}</b>${cur === it.def ? ' <i>заводское</i>' : it.def ? ` · заводское: ${esc(it.def)}` : ''}</span>${ex ? `<p>${esc(ex)}</p>` : ''}</div>`;
    }
    const range = h.opts?._range ? `<p class="mi-range">${esc(h.opts._range)}</p>` : '';
    const sim = movie ? '<span class="mn-badge movie">Только для видео</span>' : this.bound(it) ? '<span class="mn-badge">Влияет на кадр в симуляторе</span>' : '';
    const simLong = this.bound(it) && !movie ? this.B[it.id]?.sim || '' : '';
    const scr = this.stack.at(-1), tab = MENU_TABS[this.tab];
    const star = !scr?.opts && tab.id !== 'my' && !it.id.startsWith('x_') && !it.child && INDEX.has(it.id) ? `<button class="mn-star${this.X.my.includes(it.id) ? ' on' : ''}" data-star="${it.id}" title="Добавить в Мое меню / убрать">${this.X.my.includes(it.id) ? '★' : '☆'} Мое меню</button>` : '';
    return `
      <h4>${esc(it.name)}</h4>
      ${what ? `<p class="mi-what">${esc(what)}</p>` : ''}
      ${h.use ? `<p class="mi-use"><b>Когда менять.</b> ${esc(h.use)}</p>` : ''}
      ${val}${range}
      ${simLong ? `<p class="mi-sim">В симуляторе: ${esc(simLong)}</p>` : ''}
      <div class="mn-meta">${sim}${it.page ? `<span>Справочник, стр. ${it.page}</span>` : ''}${star}</div>`;
  }
  rowInfo(x) { return this.note ? `<p class="mi-what">${esc(this.note)}</p>` : this.infoHtml(x?.item || this.stack.at(-1)?.item, x?.opt); }
  // наведение мышью: справка обновляется сразу, без перерисовки списка
  hoverRow(i) {
    const box = this.root.querySelector('.mn-info');
    if (!box || !this.rows) return;
    const x = i == null ? this.rows[(this.stack.at(-1) || this).row] : this.rows[i];
    box.innerHTML = this.rowInfo(x);
  }

  // ── отрисовка ──
  render() {
    const r = this.root;
    r.hidden = !this.mode;
    r.className = `cam-menu ${this.mode || ''}`;
    if (!this.mode) { r.innerHTML = ''; return; }
    if (this.mode === 'fn') return this.renderFn();
    const tab = MENU_TABS[this.tab], groups = this.groups;
    this.group = Math.min(this.group, groups.length - 1);
    const scr = this.stack.at(-1);
    const rows = scr ? scr.rows() : this.mainRows();
    this.rows = rows;
    const sel = scr ? scr : this;
    sel.row = Math.max(0, Math.min(sel.row, rows.length - 1));
    const rowHtml = (x, i) => {
      const ex = x.opt != null && x.item ? this.optText(x.item, x.opt) : '';
      return `<button class="mn-row${i === sel.row ? ' sel' : ''}${x.on ? ' on' : ''}${x.dim ? ' dim' : ''}${x.child ? ' child' : ''}${ex ? ' ex' : ''}" data-row="${i}">${x.sim ? '<i class="mn-sim" title="Влияет на кадр"></i>' : ''}<span>${esc(x.name)}${ex ? `<small class="mn-ex">${esc(ex)}</small>` : ''}</span>${x.def ? '<small class="mn-def">завод.</small>' : ''}${x.on ? '<b class="mn-dot">●</b>' : `<em>${esc(x.val ?? '')}</em>`}</button>`;
    };
    r.innerHTML = `
      <div class="mn ${scr ? 'deep' : ''} col-${this.col}">
        <nav class="mn-tabs" aria-label="Вкладки меню">${MENU_TABS.map((t, i) => `<button data-tab="${i}" class="${i === this.tab ? 'on' : ''}" title="${t.name}" aria-label="${t.name}">${ICONS[t.id]}<small>${SHORT[t.id]}</small></button>`).join('')}</nav>
        <div class="mn-head"><span class="mn-tabname">${esc(tab.name)}</span>${scr ? `<button class="mn-back" data-back>‹ ${esc(this.stack.length > 1 ? this.stack.at(-2).title : groups[this.group].name)}</button><b>${esc(scr.title)}</b>` : `<b>${this.group + 1}/${groups.length} ${esc(groups[this.group].name)}</b>`}</div>
        <div class="mn-groups" role="list">${groups.map((g, i) => `<button data-group="${i}" class="${i === this.group ? 'on' : ''}"><small>${i + 1}</small>${esc(g.name)}</button>`).join('')}</div>
        <div class="mn-list" role="list">${scr?.text ? `<p class="mn-text">${esc(scr.text)}</p>` : ''}${rows.length ? rows.map(rowHtml).join('') : '<p class="mn-text">Пусто. Добавьте пункты: «Добавить пункт» ниже или кнопка ☆ у любого пункта меню.</p>'}</div>
        <div class="mn-info" aria-live="polite">${this.rowInfo(rows[sel.row])}</div>
        <button class="menu-close" data-close aria-label="Закрыть меню">✕</button>
      </div>`;
    r.querySelector('.mn-list .sel')?.scrollIntoView({ block: 'nearest' });
    r.querySelector('.mn-groups .on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  fnHelp(it, opt) {
    const h = this.helpOf(it), v = opt ?? this.value(it), ex = this.optText(it, v);
    return `<b>${esc(it.name.replace(/\.$/, ''))}.</b> ${esc(h.what || it.help)}${ex ? ` <span class="fn-val">${esc(v)}: ${esc(ex)}</span>` : ''} <span class="mn-page">Стр. ${it.page}</span>`;
  }
  renderFn() {
    const r = this.root;
    const items = this.X.fn.map((id) => MENU_ITEM(id));
    const cur = items[this.fnSel], val = this.value(cur);
    r.innerHTML = `
      <div class="fn-panel">
        <div class="fn-grid">${items.map((it, i) => `<button class="fn-tile${i === this.fnSel ? ' sel' : ''}" data-fn="${i}"><small>${esc(it.name)}</small><b>${esc(this.value(it))}</b></button>`).join('')}</div>
        <div class="fn-opts"><button class="fn-arrow" data-cyc="-1" aria-label="Предыдущее значение">◀</button><div class="fn-list">${this.opts(cur).map((l) => `<button data-opt="${esc(l)}" class="${l === val ? 'on' : ''}">${esc(l)}</button>`).join('')}</div><button class="fn-arrow" data-cyc="1" aria-label="Следующее значение">▶</button></div>
        <div class="menu-help">${this.fnHelp(cur)}</div>
        <button class="menu-close" data-close aria-label="Закрыть">✕</button>
      </div>`;
    r.querySelector('.fn-list .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  hoverFn(e) {
    const help = this.root.querySelector('.menu-help');
    if (!help) return;
    const tile = e.target.closest?.('.fn-tile'), opt = e.target.closest?.('.fn-list button');
    const cur = MENU_ITEM(this.X.fn[this.fnSel]);
    if (tile) help.innerHTML = this.fnHelp(MENU_ITEM(this.X.fn[+tile.dataset.fn]));
    else if (opt) help.innerHTML = this.fnHelp(cur, opt.dataset.opt);
    else help.innerHTML = this.fnHelp(cur);
  }
  cycle(it, d) {
    const o = this.opts(it), i = o.indexOf(this.value(it));
    const n = o[Math.max(0, Math.min(o.length - 1, (i < 0 ? 0 : i) + d))];
    if (n != null && n !== this.value(it)) this.setValue(it, n);
  }

  // ── ввод ──
  onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    const d = b.dataset;
    if (d.close !== undefined) return this.close();
    if (this.mode === 'fn') {
      const cur = MENU_ITEM(this.X.fn[this.fnSel]);
      if (d.fn) { this.fnSel = +d.fn; return this.render(); }
      if (d.cyc) return this.cycle(cur, +d.cyc);
      if (d.opt != null) return this.setValue(cur, d.opt);
      return;
    }
    if (d.tab) { this.tab = +d.tab; this.group = 0; this.row = 0; this.stack = []; this.col = 'tabs'; return this.render(); }
    if (d.group) { this.group = +d.group; this.row = 0; this.stack = []; this.col = 'groups'; return this.render(); }
    if (d.back !== undefined) return this.pop();
    if (d.star) return this.addToMy(INDEX.get(d.star).it);
    if (d.row) {
      const scr = this.stack.at(-1), rows = scr ? scr.rows() : this.mainRows();
      (scr || this).row = +d.row; this.col = 'items';
      rows[+d.row]?.act();
      if (this.mode && !rows[+d.row]?.act) this.render();
    }
  }

  onKey(e) {
    if (!this.mode || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const k = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace', ' '].includes(k)) return;
    e.preventDefault();
    if (this.mode === 'fn') {
      const cur = MENU_ITEM(this.X.fn[this.fnSel]);
      if (k === 'Escape' || k === 'Enter' || k === 'Backspace') return this.close();
      if (k === 'ArrowLeft') { this.fnSel = (this.fnSel + 11) % 12; return this.render(); }
      if (k === 'ArrowRight') { this.fnSel = (this.fnSel + 1) % 12; return this.render(); }
      if (k === 'ArrowUp') return this.cycle(cur, -1);
      if (k === 'ArrowDown') return this.cycle(cur, 1);
      return;
    }
    const scr = this.stack.at(-1);
    if (scr) {
      const rows = scr.rows();
      if (k === 'ArrowUp') scr.row = (scr.row + rows.length - 1) % rows.length;
      else if (k === 'ArrowDown') scr.row = (scr.row + 1) % rows.length;
      else if (k === 'Enter' || k === ' ' || k === 'ArrowRight') return rows[scr.row]?.act();
      else return this.pop();
      return this.render();
    }
    const nT = MENU_TABS.length, nG = this.groups.length;
    if (k === 'Escape' || k === 'Backspace') {
      if (this.col === 'items') this.col = 'groups'; else if (this.col === 'groups') this.col = 'tabs'; else return this.close();
    } else if (this.col === 'tabs') {
      if (k === 'ArrowUp') { this.tab = (this.tab + nT - 1) % nT; this.group = 0; this.row = 0; }
      if (k === 'ArrowDown') { this.tab = (this.tab + 1) % nT; this.group = 0; this.row = 0; }
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') this.col = 'groups';
    } else if (this.col === 'groups') {
      if (k === 'ArrowUp') { this.group = (this.group + nG - 1) % nG; this.row = 0; }
      if (k === 'ArrowDown') { this.group = (this.group + 1) % nG; this.row = 0; }
      if (k === 'ArrowLeft') this.col = 'tabs';
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') this.col = 'items';
    } else {
      const rows = this.mainRows();
      if (k === 'ArrowUp') this.row = (this.row + rows.length - 1) % rows.length;
      if (k === 'ArrowDown') this.row = (this.row + 1) % rows.length;
      if (k === 'ArrowLeft') this.col = 'groups';
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') return rows[this.row]?.act();
    }
    this.render();
  }
}
