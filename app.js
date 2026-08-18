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
const testPatternButton = document.querySelector('#test-pattern');
const soundEnabledToggle = document.querySelector('#sound-enabled');
const soundFileSelect = document.querySelector('#sound-file');
const statusLeft = document.querySelector('#status-left');
const statusRight = document.querySelector('#status-right');
const ball = document.querySelector('#ball');

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
// глобальный ползунок силы (мастер-коэффициент).
const rumbleJoyConStep = (joyCon, step, masterAmplitude) =>
  joyCon.rumble(
    step.low ?? LOW_FREQUENCY,
    step.high ?? HIGH_FREQUENCY,
    Math.min(1, step.amplitude * masterAmplitude)
  );

// Проигрывает выбранный в интерфейсе рисунок вибрации на всех Joy-Con
// выбранной стороны. Вызывается без ожидания (void ...) из анимации:
// последующие кадры рендера не ждут завершения рисунка.
const rumbleSidePattern = async (side) => {
  const session = ++vibrationSessions[side];
  const masterAmplitude = Number(rumbleSlider.value);
  const patternName = patternSelect?.value ?? 'pulse';
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
const SPEED_STEP = 0.05; // шаг изменения скорости за одно нажатие
const SPEED_REPEAT_DELAY_MS = 400; // задержка перед автоповтором при удержании
const ARROW_REPEAT_INTERVAL_MS = 250; // интервал автоповтора при удержании
// Минимальный интервал между двумя шагами по одной и той же стрелке.
// Защищает от «дребезга» кнопки и от слишком быстрых повторных нажатий:
// одиночное нажатие всегда даёт ровно один шаг 0.05.
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
// localStorage браузера — переживает перезагрузку страницы и браузера.
//
// Поведение при переключении рисунка (селектором или кнопками «+»/«−»):
// - если для нового рисунка сила ранее настраивалась — она подставляется;
// - если не настраивалась — ползунок сбрасывается на 50%.
//
// Сохраняются только РУЧНЫЕ изменения: ползунок (событие input, которое
// не генерируется при программной установке .value) и стрелки ▲ / ▼
// (changeRumbleStrength). Подстановка сохранённого значения при
// переключении рисунка ничего не перезаписывает, пока пользователь
// сам не изменит силу.
const RUMBLE_STRENGTH_STORAGE_KEY = 'joyconaz.rumbleStrength';
const DEFAULT_RUMBLE_STRENGTH = 0.5;

// Читает карту «имя рисунка → сила». Любая ошибка (localStorage
// недоступен, например file:// в некоторых браузерах, или данные
// повреждены) безопасно откатывается к пустой карте.
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

speedSlider.addEventListener('input', updateSpeedValue);

// Изменение силы ползунком: обновляем индикатор и запоминаем силу
// для текущего рисунка. Программная установка значения (из
// applyPatternStrength) сюда не попадает — событие input только
// пользовательское.
rumbleSlider.addEventListener('input', () => {
  updateRumbleValue();
  rememberPatternStrength(currentPatternName(), rumbleSlider.value);
});

// Ручной выбор рисунка в селекторе: подставляем сохранённую для него
// силу или сбрасываем на 50%. Программная установка patternSelect.value
// (switchPattern) событие change не порождает — двойной работы нет.
patternSelect?.addEventListener('change', () => {
  applyPatternStrength(currentPatternName());
});

updateSpeedValue();
updateRumbleValue();
// При загрузке страницы подставляем силу, сохранённую для стартового
// рисунка (если её не настраивали — остаётся 50% из HTML).
applyPatternStrength(currentPatternName());

// ── Звук щелчка пальцев у края ────────────────────────────────────────
//
// Дополнение к вибрации: в момент касания шариком края можно включить
// короткий (300 мс) звук щелчка пальцев из подпапки sound/.
// Звук включается/выключается флажком, конкретный файл выбирается
// в выпадающем списке. Оба состояния хранятся в localStorage браузера
// и восстанавливаются при следующем открытии страницы.
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
// «sound/…» в new Audio() разрешается относительно адреса СТРАНИЦЫ,
// и при любом расхождении адреса страницы и расположения скрипта
// (переезд, вложенный каталог, отсутствие завершающего слэша) путь
// уводил не туда. Теперь URL строится от расположения app.js — файлы
// ищутся строго рядом со скриптом: https://…/joyconaz/sound/<файл>.
// URL абсолютный и печатается в консоль — его сразу видно на вкладке
// Network и в любом сообщении об ошибке.
const SOUND_STORAGE_KEY = 'joyconaz.sound';
const SOUND_FILES = [
  'chasqueo-100233.mp3',
  'finger-snap-101756.mp3',
  'finger-snap-43482.mp3',
];
const DEFAULT_SOUND_FILE = SOUND_FILES[0];

// Половина эталонной длительности файла (300 мс / 2 = 150 мс).
// Используется как «точка щелчка», пока не загрузились метаданные
// реального файла (audio.duration = NaN сразу после создания элемента).
const SOUND_FALLBACK_MIDPOINT_S = 0.15;

// Считает абсолютный URL файла звука от расположения этого скрипта.
const soundUrl = (file) => new URL(`sound/${file}`, import.meta.url).href;

// Аудио-элементы создаются заранее с preload='auto' — к первому
// касанию края файл уже запрошен по сети и готов к мгновенному
// воспроизведению. Один элемент на файл: быстрое повторное касание
// просто перезапускает звук с начала.
//
// Помимо элемента и URL запись хранит ТОЧКУ ЩЕЛЧКА — середину
// длительности файла (для эталонных 300 мс это 0.15 с). Точка
// обновляется по событию loadedmetadata: перекладываться на реальную
// длительность важнее фиксированной константы, потому что начальная
// пауза у файлов РАЗНАЯ, а половина длительности — единственная
// устойчивая «середина», общая для всех вариантов.
const soundElements = new Map(
  SOUND_FILES.map((file) => {
    const url = soundUrl(file);
    console.info(`[sound] подготовка ${url}`);
    const audio = new Audio(url);
    audio.preload = 'auto';

    // Диагностика загрузки: любая ошибка (404, не тот регистр букв
    // в имени файла — GitHub Pages различает регистр!) попадает
    // в консоль с точным URL, и сразу видно, что чинить.
    audio.addEventListener('error', () => {
      console.warn(`[sound] НЕ УДАЛОСЬ ЗАГРУЗИТЬ ${url} (см. Network, F12)`);
    });

    // Промис «тихой» разблокировки звука. До разблокирования он уже
    // решён (ожидание ничего не ждёт). Во время разблокирования
    // настоящие запуски playSoundFromStart ждут его завершения — это
    // устраняет гонку, при которой отложенный pause() разблокировки
    // мог заглушить только что начатый настоящий звук.
    audio._unlockPromise = Promise.resolve();

    const entry = { audio, url, midpoint: SOUND_FALLBACK_MIDPOINT_S };

    // Реальная точка щелчка — половина фактической длительности.
    // Защита от NaN/Infinity (некоторые mp3 в Chrome до полного
    // декодирования сообщают некорректную длительность): в этом случае
    // остаётся эталонная константа.
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        entry.midpoint = duration / 2;
        console.info(
          `[sound] ${file}: длительность ${duration.toFixed(3)} с, ` +
            `точка щелчка ${entry.midpoint.toFixed(3)} с`
        );
      }
    });

    return [file, entry];
  })
);

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

// Восстановление сохранённого состояния при загрузке страницы.
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

// ── Разблокировка автовоспроизведения ────────────────────────────────
//
// Chromium разрешает звуковой play() только после «пользовательской
// активности» — клика, касания или нажатия клавиши. События WebHID
// (кнопки Joy-Con) такой активностью НЕ считаются. Поэтому при первом
// же жесте «прогреваем» все аудио-элементы: беззвучно играем и сразу
// останавливаем; после этого звук может звучать в любой момент.
//
// Слушатели остаются навсегда, но тело выполняется один раз
// (флаг audioUnlocked) — жест до загрузки модуля не «теряется»;
// пауза и сброс позиции происходят строго ДО настоящего
// воспроизведения: playSoundFromStart ждёт _unlockPromise.
let audioUnlocked = false;

const unlockAudio = () => {
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;

  for (const { audio, url } of soundElements.values()) {
    if (!audio.paused) {
      continue;
    }
    audio.volume = 0;
    audio._unlockPromise = audio
      .play()
      .then(() => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Позиция сбросится при следующем запуске.
        }
      })
      .catch(() => {
        console.warn(`[sound] разблокировка не удалась для ${url}`);
      })
      .finally(() => {
        // Разблокировка завершена: последующие ожидания моментальны.
        audio._unlockPromise = Promise.resolve();
      });
  }
};

for (const eventType of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
  document.addEventListener(eventType, unlockAudio, { passive: true });
}

// Проигрывает файл с самого начала. Сначала дожидается завершения
// процедуры разблокировки (pause + сброс позиции), чтобы её задержавшийся
// pause() не заглушил этот запуск, затем восстанавливает громкость,
// отматывает в начало и запускает. Все отказы протоколируются в консоль:
// NotAllowedError — на странице ещё не было клика/клавиши.
const playSoundFromStart = async ({ audio, url }) => {
  try {
    await audio._unlockPromise;
  } catch {
    // Промис разблокировки изнутри никогда не отклоняется —
    // на всякий случай просто продолжаем.
  }
  audio.volume = 1;
  try {
    audio.currentTime = 0;
  } catch {
    // Файл ещё догружается — играем с той позиции, что есть.
  }
  try {
    await audio.play();
    console.info(`[sound] воспроизведение ${url}`);
  } catch (error) {
    const reason = error?.name ?? 'unknown';
    console.warn(
      `[sound] play() отклонён (${reason}) для ${url} — ` +
        'если NotAllowedError, кликните один раз в любом месте страницы'
    );
  }
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
  return soundElements.get(file) ?? soundElements.get(DEFAULT_SOUND_FILE);
};

// Проигрывает выбранный щелчок с начала файла. Вызывается:
// - досрочно с подлёта к краю (maybePreplayEdgeSound) — основной
//   сценарий: середина файла попадает ровно на касание;
// - вручную: включение флажка, смена файла, «Проверить вибрацию» —
//   проверочные запуски от пользовательского жеста, играют файл
//   просто с начала (включая его начальную паузу).
// Если флажок выключен — ничего не делает.
const playEdgeSound = () => {
  if (!soundEnabledToggle?.checked) {
    return;
  }
  const entry = currentSoundEntry();
  if (!entry) {
    return;
  }
  flashSoundSelect();
  void playSoundFromStart(entry);
};

// Немедленно останавливает звучащий щелчок — вызывается из «Стоп»:
// досрочный запуск мог уже начаться на подлёте (за ~150 мс до края),
// и хвост файла не должен звучать после остановки движения. Пауза не
// сбрасывает позицию: любой следующий запуск всё равно отматывает
// файл в начало.
const stopEdgeSound = () => {
  for (const { audio } of soundElements.values()) {
    if (!audio.paused) {
      audio.pause();
    }
  }
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
  const lead = currentSoundEntry()?.midpoint ?? SOUND_FALLBACK_MIDPOINT_S;
  const distance = direction > 0 ? 1 - position : position;
  const timeToEdge = distance / fractionPerSecond;
  if (timeToEdge > lead) {
    return;
  }
  edgeSoundArmed = false;
  playEdgeSound();
};

// Включение флажка — сразу проигрываем выбранный щелчок: событие change
// является пользовательским жестом, поэтому воспроизведение гарантированно
// разрешено. Это и приятно, и мгновенная проверка работоспособности звука.
soundEnabledToggle?.addEventListener('change', () => {
  saveSoundSettings();
  playEdgeSound();
});

// Смена файла в списке — мгновенное прослушивание нового щелчка
// (тоже пользовательский жест). Играет только при включённом флажке.
soundFileSelect?.addEventListener('change', () => {
  saveSoundSettings();
  playEdgeSound();
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

  // Досрочный запуск звука щелчка: проверяем ДО фиксации касания, чтобы
  // при проскоке порога (большой dt) сработал и фолбэк-запуск в кадр
  // касания — см. комментарии у maybePreplayEdgeSound.
  maybePreplayEdgeSound(fractionPerSecond);

  if (position >= 1) {
    // Крайнее правое положение: рисунок вибрации на правом Joy-Con.
    // Звук уже запущен заранее (если флажок включён) — остаётся взвести
    // флаг досрочного запуска для следующего прохода к левому краю.
    position = 1;
    direction = -1;
    edgeSoundArmed = true;
    void rumbleSidePattern('right');
  } else if (position <= 0) {
    // Крайнее левое положение: рисунок вибрации на левом Joy-Con.
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

// Кнопка проверки: проигрывает текущий рисунок сразу на обеих сторонах
// и, если звук включён, выбранный щелчок — с начала файла (это
// проверочный запуск по пользовательскому клику; выравнивание по
// касанию края здесь не применяется). Клик является пользовательским
// жестом, поэтому звук слышен сразу и без ограничений автовоспроизведения.
testPatternButton?.addEventListener('click', () => {
  void rumbleSidePattern('left');
  void rumbleSidePattern('right');
  playEdgeSound();
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Меняет скорость на заданный шаг с ограничением диапазона ползунка
// (в единицах новой перекалиброванной шкалы).
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
// delta = −1 — предыдущий; после последнего рисунка идёт первый,
// перед первым — последний (циклический обход без «тупиков» на краях).
// Сразу подставляем силу, сохранённую для нового рисунка (или 50%).
const switchPattern = (delta) => {
  if (PATTERN_VALUES.length === 0) {
    return;
  }
  const now = performance.now();
  if (now - lastPatternSwitchAt < PATTERN_SWITCH_MIN_INTERVAL_MS) {
    return;
  }
  lastPatternSwitchAt = now;

  const index = PATTERN_VALUES.indexOf(patternSelect.value);
  const current = index === -1 ? 0 : index;
  const next =
    (current + delta + PATTERN_VALUES.length) % PATTERN_VALUES.length;
  patternSelect.value = PATTERN_VALUES[next];
  applyPatternStrength(PATTERN_VALUES[next]);
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
// - одиночное нажатие меняет скорость ровно на один шаг (0.05);
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

// Основной обработчик кнопок Joy-Con. key — ключ физического устройства,
// по нему отслеживаются предыдущие состояния кнопок.
const handleButtons = (key, buttons) => {
  const prev = previousButtons.get(key) || {};

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
  });
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
      if (!packet || !packet.buttonStatus) {
        return;
      }
      handleButtons(key, packet.buttonStatus);
    });

    try {
      await joyCon.enableVibration();
    } catch (error) {
      console.error('Не удалось включить вибрацию:', error);
    }
  }

  updateStatus();
}, 2000);

updateStatus();
updateBall();