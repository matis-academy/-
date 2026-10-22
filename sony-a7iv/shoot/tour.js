// Тур для новичков: затемнение, подсвеченная область вокруг элемента и карточка со стрелкой.
// steps: [{ el: () => Element | null, title, text, before?: () => void }]

export class Tour {
  constructor(steps, { onEnd, scrollFor } = {}) {
    this.steps = steps;
    this.onEnd = onEnd;
    this.scrollFor = scrollFor;            // как прокрутить страницу к элементу (зависит от вёрстки)
    this.i = 0;
    this.root = null;
    this.raf = 0;
    this.onKey = (e) => {
      if (!this.root) return;
      if (e.key === 'Escape') { e.preventDefault(); this.end(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this.go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(-1); }
      else if (e.key === ' ') e.preventDefault();
    };
  }

  start(i = 0) {
    if (this.root) this.root.remove();
    this.root = document.createElement('div');
    this.root.className = 'tour';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'tourTitle');
    this.root.innerHTML = `
      <div class="tour-hole"></div>
      <div class="tour-card">
        <div class="tour-arrow"></div>
        <div class="tour-step"></div>
        <h3 id="tourTitle"></h3>
        <p></p>
        <div class="tour-btns">
          <button class="tour-skip">Пропустить</button>
          <span></span>
          <button class="tour-back">Назад</button>
          <button class="tour-next">Далее</button>
        </div>
      </div>`;
    document.body.appendChild(this.root);
    document.body.classList.add('touring');
    this.root.querySelector('.tour-skip').addEventListener('click', () => this.end());
    this.root.querySelector('.tour-back').addEventListener('click', () => this.go(-1));
    this.root.querySelector('.tour-next').addEventListener('click', () => this.go(1));
    document.addEventListener('keydown', this.onKey, true);
    this.show(i);
    const loop = () => { this.place(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  go(d) {
    const n = this.i + d;
    if (n >= this.steps.length) return this.end();
    if (n >= 0) this.show(n);
  }

  show(i) {
    this.i = i;
    const st = this.steps[i];
    st.before?.();
    const r = this.root;
    r.querySelector('.tour-step').textContent = `${i + 1} / ${this.steps.length}`;
    r.querySelector('h3').textContent = st.title;
    r.querySelector('p').textContent = st.text;
    r.querySelector('.tour-back').disabled = i === 0;
    r.querySelector('.tour-next').textContent = i === this.steps.length - 1 ? 'Начать' : 'Далее';
    const el = st.el?.();
    if (el) this.scrollFor?.(el);
    r.querySelector('.tour-next').focus({ preventScroll: true });
  }

  // Каждый кадр подгоняем подсветку и карточку под элемент (страница может прокручиваться)
  place() {
    const r = this.root;
    if (!r) return;
    const st = this.steps[this.i];
    const el = st.el?.();
    const hole = r.querySelector('.tour-hole'), card = r.querySelector('.tour-card'), arrow = r.querySelector('.tour-arrow');
    const vw = innerWidth, vh = innerHeight, pad = 6, gap = 14;
    const cw = Math.min(340, vw - 24);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight;
    if (!el) {                                  // шаг без элемента — карточка по центру
      hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;`;
      card.style.left = `${(vw - cw) / 2}px`; card.style.top = `${(vh - ch) / 2}px`;
      arrow.style.display = 'none';
      return;
    }
    const b = el.getBoundingClientRect();
    const x0 = Math.max(4, b.left - pad), y0 = Math.max(4, b.top - pad);
    const x1 = Math.min(vw - 4, b.right + pad), y1 = Math.min(vh - 4, b.bottom + pad);
    hole.style.cssText = `left:${x0}px;top:${y0}px;width:${Math.max(0, x1 - x0)}px;height:${Math.max(0, y1 - y0)}px;`;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const clampX = (x) => Math.min(vw - cw - 12, Math.max(12, x));
    const clampY = (y) => Math.min(vh - ch - 12, Math.max(12, y));
    let pos;
    if (y1 + gap + ch < vh - 8) pos = { side: 'bottom', left: clampX(cx - cw / 2), top: y1 + gap };
    else if (y0 - gap - ch > 8) pos = { side: 'top', left: clampX(cx - cw / 2), top: y0 - gap - ch };
    else if (x0 - gap - cw > 8) pos = { side: 'left', left: x0 - gap - cw, top: clampY(cy - ch / 2) };
    else if (x1 + gap + cw < vw - 8) pos = { side: 'right', left: x1 + gap, top: clampY(cy - ch / 2) };
    else pos = { side: 'inside', left: clampX(cx - cw / 2), top: clampY(y1 - ch - 16) };
    card.style.left = `${pos.left}px`;
    card.style.top = `${pos.top}px`;
    arrow.className = `tour-arrow ${pos.side}`;
    arrow.style.display = pos.side === 'inside' ? 'none' : '';
    if (pos.side === 'bottom' || pos.side === 'top') { arrow.style.left = `${Math.min(cw - 22, Math.max(10, cx - pos.left - 8))}px`; arrow.style.top = ''; }
    else { arrow.style.top = `${Math.min(ch - 22, Math.max(10, cy - pos.top - 8))}px`; arrow.style.left = ''; }
  }

  end() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKey, true);
    this.root?.remove();
    this.root = null;
    document.body.classList.remove('touring');
    this.onEnd?.();
  }
}
