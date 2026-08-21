import {
  connectJoyCon,
  connectedJoyCons,
  JoyConLeft,
  JoyConRight,
} from './joy-con-webhid.es.js';

const connectButton = document.querySelector('#connect-joy-cons');
const startStopButton = document.querySelector('#start-stop');
const speedSlider = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const rumbleSlider = document.querySelector('#rumble-strength');
const rumbleValue = document.querySelector('#rumble-strength-value');
const patternSelect = document.querySelector('#pattern');
const favoritePatternToggle = document.querySelector('#favorite-pattern');
const onlyFavoritesToggle = document.querySelector('#only-favorites');
const randomPatternToggle = document.querySelector('#random-pattern');
const randomModeToggle = document.querySelector('#random-mode');
const testPatternButton = document.querySelector('#test-pattern');
const soundEnabledToggle = document.querySelector('#sound-enabled');
const soundFileSelect = document.querySelector('#sound-file');
const statusLeft = document.querySelector('#status-left');
const statusRight = document.querySelector('#status-right');
const ball = document.querySelector('#ball');
const helpButton = document.querySelector('#help-open');
const helpOverlay = document.querySelector('#help-overlay');
const helpCloseButton = document.querySelector('#help-close');
const controlsButton = document.querySelector('#controls-open');
const controlsOverlay = document.querySelector('#controls-overlay');
const controlsCloseButton = document.querySelector('#controls-close');
const settingsButton = document.querySelector('#settings-open');
const settingsOverlay = document.querySelector('#settings-overlay');
const settingsCloseButton = document.querySelector('#settings-close');
const settingsSaveButton = document.querySelector('#settings-save');
const settingsLoadButton = document.querySelector('#settings-load');
const settingsFileInput = document.querySelector('#settings-file-input');
const azbukaButton = document.querySelector('#azbuka-open');
const azbukaOverlay = document.querySelector('#azbuka-overlay');
const azbukaCloseButton = document.querySelector('#azbuka-close');

// ── Окружение: настольная сборка Electron или браузер ────────────────
//
// Один и тот же код работает в двух средах:
// - настольное приложение Electron для macOS и Windows (main.js,
//   package.json, DESKTOP.md);
// - обычная веб-страница в браузере (веб-версия).
// Electron добавляет в User-Agent подстроку «Electron» — по ней
// различаем среды. Различие влияет на две вещи:
// - ЗВУК: в Electron политика автовоспроизведения задана в main.js
//   (autoplayPolicy: 'no-user-gesture-required'), поэтому щелчок
//   пальцев звучит сразу, с первого касания края, без предварительного
//   клика по окну — браузерный resume() аудиоконтекста ниже не нужен;
// - ХРАНИЛИЩЕ НАСТРОЕК: localStorage в Electron лежит в профиле
//   приложения (userData) и переживает перезапуски и обновления
//   приложения; в браузере — обычное хранилище страницы.
const IS_ELECTRON = navigator.userAgent.includes('Electron');
if (IS_ELECTRON) {
  console.info(
    '[env] настольная сборка Electron — звук разрешён без разблокировки'
  );
}

// --- Вибрация Joy-Con ---
const LOW_FREQUENCY = 160; // Гц
const HIGH_FREQUENCY = 320; // Гц

// Рисунки (паттерны) вибрации: последовательность шагов.
// Шаг с полем duration — включение вибрации на указанное время,
// шаг с полем pause — тишина указанной длительности.
//
// Важные ограничения при конструировании рисунков:
// - сегменты короче ~40–60 мс WebHID/Bluetooth и внутреннее
//   сглаживание Joy-Con могут «съесть», поэтому длительности шагов
//   не меньше 55 мс, паузы не меньше 45 мс;
// - полный рисунок по умолчанию укладывается в ~500 мс, чтобы успевать
//   проигрываться до следующего касания края даже на максимальной
//   скорости (проход границы при 2.0 × калибровка ≈ 330 мс);
// - низкая частота 80–220 Гц читается как «гулкое» низкое жужжание,
//   160–400 Гц — как более звонкое; сочетанием low/high «рисуется»
//   высота тона тактильного ощущения;
// - поле cutoff у шага (используется в «кликовых» паттернах в стиле
//   Apple Watch) заставляет проигрыватель сразу после импульса послать
//   амплитуду 0 — это максимально быстро гасит актуатор, убирая хвост
//   и резонанс, делая клик чётким и «сухим».
const RUMBLE_PATTERNS = {
  // ── Простые ──────────────────────────────────────────────────────────
  // Один импульс 220 мс — прежнее поведение приложения (по умолчанию).
  pulse: [{ duration: 220, amplitude: 1, low: 160, high: 320 }],
  // Один отчётливый короткий «касательный» импульс.
  tap: [{ duration: 120, amplitude: 1, low: 160, high: 320 }],
  // Короткий резкий щелчок / укол высокого тона.
  staccato: [{ duration: 55, amplitude: 1, low: 220, high: 440 }],

  // ── Ритмические (несколько ударов) ───────────────────────────────────
  // Два коротких импульса подряд.
  doubleTap: [
    { duration: 70, amplitude: 0.9, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.9, low: 160, high: 320 },
  ],
  // Три ровных коротких удара: акцентированный маркер края.
  tripleTap: [
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
  ],
  // Короткая вибрация с «отпусканием» — ритм сердцебиения.
  heartbeat: [
    { duration: 65, amplitude: 0.8, low: 140, high: 280 },
    { pause: 55 },
    { duration: 120, amplitude: 0.55, low: 120, high: 240 },
  ],
  // Ритм Морзе «R»: точка-точка-тире — легко запоминающийся, чётко
  // отличимый от сердца и касаний рисунок.
  morse: [
    { duration: 55, amplitude: 0.85, low: 160, high: 320 },
    { pause: 55 },
    { duration: 55, amplitude: 0.85, low: 160, high: 320 },
    { pause: 55 },
    { duration: 160, amplitude: 0.85, low: 140, high: 280 },
  ],
  // «Тик-так»: два удара одинаковой силы, но разной высоты тона
  // (низкий «тик», высокий «так»). Различие тонов помогает чувствовать,
  // к какому краю прикоснулся шарик, даже с закрытыми глазами.
  tickTock: [
    { duration: 70, amplitude: 0.75, low: 100, high: 200 },
    { pause: 70 },
    { duration: 70, amplitude: 0.75, low: 180, high: 360 },
  ],
  // Ритм «Галоп»: сдвоенный быстрый шаг с акцентом на втором ударе.
  gallop: [
    { duration: 60, amplitude: 0.8, low: 150, high: 300 },
    { pause: 45 },
    { duration: 90, amplitude: 1, low: 170, high: 340 },
  ],
  // Сильное сердцебиение: два мощных ударов с увеличенной паузой.
  heartbeatStrong: [
    { duration: 100, amplitude: 1, low: 160, high: 320 },
    { pause: 150 },
    { duration: 100, amplitude: 1, low: 160, high: 320 },
  ],
  // Равномерный метроном: тик-тик-тик с постоянным интервалом.
  metronome: [
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { pause: 60 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { pause: 60 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
  ],

  // ── Динамические (изменение силы и/или тона внутри рисунка) ──────────
  // Мягкий «пульс»: симметричная волна — нарастание и затухание.
  softWave: [
    { duration: 55, amplitude: 0.25, low: 110, high: 220 },
    { duration: 55, amplitude: 0.5, low: 130, high: 260 },
    { duration: 55, amplitude: 0.75, low: 150, high: 300 },
    { duration: 55, amplitude: 0.45, low: 130, high: 260 },
    { duration: 55, amplitude: 0.2, low: 110, high: 220 },
  ],
  // Нарастание («крещендо»): сила ступенчато растёт до пика и резко
  // обрывается — контраст с симметричной softWave: вся динамика вверх.
  crescendo: [
    { duration: 60, amplitude: 0.15, low: 110, high: 220 },
    { duration: 60, amplitude: 0.3, low: 125, high: 250 },
    { duration: 60, amplitude: 0.45, low: 140, high: 280 },
    { duration: 60, amplitude: 0.6, low: 150, high: 300 },
    { duration: 60, amplitude: 0.8, low: 160, high: 320 },
    { duration: 70, amplitude: 1, low: 170, high: 340 },
  ],
  // Каскад: тон и сила нисходят сверху вниз, как вода, стекающая
  // по ступеням, — всё сокращается и глохнет.
  cascade: [
    { duration: 60, amplitude: 0.8, low: 200, high: 400 },
    { duration: 60, amplitude: 0.7, low: 170, high: 340 },
    { duration: 60, amplitude: 0.6, low: 140, high: 280 },
    { duration: 60, amplitude: 0.5, low: 110, high: 220 },
    { duration: 60, amplitude: 0.4, low: 90, high: 180 },
    { duration: 60, amplitude: 0.3, low: 80, high: 160 },
  ],
  // Эхо: один сильный удар и два затухающих отклика той же формы.
  echo: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.5, low: 140, high: 280 },
    { pause: 60 },
    { duration: 55, amplitude: 0.25, low: 120, high: 240 },
  ],
  // Зигзаг: чередование сильных (высокий тон) и тихих (низкий тон)
  // ударов — «рваный», энергоёмкий рисунок.
  zigzag: [
    { duration: 60, amplitude: 0.9, low: 180, high: 360 },
    { duration: 60, amplitude: 0.4, low: 130, high: 260 },
    { duration: 60, amplitude: 0.9, low: 180, high: 360 },
    { duration: 60, amplitude: 0.4, low: 130, high: 260 },
    { duration: 70, amplitude: 0.9, low: 180, high: 360 },
  ],
  // Прибой: самая мягкая и длинная волна с двумя гребнями — большой
  // накат, короткий откат и догоняющая вторая волна.
  oceanWave: [
    { duration: 80, amplitude: 0.2, low: 90, high: 180 },
    { duration: 80, amplitude: 0.4, low: 110, high: 220 },
    { duration: 90, amplitude: 0.65, low: 130, high: 260 },
    { duration: 80, amplitude: 0.35, low: 110, high: 220 },
    { pause: 45 },
    { duration: 70, amplitude: 0.3, low: 100, high: 200 },
    { duration: 60, amplitude: 0.2, low: 90, high: 180 },
  ],
  // Отскок («Bounce»): затухающие прыжки мячика с сокращением длительностей и пауз.
  bounce: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.7, low: 150, high: 300 },
    { pause: 50 },
    { duration: 55, amplitude: 0.45, low: 140, high: 280 },
    { pause: 45 },
    { duration: 55, amplitude: 0.25, low: 130, high: 260 },
  ],
  // Тремоло: частое дробное дрожание одинаковой силы.
  tremolo: [
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
  ],
  // Землетрясение: глухой низкочастотный рокот с быстрым нарастанием силы.
  earthquake: [
    { duration: 70, amplitude: 0.3, low: 80, high: 120 },
    { duration: 70, amplitude: 0.6, low: 90, high: 140 },
    { duration: 80, amplitude: 0.9, low: 100, high: 160 },
    { duration: 90, amplitude: 1, low: 110, high: 180 },
  ],
  // Поезд (pulseTrain): серия коротких импульсов с нарастающей и спадающей амплитудой.
  pulseTrain: [
    { duration: 55, amplitude: 0.3, low: 160, high: 320 },
    { duration: 55, amplitude: 0.6, low: 160, high: 320 },
    { duration: 55, amplitude: 0.9, low: 160, high: 320 },
    { duration: 55, amplitude: 0.6, low: 160, high: 320 },
    { duration: 55, amplitude: 0.3, low: 160, high: 320 },
  ],
  // Всплеск (swell): плавное нарастание и спад амплитуды.
  swell: [
    { duration: 60, amplitude: 0.2, low: 130, high: 260 },
    { duration: 60, amplitude: 0.4, low: 140, high: 280 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { duration: 60, amplitude: 0.4, low: 140, high: 280 },
    { duration: 60, amplitude: 0.2, low: 130, high: 260 },
  ],
  // Жужжание (buzz): быстрые короткие импульсы с высокой частотой.
  buzz: [
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
  ],
  // Сирена (siren): чередование низкой и высокой частоты.
  siren: [
    { duration: 100, amplitude: 0.8, low: 100, high: 200 },
    { duration: 100, amplitude: 0.8, low: 300, high: 600 },
    { duration: 100, amplitude: 0.8, low: 100, high: 200 },
    { duration: 100, amplitude: 0.8, low: 300, high: 600 },
  ],

  // ── Новые ритмические ─────────────────────────────────────────────────
  // Вальс: ритм 3/4 — сильный первый удар и два слабых.
  // Ощущение плавного танцевального покачивания.
  waltz: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 60, amplitude: 0.5, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.5, low: 160, high: 320 },
  ],
  // Самба: быстрый латиноамериканский ритм с синкопированием.
  // Короткие удары с нарастающей энергией и акцентом в конце.
  samba: [
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { pause: 45 },
    { duration: 55, amplitude: 0.9, low: 180, high: 360 },
    { pause: 45 },
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { pause: 45 },
    { duration: 70, amplitude: 1, low: 200, high: 400 },
  ],
  // Марш: чёткий военный ритм «раз-два, раз-два».
  // Тяжёлые низкочастотные удары с равными паузами.
  march: [
    { duration: 80, amplitude: 1, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 0.7, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 1, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 0.7, low: 140, high: 280 },
  ],

  // ── Новые динамические ────────────────────────────────────────────────
  // Фейерверк: резкий взрыв и быстрое затухание с «искрами» высокого тона.
  // Каждый последующий импульс выше по тону и слабее по силе.
  firework: [
    { duration: 55, amplitude: 1, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.6, low: 250, high: 500 },
    { pause: 45 },
    { duration: 55, amplitude: 0.4, low: 300, high: 600 },
    { pause: 45 },
    { duration: 55, amplitude: 0.2, low: 350, high: 700 },
  ],
  // Капли дождя: нерегулярные короткие импульсы разной силы,
  // имитирующие случайное падение капель.
  raindrops: [
    { duration: 55, amplitude: 0.4, low: 200, high: 400 },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.3, low: 200, high: 400 },
    { pause: 70 },
    { duration: 55, amplitude: 0.6, low: 200, high: 400 },
    { pause: 50 },
    { duration: 55, amplitude: 0.5, low: 200, high: 400 },
  ],
  // Гром: низкочастотный рокот с нарастанием и мощным ударом.
  // Очень низкие частоты создают ощущение глубокой вибрации.
  thunder: [
    { duration: 80, amplitude: 0.3, low: 80, high: 120 },
    { duration: 80, amplitude: 0.6, low: 80, high: 130 },
    { duration: 90, amplitude: 1, low: 90, high: 150 },
    { duration: 70, amplitude: 0.7, low: 80, high: 120 },
    { duration: 60, amplitude: 0.4, low: 80, high: 110 },
  ],
  // Порыв ветра: плавное нарастание, сильный порыв и затухание.
  // Средние частоты, симметричная форма как у softWave, но с акцентом.
  windGust: [
    { duration: 60, amplitude: 0.2, low: 100, high: 200 },
    { duration: 60, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.9, low: 140, high: 280 },
    { duration: 60, amplitude: 0.5, low: 120, high: 240 },
    { duration: 60, amplitude: 0.2, low: 100, high: 200 },
  ],
  // Бабочка: лёгкие, едва ощутимые касания с паузами.
  // Очень низкая амплитуда и высокий тон — нежное порхание.
  butterfly: [
    { duration: 55, amplitude: 0.3, low: 200, high: 400 },
    { pause: 55 },
    { duration: 55, amplitude: 0.2, low: 200, high: 400 },
    { pause: 60 },
    { duration: 55, amplitude: 0.3, low: 200, high: 400 },
    { pause: 55 },
    { duration: 55, amplitude: 0.15, low: 200, high: 400 },
  ],
  // Барабанная дробь: быстрое нарастание силы ударов без пауз,
  // завершающееся мощным акцентом.
  drumRoll: [
    { duration: 55, amplitude: 0.5, low: 180, high: 360 },
    { duration: 55, amplitude: 0.6, low: 180, high: 360 },
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { duration: 55, amplitude: 0.8, low: 180, high: 360 },
    { duration: 55, amplitude: 0.9, low: 180, high: 360 },
    { duration: 70, amplitude: 1, low: 200, high: 400 },
  ],
  // Сонар: одиночный пинг с двумя затухающими эхами.
  // Высокий тон и чёткие паузы создают ощущение радиолокации.
  sonar: [
    { duration: 70, amplitude: 0.9, low: 200, high: 400 },
    { pause: 80 },
    { duration: 55, amplitude: 0.4, low: 200, high: 400 },
    { pause: 80 },
    { duration: 55, amplitude: 0.2, low: 200, high: 400 },
  ],
  // Дрожь: очень быстрые мелкие импульсы без пауз.
  // Высокая частота и средняя амплитуда — ощущение мелкой тряски.
  shiver: [
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
  ],
  // Мурлыканье: мягкая непрерывная вибрация с лёгкой модуляцией.
  // Низкая частота, чередование амплитуд — уютное урчание.
  purring: [
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
    { duration: 70, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
    { duration: 70, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
  ],

  // ── Тактильные клики (стиль Apple Watch) ──────────────────────────────
  // Короткие, чёткие, «сухие» импульсы без гула и хвоста, как у Taptic
  // Engine. Поле cutoff заставляет проигрыватель сразу после импульса
  // послать амплитуду 0 — актуатор быстро гаснет, резонанс минимален.
  // Средне-высокие частоты дают звонкий «клик» вместо низкого гула,
  // а умеренная амплитуда делает ощущение приятным, но ощутимым.

  // Щелчок — одиночный чёткий клик, как механический переключатель.
  click: [
    { duration: 55, amplitude: 0.7, low: 210, high: 420, cutoff: true },
  ],
  // Мягкий щелчок — тише и чуть ниже тоном, деликатный.
  softClick: [
    { duration: 55, amplitude: 0.5, low: 180, high: 360, cutoff: true },
  ],
  // Звонкий тик — самый короткий и высокий щелчок.
  crispTick: [
    { duration: 55, amplitude: 0.6, low: 240, high: 480, cutoff: true },
  ],
  // Уведомление — два коротких тика, как приход сообщения на Apple Watch.
  notification: [
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
  ],
  // Успех — одиночный «тук» чуть ниже тоном, приятный и уверенный.
  success: [
    { duration: 60, amplitude: 0.65, low: 170, high: 340, cutoff: true },
  ],
  // Тройной сигнал — три коротких тика, более заметный.
  alert: [
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
  ],
  // Пузырёк — одиночный лёгкий высокий клик.
  pop: [
    { duration: 55, amplitude: 0.55, low: 260, high: 520, cutoff: true },
  ],
  // Двойное постукивание — два мягких тика, как лёгкое касание.
  doubleTick: [
    { duration: 55, amplitude: 0.6, low: 220, high: 440, cutoff: true },
    { pause: 55 },
    { duration: 55, amplitude: 0.6, low: 220, high: 440, cutoff: true },
  ],

  // ── Тактильные клики: добавленные из библиотеки haptics ───────────────
  // Портированы из набора «Taptic-style» паттернов: импульсы звонкие и
  // короткие, на резонансных частотах актуаторов LRA, с активным
  // обрывом хвоста. Длительности импульсов эталона (10–24 мс) растянуты
  // до минимальных 55–60 мс: WebHID/Bluetooth и внутреннее сглаживание
  // Joy-Con «съедают» более короткие сегменты, не меняя ощущение клика.

  // Двойной клик: два быстрых щелчка подряд, второй чуть сильнее —
  // классический отклик «выбрано» / двойное нажатие.
  doubleClick: [
    { duration: 55, amplitude: 0.55, low: 200, high: 400, cutoff: true },
    { pause: 45 },
    { duration: 55, amplitude: 0.7, low: 220, high: 440, cutoff: true },
  ],
  // Предупреждение: два твёрдых удара чуть ниже тоном —
  // «внимание, что-то требует проверки».
  warning: [
    { duration: 60, amplitude: 0.85, low: 140, high: 260, cutoff: true },
    { pause: 80 },
    { duration: 60, amplitude: 0.85, low: 140, high: 260, cutoff: true },
  ],
  // Ошибка: три коротких резких низких импульса —
  // классический сигнал «отказ» интерфейсов.
  error: [
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
  ],
};

// Счётчики сессий вибрации — по одному на каждую сторону. Инкремент
// номера сессии отменяет проигрывание всех начатых ранее
// последовательностей на этой стороне: новый паттерн или «Стоп»
// гарантированно прерывают старый рисунок, а не наслаиваются на него.
// Счётчики раздельные для сторон, чтобы быстрый проход шарика
// left → right не отменял паттерн, только что начатый на другой стороне.
const vibrationSessions = { left: 0, right: 0 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Отправляет Joy-Con один шаг паттерна: амплитуда шага умножается на
// мастер-коэффициент (ползунок в обычном режиме или сохранённая для
// рисунка сила в рандомном — см. patternMasterAmplitude).
const rumbleJoyConStep = (joyCon, step, masterAmplitude) =>
  joyCon.rumble(
    step.low ?? LOW_FREQUENCY,
    step.high ?? HIGH_FREQUENCY,
    Math.min(1, step.amplitude * masterAmplitude)
  );

// Проигрывает рисунок вибрации на всех Joy-Con выбранной стороны.
// Вызывается без ожидания (void ...) из анимации: последующие кадры
// рендера не ждут завершения рисунка.
//
// Какой именно рисунок играть — решает chooseRumblePattern: в рандомном
// режиме это ДВУХЭТАПНЫЙ выбор (этап 1 — менять ли рисунок вообще;
// при «да» этап 2 — случайный новый рисунок из списка «рандомных»,
// при «нет» — снова играет текущий рисунок рандомного режима),
// иначе — текущий выбранный в интерфейсе.
// СИЛА тоже зависит от режима: в обычном это текущее значение ползунка
// (мастер-коэффициент), а в рандомном режиме ползунок ИГНОРИРУЕТСЯ —
// звучащий рисунок играет с силой, СОХРАНЁННОЙ ИМЕННО ДЛЯ НЕГО в
// localStorage (или 50%, если её для рисунка не настраивали) —
// см. patternMasterAmplitude.
const rumbleSidePattern = async (side) => {
  const session = ++vibrationSessions[side];
  const choice = chooseRumblePattern();
  const patternName = choice.name;
  const masterAmplitude = patternMasterAmplitude(patternName, choice.random);
  const pattern = RUMBLE_PATTERNS[patternName] ?? RUMBLE_PATTERNS.pulse;
  const joyCons = [...connectedJoyCons.values()].filter((joyCon) =>
    isSide(joyCon, side)
  );

  buzzStatus(side === 'left' ? statusLeft : statusRight);

  try {
    for (const step of pattern) {
      // Сессия устарела — рисунок отменён (новый паттерн или Стоп).
      if (session !== vibrationSessions[side]) {
        return;
      }

      if (step.pause) {
        await Promise.all(
          joyCons.map((joyCon) =>
            joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0)
          )
        );
        await sleep(step.pause);
        continue;
      }

      await Promise.all(
        joyCons.map((joyCon) =>
          rumbleJoyConStep(joyCon, step, masterAmplitude)
        )
      );
      await sleep(step.duration);

      // cutoff — сразу после импульса гасим актуатор (амплитуда 0),
      // чтобы не оставалось хвоста и резонанса. Используется в
      // «кликовых» паттернах в стиле Apple Watch.
      if (step.cutoff) {
        await Promise.all(
          joyCons.map((joyCon) =>
            joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0)
          )
        );
      }
    }

    // Гарантированно выключаем вибрацию по завершении рисунка.
    if (session === vibrationSessions[side]) {
      await Promise.all(
        joyCons.map((joyCon) =>
          joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0)
        )
      );
    }
  } catch (error) {
    console.error('Ошибка воспроизведения рисунка вибрации:', error);
  }
};

const stopVibration = () => {
  vibrationSessions.left++;
  vibrationSessions.right++;
  for (const joyCon of connectedJoyCons.values()) {
    joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0);
  }
};

// Отступ шарика от краёв дорожки (чтобы не перекрывать цветные маркеры).
const EDGE_MARGIN = 30; // px

// Управление скоростью кнопками со стрелками.
const SPEED_MIN = 0.1;
const SPEED_MAX = 2;
// Шаг изменения скорости за одно срабатывание на Joy-Con: одиночное
// нажатие стрелок ◄ / ► или одно отклонение правого стика.
// Специально КРУПНЕЕ шага ползунка (0.05, задаётся атрибутом step
// в index.html): с контроллера скорость меняется вдвое быстрее, а
// мышью по ползунку — по-прежнему точными шагами 0.05. Шаг 0.1 кратен
// сетке ползунка, поэтому значения кнопок и стика всегда ложатся на неё.
const SPEED_STEP = 0.1;
const SPEED_REPEAT_DELAY_MS = 400; // задержка перед автоповтором при удержании
const ARROW_REPEAT_INTERVAL_MS = 250; // интервал автоповтора при удержании
// Минимальный интервал между двумя шагами по одной и той же стрелке.
// Защищает от «дребезга» кнопки и от слишком быстрых повторных нажатий:
// одиночное нажатие всегда даёт ровно один шаг 0.1.
const ARROW_MIN_STEP_INTERVAL_MS = 150;

// Коэффициент перекалибровки шкалы скорости.
// Новое значение 1.0 субъективно соответствует прежней скорости 1.5,
// то есть фактическая скорость движения = значение на ползунке × 1.5.
const SPEED_CALIBRATION = 1.5;

// Защита от ложных срабатываний Старт/Стоп (дребезг, дубли событий HID).
const TOGGLE_DEBOUNCE_MS = 200;

// Состояние анимации: позиция шарика 0..1 и направление движения.
let running = false;
let rafId = null;
let lastTime = null;
let position = 0.5;
let direction = 1;
let lastToggleAt = 0;

// Последние состояния кнопок по ключу устройства (для детектирования
// нажатия — фронта сигнала), а не по объекту JoyCon.
// На один и тот же физический Joy-Con иногда создаётся несколько объектов-
// обёрток, и объекты меняются между переподключениями.
const previousButtons = new Map();

// Ключи устройств, на которые уже навешан обработчик hidinput.
const attachedKeys = new Set();

// Стабильный ключ физического устройства.
// Один и тот же Joy-Con может оказаться в connectedJoyCons дважды
// (две обёртки над одним HID-устройством, например после переподключения).
// Тогда один и тот же пакет кнопок обрабатывается два раза: Старт/Стоп
// переключается дважды за одно нажатие (Старт и тут же Стоп), что внешне
// выглядит как «кнопки не работают». Ключ по неизменяемым свойствам
// устройства позволяет обрабатывать события каждого устройства ровно один раз.
const deviceKey = (device) =>
  `${device?.vendorId ?? '?'}-${device?.productId ?? '?'}-${
    device?.productName ?? '?'
  }`;

connectButton.addEventListener('click', connectJoyCon);

const updateSpeedValue = () => {
  speedValue.textContent = Number(speedSlider.value).toFixed(2);
};

const updateRumbleValue = () => {
  rumbleValue.textContent = `${Math.round(
    Number(rumbleSlider.value) * 100
  )}%`;
};

// ── Сохранение силы вибрации для каждого рисунка ──────────────────────
//
// Ползунок силы масштабирует весь рисунок целиком, и удобная громкость
// у разных рисунков разная («бабочка» тихая, «гром» громкий). Поэтому
// сила запоминается ОТДЕЛЬНО ДЛЯ КАЖДОГО рисунка и хранится в
// localStorage: в браузере — хранилище страницы (переживает перезагрузку
// страницы и браузера), в настольной сборке Electron — профиль
// приложения (userData), переживающий перезапуски и обновления
// приложения.
//
// Поведение при переключении рисунка (селектором или кнопками «+»/«−»):
// - если для нового рисунка сила ранее настраивалась — она подставляется;
// - если не настраивалась — ползунок сбрасывается на 50%.
//
// Сохранённые силы используются ДВАЖДЫ:
// - при переключении рисунка они подставляются в ползунок
//   (applyPatternStrength);
// - в РАНДОМНОМ режиме каждый звучащий рисунок играет сразу
//   со СВОЕЙ сохранённой силой — ползунок при этом игнорируется
//   (см. patternMasterAmplitude).
//
// Сохраняются только РУЧНЫЕ изменения: ползунок (событие input, которое
// не генерируется при программной установке .value) и стрелки ▲ / ▼
// (changeRumbleStrength). Подстановка сохранённого значения при
// переключении рисунка ничего не перезаписывает, пока пользователь
// сам не изменит силу.
const RUMBLE_STRENGTH_STORAGE_KEY = 'joyconaz.rumbleStrength';
const DEFAULT_RUMBLE_STRENGTH = 0.5;

// Читает карту «имя рисунка → сила». Любая ошибка (хранилище
// недоступен или данные повреждены) безопасно откатывается к пустой
// карте.
const loadPatternStrengths = () => {
  try {
    const raw = localStorage.getItem(RUMBLE_STRENGTH_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Не удалось прочитать сохранённую силу вибрации:', error);
    return {};
  }
};

const savePatternStrengths = (strengths) => {
  try {
    localStorage.setItem(
      RUMBLE_STRENGTH_STORAGE_KEY,
      JSON.stringify(strengths)
    );
  } catch (error) {
    console.warn('Не удалось сохранить силу вибрации:', error);
  }
};

// Запоминает силу для указанного рисунка. Значение округляется до сотых
// (чтобы не плодить артефакты float вроде 0.30000000000000004) и
// ограничивается диапазоном ползунка; запись без изменений пропускается,
// чтобы не дёргать localStorage лишний раз при каждом input.
const rememberPatternStrength = (patternName, strength) => {
  const value = Math.min(
    Math.max(
      Math.round(Number(strength) * 100) / 100,
      Number(rumbleSlider.min)
    ),
    Number(rumbleSlider.max)
  );

  const strengths = loadPatternStrengths();
  if (strengths[patternName] === value) {
    return;
  }
  strengths[patternName] = value;
  savePatternStrengths(strengths);
};

// Подставляет ползунку силу, сохранённую для указанного рисунка,
// либо сбрасывает её на 50%, если силу для рисунка ещё не настраивали.
// Установка .value программно НЕ порождает событие input, поэтому
// подстановка сама по себе ничего не «до-сохраняет».
const applyPatternStrength = (patternName) => {
  const saved = loadPatternStrengths()[patternName];
  const value =
    typeof saved === 'number' && Number.isFinite(saved)
      ? saved
      : DEFAULT_RUMBLE_STRENGTH;
  rumbleSlider.value = String(value);
  updateRumbleValue();
};

// Имя текущего выбранного рисунка (с защитой, как в rumbleSidePattern).
const currentPatternName = () => patternSelect?.value ?? 'pulse';

// ── Сохранение последнего выбранного рисунка вибрации ─────────────────
//
// Сам выбор рисунка тоже запоминается в localStorage: при следующем
// открытии приложения последний использованный рисунок подставляется
// автоматически. Записывается при любом способе выбора — селектором
// в интерфейсе и кнопками «−» / «+» на Joy-Con (switchPattern).
// Восстановление валидируется по списку селектора: если сохранённое
// имя по какой-то причине в списке отсутствует (например, рисунок
// удалён в новой версии), остаётся значение по умолчанию из HTML.
//
// ВАЖНО ПОРЯДКОМ ЗАПУСКА: восстановление рисунка выполняется ДО
// applyPatternStrength при загрузке страницы — тогда подставится сила
// именно восстановленного рисунка, а не стартового из HTML.
//
// Программная установка patternSelect.value события change не порождает,
// поэтому восстановление ничего не «до-сохраняет» обратно.
const PATTERN_STORAGE_KEY = 'joyconaz.pattern';

const loadPatternSelection = () => {
  try {
    const raw = localStorage.getItem(PATTERN_STORAGE_KEY);
    return typeof raw === 'string' ? raw : null;
  } catch (error) {
    console.warn('Не удалось прочитать сохранённый рисунок вибрации:', error);
    return null;
  }
};

const savePatternSelection = (patternName) => {
  try {
    localStorage.setItem(PATTERN_STORAGE_KEY, patternName);
  } catch (error) {
    console.warn('Не удалось сохранить рисунок вибрации:', error);
  }
};

// Восстанавливает сохранённый рисунок, если он есть в списке селектора.
const restorePatternSelection = () => {
  if (!patternSelect) {
    return;
  }
  const saved = loadPatternSelection();
  if (
    saved &&
    [...patternSelect.options].some((option) => option.value === saved)
  ) {
    patternSelect.value = saved;
  }
};

// ── Избранные рисунки вибрации ────────────────────────────────────────
//
// Флажок «Избранный рисунок» (#favorite-pattern) отражает/меняет
// принадлежность ТЕКУЩЕГО выбранного рисунка к избранному:
// - отмечен — текущий рисунок в списке избранного;
// - снят — рисунок удалён из избранного.
// Он синхронизируется при каждом переключении рисунка (список,
// кнопки «−»/«+»: разные рисунки могут иметь разный статус) и сам
// меняет статус при клике мышью, и при «горячей» комбинации кнопок:
// L+R или ZL+ZR одновременно (см. handleFavoriteCombo ниже).
//
// Флажок «Только избранное» (#only-favorites) включает фильтр:
// - в выпадающем списке видны только избранные рисунки;
// - круговое переключение кнопками «−» / «+» тоже проходит только
//   по избранным.
// Если при включении флажка текущий рисунок не из избранного —
// автоматически выбирается первый избранный (с его сохранённой силой);
// если избранное пусто — фильтр не применяется (список полный),
// чтобы интерфейс не остался без выбора. Избранные помечаются
// звёздочкой ★ в тексте пункта.
//
// Хранение: список имён — joyconaz.favoritePatterns (JSON-массив),
// состояние флажка фильтра — joyconaz.onlyFavorites (JSON true/false).
const FAVORITE_PATTERNS_STORAGE_KEY = 'joyconaz.favoritePatterns';
const ONLY_FAVORITES_STORAGE_KEY = 'joyconaz.onlyFavorites';

// Минимальный интервал между переключениями избранного комбинациями
// кнопок: защита от дребезга и от дублирования HID-пакетов.
const FAVORITE_TOGGLE_MIN_INTERVAL_MS = 250;

// Исходные подписи пунктов списка (без звёздочки) — снимаются один раз
// при загрузке, чтобы rebuildPatternOptions всегда восстанавливал
// «чистый» текст, а не накапливал ★ друг за другом.
const PATTERN_BASE_LABELS = new Map(
  [...(patternSelect?.options ?? [])].map((option) => [
    option.value,
    option.textContent.trim(),
  ])
);

// Читает список избранных рисунков; ошибки обращения к localStorage
// безопасно откатываются к пустому списку.
const loadFavoritePatterns = () => {
  try {
    const raw = localStorage.getItem(FAVORITE_PATTERNS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((name) => typeof name === 'string');
  } catch (error) {
    console.warn('Не удалось прочитать избранные рисунки:', error);
    return [];
  }
};

const saveFavoritePatterns = (favorites) => {
  try {
    localStorage.setItem(
      FAVORITE_PATTERNS_STORAGE_KEY,
      JSON.stringify(favorites)
    );
  } catch (error) {
    console.warn('Не удалось сохранить избранные рисунки:', error);
  }
};

const loadOnlyFavorites = () => {
  try {
    return JSON.parse(localStorage.getItem(ONLY_FAVORITES_STORAGE_KEY)) === true;
  } catch {
    return false;
  }
};

const saveOnlyFavorites = (value) => {
  try {
    localStorage.setItem(ONLY_FAVORITES_STORAGE_KEY, JSON.stringify(Boolean(value)));
  } catch {
    // localStorage недоступен — просто живём без сохранения состояния.
  }
};

const isFavorite = (patternName) => loadFavoritePatterns().includes(patternName);

// Короткая золотистая вспышка флажка избранного: переключение с кнопок
// контроллеров видно глазами даже не глядя на список.
const flashFavoriteToggle = () => {
  favoritePatternToggle?.animate(
    [
      { boxShadow: '0 0 0px rgba(255, 213, 79, 0)' },
      { boxShadow: '0 0 14px rgba(255, 213, 79, 0.9)' },
      { boxShadow: '0 0 0px rgba(255, 213, 79, 0)' },
    ],
    { duration: 300, easing: 'ease-out' }
  );
};

// Подводит флажок «Избранный рисунок» под статус ТЕКУЩЕГО рисунка.
// Вызывается при загрузке, при каждом переключении рисунка и после
// каждого изменения избранного.
const updateFavoriteToggle = () => {
  if (favoritePatternToggle) {
    favoritePatternToggle.checked = isFavorite(currentPatternName());
  }
};

// Добавляет/удаляет рисунок из избранного и приводит интерфейс
// в актуальное состояние: обновляет флажок, перерисовывает список
// (звёздочки, видимость при включённом фильтре) — rebuildPatternOptions
// при необходимости сам переведёт выбор на доступный рисунок.
const setFavorite = (patternName, favorite) => {
  const favorites = loadFavoritePatterns();
  const already = favorites.includes(patternName);
  if (favorite === already) {
    return;
  }
  if (favorite) {
    favorites.push(patternName);
  } else {
    favorites.splice(favorites.indexOf(patternName), 1);
  }
  saveFavoritePatterns(favorites);
  flashFavoriteToggle();
  rebuildPatternOptions();
};

// Переключает избранность текущего рисунка (для комбинаций кнопок
// L+R / ZL+ZR и для дублирования клика мышью по самому флажку).
const toggleCurrentFavorite = () => {
  const name = currentPatternName();
  setFavorite(name, !isFavorite(name));
};

// Пересобирает отображение выпадающего списка под состояние избранного:
// - проставляет/снимает звёздочку ★ в подписи избранных пунктов
//   и кубик 🎲 у рисунков из списка «рандомных» (см. секцию ниже);
// - скрывает чужие пункты, если включён фильтр «Только избранное»
//   и в избранном хотя бы один рисунок;
// - если из-за фильтра текущий выбранный пункт оказался скрыт —
//   выбирается первый видимый (первый избранный по порядку списка),
//   выбор сохраняется, подставляется его сила.
const rebuildPatternOptions = () => {
  if (!patternSelect) {
    return;
  }
  const favorites = loadFavoritePatterns();
  const randomPatterns = loadRandomPatterns();
  const filterActive =
    Boolean(onlyFavoritesToggle?.checked) && favorites.length > 0;

  let firstVisible = null;
  let currentVisible = false;
  for (const option of patternSelect.options) {
    const favored = favorites.includes(option.value);
    const randomized = randomPatterns.includes(option.value);
    option.hidden = filterActive && !favored;
    const baseLabel = PATTERN_BASE_LABELS.get(option.value) ?? option.value;
    option.textContent =
      (favored ? '★ ' : '') + (randomized ? '🎲 ' : '') + baseLabel;
    if (!option.hidden) {
      if (firstVisible === null) {
        firstVisible = option.value;
      }
      if (option.value === patternSelect.value) {
        currentVisible = true;
      }
    }
  }

  if (filterActive && !currentVisible && firstVisible !== null) {
    patternSelect.value = firstVisible;
    savePatternSelection(firstVisible);
    applyPatternStrength(firstVisible);
  }

  updateFavoriteToggle();
  updateRandomToggle();
};

// Список рисунков для кругового переключения кнопками «−» / «+»:
// при включённом фильтре — только избранные, в исходном порядке
// полного списка; если фильтр выключен или избранное пусто — все.
const switchablePatternValues = () => {
  if (!onlyFavoritesToggle?.checked) {
    return [...(patternSelect?.options ?? [])].map((option) => option.value);
  }
  const favorites = loadFavoritePatterns();
  if (favorites.length === 0) {
    return [...(patternSelect?.options ?? [])].map((option) => option.value);
  }
  return [...(patternSelect?.options ?? [])]
    .map((option) => option.value)
    .filter((name) => favorites.includes(name));
};

// Клик по флажку «Избранный рисунок»: добавить/удалить текущий рисунок.
favoritePatternToggle?.addEventListener('change', () => {
  setFavorite(currentPatternName(), favoritePatternToggle.checked);
});

// Клик по флажку «Только избранное»: сохранить состояние и перестроить
// список (при необходимости выбор переедет на первый избранный).
onlyFavoritesToggle?.addEventListener('change', () => {
  saveOnlyFavorites(onlyFavoritesToggle.checked);
  rebuildPatternOptions();
});

// ── Рандомные рисунки и рандомный режим ──────────────────────────────
//
// Флажок «Использовать рандомно» (#random-pattern) управляет
// принадлежностью ТЕКУЩЕГО выбранного рисунка к списку «рандомных
// рисунков»:
// - отмечен — текущий рисунок ДОБАВЛЕН в список «рандомных»;
// - снят — рисунок УДАЛЁН из списка.
// Список ПОЛНОСТЬЮ НЕЗАВИСИМ от избранного: один и тот же рисунок может
// быть одновременно и в избранном, и в «рандомных», только в одном из
// списков или ни в одном. Флажок синхронизируется при каждом
// переключении рисунка (как и «Избранный рисунок»), потому что у разных
// рисунков разное членство в списке. Членство помечается кубиком 🎲
// в подписи пункта выпадающего списка (у избранного — звёздочка ★).
//
// Флажок «Рандомный режим» (#random-mode) ВКЛЮЧАЕТ режим, в котором
// рисунок вибрации для КАЖДОГО касания шариком края определяется
// ДВУХЭТАПНЫМ случайным выбором:
// - ЭТАП 1 — «бросок монеты»: менять ли рисунок вообще (да/нет).
//   Ответ «нет» — смена НЕ происходит, снова играет ТЕКУЩИЙ рисунок
//   рандомного режима (randomModePattern);
// - ЭТАП 2 — выполняется только при ответе «да»: случайный выбор
//   НОВОГО рисунка из списка «рандомных». Если кандидатов больше
//   одного, текущий рисунок исключается из «броска», чтобы «да»
//   всегда означало именно СМЕНУ рисунка.
// Стартовым «текущим» считается рисунок, выбранный в интерфейсе
// (randomModePattern сбрасывается при каждом переключении флажка
// режима). При этом полностью игнорируются избранное и флажок
// «Только избранное»: на этапе 2 кандидаты — ВСЕ рисунки списка
// независимо от их избранности. СИЛА каждого рисунка в этом режиме —
// СОХРАНЁННАЯ ИМЕННО ДЛЯ НЕГО в localStorage (та же карта «имя → сила»,
// что настраивается ползунком); ползунок силы при этом игнорируется —
// см. patternMasterAmplitude. Выпадающий список и кнопки «−»/«+»
// продолжают работать как обычно — они задают рисунок для обычного
// режима и рисунок, к которому применяется флажок «Использовать
// рандомно». Если список «рандомных» пуст, играет текущий выбранный
// рисунок с силой ползунка — рандомный режим без кандидатов поведение
// не меняет.
//
// УПРАВЛЕНИЕ С КОНТРОЛЛЕРОВ: НАЖАТИЕ правого стика (rightStick, правый
// Joy-Con) включает/выключает рандомный режим; кнопка Capture (левый
// Joy-Con) добавляет/удаляет ТЕКУЩИЙ выбранный рисунок в списке
// «рандомных» — то же самое, что клик по соответствующему флажку.
// Обёртки библиотеки обнуляют (undefined) «чужие» кнопки: нажатие
// правого стика — в пакетах левого Joy-Con, Capture — в пакетах
// правого, поэтому фронт нажатия определяется корректно по карте
// previousButtons для каждого устройства отдельно. НАЖАТИЕ стика —
// это отдельная кнопка, и она НЕ мешает отклонению того же стика,
// которым меняется скорость: нажатие не отклоняет стик, а отклонение
// не нажимает его.
//
// Хранение: список имён — joyconaz.randomPatterns (JSON-массив),
// состояние флажка режима — joyconaz.randomMode (JSON true/false).
const RANDOM_PATTERNS_STORAGE_KEY = 'joyconaz.randomPatterns';
const RANDOM_MODE_STORAGE_KEY = 'joyconaz.randomMode';

// Вероятность ответа «да» на первом этапе рандомного режима: с этой
// вероятностью при касании края происходит смена рисунка, иначе снова
// играет текущий. 0.5 — честная «монета»; значение легко поменять,
// чтобы смена стала реже или чаще.
const RANDOM_CHANGE_PROBABILITY = 0.5;

// «Текущий» рисунок рандомного режима — то, что играет при ответе
// «нет» на первом этапе и что исключается из «броска» на втором.
// null означает «ещё не определён»: первым касанием края после
// включения режима текущим становится выбранный в интерфейсе рисунок.
// Сбрасывается при каждом переключении флажка режима.
let randomModePattern = null;

// Минимальный интервал между переключениями рандомного режима
// нажатием правого стика (правый Joy-Con) и членства текущего рисунка
// в списке «рандомных» кнопкой Capture (левый Joy-Con): защита от
// дребезга и дублирования HID-пакетов.
const RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS = 250;
let lastRandomModeToggleAt = 0;
const RANDOM_PATTERN_TOGGLE_MIN_INTERVAL_MS = 250;
let lastRandomPatternToggleAt = 0;

// Читает список «рандомных» рисунков; ошибки обращения к localStorage
// безопасно откатываются к пустому списку.
const loadRandomPatterns = () => {
  try {
    const raw = localStorage.getItem(RANDOM_PATTERNS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((name) => typeof name === 'string');
  } catch (error) {
    console.warn('Не удалось прочитать рандомные рисунки:', error);
    return [];
  }
};

const saveRandomPatterns = (patterns) => {
  try {
    localStorage.setItem(
      RANDOM_PATTERNS_STORAGE_KEY,
      JSON.stringify(patterns)
    );
  } catch (error) {
    console.warn('Не удалось сохранить рандомные рисунки:', error);
  }
};

const loadRandomMode = () => {
  try {
    return JSON.parse(localStorage.getItem(RANDOM_MODE_STORAGE_KEY)) === true;
  } catch {
    return false;
  }
};

const saveRandomMode = (value) => {
  try {
    localStorage.setItem(
      RANDOM_MODE_STORAGE_KEY,
      JSON.stringify(Boolean(value))
    );
  } catch {
    // localStorage недоступен — просто живём без сохранения состояния.
  }
};

const isRandomPattern = (patternName) =>
  loadRandomPatterns().includes(patternName);

// Короткая фиолетовая вспышка флажка «Использовать рандомно»:
// переключение видно глазами даже не глядя на список.
const flashRandomToggle = () => {
  randomPatternToggle?.animate(
    [
      { boxShadow: '0 0 0px rgba(156, 134, 232, 0)' },
      { boxShadow: '0 0 14px rgba(156, 134, 232, 0.9)' },
      { boxShadow: '0 0 0px rgba(156, 134, 232, 0)' },
    ],
    { duration: 300, easing: 'ease-out' }
  );
};

// Подводит флажок «Использовать рандомно» под статус ТЕКУЩЕГО рисунка.
// Вызывается при загрузке, при каждом переключении рисунка и после
// каждого изменения списка «рандомных».
const updateRandomToggle = () => {
  if (randomPatternToggle) {
    randomPatternToggle.checked = isRandomPattern(currentPatternName());
  }
};

// Добавляет/удаляет рисунок из списка «рандомных» и приводит интерфейс
// в актуальное состояние: обновляет флажок и перерисовывает список
// (маркеры 🎲 у пунктов).
const setRandomPattern = (patternName, randomized) => {
  const patterns = loadRandomPatterns();
  const already = patterns.includes(patternName);
  if (randomized === already) {
    return;
  }
  if (randomized) {
    patterns.push(patternName);
  } else {
    patterns.splice(patterns.indexOf(patternName), 1);
  }
  saveRandomPatterns(patterns);
  flashRandomToggle();
  rebuildPatternOptions();
};

// Переключает членство ТЕКУЩЕГО рисунка в списке «рандомных»
// (для кнопки Capture на левом Joy-Con; клик мыши по флажку
// обрабатывается собственным слушателем change ниже).
const toggleCurrentRandomPattern = () => {
  const name = currentPatternName();
  setRandomPattern(name, !isRandomPattern(name));
};

// ── Случайность из датчиков Joy-Con ──────────────────────────────────
//
// Источник случайности для рандомного режима. Показания акселерометров
// и гироскопов обоих Joy-Con непрерывно подмешиваются в 32-битный
// энтропийный пул: датчики выдают живой аналоговый шум (микродвижения
// руки, дрожание АЦП), поэтому их значения от пакета к пакету
// непредсказуемы. Значения, РАВНЫЕ НУЛЮ, пропускаются — ноль не несёт
// информации о текущем состоянии датчика. Для выбора рисунка пул
// разворачивается xorshift32 в равномерное число [0, 1) и дополнительно
// перемешивается с Math.random(): даже если датчики молчат или их шум
// «застрял», распределение остаётся равномерным.
//
// Энтропия накапливается в обработчике hidinput (см. setInterval ниже):
// каждый пакет стандартного полного режима (0x30) содержит усреднённые
// показания actualAccelerometer (g) и actualGyroscope (dps и rps)
// конкретного контроллера — оба Joy-Con питают общий пул.
let sensorEntropy = 0;
let sensorEntropySamples = 0;

// Подмешивает одно значение датчика в пул (нулевые и нечисловые
// значения пропускаются). Точность разбора библиотеки — 6 знаков,
// поэтому значение масштабируется в целое с 6 знаками и замешивается
// умножением на простую константу (мультипликативное смешивание).
const feedSensorValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return;
  }
  const scaled = Math.trunc(Math.abs(numeric) * 1e6) % 4294967296;
  sensorEntropy =
    (Math.imul(sensorEntropy ^ scaled, 2654435761) + 0x9e3779b9) >>> 0;
  sensorEntropySamples++;
};

// Извлекает ненулевые показания акселерометра и гироскопа из пакета
// hidinput и передаёт их в пул энтропии.
const feedSensorEntropy = (packet) => {
  const accelerometer = packet?.actualAccelerometer;
  if (accelerometer) {
    feedSensorValue(accelerometer.x);
    feedSensorValue(accelerometer.y);
    feedSensorValue(accelerometer.z);
  }
  const gyroscope = packet?.actualGyroscope;
  if (gyroscope?.dps) {
    feedSensorValue(gyroscope.dps.x);
    feedSensorValue(gyroscope.dps.y);
    feedSensorValue(gyroscope.dps.z);
  }
  if (gyroscope?.rps) {
    feedSensorValue(gyroscope.rps.x);
    feedSensorValue(gyroscope.rps.y);
    feedSensorValue(gyroscope.rps.z);
  }
};

// Равномерное случайное число [0, 1): xorshift32 по пулу энтропии,
// перемешанное с Math.random(). Если датчики ещё не прислали ни одного
// ненулевого значения, работает чистый Math.random().
const sensorRandomUnit = () => {
  if (sensorEntropySamples === 0 || sensorEntropy === 0) {
    return Math.random();
  }
  let x = sensorEntropy | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  sensorEntropy = x >>> 0;
  return (sensorEntropy / 4294967296 + Math.random()) % 1;
};

// Выбирает случайный элемент списка.
const pickRandomFrom = (items) => {
  const index = Math.floor(sensorRandomUnit() * items.length);
  return items[Math.min(Math.max(index, 0), items.length - 1)];
};

// Сила (мастер-коэффициент), с которой проигрывается рисунок:
// - ОБЫЧНЫЙ режим (fromRandomMode = false): текущее значение ползунка
//   силы — прежнее поведение, ползунок масштабирует выбранный
//   в интерфейсе рисунок целиком;
// - РАНДОМНЫЙ режим (fromRandomMode = true): ползунок ИГНОРИРУЕТСЯ,
//   и звучащий рисунок играет с силой, СОХРАНЁННОЙ ИМЕННО ДЛЯ НЕГО
//   в localStorage (та же карта «имя → сила», которая подставляется
//   в ползунок при переключении рисунка). Если силу для рисунка ещё
//   не настраивали — 50%, как и при первом выборе рисунка в селекторе.
//   Так каждый рисунок звучит со своей настроенной громкостью, какой
//   бы ползунок ни стоял в момент «броска».
const patternMasterAmplitude = (patternName, fromRandomMode) => {
  if (!fromRandomMode) {
    return Number(rumbleSlider.value);
  }
  const saved = loadPatternStrengths()[patternName];
  return typeof saved === 'number' && Number.isFinite(saved)
    ? saved
    : DEFAULT_RUMBLE_STRENGTH;
};

// Выбор рисунка для очередного касания края (тот же выбор использует
// и «Проверить вибрацию»). ОБЫЧНЫЙ режим — текущий выбранный в
// интерфейсе рисунок. РАНДОМНЫЙ режим — ДВУХЭТАПНЫЙ выбор:
// - ЭТАП 1: менять ли рисунок вообще (вероятность «да» —
//   RANDOM_CHANGE_PROBABILITY);
// - ЭТАП 2 (только при «да»): случайный НОВЫЙ рисунок из списка
//   «рандомных» — избранное и флажок «Только избранное» игнорируются,
//   при нескольких кандидатах текущий исключается из «броска»;
// - при «нет» снова играет текущий randomModePattern.
// Имена, которых нет в RUMBLE_PATTERNS (например, удалённые в новой
// версии рисунка), отфильтровываются, чтобы «броски» не тратились
// на них.
//
// Возвращает { name, random }: name — имя выбранного рисунка, random —
// взят ли он в рандомном режиме. По этому флагу rumbleSidePattern
// решает, откуда брать силу: ползунок (обычный режим) или сохранённое
// для рисунка значение (рандомный режим, см. patternMasterAmplitude).
const chooseRumblePattern = () => {
  if (!randomModeToggle?.checked) {
    return { name: currentPatternName(), random: false };
  }

  const candidates = loadRandomPatterns().filter((name) =>
    Object.prototype.hasOwnProperty.call(RUMBLE_PATTERNS, name)
  );
  if (candidates.length === 0) {
    // Список «рандомных» пуст — играет текущий выбранный рисунок
    // обычным способом (с силой ползунка).
    return { name: currentPatternName(), random: false };
  }

  // «Текущий» рисунок рандомного режима ещё не определён (первое
  // касание края после включения режима) или исчез из RUMBLE_PATTERNS —
  // стартовым значением становится выбранный в интерфейсе рисунок
  // (с защитой: если его вдруг нет среди рисунков — первый кандидат).
  if (
    randomModePattern === null ||
    !Object.prototype.hasOwnProperty.call(
      RUMBLE_PATTERNS,
      randomModePattern
    )
  ) {
    const selected = currentPatternName();
    randomModePattern = Object.prototype.hasOwnProperty.call(
      RUMBLE_PATTERNS,
      selected
    )
      ? selected
      : candidates[0];
  }

  // ── Этап 1: менять ли рисунок вообще ─────────────────────────────
  if (sensorRandomUnit() < RANDOM_CHANGE_PROBABILITY) {
    // ── Этап 2: случайный выбор НОВОГО рисунка из списка ───────────
    // При «да» имеет смысл именно СМЕНА: если кандидатов больше одного,
    // текущий рисунок исключается из «броска», чтобы ответ «да»
    // не мог оставить тот же самый рисунок.
    const pool =
      candidates.length > 1
        ? candidates.filter((name) => name !== randomModePattern)
        : candidates;
    randomModePattern = pickRandomFrom(pool);
    console.debug(`[random] смена рисунка: ${randomModePattern}`);
  } else {
    console.debug(`[random] без смены рисунка: ${randomModePattern}`);
  }

  return { name: randomModePattern, random: true };
};

// Клик по флажку «Использовать рандомно»: добавить/удалить текущий
// рисунок из списка «рандомных».
randomPatternToggle?.addEventListener('change', () => {
  setRandomPattern(currentPatternName(), randomPatternToggle.checked);
});

// Короткая фиолетовая вспышка флажка «Рандомный режим»: переключение
// (кликом мыши или нажатием правого стика) видно глазами.
const flashRandomModeToggle = () => {
  randomModeToggle?.animate(
    [
      { boxShadow: '0 0 0px rgba(156, 134, 232, 0)' },
      { boxShadow: '0 0 14px rgba(156, 134, 232, 0.9)' },
      { boxShadow: '0 0 0px rgba(156, 134, 232, 0)' },
    ],
    { duration: 300, easing: 'ease-out' }
  );
};

// Включает/выключает рандомный режим с общими последствиями для обоих
// способов переключения (клик мышью и нажатие правого стика на правом
// Joy-Con): состояние сохраняется локально, «текущий» рисунок режима
// сбрасывается (новое включение начинает с рисунка, выбранного
// в интерфейсе). При включении с пустым списком «рандомных» —
// подсказка в консоль.
const applyRandomMode = (enabled) => {
  saveRandomMode(enabled);
  flashRandomModeToggle();
  randomModePattern = null;
  if (enabled && loadRandomPatterns().length === 0) {
    console.info(
      '[random] рандомный режим включён, но список «рандомных» пуст — ' +
        'играет текущий выбранный рисунок; отметьте флажок «Использовать ' +
        'рандомно» у нужных рисунков или нажмите Capture на левом Joy-Con'
    );
  }
};

// Переключает рандомный режим (для нажатия правого стика на правом
// Joy-Con). Программная установка .checked события change НЕ порождает,
// поэтому сначала переводим флажок, затем выполняем общую логику.
const toggleRandomMode = () => {
  if (!randomModeToggle) {
    return;
  }
  randomModeToggle.checked = !randomModeToggle.checked;
  applyRandomMode(randomModeToggle.checked);
};

// Клик по флажку «Рандомный режим»: включить/выключить режим —
// общая логика в applyRandomMode.
randomModeToggle?.addEventListener('change', () => {
  applyRandomMode(randomModeToggle.checked);
});

speedSlider.addEventListener('input', updateSpeedValue);

// Изменение силы ползунком: обновляем индикатор и запоминаем силу
// для текущего рисунка. Программная установка значения (из
// applyPatternStrength) сюда не попадает — событие input только
// пользовательское.
// В рандомном режиме ползунок НЕ влияет на вибрацию при касании края
// (там каждый рисунок играет со своей сохранённой силой), но по-прежнему
// запоминает силу для текущего выбранного рисунка — так удобно заранее
// настроить громкость рисунков из списка «рандомных».
rumbleSlider.addEventListener('input', () => {
  updateRumbleValue();
  rememberPatternStrength(currentPatternName(), rumbleSlider.value);
});

// Ручной выбор рисунка в селекторе: запоминаем выбор, подставляем
// сохранённую для него силу или сбрасываем на 50%, и синхронизируем
// флажки «Избранный рисунок» и «Использовать рандомно» со статусом
// нового рисунка. Программная установка patternSelect.value события
// change не порождает — двойной работы нет.
patternSelect?.addEventListener('change', () => {
  savePatternSelection(currentPatternName());
  applyPatternStrength(currentPatternName());
  updateFavoriteToggle();
  updateRandomToggle();
});

updateSpeedValue();
updateRumbleValue();
// При загрузке сначала восстанавливаем последний выбранный рисунок,
// затем состояние фильтра избранного (rebuildPatternOptions при
// необходимости переведёт выбор на доступный рисунок), затем состояние
// рандомного режима, и под конец подставляем силу именно текущего
// рисунка.
restorePatternSelection();
if (onlyFavoritesToggle) {
  onlyFavoritesToggle.checked = loadOnlyFavorites();
}
if (randomModeToggle) {
  randomModeToggle.checked = loadRandomMode();
}
rebuildPatternOptions();
applyPatternStrength(currentPatternName());

// ── Звук щелчка пальцев (Web Audio + панорамирование) ────────────────
//
// Дополнение к вибрации: в момент касания шариком края можно включить
// короткий (300 мс) звук щелчка пальцев из подпапки sound/.
// Звук включается/выключается флажком, конкретный файл выбирается
// в выпадающем списке. Оба состояния хранятся в localStorage
// (в браузере — страницы, в Electron — профиле приложения) и
// восстанавливаются при следующем открытии.
//
// ПАНОРАМИРОВАНИЕ. Щелчок панорамируется ПО СТОРОНЕ КРАЯ: шарик летит
// ВПРАВО — щелчок звучит ТОЛЬКО в правом динамике, ВЛЕВО — только
// в левом. Так звук указывает сторону касания так же, как вибрация
// указывает сторону Joy-Con. Реализовано через Web Audio API:
// файлы декодируются в AudioBuffer (моно-содержимое не важно —
// StereoPannerNode смешивает/панорамирует любые буферы), при каждом
// запуске создаётся AudioBufferSourceNode → StereoPannerNode
// (pan = −1 весь сигнал в левый канал, +1 — в правый, 0 — центр)
// → destination. Проверочные запуски (включение флажка при
// остановленном движении, смена файла, «Проверить вибрацию») звучат
// ПО ЦЕНТРУ — в обоих динамиках.
//
// ВЫРАВНИВАНИЕ ПО МОМЕНТУ КАСАНИЯ. Файлы эталонно по 300 мс, слышимый
// щелчок в них лежит ПРИМЕРНО В СЕРЕДИНЕ, причём начальная пауза у
// каждого файла СВОЯ. Если запускать файл в сам момент касания края,
// щелчок звучал бы с опозданием на всю начальную паузу. Поэтому файл
// запускается ЗАРАНЕЕ, на подлёте — когда до края по текущей скорости
// остаётся время, равное ПОЛОВИНЕ длительности файла: за время подлёта
// проигрывается начальная пауза, и к моменту касания воспроизведение
// доходит ровно до середины файла — щелчок звучит точно в касание.
// Механика — см. maybePreplayEdgeSound рядом с тиком анимации.
//
// ПОЧЕМУ АДРЕС СЧИТАЕТСЯ ОТ import.meta.url: относительный путь
// «sound/…» в fetch() разрешается относительно адреса СТРАНИЦЫ, и при
// любом расхождении адреса страницы и расположения скрипта (переезд,
// вложенный каталог, отсутствие завершающего слэша) путь уводил не
// туда. Теперь URL строится от расположения app.js — файлы ищутся
// строго рядом со скриптом. В браузере это
// https://…/joyconaz/sound/<файл>, в настольной сборке Electron —
// file://-путь рядом с main.js; поведение одинаковое. URL абсолютный
// и печатается в консоль — его сразу видно на вкладке Network и в
// любом сообщении об ошибке.
const SOUND_STORAGE_KEY = 'joyconaz.sound';
const SOUND_FILES = [
  'chasqueo-100233.mp3',
  'finger-snap-101756.mp3',
  'finger-snap-43482.mp3',
];
const DEFAULT_SOUND_FILE = SOUND_FILES[0];

// Половина эталонной длительности файла (300 мс / 2 = 150 мс).
// Используется как «точка щелчка», пока файл ещё не декодирован
// (buffer === null): буфер и точная длительность появляются после
// асинхронной загрузки.
const SOUND_FALLBACK_MIDPOINT_S = 0.15;

// Значения панорамы StereoPannerNode: −1 — весь сигнал в левый канал,
// +1 — в правый, 0 — центр (оба канала поровну).
const PAN_LEFT = -1;
const PAN_RIGHT = 1;
const PAN_CENTER = 0;

// Считает абсолютный URL файла звука от расположения этого скрипта.
const soundUrl = (file) => new URL(`sound/${file}`, import.meta.url).href;

// Аудиоконтекст создаётся один на страницу. Сразу после создания
// в браузере он находится в состоянии «suspended» (политика
// автовоспроизведения Chromium): decodeAudioData при этом РАБОТАЕТ,
// а воспроизведение оживляет resume() по первому пользовательскому
// жесту (см. unlockAudio ниже). В настольной сборке Electron контекст
// сразу «running» — там политика задана в main.js.
const AudioContextCtor =
  window.AudioContext ?? window.webkitAudioContext ?? null;
const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
if (!audioContext) {
  console.warn('[sound] Web Audio API недоступен — звук щелчка выключен');
}

// Текущий звучащий источник. Один щелчок звучит максимум один:
// новый запуск останавливает предыдущий (аналог прежнего поведения
// «один Audio-элемент перезапускается с начала»), а «Стоп» глушит
// досрочно запущенный на подлёте файл.
let activeSoundSource = null;

const stopActiveSoundSource = () => {
  if (!activeSoundSource) {
    return;
  }
  try {
    activeSoundSource.stop();
  } catch {
    // Источник уже отыграл и остановился сам.
  }
  activeSoundSource = null;
};

// Оживляет аудиоконтекст, если браузер его приостановил. Идемпотентен:
// в «running» повторный вызов ничего не делает. Вызывается и при
// разблокировке по жесту, и перед каждым запуском звука — двойная
// страховка.
const ensureAudioResumed = async () => {
  if (!audioContext || audioContext.state !== 'suspended') {
    return;
  }
  try {
    await audioContext.resume();
  } catch (error) {
    console.warn('[sound] не удалось возобновить аудиоконтекст:', error);
  }
};

// Записи о файлах звука: буфер (после декодирования), URL и ТОЧКА
// ЩЕЛЧКА — середина длительности файла (для эталонных 300 мс это
// 0.15 с). Точка обновляется по фактической длительности буфера:
// начальная пауза у файлов РАЗНАЯ, а половина длительности —
// единственная устойчивая «середина», общая для всех вариантов.
const soundEntries = new Map(
  SOUND_FILES.map((file) => ({
    file,
    entry: {
      url: soundUrl(file),
      buffer: null,
      midpoint: SOUND_FALLBACK_MIDPOINT_S,
    },
  })).map(({ file, entry }) => [file, entry])
);

// Загружает и декодирует один файл в AudioBuffer. Ошибки (404, не тот
// регистр букв в имени файла — веб-сервер может различать регистр!)
// попадают в консоль с точным URL; файл просто остаётся без буфера,
// и щелчок по нему не звучит, пока загрузка не увенчается успехом.
const loadSoundFile = async (file) => {
  const entry = soundEntries.get(file);
  if (!entry || !audioContext) {
    return;
  }
  try {
    console.info(`[sound] подготовка ${entry.url}`);
    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    entry.buffer = buffer;
    entry.midpoint = buffer.duration / 2;
    console.info(
      `[sound] ${file}: длительность ${buffer.duration.toFixed(3)} с, ` +
        `точка щелчка ${entry.midpoint.toFixed(3)} с`
    );
  } catch (error) {
    console.warn(
      `[sound] НЕ УДАЛОСЬ ЗАГРУЗИТЬ ${entry.url} (см. Network, F12):`,
      error
    );
  }
};

for (const file of SOUND_FILES) {
  void loadSoundFile(file);
}

// Читает сохранённые настройки звука {enabled, file}. Как и для силы
// вибрации, любая ошибка localStorage безопасно откатывается к пустому
// объекту (звук выключен, первый файл в списке).
const loadSoundSettings = () => {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Не удалось прочитать настройки звука:', error);
    return {};
  }
};

const saveSoundSettings = () => {
  try {
    localStorage.setItem(
      SOUND_STORAGE_KEY,
      JSON.stringify({
        enabled: Boolean(soundEnabledToggle?.checked),
        file: soundFileSelect?.value ?? DEFAULT_SOUND_FILE,
      })
    );
  } catch (error) {
    console.warn('Не удалось сохранить настройки звука:', error);
  }
};

// Восстановление сохранённого состояния при загрузке.
// Установка .checked и .value программно не порождает событий change,
// поэтому восстановление ничего лишнего не перезаписывает.
const restoreSoundSettings = () => {
  const saved = loadSoundSettings();
  if (soundEnabledToggle) {
    soundEnabledToggle.checked = saved.enabled === true;
  }
  if (soundFileSelect) {
    soundFileSelect.value = SOUND_FILES.includes(saved.file)
      ? saved.file
      : DEFAULT_SOUND_FILE;
  }
};

restoreSoundSettings();

// ── Разблокировка автовоспроизведения (только браузерная версия) ────
//
// Нужна ТОЛЬКО браузерной версии: Chromium в браузере разрешает
// воспроизведение через аудиоконтекст лишь после «пользовательской
// активности» — клика, касания или нажатия клавиши, а события WebHID
// (кнопки Joy-Con) такой активностью НЕ считаются. Контекст создаётся
// «suspended»; первый же жест вызывает resume(), и после этого звук
// может звучать в любой момент. В отличие от прежней схемы
// с Audio-элементами, здесь НЕТ гонки «pause разблокировки гасит
// настоящий запуск»: resume() контекста не останавливает уже
// запланированные источники.
//
// В настольной сборке Electron разблокировка НЕ выполняется: в main.js
// задано autoplayPolicy: 'no-user-gesture-required', контекст сразу
// «running» — щелчок слышен с самого первого касания края.
const unlockAudio = () => {
  void ensureAudioResumed();
};

if (!IS_ELECTRON) {
  for (const eventType of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    document.addEventListener(eventType, unlockAudio, { passive: true });
  }
}

// Проигрывает буфер файла с указанной ПАНОРАМОЙ (pan: −1 левый канал,
// +1 правый, 0 центр) и возвращает созданный источник. Новый запуск
// останавливает предыдущий — одновременно звучит максимум один щелчок.
// Ссылка на источник хранится в activeSoundSource для досрочной
// остановки из «Стоп»; по событию ended ссылка освобождается.
const playSoundBuffer = (entry, pan) => {
  if (!audioContext || !entry?.buffer) {
    // Файл ещё догружается или Web Audio недоступен — тихо пропускаем.
    return null;
  }
  void ensureAudioResumed();
  stopActiveSoundSource();

  const source = audioContext.createBufferSource();
  source.buffer = entry.buffer;

  if (typeof audioContext.createStereoPanner === 'function') {
    const panner = audioContext.createStereoPanner();
    panner.pan.value = pan;
    source.connect(panner);
    panner.connect(audioContext.destination);
  } else {
    // Крайне старые браузеры без StereoPannerNode: звук без
    // панорамирования, в обоих каналах.
    console.warn('[sound] StereoPannerNode недоступен — звук по центру');
    source.connect(audioContext.destination);
  }

  source.start();
  activeSoundSource = source;
  source.addEventListener('ended', () => {
    if (activeSoundSource === source) {
      activeSoundSource = null;
    }
  });
  console.info(`[sound] воспроизведение ${entry.url} (pan ${pan})`);
  return source;
};

// Короткая вспышка списка звуков в момент срабатывания: событие видно
// даже без наушников, что отделяет проблему «не запускается» от
// проблемы «не слышно».
const flashSoundSelect = () => {
  soundFileSelect?.animate(
    [
      { boxShadow: '0 0 0px rgba(127, 193, 255, 0)' },
      { boxShadow: '0 0 14px rgba(127, 193, 255, 0.85)' },
      { boxShadow: '0 0 0px rgba(127, 193, 255, 0)' },
    ],
    { duration: 300, easing: 'ease-out' }
  );
};

// Запись о файле, выбранном в списке (с откатом к первому из известных).
const currentSoundEntry = () => {
  const file = soundFileSelect?.value ?? DEFAULT_SOUND_FILE;
  return soundEntries.get(file) ?? soundEntries.get(DEFAULT_SOUND_FILE);
};

// Проигрывает выбранный щелчок с указанной панорамой. Вызывается:
// - досрочно с подлёта к краю (maybePreplayEdgeSound) — основной
//   сценарий: середина файла попадает ровно на касание, панорама —
//   сторона края (правый край → правый динамик, левый → левый);
// - вручную: включение флажка (только при остановленном движении),
//   смена файла, «Проверить вибрацию» — проверочные запуски от
//   пользовательского жеста, звучат ПО ЦЕНТРУ (в обоих динамиках),
//   с самого начала файла, включая его начальную паузу.
// Если флажок выключен — ничего не делает.
const playEdgeSound = (pan = PAN_CENTER) => {
  if (!soundEnabledToggle?.checked) {
    return;
  }
  const entry = currentSoundEntry();
  if (!entry) {
    return;
  }
  flashSoundSelect();
  playSoundBuffer(entry, pan);
};

// Немедленно останавливает звучащий щелчок — вызывается из «Стоп»:
// досрочный запуск мог уже начаться на подлёте (за ~150 мс до края),
// и хвост файла не должен звучать после остановки движения.
const stopEdgeSound = () => {
  stopActiveSoundSource();
};

// ── Досрочный запуск щелчка: середина файла = момент касания ────────
//
// Файлы эталонно по 300 мс; слышимый щелчок — примерно в середине,
// начальная пауза у файлов РАЗНАЯ. Чтобы СЕРЕДИНА файла прозвучала
// ровно тогда, когда шарик касается края, запуск выполняется ЗАРАНЕЕ:
// в момент, когда до края по текущей скорости остаётся время, равное
// половине длительности файла. Пока шарик проходит эти ~150 мс,
// проигрывается начальная пауза файла; к касанию воспроизведение
// доходит ровно до середины.
//
// ПАНОРАМА берётся из НАПРАВЛЕНИЯ полёта: direction > 0 — шарик летит
// к ПРАВОМУ краю, щелчок готовится в ПРАВЫЙ динамик; direction < 0 —
// к левому, в левый. Сторона известна уже в момент досрочного запуска,
// поэтому панорама задаётся один раз и не меняется до самого касания.
//
// Предсказание по простой баллистике: до края осталось пройти
// `distance` долей экрана при `fractionPerSecond` долях в секунду,
// значит время до края = distance / fractionPerSecond. Порог
// проверяется каждый кадр, поэтому погрешность выравнивания не
// превышает длительности одного кадра (~16 мс) и на слух незаметна.
// Изменение скорости ПОСЛЕ запуска (стрелки ◄/►) немного смещает
// момент щелчка — этим намеренно пренебрегаем: пересчитывать позицию
// уже звучащего файла было бы заметнее (скачок внутри щелчка), чем
// сдвиг на десятки миллисекунд.
//
// Один подлёт к краю запускает звук РОВНО ОДИН РАЗ: флаг edgeSoundArmed
// гасится в момент запуска и взводится заново при отскоке (и в start()).
// Если флажок звука выключен, запуск не происходит, но флаг всё равно
// гасится — этот подлёт уже «обработан», и позднее включение звука
// не даст полузапаздывающего щелчка в середине подлёта.
//
// Фолбэк на пропущенное окно: если из-за большого кадра (вкладка была
// свёрнута, dt скакнул) порог был проскочен и при обращении к краю
// флаг ещё взведён, запуск происходит в кадр касания — щелчок
// прозвучит с опозданием на начальную паузу, но прозвучит.
let edgeSoundArmed = true;

const maybePreplayEdgeSound = (fractionPerSecond) => {
  if (!edgeSoundArmed || fractionPerSecond <= 0) {
    return;
  }
  const entry = currentSoundEntry();
  const lead = entry?.midpoint ?? SOUND_FALLBACK_MIDPOINT_S;
  const distance = direction > 0 ? 1 - position : position;
  const timeToEdge = distance / fractionPerSecond;
  if (timeToEdge > lead) {
    return;
  }
  edgeSoundArmed = false;
  // Сторона щелчка = сторона края, к которому летит шарик.
  playEdgeSound(direction > 0 ? PAN_RIGHT : PAN_LEFT);
};

// Включение флажка — при ОСТАНОВЛЕННОМ движении сразу проигрываем
// выбранный щелчок ПО ЦЕНТРУ (в обоих динамиках): мгновенная проверка
// работоспособности звука. Если движение шарика запущено (running),
// проверочный щелчок НЕ играется: он прозвучал бы ВНЕ такта — не
// в момент касания края — и наложился бы на выровненные по краям
// звуки, сбивая ритм сессии. Звук просто включается и зазвучит
// со следующего касания края — в динамике со стороны края.
soundEnabledToggle?.addEventListener('change', () => {
  saveSoundSettings();
  if (!running) {
    playEdgeSound(PAN_CENTER);
  }
});

// Смена файла в списке — мгновенное прослушивание нового щелчка
// по центру. Играет только при включённом флажке.
soundFileSelect?.addEventListener('change', () => {
  saveSoundSettings();
  playEdgeSound(PAN_CENTER);
});

// Небольшая визуальная вспышка индикатора соответствующего Joy-Con.
const buzzStatus = (element) => {
  element.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.18)' },
      { transform: 'scale(1)' },
    ],
    { duration: 250, easing: 'ease-out' }
  );
};

const isSide = (joyCon, side) =>
  (side === 'left' && joyCon instanceof JoyConLeft) ||
  (side === 'right' && joyCon instanceof JoyConRight);

const updateBall = () => {
  const size = ball.offsetWidth || 48;
  const offset = position * (2 * EDGE_MARGIN + size);
  ball.style.left = `calc(${EDGE_MARGIN}px + ${position * 100}% - ${offset.toFixed(
    2
  )}px)`;
};

const updateStatus = () => {
  let hasLeft = false;
  let hasRight = false;
  for (const joyCon of connectedJoyCons.values()) {
    if (joyCon instanceof JoyConLeft) {
      hasLeft = true;
    }
    if (joyCon instanceof JoyConRight) {
      hasRight = true;
    }
  }
  statusLeft.textContent = hasLeft
    ? 'Левый: подключён'
    : 'Левый: не подключён';
  statusRight.textContent = hasRight
    ? 'Правый: подключён'
    : 'Правый: не подключён';
  statusLeft.classList.toggle('connected', hasLeft);
  statusRight.classList.toggle('connected', hasRight);
};

const tick = (time) => {
  if (!running) {
    return;
  }

  if (lastTime === null) {
    lastTime = time;
  }

  const dt = (time - lastTime) / 1000;
  lastTime = time;

  // Перекалиброванная шкала: значение на ползунке умножается на
  // SPEED_CALIBRATION, поэтому новое 1.00 движется так же, как прежние 1.5.
  const fractionPerSecond = Number(speedSlider.value) * SPEED_CALIBRATION;

  position += direction * fractionPerSecond * dt;

  // Досрочный запуск звука щелчка (с панорамой стороны края):
  // проверяем ДО фиксации касания, чтобы при проскоке порога
  // (большой dt) сработал и фолбэк-запуск в кадр касания — см.
  // комментарии у maybePreplayEdgeSound.
  maybePreplayEdgeSound(fractionPerSecond);

  if (position >= 1) {
    // Крайнее правое положение: рисунок вибрации на правом Joy-Con
    // (в рандомном режиме — двухэтапный выбор: при «нет» снова текущий
    // рисунок, при «да» новый из списка «рандомных»; сила — сохранённая
    // для рисунка, ползунок игнорируется).
    // Звук уже запущен заранее с панорамой ПРАВОГО канала (если флажок
    // включён) — остаётся взвести флаг досрочного запуска для следующего
    // прохода к левому краю.
    position = 1;
    direction = -1;
    edgeSoundArmed = true;
    void rumbleSidePattern('right');
  } else if (position <= 0) {
    // Крайнее левое положение: рисунок вибрации на левом Joy-Con
    // (в рандомном режиме — двухэтапный выбор: при «нет» снова текущий
    // рисунок, при «да» новый из списка «рандомных»; сила — сохранённая
    // для рисунка, ползунок игнорируется).
    // Звук уже запущен заранее с панорамой ЛЕВОГО канала.
    position = 0;
    direction = 1;
    edgeSoundArmed = true;
    void rumbleSidePattern('left');
  }

  updateBall();
  rafId = requestAnimationFrame(tick);
};

const start = () => {
  if (running) {
    return;
  }
  running = true;
  lastTime = null;
  // Взводим досрочный запуск звука для первого прохода к краю.
  edgeSoundArmed = true;
  startStopButton.textContent = 'Стоп';
  rafId = requestAnimationFrame(tick);
};

const stop = () => {
  if (!running) {
    return;
  }
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  startStopButton.textContent = 'Старт';
  stopVibration();
  // Досрочно запущенный щелчок (он мог зазвучать за ~150 мс до края)
  // останавливаем вместе с движением.
  stopEdgeSound();
  edgeSoundArmed = true;
};

// Переключение Старт/Стоп (кнопка на странице).
const toggle = () => {
  if (running) {
    stop();
  } else {
    start();
  }
};

// Переключение Старт/Стоп с кнопок Joy-Con: с защитой от повторов,
// чтобы дублированное HID-событие или дребезг не переключали
// состояние туда-обратно.
const tryToggle = () => {
  const now = performance.now();
  if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) {
    return;
  }
  lastToggleAt = now;
  toggle();
};

startStopButton.addEventListener('click', toggle);

// Кнопка проверки: проигрывает рисунок сразу на обеих сторонах
// (в рандомном режиме каждая сторона НЕЗАВИСИМО проходит двухэтапный
// выбор — возможно, снова текущий рисунок, возможно, новый из списка
// «рандомных»; сила — сохранённая именно для прозвучавшего рисунка)
// и, если звук включён, выбранный щелчок ПО ЦЕНТРУ — с начала файла
// (это проверочный запуск по пользовательскому клику; выравнивание
// по касанию края и панорамирование здесь не применяются).
testPatternButton?.addEventListener('click', () => {
  void rumbleSidePattern('left');
  void rumbleSidePattern('right');
  playEdgeSound(PAN_CENTER);
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Меняет скорость на заданный шаг с ограничением диапазона ползунка
// (в единицах новой перекалиброванной шкалы). Используется кнопками
// ◄ / ► и отклонением правого стика на Joy-Con — шаг SPEED_STEP (0.1);
// ползунок мыши ходит по собственной сетке step="0.05" из index.html
// независимо.
const changeSpeed = (delta) => {
  const current = Number(speedSlider.value);
  const next = clamp(
    Math.round((current + delta) * 100) / 100,
    SPEED_MIN,
    SPEED_MAX
  );
  if (next === current) {
    return;
  }
  speedSlider.value = String(next);
  updateSpeedValue();
};

// ── Переключение рисунков кнопками «+» / «−» ──────────────────────────
//
// «+» физически находится на правом Joy-Con, «−» — на левом. Обёртки
// библиотеки обнуляют (undefined) «чужие» кнопки в пакетах, поэтому
// фронт нажатия корректно определяется по карте previousButtons
// для каждого устройства отдельно.
//
// При включённом фильтре «Только избранное» цикл проходит только
// по избранным рисункам (см. switchablePatternValues). Рандомный режим
// на переключение не влияет: он меняет только выбор рисунка
// для касания края.
//
// Шаг изменения силы вибрации стрелками ▲ / ▼ — совпадает с шагом
// ползунка, чтобы значения всегда ложились на его сетку.
const RUMBLE_STRENGTH_STEP = 0.05;

// Минимальный интервал между переключениями рисунка: одно нажатие
// даёт ровно одно переключение, дребезг и дубли HID-пакетов
// игнорируются.
const PATTERN_SWITCH_MIN_INTERVAL_MS = 150;
let lastPatternSwitchAt = 0;

// Минимальный интервал между шагами силы вибрации (та же защита).
const STRENGTH_STEP_MIN_INTERVAL_MS = 150;
let lastStrengthStepAt = 0;

// Упорядоченный список значений селектора рисунков — в порядке,
// в котором они перечислены в интерфейсе (группы optgroup сохраняются
// как единый циклический список).
const PATTERN_VALUES = [...(patternSelect?.options ?? [])].map(
  (option) => option.value
);

// Переключает рисунок вибрации по кругу: delta = +1 — следующий рисунок,
// delta = −1 — предыдущий; после последнего идёт первый, перед первым —
// последний (циклический обход без «тупиков» на краях). Список обхода —
// все рисунки или только избранные (если включён фильтр и избранное
// не пусто). Сразу запоминаем выбор, подставляем сохранённую для нового
// рисунка силу (или 50%) и синхронизируем флажки «Избранный рисунок»
// и «Использовать рандомно» со статусом нового рисунка.
const switchPattern = (delta) => {
  const values = switchablePatternValues();
  if (values.length === 0) {
    return;
  }
  const now = performance.now();
  if (now - lastPatternSwitchAt < PATTERN_SWITCH_MIN_INTERVAL_MS) {
    return;
  }
  lastPatternSwitchAt = now;

  const index = values.indexOf(patternSelect.value);
  const current = index === -1 ? 0 : index;
  const next = (current + delta + values.length) % values.length;
  patternSelect.value = values[next];
  savePatternSelection(values[next]);
  applyPatternStrength(values[next]);
  updateFavoriteToggle();
  updateRandomToggle();
};

// Меняет силу вибрации на заданный шаг с ограничением диапазона ползунка
// и обновляет показатель в интерфейсе. Как и changeSpeed, округляет
// результат до сотых, чтобы избежать накопления ошибок float.
// Новое значение запоминается для текущего рисунка — кнопки ◄ / ►
// меняют рисунок, а ▲ / ▼ настраивают его громкость.
const changeRumbleStrength = (delta) => {
  const min = Number(rumbleSlider.min);
  const max = Number(rumbleSlider.max);
  const current = Number(rumbleSlider.value);
  const next = Math.min(
    Math.max(Math.round((current + delta) * 100) / 100, min),
    max
  );
  // На границе диапазона шаг не меняет значение — интервал не тратим,
  // чтобы сразу после упора следующий шаг в обратную сторону сработал.
  if (next === current) {
    return;
  }
  const now = performance.now();
  if (now - lastStrengthStepAt < STRENGTH_STEP_MIN_INTERVAL_MS) {
    return;
  }
  lastStrengthStepAt = now;
  rumbleSlider.value = String(next);
  updateRumbleValue();
  rememberPatternStrength(currentPatternName(), next);
};

// Состояние кнопок со стрелками ◄ / ►.
//
// ВАЖНО: пакеты, в которых значение кнопки равно undefined, полностью
// игнорируются (это значит «кнопка этим контроллером не отчитывается»),
// иначе пакеты правого Joy-Con сбрасывали бы состояние удержания стрелки
// и каждое нажатие считалось бы новым.
const arrowState = {
  left: { pressed: false, heldSince: 0, lastStepAt: 0 },
  right: { pressed: false, heldSince: 0, lastStepAt: 0 },
};

// Обработка кнопок со стрелками ◄ / ►:
// - одиночное нажатие меняет скорость ровно на один шаг (0.10);
// - удержание после SPEED_REPEAT_DELAY_MS плавно меняет скорость
//   с интервалом ARROW_REPEAT_INTERVAL_MS.
const handleArrowButtons = (buttons) => {
  const now = performance.now();

  for (const name of ['left', 'right']) {
    const value = buttons[name];
    const state = arrowState[name];

    // undefined — эта кнопка не отчитывается данным контроллером:
    // пропускаем пакет, НЕ сбрасывая состояние удержания.
    if (value === undefined) {
      continue;
    }

    const delta = name === 'right' ? SPEED_STEP : -SPEED_STEP;

    if (Boolean(value)) {
      if (!state.pressed || !state.heldSince) {
        // Новое нажатие (фронт): один шаг, если с прошлого шага
        // прошло достаточно времени.
        state.pressed = true;
        state.heldSince = now;
        if (now - state.lastStepAt >= ARROW_MIN_STEP_INTERVAL_MS) {
          state.lastStepAt = now;
          changeSpeed(delta);
        }
      } else if (
        // Удержание: автоповтор.
        now - state.heldSince >= SPEED_REPEAT_DELAY_MS &&
        now - state.lastStepAt >= ARROW_REPEAT_INTERVAL_MS
      ) {
        state.lastStepAt = now;
        changeSpeed(delta);
      }
    } else {
      state.pressed = false;
      state.heldSince = 0;
    }
  }
};

// ── Правый стик (правый Joy-Con): шаг скорости ────────────────────────
//
// Отклонение правого стика ВВЕРХ или ВПРАВО увеличивает скорость на
// SPEED_STEP (0.10), отклонение ВНИЗ или ВЛЕВО — уменьшает на 0.10.
// Стик аналоговый, поэтому «нажатием» считается пересечение порога
// отклонения: одно отклонение — ровно один шаг; чтобы следующее
// отклонение сработало снова, стик нужно вернуть в центр. Гистерезис
// между порогом активации и порогом возврата исключает дребезг
// срабатываний, когда стик держат около порога.
//
// Знаки осей в разборе библиотеки: вправо — horizontal > 0, влево —
// horizontal < 0, вверх — vertical < 0, вниз — vertical > 0.
//
// ПОЧЕМУ ВЕРТИКАЛЬ ЦЕНТРИРУЕТСЯ (исправление «вверх не работает»):
// горизонталь библиотека нормирует почти симметрично — нейтраль стика
// читается как ≈ 0, полный диапазон ≈ [−2, +2]. Вертикаль же из-за
// инвертирования и другой нормировки в разборе HID-пакета получается
// СО СМЕЩЁННЫМ НУЛЁМ: нейтраль стика читается как ≈ +0.155, а диапазон
// несимметричен — примерно [−1.7, +2]. Из-за этого полный ход стика
// ВВЕРХ давал лишь ≈ −0.7…−0.9 по вертикали, порог −1.0 не пересекался,
// и «вверх» не срабатывал, хотя вниз/вправо/влево работали. Поэтому
// вертикаль ПЕРЕД сравнением центрируется вычитанием теоретического
// нуля (RIGHT_STICK_VERTICAL_BIAS), а её порог «нажатия» взят ниже
// горизонтального — после центрирования оба направления вертикали
// надёжно достижимы при полном отклонении стика.
//
// Обрабатывается ТОЛЬКО на правом Joy-Con (фильтр в месте вызова):
// пакеты левого Joy-Con содержат в байтах правого стика нули, что
// разбирается как полное отклонение влево-вниз и без фильтра ложно
// уменьшало бы скорость.
//
// ВАЖНО: нажатие стика (кнопка rightStick) — отдельное событие и здесь
// НЕ участвует: им включается/выключается рандомный режим (см. секцию
// «Рандомные рисунки и рандомный режим»). Нажатие не отклоняет стик,
// а отклонение не нажимает его — механики не мешают друг другу.
const RIGHT_STICK_HORIZONTAL_TRIGGER = 1.0; // порог «нажатия» влево/вправо
const RIGHT_STICK_VERTICAL_TRIGGER = 0.6; // порог «нажатия» вверх/вниз (после центрирования)
const RIGHT_STICK_RELEASE = 0.4; // порог возврата в нейтраль (гистерезис)
// Теоретическое значение вертикали в нейтрали стика, которое даёт разбор
// библиотеки (нейтраль 12-битного датчика 2048 → +0.155): вычитается
// для центрирования вертикальной оси (см. комментарий выше).
const RIGHT_STICK_VERTICAL_BIAS = 0.155;

// Состояние правого стика по ключу устройства: взведён ли шаг.
const rightStickState = new Map();

const handleRightStick = (key, analogStickRight) => {
  if (!analogStickRight) {
    return;
  }
  const horizontal = Number.parseFloat(analogStickRight.horizontal);
  const rawVertical = Number.parseFloat(analogStickRight.vertical);
  if (!Number.isFinite(horizontal) || !Number.isFinite(rawVertical)) {
    return;
  }

  // Центрируем вертикаль: нейтраль стика разбирается библиотекой как
  // ≈ +0.155 (см. комментарий к RIGHT_STICK_VERTICAL_BIAS).
  const vertical = rawVertical - RIGHT_STICK_VERTICAL_BIAS;

  // Направление «нажатия»: +1 — вверх/вправо (увеличение скорости),
  // −1 — вниз/влево (уменьшение), 0 — нейтрально или зона гистерезиса.
  let direction = 0;
  if (
    vertical <= -RIGHT_STICK_VERTICAL_TRIGGER ||
    horizontal >= RIGHT_STICK_HORIZONTAL_TRIGGER
  ) {
    direction = 1;
  } else if (
    vertical >= RIGHT_STICK_VERTICAL_TRIGGER ||
    horizontal <= -RIGHT_STICK_HORIZONTAL_TRIGGER
  ) {
    direction = -1;
  }

  const state = rightStickState.get(key) ?? { armed: true };

  if (direction !== 0) {
    // Стик отклонён за порог: один шаг на первое отклонение.
    if (state.armed) {
      state.armed = false;
      changeSpeed(direction * SPEED_STEP);
    }
  } else if (
    Math.abs(horizontal) < RIGHT_STICK_RELEASE &&
    Math.abs(vertical) < RIGHT_STICK_RELEASE
  ) {
    // Стик возвращён в нейтраль — следующее отклонение сработает.
    state.armed = true;
  }

  rightStickState.set(key, state);
};

// ── Комбинации кнопок для избранного: L+R и ZL+ZR ────────────────────
//
// L Button и ZL физически находятся на ЛЕВОМ Joy-Con, R Button и ZR —
// на ПРАВОМ. Значит «нажать L и R одновременно» — это событие МЕЖДУ
// ДВУМЯ устройствами: внутри пакета одного контроллера обе кнопки пары
// никогда не бывают нажаты (чужая сторона в пакете всегда false).
// Поэтому состояние агрегируется по устройствам: liveButtons хранит
// ПОСЛЕДНИЙ пакет каждого контроллера, а «фронт комбинации» — момент,
// когда ОБЕ кнопки пары стали нажатыми (независимо от того, какая
// из них была нажата первой).Отпустил любую из пары — комбинация
// «снялась», и новое её замыкание снова считается нажатием.
//
// Защита от дребезга — FAVORITE_TOGGLE_MIN_INTERVAL_MS.
const liveButtons = new Map();
const favoriteComboState = { lr: false, zlzr: false };
let lastFavoriteToggleAt = 0;

const handleFavoriteCombo = () => {
  let l = false;
  let r = false;
  let zl = false;
  let zr = false;
  for (const buttons of liveButtons.values()) {
    if (Boolean(buttons.l)) {
      l = true;
    }
    if (Boolean(buttons.r)) {
      r = true;
    }
    if (Boolean(buttons.zl)) {
      zl = true;
    }
    if (Boolean(buttons.zr)) {
      zr = true;
    }
  }

  const lr = l && r;
  const zlzr = zl && zr;

  if ((lr && !favoriteComboState.lr) || (zlzr && !favoriteComboState.zlzr)) {
    const now = performance.now();
    if (now - lastFavoriteToggleAt >= FAVORITE_TOGGLE_MIN_INTERVAL_MS) {
      lastFavoriteToggleAt = now;
      console.debug('Favorites combo (L+R / ZL+ZR) toggled');
      toggleCurrentFavorite();
    }
  }

  favoriteComboState.lr = lr;
  favoriteComboState.zlzr = zlzr;
};

// Основной обработчик кнопок Joy-Con. key — ключ физического устройства,
// по нему отслеживаются предыдущие состояния кнопок.
const handleButtons = (key, buttons) => {
  const prev = previousButtons.get(key) || {};

  // Свежий срез кнопок устройства — для межконтроллерных комбинаций.
  liveButtons.set(key, buttons);

  // B, A, Y, X — Старт/Стоп движения шарика.
  // Реагируем только на момент нажатия (фронт).
  const actionFront = ['b', 'a', 'x', 'y'].some(
    (name) => buttons[name] && !prev[name]
  );

  if (actionFront) {
    const pressed = ['b', 'a', 'x', 'y'].filter(
      (name) => buttons[name] && !prev[name]
    );
    console.debug(`Start/Stop pressed (${pressed.join(', ')}) on`, key);
    tryToggle();
  }

  // Стрелки влево/вправо — изменение скорости движения.
  handleArrowButtons({
    left: buttons.left,
    right: buttons.right,
  });

  // Кнопки «+» / «−» — переключение рисунка вибрации по кругу:
  // «+» (правый Joy-Con) — следующий рисунок,
  // «−» (левый Joy-Con) — предыдущий рисунок.
  // При включённом фильтре — только между избранными.
  // undefined в пакете означает «кнопка этим контроллером не отчитывается»,
  // Boolean(undefined) === false, поэтому чужие пакеты фронт не создают.
  if (Boolean(buttons.plus) && !prev.plus) {
    switchPattern(+1);
  }
  if (Boolean(buttons.minus) && !prev.minus) {
    switchPattern(-1);
  }

  // Стрелки ▲ / ▼ (левый Joy-Con) — изменение силы вибрации:
  // ▲ — увеличение, ▼ — уменьшение, шаг равен шагу ползунка (5%).
  // Новое значение запоминается для текущего рисунка.
  if (Boolean(buttons.up) && !prev.up) {
    changeRumbleStrength(+RUMBLE_STRENGTH_STEP);
  }
  if (Boolean(buttons.down) && !prev.down) {
    changeRumbleStrength(-RUMBLE_STRENGTH_STEP);
  }

  // Нажатие правого стика (rightStick, правый Joy-Con) — включить/
  // выключить рандомный режим. Нажатие обнуляется (undefined) в пакетах
  // левого Joy-Con, поэтому чужие пакеты фронта не создают. Защита от
  // дребезга — минимальный интервал RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS.
  if (Boolean(buttons.rightStick) && !prev.rightStick) {
    const now = performance.now();
    if (now - lastRandomModeToggleAt >= RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS) {
      lastRandomModeToggleAt = now;
      console.debug('Random mode toggled (right stick) on', key);
      toggleRandomMode();
    }
  }

  // Кнопка Capture (левый Joy-Con) — добавить/удалить ТЕКУЩИЙ выбранный
  // рисунок в списке «рандомных» (тот же флажок «Использовать
  // рандомно»). Capture обнуляется в пакетах правого Joy-Con — чужие
  // пакеты фронта не создают. Защита от дребезга — минимальный
  // интервал RANDOM_PATTERN_TOGGLE_MIN_INTERVAL_MS.
  if (Boolean(buttons.capture) && !prev.capture) {
    const now = performance.now();
    if (
      now - lastRandomPatternToggleAt >=
      RANDOM_PATTERN_TOGGLE_MIN_INTERVAL_MS
    ) {
      lastRandomPatternToggleAt = now;
      console.debug('Random pattern toggled (Capture) on', key);
      toggleCurrentRandomPattern();
    }
  }

  previousButtons.set(key, {
    b: Boolean(buttons.b),
    a: Boolean(buttons.a),
    x: Boolean(buttons.x),
    y: Boolean(buttons.y),
    left: buttons.left === undefined ? undefined : Boolean(buttons.left),
    right: buttons.right === undefined ? undefined : Boolean(buttons.right),
    plus: buttons.plus === undefined ? undefined : Boolean(buttons.plus),
    minus: buttons.minus === undefined ? undefined : Boolean(buttons.minus),
    up: buttons.up === undefined ? undefined : Boolean(buttons.up),
    down: buttons.down === undefined ? undefined : Boolean(buttons.down),
    rightStick:
      buttons.rightStick === undefined
        ? undefined
        : Boolean(buttons.rightStick),
    capture:
      buttons.capture === undefined ? undefined : Boolean(buttons.capture),
    l: buttons.l === undefined ? undefined : Boolean(buttons.l),
    r: buttons.r === undefined ? undefined : Boolean(buttons.r),
    zl: buttons.zl === undefined ? undefined : Boolean(buttons.zl),
    zr: buttons.zr === undefined ? undefined : Boolean(buttons.zr),
  });

  // Комбинации L+R / ZL+ZR — после обновления среза кнопок устройства.
  handleFavoriteCombo();
};

// Joy-Cons могут «засыпать» до первого касания, поэтому слушателей
// подключаем динамически каждые 2 секунды.
//
// Важно: слушатель навешивается РОВНО ОДИН РАЗ на физическое устройство
// (по ключу deviceKey), а не на каждый объект JoyCon. Это исключает
// двойную обработку одного нажатия, из-за которой Старт/Стоп выглядит
// неработающим. Обработчик навешивается до enableVibration, а сама
// команда включения вибрации обёрнута в try/catch, чтобы ошибка её
// отправки не мешала обработке кнопок.
setInterval(async () => {
  for (const joyCon of connectedJoyCons.values()) {
    const key = deviceKey(joyCon.device);

    if (attachedKeys.has(key)) {
      continue;
    }

    attachedKeys.add(key);
    joyCon.eventListenerAttached = true;

    joyCon.on('hidinput', (event) => {
      const packet = event.detail;
      if (!packet) {
        return;
      }

      // Питаем пул энтропии ненулевыми показаниями датчиков этого
      // Joy-Con — они дают непредсказуемость для случайного выбора
      // рисунков в рандомном режиме (см. секцию «Случайность из
      // датчиков Joy-Con»).
      feedSensorEntropy(packet);

      if (!packet.buttonStatus) {
        return;
      }
      handleButtons(key, packet.buttonStatus);
      // Правый стик обрабатываем ТОЛЬКО на правом Joy-Con: пакеты
      // левого содержат в этих байтах нули, что разбирается как
      // полное отклонение влево-вниз (см. комментарий у
      // handleRightStick) и без фильтра ложно уменьшало бы скорость.
      if (isSide(joyCon, 'right')) {
        handleRightStick(key, packet.analogStickRight);
      }
    });

    try {
      await joyCon.enableVibration();
    } catch (error) {
      console.error('Не удалось включить вибрацию:', error);
    }
  }

  // Чистим устаревшие срезы кнопок и состояние стика отключившихся
  // контроллеров, чтобы «залипшая» нажатая кнопка исчезнувшего
  // устройства не удерживала комбинацию L+R / ZL+ZR замкнутой
  // бесконечно.
  const connectedKeys = new Set(
    [...connectedJoyCons.values()].map((joyCon) => deviceKey(joyCon.device))
  );
  for (const key of [...liveButtons.keys()]) {
    if (!connectedKeys.has(key)) {
      liveButtons.delete(key);
    }
  }
  for (const key of [...rightStickState.keys()]) {
    if (!connectedKeys.has(key)) {
      rightStickState.delete(key);
    }
  }

  updateStatus();
}, 2000);

// ── Окно справки ──────────────────────────────────────────────────────
//
// Длинные пояснения (рисунки вибрации, избранное, рандомный режим, звук
// щелчка, сохраняемые настройки) вынесены с главного экрана в модальное
// окно: кнопка «Справка» (#help-open) открывает его, а закрывается окно
// крестиком (#help-close), кликом по затемнению вокруг окна или
// клавишей Esc. Окно — часть разметки index.html (скрывается атрибутом
// hidden), поэтому одинаково работает в браузере и в настольной сборке
// (Electron); никаких отдельных страниц и окон ОС не создаётся.
const isHelpOpen = () => Boolean(helpOverlay && !helpOverlay.hidden);

const openHelp = () => {
  helpOverlay?.removeAttribute('hidden');
  // Фокус на кнопку закрытия — окно можно закрыть и с клавиатуры.
  helpCloseButton?.focus();
};

const closeHelp = () => {
  helpOverlay?.setAttribute('hidden', '');
  // Возвращаем фокус кнопке, из которой окно открылось.
  helpButton?.focus();
};

helpButton?.addEventListener('click', openHelp);

helpCloseButton?.addEventListener('click', closeHelp);

// Клик по затемнению (мимо самого окна) тоже закрывает справку.
helpOverlay?.addEventListener('click', (event) => {
  if (event.target === helpOverlay) {
    closeHelp();
  }
});

// ── Окно «Азбука EMDR» ────────────────────────────────────────────────
//
// Информационное окно об авторе программы и его группах с переводами
// материалов по EMDR: кнопка «Азбука EMDR» (#azbuka-open) в ряду
// кнопок справа от «Справка» открывает его. Используются те же стили
// и та же механика, что и у «Справки»: закрывается окно крестиком
// (#azbuka-close), кликом по затемнению вокруг окна или клавишей Esc.
// Окно — часть разметки index.html (скрывается атрибутом hidden),
// поэтому одинаково работает в браузере и в настольной сборке
// (Electron). Ссылки на группы открываются в системном браузере:
// в Electron их перехватывает main.js (setWindowOpenHandler для
// target="_blank" и will-navigate для обычных переходов), в браузере
// срабатывает стандартное поведение новой вкладки.
const isAzbukaOpen = () => Boolean(azbukaOverlay && !azbukaOverlay.hidden);

const openAzbuka = () => {
  azbukaOverlay?.removeAttribute('hidden');
  // Фокус на кнопку закрытия — окно можно закрыть и с клавиатуры.
  azbukaCloseButton?.focus();
};

const closeAzbuka = () => {
  azbukaOverlay?.setAttribute('hidden', '');
  // Возвращаем фокус кнопке, из которой окно открылось.
  azbukaButton?.focus();
};

azbukaButton?.addEventListener('click', openAzbuka);

azbukaCloseButton?.addEventListener('click', closeAzbuka);

// Клик по затемнению (мимо самого окна) тоже закрывает окно.
azbukaOverlay?.addEventListener('click', (event) => {
  if (event.target === azbukaOverlay) {
    closeAzbuka();
  }
});

// ── Окно «Управление с Joy-Con» ───────────────────────────────────────
//
// Список управления с контроллеров (кнопки, стик, комбинации) перенесён
// с главного экрана в модальное окно — используются те же стили и та же
// механика, что и у «Справки»: кнопка «Управление с Joy-Con»
// (#controls-open) открывает окно, закрывается оно крестиком
// (#controls-close), кликом по затемнению вокруг окна или клавишей Esc.
const isControlsOpen = () =>
  Boolean(controlsOverlay && !controlsOverlay.hidden);

const openControls = () => {
  controlsOverlay?.removeAttribute('hidden');
  // Фокус на кнопку закрытия — окно можно закрыть и с клавиатуры.
  controlsCloseButton?.focus();
};

const closeControls = () => {
  controlsOverlay?.setAttribute('hidden', '');
  // Возвращаем фокус кнопке, из которой окно открылось.
  controlsButton?.focus();
};

controlsButton?.addEventListener('click', openControls);

controlsCloseButton?.addEventListener('click', closeControls);

// Клик по затемнению (мимо самого окна) тоже закрывает окно.
controlsOverlay?.addEventListener('click', (event) => {
  if (event.target === controlsOverlay) {
    closeControls();
  }
});

// ── Окно «Настройки»: сохранение и загрузка в JSON-файл ───────────────
//
// Все настройки программы живут в localStorage под ключами с префиксом
// «joyconaz.» (последний выбранный рисунок, сила вибрации для каждого
// рисунка, избранные и «рандомные» рисунки, флажки «Только избранное»
// и «Рандомный режим», звук щелчка). Окно «Настройки»
// (#settings-overlay, кнопка #settings-open слева от «Управление
// с Joy-Con») позволяет переносить их между устройствами и пере-
// установками:
// - «Сохранить настройки» (#settings-save) выгружает ВСЕ известные
//   ключи в JSON-файл. В браузере файл скачивается обычной загрузкой
//   (Blob + a.download); в настольной сборке Electron эта загрузка
//   перехватывается в main.js (событие will-download) и сопровождается
//   СИСТЕМНЫМ диалогом выбора пути сохранения;
// - «Загрузить настройки» (#settings-load) открывает выбор *.json-файла
//   (скрытый input#settings-file-input), проверяет его и применяет.
//
// ФОРМАТ ФАЙЛА (см. collectSettingsExport): объект-обёртка с полями
// app ('joyconaz'), format ('settings'), version (число, от 1),
// savedAt (ISO-дата) и settings — карта «ключ localStorage → СЫРОЕ
// текстовое значение». Сырой текст, а не разобранные значения,
// хранится для того, чтобы загрузка не переинтерпретировала форматы:
// значения возвращаются в localStorage один в один, как были.
//
// ВАЛИДАЦИЯ (validateSettingsFile): обёртка обязана нести корректные
// app/format/version и НЕПУСТУЮ карту settings, состоящую ТОЛЬКО из
// известных ключей; значение каждого ключа проверяется по правилам его
// типа (строка, JSON-объект, JSON-массив строк, JSON-булев — см.
// SETTINGS_KEY_VALIDATORS). Случайный JSON-файл с другими полями
// отсекается уже проверкой app/format; подделка под формат —
// поэтапными проверками типов значений. Файл без единого известного
// ключа тоже отклоняется.
//
// ПЕРЕЗАПИСЬ: если в текущем localStorage есть ХОТЯ БЫ ОДНА настройка
// (hasAnyStoredSettings), перед применением запрашивается подтверждение
// (window.confirm — системный диалог, работает и в браузере, и в
// Electron). При подтверждении все известные ключи сначала УДАЛЯЮТСЯ,
// затем применяются значения из файла — загруженный файл становится
// единственным источником правды, а не «смешивается» с прежними
// настройками. После применения страница ПЕРЕЗАГРУЖАЕТСЯ: восстановление
// настроек выполняется при инициализации модуля, и перезагрузка —
// надёжный способ применить всё (рисунок, силу, избранное, рандомный
// режим, звук) без дублирования логики инициализации.
const SETTINGS_APP_ID = 'joyconaz';
const SETTINGS_FORMAT = 'settings';
const SETTINGS_VERSION = 1;
const SETTINGS_FILE_NAME = 'joyconaz-settings.json';

// Все ключи localStorage, относящиеся к настройкам программы.
const SETTINGS_STORAGE_KEYS = [
  PATTERN_STORAGE_KEY,
  RUMBLE_STRENGTH_STORAGE_KEY,
  FAVORITE_PATTERNS_STORAGE_KEY,
  ONLY_FAVORITES_STORAGE_KEY,
  RANDOM_PATTERNS_STORAGE_KEY,
  RANDOM_MODE_STORAGE_KEY,
  SOUND_STORAGE_KEY,
];

// Сырой текст разбирается как JSON-объект (не массив и не null).
const isJsonObjectString = (raw) => {
  if (typeof raw !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    return (
      Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
};

// Сырой текст разбирается как JSON-массив строк.
const isStringArrayString = (raw) => {
  if (typeof raw !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    return (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    );
  } catch {
    return false;
  }
};

// Сырой текст разбирается как JSON-булев (true/false).
const isBooleanString = (raw) => {
  if (typeof raw !== 'string') {
    return false;
  }
  try {
    return typeof JSON.parse(raw) === 'boolean';
  } catch {
    return false;
  }
};

// Правила валидации сырых значений по ключам localStorage.
const SETTINGS_KEY_VALIDATORS = {
  // Имя рисунка — непустая строка (само имя проверяется списком
  // селектора уже при восстановлении).
  [PATTERN_STORAGE_KEY]: (raw) => typeof raw === 'string' && raw.length > 0,
  // Карта «имя рисунка → сила» — JSON-объект.
  [RUMBLE_STRENGTH_STORAGE_KEY]: isJsonObjectString,
  // Список избранных рисунков — JSON-массив строк.
  [FAVORITE_PATTERNS_STORAGE_KEY]: isStringArrayString,
  // Флажок «Только избранное» — JSON-булев.
  [ONLY_FAVORITES_STORAGE_KEY]: isBooleanString,
  // Список «рандомных» рисунков — JSON-массив строк.
  [RANDOM_PATTERNS_STORAGE_KEY]: isStringArrayString,
  // Флажок «Рандомный режим» — JSON-булев.
  [RANDOM_MODE_STORAGE_KEY]: isBooleanString,
  // Настройки звука — JSON-объект с необязательными полями
  // enabled (булев) и file (строка).
  [SOUND_STORAGE_KEY]: (raw) => {
    if (!isJsonObjectString(raw)) {
      return false;
    }
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed.enabled !== undefined &&
        typeof parsed.enabled !== 'boolean'
      ) {
        return false;
      }
      if (parsed.file !== undefined && typeof parsed.file !== 'string') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },
};

// Собирает объект для экспорта: обёртка с метками формата и картой
// «ключ → сырое значение» из localStorage (ключи без значения
// в хранилище в файл не попадают).
const collectSettingsExport = () => {
  const settings = {};
  for (const key of SETTINGS_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      settings[key] = raw;
    }
  }
  return {
    app: SETTINGS_APP_ID,
    format: SETTINGS_FORMAT,
    version: SETTINGS_VERSION,
    savedAt: new Date().toISOString(),
    settings,
  };
};

// Есть ли в localStorage хотя бы одна непустая настройка программы.
const hasAnyStoredSettings = () =>
  SETTINGS_STORAGE_KEYS.some((key) => {
    const raw = localStorage.getItem(key);
    return raw !== null && raw !== '';
  });

// Проверяет разобранный JSON файла настроек. Возвращает
// { valid: true, settings } для корректного файла (settings — карта
// «ключ → сырое значение») или { valid: false } для любого другого.
const validateSettingsFile = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false };
  }
  if (parsed.app !== SETTINGS_APP_ID || parsed.format !== SETTINGS_FORMAT) {
    return { valid: false };
  }
  if (!Number.isFinite(parsed.version) || parsed.version < 1) {
    return { valid: false };
  }
  const settings = parsed.settings;
  if (
    !settings ||
    typeof settings !== 'object' ||
    Array.isArray(settings)
  ) {
    return { valid: false };
  }
  let knownKeys = 0;
  for (const [key, raw] of Object.entries(settings)) {
    const validator = SETTINGS_KEY_VALIDATORS[key];
    // Неизвестный ключ или значение не прошедшее проверку типа —
    // файл не наш.
    if (!validator || !validator(raw)) {
      return { valid: false };
    }
    knownKeys++;
  }
  // Ни одного известного ключа — пустышка, а не файл настроек.
  if (knownKeys === 0) {
    return { valid: false };
  }
  return { valid: true, settings };
};

// Применяет карту «ключ → сырое значение»: сначала удаляет ВСЕ известные
// ключи (загруженный файл — единственный источник правды, «смешивания»
// со старыми настройками не происходит), затем записывает значения
// из файла как есть, без переинтерпретации форматов.
const applySettingsFrom = (settings) => {
  for (const key of SETTINGS_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  for (const [key, raw] of Object.entries(settings)) {
    localStorage.setItem(key, raw);
  }
};

// Выгружает настройки в файл: Blob + программный клик по ссылке
// с атрибутом download. В браузере начинается обычное скачивание;
// в Electron событие will-download в main.js показывает системный
// диалог выбора пути сохранения.
const saveSettingsToFile = () => {
  try {
    const blob = new Blob(
      [JSON.stringify(collectSettingsExport(), null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = SETTINGS_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Отзываем URL с запасом времени, чтобы загрузка успела начаться.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    console.info('[settings] настройки подготовлены к сохранению в файл');
  } catch (error) {
    console.error('Не удалось подготовить файл настроек:', error);
    window.alert('Не удалось сохранить настройки в файл.');
  }
};

// Читает выбранный файл, валидирует, спрашивает подтверждение
// перезаписи и применяет настройки с перезагрузкой страницы.
const handleSettingsFile = (file) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    let parsed = null;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch {
      parsed = null;
    }

    const check = validateSettingsFile(parsed);
    if (!check.valid) {
      window.alert(
        'Выбранный файл не является файлом настроек этого приложения.'
      );
      return;
    }

    // Текущие настройки не пустые — подтверждение перезаписи.
    if (hasAnyStoredSettings()) {
      const confirmed = window.confirm(
        'Текущие настройки будут заменены настройками из файла. Продолжить?'
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      applySettingsFrom(check.settings);
    } catch (error) {
      console.error('Не удалось применить настройки из файла:', error);
      window.alert('Не удалось применить настройки из файла.');
      return;
    }

    window.alert('Настройки загружены — приложение будет перезагружено.');
    window.location.reload();
  });
  reader.addEventListener('error', () => {
    window.alert('Не удалось прочитать выбранный файл.');
  });
  reader.readAsText(file);
};

const isSettingsOpen = () =>
  Boolean(settingsOverlay && !settingsOverlay.hidden);

const openSettings = () => {
  settingsOverlay?.removeAttribute('hidden');
  // Фокус на кнопку закрытия — окно можно закрыть и с клавиатуры.
  settingsCloseButton?.focus();
};

const closeSettings = () => {
  settingsOverlay?.setAttribute('hidden', '');
  // Возвращаем фокус кнопке, из которой окно открылось.
  settingsButton?.focus();
};

settingsButton?.addEventListener('click', openSettings);

settingsCloseButton?.addEventListener('click', closeSettings);

// Клик по затемнению (мимо самого окна) тоже закрывает окно.
settingsOverlay?.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) {
    closeSettings();
  }
});

// «Сохранить настройки» — выгрузка в JSON-файл.
settingsSaveButton?.addEventListener('click', saveSettingsToFile);

// «Загрузить настройки» — системный диалог выбора *.json-файла.
// value сбрасывается ДО клика, чтобы повторный выбор того же файла
// тоже породил событие change.
settingsLoadButton?.addEventListener('click', () => {
  if (!settingsFileInput) {
    return;
  }
  settingsFileInput.value = '';
  settingsFileInput.click();
});

settingsFileInput?.addEventListener('change', () => {
  const file = settingsFileInput.files?.[0];
  if (file) {
    handleSettingsFile(file);
  }
});

// ── Управление с клавиатуры ──────────────────────────────────────────
//
// Основные команды продублированы обычной компьютерной клавиатурой —
// удобно, когда Joy-Con не под рукой или быстрее нажать клавишу:
// - ПРОБЕЛ — Старт / Стоп движения шарика (та же команда, что кнопка
//   «Старт» на странице и кнопки A/B/X/Y на Joy-Con);
// - стрелки ↑ / → — увеличить скорость, ↓ / ← — уменьшить. Поведение
//   то же, что у стрелок ◄ / ► на левом Joy-Con: одно нажатие — один
//   шаг SPEED_STEP (0.10), удержание меняет скорость плавно за счёт
//   системного автоповтора клавиш (шаги дополнительно ограничены
//   минимальным интервалом, как и на Joy-Con);
// - 1 / 2 / 3 (верхний цифровой ряд и цифровой блок) — быстро
//   выставить скорость 0.8 / 1.0 / 1.2;
// - Enter — включить / выключить случайный режим (то же, что флажок
//   «Случайный режим» и нажатие правого стика на правом Joy-Con);
// - S — включить / выключить звук щелчка (то же, что флажок «Включить»
//   в ряду звука щелчка).
//
// Клавиши распознаются по event.code — по ФИЗИЧЕСКОЙ клавише, поэтому
// всё работает и на русской раскладке. Комбинации с Alt / Ctrl / Cmd
// не перехватываются (они принадлежат браузеру и системе). Для
// пробела, стрелок и Enter подавляется действие по умолчанию —
// прокрутка страницы и нажатие сфокусированной кнопки/флажка, — чтобы
// каждая клавиша всегда означала ровно одну команду приложения.
// Автоповтор (event.repeat) для переключающих команд игнорируется:
// удержание пробела или Enter не должно «мигать» состоянием.
const KEYBOARD_SPEED_PRESETS = {
  Digit1: 0.8,
  Numpad1: 0.8,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 1.2,
  Numpad3: 1.2,
};

// Минимальный интервал между шагами скорости с клавиатуры — тот же,
// что у одиночных нажатий стрелок на Joy-Con: быстрые повторы
// автоповтора клавиатуры не разгоняют скорость рывками.
const KEYBOARD_SPEED_STEP_MIN_INTERVAL_MS = ARROW_MIN_STEP_INTERVAL_MS;
let lastKeyboardSpeedStepAt = 0;

// Короткая голубая вспышка флажка «Включить» звука: переключение
// клавишей S видно глазами даже не глядя на флажок.
const flashSoundToggle = () => {
  soundEnabledToggle?.animate(
    [
      { boxShadow: '0 0 0px rgba(127, 193, 255, 0)' },
      { boxShadow: '0 0 14px rgba(127, 193, 255, 0.85)' },
      { boxShadow: '0 0 0px rgba(127, 193, 255, 0)' },
    ],
    { duration: 300, easing: 'ease-out' }
  );
};

// Выставляет скорость ползунка в конкретное значение (клавиши 1/2/3).
// Значение округляется до сотых и ограничивается диапазоном ползунка;
// программная установка .value не порождает событие input.
const setSpeed = (value) => {
  const next = clamp(Math.round(value * 100) / 100, SPEED_MIN, SPEED_MAX);
  speedSlider.value = String(next);
  updateSpeedValue();
};

// Один шаг скорости с клавиатуры с защитой по интервалу (аналог
// одиночных нажатий стрелок на Joy-Con).
const keyboardSpeedStep = (delta) => {
  const now = performance.now();
  if (now - lastKeyboardSpeedStepAt < KEYBOARD_SPEED_STEP_MIN_INTERVAL_MS) {
    return;
  }
  lastKeyboardSpeedStepAt = now;
  changeSpeed(delta);
};

// Переключение звука щелчка клавишей S: тот же эффект, что клик по
// флажку «Включить», — состояние сохраняется, а при включении во
// время остановленного движения звучит проверочный щелчок по центру
// (playEdgeSound сам учитывает новое состояние флажка: при выключении
// звука проверочный щелчок не играется).
const toggleSoundEnabled = () => {
  if (!soundEnabledToggle) {
    return;
  }
  soundEnabledToggle.checked = !soundEnabledToggle.checked;
  flashSoundToggle();
  saveSoundSettings();
  if (!running) {
    playEdgeSound(PAN_CENTER);
  }
};

document.addEventListener('keydown', (event) => {
  // Комбинации с Alt / Ctrl / Cmd не перехватываем — они принадлежат
  // браузеру и операционной системе.
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const code = event.code;

  // ПРОБЕЛ — Старт / Стоп движения шарика. Автоповтор игнорируется:
  // удержание не должно «мигать» движением туда-обратно.
  if (code === 'Space') {
    event.preventDefault();
    if (!event.repeat) {
      tryToggle();
    }
    return;
  }

  // Стрелки — скорость: ↑ / → быстрее, ↓ / ← медленнее (шаг и интервал
  // те же, что у стрелок на левом Joy-Con; удержание работает за счёт
  // автоповтора клавиатуры).
  if (
    code === 'ArrowUp' ||
    code === 'ArrowRight' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft'
  ) {
    event.preventDefault();
    keyboardSpeedStep(
      code === 'ArrowUp' || code === 'ArrowRight' ? SPEED_STEP : -SPEED_STEP
    );
    return;
  }

  // Enter — включить / выключить случайный режим.
  if (code === 'Enter' || code === 'NumpadEnter') {
    event.preventDefault();
    if (!event.repeat) {
      toggleRandomMode();
    }
    return;
  }

  // 1 / 2 / 3 — пресеты скорости (верхний ряд и цифровой блок).
  if (Object.prototype.hasOwnProperty.call(KEYBOARD_SPEED_PRESETS, code)) {
    event.preventDefault();
    if (!event.repeat) {
      setSpeed(KEYBOARD_SPEED_PRESETS[code]);
    }
    return;
  }

  // S — включить / выключить звук щелчка (на любой раскладке).
  if (code === 'KeyS') {
    event.preventDefault();
    if (!event.repeat) {
      toggleSoundEnabled();
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (isHelpOpen()) {
      closeHelp();
    }
    if (isControlsOpen()) {
      closeControls();
    }
    if (isSettingsOpen()) {
      closeSettings();
    }
    if (isAzbukaOpen()) {
      closeAzbuka();
    }
  }
});

updateStatus();
updateBall();