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

// ── Environment: Electron desktop build or browser ────────────────
//
// The same code runs in two environments:
// - desktop Electron application for macOS and Windows (main.js,
//   package.json, DESKTOP.md);
// - regular web page in a browser (web version).
// Electron adds the substring "Electron" to the User-Agent — this is how we
// distinguish environments. The difference affects two things:
// - SOUND: in Electron, the autoplay policy is set in main.js
//   (autoplayPolicy: 'no-user-gesture-required'), so the finger snap
//   sounds immediately on the first edge touch, without a prior click on the
//   window — the browser audio context resume() below is not needed;
// - SETTINGS STORAGE: localStorage in Electron resides in the app's profile
//   (userData) and survives app restarts and updates; in the browser — it's
//   regular page storage.
const IS_ELECTRON = navigator.userAgent.includes('Electron');
if (IS_ELECTRON) {
  console.info(
    '[env] Electron desktop build — sound is allowed without user gesture'
  );
}

// --- Joy-Con Vibration ---
const LOW_FREQUENCY = 160; // Hz
const HIGH_FREQUENCY = 320; // Hz

// Vibration patterns: a sequence of steps.
// A step with the 'duration' field — turns on vibration for the specified time,
// a step with the 'pause' field — silence of the specified duration.
//
// Important constraints when designing patterns:
// - segments shorter than ~40–60 ms WebHID/Bluetooth and internal
//   Joy-Con smoothing can "eat up", so step durations are
//   at least 55 ms, pauses at least 45 ms;
// - a full pattern by default fits within ~500 ms to ensure it finishes
//   playing before the next edge touch even at maximum
//   speed (border crossing at 2.0 × calibration ≈ 330 ms);
// - low frequency 80–220 Hz is felt as a "deep" low buzz,
//   160–400 Hz — as a sharper one; the combination of low/high "draws"
//   the pitch of the tactile sensation;
// - the 'cutoff' field on a step (used in Apple Watch style "click" patterns)
//   forces the player to send a 0 amplitude right after the pulse — this
//   dampens the actuator as quickly as possible, removing the tail
//   and resonance, making the click crisp and "dry".
const RUMBLE_PATTERNS = {
  // ── Simple ──────────────────────────────────────────────────────────
  // A single 220 ms pulse — the application's original behavior (default).
  pulse: [{ duration: 220, amplitude: 1, low: 160, high: 320 }],
  // A single distinct short "tap" pulse.
  tap: [{ duration: 120, amplitude: 1, low: 160, high: 320 }],
  // A short sharp click / prick of high pitch.
  staccato: [{ duration: 55, amplitude: 1, low: 220, high: 440 }],

  // ── Rhythmic (multiple beats) ───────────────────────────────────
  // Two short pulses in a row.
  doubleTap: [
    { duration: 70, amplitude: 0.9, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.9, low: 160, high: 320 },
  ],
  // Three steady short beats: an accented edge marker.
  tripleTap: [
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
  ],
  // Short vibration with a "release" — heartbeat rhythm.
  heartbeat: [
    { duration: 65, amplitude: 0.8, low: 140, high: 280 },
    { pause: 55 },
    { duration: 120, amplitude: 0.55, low: 120, high: 240 },
  ],
  // Morse rhythm "R": dot-dash-dot — an easily memorable pattern, clearly
  // distinguishable from heartbeat and taps.
  morse: [
    { duration: 55, amplitude: 0.85, low: 160, high: 320 },
    { pause: 55 },
    { duration: 55, amplitude: 0.85, low: 160, high: 320 },
    { pause: 55 },
    { duration: 160, amplitude: 0.85, low: 140, high: 280 },
  ],
  // "Tick-tock": two beats of equal strength, but different pitch
  // (low "tick", high "tock"). The difference in tone helps to feel
  // which edge the ball touched, even with closed eyes.
  tickTock: [
    { duration: 70, amplitude: 0.75, low: 100, high: 200 },
    { pause: 70 },
    { duration: 70, amplitude: 0.75, low: 180, high: 360 },
  ],
  // "Gallop" rhythm: a double quick step with an accent on the second beat.
  gallop: [
    { duration: 60, amplitude: 0.8, low: 150, high: 300 },
    { pause: 45 },
    { duration: 90, amplitude: 1, low: 170, high: 340 },
  ],
  // Strong heartbeat: two powerful beats with an extended pause.
  heartbeatStrong: [
    { duration: 100, amplitude: 1, low: 160, high: 320 },
    { pause: 150 },
    { duration: 100, amplitude: 1, low: 160, high: 320 },
  ],
  // Steady metronome: tick-tick-tick with a constant interval.
  metronome: [
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { pause: 60 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { pause: 60 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
  ],

  // ── Dynamic (changing strength and/or tone within the pattern) ──────────
  // Soft "pulse": symmetric wave — rise and fall.
  softWave: [
    { duration: 55, amplitude: 0.25, low: 110, high: 220 },
    { duration: 55, amplitude: 0.5, low: 130, high: 260 },
    { duration: 55, amplitude: 0.75, low: 150, high: 300 },
    { duration: 55, amplitude: 0.45, low: 130, high: 260 },
    { duration: 55, amplitude: 0.2, low: 110, high: 220 },
  ],
  // Rise ("crescendo"): strength gradually increases to a peak and sharply
  // cuts off — contrast to the symmetric softWave: all dynamics are upwards.
  crescendo: [
    { duration: 60, amplitude: 0.15, low: 110, high: 220 },
    { duration: 60, amplitude: 0.3, low: 125, high: 250 },
    { duration: 60, amplitude: 0.45, low: 140, high: 280 },
    { duration: 60, amplitude: 0.6, low: 150, high: 300 },
    { duration: 60, amplitude: 0.8, low: 160, high: 320 },
    { duration: 70, amplitude: 1, low: 170, high: 340 },
  ],
  // Cascade: tone and strength descend from top to bottom, like water flowing
  // down steps — everything shrinks and fades.
  cascade: [
    { duration: 60, amplitude: 0.8, low: 200, high: 400 },
    { duration: 60, amplitude: 0.7, low: 170, high: 340 },
    { duration: 60, amplitude: 0.6, low: 140, high: 280 },
    { duration: 60, amplitude: 0.5, low: 110, high: 220 },
    { duration: 60, amplitude: 0.4, low: 90, high: 180 },
    { duration: 60, amplitude: 0.3, low: 80, high: 160 },
  ],
  // Echo: one strong beat and two fading responses of the same shape.
  echo: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.5, low: 140, high: 280 },
    { pause: 60 },
    { duration: 55, amplitude: 0.25, low: 120, high: 240 },
  ],
  // Zigzag: alternating strong (high pitch) and quiet (low pitch)
  // beats — a "jagged", energy-intensive pattern.
  zigzag: [
    { duration: 60, amplitude: 0.9, low: 180, high: 360 },
    { duration: 60, amplitude: 0.4, low: 130, high: 260 },
    { duration: 60, amplitude: 0.9, low: 180, high: 360 },
    { duration: 60, amplitude: 0.4, low: 130, high: 260 },
    { duration: 70, amplitude: 0.9, low: 180, high: 360 },
  ],
  // Surf: the softest and longest wave with two crests — a large
  // swell, a short receding wave, and a catching up second wave.
  oceanWave: [
    { duration: 80, amplitude: 0.2, low: 90, high: 180 },
    { duration: 80, amplitude: 0.4, low: 110, high: 220 },
    { duration: 90, amplitude: 0.65, low: 130, high: 260 },
    { duration: 80, amplitude: 0.35, low: 110, high: 220 },
    { pause: 45 },
    { duration: 70, amplitude: 0.3, low: 100, high: 200 },
    { duration: 60, amplitude: 0.2, low: 90, high: 180 },
  ],
  // Bounce: fading ball bounces with shrinking durations and pauses.
  bounce: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 70, amplitude: 0.7, low: 150, high: 300 },
    { pause: 50 },
    { duration: 55, amplitude: 0.45, low: 140, high: 280 },
    { pause: 45 },
    { duration: 55, amplitude: 0.25, low: 130, high: 260 },
  ],
  // Tremolo: frequent rapid trembling of equal strength.
  tremolo: [
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.75, low: 200, high: 400 },
  ],
  // Earthquake: a dull low-frequency rumble with a rapid increase in strength.
  earthquake: [
    { duration: 70, amplitude: 0.3, low: 80, high: 120 },
    { duration: 70, amplitude: 0.6, low: 90, high: 140 },
    { duration: 80, amplitude: 0.9, low: 100, high: 160 },
    { duration: 90, amplitude: 1, low: 110, high: 180 },
  ],
  // Train (pulseTrain): a series of short pulses with rising and falling amplitude.
  pulseTrain: [
    { duration: 55, amplitude: 0.3, low: 160, high: 320 },
    { duration: 55, amplitude: 0.6, low: 160, high: 320 },
    { duration: 55, amplitude: 0.9, low: 160, high: 320 },
    { duration: 55, amplitude: 0.6, low: 160, high: 320 },
    { duration: 55, amplitude: 0.3, low: 160, high: 320 },
  ],
  // Swell: a smooth rise and fall of amplitude.
  swell: [
    { duration: 60, amplitude: 0.2, low: 130, high: 260 },
    { duration: 60, amplitude: 0.4, low: 140, high: 280 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { duration: 60, amplitude: 0.9, low: 160, high: 320 },
    { duration: 60, amplitude: 0.7, low: 150, high: 300 },
    { duration: 60, amplitude: 0.4, low: 140, high: 280 },
    { duration: 60, amplitude: 0.2, low: 130, high: 260 },
  ],
  // Buzz: fast short pulses with a high frequency.
  buzz: [
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
    { pause: 30 },
    { duration: 40, amplitude: 0.6, low: 300, high: 600 },
  ],
  // Siren: alternating low and high frequency.
  siren: [
    { duration: 100, amplitude: 0.8, low: 100, high: 200 },
    { duration: 100, amplitude: 0.8, low: 300, high: 600 },
    { duration: 100, amplitude: 0.8, low: 100, high: 200 },
    { duration: 100, amplitude: 0.8, low: 300, high: 600 },
  ],

  // ── New rhythmic ─────────────────────────────────────────────────
  // Waltz: 3/4 rhythm — a strong first beat and two weak ones.
  // Feels like a smooth dancing sway.
  waltz: [
    { duration: 90, amplitude: 1, low: 160, high: 320 },
    { pause: 60 },
    { duration: 60, amplitude: 0.5, low: 160, high: 320 },
    { pause: 50 },
    { duration: 60, amplitude: 0.5, low: 160, high: 320 },
  ],
  // Samba: a fast Latin American rhythm with syncopation.
  // Short beats with building energy and an accent at the end.
  samba: [
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { pause: 45 },
    { duration: 55, amplitude: 0.9, low: 180, high: 360 },
    { pause: 45 },
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { pause: 45 },
    { duration: 70, amplitude: 1, low: 200, high: 400 },
  ],
  // March: clear military rhythm "one-two, one-two".
  // Heavy low-frequency beats with equal pauses.
  march: [
    { duration: 80, amplitude: 1, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 0.7, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 1, low: 140, high: 280 },
    { pause: 70 },
    { duration: 80, amplitude: 0.7, low: 140, high: 280 },
  ],

  // ── New dynamic ────────────────────────────────────────────────
  // Firework: sharp explosion and fast decay with high-pitch "sparks".
  // Each subsequent pulse is higher in pitch and weaker in strength.
  firework: [
    { duration: 55, amplitude: 1, low: 200, high: 400 },
    { pause: 45 },
    { duration: 55, amplitude: 0.6, low: 250, high: 500 },
    { pause: 45 },
    { duration: 55, amplitude: 0.4, low: 300, high: 600 },
    { pause: 45 },
    { duration: 55, amplitude: 0.2, low: 350, high: 700 },
  ],
  // Raindrops: irregular short pulses of varying strength,
  // imitating random falling drops.
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
  // Thunder: low-frequency rumble building up to a powerful strike.
  // Very low frequencies create a feeling of deep vibration.
  thunder: [
    { duration: 80, amplitude: 0.3, low: 80, high: 120 },
    { duration: 80, amplitude: 0.6, low: 80, high: 130 },
    { duration: 90, amplitude: 1, low: 90, high: 150 },
    { duration: 70, amplitude: 0.7, low: 80, high: 120 },
    { duration: 60, amplitude: 0.4, low: 80, high: 110 },
  ],
  // Wind Gust: smooth build-up, strong gust, and decay.
  // Medium frequencies, symmetric shape like softWave, but with an accent.
  windGust: [
    { duration: 60, amplitude: 0.2, low: 100, high: 200 },
    { duration: 60, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.9, low: 140, high: 280 },
    { duration: 60, amplitude: 0.5, low: 120, high: 240 },
    { duration: 60, amplitude: 0.2, low: 100, high: 200 },
  ],
  // Butterfly: light, barely noticeable touches with pauses.
  // Very low amplitude and high tone — gentle fluttering.
  butterfly: [
    { duration: 55, amplitude: 0.3, low: 200, high: 400 },
    { pause: 55 },
    { duration: 55, amplitude: 0.2, low: 200, high: 400 },
    { pause: 60 },
    { duration: 55, amplitude: 0.3, low: 200, high: 400 },
    { pause: 55 },
    { duration: 55, amplitude: 0.15, low: 200, high: 400 },
  ],
  // Drum Roll: rapid build-up of beat strength without pauses,
  // concluding with a powerful accent.
  drumRoll: [
    { duration: 55, amplitude: 0.5, low: 180, high: 360 },
    { duration: 55, amplitude: 0.6, low: 180, high: 360 },
    { duration: 55, amplitude: 0.7, low: 180, high: 360 },
    { duration: 55, amplitude: 0.8, low: 180, high: 360 },
    { duration: 55, amplitude: 0.9, low: 180, high: 360 },
    { duration: 70, amplitude: 1, low: 200, high: 400 },
  ],
  // Sonar: single ping with two fading echoes.
  // High tone and clear pauses create a radar-like feeling.
  sonar: [
    { duration: 70, amplitude: 0.9, low: 200, high: 400 },
    { pause: 80 },
    { duration: 55, amplitude: 0.4, low: 200, high: 400 },
    { pause: 80 },
    { duration: 55, amplitude: 0.2, low: 200, high: 400 },
  ],
  // Shiver: very fast fine pulses without pauses.
  // High frequency and medium amplitude — sensation of fine shaking.
  shiver: [
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
    { duration: 40, amplitude: 0.5, low: 250, high: 500 },
  ],
  // Purring: soft continuous vibration with light modulation.
  // Low frequency, alternating amplitudes — cozy rumbling.
  purring: [
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
    { duration: 70, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
    { duration: 70, amplitude: 0.5, low: 120, high: 240 },
    { duration: 70, amplitude: 0.4, low: 120, high: 240 },
  ],

  // ── Haptic clicks (Apple Watch style) ──────────────────────────────
  // Short, crisp, "dry" pulses without a hum and tail, like the Taptic
  // Engine. The 'cutoff' field forces the player to send a 0 amplitude right
  // after the pulse — the actuator stops quickly, resonance is minimized.
  // Mid-high frequencies provide a ringing "click" instead of a low hum,
  // and a moderate amplitude makes the sensation pleasant yet noticeable.

  // Click — single crisp click, like a mechanical switch.
  click: [
    { duration: 55, amplitude: 0.7, low: 210, high: 420, cutoff: true },
  ],
  // Soft click — quieter and slightly lower in pitch, delicate.
  softClick: [
    { duration: 55, amplitude: 0.5, low: 180, high: 360, cutoff: true },
  ],
  // Crisp tick — the shortest and highest click.
  crispTick: [
    { duration: 55, amplitude: 0.6, low: 240, high: 480, cutoff: true },
  ],
  // Notification — two short ticks, like a message arriving on an Apple Watch.
  notification: [
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
  ],
  // Success — single "tock" slightly lower in pitch, pleasant and confident.
  success: [
    { duration: 60, amplitude: 0.65, low: 170, high: 340, cutoff: true },
  ],
  // Alert — three short ticks, more noticeable.
  alert: [
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.7, low: 200, high: 400, cutoff: true },
  ],
  // Pop — single light high click.
  pop: [
    { duration: 55, amplitude: 0.55, low: 260, high: 520, cutoff: true },
  ],
  // Double tick — two soft ticks, like a light touch.
  doubleTick: [
    { duration: 55, amplitude: 0.6, low: 220, high: 440, cutoff: true },
    { pause: 55 },
    { duration: 55, amplitude: 0.6, low: 220, high: 440, cutoff: true },
  ],

  // ── Haptic clicks: added from haptics library ───────────────
  // Ported from the "Taptic-style" pattern set: the pulses are ringing and
  // short, on the resonant frequencies of LRA actuators, with active tail
  // cutoff. Pulse durations from the reference (10–24 ms) are stretched
  // to a minimum 55–60 ms: WebHID/Bluetooth and internal Joy-Con
  // smoothing "eat up" shorter segments without changing the feel of the click.

  // Double click: two fast clicks in a row, the second slightly stronger —
  // a classic "selected" / double press response.
  doubleClick: [
    { duration: 55, amplitude: 0.55, low: 200, high: 400, cutoff: true },
    { pause: 45 },
    { duration: 55, amplitude: 0.7, low: 220, high: 440, cutoff: true },
  ],
  // Warning: two solid strikes slightly lower in tone —
  // "attention, something requires checking".
  warning: [
    { duration: 60, amplitude: 0.85, low: 140, high: 260, cutoff: true },
    { pause: 80 },
    { duration: 60, amplitude: 0.85, low: 140, high: 260, cutoff: true },
  ],
  // Error: three short sharp low pulses —
  // a classic UI "failure" signal.
  error: [
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
    { pause: 60 },
    { duration: 55, amplitude: 0.9, low: 130, high: 240, cutoff: true },
  ],
};

// Vibration session counters — one for each side. Incrementing
// the session number cancels the playback of all previously started
// sequences on that side: a new pattern or "Stop" is guaranteed to
// interrupt the old pattern, rather than layering on top of it.
// Counters are separate for sides, so a fast ball pass from left → right
// doesn't cancel a pattern just started on the other side.
const vibrationSessions = { left: 0, right: 0 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends the Joy-Con one step of a pattern: the step's amplitude is multiplied
// by the master multiplier (slider in normal mode, or saved strength for the
// pattern in random mode — see patternMasterAmplitude).
const rumbleJoyConStep = (joyCon, step, masterAmplitude) =>
  joyCon.rumble(
    step.low ?? LOW_FREQUENCY,
    step.high ?? HIGH_FREQUENCY,
    Math.min(1, step.amplitude * masterAmplitude)
  );

// Plays a vibration pattern on all Joy-Cons of the selected side.
// Called without waiting (void ...) from animation: subsequent render
// frames do not wait for the pattern to finish.
//
// Which pattern to play exactly is decided by chooseRumblePattern: in random
// mode it's a TWO-STAGE selection (stage 1 — whether to change the pattern
// at all; if 'yes' stage 2 — a random new pattern from the 'random' list,
// if 'no' — play the current pattern of the random mode again),
// otherwise — the currently selected in the UI.
// STRENGTH also depends on the mode: in normal it's the current slider
// value (master multiplier), and in random mode the slider is IGNORED —
// the playing pattern plays with the strength SAVED SPECIFICALLY FOR IT
// in localStorage (or 50% if it hasn't been adjusted) —
// see patternMasterAmplitude.
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
      // The session is stale — the pattern is canceled (new pattern or Stop).
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

      // cutoff — right after the pulse, dampen the actuator (amplitude 0),
      // so there's no tail and resonance. Used in Apple Watch style
      // "click" patterns.
      if (step.cutoff) {
        await Promise.all(
          joyCons.map((joyCon) =>
            joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0)
          )
        );
      }
    }

    // Guaranteed to turn off vibration at the end of the pattern.
    if (session === vibrationSessions[side]) {
      await Promise.all(
        joyCons.map((joyCon) =>
          joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0)
        )
      );
    }
  } catch (error) {
    console.error('Error playing vibration pattern:', error);
  }
};

const stopVibration = () => {
  vibrationSessions.left++;
  vibrationSessions.right++;
  for (const joyCon of connectedJoyCons.values()) {
    joyCon.rumble(LOW_FREQUENCY, HIGH_FREQUENCY, 0);
  }
};

// Offset of the ball from the track edges (so as not to overlap the color markers).
const EDGE_MARGIN = 30; // px

// Speed control via arrow buttons.
const SPEED_MIN = 0.1;
const SPEED_MAX = 2;
// Step for changing speed per action on Joy-Con: single press of
// ◄ / ► arrows or one tilt of the right stick.
// Intentionally LARGER than the slider's step (0.05, set by the 'step'
// attribute in index.html): from the controller speed changes twice as fast,
// while with the mouse on the slider — still with precise 0.05 steps. A step
// of 0.1 aligns with the slider's grid, so button and stick values always snap to it.
const SPEED_STEP = 0.1;
const SPEED_REPEAT_DELAY_MS = 400; // delay before auto-repeat on hold
const ARROW_REPEAT_INTERVAL_MS = 250; // auto-repeat interval on hold
// Minimum interval between two steps on the same arrow.
// Protects against button "bounce" and too rapid repeated presses:
// a single press always gives exactly one 0.1 step.
const ARROW_MIN_STEP_INTERVAL_MS = 150;

// Speed scale recalibration coefficient.
// The new value of 1.0 subjectively corresponds to the old speed of 1.5,
// meaning actual movement speed = slider value × 1.5.
const SPEED_CALIBRATION = 1.5;

// Protection against false Start/Stop triggers (bounce, duplicate HID events).
const TOGGLE_DEBOUNCE_MS = 200;

// Animation state: ball position 0..1 and direction of movement.
let running = false;
let rafId = null;
let lastTime = null;
let position = 0.5;
let direction = 1;
let lastToggleAt = 0;

// Latest button states by device key (to detect press — the front of
// the signal), rather than by JoyCon object.
// Sometimes multiple wrapper objects are created for the same physical Joy-Con,
// and objects change between reconnections.
const previousButtons = new Map();

// Device keys that already have a hidinput handler attached.
const attachedKeys = new Set();

// Stable key for a physical device.
// The same Joy-Con might appear in connectedJoyCons twice
// (two wrappers over one HID device, e.g., after reconnecting).
// Then the same button packet is processed twice: Start/Stop toggles
// twice per single press (Start and immediately Stop), which looks like
// "buttons aren't working". A key based on immutable device properties
// allows processing each device's events exactly once.
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

// ── Saving vibration strength for each pattern ──────────────────────
//
// The strength slider scales the entire pattern, and a comfortable volume
// differs across patterns ("butterfly" is quiet, "thunder" is loud). Therefore,
// the strength is remembered SEPARATELY FOR EACH pattern and stored in
// localStorage: in the browser — page storage (survives page reloads
// and browser restarts), in the desktop Electron build — the app profile
// (userData), surviving app restarts and updates.
//
// Behavior when switching a pattern (via selector or '+'/'-' buttons):
// - if strength was previously adjusted for the new pattern, it's applied;
// - if it wasn't adjusted, the slider resets to 50%.
//
// Saved strengths are used TWICE:
// - when switching a pattern, they are applied to the slider
//   (applyPatternStrength);
// - in RANDOM mode, each playing pattern plays immediately
//   with ITS OWN saved strength — the slider is ignored during this
//   (see patternMasterAmplitude).
//
// Only MANUAL changes are saved: slider (input event, which is
// not generated on programmatic .value assignment) and ▲ / ▼ arrows
// (changeRumbleStrength). Applying a saved value when switching
// a pattern does not overwrite anything until the user manually
// changes the strength.
const RUMBLE_STRENGTH_STORAGE_KEY = 'joyconaz.rumbleStrength';
const DEFAULT_RUMBLE_STRENGTH = 0.5;

// Reads the "pattern name → strength" map. Any error (storage unavailable
// or corrupted data) safely falls back to an empty map.
const loadPatternStrengths = () => {
  try {
    const raw = localStorage.getItem(RUMBLE_STRENGTH_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to read saved vibration strength:', error);
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
    console.warn('Failed to save vibration strength:', error);
  }
};

// Remembers the strength for the specified pattern. The value is rounded
// to two decimal places (to avoid float artifacts like 0.30000000000000004) and
// clamped to the slider's range; writes with no changes are skipped
// to avoid hitting localStorage unnecessarily on every input.
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

// Applies the strength saved for the specified pattern to the slider,
// or resets it to 50% if the strength for the pattern hasn't been set.
// Programmatic assignment of .value DOES NOT trigger the input event, so
// the application itself doesn't "re-save" anything back.
const applyPatternStrength = (patternName) => {
  const saved = loadPatternStrengths()[patternName];
  const value =
    typeof saved === 'number' && Number.isFinite(saved)
      ? saved
      : DEFAULT_RUMBLE_STRENGTH;
  rumbleSlider.value = String(value);
  updateRumbleValue();
};

// Name of the currently selected pattern (with protection, as in rumbleSidePattern).
const currentPatternName = () => patternSelect?.value ?? 'pulse';

// ── Saving the last selected vibration pattern ─────────────────
//
// The pattern selection itself is also remembered in localStorage: on the next
// application launch, the last used pattern is applied automatically. It is saved
// for any selection method — via the UI selector or '−' / '+' buttons on the Joy-Con
// (switchPattern). Restoration is validated against the selector's list: if the
// saved name is missing for some reason (e.g., the pattern was removed in a new
// version), the HTML default remains.
//
// IMPORTANT STARTUP ORDER: pattern restoration is done BEFORE applyPatternStrength
// on page load — so the strength of the restored pattern is applied, rather than
// the HTML default pattern's strength.
//
// Programmatic assignment of patternSelect.value doesn't trigger the change event,
// so restoration doesn't "re-save" anything back.
const PATTERN_STORAGE_KEY = 'joyconaz.pattern';

const loadPatternSelection = () => {
  try {
    const raw = localStorage.getItem(PATTERN_STORAGE_KEY);
    return typeof raw === 'string' ? raw : null;
  } catch (error) {
    console.warn('Failed to read saved vibration pattern:', error);
    return null;
  }
};

const savePatternSelection = (patternName) => {
  try {
    localStorage.setItem(PATTERN_STORAGE_KEY, patternName);
  } catch (error) {
    console.warn('Failed to save vibration pattern:', error);
  }
};

// Restores the saved pattern if it exists in the selector's list.
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

// ── Favorite vibration patterns ────────────────────────────────────────
//
// The "Favorite pattern" checkbox (#favorite-pattern) reflects/changes
// the inclusion of the CURRENTLY selected pattern in favorites:
// - checked — current pattern is in the favorites list;
// - unchecked — pattern is removed from favorites.
// It synchronizes on every pattern switch (list, '−'/'+' buttons:
// different patterns can have different status) and changes status
// itself on mouse click, and on the "hotkey" combination:
// L+R or ZL+ZR simultaneously (see handleFavoriteCombo below).
//
// The "Favorites only" checkbox (#only-favorites) enables a filter:
// - only favorite patterns are visible in the dropdown list;
// - circular switching with '−' / '+' buttons also only goes through favorites.
// If upon enabling the filter the current pattern is not a favorite —
// the first favorite is selected automatically (with its saved strength);
// if favorites are empty — the filter isn't applied (list remains full),
// so the UI isn't left without options. Favorite items are marked
// with a star ★ in their text.
//
// Storage: list of names — joyconaz.favoritePatterns (JSON array),
// filter checkbox state — joyconaz.onlyFavorites (JSON true/false).
const FAVORITE_PATTERNS_STORAGE_KEY = 'joyconaz.favoritePatterns';
const ONLY_FAVORITES_STORAGE_KEY = 'joyconaz.onlyFavorites';

// Minimum interval between toggling favorites via button combinations:
// bounce protection and handling duplicated HID packets.
const FAVORITE_TOGGLE_MIN_INTERVAL_MS = 250;

// Original item labels (without the star) — captured once on load, so
// rebuildPatternOptions always restores the "clean" text, instead of
// accumulating ★ over time.
const PATTERN_BASE_LABELS = new Map(
  [...(patternSelect?.options ?? [])].map((option) => [
    option.value,
    option.textContent.trim(),
  ])
);

// Reads the list of favorite patterns; localStorage errors safely
// fall back to an empty list.
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
    console.warn('Failed to read favorite patterns:', error);
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
    console.warn('Failed to save favorite patterns:', error);
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
    // localStorage unavailable — we just live without saving state.
  }
};

const isFavorite = (patternName) => loadFavoritePatterns().includes(patternName);

// Short golden flash of the favorite toggle: switching from controllers
// is visually apparent even without looking at the list.
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

// Aligns the "Favorite pattern" checkbox with the CURRENT pattern's status.
// Called on load, on every pattern switch, and after any change to favorites.
const updateFavoriteToggle = () => {
  if (favoritePatternToggle) {
    favoritePatternToggle.checked = isFavorite(currentPatternName());
  }
};

// Adds/removes a pattern from favorites and brings the UI into the current state:
// updates the checkbox, redraws the list (stars, visibility when the filter is on) —
// rebuildPatternOptions will shift the selection to an available pattern if needed.
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

// Toggles the favorite status of the current pattern (for L+R / ZL+ZR button
// combinations and to mirror mouse clicks on the checkbox itself).
const toggleCurrentFavorite = () => {
  const name = currentPatternName();
  setFavorite(name, !isFavorite(name));
};

// Rebuilds the dropdown list display based on the favorites state:
// - adds/removes the ★ star in the labels of favorite items
//   and the 🎲 dice for patterns in the "random" list (see section below);
// - hides non-favorite items if the "Favorites only" filter is enabled
//   and there is at least one pattern in favorites;
// - if due to the filter the currently selected item is hidden,
//   the first visible item (the first favorite in list order) is selected,
//   the selection is saved, and its strength is applied.
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

// List of patterns for circular switching with '−' / '+' buttons:
// when the filter is enabled — only favorites, in the original full list order;
// if the filter is disabled or favorites are empty — all patterns.
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

// Click on the "Favorite pattern" checkbox: add/remove the current pattern.
favoritePatternToggle?.addEventListener('change', () => {
  setFavorite(currentPatternName(), favoritePatternToggle.checked);
});

// Click on the "Favorites only" checkbox: save state and rebuild
// the list (if needed, the selection will move to the first favorite).
onlyFavoritesToggle?.addEventListener('change', () => {
  saveOnlyFavorites(onlyFavoritesToggle.checked);
  rebuildPatternOptions();
});

// ── Random patterns and random mode ──────────────────────────────
//
// The "Use randomly" checkbox (#random-pattern) manages the inclusion
// of the CURRENTLY selected pattern in the "random patterns" list:
// - checked — current pattern is ADDED to the "random" list;
// - unchecked — pattern is REMOVED from the list.
// This list is COMPLETELY INDEPENDENT of favorites: the same pattern can
// be in both favorites and "randoms" simultaneously, just in one, or in neither.
// The checkbox syncs on every pattern switch (like "Favorite pattern"),
// because different patterns have different membership in the list.
// Membership is marked with a 🎲 dice in the dropdown list item label
// (favorites have a ★ star).
//
// The "Random mode" checkbox (#random-mode) ENABLES a mode where
// the vibration pattern for EACH edge touch by the ball is determined
// by a TWO-STAGE random selection:
// - STAGE 1 — "coin flip": whether to change the pattern at all (yes/no).
//   If "no" — the change DOES NOT happen, the CURRENT random mode pattern
//   plays again (randomModePattern);
// - STAGE 2 — executed only if "yes": randomly selecting a NEW pattern
//   from the "random" list. If there are multiple candidates, the current
//   pattern is excluded from the "flip", ensuring "yes" always means
//   an actual CHANGE of pattern.
// The starting "current" pattern is considered to be the one selected
// in the UI (randomModePattern is reset every time the mode checkbox toggles).
// Favorites and the "Favorites only" checkbox are completely ignored:
// in stage 2, the candidates are ALL patterns in the list regardless
// of their favorite status. The STRENGTH of each pattern in this mode is
// the one SAVED SPECIFICALLY FOR IT in localStorage (the same "name → strength" map
// that the slider adjusts); the strength slider itself is ignored during this —
// see patternMasterAmplitude. The dropdown list and '−'/'+' buttons continue
// to work normally — they define the pattern for the normal mode and the pattern
// to which the "Use randomly" checkbox applies. If the "random" list is empty,
// the currently selected pattern plays with the slider's strength — random mode
// without candidates does not alter behavior.
//
// CONTROLLER MANAGEMENT: PRESSING the right stick (rightStick, right
// Joy-Con) toggles random mode on/off; the Capture button (left
// Joy-Con) adds/removes the CURRENTLY selected pattern from the
// "random" list — identical to clicking the corresponding checkbox.
// The library's wrappers zero out (undefined) "foreign" buttons: right stick press
// is zeroed in left Joy-Con packets, Capture — in right ones, so the press
// front is determined correctly via the previousButtons map for each device
// individually. PRESSING the stick is a distinct button, and it DOES NOT
// interfere with tilting the same stick, which adjusts speed: pressing does not
// register a tilt, and tilting does not register a press.
//
// Storage: list of names — joyconaz.randomPatterns (JSON array),
// mode checkbox state — joyconaz.randomMode (JSON true/false).
const RANDOM_PATTERNS_STORAGE_KEY = 'joyconaz.randomPatterns';
const RANDOM_MODE_STORAGE_KEY = 'joyconaz.randomMode';

// The probability of answering "yes" at the first stage of random mode: with this
// probability, a pattern change occurs on an edge touch, otherwise the current plays again.
// 0.5 is a fair "coin"; the value is easy to adjust to make changes more or less frequent.
const RANDOM_CHANGE_PROBABILITY = 0.5;

// The "current" pattern of the random mode — what plays on a "no" answer
// in the first stage and what is excluded from the "flip" in the second.
// null means "not yet defined": on the first edge touch after enabling
// the mode, the current pattern becomes the one selected in the UI.
// Reset every time the mode checkbox is toggled.
let randomModePattern = null;

// Minimum interval between toggling random mode by pressing the right stick
// (right Joy-Con) and toggling the current pattern's membership in the
// "random" list via the Capture button (left Joy-Con): debounce protection
// and handling duplicated HID packets.
const RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS = 250;
let lastRandomModeToggleAt = 0;
const RANDOM_PATTERN_TOGGLE_MIN_INTERVAL_MS = 250;
let lastRandomPatternToggleAt = 0;

// Reads the list of "random" patterns; localStorage errors safely
// fall back to an empty list.
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
    console.warn('Failed to read random patterns:', error);
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
    console.warn('Failed to save random patterns:', error);
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
    // localStorage unavailable — we just live without saving state.
  }
};

const isRandomPattern = (patternName) =>
  loadRandomPatterns().includes(patternName);

// Short purple flash of the "Use randomly" checkbox:
// the toggle is visible to the eyes even without looking at the list.
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

// Aligns the "Use randomly" checkbox with the status of the CURRENT pattern.
// Called on load, on every pattern switch, and after any change to the
// "random" list.
const updateRandomToggle = () => {
  if (randomPatternToggle) {
    randomPatternToggle.checked = isRandomPattern(currentPatternName());
  }
};

// Adds/removes a pattern from the "random" list and brings the UI to
// the current state: updates the checkbox and redraws the list (🎲 markers).
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

// Toggles the CURRENT pattern's membership in the "random" list
// (for the Capture button on the left Joy-Con; mouse clicks on the checkbox
// are handled by its own change listener below).
const toggleCurrentRandomPattern = () => {
  const name = currentPatternName();
  setRandomPattern(name, !isRandomPattern(name));
};

// ── Randomness from Joy-Con sensors ──────────────────────────────────
//
// The source of randomness for the random mode. Readings from the accelerometers
// and gyroscopes of both Joy-Cons are continuously mixed into a 32-bit
// entropy pool: sensors provide live analog noise (micro-movements of the hand,
// ADC jitter), so their values from packet to packet are unpredictable.
// Values EQUAL TO ZERO are skipped — zero carries no information about
// the current sensor state. For pattern selection, the pool is unrolled via
// xorshift32 into a uniform number [0, 1) and additionally mixed with
// Math.random(): even if the sensors are silent or their noise is "stuck",
// the distribution remains uniform.
//
// Entropy accumulates in the hidinput handler (see setInterval below):
// each standard full mode (0x30) packet contains the averaged actualAccelerometer (g)
// and actualGyroscope (dps and rps) readings of the specific controller —
// both Joy-Cons feed a shared pool.
let sensorEntropy = 0;
let sensorEntropySamples = 0;

// Mixes a single sensor value into the pool (zero and non-numeric values
// are skipped). The library's parsing precision is 6 decimal places,
// so the value is scaled into an integer with 6 places and mixed
// by multiplication with a prime constant (multiplicative mixing).
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

// Extracts non-zero accelerometer and gyroscope readings from the
// hidinput packet and feeds them into the entropy pool.
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

// A uniform random number [0, 1): xorshift32 over the entropy pool,
// mixed with Math.random(). If the sensors haven't sent any non-zero
// values yet, pure Math.random() works.
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

// Picks a random element from a list.
const pickRandomFrom = (items) => {
  const index = Math.floor(sensorRandomUnit() * items.length);
  return items[Math.min(Math.max(index, 0), items.length - 1)];
};

// The strength (master multiplier) with which a pattern plays:
// - NORMAL mode (fromRandomMode = false): current value of the strength slider —
//   former behavior, the slider scales the UI-selected pattern entirely;
// - RANDOM mode (fromRandomMode = true): slider is IGNORED,
//   and the sounding pattern plays with the strength SAVED SPECIFICALLY FOR IT
//   in localStorage (the same "name → strength" map that is applied to the
//   slider when switching patterns). If strength for a pattern hasn't been set —
//   it's 50%, just like the first time selecting a pattern in the selector.
//   This way, each pattern sounds at its adjusted volume, regardless of
//   where the slider happens to be during the "flip".
const patternMasterAmplitude = (patternName, fromRandomMode) => {
  if (!fromRandomMode) {
    return Number(rumbleSlider.value);
  }
  const saved = loadPatternStrengths()[patternName];
  return typeof saved === 'number' && Number.isFinite(saved)
    ? saved
    : DEFAULT_RUMBLE_STRENGTH;
};

// Selects the pattern for the next edge touch (the same selection is used
// by "Test Vibration"). NORMAL mode — currently selected pattern in UI.
// RANDOM mode — TWO-STAGE selection:
// - STAGE 1: whether to change the pattern at all (probability "yes" —
//   RANDOM_CHANGE_PROBABILITY);
// - STAGE 2 (only if "yes"): random NEW pattern from the "random" list —
//   favorites and "Favorites only" filter are ignored, if multiple candidates
//   the current is excluded from the "flip";
// - if "no" the current randomModePattern plays again.
// Names that aren't in RUMBLE_PATTERNS (e.g., removed in a new version)
// are filtered out so that "flips" aren't wasted on them.
//
// Returns { name, random }: name — name of selected pattern, random —
// whether it was picked in random mode. Based on this flag rumbleSidePattern
// decides where to pull strength from: slider (normal) or saved value
// (random, see patternMasterAmplitude).
const chooseRumblePattern = () => {
  if (!randomModeToggle?.checked) {
    return { name: currentPatternName(), random: false };
  }

  const candidates = loadRandomPatterns().filter((name) =>
    Object.prototype.hasOwnProperty.call(RUMBLE_PATTERNS, name)
  );
  if (candidates.length === 0) {
    // "Random" list is empty — plays the currently selected pattern
    // normally (with the slider's strength).
    return { name: currentPatternName(), random: false };
  }

  // The "current" random mode pattern is not yet defined (first edge touch
  // after enabling mode) or disappeared from RUMBLE_PATTERNS —
  // the starting value becomes the pattern selected in the UI
  // (with protection: if it's not among patterns, the first candidate is used).
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

  // ── Stage 1: whether to change the pattern at all ─────────────────────────────
  if (sensorRandomUnit() < RANDOM_CHANGE_PROBABILITY) {
    // ── Stage 2: random selection of a NEW pattern from the list ───────────
    // A "yes" implies an actual CHANGE makes sense: if there are multiple candidates,
    // the current pattern is excluded from the "flip", so a "yes" answer
    // cannot leave the same pattern.
    const pool =
      candidates.length > 1
        ? candidates.filter((name) => name !== randomModePattern)
        : candidates;
    randomModePattern = pickRandomFrom(pool);
    console.debug(`[random] pattern change: ${randomModePattern}`);
  } else {
    console.debug(`[random] no pattern change: ${randomModePattern}`);
  }

  return { name: randomModePattern, random: true };
};

// Click on the "Use randomly" checkbox: add/remove the current pattern
// from the "random" list.
randomPatternToggle?.addEventListener('change', () => {
  setRandomPattern(currentPatternName(), randomPatternToggle.checked);
});

// Short purple flash of the "Random mode" checkbox: a toggle (via mouse
// or right stick press) is visually apparent.
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

// Turns random mode on/off with shared effects for both ways of toggling
// (mouse click and pressing the right stick on the right Joy-Con):
// the state is saved locally, the "current" mode pattern is reset
// (a new activation starts with the UI-selected pattern). If enabled with
// an empty "random" list — logs a tip to the console.
const applyRandomMode = (enabled) => {
  saveRandomMode(enabled);
  flashRandomModeToggle();
  randomModePattern = null;
  if (enabled && loadRandomPatterns().length === 0) {
    console.info(
      '[random] random mode enabled, but the random list is empty — ' +
        'playing currently selected pattern; check "Use randomly" for desired ' +
        'patterns or press Capture on the left Joy-Con'
    );
  }
};

// Toggles random mode (for pressing the right stick on the right Joy-Con).
// Programmatic assignment of .checked DOES NOT trigger the change event,
// so we first flip the checkbox, then execute the shared logic.
const toggleRandomMode = () => {
  if (!randomModeToggle) {
    return;
  }
  randomModeToggle.checked = !randomModeToggle.checked;
  applyRandomMode(randomModeToggle.checked);
};

// Click on the "Random mode" checkbox: enable/disable mode —
// shared logic in applyRandomMode.
randomModeToggle?.addEventListener('change', () => {
  applyRandomMode(randomModeToggle.checked);
});

speedSlider.addEventListener('input', updateSpeedValue);

// Adjusting strength via slider: update the display indicator and remember
// strength for the current pattern. Programmatic value assignment (from
// applyPatternStrength) doesn't end up here — only user input triggers this.
// In random mode, the slider DOES NOT affect edge touch vibrations (there,
// each pattern plays with its own saved strength), but it still saves the
// strength for the currently UI-selected pattern — this makes it easy to
// pre-adjust volumes for patterns in the "random" list.
rumbleSlider.addEventListener('input', () => {
  updateRumbleValue();
  rememberPatternStrength(currentPatternName(), rumbleSlider.value);
});

// Manual pattern selection in the selector: remember the choice, apply the
// saved strength for it or reset to 50%, and sync the "Favorite pattern"
// and "Use randomly" checkboxes with the new pattern's status.
// Programmatic assignment of patternSelect.value does not fire the change event —
// no double work.
patternSelect?.addEventListener('change', () => {
  savePatternSelection(currentPatternName());
  applyPatternStrength(currentPatternName());
  updateFavoriteToggle();
  updateRandomToggle();
});

updateSpeedValue();
updateRumbleValue();
// On load, first restore the last selected pattern, then the favorites filter
// state (rebuildPatternOptions will switch the selection to an available pattern
// if necessary), then the random mode state, and finally apply the strength
// specifically for the current pattern.
restorePatternSelection();
if (onlyFavoritesToggle) {
  onlyFavoritesToggle.checked = loadOnlyFavorites();
}
if (randomModeToggle) {
  randomModeToggle.checked = loadRandomMode();
}
rebuildPatternOptions();
applyPatternStrength(currentPatternName());

// ── Finger snap sound (Web Audio + panning) ────────────────
//
// In addition to vibration: at the moment the ball touches an edge, a short
// (300 ms) finger snap sound from the sound/ subfolder can be played.
// The sound is enabled/disabled by a checkbox, and the specific file is
// chosen from a dropdown list. Both states are stored in localStorage
// (in the browser — page storage, in Electron — app profile) and are
// restored on the next open.
//
// PANNING: The snap is panned BY THE EDGE SIDE: ball flies RIGHT —
// snap only plays in the right speaker, LEFT — only in the left. This way,
// sound indicates the touch side just like vibration indicates the Joy-Con side.
// Implemented via Web Audio API: files are decoded into AudioBuffer (mono-content
// doesn't matter — StereoPannerNode mixes/pans any buffers), and on every
// play an AudioBufferSourceNode → StereoPannerNode (pan = -1 all signal left,
// +1 all right, 0 center) → destination is created. Test sounds (checking the
// box while stopped, changing a file, "Test vibration") play IN THE CENTER —
// in both speakers.
//
// ALIGNING WITH TOUCH MOMENT: The files are ~300 ms long, the audible snap is
// roughly IN THE MIDDLE, with the initial pause varying per file. If we play
// the file exactly at the moment of touch, the snap would sound late by the
// initial pause's duration. Thus, the file is played AHEAD of time, during
// approach — when the time left to the edge at the current speed equals HALF
// the file duration. The initial pause plays while approaching, and exactly
// upon touch, playback hits the midpoint — the snap sounds right on impact.
// Mechanics — see maybePreplayEdgeSound next to the animation tick.
//
// WHY THE ADDRESS IS CALCULATED FROM import.meta.url: a relative path "sound/..."
// in fetch() resolves against the PAGE address. Any mismatch between page URL
// and script location (nested paths, missing trailing slashes) broke it. Now the URL
// is built from app.js location — files are sought strictly next to the script.
// In the browser it's https://.../joyconaz/sound/<file>, in Electron desktop build
// it's a file:// path next to main.js; behavior is identical. URL is absolute and
// printed to the console — easily visible in the Network tab or error logs.
const SOUND_STORAGE_KEY = 'joyconaz.sound';
const SOUND_FILES = [
  'chasqueo-100233.mp3',
  'finger-snap-101756.mp3',
  'finger-snap-43482.mp3',
];
const DEFAULT_SOUND_FILE = SOUND_FILES[0];

// Half the reference file duration (300 ms / 2 = 150 ms).
// Used as the "snap point" while the file is not yet decoded (buffer === null):
// the buffer and exact duration arrive after async loading.
const SOUND_FALLBACK_MIDPOINT_S = 0.15;

// StereoPannerNode pan values: -1 — all signal left channel,
// +1 — right channel, 0 — center (both equally).
const PAN_LEFT = -1;
const PAN_RIGHT = 1;
const PAN_CENTER = 0;

// Computes the absolute URL for a sound file relative to this script's location.
const soundUrl = (file) => new URL(`sound/${file}`, import.meta.url).href;

// One audio context created per page. Right after creation in the browser,
// it's in a 'suspended' state (Chromium autoplay policy): decodeAudioData works,
// but playback is un-suspended via resume() on the first user gesture
// (see unlockAudio below). In Electron desktop build, the context is
// immediately 'running' — policy is set in main.js.
const AudioContextCtor =
  window.AudioContext ?? window.webkitAudioContext ?? null;
const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
if (!audioContext) {
  console.warn('[sound] Web Audio API is unavailable — click sound is disabled');
}

// Currently playing source. A snap plays max one at a time:
// a new play stops the previous (analogous to the former 'single Audio element
// restarting' behavior), and 'Stop' halts prematurely triggered incoming files.
let activeSoundSource = null;

const stopActiveSoundSource = () => {
  if (!activeSoundSource) {
    return;
  }
  try {
    activeSoundSource.stop();
  } catch {
    // Source already finished and stopped on its own.
  }
  activeSoundSource = null;
};

// Resumes audio context if the browser suspended it. Idempotent:
// in 'running', repeated calls do nothing. Called on unlock via gesture,
// and before every sound trigger — double insurance.
const ensureAudioResumed = async () => {
  if (!audioContext || audioContext.state !== 'suspended') {
    return;
  }
  try {
    await audioContext.resume();
  } catch (error) {
    console.warn('[sound] failed to resume audio context:', error);
  }
};

// Records about sound files: buffer (after decoding), URL, and SNAP POINT —
// the middle of the file's duration (for a reference 300 ms, this is 0.15 s).
// The point is updated by actual buffer duration: initial pauses vary,
// and half duration is the only robust "middle" common to all options.
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

// Loads and decodes one file into an AudioBuffer. Errors (404, wrong case
// in file name — web server might be case-sensitive!) hit the console with
// exact URLs; the file just stays bufferless, and snaps won't sound for it
// until loading succeeds.
const loadSoundFile = async (file) => {
  const entry = soundEntries.get(file);
  if (!entry || !audioContext) {
    return;
  }
  try {
    console.info(`[sound] preparing ${entry.url}`);
    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    entry.buffer = buffer;
    entry.midpoint = buffer.duration / 2;
    console.info(
      `[sound] ${file}: duration ${buffer.duration.toFixed(3)} s, ` +
        `click point ${entry.midpoint.toFixed(3)} s`
    );
  } catch (error) {
    console.warn(
      `[sound] FAILED TO LOAD ${entry.url} (see Network, F12):`,
      error
    );
  }
};

for (const file of SOUND_FILES) {
  void loadSoundFile(file);
}

// Reads saved sound settings {enabled, file}. Like vibration strength,
// any localStorage error safely falls back to an empty object
// (sound disabled, first file in the list).
const loadSoundSettings = () => {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to read sound settings:', error);
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
    console.warn('Failed to save sound settings:', error);
  }
};

// Restore saved state on load.
// Programmatic assignment of .checked and .value doesn't trigger change events,
// so restoration doesn't accidentally overwrite anything.
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

// ── Autoplay unlocking (browser version only) ────
//
// Needed ONLY by the browser version: Chromium requires a "user gesture"
// (click, touch, key press) to allow playback via audio context, and
// WebHID events (Joy-Con buttons) DO NOT count. Context is created 'suspended';
// the first gesture calls resume(), letting sound play anytime thereafter.
// Unlike the previous Audio-element scheme, there is NO race condition where
// a 'pause during unlock halts an actual playback': context resume() does not
// stop already scheduled sources.
//
// In Electron desktop build, unlocking is NOT executed: main.js sets
// autoplayPolicy: 'no-user-gesture-required', context is instantly 'running' —
// snap is heard from the very first edge touch.
const unlockAudio = () => {
  void ensureAudioResumed();
};

if (!IS_ELECTRON) {
  for (const eventType of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    document.addEventListener(eventType, unlockAudio, { passive: true });
  }
}

// Plays a file buffer with specified PAN (-1 left channel, +1 right, 0 center)
// and returns the created source. A new play stops the previous — max one snap
// sounds at a time. The reference is kept in activeSoundSource for premature
// stopping from 'Stop'; the reference is freed upon the 'ended' event.
const playSoundBuffer = (entry, pan) => {
  if (!audioContext || !entry?.buffer) {
    // File is still loading or Web Audio is unavailable — skip silently.
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
    // Extremely old browsers lacking StereoPannerNode: sound without panning,
    // in both channels.
    console.warn('[sound] StereoPannerNode is unavailable — sound is centered');
    source.connect(audioContext.destination);
  }

  source.start();
  activeSoundSource = source;
  source.addEventListener('ended', () => {
    if (activeSoundSource === source) {
      activeSoundSource = null;
    }
  });
  console.info(`[sound] playing ${entry.url} (pan ${pan})`);
  return source;
};

// Short flash of the sound list upon triggering: the event is visible
// even without headphones, separating "won't play" issues from
// "cannot hear" issues.
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

// Record for the currently selected file (with fallback to the first known).
const currentSoundEntry = () => {
  const file = soundFileSelect?.value ?? DEFAULT_SOUND_FILE;
  return soundEntries.get(file) ?? soundEntries.get(DEFAULT_SOUND_FILE);
};

// Plays the selected snap with the specified pan. Called:
// - ahead of time upon edge approach (maybePreplayEdgeSound) — main scenario:
//   middle of file aligns with the touch, pan corresponds to edge side;
// - manually: checkbox toggle (only while movement is stopped), file change,
//   "Test vibration" — test triggers by user gesture sound IN THE CENTER
//   (both speakers), right from the file's start including its initial pause.
// If the checkbox is disabled — does nothing.
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

// Immediately stops a playing snap — called from 'Stop':
// a premature playback could have started during approach (~150 ms to edge),
// and the tail of the file shouldn't sound after movement has stopped.
const stopEdgeSound = () => {
  stopActiveSoundSource();
};

// ── Premature snap start: middle of file = moment of touch ────────
//
// Reference files are ~300 ms; audible snap is roughly in the middle,
// initial pauses vary. So the MIDDLE of the file sounds exactly when
// the ball touches the edge, playback is started AHEAD of time:
// at the moment when time left to the edge at the current speed equals
// half the file's duration. While the ball travels these ~150 ms,
// the initial pause plays; right upon touch, playback hits the middle.
//
// PAN comes from flight DIRECTION: direction > 0 — ball flies RIGHT,
// snap prepares for the RIGHT speaker; direction < 0 — left, left speaker.
// The side is known at the premature launch, so pan is set once and remains
// until the touch.
//
// Prediction via simple ballistics: distance left is `distance` screen units,
// speed is `fractionPerSecond` units per second, so time to edge =
// distance / fractionPerSecond. The threshold is checked every frame,
// so alignment error doesn't exceed one frame's duration (~16 ms) and is
// unnoticeable. Speed changes AFTER launch (◄/► arrows) shift the snap
// slightly — we intentionally ignore this: recalculating position for an
// already playing file is more jarring (a jump within the snap) than
// a shift of tens of milliseconds.
//
// One approach triggers sound EXACTLY ONCE: the edgeSoundArmed flag
// clears on launch and re-arms on bounce (and in start()). If the sound
// checkbox is off, launch doesn't happen, but the flag still clears —
// this approach is "processed", and enabling sound later won't give a
// delayed half-snap mid-flight.
//
// Fallback for a missed window: if due to a large frame (tab was hidden, dt spiked)
// the threshold was overshot and the flag is still armed at the edge hit,
// launch occurs on the touch frame — the snap will sound late by the
// initial pause, but it will sound.
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
  // Snap side = side of edge the ball is flying towards.
  playEdgeSound(direction > 0 ? PAN_RIGHT : PAN_LEFT);
};

// Enabling the checkbox — if movement is STOPPED, immediately play the
// selected snap CENTERED (in both speakers): instant sound test.
// If movement is running, the test snap DOES NOT play: it would sound
// off-beat — not matching an edge touch — overlaying properly aligned
// sounds and disrupting the session rhythm. The sound simply turns on
// and will play on the next edge touch — in the speaker on the edge's side.
soundEnabledToggle?.addEventListener('change', () => {
  saveSoundSettings();
  if (!running) {
    playEdgeSound(PAN_CENTER);
  }
});

// Changing file in list — instant audition of new snap centered.
// Plays only if the checkbox is enabled.
soundFileSelect?.addEventListener('change', () => {
  saveSoundSettings();
  playEdgeSound(PAN_CENTER);
});

// Minor visual flash of the corresponding Joy-Con status indicator.
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
    ? 'Left: connected'
    : 'Left: not connected';
  statusRight.textContent = hasRight
    ? 'Right: connected'
    : 'Right: not connected';
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

  // Recalibrated scale: the value on the slider is multiplied by
  // SPEED_CALIBRATION, so the new 1.00 moves like the former 1.5.
  const fractionPerSecond = Number(speedSlider.value) * SPEED_CALIBRATION;

  position += direction * fractionPerSecond * dt;

  // Premature launch of the snap sound (with pan by edge side):
  // checked BEFORE fixing the touch, so on threshold overshoot
  // (large dt), the fallback touch-frame launch triggers — see
  // comments in maybePreplayEdgeSound.
  maybePreplayEdgeSound(fractionPerSecond);

  if (position >= 1) {
    // Extreme right position: vibration pattern on the right Joy-Con
    // (in random mode — two-stage choice: if "no" again the current pattern,
    // if "yes" a new one from the "random" list; strength — saved for
    // the pattern, slider is ignored).
    // The sound was already launched ahead of time panned RIGHT (if enabled) —
    // we only re-arm the premature launch flag for the next pass to the left edge.
    position = 1;
    direction = -1;
    edgeSoundArmed = true;
    void rumbleSidePattern('right');
  } else if (position <= 0) {
    // Extreme left position: vibration pattern on the left Joy-Con
    // (in random mode — two-stage choice: if "no" again the current pattern,
    // if "yes" a new one from the "random" list; strength — saved for
    // the pattern, slider is ignored).
    // The sound was already launched ahead of time panned LEFT.
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
  // Arm the premature sound launch for the first pass towards the edge.
  edgeSoundArmed = true;
  startStopButton.textContent = 'Stop';
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
  startStopButton.textContent = 'Start';
  stopVibration();
  // Prematurely launched snap (could have started ~150 ms before edge)
  // is halted alongside movement.
  stopEdgeSound();
  edgeSoundArmed = true;
};

// Toggle Start/Stop (button on the page).
const toggle = () => {
  if (running) {
    stop();
  } else {
    start();
  }
};

// Toggle Start/Stop via Joy-Con buttons: with debounce protection,
// so duplicate HID events or bouncing doesn't toggle state back and forth.
const tryToggle = () => {
  const now = performance.now();
  if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) {
    return;
  }
  lastToggleAt = now;
  toggle();
};

startStopButton.addEventListener('click', toggle);

// Test button: plays the pattern on both sides immediately
// (in random mode, each side INDEPENDENTLY goes through the two-stage
// choice — maybe again current, maybe new from "random" list; strength —
// saved exactly for the played pattern) and, if sound is enabled,
// the selected snap CENTERED — from file start (this is a user-initiated
// test launch; edge-alignment and panning do not apply here).
testPatternButton?.addEventListener('click', () => {
  void rumbleSidePattern('left');
  void rumbleSidePattern('right');
  playEdgeSound(PAN_CENTER);
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Changes speed by a given step, clamping to the slider's range
// (in units of the new recalibrated scale). Used by ◄ / ► buttons
// and right stick tilt on Joy-Con — step SPEED_STEP (0.1);
// mouse slider moves by its own step="0.05" grid from index.html independently.
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

// ── Pattern switching with '+' / '−' buttons ──────────────────────────
//
// '+' physically resides on the right Joy-Con, '−' on the left. The library's
// wrappers zero out (undefined) "foreign" buttons in packets, so press
// front is correctly detected via the previousButtons map per device.
//
// When the "Favorites only" filter is enabled, the cycle only goes through
// favorite patterns (see switchablePatternValues). Random mode doesn't
// affect switching: it only alters the choice of pattern for the edge touch.
//
// Vibration strength change step by ▲ / ▼ arrows coincides with the slider's
// step so values always align to its grid.
const RUMBLE_STRENGTH_STEP = 0.05;

// Minimum interval between pattern switches: one press yields exactly
// one switch, bounce and duplicate HID packets are ignored.
const PATTERN_SWITCH_MIN_INTERVAL_MS = 150;
let lastPatternSwitchAt = 0;

// Minimum interval between vibration strength steps (same protection).
const STRENGTH_STEP_MIN_INTERVAL_MS = 150;
let lastStrengthStepAt = 0;

// Ordered list of pattern selector values — in the order they are listed
// in the UI (optgroup blocks are maintained as a single cyclic list).
const PATTERN_VALUES = [...(patternSelect?.options ?? [])].map(
  (option) => option.value
);

// Cyclically switches the vibration pattern: delta = +1 — next pattern,
// delta = -1 — previous; after the last comes the first, before the first —
// the last (cyclic traversal without "dead ends"). The traversal list —
// all patterns or only favorites (if filter is enabled and favorites not empty).
// Immediately saves the choice, applies saved strength for the new pattern (or 50%)
// and syncs "Favorite pattern" and "Use randomly" checkboxes with the new status.
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

// Changes vibration strength by a given step, clamping to the slider's range,
// and updates the UI indicator. Like changeSpeed, it rounds the result
// to hundredths to prevent float accumulation errors.
// The new value is saved for the current pattern — ◄ / ► buttons
// change the pattern, while ▲ / ▼ adjust its volume.
const changeRumbleStrength = (delta) => {
  const min = Number(rumbleSlider.min);
  const max = Number(rumbleSlider.max);
  const current = Number(rumbleSlider.value);
  const next = Math.min(
    Math.max(Math.round((current + delta) * 100) / 100, min),
    max
  );
  // At range boundaries, step doesn't change value — we don't spend the interval,
  // so immediately pushing back in the opposite direction works instantly.
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

// State for ◄ / ► arrow buttons.
//
// IMPORTANT: packets where the button value is undefined are completely
// ignored (means "this button isn't reported by this controller"),
// otherwise right Joy-Con packets would reset the arrow hold state
// and every tick would be seen as a new press.
const arrowState = {
  left: { pressed: false, heldSince: 0, lastStepAt: 0 },
  right: { pressed: false, heldSince: 0, lastStepAt: 0 },
};

// ◄ / ► arrow buttons handling:
// - a single press changes speed by exactly one step (0.10);
// - holding past SPEED_REPEAT_DELAY_MS smoothly changes speed
//   at intervals of ARROW_REPEAT_INTERVAL_MS.
const handleArrowButtons = (buttons) => {
  const now = performance.now();

  for (const name of ['left', 'right']) {
    const value = buttons[name];
    const state = arrowState[name];

    // undefined — this button is not reported by this controller:
    // skip packet WITHOUT resetting hold state.
    if (value === undefined) {
      continue;
    }

    const delta = name === 'right' ? SPEED_STEP : -SPEED_STEP;

    if (Boolean(value)) {
      if (!state.pressed || !state.heldSince) {
        // New press (front): one step, if enough time passed
        // since the last step.
        state.pressed = true;
        state.heldSince = now;
        if (now - state.lastStepAt >= ARROW_MIN_STEP_INTERVAL_MS) {
          state.lastStepAt = now;
          changeSpeed(delta);
        }
      } else if (
        // Hold: auto-repeat.
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

// ── Right Stick (Right Joy-Con): Speed step ────────────────────────
//
// Tilting the right stick UP or RIGHT increases speed by SPEED_STEP (0.10),
// tilting DOWN or LEFT decreases it by 0.10. The stick is analog, so a "press"
// is considered crossing the tilt threshold: one tilt = exactly one step;
// to trigger the next step, the stick must return to center. Hysteresis
// between the activation and return thresholds prevents debounce when held
// near the threshold.
//
// Axis signs in the library parser: right — horizontal > 0, left —
// horizontal < 0, up — vertical < 0, down — vertical > 0.
//
// WHY VERTICAL IS CENTERED (fixing "up doesn't work"):
// the library normalizes horizontal fairly symmetrically — stick neutral
// reads ≈ 0, full range ≈ [-2, +2]. Vertical, however, due to inversion
// and different normalization in the HID packet parser, gets an OFFSET ZERO:
// stick neutral reads ≈ +0.155, and the range is asymmetrical — roughly [-1.7, +2].
// Because of this, full UP stick travel yielded only ≈ -0.7...-0.9 vertically,
// missing the -1.0 threshold, so "up" didn't trigger, though down/right/left did.
// Therefore, the vertical is CENTERED prior to comparison by subtracting a theoretical
// zero (RIGHT_STICK_VERTICAL_BIAS), and its "press" threshold is set lower than
// the horizontal one — after centering, both vertical directions are reliably
// reachable on full stick tilt.
//
// Processed ONLY on the right Joy-Con (filtered at call site):
// left Joy-Con packets contain zeros in right stick bytes, which parses
// as full left-down tilt and without filtering would falsely decrease speed.
//
// IMPORTANT: Stick press (rightStick button) is a separate event and is
// NOT handled here: it toggles random mode (see "Random patterns and random mode" section).
// Pressing doesn't tilt the stick, and tilting doesn't press it — mechanics don't conflict.
const RIGHT_STICK_HORIZONTAL_TRIGGER = 1.0; // "press" threshold left/right
const RIGHT_STICK_VERTICAL_TRIGGER = 0.6; // "press" threshold up/down (after centering)
const RIGHT_STICK_RELEASE = 0.4; // return to neutral threshold (hysteresis)
// Theoretical vertical value in stick neutral given by library parser
// (12-bit sensor neutral 2048 → +0.155): subtracted to center the vertical axis
// (see comment above).
const RIGHT_STICK_VERTICAL_BIAS = 0.155;

// Right stick state per device key: whether a step is armed.
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

  // Center vertical: stick neutral is parsed by library as
  // ≈ +0.155 (see RIGHT_STICK_VERTICAL_BIAS comment).
  const vertical = rawVertical - RIGHT_STICK_VERTICAL_BIAS;

  // "Press" direction: +1 — up/right (increase speed),
  // -1 — down/left (decrease), 0 — neutral or hysteresis zone.
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
    // Stick tilted past threshold: one step per first tilt.
    if (state.armed) {
      state.armed = false;
      changeSpeed(direction * SPEED_STEP);
    }
  } else if (
    Math.abs(horizontal) < RIGHT_STICK_RELEASE &&
    Math.abs(vertical) < RIGHT_STICK_RELEASE
  ) {
    // Stick returned to neutral — next tilt will trigger.
    state.armed = true;
  }

  rightStickState.set(key, state);
};

// ── Button combinations for favorites: L+R and ZL+ZR ────────────────────
//
// L Button and ZL physically reside on the LEFT Joy-Con, R Button and ZR —
// on the RIGHT. Thus "press L and R simultaneously" is an event ACROSS
// TWO devices: inside a single controller's packet, both buttons of a pair
// are never pressed (the other side in the packet is always false).
// Therefore, state is aggregated across devices: liveButtons holds the
// LATEST packet of each controller, and a "combo front" is the moment
// BOTH buttons of the pair become pressed (regardless of which was pressed first).
// Releasing either breaks the combo, and closing it again counts as a new press.
//
// Debounce protection — FAVORITE_TOGGLE_MIN_INTERVAL_MS.
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

// Main Joy-Con button handler. key — physical device key,
// used to track previous button states.
const handleButtons = (key, buttons) => {
  const prev = previousButtons.get(key) || {};

  // Fresh snapshot of device buttons — for inter-controller combos.
  liveButtons.set(key, buttons);

  // B, A, Y, X — Start/Stop ball movement.
  // React only to the press moment (front).
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

  // Left/right arrows — changing movement speed.
  handleArrowButtons({
    left: buttons.left,
    right: buttons.right,
  });

  // '+' / '−' buttons — cycle vibration pattern:
  // '+' (right Joy-Con) — next pattern,
  // '−' (left Joy-Con) — previous pattern.
  // With filter enabled — only cycles through favorites.
  // 'undefined' in the packet means "this controller doesn't report this button",
  // Boolean(undefined) === false, so foreign packets don't create a false front.
  if (Boolean(buttons.plus) && !prev.plus) {
    switchPattern(+1);
  }
  if (Boolean(buttons.minus) && !prev.minus) {
    switchPattern(-1);
  }

  // ▲ / ▼ arrows (left Joy-Con) — change vibration strength:
  // ▲ — increase, ▼ — decrease, step equals the slider's step (5%).
  // The new value is saved for the current pattern.
  if (Boolean(buttons.up) && !prev.up) {
    changeRumbleStrength(+RUMBLE_STRENGTH_STEP);
  }
  if (Boolean(buttons.down) && !prev.down) {
    changeRumbleStrength(-RUMBLE_STRENGTH_STEP);
  }

  // Pressing right stick (rightStick, right Joy-Con) — enable/
  // disable random mode. The press zeroes out (undefined) in left
  // Joy-Con packets, so foreign packets don't create false fronts. Debounce
  // protection — minimal interval RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS.
  if (Boolean(buttons.rightStick) && !prev.rightStick) {
    const now = performance.now();
    if (now - lastRandomModeToggleAt >= RANDOM_MODE_TOGGLE_MIN_INTERVAL_MS) {
      lastRandomModeToggleAt = now;
      console.debug('Random mode toggled (right stick) on', key);
      toggleRandomMode();
    }
  }

  // Capture button (left Joy-Con) — add/remove CURRENTLY selected
  // pattern in the "random" list (same as "Use randomly" checkbox).
  // Capture zeroes out in right Joy-Con packets — foreign packets
  // don't create false fronts. Debounce protection — minimal
  // interval RANDOM_PATTERN_TOGGLE_MIN_INTERVAL_MS.
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

  // L+R / ZL+ZR combos — processed after updating device button snapshot.
  handleFavoriteCombo();
};

// Joy-Cons can "sleep" until their first touch, so listeners are
// attached dynamically every 2 seconds.
//
// Important: the listener is attached EXACTLY ONCE to the physical device
// (by deviceKey), rather than to each JoyCon object. This prevents double
// processing of a single press, which makes Start/Stop look unresponsive.
// The handler is attached before enableVibration, and the vibration command
// itself is wrapped in a try/catch, so an error sending it doesn't break button handling.
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

      // Feed the entropy pool with non-zero sensor readings of this
      // Joy-Con — they provide unpredictability for random pattern choice
      // in random mode (see "Randomness from Joy-Con sensors" section).
      feedSensorEntropy(packet);

      if (!packet.buttonStatus) {
        return;
      }
      handleButtons(key, packet.buttonStatus);
      // Process the right stick ONLY on the right Joy-Con: left Joy-Con
      // packets contain zeros in these bytes, parsing as full left-down
      // tilt (see handleRightStick comment) which would falsely lower speed.
      if (isSide(joyCon, 'right')) {
        handleRightStick(key, packet.analogStickRight);
      }
    });

    try {
      await joyCon.enableVibration();
    } catch (error) {
      console.error('Failed to enable vibration:', error);
    }
  }

  // Clear stale button snapshots and stick states of disconnected
  // controllers, so a "stuck" pressed button of a vanished device doesn't
  // hold an L+R / ZL+ZR combo locked indefinitely.
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

// ── Help Overlay ──────────────────────────────────────────────────────
//
// Long explanations (vibration patterns, favorites, random mode, click sound,
// saved settings) are moved from the main screen into a modal overlay:
// the "Help" button (#help-open) opens it, and it closes via the close cross
// (#help-close), clicking the overlay backdrop, or the Esc key. The overlay
// is part of the index.html layout (hidden by the 'hidden' attribute),
// working identically in the browser and Electron desktop build;
// no separate OS windows or pages are created.
const isHelpOpen = () => Boolean(helpOverlay && !helpOverlay.hidden);

const openHelp = () => {
  helpOverlay?.removeAttribute('hidden');
  // Focus on the close button so the overlay can be dismissed via keyboard.
  helpCloseButton?.focus();
};

const closeHelp = () => {
  helpOverlay?.setAttribute('hidden', '');
  // Return focus to the button that opened the overlay.
  helpButton?.focus();
};

helpButton?.addEventListener('click', openHelp);

helpCloseButton?.addEventListener('click', closeHelp);

// Clicking the backdrop (outside the dialog) also closes the help overlay.
helpOverlay?.addEventListener('click', (event) => {
  if (event.target === helpOverlay) {
    closeHelp();
  }
});

// ── "ABC of EMDR" Overlay ────────────────────────────────────────────────
//
// Information dialog about the application's author and his groups with translations
// of EMDR materials: the "ABC of EMDR" button (#azbuka-open) opens it.
// Uses the same styles and mechanics as "Help": closed by cross (#azbuka-close),
// backdrop click, or Esc key. The overlay is part of index.html markup
// (hidden via 'hidden' attribute), working identically in browser and Electron.
// Links to groups open in the system browser: in Electron, main.js intercepts them
// (setWindowOpenHandler for target="_blank" and will-navigate for regular links),
// while the browser handles it natively as new tabs.
const isAzbukaOpen = () => Boolean(azbukaOverlay && !azbukaOverlay.hidden);

const openAzbuka = () => {
  azbukaOverlay?.removeAttribute('hidden');
  // Focus on the close button so the overlay can be dismissed via keyboard.
  azbukaCloseButton?.focus();
};

const closeAzbuka = () => {
  azbukaOverlay?.setAttribute('hidden', '');
  // Return focus to the button that opened the overlay.
  azbukaButton?.focus();
};

azbukaButton?.addEventListener('click', openAzbuka);

azbukaCloseButton?.addEventListener('click', closeAzbuka);

// Clicking the backdrop (outside the dialog) also closes the overlay.
azbukaOverlay?.addEventListener('click', (event) => {
  if (event.target === azbukaOverlay) {
    closeAzbuka();
  }
});

// ── "Joy-Con Controls" Overlay ───────────────────────────────────────
//
// The list of controller commands (buttons, stick, combos) was moved from
// the main screen to a modal overlay — using the same styles and mechanics
// as "Help": the "Joy-Con Controls" button (#controls-open) opens it,
// closed by cross (#controls-close), backdrop click, or Esc key.
const isControlsOpen = () =>
  Boolean(controlsOverlay && !controlsOverlay.hidden);

const openControls = () => {
  controlsOverlay?.removeAttribute('hidden');
  // Focus on the close button so the overlay can be dismissed via keyboard.
  controlsCloseButton?.focus();
};

const closeControls = () => {
  controlsOverlay?.setAttribute('hidden', '');
  // Return focus to the button that opened the overlay.
  controlsButton?.focus();
};

controlsButton?.addEventListener('click', openControls);

controlsCloseButton?.addEventListener('click', closeControls);

// Clicking the backdrop (outside the dialog) also closes the overlay.
controlsOverlay?.addEventListener('click', (event) => {
  if (event.target === controlsOverlay) {
    closeControls();
  }
});

// ── "Settings" Overlay: Saving and Loading JSON Files ───────────────
//
// All application settings live in localStorage under keys with the "joyconaz."
// prefix (last chosen pattern, strength per pattern, favorite and "random" patterns,
// "Favorites only" and "Random mode" checkboxes, click sound). The "Settings" overlay
// (#settings-overlay, button #settings-open left of "Joy-Con Controls") allows
// transferring them between devices and reinstalls:
// - "Save settings" (#settings-save) exports ALL known keys into a JSON file.
//   In the browser, the file downloads normally (Blob + a.download);
//   in the Electron desktop build, this download is intercepted in main.js
//   (will-download event) and triggers a SYSTEM save dialog.
// - "Load settings" (#settings-load) opens a *.json file picker (hidden
//   input#settings-file-input), validates the file, and applies it.
//
// FILE FORMAT (see collectSettingsExport): a wrapper object with fields
// app ('joyconaz'), format ('settings'), version (number, from 1),
// savedAt (ISO date) and settings — a map "localStorage key → RAW string value".
// Raw strings, not parsed values, are stored so that loading doesn't misinterpret
// formats: values are returned to localStorage exactly as they were.
//
// VALIDATION (validateSettingsFile): the wrapper must carry correct
// app/format/version and a NON-EMPTY settings map consisting ONLY of
// known keys; each key's value is validated by its type rules (string,
// JSON object, JSON string array, JSON boolean — see SETTINGS_KEY_VALIDATORS).
// A random JSON file with other fields is rejected by app/format checks;
// a spoofed format — by phased value type checks. A file without a single
// known key is also rejected.
//
// OVERWRITING: If the current localStorage has AT LEAST ONE setting
// (hasAnyStoredSettings), a confirmation prompt is shown before applying
// (window.confirm — system dialog, works in both browser and Electron).
// If confirmed, all known keys are DELETED first, then values from the file
// are applied — the loaded file becomes the single source of truth, rather
// than being "mixed" with previous settings. After applying, the page
// RELOADS: settings are restored during module initialization, and a reload
// is a reliable way to apply everything (pattern, strength, favorites,
// random mode, sound) without duplicating initialization logic.
const SETTINGS_APP_ID = 'joyconaz';
const SETTINGS_FORMAT = 'settings';
const SETTINGS_VERSION = 1;
const SETTINGS_FILE_NAME = 'joyconaz-settings.json';

// All localStorage keys pertaining to application settings.
const SETTINGS_STORAGE_KEYS = [
  PATTERN_STORAGE_KEY,
  RUMBLE_STRENGTH_STORAGE_KEY,
  FAVORITE_PATTERNS_STORAGE_KEY,
  ONLY_FAVORITES_STORAGE_KEY,
  RANDOM_PATTERNS_STORAGE_KEY,
  RANDOM_MODE_STORAGE_KEY,
  SOUND_STORAGE_KEY,
];

// Raw string parsed as a JSON object (not array, not null).
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

// Raw string parsed as a JSON array of strings.
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

// Raw string parsed as a JSON boolean (true/false).
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

// Validation rules for raw values by localStorage keys.
const SETTINGS_KEY_VALIDATORS = {
  // Pattern name — non-empty string (the name itself is validated by selector list on restore).
  [PATTERN_STORAGE_KEY]: (raw) => typeof raw === 'string' && raw.length > 0,
  // "pattern name → strength" map — JSON object.
  [RUMBLE_STRENGTH_STORAGE_KEY]: isJsonObjectString,
  // Favorite patterns list — JSON array of strings.
  [FAVORITE_PATTERNS_STORAGE_KEY]: isStringArrayString,
  // "Favorites only" checkbox — JSON boolean.
  [ONLY_FAVORITES_STORAGE_KEY]: isBooleanString,
  // "Random" patterns list — JSON array of strings.
  [RANDOM_PATTERNS_STORAGE_KEY]: isStringArrayString,
  // "Random mode" checkbox — JSON boolean.
  [RANDOM_MODE_STORAGE_KEY]: isBooleanString,
  // Sound settings — JSON object with optional fields enabled (boolean) and file (string).
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

// Assembles the export object: wrapper with format tags and a
// "key → raw value" map from localStorage (keys with no value are omitted).
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

// Checks if localStorage contains at least one non-empty application setting.
const hasAnyStoredSettings = () =>
  SETTINGS_STORAGE_KEYS.some((key) => {
    const raw = localStorage.getItem(key);
    return raw !== null && raw !== '';
  });

// Validates the parsed JSON of the settings file. Returns
// { valid: true, settings } for a valid file (settings — "key → raw value" map)
// or { valid: false } for anything else.
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
    // Unknown key or value failed type check — not our file.
    if (!validator || !validator(raw)) {
      return { valid: false };
    }
    knownKeys++;
  }
  // Not a single known key — just a dummy, not a valid settings file.
  if (knownKeys === 0) {
    return { valid: false };
  }
  return { valid: true, settings };
};

// Applies the "key → raw value" map: first DELETES ALL known keys (loaded file
// is the single source of truth, no "mixing" with old settings occurs),
// then writes values from the file as-is, without reinterpreting formats.
const applySettingsFrom = (settings) => {
  for (const key of SETTINGS_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  for (const [key, raw] of Object.entries(settings)) {
    localStorage.setItem(key, raw);
  }
};

// Exports settings to a file: Blob + programmatic click on a link with
// the 'download' attribute. In browser, this starts a normal download;
// in Electron, the will-download event in main.js intercepts it to show
// a system save dialog.
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
    // Revoke the URL with a delay to ensure the download has time to start.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    console.info('[settings] settings prepared for saving to file');
  } catch (error) {
    console.error('Failed to prepare settings file:', error);
    window.alert('Failed to save settings to file.');
  }
};

// Reads the chosen file, validates, asks for overwrite confirmation,
// and applies the settings followed by a page reload.
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
        'The selected file is not a settings file for this application.'
      );
      return;
    }

    // Current settings are not empty — confirm overwrite.
    if (hasAnyStoredSettings()) {
      const confirmed = window.confirm(
        'Current settings will be replaced by the settings from the file. Continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      applySettingsFrom(check.settings);
    } catch (error) {
      console.error('Failed to apply settings from the file:', error);
      window.alert('Failed to apply settings from the file.');
      return;
    }

    window.alert('Settings loaded — the application will restart.');
    window.location.reload();
  });
  reader.addEventListener('error', () => {
    window.alert('Failed to read the selected file.');
  });
  reader.readAsText(file);
};

const isSettingsOpen = () =>
  Boolean(settingsOverlay && !settingsOverlay.hidden);

const openSettings = () => {
  settingsOverlay?.removeAttribute('hidden');
  // Focus on the close button so the overlay can be dismissed via keyboard.
  settingsCloseButton?.focus();
};

const closeSettings = () => {
  settingsOverlay?.setAttribute('hidden', '');
  // Return focus to the button that opened the overlay.
  settingsButton?.focus();
};

settingsButton?.addEventListener('click', openSettings);

settingsCloseButton?.addEventListener('click', closeSettings);

// Clicking the backdrop (outside the dialog) also closes the overlay.
settingsOverlay?.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) {
    closeSettings();
  }
});

// "Save settings" — export to JSON file.
settingsSaveButton?.addEventListener('click', saveSettingsToFile);

// "Load settings" — system dialog to select a *.json file.
// value is cleared BEFORE click so that picking the same file again
// still fires the change event.
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

// ── Keyboard controls ──────────────────────────────────────────
//
// Main commands are duplicated on a standard computer keyboard —
// convenient when Joy-Cons aren't at hand or it's faster to press a key:
// - SPACE — Start / Stop ball movement (same as "Start" button on page
//   and A/B/X/Y on Joy-Con);
// - Arrows ↑ / → — increase speed, ↓ / ← — decrease. Behavior is
//   identical to ◄ / ► arrows on the left Joy-Con: single press — one
//   SPEED_STEP (0.10), holding changes speed smoothly relying on system
//   keyboard repeat (steps are additionally throttled by a minimum interval);
// - 1 / 2 / 3 (top row and numpad) — quickly set speed to 0.8 / 1.0 / 1.2;
// - Enter — toggle random mode (same as "Random mode" checkbox and
//   right stick press on the right Joy-Con);
// - S — toggle click sound (same as "Enable" checkbox for click sound).
//
// Keys are recognized by event.code — by PHYSICAL key, so it works on
// any layout (e.g. Russian). Combinations with Alt / Ctrl / Cmd are NOT
// intercepted (they belong to browser/OS). Default actions for space, arrows,
// and Enter are prevented (page scroll, clicking focused element) so each
// key reliably means one app command. Auto-repeat (event.repeat) for toggle
// commands is ignored: holding Space or Enter shouldn't strobe the state.
const KEYBOARD_SPEED_PRESETS = {
  Digit1: 0.8,
  Numpad1: 0.8,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 1.2,
  Numpad3: 1.2,
};

// Minimum interval between keyboard speed steps — same as single presses
// on Joy-Con arrows: fast keyboard repeats won't aggressively jump the speed.
const KEYBOARD_SPEED_STEP_MIN_INTERVAL_MS = ARROW_MIN_STEP_INTERVAL_MS;
let lastKeyboardSpeedStepAt = 0;

// Short light-blue flash of the sound "Enable" checkbox:
// S key toggle is visible even without looking at the checkbox.
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

// Sets the slider speed to a specific value (keys 1/2/3).
// Value is rounded to hundredths and clamped to the slider range;
// programmatic .value assignment doesn't fire an input event.
const setSpeed = (value) => {
  const next = clamp(Math.round(value * 100) / 100, SPEED_MIN, SPEED_MAX);
  speedSlider.value = String(next);
  updateSpeedValue();
};

// One keyboard speed step with interval protection (analogous to
// single arrow presses on Joy-Con).
const keyboardSpeedStep = (delta) => {
  const now = performance.now();
  if (now - lastKeyboardSpeedStepAt < KEYBOARD_SPEED_STEP_MIN_INTERVAL_MS) {
    return;
  }
  lastKeyboardSpeedStepAt = now;
  changeSpeed(delta);
};

// Toggling click sound with the S key: same effect as clicking the
// "Enable" checkbox — state is saved, and enabling while stopped plays
// a centered test snap (playEdgeSound respects the new checkbox state:
// on disable, no test sound plays).
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
  // Combinations with Alt / Ctrl / Cmd are NOT intercepted — they
  // belong to the browser and the operating system.
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const code = event.code;

  // SPACE — Start / Stop ball movement. Auto-repeat ignored:
  // holding shouldn't strobe the movement on/off.
  if (code === 'Space') {
    event.preventDefault();
    if (!event.repeat) {
      tryToggle();
    }
    return;
  }

  // Arrows — speed: ↑ / → faster, ↓ / ← slower (step and interval
  // are the same as left Joy-Con arrows; hold works via keyboard auto-repeat).
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

  // Enter — toggle random mode.
  if (code === 'Enter' || code === 'NumpadEnter') {
    event.preventDefault();
    if (!event.repeat) {
      toggleRandomMode();
    }
    return;
  }

  // 1 / 2 / 3 — speed presets (top row and numpad).
  if (Object.prototype.hasOwnProperty.call(KEYBOARD_SPEED_PRESETS, code)) {
    event.preventDefault();
    if (!event.repeat) {
      setSpeed(KEYBOARD_SPEED_PRESETS[code]);
    }
    return;
  }

  // S — toggle click sound (on any layout).
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