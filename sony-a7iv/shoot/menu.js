// Меню камеры: Fn (быстрое) и MENU (полное). Реконструкция логики α7 IV для обучения,
// не копия графики Sony. Каждый пункт меняет состояние S через api.set().
import * as O from './optics.js?v=2';

const on = [{ v: true, t: 'Вкл' }, { v: false, t: 'Выкл' }];

// Пункты меню. options — массив или функция; vis — показывать ли пункт; help — объяснение.
export function menuModel(api) {
  const S = api.S;
  const I = {
    fileFormat: { name: 'Формат файла', options: [{ v: 'JPEG', t: 'JPEG' }, { v: 'RAW', t: 'RAW' }, { v: 'RAW+JPEG', t: 'RAW+J' }],
      help: 'RAW хранит все данные матрицы для обработки в редакторе, JPEG — готовая картинка. Симулятор всегда сохраняет JPEG.' },
    jpegSize: { name: 'Размер JPEG', options: [{ v: 'L', t: 'L: 33M' }, { v: 'M', t: 'M: 14M' }, { v: 'S', t: 'S: 8.2M' }],
      help: 'Число пикселей снимка. В симуляторе — уменьшенная копия, но пропорции размеров сохранены.' },
    drive: { name: 'Режим протяжки', short: 'Протяжка', options: [{ v: 'single', t: 'Покадр.' }, { v: 'burst', t: 'Серия Hi' }, { v: 'timer2', t: 'Таймер 2с' }, { v: 'timer10', t: 'Таймер 10с' }],
      help: 'Серия — 5 кадров со скоростью 10 к/с, удобно для движения. Автоспуск — снимок через 2 или 10 секунд: камера не дрогнет от нажатия на штативе.' },
    steady: { name: 'SteadyShot', options: on, help: 'Стабилизатор матрицы: компенсирует дрожание рук до 5,5 ступени. На штативе его выключают.' },
    meter: { name: 'Режим замера', short: 'Замер', options: [{ v: 'multi', t: 'Мульти' }, { v: 'center', t: 'Центр' }, { v: 'spot', t: 'Точечный' }, { v: 'average', t: 'Средний' }, { v: 'highlight', t: 'Света' }],
      help: 'Как камера оценивает свет. Мульти — по всему кадру с приоритетом центра. Центровзвешенный — в основном центр. Точечный — маленький круг. Средний — весь экран одинаково. Приоритет светов — бережёт яркие места от пересвета.' },
    spotLink: { name: 'Точка точ. замера', options: [{ v: 'center', t: 'Центр' }, { v: 'focus', t: 'Точка фокуса' }],
      help: 'Где мерить свет в точечном режиме: в центре кадра или там, где точка фокусировки.' },
    ec: { name: 'Экспокоррекция', short: 'Эксп.±', options: () => O.ECS.map((v) => ({ v, t: O.fmtEV(v) })),
      help: 'Сдвигает расчёт камеры: «+» — светлее, «−» — темнее. Против света обычно нужно +1…+2.' },
    iso: { name: 'ISO', options: () => [{ v: 'AUTO', t: 'AUTO' }, ...O.ISOS.map((v) => ({ v, t: String(v) }))],
      help: 'Чувствительность: выше — светлее, но больше шума.' },
    autoMinSS: { name: 'ISO AUTO мин. выд.', options: [{ v: 'std', t: 'Стандарт' }, { v: 'slow', t: 'Медленнее' }, { v: 'fast', t: 'Быстрее' }],
      help: 'До какой выдержки камера терпит, прежде чем поднять ISO. Стандарт — 1/f, медленнее — 1/(f/2), быстрее — 1/(2f).' },
    wb: { name: 'Баланс белого', short: 'ББ', options: [{ v: 'AWB', t: 'AWB' }, { v: 'day', t: 'Дн. свет' }, { v: 'shade', t: 'Тень' }, { v: 'cloudy', t: 'Облачно' }, { v: 'tungsten', t: 'Лампа' }, { v: 'fluor', t: 'Флуор.' }, { v: 'K', t: 'Цв.темп.' }],
      help: 'Делает белое белым при разном свете. Лампа накаливания ≈ 3200 K (убирает желтизну), тень ≈ 7500 K (убирает синеву). AWB подбирает сам.' },
    wbK: { name: 'Цветовая температура', vis: () => S.wb === 'K', options: () => [2500, 2800, 3000, 3200, 3600, 4000, 4500, 5000, 5500, 6000, 6500, 7500, 8500, 9900].map((v) => ({ v, t: `${v}K` })),
      help: 'Температура света, который станет нейтральным. Ниже число — картинка холоднее.' },
    dro: { name: 'DRO', options: [{ v: false, t: 'Выкл' }, { v: true, t: 'Авто' }],
      help: 'Оптимизатор Д-диапазона: вытягивает тени в контрастных сценах.' },
    look: { name: 'Creative Look', short: 'Look', options: ['ST', 'PT', 'NT', 'VV', 'VV2', 'FL', 'IN', 'SH', 'BW', 'SE'].map((v) => ({ v, t: v })),
      help: 'Стиль картинки: ST — стандарт, PT — портрет, NT — нейтральный, VV/VV2 — яркий, FL — плёнка, IN — моментальное фото, SH — светлый, BW — ч/б, SE — сепия.' },
    zebra: { name: 'Зебра', options: [{ v: 0, t: 'Выкл' }, { v: 0.72, t: '70' }, { v: 0.98, t: '100+' }],
      help: 'Штриховка на слишком ярких местах. 100+ — показывает пересвет, 70 — уровень кожи для видео.' },
    fm: { name: 'Режим фокуса', short: 'Фокус', options: [{ v: 'AF-S', t: 'AF-S' }, { v: 'AF-C', t: 'AF-C' }, { v: 'MF', t: 'MF' }],
      help: 'AF-S — фокус фиксируется (статичные сюжеты). AF-C — камера постоянно следит за дистанцией (движение). MF — вручную кольцом.' },
    area: { name: 'Область фокуса', short: 'Область', options: [{ v: 'wide', t: 'Широкая' }, { v: 'point', t: 'Точка' }, { v: 'track', t: 'Трекинг' }],
      help: 'Широкая — камера сама выбирает объект. Точка — фокус там, где вы нажали. Трекинг — нажмите на объект, и рамка поедет за ним.' },
    eyeAF: { name: 'Распозн. лица/глаз', short: 'Глаз AF', options: on, help: 'Камера находит глаз человека и фокусируется на нём — главное для портрета.' },
    peak: { name: 'Выделение контуров', short: 'Пикинг', options: [{ v: 'off', t: 'Выкл' }, { v: 'red', t: 'Красный' }, { v: 'yellow', t: 'Жёлтый' }, { v: 'white', t: 'Белый' }],
      help: 'Подсвечивает резкие края цветом — удобно при ручной фокусировке.' },
    grid: { name: 'Линии сетки', options: [{ v: 'off', t: 'Выкл' }, { v: 'thirds', t: 'Трети' }, { v: 'square', t: 'Квадраты' }, { v: 'diag', t: 'Диаг.+кв.' }],
      help: 'Помогает строить композицию: правило третей — главный объект на пересечении линий.' },
    disp: { name: 'Экран (DISP)', options: [{ v: 'all', t: 'Все данные' }, { v: 'hist', t: 'Гистограмма' }, { v: 'none', t: 'Без инфо' }],
      help: 'Что показывать поверх изображения. Гистограмма — распределение яркостей: прижата вправо — пересвет, влево — недосвет.' },
    beep: { name: 'Звуковые сигналы', options: on, help: 'Звук подтверждения фокусировки.' },
    gallery: { name: 'Просмотр снимков', action: () => api.act('gallery'), help: 'Открыть отснятые кадры с разбором.' },
    clear: { name: 'Удалить все снимки', action: () => api.act('clear'), help: 'Очистить галерею.' },
    reset: { name: 'Сброс настроек', action: () => api.act('reset'), help: 'Вернуть настройки камеры к исходным.' },
  };
  for (const [k, v] of Object.entries(I)) v.key = k;
  const tabs = [
    { id: 'shoot', icon: '📷', name: 'Съёмка', items: ['fileFormat', 'jpegSize', 'drive', 'steady'] },
    { id: 'exp', icon: '±', name: 'Экспозиция/цвет', items: ['meter', 'spotLink', 'ec', 'iso', 'autoMinSS', 'wb', 'wbK', 'dro', 'look', 'zebra'] },
    { id: 'af', icon: 'AF', name: 'Фокус', items: ['fm', 'area', 'eyeAF', 'peak'] },
    { id: 'play', icon: '▶', name: 'Просмотр', items: ['gallery', 'clear'] },
    { id: 'setup', icon: '⚙', name: 'Настройка', items: ['grid', 'disp', 'beep', 'reset'] },
  ];
  const fn = ['fm', 'area', 'eyeAF', 'ec', 'iso', 'meter', 'wb', 'look', 'drive', 'steady', 'zebra', 'peak'];
  return { items: I, tabs, fn };
}

const opts = (it) => (typeof it.options === 'function' ? it.options() : it.options || []);
const valText = (it, S) => {
  if (it.action) return '›';
  const o = opts(it).find((x) => x.v === S[it.key]);
  return o ? o.t : String(S[it.key]);
};

// Интерфейс меню поверх видоискателя
export class CameraMenu {
  constructor(root, api) {
    this.root = root;
    this.api = api;
    this.m = menuModel(api);
    this.mode = null;          // 'fn' | 'menu' | null
    this.tab = 0; this.row = 0; this.sub = null; this.fnSel = 0;
    root.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
  }
  get open() { return !!this.mode; }
  toggle(mode) { this.mode = this.mode === mode ? null : mode; this.sub = null; this.render(); }
  close() { this.mode = null; this.sub = null; this.render(); }
  visibleItems() { return this.m.tabs[this.tab].items.map((k) => this.m.items[k]).filter((it) => !it.vis || it.vis()); }

  pick(it, v) { this.api.set(it.key, v); this.render(); }
  cycle(it, d) {
    const o = opts(it), i = o.findIndex((x) => x.v === this.api.S[it.key]);
    const n = o[Math.max(0, Math.min(o.length - 1, (i < 0 ? 0 : i) + d))];
    if (n) this.pick(it, n.v);
  }

  render() {
    const S = this.api.S, r = this.root;
    r.hidden = !this.mode;
    r.className = `cam-menu ${this.mode || ''}`;
    if (!this.mode) { r.innerHTML = ''; return; }
    if (this.mode === 'fn') {
      const items = this.m.fn.map((k) => this.m.items[k]);
      const cur = items[this.fnSel];
      r.innerHTML = `
        <div class="fn-panel">
          <div class="fn-grid">${items.map((it, i) => `<button class="fn-tile${i === this.fnSel ? ' sel' : ''}" data-fn="${i}"><small>${it.short || it.name}</small><b>${valText(it, S)}</b></button>`).join('')}</div>
          <div class="fn-opts"><button class="fn-arrow" data-cyc="-1">◀</button><div class="fn-list">${opts(cur).map((o) => `<button data-opt="${encodeURIComponent(JSON.stringify(o.v))}" class="${o.v === S[cur.key] ? 'on' : ''}">${o.t}</button>`).join('')}</div><button class="fn-arrow" data-cyc="1">▶</button></div>
          <div class="menu-help"><b>${cur.name}.</b> ${cur.help}</div>
          <button class="menu-close" data-close>✕</button>
        </div>`;
      r.querySelector('.fn-list .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
      return;
    }
    const items = this.visibleItems();
    this.row = Math.min(this.row, items.length - 1);
    const it = items[this.row];
    r.innerHTML = `
      <div class="menu-panel">
        <nav class="menu-tabs">${this.m.tabs.map((t, i) => `<button data-tab="${i}" class="${i === this.tab ? 'on' : ''}" title="${t.name}"><span>${t.icon}</span><small>${t.name}</small></button>`).join('')}</nav>
        <div class="menu-body">
          <div class="menu-title">${this.m.tabs[this.tab].name}${this.sub ? ` › ${it.name}` : ''}</div>
          ${this.sub ? `<div class="menu-list">${opts(it).map((o) => `<button data-opt="${encodeURIComponent(JSON.stringify(o.v))}" class="${o.v === S[it.key] ? 'on' : ''}"><span>${o.t}</span>${o.v === S[it.key] ? '<i>●</i>' : ''}</button>`).join('')}</div>`
    : `<div class="menu-list">${items.map((x, i) => `<button data-row="${i}" class="${i === this.row ? 'sel' : ''}"><span>${x.name}</span><em>${valText(x, S)}</em></button>`).join('')}</div>`}
          <div class="menu-help">${it.help}</div>
        </div>
        <button class="menu-close" data-close>✕</button>
      </div>`;
    if (this.sub) r.querySelector('.menu-list .on')?.scrollIntoView({ block: 'nearest' });
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.close !== undefined) return this.close();
    if (this.mode === 'fn') {
      const cur = this.m.items[this.m.fn[this.fnSel]];
      if (b.dataset.fn) { this.fnSel = +b.dataset.fn; return this.render(); }
      if (b.dataset.cyc) return this.cycle(cur, +b.dataset.cyc);
      if (b.dataset.opt) return this.pick(cur, JSON.parse(decodeURIComponent(b.dataset.opt)));
      return;
    }
    if (b.dataset.tab) { this.tab = +b.dataset.tab; this.row = 0; this.sub = null; return this.render(); }
    const items = this.visibleItems();
    if (b.dataset.row) {
      this.row = +b.dataset.row;
      const it = items[this.row];
      if (it.action) { it.action(); return; }
      this.sub = it.key; return this.render();
    }
    if (b.dataset.opt) { this.pick(items[this.row], JSON.parse(decodeURIComponent(b.dataset.opt))); this.sub = null; this.render(); }
  }

  onKey(e) {
    if (!this.mode || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const k = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(k)) return;
    e.preventDefault();
    if (this.mode === 'fn') {
      const cur = this.m.items[this.m.fn[this.fnSel]];
      if (k === 'Escape') return this.close();
      if (k === 'ArrowLeft') return this.cycle(cur, -1);
      if (k === 'ArrowRight') return this.cycle(cur, 1);
      if (k === 'ArrowUp') { this.fnSel = (this.fnSel + 11) % 12; return this.render(); }
      if (k === 'ArrowDown') { this.fnSel = (this.fnSel + 1) % 12; return this.render(); }
      if (k === 'Enter') return this.close();
      return;
    }
    const items = this.visibleItems();
    if (this.sub) {
      const it = items[this.row];
      if (k === 'ArrowUp') return this.cycle(it, -1);
      if (k === 'ArrowDown') return this.cycle(it, 1);
      if (k === 'Enter' || k === 'Escape' || k === 'Backspace' || k === 'ArrowLeft') { this.sub = null; return this.render(); }
      return;
    }
    if (k === 'Escape' || k === 'Backspace') return this.close();
    if (k === 'ArrowUp') this.row = (this.row + items.length - 1) % items.length;
    if (k === 'ArrowDown') this.row = (this.row + 1) % items.length;
    if (k === 'ArrowLeft') { this.tab = (this.tab + this.m.tabs.length - 1) % this.m.tabs.length; this.row = 0; }
    if (k === 'ArrowRight') { this.tab = (this.tab + 1) % this.m.tabs.length; this.row = 0; }
    if (k === 'Enter') { const it = items[this.row]; if (it.action) it.action(); else this.sub = it.key; }
    this.render();
  }
}
