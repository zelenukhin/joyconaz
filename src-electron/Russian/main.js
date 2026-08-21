// Главный процесс Electron настольной сборки «EMDR-терапия с Joy-Con».
//
// Фронтенд (index.html, app.js, style.css, joy-con-webhid.es.js и
// папка sound/) загружается в рендерер — полноценный Chromium со
// встроенным WebHID. app.js сам определяет среду (по User-Agent) и в
// Electron пропускает браузерную «разблокировку» звука: политика
// автовоспроизведения задаётся ниже как no-user-gesture-required,
// поэтому щелчок пальцев звучит с первого касания края, без
// предварительного клика по окну.
//
// Запуск в разработке:  npm install && npm start
// Сборка установщиков:  npm run dist:mac / npm run dist:win (см. package.json)
//
// ИКОНКА ПРИЛОЖЕНИЯ. electron-builder (команды dist:mac / dist:win)
// берёт иконки из папки build/ (buildResources) автоматически, БЕЗ
// правок конфигурации: build/icon.icns — иконка приложения macOS
// (док, Finder, установщик .dmg), build/icon.png (1024×1024) —
// источник, из которого для Windows автоматически генерируется
// .ico и встраивается в .exe (проводник, панель задач, меню «Пуск»).
// Готовит эти файлы скрипт make-icons.sh из исходных PNG в icons/
// (см. ICONS.md). Ниже дополнительно задаётся иконка ОКНА на время
// разработки — чтобы приложение выглядело «своим» ещё до сборки.
//
// СТРОКА ЗАГОЛОВКА ОКНА. Системная строка заголовка (светлая полоса
// с именем окна и кнопками) выделялась на фоне тёмного интерфейса.
// Поэтому она скрыта (titleBarStyle): страница занимает окно
// целиком, на macOS остаются родные «светофоры», на Windows/Linux
// кнопки окна рисует titleBarOverlay в цветах приложения. Окно
// перетаскивается за шапку страницы — header помечен
// app-region: drag в style.css.

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  screen,
  session,
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');

// Nintendo Co., Ltd — тот же vendorId (1406 = 0x057E), по которому
// joy-con-webhid фильтрует устройства в веб-версии приложения.
const NINTENDO_VENDOR_ID = 1406;

// Цвета интерфейса из style.css: тёмный фон страницы (#101418) и цвет
// её текста (#e8eaed). Ими подкрашивается окно ДО загрузки страницы
// (backgroundColor — убирает белую вспышку при старте) и полоса
// кнопок окна на Windows/Linux (titleBarOverlay) — рамка больше не
// выделяется на фоне тёмной темы.
const APP_BACKGROUND_COLOR = '#101418';
const APP_TEXT_COLOR = '#e8eaed';

// Высота полосы кнопок окна («свернуть / развернуть / закрыть»),
// рисуемой titleBarOverlay поверх страницы на Windows/Linux.
const TITLE_BAR_OVERLAY_HEIGHT = 36;

// Желаемая (эталонная) ширина окна в пикселях — потолок, к которому
// окно стремится на больших экранах. Фактическая ширина вычисляется
// в createWindow() адаптивно по рабочей области монитора.
const PREFERRED_WINDOW_WIDTH = 1000;

// Стартовая высота окна на момент СОЗДАНИЯ (до измерения контента):
// окно в это время скрыто, значение только гарантирует, что окно не
// окажется больше рабочей области. Фактическая высота подбирается
// ПОД КОНТЕНТ сразу после загрузки страницы (см.
// fitWindowHeightToContent) — фиксированной «эталонной» высоты
// у окна нет: интерфейс приложения не растягивается на весь экран
// (дорожка фиксированной высоты, панель управления прижата сверху),
// и высокая константа (прежние 1080) лишь оставляла пустоту внизу.
const INITIAL_WINDOW_HEIGHT = 640;

// Таймер-страховка показа окна (мс): если событие did-finish-load
// по какой-то причине вовсе не наступило (повреждён index.html,
// сбой загрузки), окно всё равно показывается со стартовой высотой —
// приложение не «пропадает» без видимого окна.
const SHOW_WINDOW_FALLBACK_MS = 3000;

let mainWindow = null;

const isExternalUrl = (url) =>
  url.startsWith('http://') || url.startsWith('https://');

// Иконка окна в режиме разработки (make-icons.sh кладёт её в build/).
// Показывается в заголовке окна и на панели задач на Windows и Linux;
// на macOS параметр icon у BrowserWindow игнорируется — иконку доку
// даёт build/icon.icns из собранного .app. В УПАКОВАННОМ приложении
// папки build/ внутри asar нет: проверка существования вернёт
// undefined, и окно получит иконку, встроенную сборщиком в .exe
// (из build/icon.png) — то есть ту же самую.
const findWindowIcon = () =>
  [
    path.join(__dirname, 'build', 'icon_256x256.png'),
    path.join(__dirname, 'build', 'icon.png'),
  ].find((candidate) => fs.existsSync(candidate)) || undefined;

// ── Подгонка высоты окна под контент ─────────────────────────────────
//
// Страница приложения собирается у ВЕРХНЕГО края: заголовок, дорожка
// с шариком, панель управления, подвал — а остальное пространство
// прежней высокой константы (1080) оставалось пустым. Теперь высота
// окна подбирается под фактический контент:
//
// - окно создаётся скрытым (show: false) со стартовой высотой;
// - после загрузки страницы в рендерере выполняется
//   MEASURE_CONTENT_HEIGHT_SCRIPT: он ждёт ДВА кадра
//   (requestAnimationFrame — за это время стили, шрифты и раскладка
//   успевают устоять; сам did-finish-load означает лишь «загрузка
//   завершена», дорисовка могла не закончиться) и возвращает нижнюю
//   границу самого нижнего «потокового» элемента body в CSS-пикселях.
//   Модальные окна справки и управления — position: fixed (или
//   display: none, пока скрыты) — пропускаются: их нижняя граница
//   равна высоте окна, а не контента; к позиции добавляется scrollY,
//   чтобы замер был верен и при прокрученной странице;
// - высота умножается на zoomFactor (масштаб из меню «Вид»; при 1
//   CSS-пиксель равен одному DIP) и передаётся в setContentSize —
//   размер именно клиентской области, в DIP;
// - результат ограничивается рабочей областью ТОГО монитора, на
//   котором окно находится (screen.getDisplayMatching): если контент
//   не влезает (узкое окно, крупный масштаб), страница просто
//   прокручивается, как в браузере;
// - окно показывается только ПОСЛЕ подгонки — пользователь не видит
//   ни «прыжка» размера, ни пустого пространства внизу.
//
// Подгонка повторяется при перезагрузке страницы (меню
// «Файл → Перезагрузить») и при изменении масштаба страницы (меню
// «Вид → Увеличить / Уменьшить») — контент меняет высоту, окно
// следует за ним. В развёрнутом и полноэкранном состоянии подгонка
// пропускается: там размер выбирает пользователь или система.
//
// Со скрытой строкой заголовка (titleBarStyle: 'hidden') рамка окна
// почти нулевой толщины, поэтому вычисление frameHeight ниже просто
// становится ≈ 0 — логика подгонки не меняется и продолжает работать
// одинаково на всех платформах.
const MEASURE_CONTENT_HEIGHT_SCRIPT = `
(() => new Promise((resolve) => {
  const measure = () => {
    let bottom = 0;
    for (const element of document.body.children) {
      const style = window.getComputedStyle(element);
      if (
        style.display === 'none' ||
        style.position === 'fixed' ||
        style.position === 'absolute'
      ) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const bottomInDocument = rect.bottom + window.scrollY;
      if (bottomInDocument > bottom) {
        bottom = bottomInDocument;
      }
    }
    const bodyStyle = window.getComputedStyle(document.body);
    const height = Math.ceil(
      bottom +
        parseFloat(bodyStyle.paddingBottom || '0') +
        parseFloat(bodyStyle.marginBottom || '0')
    );
    resolve(Number.isFinite(height) ? height : 0);
  };
  // Два кадра: шрифты и раскладка успевают устоять до замера.
  requestAnimationFrame(() => {
    requestAnimationFrame(measure);
  });
}))()
`;

const fitWindowHeightToContent = async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  // В развёрнутом/полноэкранном состоянии размер выбирает
  // пользователь или система — подгонку пропускаем.
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    return;
  }
  try {
    const contentHeightCss = await mainWindow.webContents.executeJavaScript(
      MEASURE_CONTENT_HEIGHT_SCRIPT
    );
    if (!Number.isFinite(contentHeightCss) || contentHeightCss <= 0) {
      return;
    }

    const [contentWidth, contentHeight] = mainWindow.getContentSize();
    const [, windowHeight] = mainWindow.getSize();
    // Высота рамки окна (заголовок, границы): внешний размер минус
    // размер клиентской области.
    const frameHeight = windowHeight - contentHeight;

    // Рабочая область монитора, НА КОТОРОМ окно находится (не только
    // первичного): после перетаскивания окна подгонка ориентируется
    // на текущий дисплей.
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const { height: workAreaHeight } = display.workArea;

    // CSS-пиксели пересчитываются в DIP с учётом масштаба страницы
    // (пункты меню «Увеличить» / «Уменьшить» меняют zoomFactor;
    // при zoomFactor 1 CSS-пиксель равен одному DIP).
    const zoomFactor = mainWindow.webContents.getZoomFactor();
    const desiredContentHeight = Math.ceil(contentHeightCss * zoomFactor);
    // Контент выше рабочей области — не выходим за её пределы,
    // страница прокручивается, как в браузере.
    const maxContentHeight = Math.max(workAreaHeight - frameHeight, 200);

    mainWindow.setContentSize(
      contentWidth,
      Math.min(desiredContentHeight, maxContentHeight)
    );
  } catch (error) {
    console.warn('Не удалось подогнать высоту окна под контент:', error);
  }
};

// Показ скрытого окна. Идемпотентен: проверка isVisible() позволяет
// вызывать и из обработчика загрузки, и из таймера-страховки —
// повторный вызов поверх уже открытого окна ничего не делает.
const showWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
};

// ── Адаптивный расчёт размера окна ───────────────────────────────────
//
// Ширина: желаемый (эталонный) размер, но не больше рабочей области
// ПЕРВИЧНОГО дисплея (размер экрана БЕЗ панели задач на Windows,
// дока и меню на macOS). Высота: стартовая константа, которую сразу
// после загрузки страницы заменяет фактическая высота контента
// (см. fitWindowHeightToContent) — тоже с ограничением рабочей
// областью.
//
// ВАЖНО: screen.getPrimaryDisplay() можно вызывать только ПОСЛЕ
// готовности app (app.whenReady) — поэтому и расчёт, и создание окна
// выполняются внутри createWindow(), который всегда вызывается уже
// из whenReady(). Для многомониторных конфигураций используется
// именно первичный дисплей — тот, где операционная система открывает
// окно по умолчанию.
const computeWindowSize = () => {
  const { width: workAreaWidth, height: workAreaHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  return {
    width: Math.min(PREFERRED_WINDOW_WIDTH, workAreaWidth),
    height: Math.min(INITIAL_WINDOW_HEIGHT, workAreaHeight),
    // Минимальные размеры тоже подрезаются под фактическое окно:
    // иначе на очень низком экране (рабочая область < 640px высоты)
    // ограничение minHeight оказалось бы БОЛЬШЕ самой высоты окна,
    // и платформа вела бы себя непредсказуемо при ресайзе.
    minWidth: Math.min(480, workAreaWidth),
    minHeight: Math.min(640, workAreaHeight),
  };
};

const createWindow = () => {
  const windowSize = computeWindowSize();
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    minWidth: windowSize.minWidth,
    minHeight: windowSize.minHeight,
    title: 'EMDR-терапия с Joy-Con',
    autoHideMenuBar: !isMac,
    icon: findWindowIcon(),
    // Окно создаётся скрытым и показывается только ПОСЛЕ подгонки
    // высоты под контент (did-finish-load → fitWindowHeightToContent
    // → show) — пользователь не видит ни «прыжка» размера, ни
    // пустого пространства внизу.
    show: false,
    // width/height и setContentSize задают размер именно клиентской
    // области (веб-страницы), а не окна вместе с рамкой.
    useContentSize: true,
    // Тёмная подложка окна: цвет ДО загрузки страницы и за пределами
    // контента совпадает с фоном body (#101418) — ни белой вспышки
    // при старте, ни светлых полос по краям.
    backgroundColor: APP_BACKGROUND_COLOR,
    // Скрытая системная строка заголовка: страница занимает окно
    // целиком, и светлая системная полоса сверху больше не выделяется
    // на фоне тёмного интерфейса. На macOS 'hiddenInset' оставляет
    // родные «светофоры» слева вверху с небольшим отступом; на
    // Windows/Linux 'hidden' убирает заголовок полностью, а кнопки
    // окна возвращает titleBarOverlay ниже. Перетаскивание окна —
    // за шапку страницы (app-region: drag у header в style.css).
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    // Кнопки «свернуть / развернуть / закрыть» на Windows/Linux:
    // полоса в цвет фона приложения, значки в цвет текста интерфейса.
    // ЯВНЫЕ color/symbolColor обязательны: без них на Windows кнопки
    // могут отрисоваться светлым стилем даже при тёмной теме системы.
    // На macOS настройка не применяется — там остаются «светофоры».
    ...(isMac
      ? {}
      : {
          titleBarOverlay: {
            color: APP_BACKGROUND_COLOR,
            symbolColor: APP_TEXT_COLOR,
            height: TITLE_BAR_OVERLAY_HEIGHT,
          },
        }),
    webPreferences: {
      // Строгая изоляция: страница остаётся обычным веб-приложением
      // без доступа к Node.js — безопасно и полностью совместимо
      // с браузерной версией.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Звук разрешён БЕЗ «пользовательской активности»: play()
      // срабатывает всегда, поэтому щелчок пальцев звучит сразу,
      // даже если до этого в окне не было ни клика, ни клавиши.
      // Браузерная «разблокировка» из app.js при этом не выполняется.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // ВАЖНО: did-finish-load и did-fail-load — события webContents,
  // а НЕ самого BrowserWindow. Обработчик, повешенный на окно,
  // никогда не срабатывает — при show: false окно оставалось бы
  // навсегда невидимым (приложение «живёт», но окна нет). Поэтому
  // слушатели навешиваются именно на webContents.
  //
  // did-finish-load наступает, когда страница загружена; внутри
  // fitWindowHeightToContent замер ждёт два кадра, чтобы шрифты и
  // раскладка устояли. Обработчик постоянный: перезагрузка страницы
  // (меню «Файл → Перезагрузить») тоже подгоняет высоту заново.
  mainWindow.webContents.on('did-finish-load', () => {
    void fitWindowHeightToContent().finally(showWindow);
  });

  // Неудачная загрузка — показываем окно как есть (со стартовой
  // высотой), чтобы приложение не осталось без видимого окна.
  mainWindow.webContents.on('did-fail-load', () => {
    showWindow();
  });

  // Таймер-страховка: если did-finish-load по какой-то причине не
  // наступил вовсе — окно показывается со стартовой высотой через
  // 3 секунды. showWindow идемпотентен, повторный вызов после
  // успешного показа ничего не делает.
  setTimeout(showWindow, SHOW_WINDOW_FALLBACK_MS);

  // Изменение масштаба страницы (меню «Вид → Увеличить / Уменьшить /
  // Фактический размер») меняет высоту контента — высота окна
  // подгоняется заново. Название события отличается в разных версиях
  // Electron (did-change-zoom / did-change-zoom-factor), поэтому
  // слушаем оба; «лишний» обработчик в конкретной версии просто
  // никогда не сработает.
  for (const eventName of ['did-change-zoom', 'did-change-zoom-factor']) {
    mainWindow.webContents.on(eventName, () => {
      void fitWindowHeightToContent();
    });
  }

  // ── Сохранение настроек в файл (кнопка «Настройки») ────────────────
  //
  // «Настройки → Сохранить настройки» в рендерере запускает обычную
  // браузерную загрузку Blob-файла (a.download с именем
  // joyconaz-settings.json). Здесь загрузка перехватывается: вместо
  // тихого скачивания в папку загрузок показывается СИСТЕМНЫЙ ДИАЛОГ
  // выбора пути сохранения с предложенным именем файла и фильтром
  // по JSON. Отмена диалога отменяет и загрузку — файл не создаётся.
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const defaultPath = path.join(
      app.getPath('downloads'),
      item.getFilename() || 'joyconaz-settings.json'
    );
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Сохранить настройки',
      defaultPath,
      filters: [{ name: 'Файл настроек JSON', extensions: ['json'] }],
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });

  // Отладка: JOYCONAZ_DEVTOOLS=1 npm start — открыть DevTools.
  if (process.env.JOYCONAZ_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Ссылки target="_blank" открываем в системном браузере.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Переход по обычной ссылке внутри окна (например, на GitHub в
  // подвале страницы) тоже уводим в системный браузер, чтобы окно
  // приложения не «уезжало» со страницы терапии.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Компактное меню приложения: перезагрузка страницы (быстрое лечение
// большинства странностей — как Ctrl+F5 в браузере), масштаб,
// полный экран и DevTools. На macOS дополнительно системные пункты
// «О приложении»/«Завершить» (appMenu) и меню окна. На Windows и
// Linux меню скрыто (autoHideMenuBar) и показывается по Alt — оно не
// портит тёмную безрамочную шапку.
const registerMenu = () => {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Файл',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { type: 'separator' },
        ...(isMac
          ? [{ role: 'close', label: 'Закрыть окно' }]
          : [{ role: 'quit', label: 'Выход' }]),
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { role: 'resetZoom', label: 'Фактический размер' },
        { role: 'togglefullscreen', label: 'Полный экран' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
      ],
    },
    ...(isMac ? [{ role: 'windowMenu' }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// Один экземпляр приложения: повторный запуск не плодит окна, а
// фокусирует уже открытое (актуально во время сессии терапии).
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Автоматически одобряем WebHID-доступ только устройствам Nintendo.
    // В браузере ту же роль играет диалог Chrome «Разрешить сайту доступ
    // к устройству»; в настольном приложении решение принимает этот
    // обработчик — пользователь выбирает Joy-Con, разрешение выдаётся
    // сразу и без лишних вопросов.
    session.defaultSession.setDevicePermissionHandler((request) => {
      return (
        request.deviceType === 'hid' &&
        request.device?.vendorId === NINTENDO_VENDOR_ID
      );
    });

    // Кнопка «Подключить Joy-Cons» вызывает navigator.hid.requestDevice.
    // Вместо показа системного диалога выбора автоматически выбираем
    // первое доступное устройство Nintendo. Уже разрешённые устройства
    // в список кандидатов не попадают, поэтому повторные нажатия кнопки
    // подключают Joy-Cons по одному (в порядке, в котором их перечисляет
    // система). Если устройств Nintendo нет, запрос отменяется — веб-код
    // корректно обрабатывает пустой ответ.
    session.defaultSession.on(
      'select-hid-device',
      (event, details, callback) => {
        event.preventDefault();
        const joyCon = details.deviceList.find(
          (device) => device.vendorId === NINTENDO_VENDOR_ID
        );
        callback(joyCon?.deviceId);
      }
    );

    registerMenu();
    // createWindow (и адаптивный расчёт размера внутри него)
    // выполняются строго после app.whenReady — модуль screen
    // до этого момента недоступен.
    createWindow();
  });

  app.on('window-all-closed', () => {
    // Закрытие последнего окна (красная кнопка на macOS, крестик на
    // Windows) ВСЕГДА завершает приложение целиком — привычное для
    // пользователей поведение «кнопка закрытия закрывает программу».
    // Проверка платформы убрана: приложение больше не «висит» в доке
    // без окон, поэтому обработчик activate для его «оживления»
    // не нужен и удалён. Cmd+Q продолжает работать как обычно:
    // при выходе через Cmd+Q Electron сам закрывает окна, и это
    // событие повторно не эмитится — двойного выхода не случается.
    // app.quit() завершает приложение «мягко»: обработчики close и
    // beforeunload успевают отработать, поэтому вибрация Joy-Con
    // и звук корректно остановятся при закрытии окна.
    app.quit();
  });
}