// Органы управления Sony α7 IV (ILCE-7M4).
// Источник: официальный Help Guide Sony ILCE-7M4, раздел «Names of parts / Identifying parts»
// https://helpguide.sony.net/ilc/2110/v1/en/index.html
// Тексты описаний пересказаны на русском и английском по этому руководству.

export const GROUPS = [
  { id: 'top',    ru: 'Верхняя панель', en: 'Top side' },
  { id: 'rear',   ru: 'Задняя панель',  en: 'Rear side' },
  { id: 'front',  ru: 'Передняя панель', en: 'Front side' },
  { id: 'sides',  ru: 'Боковые стороны', en: 'Sides' },
  { id: 'bottom', ru: 'Низ',            en: 'Bottom' },
  { id: 'lens',   ru: 'Объектив из комплекта', en: 'Kit lens' },
];

export const PARTS = [
  // ───────────── Верхняя панель ─────────────
  {
    id: 'shutter', group: 'top', label: '',
    ru: 'Кнопка спуска затвора', en: 'Shutter button',
    dru: 'Наполовину нажмите — камера фокусируется и замеряет экспозицию. Нажмите до конца — делается снимок. Поведение кнопки в режиме видео можно настроить в меню.',
    den: 'Press halfway to focus and meter, press fully to take the picture. Its behaviour in movie mode can be customised.',
  },
  {
    id: 'power', group: 'top', label: 'ON / OFF',
    ru: 'Выключатель питания ON/OFF', en: 'ON/OFF (Power) switch',
    dru: 'Кольцо вокруг кнопки спуска: поверните в положение ON, чтобы включить камеру, и в OFF — чтобы выключить.',
    den: 'The collar around the shutter button. Turn to ON to power the camera on and to OFF to turn it off.',
  },
  {
    id: 'stillMovie', group: 'top', label: 'S&Q',
    ru: 'Переключатель Фото / Видео / S&Q', en: 'Still/Movie/S&Q dial',
    dru: 'Нижнее кольцо под диском режимов. Выбирает, что снимает камера: фото, видео или замедленное/ускоренное видео (S&Q). Чтобы повернуть, удерживайте кнопку разблокировки на передней стороне кольца.',
    den: 'The ring beneath the mode dial. Switches between stills, movies and Slow & Quick Motion. Hold down the lock release button on its front while turning.',
  },
  {
    id: 'modeDial', group: 'top', label: 'MODE',
    ru: 'Диск выбора режима', en: 'Mode dial',
    dru: 'Выбирает режим экспозиции: AUTO (интеллектуальный авто), P (программный), A (приоритет диафрагмы), S (приоритет выдержки), M (ручной), 1/2/3 — вызов сохранённых пользовательских настроек. Кнопка в центре блокирует диск от случайного поворота.',
    den: 'Selects the exposure mode: AUTO, P (Program), A (Aperture priority), S (Shutter priority), M (Manual) and 1/2/3 to recall saved camera settings. The button in its centre locks the dial.',
  },
  {
    id: 'dialL', group: 'top', label: '',
    ru: 'Задний диск L', en: 'Rear dial L',
    dru: 'Колесо у заднего края верхней панели. Позволяет быстро менять настройки текущего режима съёмки (например, выдержку, диафрагму или ISO). Функцию диска можно переназначить: MENU → Настройка → Настр. польз. клав./диска.',
    den: 'The thumb wheel on the rear edge of the top plate. Quickly adjusts settings for each shooting mode; its function can be reassigned in Custom Key/Dial Set.',
  },
  {
    id: 'dialR', group: 'top', label: '',
    ru: 'Задний диск R (с блокировкой)', en: 'Rear dial R (with lock)',
    dru: 'Большой диск в правом заднем углу (у предыдущих моделей здесь был диск экспокоррекции). Быстро меняет настройки для текущего режима, функцию можно переназначить. Кнопка в центре — блокировка: если она выдвинута и видна белая полоска, диск разблокирован.',
    den: 'The large dial on the right rear corner (exposure-comp dial on earlier models). Quickly adjusts settings; can be reassigned. Its centre button toggles the lock — popped up with a white line showing means unlocked.',
  },
  {
    id: 'movie', group: 'top', label: '●',
    ru: 'Кнопка MOVIE (видео)', en: 'MOVIE button',
    dru: 'Запуск и остановка записи видео. Кнопку можно сделать пользовательской и назначить на неё другую функцию.',
    den: 'Starts and stops movie recording. It can also be customised to another function.',
  },
  {
    id: 'c2', group: 'top', label: 'C2',
    ru: 'Кнопка C2 (пользовательская 2)', en: 'C2 button (Custom button 2)',
    dru: 'Пользовательская кнопка: на неё можно назначить часто используемую функцию (MENU → Настройка → Настр. польз. клав./диска).',
    den: 'Custom button 2. Assign a frequently used function in Custom Key/Dial Set.',
  },
  {
    id: 'shoe', group: 'top', label: '',
    ru: 'Многоинтерфейсный башмак (Multi Interface Shoe)', en: 'Multi Interface Shoe',
    dru: 'Крепление и контакты для вспышек, микрофонов (в т. ч. с цифровым аудиоинтерфейсом) и других аксессуаров. Некоторые аксессуары входят не до конца и выступают назад — соединение установлено, когда аксессуар дошёл до переднего края башмака.',
    den: 'Mount and contacts for flashes, microphones (including digital audio) and other accessories. Some accessories may protrude backward; the connection is complete once the accessory reaches the front end of the shoe.',
  },
  {
    id: 'sensorMark', group: 'top', label: '',
    ru: 'Метка положения матрицы', en: 'Image sensor position mark',
    dru: 'Значок ⊖ показывает, где находится плоскость матрицы. От неё измеряют точное расстояние до объекта, например при макросъёмке или ручной фокусировке по рулетке.',
    den: 'The ⊖ symbol marks the image sensor plane — use it to measure the exact distance to the subject.',
  },

  // ───────────── Задняя панель ─────────────
  {
    id: 'viewfinder', group: 'rear', label: '',
    ru: 'Видоискатель', en: 'Viewfinder',
    dru: 'Электронный видоискатель OLED. Когда вы подносите глаз, датчик глаза автоматически переключает изображение с экрана в видоискатель.',
    den: 'OLED electronic viewfinder. When you bring your eye to it the eye sensor switches the display from the monitor to the viewfinder.',
  },
  {
    id: 'eyecup', group: 'rear', label: '',
    ru: 'Наглазник', en: 'Eyepiece cup',
    dru: 'Резиновый наглазник защищает видоискатель от бокового света. Чтобы снять, раздвиньте нижние захваты в стороны и сдвиньте его вверх.',
    den: 'Rubber eyecup that shields the viewfinder from stray light. To remove, push the grips at the bottom outward and lift it off.',
  },
  {
    id: 'c3', group: 'rear', label: 'C3',
    ru: 'Кнопка C3 / Защита', en: 'C3 button / Protect button',
    shoot: { ru: 'Пользовательская кнопка 3 — назначьте любую функцию.', en: 'Custom button 3.' },
    view:  { ru: 'Защита снимка от случайного удаления.', en: 'Protects the image from deletion.' },
  },
  {
    id: 'menu', group: 'rear', label: 'MENU',
    ru: 'Кнопка MENU', en: 'MENU button',
    dru: 'Открывает главное меню камеры со всеми настройками: съёмка, экспозиция/цвет, фокус, воспроизведение, сеть, настройка и «Моё меню».',
    den: 'Opens the main menu with all camera settings (shooting, exposure/colour, focus, playback, network, setup, My Menu).',
  },
  {
    id: 'monitor', group: 'rear', label: '',
    ru: 'Экран (сенсорная панель)', en: 'Monitor / Touch panel',
    dru: 'Поворотный (vari-angle) сенсорный 3-дюймовый экран. Откидывается вбок и поворачивается примерно на 176° вниз и 270° вверх — удобно для селфи и съёмки с нестандартных ракурсов. Касанием можно выбрать точку фокусировки, запустить слежение и работать с меню.',
    den: 'Vari-angle 3-inch touch screen. Swings out to the side and rotates approx. 176° downward and 270° upward. Touch to set focus, start tracking and navigate menus.',
  },
  {
    id: 'eyeSensor', group: 'rear', label: '',
    ru: 'Датчик глаза', en: 'Eye sensor',
    dru: 'Определяет, что вы смотрите в видоискатель, и автоматически переключает отображение с экрана на видоискатель. Не закрывайте его ремнём или пальцем.',
    den: 'Detects your eye at the viewfinder and switches the display from the monitor automatically.',
  },
  {
    id: 'diopter', group: 'rear', label: '',
    ru: 'Колесо диоптрийной коррекции', en: 'Diopter-adjustment dial',
    dru: 'Подстраивает резкость изображения в видоискателе под ваше зрение. Вращайте, пока надписи в видоискателе не станут чёткими.',
    den: 'Adjusts the viewfinder to your eyesight until the display looks sharp.',
  },
  {
    id: 'c1', group: 'rear', label: 'C1',
    ru: 'Кнопка C1 (пользовательская 1)', en: 'C1 button (Custom button 1)',
    dru: 'Пользовательская кнопка рядом с видоискателем: на неё удобно назначить, например, увеличение для фокусировки или переключение режима фокуса.',
    den: 'Custom button 1 next to the viewfinder — handy for Focus Magnifier or focus-mode switching.',
  },
  {
    id: 'afon', group: 'rear', label: 'AF-ON',
    ru: 'Кнопка AF-ON / Увеличение', en: 'AF-ON button / Enlarge button',
    shoot: { ru: 'Включает автофокус без нажатия кнопки спуска (фокусировка «большим пальцем»).', en: 'Starts autofocus without half-pressing the shutter (back-button focus).' },
    view:  { ru: 'Увеличивает просматриваемый снимок.', en: 'Enlarges the image being viewed.' },
  },
  {
    id: 'ael', group: 'rear', label: 'AEL',
    ru: 'Кнопка AEL / Индекс изображений', en: 'AEL button / Image index button',
    shoot: { ru: 'Фиксирует экспозицию (по умолчанию — «Удержание AEL», пока кнопка нажата).', en: 'Locks exposure (default: AEL hold while pressed).' },
    view:  { ru: 'Показывает несколько снимков сразу — режим индекса (миниатюры).', en: 'Shows several images at once (image index).' },
  },
  {
    id: 'joystick', group: 'rear', label: '',
    ru: 'Мультиселектор (джойстик)', en: 'Multi-selector',
    dru: 'Наклоняйте в 8 направлений, чтобы перемещать точку фокусировки или курсор в меню. Нажатие по центру — подтверждение или назначенная функция (например, возврат точки фокуса в центр).',
    den: 'Tilt in 8 directions to move the focus area or the cursor; press in the centre to confirm or run an assigned function.',
  },
  {
    id: 'fn', group: 'rear', label: 'Fn',
    ru: 'Кнопка Fn / Отправка на смартфон', en: 'Fn (Function) button / Send to Smartphone',
    shoot: { ru: 'Открывает Fn-меню — быстрый доступ к 12 часто используемым настройкам (фокус, ISO, баланс белого и т. д.).', en: 'Opens the Function menu with 12 frequently used settings.' },
    view:  { ru: 'Отправляет снимки на подключённый смартфон.', en: 'Sends images to a smartphone.' },
  },
  {
    id: 'wheel', group: 'rear', label: '',
    ru: 'Колесо управления', en: 'Control wheel',
    dru: 'Вращайте для изменения значений и пролистывания снимков; нажимайте вверх / вниз / влево / вправо для вызова назначенных функций (вверх — DISP, смена информации на экране; вправо — ISO; влево — режим протяжки). Центральная кнопка — подтверждение выбора.',
    den: 'Rotate to change values or scroll images; press up/down/left/right for assigned functions (DISP up, ISO right, drive mode left). The centre button confirms.',
  },
  {
    id: 'accessLamp', group: 'rear', label: '',
    ru: 'Индикатор доступа', en: 'Access lamp',
    dru: 'Горит, пока идёт запись на карту памяти. В это время не извлекайте карту и аккумулятор — данные могут повредиться.',
    den: 'Lights while data is being written. Do not remove the card or battery while it is lit.',
  },
  {
    id: 'c4', group: 'rear', label: 'C4',
    ru: 'Кнопка C4 / Удаление', en: 'C4 button / Delete button',
    shoot: { ru: 'Пользовательская кнопка 4.', en: 'Custom button 4.' },
    view:  { ru: 'Удаляет просматриваемый снимок.', en: 'Deletes the image being viewed.' },
  },
  {
    id: 'playback', group: 'rear', label: '▶',
    ru: 'Кнопка воспроизведения', en: 'Playback button',
    dru: 'Переключает камеру в режим просмотра отснятых фото и видео. Повторное нажатие (или полунажатие спуска) — возврат к съёмке.',
    den: 'Switches to playback of recorded images; press again (or half-press the shutter) to return to shooting.',
  },

  // ───────────── Передняя панель ─────────────
  {
    id: 'frontDial', group: 'front', label: '',
    ru: 'Передний диск', en: 'Front dial',
    dru: 'Колесо под указательным пальцем на рукоятке. Быстро меняет настройки для текущего режима съёмки (например, диафрагму в режимах A и M).',
    den: 'Wheel under your index finger. Quickly adjusts settings for each shooting mode (e.g. aperture in A and M).',
  },
  {
    id: 'lensRelease', group: 'front', label: '',
    ru: 'Кнопка отсоединения объектива', en: 'Lens release button',
    dru: 'Удерживайте кнопку и поверните объектив против часовой стрелки до упора, затем снимите его.',
    den: 'Hold it down and turn the lens until it stops, then detach the lens.',
  },
  {
    id: 'mic', group: 'front', label: '',
    ru: 'Встроенный микрофон', en: 'Microphone',
    dru: 'Стереомикрофон для записи звука с видео. Не закрывайте его во время записи — появится шум или упадёт громкость. Отключается автоматически при подключении внешнего микрофона.',
    den: 'Built-in stereo microphone. Do not cover it during movie recording — noise may be recorded or the volume lowered.',
  },
  {
    id: 'afLamp', group: 'front', label: '',
    ru: 'Подсветка АФ / Индикатор автоспуска', en: 'AF illuminator / Self-timer lamp',
    dru: 'В темноте подсвечивает объект, чтобы автофокусу было легче навестись. При съёмке с автоспуском мигает, отсчитывая время до снимка.',
    den: 'Lights the subject to help autofocus in low light; blinks during the self-timer countdown.',
  },
  {
    id: 'mountIndex', group: 'front', label: '',
    ru: 'Метка крепления объектива', en: 'Mounting index',
    dru: 'Белая точка: совместите с такой же меткой на объективе, вставьте объектив и поверните по часовой стрелке до щелчка.',
    den: 'White dot — align the lens’s index with it, insert and rotate the lens until it clicks.',
  },
  {
    id: 'sensor', group: 'front', label: '',
    ru: 'Матрица (сенсор изображения)', en: 'Image sensor',
    dru: 'Полнокадровая матрица 33 Мп Exmor R BSI CMOS. Не касайтесь её пальцами; при смене объектива держите камеру байонетом вниз, чтобы не налетела пыль.',
    den: '33 MP full-frame Exmor R back-illuminated CMOS sensor. Do not touch it directly.',
  },
  {
    id: 'mount', group: 'front', label: '',
    ru: 'Байонет E-mount', en: 'Mount (E-mount)',
    dru: 'Металлическое крепление объективов Sony E / FE.',
    den: 'Metal Sony E-mount for E/FE lenses.',
  },
  {
    id: 'contacts', group: 'front', label: '',
    ru: 'Контакты объектива', en: 'Lens contacts',
    dru: 'Позолоченные контакты для обмена данными и питания между камерой и объективом (автофокус, диафрагма, стабилизация). Не касайтесь их и держите в чистоте.',
    den: 'Gold contacts for data and power between camera and lens. Do not touch them.',
  },

  // ───────────── Бока ─────────────
  {
    id: 'micJack', group: 'sides', label: 'MIC',
    ru: 'Разъём микрофона (3,5 мм)', en: 'Microphone jack',
    dru: 'Для внешнего микрофона. При подключении встроенный микрофон отключается; микрофоны с питанием от разъёма (plug-in power) получают питание от камеры.',
    den: 'For an external microphone. The built-in mic is disabled when one is connected; plug-in-power mics are powered by the camera.',
  },
  {
    id: 'phonesJack', group: 'sides', label: '🎧',
    ru: 'Разъём для наушников (3,5 мм)', en: 'Headphones jack',
    dru: 'Позволяет контролировать звук во время записи видео.',
    den: 'Monitor audio while recording movies.',
  },
  {
    id: 'hdmi', group: 'sides', label: 'HDMI',
    ru: 'Разъём HDMI (тип A, полноразмерный)', en: 'HDMI jack (Type A)',
    dru: 'Вывод изображения на телевизор, монитор или внешний рекордер (в том числе 4K 10 бит).',
    den: 'Outputs video to a TV, monitor or external recorder (including 4K 10-bit).',
  },
  {
    id: 'usbc', group: 'sides', label: 'USB-C',
    ru: 'Разъём USB Type-C', en: 'USB Type-C terminal',
    dru: 'Зарядка аккумулятора и питание камеры, передача файлов на компьютер, съёмка с ПК и стриминг (камера как веб-камера). Использовать одновременно с Multi/Micro USB для обмена данными нельзя.',
    den: 'Charges the battery and powers the camera, transfers files, PC remote shooting and USB streaming. Cannot be used for communication at the same time as the Multi/Micro USB terminal.',
  },
  {
    id: 'multiUsb', group: 'sides', label: 'Multi',
    ru: 'Разъём Multi/Micro USB', en: 'Multi/Micro USB Terminal',
    dru: 'Для аксессуаров с Multi-разъёмом — например, проводного пульта. Питание камеры через этот разъём невозможно; при этом аксессуары работают, даже если питание идёт через USB-C.',
    den: 'For Multi Terminal accessories such as a remote commander. The camera cannot be powered through it.',
  },
  {
    id: 'chargeLamp', group: 'sides', label: '',
    ru: 'Индикатор зарядки', en: 'Charge lamp',
    dru: 'Загорается, когда идёт зарядка аккумулятора через USB-C, и гаснет, когда зарядка завершена.',
    den: 'Lights while charging via USB-C and turns off when charging is complete.',
  },
  {
    id: 'speaker', group: 'sides', label: '',
    ru: 'Динамик', en: 'Speaker',
    dru: 'Воспроизводит звук видео и сигналы камеры.',
    den: 'Plays movie sound and camera beeps.',
  },
  {
    id: 'strapHook', group: 'sides', label: '',
    ru: 'Ушки для плечевого ремня', en: 'Hooks for shoulder strap',
    dru: 'По одному с каждой стороны — прикрепите к ним оба конца ремня.',
    den: 'One on each side — attach both ends of the strap.',
  },
  {
    id: 'cardCover', group: 'sides', label: '',
    ru: 'Крышка слотов карт памяти (2 слота)', en: 'Memory card cover (Slot 1 / Slot 2)',
    dru: 'Сдвиньте переключатель на крышке, чтобы открыть. Слот 1 — CFexpress Type A или SD, слот 2 — только SD. По умолчанию запись идёт на слот 1 (меняется в меню «Носитель записи»). Перед извлечением карты убедитесь, что индикатор доступа не горит.',
    den: 'Slide the switch to open. Slot 1 accepts CFexpress Type A or SD cards, Slot 2 SD only. Images are recorded to Slot 1 by default. Check that the access lamp is off before removing a card.',
  },

  // ───────────── Низ ─────────────
  {
    id: 'batteryCover', group: 'bottom', label: '',
    ru: 'Крышка батарейного отсека', en: 'Battery cover / Battery insertion slot',
    dru: 'За крышкой — отсек для аккумулятора NP-FZ100. Вставляйте аккумулятор, придерживая рычажок фиксатора, до щелчка.',
    den: 'Covers the battery insertion slot for the NP-FZ100 battery. Insert it while pressing the lock lever until it clicks.',
  },
  {
    id: 'lockLever', group: 'bottom', label: '',
    ru: 'Рычажок фиксатора аккумулятора', en: 'Lock lever',
    dru: 'Удерживает аккумулятор в отсеке. Сдвиньте его, чтобы аккумулятор выдвинулся для извлечения.',
    den: 'Holds the battery in place; slide it to release the battery.',
  },
  {
    id: 'tripod', group: 'bottom', label: '',
    ru: 'Гнездо для штатива', en: 'Tripod socket',
    dru: 'Резьба 1/4-20 UNC. Используйте винты не длиннее 5,5 мм — более длинный винт не зафиксирует камеру и может её повредить.',
    den: '1/4-20 UNC thread. Use screws shorter than 5.5 mm — longer ones can damage the camera.',
  },

  // ───────────── Объектив ─────────────
  {
    id: 'zoomRing', group: 'lens', label: '',
    ru: 'Кольцо зума', en: 'Zoom ring',
    dru: 'Кит-объектив FE 28-70 mm F3.5-5.6 OSS: поворот кольца меняет фокусное расстояние от 28 мм (широкий угол) до 70 мм (портрет).',
    den: 'Kit lens FE 28-70mm F3.5-5.6 OSS: turn to change focal length from 28 mm to 70 mm.',
  },
  {
    id: 'focusRing', group: 'lens', label: '',
    ru: 'Кольцо фокусировки', en: 'Focus ring',
    dru: 'Ручная фокусировка в режиме MF или DMF; при повороте камера может автоматически увеличивать изображение для точной наводки.',
    den: 'Manual focusing in MF/DMF; the camera can magnify the view automatically while you turn it.',
  },
];
