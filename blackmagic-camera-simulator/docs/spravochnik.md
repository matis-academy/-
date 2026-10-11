# Справочник Blackmagic Camera (iOS) для симулятора

**Источник:** официальный документ Blackmagic Design «Blackmagic Camera for iOS — Technical Specifications» (6 стр., файл `blackmagic-camera-ios-techspecs.pdf` в этой папке).
**Устройство в симуляторе:** iPhone 15 Pro Max.
**Язык:** названия пунктов — по-английски, как в приложении; пояснения — по-русски.

Пометки в колонке «В симуляторе»:
- **Сцена** — настройка видимо меняет картинку или индикаторы.
- **Имитация** — переключается и запоминается, есть описание, но реального действия нет (сеть, Bluetooth, HDMI и т. п.).
- **⚠ уточнить** — в спецификации нет точного расположения или вида, нужен скриншот.

---

## 1. Главный экран (Camera Controls / HUD)

| Элемент | Значения по спецификации | Что делает | В симуляторе |
|---|---|---|---|
| **Lens Selection** | зависит от устройства, передние и задние объективы | Выбор модуля камеры | Сцена: 0.5x (13 мм f/2.2), 1x (24 мм f/1.78), 2x (48 мм, кроп основного), 5x (120 мм f/2.8), Front (f/1.9) |
| **Frame Rate** | 23.98, 24, 25, 29.97, 30, 48, 59.94, 60, 100, 120 fps (зависит от устройства и кодека) | Частота кадров проекта | Сцена: плавность движения, влияет на правило 180° |
| **Off Speed Recording** | 4–60 fps | Запись с другой частотой: при воспроизведении на частоте проекта получается замедление или ускорение | Сцена + подсказка «ускорение ×N / замедление ×N» |
| **Shutter Speed** | 1/24, 1/25, 1/30, 1/33, 1/48, 1/50, 1/60, 1/96, 1/100, 1/120, 1/125, 1/250, 1/500, 1/1000, 1/2000, 1/4000, 1/8000; Lock on/off | Выдержка: яркость и смаз движения | Сцена: смаз, яркость, мерцание ламп |
| **Shutter Angle** | 1.1°–360°; Lock on/off | То же в градусах (180° = 1/(2×fps)) | Сцена; режим «скорость/угол» задаётся в Camera Settings |
| **ISO** | ISO 21–5472 (зависит от устройства и объектива) | Чувствительность: яркость и шум | Сцена: яркость и цифровой шум |
| **White Balance** | Locked, Auto, Manual; 2500K–10 000K | Цветовая температура | Сцена: тёплый/холодный оттенок |
| **White Balance Presets** | Cloud, Shade, Fluorescent, Incandescent, Daylight | Быстрые пресеты ББ | Сцена |
| **Tint** | пресеты Cloud, Shade, Fluorescent, Incandescent, Daylight; Manual −50…+50; Auto/Manual с Lock | Сдвиг зелёный ↔ пурпурный | Сцена |
| **Focus** | Auto focus on/off, тап по экрану для автофокуса; ручной от 0.00 (минимальная дистанция) до 1.00 (бесконечность) | Фокусировка | Сцена: размытие вне фокуса |
| **Focus Presets to Rack Focus** | 3 точки фокуса с настраиваемым временем перевода | Автоматический перевод фокуса между точками | Сцена: плавный перевод фокуса |
| **Exposure** | ±3 стопа | Экспокоррекция при автоэкспозиции | Сцена |
| **Zoom** | зависит от устройства, «скраб» до нужного увеличения | Цифровой/оптический зум | Сцена |
| **Zebra Guides** | On/Off, 75–100 % | Штриховка пересвеченных областей выше порога | Сцена |
| **Focus Assist Guides** | On/Off, 1–100 % | Подсветка резких краёв (чувствительность) | Сцена |
| **Screen Guides** | On/Off; Thirds, Centre Crosshair, Centre Dot | Сетки композиции | Сцена |
| **Frame Guides** | On/Off; 9:16, 4:5, 1:1, 4:3, 14:9, 1.85:1, 2:1, 2.35:1, 2.39:1, 2.4:1, 2.76:1 | Рамки соотношения сторон | Сцена |
| **Safe Area Guides** | On/Off, 5–100 % | Рамка безопасной зоны | Сцена |
| **False Color Guides** | On/Off | Окраска кадра по уровням экспозиции | Сцена |
| **Display LUT Guides** | On/Off | Показ LUT на экране | Сцена |
| **Stabilization** | Off, Standard, Cinematic, Extreme | Стабилизация: чем сильнее, тем больше кроп | Сцена: тряска и кроп |
| **Clip Metadata** (слейт) | Slate Name, Lens Data, Reel, Scene, Take, Good Take Last Clip, Interior/Exterior, Day/Night, Production Name, Camera Ident, Director, Camera Operator | Метаданные клипа | Сохраняются в клип на вкладке Media |
| **Histogram** | RGB-гистограмма с индикаторами клиппинга по каналам | Распределение яркостей | Сцена: строится по реальной картинке |
| **Audio Meters** | VU или PPM; тап — усиление для совместимых внешних источников; тап — крупный оверлей | Уровни звука | Имитация звука (сигнал «голос/улица») |
| **Remote Control Status** | при включённом Remote Control — статус подключения | Индикатор удалённого управления | Имитация |
| **Remote Control Multicam** | в режиме Controller — одна камера или мультивью | Просмотр нескольких камер | Имитация |
| **HUD Visibility** | свайп вверх/вниз — показать/скрыть HUD | Скрыть элементы с экрана | Сцена |
| **Screen Visibility** | свайп вправо во время записи — затемнить экран | Экономия батареи / не слепит | Сцена |
| **Haptic Feedback** | вибрация на колёсах управления | — | Имитация (на телефоне через vibrate, если доступно) |

⚠ **уточнить по скриншоту:** точное расположение элементов HUD (что сверху, сбоку, снизу), вид колёс прокрутки ISO/выдержки/ББ, вид кнопки записи и переключателя объективов.

## 2. Record Settings

| Пункт | Значения | Что делает | В симуляторе |
|---|---|---|---|
| **Codec** | Apple ProRes 422 HQ, ProRes 422, ProRes 422 LT, ProRes Proxy, HEVC (H.265), H.264 | Формат сжатия видео | Влияет на размер файла и оставшееся время записи |
| **Bitrate Selection** | Low, Medium, High, Max (для HEVC/H.264) | Качество/объём | Размер файла |
| **Resolution** | 4K, 1080p, 720p | Разрешение | Размер файла, допустимые fps |
| **Color Space** | Rec. 709, Rec. 2020, P3 D65, BT2020 HLG10, BT2020 HDR10, Apple Log, ACES | Цветовое пространство / гамма | Сцена: Apple Log — «плоская» картинка |
| **Timecode Display** | Record Run или Time of Day (TOD) | Режим таймкода | Таймкод на экране и в клипах |
| **Timelapse Recording** | On/Off; от 1 кадра / 2 с до 1 кадра / 10 мин | Интервальная съёмка | Ускоренная запись, расчёт итоговой длительности |
| **If Media Drops Frame** | Alert или Stop Recording | Реакция на пропуск кадров | Имитация (в т. ч. ProRes 4K60 во внутреннюю память) |
| **Record Proxy** (optional) | 1920×1080 HEVC прокси к каждому клипу | Лёгкая копия для монтажа | Метаданные клипа |

## 3. Camera Settings

| Пункт | Значения | Что делает |
|---|---|---|
| **Enable Vertical Video** | On/Off | Запись вертикального видео; если выкл. — пишется горизонталь при любом положении телефона |
| **Trigger Record Indicator** | Beeper, Beeper and Flash, None | Сигнал о старте записи |
| **Use Volume Button to Trigger Record** | On/Off | Запуск записи кнопкой громкости |
| **Lock White Balance on Record** | On/Off | Блокировка ББ на время записи |
| **While Recording Swipe Right to Dim Screen** | On/Off | Затемнение экрана свайпом во время записи |
| **Shutter Measurement** | Shutter speed / Shutter angle | Выдержка в долях секунды или в градусах |
| **Flicker Free Shutter Based On** | 50 Hz / 60 Hz | Какие «безмерцающие» значения предлагать |
| **Lens Correction** | Automatic / Off | Исправление дисторсии |
| **Anamorphic De-Squeeze** | None, 1.33, 1.55 | Растяжение картинки для анаморфной насадки |
| **Flip Image for SLR Lens** | On/Off | Переворот картинки для адаптеров SLR-объективов |
| **Lock Current Orientation** | On/Off | Не поворачивать интерфейс при повороте телефона |
| **Mirror Front Facing Camera** | On/Off | Зеркалить фронтальную камеру |

## 4. Audio Settings

| Пункт | Значения | Что делает |
|---|---|---|
| **Audio Source** | None, Phone Microphone, сторонние микрофоны | Источник звука |
| **Phone Microphone** | Auto, Back, Bottom, Front | Какой микрофон телефона |
| **Audio Format** | Linear PCM, IEEE Float, AAC | Формат звука |
| **Record Audio as** | Mono, Stereo, Dual Mono, 4 Channels | Каналы |
| **Sample Rate** | Auto, 44.1 kHz, 48.0 kHz | Частота дискретизации |
| **Audio Metering** | VU (−18 dBFS), VU (−20 dBFS), PPM (−18 dBFS), PPM (−20 dBFS) | Тип индикатора уровня и опорный уровень |
| **Audio Monitoring** | On/Off | Прослушка |
| **Audio Output** | Speaker, Bluetooth | Куда выводить прослушку |

## 5. Monitor Settings

| Пункт | Значения | Что делает |
|---|---|---|
| **Focus Assist** | Peaking / Colored Lines | Способ подсветки фокуса |
| **Focus Assist Color** | White, Black, Red, Green, Blue | Цвет подсветки |
| **Guides Opacity** | 25, 50, 75, 100 % | Прозрачность рамок |
| **Guides Color** | White, Black, Red, Green, Blue | Цвет рамок |
| **Grids Opacity** | 25, 50, 75, 100 % | Прозрачность сеток |
| **HDMI Out** | Mirror Display / Video Feed | Что выводить на внешний монитор |
| **Video Feed Monitoring and Overlays** | On/Off для: Clean Feed, Status Text, Status Text Surrounds Image, Display 3D LUT, Zebra, Focus Assist, Frame Guide, Grid, Safe Area Guide, False Color | Что показывать на внешнем мониторе (имитация) |
| **Display Audio Meters** | On/Off | Показ аудиометров |
| **Display Histogram** | On/Off | Показ гистограммы |
| **Display Storage Status** | On/Off | Показ остатка места |
| **Display Upload Status** | On/Off | Показ статуса загрузки |
| **Display Battery Indicator** | On/Off | Показ батареи |

## 6. Media

| Пункт | Значения | Что делает |
|---|---|---|
| **Media Page** | сортировка: location, name, timecode, scene, shot; поиск; просмотр со скраббером; выбор, загрузка, удаление с подтверждением | Управление клипами |
| **Record Proxy** | On/Off | Прокси 1080p HEVC |
| **Upload Clips** | Proxies Only / Originals and Proxies | Что загружать в облако |
| **Live Sync** | On/Off | Синхронизация с DaVinci Resolve во время съёмки |
| **Auto Uploading to Selected Project** | On/Off | Автозагрузка в проект |
| **Enable Upload Only Over Wi‑Fi** | On/Off | Загрузка только по Wi‑Fi |
| **Save Clips to** | In-App Only, In-App and Photo Library, Files (internal or external) | Куда сохранять |
| **Save Location Data to Clip** | On/Off | Геолокация в метаданных |
| **Clip Filename Convention** | Blackmagic Camera / iOS | Схема имён файлов |

## 7. LUTs

| Пункт | Значения | Что делает |
|---|---|---|
| **Display LUT** | On/Off | LUT только на экране |
| **LUT Selection** | Import, Export, выбор из списка; Apple Log to Rec. 709 (iPhone 15 Pro / Pro Max) | Выбор LUT |
| **Record LUT to Clip** | On/Off | «Вшить» LUT в запись |
| **Color Space Tag** | Rec. 709, Rec. 2020, P3 D65 | Метка цветового пространства |

## 8. Presets
**Preset Selection:** Save New Preset, Import Preset, Export Preset (в симуляторе пресеты сохраняются в браузере).

## 9. Accessories
**Use Bluetooth:** On/Off; Nucleus Wireless Lens Control, Tentacle Sync E; Insta360 Flow Pro (NFC, Apple DockKit) — имитация.

## 10. Remote Camera Control
Remote Camera Control (On/Off) · Use this iPhone as (Controller / Remote Camera) · Camera Name · Remote Password · Camera Available for (Control and Monitor / Monitor Only) · Sync Record Across Cameras · Hide Remote Camera Video Feed · Dim Remote Cameras on Record — имитация с «виртуальными» камерами B и C.

## 11. Blackmagic Cloud
Вход в Blackmagic Cloud, папки, автоматическая и ручная загрузка в проект DaVinci Resolve, **чат** с участниками проекта — имитация.

## 12. Reset
Reset Camera Settings · Reset Camera and Cloud Settings · Reset All Settings and Erase All Content — сбрасывает симулятор.

---

## Чего НЕТ в спецификации, но есть в новых версиях приложения (по обзорам и истории версий)
Решить, включать ли:
1. **Live Stream** (v3.2): YouTube, Twitch, Vimeo, RTMP/SRT.
2. **Три программируемые кнопки** и быстрый доступ к пресетам/слейту (v3.0).
3. **AUTO-зум** с автоматическим переключением объективов и **Dolly Zoom** (v3.0).
4. **Open Gate 1920×1440** с Apple Log (v3.1.2).
5. Объектив **48 мм / 2x** (v1.3) — уже включён по вашему решению.
