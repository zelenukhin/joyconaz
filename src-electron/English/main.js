// Main Electron process for the "EMDR Therapy with Joy-Con" desktop build.
//
// The frontend (index.html, app.js, style.css, joy-con-webhid.es.js and
// the sound/ folder) is loaded into the renderer — a full Chromium with
// built-in WebHID. app.js determines the environment (via User-Agent) and in
// Electron skips the browser audio "unlock": autoplay policy is set below
// as no-user-gesture-required, so the finger snap sounds from the very
// first edge touch, without a prior click on the window.
//
// Run in development: npm install && npm start
// Build installers:   npm run dist:mac / npm run dist:win (see package.json)
//
// APPLICATION ICON. electron-builder (dist:mac / dist:win commands)
// picks up icons from the build/ folder (buildResources) automatically, WITHOUT
// configuration tweaks: build/icon.icns — macOS app icon (dock, Finder, .dmg installer),
// build/icon.png (1024×1024) — source from which Windows automatically generates
// .ico and embeds it into .exe (explorer, taskbar, start menu).
// These files are prepared by the make-icons.sh script from source PNGs in icons/
// (see ICONS.md). Below, the WINDOW icon is additionally set during development —
// so the app feels "native" even before the final build.
//
// WINDOW TITLE BAR. The system title bar (light bar with window name and buttons)
// stood out against the dark interface. Therefore it's hidden (titleBarStyle):
// the page takes up the whole window, macOS retains native "traffic lights",
// Windows/Linux draws window buttons via titleBarOverlay in app colors.
// The window is dragged by the page header — the header is marked
// app-region: drag in style.css.

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

// Nintendo Co., Ltd — the same vendorId (1406 = 0x057E) used by
// joy-con-webhid to filter devices in the web version of the app.
const NINTENDO_VENDOR_ID = 1406;

// Interface colors from style.css: dark page background (#101418) and text
// color (#e8eaed). Used to tint the window BEFORE page load (backgroundColor —
// removes white flash at startup) and the window buttons bar on Windows/Linux
// (titleBarOverlay) — the frame no longer stands out against the dark theme.
const APP_BACKGROUND_COLOR = '#101418';
const APP_TEXT_COLOR = '#e8eaed';

// Height of the window buttons bar ("minimize / maximize / close"),
// drawn by titleBarOverlay over the page on Windows/Linux.
const TITLE_BAR_OVERLAY_HEIGHT = 36;

// Desired (reference) window width in pixels — a ceiling the window
// aims for on large screens. Actual width is computed adaptively
// in createWindow() based on the monitor's work area.
const PREFERRED_WINDOW_WIDTH = 1000;

// Starting window height at CREATION (before content measurement):
// the window is hidden at this time, the value only ensures it doesn't
// exceed the work area. Actual height is fitted TO THE CONTENT
// right after page load (see fitWindowHeightToContent) — there is no
// fixed "reference" height: the app interface doesn't stretch full screen
// (fixed-height track, control panel pinned at the top), and a high constant
// (the previous 1080) just left empty space at the bottom.
const INITIAL_WINDOW_HEIGHT = 640;

// Fallback timeout for window display (ms): if the did-finish-load event
// never triggers for some reason (corrupted index.html, load failure),
// the window is still shown with the starting height — so the app
// doesn't "disappear" without a visible window.
const SHOW_WINDOW_FALLBACK_MS = 3000;

let mainWindow = null;

const isExternalUrl = (url) =>
  url.startsWith('http://') || url.startsWith('https://');

// Window icon in development mode (make-icons.sh puts it in build/).
// Shown in the window title and on the taskbar in Windows and Linux;
// on macOS, the 'icon' parameter for BrowserWindow is ignored — the dock icon
// is provided by build/icon.icns from the built .app. In the PACKAGED app,
// there is no build/ folder inside the asar: the existence check returns undefined,
// and the window gets the icon embedded by the builder into the .exe
// (from build/icon.png) — meaning exactly the same one.
const findWindowIcon = () =>
  [
    path.join(__dirname, 'build', 'icon_256x256.png'),
    path.join(__dirname, 'build', 'icon.png'),
  ].find((candidate) => fs.existsSync(candidate)) || undefined;

// ── Fitting window height to content ─────────────────────────────────
//
// The app page is packed at the TOP edge: header, ball track,
// control panel, footer — while the rest of the previous high constant (1080)
// remained empty space. Now the window height is fitted to actual content:
//
// - the window is created hidden (show: false) with the starting height;
// - after page load in the renderer, the MEASURE_CONTENT_HEIGHT_SCRIPT
//   is executed: it waits for TWO frames (requestAnimationFrame — during this
//   time styles, fonts, and layout manage to settle; did-finish-load itself
//   only means "loading done", rendering might not be) and returns the bottom
//   edge of the lowest "in-flow" element of the body in CSS pixels.
//   Modal help and controls overlays — position: fixed (or display: none,
//   while hidden) — are skipped: their bottom boundary is the window height,
//   not the content; scrollY is added so the measurement is correct even if scrolled;
// - the height is multiplied by zoomFactor (scale from the "View" menu; at 1,
//   a CSS pixel equals one DIP) and passed to setContentSize —
//   the size of the client area specifically, in DIPs;
// - the result is constrained by the work area of THAT monitor where the window
//   is located (screen.getDisplayMatching): if the content doesn't fit
//   (narrow window, large scale), the page simply scrolls, like in a browser;
// - the window is shown only AFTER fitting — the user doesn't see a
//   size "jump" or empty space at the bottom.
//
// Fitting is repeated upon page reload ("File → Reload" menu) and upon
// page zoom changes ("View → Zoom In / Zoom Out") — content height changes,
// the window follows it. In maximized and fullscreen states, fitting is
// skipped: there the size is chosen by the user or the system.
//
// With the hidden title bar (titleBarStyle: 'hidden'), the window frame
// is of near-zero thickness, so calculating frameHeight below just
// becomes ≈ 0 — the fitting logic doesn't change and continues to work
// identically across all platforms.
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
  // Two frames: fonts and layout manage to settle before measuring.
  requestAnimationFrame(() => {
    requestAnimationFrame(measure);
  });
}))()
`;

const fitWindowHeightToContent = async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  // In maximized/fullscreen state, the size is chosen by the user
  // or system — we skip fitting.
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
    // Window frame height (title bar, borders): external size minus
    // client area size.
    const frameHeight = windowHeight - contentHeight;

    // Work area of the monitor ON WHICH the window is located (not just
    // primary): after dragging the window, fitting targets the current display.
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const { height: workAreaHeight } = display.workArea;

    // CSS pixels are converted to DIP accounting for page scale
    // ("Zoom In" / "Zoom Out" menus alter zoomFactor; at zoomFactor 1,
    // a CSS pixel equals one DIP).
    const zoomFactor = mainWindow.webContents.getZoomFactor();
    const desiredContentHeight = Math.ceil(contentHeightCss * zoomFactor);
    // Content is taller than work area — do not exceed bounds,
    // page will scroll like in a browser.
    const maxContentHeight = Math.max(workAreaHeight - frameHeight, 200);

    mainWindow.setContentSize(
      contentWidth,
      Math.min(desiredContentHeight, maxContentHeight)
    );
  } catch (error) {
    console.warn('Failed to fit window height to content:', error);
  }
};

// Showing the hidden window. Idempotent: isVisible() check allows
// calling it from both the load handler and the fallback timer —
// repeating the call on an already open window does nothing.
const showWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
};

// ── Adaptive Window Size Calculation ───────────────────────────────────
//
// Width: desired (reference) size, but no more than the PRIMARY display's
// work area (screen size WITHOUT taskbar on Windows, dock and menu on macOS).
// Height: starting constant, which right after load is replaced by the actual
// content height (see fitWindowHeightToContent) — also clamped to the work area.
//
// IMPORTANT: screen.getPrimaryDisplay() can only be called AFTER the app
// is ready (app.whenReady) — so both the calculation and window creation
// are done inside createWindow(), which is always called from within whenReady().
// For multi-monitor setups, the primary display is used — where the OS opens
// the window by default.
const computeWindowSize = () => {
  const { width: workAreaWidth, height: workAreaHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  return {
    width: Math.min(PREFERRED_WINDOW_WIDTH, workAreaWidth),
    height: Math.min(INITIAL_WINDOW_HEIGHT, workAreaHeight),
    // Minimum sizes are also clipped to the actual window:
    // otherwise on a very low screen (work area < 640px height),
    // the minHeight constraint would be LARGER than the window height itself,
    // and the platform would behave unpredictably upon resize.
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
    title: 'EMDR Therapy with Joy-Con',
    autoHideMenuBar: !isMac,
    icon: findWindowIcon(),
    // The window is created hidden and shown only AFTER fitting
    // height to content (did-finish-load → fitWindowHeightToContent → show) —
    // the user doesn't see a size jump or empty bottom space.
    show: false,
    // width/height and setContentSize define the size of the client area
    // (web page), not the window including the frame.
    useContentSize: true,
    // Dark window background: color BEFORE page load and outside
    // content matches body background (#101418) — no white flash
    // on start, no light bars on edges.
    backgroundColor: APP_BACKGROUND_COLOR,
    // Hidden system title bar: the page fills the entire window,
    // and the light system top bar no longer stands out against the dark UI.
    // On macOS 'hiddenInset' leaves the native "traffic lights" top left
    // with a slight inset; on Windows/Linux 'hidden' completely removes the title,
    // and titleBarOverlay below returns window buttons. Window dragging
    // happens via the page header (app-region: drag on header in style.css).
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    // "Minimize / maximize / close" buttons on Windows/Linux:
    // bar colored like app background, symbols like UI text.
    // EXPLICIT color/symbolColor are mandatory: without them on Windows,
    // buttons might draw in a light style even on a dark system theme.
    // On macOS this setting isn't applied — traffic lights remain.
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
      // Strict isolation: page remains a normal web app without Node.js
      // access — safe and fully compatible with the browser version.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Sound allowed WITHOUT "user gesture": play() always fires,
      // so the finger snap sounds instantly, even if there was no
      // prior click or keypress in the window.
      // The browser "unlock" in app.js is skipped here.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // IMPORTANT: did-finish-load and did-fail-load are webContents events,
  // NOT of the BrowserWindow itself. A handler attached to the window
  // would never fire — with show: false the window would remain
  // invisible forever (the app "lives", but there's no window). Thus,
  // listeners are attached specifically to webContents.
  //
  // did-finish-load occurs when the page is loaded; inside
  // fitWindowHeightToContent, the measurement waits two frames for fonts
  // and layout to settle. The handler is persistent: page reload
  // (Menu "File → Reload") fits the height again.
  mainWindow.webContents.on('did-finish-load', () => {
    void fitWindowHeightToContent().finally(showWindow);
  });

  // Load failure — show window as is (with initial height),
  // so the app doesn't stay without a visible window.
  mainWindow.webContents.on('did-fail-load', () => {
    showWindow();
  });

  // Fallback timer: if did-finish-load never happens for some reason —
  // show window with initial height after 3 seconds. showWindow is
  // idempotent, repeated calls after successful show do nothing.
  setTimeout(showWindow, SHOW_WINDOW_FALLBACK_MS);

  // Page zoom changes ("View → Zoom In / Zoom Out / Actual Size")
  // alter content height — window height is refitted. The event name
  // varies in different Electron versions (did-change-zoom / did-change-zoom-factor),
  // so we listen to both; the "extra" handler in a given version simply
  // never triggers.
  for (const eventName of ['did-change-zoom', 'did-change-zoom-factor']) {
    mainWindow.webContents.on(eventName, () => {
      void fitWindowHeightToContent();
    });
  }

  // ── Saving settings to file ("Settings" button) ────────────────
  //
  // "Settings → Save settings" in renderer triggers standard browser
  // Blob download (a.download as joyconaz-settings.json). Here, the download
  // is intercepted: instead of silently saving to the Downloads folder,
  // a SYSTEM SAVE DIALOG is shown with a suggested filename and JSON filter.
  // Canceling the dialog cancels the download — the file isn't created.
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const defaultPath = path.join(
      app.getPath('downloads'),
      item.getFilename() || 'joyconaz-settings.json'
    );
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Save Settings',
      defaultPath,
      filters: [{ name: 'JSON Settings File', extensions: ['json'] }],
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });

  // Debug: JOYCONAZ_DEVTOOLS=1 npm start — open DevTools.
  if (process.env.JOYCONAZ_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Links with target="_blank" open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Standard in-window link navigation (like GitHub in footer)
  // is also redirected to system browser, so the app window doesn't
  // "leave" the therapy page.
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

// Compact application menu: page reload (quick fix for most oddities —
// like Ctrl+F5 in a browser), zoom, fullscreen, and DevTools.
// On macOS additionally system items "About"/ "Quit" (appMenu) and window menu.
// On Windows/Linux the menu is hidden (autoHideMenuBar) and appears on Alt —
// so it doesn't clutter the dark frameless top.
const registerMenu = () => {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { type: 'separator' },
        ...(isMac
          ? [{ role: 'close', label: 'Close Window' }]
          : [{ role: 'quit', label: 'Exit' }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
      ],
    },
    ...(isMac ? [{ role: 'windowMenu' }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// Single app instance: repeated launch doesn't spawn new windows,
// but focuses the already open one (relevant during a therapy session).
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
    // Automatically approve WebHID access ONLY to Nintendo devices.
    // In browser, this relies on the Chrome dialog "Allow site to access device";
    // in desktop app, the decision is made by this handler — user selects Joy-Con,
    // permission is granted instantly without extra prompts.
    session.defaultSession.setDevicePermissionHandler((request) => {
      return (
        request.deviceType === 'hid' &&
        request.device?.vendorId === NINTENDO_VENDOR_ID
      );
    });

    // The "Connect Joy-Con" button calls navigator.hid.requestDevice.
    // Instead of showing a system choice dialog, we auto-select the first
    // available Nintendo device. Already allowed devices do not enter the
    // candidate list, so repeated button presses connect Joy-Cons one by one
    // (in the order OS lists them). If no Nintendo devices are found, the request
    // cancels — web code properly handles an empty response.
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
    // createWindow (and adaptive size calculation inside it)
    // runs strictly after app.whenReady — the 'screen' module
    // is unavailable before that moment.
    createWindow();
  });

  app.on('window-all-closed', () => {
    // Closing the last window (red button on macOS, cross on Windows)
    // ALWAYS fully quits the app — familiar user behavior "close button
    // closes program". Platform check is removed: the app no longer
    // "hangs" in the dock windowless, so the 'activate' handler to revive it
    // is unneeded and removed. Cmd+Q continues to work normally:
    // when quitting via Cmd+Q Electron itself closes windows, and this
    // event isn't redundantly emitted — double quit doesn't happen.
    // app.quit() gracefully terminates the app: close and beforeunload
    // handlers get to run, so Joy-Con vibration and sound correctly stop
    // upon closing the window.
    app.quit();
  });
}