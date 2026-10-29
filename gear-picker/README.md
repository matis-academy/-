# Подбор сетапа (Matis Academy) — файлы страницы /wiki/podbor-setapa/

Claude, 29.10.2026. Бета.

- `v1/app.css`, `v1/app.js`, `v1/ua.js` — стиль MVC, логика и украинский словарь (страница /uk/… переводится скриптом, контейнер помечен `data-no-translation`).
- `v1/data/*.json` — камеры, объективы по байонетам, карты, гимбалы, мета (курс НБУ, исключённые модели). Фото — `v1/img/*.webp` (прозрачный фон).
- Источник данных — e-каталог (ek.ua), сбор с ПК владельца (`Content/Gear-Picker/ek/` в Obsidian), сборка — `assemble.py` (`GP_URLS=1 GP_OUT=… python assemble.py`), формат объективов — `lens_format.py`, вырезка фона — `cutout.py`, словарь — `ua_dict.py`.
- На сервере: `/root/matis-setup/gear-picker-2026-10-29/sync.sh` (проверка) / `--apply` (бэкап и установка в `wp-content/uploads/gear-picker/v1/`).
