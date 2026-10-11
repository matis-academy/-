# Справочник Blackmagic Camera 3.5 (iPhone) для симулятора

**Источники:**
1. Скриншоты приложения **Blackmagic Camera 3.5.200045** на iPhone, папка `screenshots/` (IMG_0097–0143). Это основной источник по названиям, порядку пунктов и значениям.
2. Официальный документ «Blackmagic Camera for iOS — Technical Specifications», файл `blackmagic-camera-ios-techspecs.pdf`. Это источник по диапазонам значений главного экрана (выдержка, ISO, ББ, фокус и т. д.).

**Устройство в симуляторе:** iPhone 15 Pro Max. Модули: 0.5x (13 мм f/2.2), 1x (24 мм f/1.78), 2x (48 мм, кроп основного), 5x (120 мм f/2.8), Front (f/1.9).
**Язык:** названия пунктов на английском, как в приложении; пояснения на русском.

Пометки в колонке «В симуляторе»:
- **Кадр:** настройка видимо меняет картинку, звук или индикаторы.
- **Имитация:** настройка переключается и запоминается, у неё есть описание, но реального действия нет (сеть, Bluetooth, HDMI, облако).
- **⚠ нужен скриншот:** вида этого элемента у меня пока нет.

---

## Навигация
Внизу (в портретной ориентации) или справа (в горизонтальной) расположена панель из 4 вкладок: **Camera · Media · Chat · Settings**. Активная вкладка подсвечена синей плашкой.

## 1. Вкладка Camera: главный экран

### Верхняя строка (HUD)
| Элемент | Пример | Значения (из спецификации) | Что делает | В симуляторе |
|---|---|---|---|---|
| **LENS** | 24mm | 13 / 24 / 48 / 120 мм, Front | Текущий модуль (фокусное расстояние) | Кадр |
| **FPS** | 30 | 23.98, 24, 25, 29.97, 30, 48, 59.94, 60, 100, 120; Off Speed 4–60 | Частота кадров | Кадр |
| **SHUTTER** [A] | 1/49 | 1/24 … 1/8000 или 1.1°–360°; Auto/Lock | Выдержка. Синий значок **A** означает автоматический режим | Кадр: смаз, яркость, мерцание |
| **IRIS** | f/1.8 (серый) | фиксирована | Диафрагма. На iPhone не меняется, поэтому показана серым | Кадр: своя у каждого модуля |
| **Таймкод** | 00:00:01:15 | Record Run / TOD | Длительность клипа или время суток | Кадр |
| **ISO** [A] | 614 | ISO 21–5472; Auto/Manual | Чувствительность | Кадр: яркость и шум |
| **WB** [A] | 4830K | Auto / Locked / Manual 2500–10 000K; пресеты Cloud, Shade, Fluorescent, Incandescent, Daylight | Баланс белого | Кадр |
| **TINT** [A] | 11 | −50…+50 | Сдвиг зелёный ↔ пурпурный | Кадр |
| **4K / 16:9** | — | — | Разрешение и формат записи | Кадр |
| **Батарея** | 30% | — | Заряд | Кадр |

### Правая колонка кнопок (сверху вниз в горизонтальной ориентации)
| Иконка | Предположительно | В симуляторе |
|---|---|---|
| Рамка из уголков | инструменты монитора / полноэкранный режим | ⚠ нужен скриншот |
| Камера с кругом + **A** | автофокус (A = авто) | ⚠ нужен скриншот |
| ± + **A** | экспозиция / экспокоррекция ±3 стопа | ⚠ нужен скриншот |
| Большая красная кнопка | **Запись** | Кадр |
| Круг-объектив | выбор объектива / зум | ⚠ нужен скриншот |
| **LUT** | быстрое переключение LUT | ⚠ нужен скриншот |
| Мишень с точками | фокус: ручной, rack focus | ⚠ нужен скриншот |
| **⋮** слева и справа | выдвижные панели (быстрый доступ к пресетам/слейту, функциональные кнопки) | ⚠ нужен скриншот |

### Нижние панели
| Панель | Что показывает | В симуляторе |
|---|---|---|
| **Гистограмма** (подпись: цветовое пространство, например «Apple Log - HDR») | RGB-гистограмма + индикаторы клиппинга | Кадр, по реальной картинке |
| **Internal Storage** | оставшееся время записи (1:53:46), заполнение (10 %), свободно (51GB) | Кадр: пересчёт по кодеку и разрешению |
| **iPhone Microphone** | аудиометры каналов 1 и 2, шкала −45…+3 | Кадр |

### Жесты и прочее (из спецификации)
Свайп вверх/вниз скрывает и показывает HUD. Свайп вправо во время записи затемняет экран. Тап по кадру ставит автофокус. Тап по аудиометру увеличивает его. В режиме фокуса есть три точки rack focus. Зебра 75–100 %, Focus Assist 1–100 %, сетки (Thirds, Crosshair, Centre Dot), рамки кадра (9:16, 4:5, 1:1, 4:3, 14:9, 1.85:1, 2:1, 2.35:1, 2.39:1, 2.4:1, 2.76:1), Safe Area 5–100 %, False Color, Stabilization (Off, Standard, Cinematic, Extreme). **⚠ Где именно включаются эти инструменты, нужен скриншот.**

---

## 2. Вкладка Settings
Это один длинный список с разделами. Пункты со стрелкой **›** открывают отдельный экран со списком вариантов и галочкой у выбранного.

### Record
| Пункт | По умолчанию на скриншоте | Варианты | Что делает |
|---|---|---|---|
| Codec | HEVC (H.265) | Apple ProRes 422 HQ, Apple ProRes 422, Apple ProRes 422 LT, Apple ProRes 422 Proxy, HEVC (H.265), H.264. На том же экране для HEVC/H.264 есть **Bit Rate**: Max (54Mbps), High (36Mbps), Medium (27Mbps), Low (18Mbps) | Формат сжатия. ProRes даёт большие файлы и лучшее качество для монтажа, HEVC компактный |
| Resolution | 4K | 4K, HD, 720p, Open Gate | Разрешение. Open Gate использует всю площадь сенсора (4:3) |
| Color Space | Apple Log - HDR | Rec.709, Rec.2020 - HDR, P3 D65, Apple Log - HDR | Цветовое пространство. Apple Log выглядит «плоским» и нужен для цветокоррекции |
| HDR Video | вкл. | вкл./выкл. | Запись в HDR |
| Timelapse Recording | выкл. | вкл./выкл. | Интервальная съёмка |
| Capture 1 Frame Every | 1 Minute (неактивно) | от 2 секунд до 10 минут | Интервал таймлапса |
| Trigger Record Indicator | None | Beeper, Beeper and Flash, None | Сигнал о старте записи |
| Use Volume Button to Trigger Record | вкл. | — | Кнопка громкости запускает запись |
| Swipe Right to Dim Screen While Recording | вкл. | — | Затемнение экрана свайпом |
| Lock White Balance on Record | вкл. | — | ББ не «плывёт» во время записи |
| If Media Drops Frame | Alert | Alert, Stop Recording | Реакция на пропуск кадров |
| Timecode Display | Record Run | Record Run, Time of Day (TOD) | Режим таймкода |
| Reference Source | None (неактивно) | — | Внешний источник таймкода (Tentacle Sync) |

### Camera
| Пункт | По умолчанию | Варианты | Что делает |
|---|---|---|---|
| Cinematic Mode | выкл. | «Records a depth of field effect to the clip.» | Программное размытие фона |
| Enable Vertical Video | вкл. | — | Вертикальное видео |
| Lock Current Orientation | вкл. | — | Не поворачивать интерфейс |
| Mirror Front-Facing Camera | вкл. | — | Зеркалить фронталку |
| Shutter Measurement | Speed | Speed, Angle | Выдержка в долях секунды или в градусах |
| Flicker Free Shutter Based On | 50Hz | 50Hz, 60Hz | Какие значения выдержки не дают мерцания ламп |
| Iris Measurement | Fraction | Fraction, Decimal | Как писать диафрагму (f/1.8 или 1.8) |
| Lens Correction | вкл. | — | Исправление дисторсии (особенно 0.5x) |
| Use External Lens | выкл. | — | Насадочный объектив |
| Anamorphic De-Squeeze | None | None, 1.33, 1.55, 2.00 | Растяжение для анаморфной насадки |
| Flip Image for SLR Lens | выкл. | — | Переворот кадра для SLR-адаптера |

### Media
| Пункт | По умолчанию | Варианты | Что делает |
|---|---|---|---|
| Save Clips to | In-App and Photo Library | In-App Only, In-App and Photo Library, Files ›, Pro Video Storage (For ProRes codecs); кнопка Configure Pro Video Storage | Куда сохранять клипы |
| Save Location Data to Clip | вкл. | — | Геолокация в метаданных |
| Filename Convention | Blackmagic Camera | Blackmagic Camera, iOS | Схема имён файлов |
| Record Proxy | вкл. | — | Лёгкая копия 1080p для монтажа |
| Proxy Clip Manager | › | «14 Clips 15,6 GB», Delete Proxy Clips | Управление прокси |
| Auto Upload To Selected Project | вкл. | — | Автозагрузка в Blackmagic Cloud |
| Upload Clips | Proxies Only | Proxies Only, Originals and Proxies | Что загружать |
| Live Sync | вкл. | — | Синхронизация с DaVinci Resolve |
| Enable Upload Only Over Wi-Fi | выкл. | — | Не тратить мобильный трафик |

### Audio
| Пункт | По умолчанию | Варианты | Что делает |
|---|---|---|---|
| Audio Source | iPhone Microphone | None, iPhone Microphone (+ внешние, если подключены) | Источник звука |
| iPhone Microphone | Auto | Auto, Back, Bottom, Front | Какой микрофон телефона |
| Audio Format | IEEE Float | Linear PCM, IEEE Float, AAC | Формат звука |
| Record Audio as | Stereo | Mono, Stereo, Dual Mono, 4 Channels | Каналы |
| Sample Rate | Auto | Auto, 44.1 kHz, 48.0 kHz, 96.0 kHz, 192.0 kHz | Частота дискретизации |
| Audio Metering | VU (-18dBFS) | VU (-18dBFS), VU (-20dBFS), PPM (-18dBFS), PPM (-20dBFS) | Тип индикатора и опорный уровень |
| Audio Monitor | вкл. | — | Прослушка |
| Audio Output | Speaker | Speaker (+ Bluetooth/AirPlay) | Куда выводить прослушку |

### Monitor
| Пункт | По умолчанию | Варианты |
|---|---|---|
| Focus Assist | Colored Lines | Peaking, Colored Lines |
| Focus Assist Color | Red | White, Black, Red, Green, Blue |
| Guides Opacity | 25% | 25%, 50%, 75%, 100% |
| Guides Color | White | White, Black, Red, Green, Blue |
| Grids Opacity | 25% | 25%, 50%, 75%, 100% |
| HDMI Out | Mirror Display | Mirror Display, Video Feed. Для Video Feed переключатели: Clean Feed, Status Text, Text Surrounds Image, Display LUT, Zebra, Focus Assist, Frame Guide, Grid, Safe Area Guide, False Color, Limit Monitoring to HD (имитация) |
| Display Audio Meters | вкл. | показывать панель звука |
| Display Histogram | вкл. | показывать гистограмму |
| Display Storage Status | вкл. | показывать панель носителя |
| Display Stream Status | вкл. | показывать статус трансляции |
| Display Upload Status | выкл. | показывать статус загрузки |
| Display Battery Indicator | вкл. | показывать батарею |

### Live Stream (имитация)
Platform: Blackmagic Cloud, YouTube, Twitch, Vimeo + Import Stream Settings · Log in to Blackmagic Cloud › · Live Stream (переключатель, активен после входа).

### Function Buttons
Function Buttons (вкл.) · F1 › · F2 › · F3 › (по умолчанию None). **⚠ Нужен скриншот списка функций, которые можно назначить.**

### LUTs
LUTs Manager (11) ›: Enable Blackmagic LUTs; встроенные LUT с переключателями: **Rec 709 Neutral, Cinema Teal, Day Night, Dusty, Monochrome, Nature, Nostalgic, Paloma, Rift, Vivid, Warm Fade**; кнопки Import LUT, Export LUT, Remove LUTs.
Record LUT to Clip: «вшить» LUT в запись (по спецификации ещё Display LUT и Color Space Tag). В симуляторе каждый LUT будет иметь свой характерный вид.

### Remote Camera Control (имитация)
Remote Camera Control · Use This iPhone as (Controller / Remote Camera) · Camera Name (A) · Remote Password · Camera Available for (Control and Monitor / Monitor Only) · Sync Clips To Controller after Record · Remote Cameras Manager · Sync Record Across Cameras · Hide Remote Camera Video Feed · Dim Remote Cameras on Record.

### Presets
Preset Selection ›: **Save New Preset, Import Preset, Export Preset, Overwrite Preset**. В симуляторе пресеты сохраняются в браузере.

### Accessories (имитация)
Use Bluetooth · Nucleus Wireless Lens Control (None ›).

### Network Access (имитация)
HTTP Server ›.

### Blackmagic Cloud (имитация)
Log in to Blackmagic Cloud ›.

### Reset
Reset Blackmagic Cam Settings ›: Reset Camera Settings, Reset Camera and Cloud Settings, Reset All Settings and Erase All Content (по спецификации). В симуляторе сбрасывает настройки.

### About
App Version 3.5.200045 · Learn More at Blackmagicdesign.com · кнопка Open Blackmagic Cam Settings.

---

## 3. Вкладки Media и Chat
По спецификации на вкладке Media есть сортировка по location/name/timecode/scene/shot, поиск, превью со скраббером, выбор, загрузка и удаление с подтверждением. Chat — это чат с участниками проекта DaVinci Resolve в Blackmagic Cloud. **⚠ Нужны скриншоты обеих вкладок.**

---

## Ещё нужны скриншоты (главный экран)
1. Нажатие на каждый пункт верхней строки: **LENS, FPS, SHUTTER, ISO, WB, TINT**, а также на **4K/16:9**, батарею и таймкод.
2. Нажатие на каждую иконку правой колонки (7 штук) и на панели **⋮** слева и справа.
3. Нажатие на гистограмму, панель носителя и аудиометры.
4. Где включаются зебра, false color, сетки, рамки кадра, стабилизация (вероятно, в одном из этих меню).
5. Список функций для **F1** (Settings → Function Buttons → F1).
6. Вкладки **Media** (с парой клипов и открытым клипом) и **Chat**.
7. Экран **Reset Blackmagic Cam Settings**.
