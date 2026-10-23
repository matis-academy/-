# matis.academy — украинская версия (TranslatePress)

Русский — основной язык (адреса без префикса), украинский — `/uk/...`. Переводы лежат в словаре TranslatePress
(`matis_trp_dictionary_ru_ru_uk`), этот репозиторий-ветка — рабочая копия переводов и инструменты. Claude, 23.10.2026.

## Файлы
- `uk/translations.json` — {id строки словаря: перевод} для статических строк страниц.
- `uk/dynamic.json` — [[оригинал, перевод], ...] для строк, которые рисует JavaScript (тренажёры, квизы, кабинет, плеер уроков).
- `tools/` — краулеры (Playwright) и `GUIDE.md` — правила и глоссарий перевода.

## Как допереводить новые страницы
1. `python3 tools/crawl.py tools/pages.txt` — обойти украинские адреса (добавьте новые пути в pages.txt); TranslatePress сам добавит новые строки со status=0.
2. На сервере: `wp eval-file /root/matis-setup/i18n-export.php out.json` → перевести по `GUIDE.md` → `wp eval-file /root/matis-setup/i18n-import.php uk.json`.
3. Динамические строки: `python3 tools/collect.py tools/pages.txt` (и `tools/lms.txt` с cookies тестового студента) собирает русские тексты из DOM;
   недостающие перевести и залить `wp eval-file /root/matis-setup/i18n-insert.php dynamic.json`.
4. `python3 tools/check.py tools/pages.txt` — остатки русского на /uk/.
5. Сброс кэша: `v-delete-fastcgi-cache matis matis.academy`.

Ручная правка любой строки — редактор TranslatePress на сайте (Админка → Настройки → TranslatePress → Translate Site), импорт ручные правки не перезаписывает.
