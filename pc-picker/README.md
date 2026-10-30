# Компьютер для DaVinci Resolve — /wiki/kompyuter-dlya-davinci/

Claude, 30.10.2026. Бета. Стиль MVC (бренд-кит).

- `v1/app.css`, `v1/app.js` — конструктор: шаги (платформа, камера и формат, задачи, Resolve, объём, монитор), сборка со списками «минимум / рекомендую / топ», таблица декодеров, Пиксель-гид. Тексты RU и UA прямо в скрипте (`t(ru, uk)`), контейнер помечен `data-no-translation`.
- `v1/data/prices.json` — цены: минимальные в магазинах Украины по ek.ua, $ по курсу НБУ. Собираются на ПК владельца: `Content/PC-Picker/ek/prices.py` (Obsidian), копия — `ek/prices.py`.
- Сервер: `/root/matis-setup/pc-picker-2026-10-30/sync.sh` (проверка) → `--apply` (бэкап в `/root/backups/2026-10-30-pc-picker/`), страница — `create_page.php`.
