# Pixel assets — Matis Academy

Ветка с материалами кота Пикселя (Claude, 22.10.2026): анимированные стикеры Telegram (WEBM VP9 с альфой, 512×512, 30 к/с, ≤3 с) и их исходник (`cat.js` — рисунок кота, `stickers.js` — 16 анимаций). Mini App «Студия Пикселя» — `app/index.html` (собранный файл, ставится на https://matis.academy/app/), исходник `app/index.src.html` + `stickers/cat.js` (вставляется вместо `/*CATJS*/`).

## 23.10.2026 — RU/UA (Claude)
- `stickers/tablichka.webm` — 17-й стикер: Пиксель держит табличку MATIS ACADEMY (в обоих паках).
- `stickers/uk/*.webm` — украинские версии стикеров с надписями (Привіт!, Клац!, Вогонь!, Пфф!, Дякую!, ну от…); остальные стикеры UA-пака — общие файлы из `stickers/`.
- `stickers/render.py` — рендер WEBM из `cat.js` + `stickers.js` (Playwright + ffmpeg): `python3 render.py out uk privet` (UA-надписи подставляются словарём UK в скрипте).
- Mini App: `app/index.html` — русская (исходник), `app/uk/index.html` собирается `python3 app/build_uk.py` и ставится на https://matis.academy/app/uk/.
