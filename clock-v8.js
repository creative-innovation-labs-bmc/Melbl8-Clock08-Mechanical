'use strict';

// V8 layers a five-minute installation moment on top of V7.
// Normal behaviour remains V7. At :00, :05, :10, etc, every hand turns green
// for 10 seconds. A single linked gust travels across the wall and each clock
// performs the same gentle rotation with a position-based delay, so the wind
// direction reads clearly rather than as unrelated spinning.

const V8_TIME_ZONE = 'Australia/Melbourne';
const V8_PARAMS = new URLSearchParams(location.search);
const V8_DEMO = V8_PARAMS.get('demo') === '1';
const V8_DIRECTION = ['ltr', 'rtl', 'ttb', 'btt'].includes(V8_PARAMS.get('dir'))
  ? V8_PARAMS.get('dir')
  : 'ltr';

const V8_DURATION_MS = 10000;
const V8_RESOLVE_AT_MS = 8500;
const V8_TICK_MS = 120;
const V8_GUST_TRAVEL_MS = 1800;
const V8_CELL_SPIN_MS = 6200;
const V8_ROTATION_DEG = 360;
const V8_SPIN_EASE_MS = 260;
const V8_RESOLVE_MS = 1200;
const V8_DEMO_START = performance.now();

const V8_TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: V8_TIME_ZONE,
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

const V8_PATTERNS = {
  '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'],
  '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'],
  '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'],
  '7': ['111','001','001','001','001'],
  '8': ['111','101','111','101','111'],
  '9': ['111','101','111','001','111']
};

let v8Active = false;
let v8Resolving = false;
let v8Start = 0;
let v8ResolveTarget = null;

function v8Parts(date = new Date()) {
  const values = Object.create(null);
  for (const part of V8_TIME_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    hh: values.hour.padStart(2, '0'),
    mm: values.minute.padStart(2, '0'),
    ss: values.second.padStart(2, '0')
  };
}

function v8Window() {
  if (V8_DEMO) {
    const elapsed = performance.now() - V8_DEMO_START;
    return { active: elapsed < V8_DURATION_MS, elapsed };
  }

  const now = v8Parts();
  const second = Number(now.ss);
  return {
    active: Number(now.mm) % 5 === 0 && second < 10,
    elapsed: second * 1000 + (Date.now() % 1000)
  };
}

function v8Cells() {
  return Array.from(document.querySelectorAll('.clock-cell'));
}

function v8Clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function v8EaseInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function v8NormaliseDelta(delta) {
  return ((delta + 540) % 360) - 180;
}

function v8SetHand(hand, clockAngle, duration) {
  if (!hand) return;
  const target = clockAngle - 90;
  const delta = v8NormaliseDelta(target - hand.angle);
  hand.angle += delta;
  hand.ready = true;
  hand.el.style.transitionDuration = `${duration}ms, 260ms, 260ms`;
  hand.el.style.transform = `rotate(${hand.angle}deg)`;
}

function v8DriveHand(hand, cssAngle) {
  if (!hand) return;
  hand.ready = true;
  hand.angle = cssAngle;
  hand.el.style.transitionDuration = `${V8_SPIN_EASE_MS}ms, 260ms, 260ms`;
  hand.el.style.transform = `rotate(${hand.angle}deg)`;
}

function v8IsOn(pattern, row, col) {
  return row >= 0 && row < 5 && col >= 0 && col < 3 && pattern[row][col] === '1';
}

function v8Directions(pattern, row, col) {
  if (!v8IsOn(pattern, row, col)) return null;
  const dirs = [];
  if (v8IsOn(pattern, row - 1, col)) dirs.push(0);
  if (v8IsOn(pattern, row, col + 1)) dirs.push(90);
  if (v8IsOn(pattern, row + 1, col)) dirs.push(180);
  if (v8IsOn(pattern, row, col - 1)) dirs.push(270);
  if (dirs.length === 0) return [0, 180];
  if (dirs.length === 1) return [dirs[0], dirs[0]];
  if (dirs.length === 2) return dirs;
  if (dirs.includes(0) && dirs.includes(180) && !(dirs.includes(90) && dirs.includes(270))) return [0, 180];
  if (dirs.includes(90) && dirs.includes(270) && !(dirs.includes(0) && dirs.includes(180))) return [90, 270];
  if (dirs.includes(0) && dirs.includes(90)) return [0, 90];
  if (dirs.includes(90) && dirs.includes(180)) return [90, 180];
  if (dirs.includes(180) && dirs.includes(270)) return [180, 270];
  if (dirs.includes(270) && dirs.includes(0)) return [270, 0];
  return [dirs[0], dirs[1]];
}

function v8SetCell(cell, dirs, keepGreen, duration) {
  const target = dirs || [0, 180];
  const active = !!dirs;
  cell._isActive = keepGreen ? true : active;
  cell.classList.toggle('is-active', keepGreen || active);
  cell.classList.toggle('is-inactive', !keepGreen && !active);
  v8SetHand(cell._hands?.[0], target[0], duration);
  v8SetHand(cell._hands?.[1], target[1], duration);
}

function v8ApplyTime(date, keepGreen) {
  const now = v8Parts(date);
  const digits = Array.from(document.querySelectorAll('.digit'));
  const six = `${now.hh}${now.mm}${now.ss}`;

  digits.forEach((digit, digitIndex) => {
    const pattern = V8_PATTERNS[six[digitIndex]];
    const cells = Array.from(digit.querySelectorAll('.clock-cell'));
    let index = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        v8SetCell(cells[index], v8Directions(pattern, row, col), keepGreen, V8_RESOLVE_MS);
        index += 1;
      }
    }
  });

  const pair = Number(now.ss) % 2 === 0 ? [0, 180] : [90, 270];
  document.querySelectorAll('.colon').forEach(colon => {
    colon.querySelectorAll('.clock-cell').forEach(cell => v8SetCell(cell, pair, keepGreen, V8_RESOLVE_MS));
  });
}

function v8DirectionPosition(nx, ny) {
  if (V8_DIRECTION === 'rtl') return 1 - nx;
  if (V8_DIRECTION === 'ttb') return ny;
  if (V8_DIRECTION === 'btt') return 1 - ny;
  return nx;
}

function v8PrepareGust() {
  const cells = v8Cells();
  if (!cells.length) return;

  const centres = cells.map(cell => {
    const rect = cell.getBoundingClientRect();
    return {
      cell,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  });

  const xs = centres.map(item => item.x);
  const ys = centres.map(item => item.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  centres.forEach(({ cell, x, y }) => {
    const nx = (x - minX) / spanX;
    const ny = (y - minY) / spanY;
    cell._v8Position = v8Clamp(v8DirectionPosition(nx, ny));
    cell._v8StartAngles = (cell._hands || []).map(hand => {
      const angle = Number.isFinite(hand.angle) ? hand.angle : 0;
      return angle;
    });
  });
}

function v8Enter(elapsed) {
  v8Active = true;
  v8Resolving = false;
  v8ResolveTarget = null;
  v8Start = performance.now() - elapsed;
  document.body.classList.add('v8-installation');
  v8PrepareGust();

  v8Cells().forEach(cell => {
    cell._isActive = true;
    cell.classList.add('is-active');
    cell.classList.remove('is-inactive');
  });
}

function v8Spin(elapsed) {
  const cells = v8Cells();

  cells.forEach(cell => {
    const position = Number.isFinite(cell._v8Position) ? cell._v8Position : 0;
    const delay = position * V8_GUST_TRAVEL_MS;
    const localElapsed = elapsed - delay;
    const progress = v8Clamp(localElapsed / V8_CELL_SPIN_MS);
    const eased = v8EaseInOutSine(progress);

    // One gentle rotation. Every clock uses the same curve; only the travel
    // delay changes across the wall, making the gust read as one linked field.
    const rotation = V8_ROTATION_DEG * eased;
    const starts = cell._v8StartAngles || [0, 180];

    v8DriveHand(cell._hands?.[0], (starts[0] || 0) + rotation);
    v8DriveHand(cell._hands?.[1], (starts[1] || 0) + rotation);

    cell._isActive = true;
    cell.classList.add('is-active');
    cell.classList.remove('is-inactive');
  });
}

function v8Resolve() {
  v8Resolving = true;
  const elapsed = performance.now() - v8Start;
  const remaining = Math.max(0, V8_DURATION_MS - elapsed);
  v8ResolveTarget = new Date(Date.now() + remaining);
  v8ApplyTime(v8ResolveTarget, true);
}

function v8Exit() {
  v8ApplyTime(new Date(), false);
  document.body.classList.remove('v8-installation');
  v8Cells().forEach(cell => {
    delete cell._v8Position;
    delete cell._v8StartAngles;
  });
  v8Active = false;
  v8Resolving = false;
  v8ResolveTarget = null;
}

function v8Tick() {
  const state = v8Window();

  if (state.active) {
    if (!v8Active) v8Enter(state.elapsed);
    const elapsed = V8_DEMO ? performance.now() - v8Start : state.elapsed;

    if (elapsed >= V8_RESOLVE_AT_MS) {
      if (!v8Resolving) v8Resolve();
      else if (v8ResolveTarget) v8ApplyTime(v8ResolveTarget, true);
    } else {
      v8Spin(elapsed);
    }
  } else if (v8Active) {
    v8Exit();
  }

  window.setTimeout(v8Tick, V8_TICK_MS);
}

window.setTimeout(v8Tick, 100);
