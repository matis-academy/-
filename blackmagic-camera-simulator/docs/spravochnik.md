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

### Как работают колёса (по видео)
Нажатие на любой пункт верхней строки подсвечивает его синей плашкой и открывает у правого края кадра **вертикальную шкалу**:
- тонкая линейка с делениями, которую можно прокручивать пальцем вверх и вниз; мелкие подписи на ней дают точные значения;
- справа от линейки столбик **быстрых значений** или иконок пресетов; выбранное подсвечивается синим;
- слева от линейки «пузырь» с текущим значением и синяя стрелка к центральной метке;
- вверху **замок** (фиксирует значение), а у WB, TINT, фокуса и экспозиции ещё и кнопка **AUTO** (синяя, когда включена);
- если выбрать значение вручную, синий значок **A** у пункта в верхней строке исчезает.

| Пункт | Верх колонки | Быстрые значения / иконки | Линейка |
|---|---|---|---|
| **LENS** | ↺ сброс зума | 120mm, 48mm, 24mm, 13mm, **Front**; внизу иконка смены камеры | зум 0.5x…5x (пузырь «1x», «2x», «5x») |
| **FPS** | кнопка **OFF/SPEED** | — | 23.98, 24, 25, 29.97, 30, 48, 50, 59.94, 60; внизу кнопка **TIME LAPSE** |
| **SHUTTER** | замок | 1/100, 1/50, 1/33, 1/25 (без мерцания для 50 Гц) | от 1/24 до 1/8000 |
| **ISO** | замок | 3200, 1600, 800, 400, 200, 100 | точные значения (5280, 5000, 4000 … 250, 200) |
| **WB** | **AUTO** + замок | ☀ Daylight, 💡 Incandescent, лампа Fluorescent, домик Shade, ☁ Cloud | 2500K–10 000K, шаг подписей 500K |
| **TINT** | **AUTO** + замок | те же 5 пресетов | −50…+50 |

При смене модуля IRIS в верхней строке меняется сам: f/1.8 (24 и 48 мм), f/2.2 (13 мм), f/2.8 (120 мм). Под иконкой объектива в правой колонке подписывается текущий зум («0.5x», «2.0x»). Оставшееся время записи пересчитывается при смене fps: 1:52:52 при 30 к/с и 1:15:14 при 60 к/с.

### Правая колонка кнопок (сверху вниз)
| Иконка | Что открывает (по видео) | В симуляторе |
|---|---|---|
| Рамка из уголков | **Инструменты монитора**. Колонка иконок: **Zebra**, **Focus Assist**, **Grid**, **Frame Guide**, **Safe Area**, **False Color**, **Torch** (⚡ и число яркости). Нажатие выбирает инструмент (синяя плашка) и показывает его шкалу, переключатель OFF/ON вверху включает или выключает его, белая точка под иконкой значит «включён» | Кадр |
| Камера с кругом + **A** | **Фокус**: AUTO вверху, шкала 0.000–1.000 (0 = минимальная дистанция, 1 = бесконечность), внизу иконка «горы → стрелка» (вероятно, точки rack focus). Тап по кадру показывает рамку **AF**, долгое нажатие — **AE/AF** (блокировка) | Кадр |
| ± + **A** | **Экспозиция**: AUTO вверху (тогда SHUTTER и ISO получают значок A и меняются сами), шкала экспокоррекции −3.0…+3.0 EV, шаг 0.1 | Кадр |
| Большая красная кнопка | **Запись** | Кадр |
| Круг-объектив (подпись «0.5x») | то же колесо LENS | Кадр |
| **LUT** | **Панель LUT**: OFF/ON вверху; список LUT с цветными миниатюрами (у выбранного радужная рамка); внизу иконка «стрелка в камеру» = Record LUT to Clip. Когда LUT включён, в левом верхнем углу кадра появляется значок «LUT» | Кадр: каждый LUT со своим видом |
| Мишень с пунктиром (внизу) | **Стабилизация**: список **Off / Standard / Cinematic / Extreme**; при включённой стабилизации иконка синяя | Кадр: тряска и кроп |
| **⋮** слева | Колонка из трёх кнопок: **Presets**, **Slate** (хлопушка), **Remote Camera** (серая, пока Remote Camera Control выключен) | Да |
| **⋮** справа | Колонка кнопок **F1, F2, F3** (серые, если функция не назначена) | Да |

#### Инструменты монитора подробно
| Инструмент | Настройка на шкале | Как выглядит в кадре |
|---|---|---|
| **Zebra** | порог 75–100 %, под шкалой кнопки **Mid Grey** и **MG+1** (зебра на средне-сером 18 % и на +1 стоп) | диагональная штриховка поверх участков ярче порога |
| **Focus Assist** | чувствительность 0–100 % | резкие края подсвечиваются (Peaking или Colored Lines, цвет из Settings → Monitor) |
| **Grid** | 4 переключателя: Thirds, второй (вероятно, горизонт/уровень ⚠), Crosshair, Centre Dot; можно несколько | тонкие белые линии, прозрачность из Grids Opacity |
| **Frame Guide** | 9:16, 4:5, 1:1, 4:3, 14:9, 1.85:1, 2:1, 2.35:1, 2.39:1, 2.4:1, 2.76:1 | тонкие линии рамки, снаружи кадр чуть затемнён |
| **Safe Area** | 5–100 % | белый прямоугольник по центру заданного размера |
| **False Color** | — | кадр окрашивается по яркости, слева вертикальная легенда: красный (пересвет), жёлтый **95%WC**, светлый **80%WC**, розовый **MG+1**, зелёный **18%MG**, синий **NBDL**, фиолетовый **BDL**; между ними оттенки серого |
| **Torch** ⚡ | яркость фонарика 0–100 %, кнопка AUTO | ближние объекты подсвечиваются; в левом верхнем углу синий значок ⚡ |

При включённом **Record LUT to Clip** (кнопка внизу панели LUT) подпись гистограммы меняется с «Apple Log - HDR» на «Rec.709».

#### Боковые панели
**Presets**: тёмная полупрозрачная карточка «Presets». Пока пресетов нет, в ней текст «No presets currently created. Create a preset using your current settings by pressing the + icon». Внизу кнопки: **+** (сохранить текущие настройки как пресет), **✓** (применить), **↻** (перезаписать), **✎** (переименовать), **🗑** (удалить).

**Slate**: полноэкранная панель с крестиком закрытия и двумя страницами. На первой: **SLATE FOR** (Next Clip) и **LENS DATA** (например, «iPhone 15 Pro Max 13mm»); большие переключатели **REEL ‹ 1 ›**, **SCENE ‹ 1 ›**, **TAKE ‹ 1 ›**; кнопки **Good Take Last Clip**, **Interior / Exterior**, **Day / Night**. На второй, по спецификации, Production Name, Camera Ident, Director, Camera Operator.

**Тап по кадру** показывает рамку **AE/AF**: фокус и экспозиция по этой точке.

Как выглядят LUT на видео: **Rec 709 Neutral** — нормальный контраст; **Cinema Teal** — тёплая кожа и бирюзовые тени; **Day Night** — тёмно-синяя «ночь»; **Dusty** — блёклый, выцветший; **Monochrome** — чёрно-белый; **Nature** — светлый, пастельный. По третьему видео: **Nature** — тёплый, насыщенный оранжевый; **Paloma** — золотистый. Nostalgic, Rift, Vivid и Warm Fade подберу по названию. Без LUT картинка в Apple Log серая и плоская.

### Нижние панели
| Панель | Что показывает | По нажатию |
|---|---|---|
| **Гистограмма** (подпись — цветовое пространство, например «Apple Log - HDR») | RGB-гистограмма + индикаторы клиппинга | Большой оверлей с RGB-графиками по каналам, линиями 0–100 % и шкалой 0…1023; ползунок прозрачности (100 %) и три точки-страницы |
| **Internal Storage** | оставшееся время (1:52:52), заполнение (10 %), свободно (51GB) | — |
| **iPhone Microphone** | аудиометры каналов 1 и 2, шкала −45…+3 | Крупный оверлей «iPhone Microphone» |
| **4K 16:9** и **батарея** (вверху справа) | формат записи и заряд | — |

### Жесты (из спецификации)
Свайп вверх/вниз скрывает и показывает HUD. Свайп вправо во время записи затемняет экран. Тап по кадру ставит автофокус.

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
**Media** (по видео): вверху кнопка боковой панели, заголовок «No project selected - All Clips» и иконки: фильтр, выбор клипов, сортировка, облако. Ниже сетка миниатюр в 4 колонки, на каждой длительность («00:01», «15:06»), под ней имя клипа вида **A001_10111718_C019**: камера A, катушка 001, дата и время (ММДДЧЧММ), номер клипа C019. По спецификации ещё есть сортировка по location/name/timecode/scene/shot, поиск, просмотр со скраббером, загрузка и удаление с подтверждением. В симуляторе каждый записанный клип будет появляться здесь со своими параметрами.

**Chat**: логотип Blackmagic Cloud, текст «Log in to Blackmagic Cloud to access your projects chat.» и синяя кнопка **Log In**. В симуляторе кнопка будет показывать имитацию чата проекта.

**Settings в горизонтальной ориентации**: экран делится на две части, слева список разделов (Record, Camera, Media, Audio, Monitor, Live Stream, Function Buttons, LUTs…), справа пункты выбранного раздела.

---

## Что осталось неизвестным
1. Вторая иконка в выборе сетки: сделаю как «горизонт» и помечу.
2. Список функций для **F1–F3**: возьму основные инструменты (Zebra, Focus Assist, False Color, Frame Guide, LUT, Clean Feed, Torch, Stabilization) и помечу как примерный.
3. Вторая страница Slate и экран Reset: сделаю по спецификации.
