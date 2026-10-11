  /* =====================================================================
   *  НАСТРОЙКИ (вкладка Settings) — порядок и названия как в приложении 3.5
   *  t: sel — выбор из списка (экран с галочкой), tog — переключатель,
   *     link — открывает отдельный экран, info — только значение, btn — кнопка
   *  h: справка (RU), sim: что происходит в симуляторе
   * ===================================================================== */
  var CODECS = [
    ['prores422hq', 'Apple ProRes 422 HQ'], ['prores422', 'Apple ProRes 422'], ['prores422lt', 'Apple ProRes 422 LT'],
    ['proresproxy', 'Apple ProRes 422 Proxy'], ['hevc', 'HEVC (H.265)'], ['h264', 'H.264']
  ];
  /* Мбит/с для 3840×2160 при 30 к/с (ProRes — по данным Apple) */
  var CODEC_RATE = { prores422hq: 707, prores422: 471, prores422lt: 328, proresproxy: 145 };
  var BITRATES = [['max', 'Max (54Mbps)', 54], ['high', 'High (36Mbps)', 36], ['medium', 'Medium (27Mbps)', 27], ['low', 'Low (18Mbps)', 18]];

  var SETTINGS = [
    { id: 'record', title: 'Record', groups: [
      [
        { k: 'codec', l: 'Codec', t: 'sel', o: CODECS,
          k2: 'bitrate', l2: 'Bit Rate', o2: BITRATES.map(function (b) { return [b[0], b[1]]; }), show2: function (S) { return S.codec === 'hevc' || S.codec === 'h264'; },
          h: 'Кодек — способ сжатия видео. Apple ProRes (422 HQ, 422, LT, Proxy) почти не сжимает картинку: файлы огромные, но удобны для монтажа и цветокоррекции. HEVC (H.265) и H.264 сжимают сильно: файлы в 10–20 раз меньше. Для HEVC и H.264 на этом же экране выбирается битрейт (Bit Rate).',
          tip: 'Для Apple Log и цветокоррекции — ProRes 422 HQ или 422. Для соцсетей и долгих съёмок — HEVC. На iPhone 15 Pro ProRes 4K 60 к/с пишется только на внешний диск.' },
        { k: 'resolution', l: 'Resolution', t: 'sel', o: [['4k', '4K'], ['hd', 'HD'], ['720p', '720p'], ['opengate', 'Open Gate']],
          h: 'Разрешение записи: 4K — 3840×2160, HD — 1920×1080, 720p — 1280×720. Open Gate — 1920×1440 (4:3) со всей площади сенсора, удобно, чтобы потом кадрировать и в горизонталь, и в вертикаль.',
          tip: '100 и 120 к/с доступны только в HD. Open Gate работает с Apple Log.' },
        { k: 'colorspace', l: 'Color Space', t: 'sel', o: [['rec709', 'Rec.709'], ['rec2020', 'Rec.2020 - HDR'], ['p3', 'P3 D65'], ['applelog', 'Apple Log - HDR']],
          h: 'Цветовое пространство и гамма записи. Rec.709 — обычное видео «как есть». Rec.2020 - HDR и P3 D65 — расширенный цвет для HDR-экранов. Apple Log — «плоская» логарифмическая картинка: максимум деталей в светах и тенях, но без цветокоррекции или LUT выглядит серой.',
          tip: 'Apple Log выбирают, когда будут красить материал в DaVinci Resolve. Для монитора включите LUT Rec 709 Neutral.' },
        { k: 'hdr', l: 'HDR Video', t: 'tog', h: 'Записывать видео с HDR-метаданными: светлые участки сохраняют больше деталей и на HDR-экране выглядят ярче.', sim: 'В симуляторе мягче «сворачиваются» пересветы.' },
        { k: 'timelapse', l: 'Timelapse Recording', t: 'tog', h: 'Интервальная (покадровая) съёмка: камера снимает 1 кадр через заданный интервал. Облака, толпа, закат «ускоряются» в сотни раз.' },
        { k: 'tlInterval', l: 'Capture 1 Frame Every', t: 'sel', dis: function (S) { return !S.timelapse; },
          o: [['2s', '2 Seconds'], ['5s', '5 Seconds'], ['10s', '10 Seconds'], ['30s', '30 Seconds'], ['1m', '1 Minute'], ['5m', '5 Minutes'], ['10m', '10 Minutes']],
          h: 'Интервал таймлапса: от 1 кадра каждые 2 секунды до 1 кадра каждые 10 минут. Пример: интервал 2 с и проект 25 к/с — 1 минута съёмки даст 1,2 секунды видео.' }
      ],
      [
        { k: 'trigger', l: 'Trigger Record Indicator', t: 'sel', page: 'Camera', o: [['beeper', 'Beeper'], ['beeperflash', 'Beeper and Flash'], ['none', 'None']],
          h: 'Сигнал о начале записи: звуковой (Beeper), звук и вспышка фонарика (Beeper and Flash) или без сигнала. Удобно, когда камера далеко или вы в кадре.', sim: 'Звук пиликает, вспышка — белое мигание экрана.' },
        { k: 'volumeRec', l: 'Use Volume Button to Trigger Record', t: 'tog', h: 'Кнопки громкости iPhone запускают и останавливают запись — не нужно касаться экрана и трясти камеру.', sim: 'В симуляторе — клавиши ↑ / ↓ или пробел.' },
        { k: 'swipeDim', l: 'Swipe Right to Dim Screen While Recording', t: 'tog', h: 'Во время записи свайп вправо по экрану затемняет его: экономит батарею и не слепит в темноте.', sim: 'Свайп вправо по кадру во время записи.' },
        { k: 'lockWbRec', l: 'Lock White Balance on Record', t: 'tog', h: 'С началом записи автоматический баланс белого фиксируется, чтобы цвет не «плыл» посреди дубля.' },
        { k: 'dropFrame', l: 'If Media Drops Frame', t: 'sel', o: [['alert', 'Alert'], ['stop', 'Stop Recording']],
          h: 'Что делать, если носитель не успевает записывать и пропускает кадры: показать предупреждение (Alert) или остановить запись (Stop Recording).', sim: 'Пропуск кадров случается при ProRes 4K выше 30 к/с во внутреннюю память.' }
      ],
      [
        { k: 'tcDisplay', l: 'Timecode Display', t: 'sel', o: [['rr', 'Record Run'], ['tod', 'Time of Day (TOD)']],
          h: 'Режим таймкода. Record Run — счёт идёт только во время записи и продолжается с того места, где остановился. Time of Day — таймкод равен текущему времени; нужен для синхронизации нескольких камер и звука.' },
        { k: 'refSource', l: 'Reference Source', t: 'sel', dis: function () { return true; }, o: [['none', 'None']],
          h: 'Внешний источник таймкода (например, Tentacle Sync E по Bluetooth). Доступен, когда включён Bluetooth и подключено устройство.' }
      ]
    ] },
    { id: 'camera', title: 'Camera', groups: [
      [
        { k: 'cinematic', l: 'Cinematic Mode', sub: 'Records a depth of field effect to the clip.', t: 'tog',
          h: 'Кинематографический режим iPhone: программно размывает фон за объектом, имитируя малую глубину резкости большой камеры.', sim: 'Фон заметно размывается.' }
      ],
      [
        { k: 'vertical', l: 'Enable Vertical Video', t: 'tog', h: 'Разрешает запись вертикального видео, когда телефон держат вертикально. Если выключено, видео всегда пишется горизонтальным.' },
        { k: 'lockOrient', l: 'Lock Current Orientation', t: 'tog', h: 'Сохраняет текущую ориентацию интерфейса, даже если телефон повернуть.' },
        { k: 'mirrorFront', l: 'Mirror Front-Facing Camera', t: 'tog', h: 'Зеркалит изображение фронтальной камеры, как в зеркале.', sim: 'Работает при выборе модуля Front.' }
      ],
      [
        { k: 'shutterMeas', l: 'Shutter Measurement', t: 'sel', o: [['speed', 'Speed'], ['angle', 'Angle']],
          h: 'Как показывать выдержку: Speed — долями секунды (1/50), Angle — углом затвора в градусах (180°), как на кинокамерах. 180° = выдержка 1/(2×fps) при любой частоте кадров.' },
        { k: 'flickerHz', l: 'Flicker Free Shutter Based On', t: 'sel', o: [['50', '50Hz'], ['60', '60Hz']],
          h: 'Частота электросети, под которую подбираются «безмерцающие» значения выдержки в колесе SHUTTER. В России и Европе — 50 Гц (выдержки 1/50, 1/100, 1/33, 1/25), в США — 60 Гц (1/60, 1/120, 1/40, 1/30).' },
        { k: 'irisMeas', l: 'Iris Measurement', t: 'sel', o: [['fraction', 'Fraction'], ['decimal', 'Decimal']],
          h: 'Как показывать диафрагму: Fraction — f/1.8, Decimal — 1.8.' }
      ],
      [
        { k: 'lensCorr', l: 'Lens Correction', t: 'tog', h: 'Программно исправляет дисторсию объектива — особенно заметную бочку у сверхширокого модуля 0.5x.', sim: 'Выключите и выберите 13 мм: прямые линии изогнутся.' },
        { k: 'extLens', l: 'Use External Lens', t: 'tog', h: 'Режим для насадочных объективов (анаморфных, широкоугольных), которые надеваются на iPhone.' },
        { k: 'desqueeze', l: 'Anamorphic De-Squeeze', t: 'sel', o: [['1', 'None'], ['1.33', '1.33'], ['1.55', '1.55'], ['2', '2.00']],
          h: 'Растягивает изображение для анаморфной насадки, которая «сжимает» картинку по горизонтали. Коэффициент должен совпадать с насадкой: 1.33, 1.55 или 2.00.', tip: 'Без насадки включать нельзя — все люди станут широкими.' },
        { k: 'flipSlr', l: 'Flip Image for SLR Lens', t: 'tog', h: 'Переворачивает изображение для адаптеров зеркальных объективов, которые дают перевёрнутую картинку.' }
      ]
    ] },
    { id: 'media', title: 'Media', groups: [
      [
        { k: 'saveTo', l: 'Save Clips to', t: 'sel', o: [['inapp', 'In-App Only'], ['inappphotos', 'In-App and Photo Library'], ['files', 'Files'], ['external', 'Pro Video Storage']],
          subs: { external: 'For ProRes codecs' },
          h: 'Куда сохранять клипы: только в приложении, в приложении и в «Фото», в «Файлы» или на внешний носитель (Pro Video Storage — SSD через USB-C, для ProRes).',
          tip: 'Для ProRes 4K 60 к/с на iPhone 15 Pro нужен внешний SSD.' },
        { k: 'saveLoc', l: 'Save Location Data to Clip', t: 'tog', h: 'Записывать координаты GPS в метаданные клипа.' },
        { k: 'filename', l: 'Filename Convention', t: 'sel', o: [['bm', 'Blackmagic Camera'], ['ios', 'iOS']],
          h: 'Схема имён файлов. Blackmagic Camera: A001_10111718_C019 — камера A, катушка 001, дата и время (ММДДЧЧММ), клип 19. iOS: IMG_0123.' }
      ],
      [
        { k: 'proxy', l: 'Record Proxy', t: 'tog', h: 'Одновременно с оригиналом записывать лёгкую копию 1920×1080 HEVC (прокси) — для быстрой загрузки в облако и монтажа.' },
        { l: 'Proxy Clip Manager', t: 'link', page: 'proxy', h: 'Сколько прокси-файлов хранится и сколько места они занимают; кнопка Delete Proxy Clips удаляет их.' }
      ],
      [
        { k: 'autoUpload', l: 'Auto Upload To Selected Project', t: 'tog', h: 'Автоматически загружать снятые клипы в выбранный проект Blackmagic Cloud.' },
        { k: 'uploadClips', l: 'Upload Clips', t: 'sel', o: [['proxies', 'Proxies Only'], ['both', 'Originals and Proxies']], h: 'Что загружать в облако: только прокси или оригиналы вместе с прокси.' },
        { k: 'liveSync', l: 'Live Sync', t: 'tog', h: 'Клипы появляются у монтажёра в DaVinci Resolve прямо во время съёмки через Blackmagic Cloud.' },
        { k: 'wifiOnly', l: 'Enable Upload Only Over Wi-Fi', t: 'tog', h: 'Загружать только по Wi-Fi и не тратить мобильный интернет.' }
      ]
    ] },
    { id: 'audio', title: 'Audio', groups: [
      [
        { k: 'audioSrc', l: 'Audio Source', t: 'sel', o: [['none', 'None'], ['iphone', 'iPhone Microphone']], h: 'Источник звука: без звука (None), встроенный микрофон iPhone или подключённый внешний микрофон.', sim: 'При None аудиометры пустые, клипы без звука.' },
        { k: 'iphoneMic', l: 'iPhone Microphone', t: 'sel', o: [['auto', 'Auto'], ['back', 'Back'], ['bottom', 'Bottom'], ['front', 'Front']],
          h: 'Какой из микрофонов iPhone использовать: задний (рядом с камерами, слышит то, что в кадре), нижний (у разъёма) или передний (у динамика, для съёмки себя).' }
      ],
      [
        { k: 'audioFmt', l: 'Audio Format', t: 'sel', o: [['pcm', 'Linear PCM'], ['float', 'IEEE Float'], ['aac', 'AAC']],
          h: 'Формат звука. Linear PCM и IEEE Float — без потерь, для монтажа; IEEE Float почти невозможно «перегрузить» при обработке. AAC — сжатый, файлы меньше.' },
        { k: 'audioCh', l: 'Record Audio as', t: 'sel', o: [['mono', 'Mono'], ['stereo', 'Stereo'], ['dualmono', 'Dual Mono'], ['4ch', '4 Channels']],
          h: 'Сколько каналов записывать: Mono, Stereo, Dual Mono (один сигнал в двух каналах — второй можно записать тише как страховку) или 4 канала.' },
        { k: 'sampleRate', l: 'Sample Rate', t: 'sel', o: [['auto', 'Auto'], ['44.1', '44.1 kHz'], ['48', '48.0 kHz'], ['96', '96.0 kHz'], ['192', '192.0 kHz']],
          h: 'Частота дискретизации. Для видео стандарт — 48 kHz.' }
      ],
      [
        { k: 'metering', l: 'Audio Metering', t: 'sel', o: [['vu18', 'VU (-18dBFS)'], ['vu20', 'VU (-20dBFS)'], ['ppm18', 'PPM (-18dBFS)'], ['ppm20', 'PPM (-20dBFS)']],
          h: 'Тип индикатора уровня. VU — «усреднённый», медленный, показывает громкость на слух. PPM — пиковый, быстрый, ловит короткие всплески. Число — опорный уровень (−18 или −20 dBFS), на который ориентируются при записи речи.', sim: 'Меняется скорость стрелки и метка опорного уровня.' },
        { k: 'audioMon', l: 'Audio Monitor', t: 'tog', h: 'Прослушивать звук во время записи — в наушниках или динамике.' },
        { k: 'audioOut', l: 'Audio Output', t: 'sel', o: [['speaker', 'Speaker']], h: 'Куда выводится прослушка: динамик iPhone или подключённые наушники (в том числе Bluetooth/AirPlay).' }
      ]
    ] },
    { id: 'monitor', title: 'Monitor', groups: [
      [
        { k: 'faMode', l: 'Focus Assist', t: 'sel', o: [['peaking', 'Peaking'], ['lines', 'Colored Lines']],
          h: 'Способ подсветки резкости. Peaking — резкие края «светятся». Colored Lines — резкие края обводятся цветными линиями (цвет — в Focus Assist Color).' },
        { k: 'faColor', l: 'Focus Assist Color', t: 'sel', o: [['white', 'White'], ['black', 'Black'], ['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']], h: 'Цвет линий фокус-ассиста. Выбирайте цвет, которого мало в кадре.' },
        { k: 'guidesOp', l: 'Guides Opacity', t: 'sel', o: [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']], h: 'Насколько затемняется область за рамкой кадра (Frame Guide).' },
        { k: 'guidesColor', l: 'Guides Color', t: 'sel', o: [['white', 'White'], ['black', 'Black'], ['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']], h: 'Цвет линий рамки кадра и Safe Area.' },
        { k: 'gridsOp', l: 'Grids Opacity', t: 'sel', o: [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']], h: 'Прозрачность линий сетки (трети, перекрестие, точка).' }
      ],
      [
        { k: 'hdmi', l: 'HDMI Out', t: 'sel', o: [['mirror', 'Mirror Display'], ['feed', 'Video Feed']], page: 'Monitor',
          h: 'Что выводить на внешний монитор через переходник USB-C → HDMI: копию экрана (Mirror Display) или чистое видео (Video Feed) с выбранными поверх него элементами (Clean Feed, Status Text, Zebra, Frame Guide и др.).', sim: 'Имитация: внешнего монитора в симуляторе нет.' }
      ],
      [
        { k: 'dispAudio', l: 'Display Audio Meters', t: 'tog', h: 'Показывать панель аудиометров внизу экрана.' },
        { k: 'dispHist', l: 'Display Histogram', t: 'tog', h: 'Показывать гистограмму внизу экрана.' },
        { k: 'dispStorage', l: 'Display Storage Status', t: 'tog', h: 'Показывать панель носителя: сколько минут записи осталось и сколько места свободно.' },
        { k: 'dispStream', l: 'Display Stream Status', t: 'tog', h: 'Показывать статус прямой трансляции.' },
        { k: 'dispUpload', l: 'Display Upload Status', t: 'tog', h: 'Показывать статус загрузки клипов в облако.' },
        { k: 'dispBattery', l: 'Display Battery Indicator', t: 'tog', h: 'Показывать заряд батареи в правом верхнем углу.' }
      ]
    ] },
    { id: 'livestream', title: 'Live Stream', groups: [
      [
        { k: 'platform', l: 'Platform', t: 'sel', o: [['bmcloud', 'Blackmagic Cloud'], ['youtube', 'YouTube'], ['twitch', 'Twitch'], ['vimeo', 'Vimeo']], page: 'Live Stream',
          h: 'Куда вести прямую трансляцию: Blackmagic Cloud, YouTube, Twitch или Vimeo. Кнопка Import Stream Settings загружает файл с ключом трансляции (например, из ATEM).' },
        { l: 'Log in to Blackmagic Cloud', t: 'link', page: 'cloud', h: 'Вход в учётную запись Blackmagic Cloud — нужен для трансляции, облачных проектов и чата.' },
        { k: 'liveStream', l: 'Live Stream', t: 'tog', dis: function (S) { return !S.cloudLogged; }, h: 'Запуск трансляции. Становится доступным после входа в аккаунт выбранной платформы.' }
      ]
    ] },
    { id: 'fbuttons', title: 'Function Buttons', groups: [
      [
        { k: 'fbOn', l: 'Function Buttons', t: 'tog', h: 'Показывать программируемые кнопки F1, F2, F3 в правой выдвижной панели (⋮ справа).' },
        { k: 'f1', l: 'F1', t: 'sel', o: null, h: 'Функция кнопки F1 — быстрый доступ к инструменту одним нажатием.' },
        { k: 'f2', l: 'F2', t: 'sel', o: null, h: 'Функция кнопки F2.' },
        { k: 'f3', l: 'F3', t: 'sel', o: null, h: 'Функция кнопки F3.' }
      ]
    ] },
    { id: 'luts', title: 'LUTs', groups: [
      [
        { l: 'LUTs Manager', t: 'link', page: 'luts', val: function (S) { return String(S.lutEnabled.filter(Boolean).length); },
          h: 'Список LUT: встроенные Blackmagic LUTs (можно отключить ненужные), импорт своих файлов .cube, экспорт и удаление.' },
        { k: 'recLut', l: 'Record LUT to Clip', t: 'tog', dis: function (S) { return !S.lutOn; },
          h: '«Вшить» LUT в запись: клип сразу будет с этим видом, исходную Log-картинку уже не вернуть. Если выключено, LUT только на экране, а в файл пишется исходный сигнал.', tip: 'Под цветокоррекцию LUT обычно НЕ вшивают.' }
      ]
    ] },
    { id: 'remote', title: 'Remote Camera Control', groups: [
      [
        { k: 'remoteOn', l: 'Remote Camera Control', t: 'tog', h: 'Управление несколькими iPhone по сети: один телефон (или iPad) — пульт, остальные — камеры. Пульт видит картинку всех камер и меняет их настройки.' },
        { k: 'remoteRole', l: 'Use This iPhone as', t: 'sel', dis: function (S) { return !S.remoteOn; }, o: [['controller', 'Controller'], ['camera', 'Remote Camera']], h: 'Роль этого телефона: пульт (Controller) или управляемая камера (Remote Camera).' }
      ],
      [
        { k: 'camName', l: 'Camera Name', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function (S) { return S.camName; }, h: 'Имя камеры (буква A, B, C…). Попадает в имя файла: A001_…' },
        { l: 'Remote Password', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function () { return 'No password set'; }, h: 'Пароль, чтобы к камере не подключился чужой пульт.' },
        { k: 'camAvail', l: 'Camera Available for', t: 'sel', dis: function (S) { return !S.remoteOn; }, o: [['control', 'Control and Monitor'], ['monitor', 'Monitor Only']], h: 'Что разрешено пульту: управлять и смотреть или только смотреть.' },
        { k: 'syncClips', l: 'Sync Clips To Controller after Record', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'После записи клипы автоматически копируются на пульт.' }
      ],
      [
        { l: 'Remote Cameras Manager', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function () { return 'No Cameras Saved'; }, h: 'Список сохранённых камер для пульта.' }
      ],
      [
        { k: 'syncRec', l: 'Sync Record Across Cameras', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Запись стартует одновременно на всех камерах.' },
        { k: 'hideFeed', l: 'Hide Remote Camera Video Feed', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Не передавать картинку камеры на пульт (экономит сеть).' },
        { k: 'dimRemote', l: 'Dim Remote Cameras on Record', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Затемнять экраны камер во время записи.' }
      ]
    ] },
    { id: 'presets', title: 'Presets', groups: [
      [ { l: 'Preset Selection', t: 'link', page: 'presets', h: 'Пресеты — сохранённые наборы настроек. Save New Preset сохраняет текущие, Import/Export переносят между телефонами, Overwrite Preset перезаписывает выбранный.' } ]
    ] },
    { id: 'accessories', title: 'Accessories', groups: [
      [
        { k: 'bluetooth', l: 'Use Bluetooth', t: 'tog', h: 'Bluetooth-аксессуары: беспроводной фоллоу-фокус Nucleus, генератор таймкода Tentacle Sync E, стабилизатор Insta360 Flow Pro.' },
        { l: 'Nucleus Wireless Lens Control', t: 'info', val: function () { return 'None'; }, h: 'Подключение беспроводного фоллоу-фокуса Tilta Nucleus для управления фокусом.' }
      ]
    ] },
    { id: 'network', title: 'Network Access', groups: [
      [ { l: 'HTTP Server', t: 'link', page: 'http', h: 'Встроенный веб-сервер: управлять камерой и скачивать клипы можно с компьютера по Wi-Fi через браузер или REST API.' } ]
    ] },
    { id: 'cloud', title: 'Blackmagic Cloud', groups: [
      [ { l: 'Log in to Blackmagic Cloud', t: 'link', page: 'cloud', h: 'Вход в Blackmagic Cloud: облачные проекты DaVinci Resolve, загрузка клипов, Live Sync и чат.' } ]
    ] },
    { id: 'reset', title: 'Reset', groups: [
      [ { l: 'Reset Blackmagic Cam Settings', t: 'link', page: 'reset', h: 'Сброс: только настроек камеры, настроек камеры и облака или полный сброс с удалением всех клипов.' } ]
    ] },
    { id: 'about', title: 'About', groups: [
      [
        { l: 'App Version', t: 'info', val: function () { return '3.5.200045'; }, h: 'Версия приложения, которую повторяет этот симулятор.' },
        { l: 'Learn More at Blackmagicdesign.com', t: 'link', page: 'learn', h: 'Сайт производителя с описанием приложения.' }
      ]
    ] }
  ];

  /* функции для F1–F3 (точный список из приложения не снят — набор основных инструментов) */
  var FUNCTIONS = [
    ['none', 'None'], ['zebra', 'Zebra'], ['focusassist', 'Focus Assist'], ['falsecolor', 'False Color'], ['frameguide', 'Frame Guide'],
    ['grid', 'Grid'], ['safearea', 'Safe Area'], ['lut', 'Display LUT'], ['cleanfeed', 'Clean Feed'], ['torch', 'Torch'],
    ['stab', 'Stabilization'], ['aelock', 'AE Lock'], ['wblock', 'WB Lock'], ['goodtake', 'Good Take']
  ];
  SETTINGS[6].groups[0][1].o = SETTINGS[6].groups[0][2].o = SETTINGS[6].groups[0][3].o = FUNCTIONS;

  /* ---------- Состояние по умолчанию ---------- */
  function defaults() {
    return {
      /* Record */
      codec: 'hevc', bitrate: 'max', resolution: '4k', colorspace: 'applelog', hdr: true, timelapse: false, tlInterval: '1m',
      trigger: 'none', volumeRec: true, swipeDim: true, lockWbRec: true, dropFrame: 'alert', tcDisplay: 'rr', refSource: 'none',
      /* Camera */
      cinematic: false, vertical: true, lockOrient: true, mirrorFront: true, shutterMeas: 'speed', flickerHz: '50', irisMeas: 'fraction',
      lensCorr: true, extLens: false, desqueeze: '1', flipSlr: false,
      /* Media */
      saveTo: 'inappphotos', saveLoc: true, filename: 'bm', proxy: true, autoUpload: true, uploadClips: 'proxies', liveSync: true, wifiOnly: false,
      /* Audio */
      audioSrc: 'iphone', iphoneMic: 'auto', audioFmt: 'float', audioCh: 'stereo', sampleRate: 'auto', metering: 'vu18', audioMon: true, audioOut: 'speaker',
      /* Monitor */
      faMode: 'lines', faColor: 'red', guidesOp: '25', guidesColor: 'white', gridsOp: '25', hdmi: 'mirror',
      dispAudio: true, dispHist: true, dispStorage: true, dispStream: true, dispUpload: false, dispBattery: true,
      /* Live stream, F-buttons, LUTs, remote */
      platform: 'bmcloud', liveStream: false, cloudLogged: false, fbOn: true, f1: 'none', f2: 'none', f3: 'none',
      lutEnabled: LUTS.map(function () { return true; }), bmLuts: true, recLut: false,
      remoteOn: false, remoteRole: 'controller', camName: 'A', camAvail: 'control', syncClips: false, syncRec: false, hideFeed: false, dimRemote: false,
      bluetooth: false,
      /* Камера: колёса HUD */
      lens: 'w', zoom: 1, fps: 23.98, offSpeed: false, offFps: 60,
      shAuto: true, shDen: 48, shAngle: 180, shLock: false,
      isoAuto: true, iso: 400, isoLock: false,
      wbAuto: true, wbK: 5600, wbLock: false, wbPreset: null,
      tintAuto: true, tint: 0, tintLock: false,
      afAuto: true, focus: 0.97, aeAuto: true, ev: 0,
      lutOn: false, lut: 'rec709',
      /* инструменты монитора */
      zebra: false, zebraLvl: 95, zebraMode: 'level', fa: false, faLvl: 50, grid: false, gridThirds: true, gridHorizon: false, gridCross: false, gridDot: false,
      fg: false, fgRatio: '2.39:1', safe: false, safeLvl: 90, falseColor: false, torch: false, torchLvl: 50, torchAuto: false,
      stab: 'standard',
      /* слейт */
      reel: 1, sceneNo: 1, take: 1, interior: true, day: true, goodTake: false, prodName: '', director: '', operator: ''
    };
  }
