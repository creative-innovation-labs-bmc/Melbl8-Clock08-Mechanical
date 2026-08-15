'use strict';

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const TIME_ZONE = 'Australia/Melbourne';
const WEATHER_LOCATION = 'Docklands';
const params = new URLSearchParams(location.search);
const WEATHER_TEMP = params.get('temp') || '17.4°';
const WEATHER_TEXT = params.get('weather') || 'Weather placeholder';
const debugMode = params.get('debug') === '1';
const DEMO_MODE = params.get('demo') === '1';
const GUST_DIRECTION = ['ltr', 'rtl', 'ttb', 'btt'].includes(params.get('dir')) ? params.get('dir') : 'ltr';

const WIND_TICK_MS = 350;
const WIND_TURN_MS = 1300;
const ACTIVE_TURN_MS = 760;

const EVENT_DURATION_MS = 10000;
const EVENT_GUST_TRAVEL_MS = 1300;
const EVENT_SPIN_MS = 5800;
const EVENT_OUTRO_AT_MS = 7200;
const EVENT_OUTRO_TRAVEL_MS = 1300;
const EVENT_OUTRO_CELL_MS = 1400;
const EVENT_DRIVE_MS = 180;
const EVENT_ROTATION_DEG = 360;
const EVENT_TICK_MS = 90;
const DEMO_START = performance.now();

const DIGIT_PATTERNS = {
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

const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

const stage = document.getElementById('stage');
const debug = document.getElementById('debug');
const edgeLeft = document.getElementById('edge-left');
const edgeRight = document.getElementById('edge-right');
const currentDigits = ['', '', '', '', '', ''];
const windCells = [];
const digitEls = [];
const colonEls = [];
let lastSecond = -1;
let lastWindAt = 0;
let eventActive = false;
let eventStartPerf = 0;
let eventTargetDate = null;

function fitStage() {
  const scale = Math.min(window.innerWidth / DISPLAY_W, window.innerHeight / DISPLAY_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  if (debugMode) {
    debug.hidden = false;
    debug.textContent = `${window.innerWidth}x${window.innerHeight} | scale ${scale.toFixed(4)} | V8 standalone linked gust`;
  }
}
window.addEventListener('resize', fitStage, { passive: true });
fitStage();

function makeHandState(el) {
  return { el, angle: Math.random() * 360 - 180, ready: false };
}

function setTurnDuration(hand, ms) {
  hand.el.style.transitionDuration = `${ms}ms, 260ms, 260ms`;
}

function createClockCell(x = 0, y = 0, canDrift = true) {
  const cell = document.createElement('div');
  cell.className = 'clock-cell is-inactive';
  const handA = document.createElement('i');
  const handB = document.createElement('i');
  handA.className = 'hand hand-a';
  handB.className = 'hand hand-b';
  cell.append(handA, handB);
  cell._hands = [makeHandState(handA), makeHandState(handB)];
  cell._normalActive = false;
  cell._canDrift = canDrift;
  cell._windX = x;
  cell._windY = y;
  cell._windPhase = Math.random() * Math.PI * 2;
  if (canDrift) windCells.push(cell);
  return cell;
}

function createDigit(digitOrdinal) {
  const digit = document.createElement('div');
  digit.className = 'digit';
  digit._cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const x = digitOrdinal * 4.2 + col;
      const cell = createClockCell(x, row, true);
      digit._cells.push(cell);
      digit.appendChild(cell);
    }
  }
  return digit;
}

function createColon() {
  const colon = document.createElement('div');
  colon.className = 'colon';
  colon._cells = [createClockCell(0, 1, false), createClockCell(0, 3, false)];
  colon._cells.forEach(cell => colon.appendChild(cell));
  return colon;
}

function toCssAngle(clockAngle) { return clockAngle - 90; }
function normaliseDelta(delta) { return ((delta + 540) % 360) - 180; }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function setHand(hand, targetClockAngle, immediate = false) {
  const target = toCssAngle(targetClockAngle);
  if (!hand.ready) {
    hand.el.style.transition = 'none';
    hand.el.style.transform = `rotate(${hand.angle}deg)`;
    hand.el.offsetWidth;
    hand.el.style.transition = '';
    hand.ready = true;
  }
  if (immediate) {
    hand.angle = target;
    hand.el.style.transition = 'none';
    hand.el.style.transform = `rotate(${hand.angle}deg)`;
    hand.el.offsetWidth;
    hand.el.style.transition = '';
    return;
  }
  const delta = normaliseDelta(target - hand.angle);
  hand.angle += delta;
  hand.el.style.transform = `rotate(${hand.angle}deg)`;
}

function driveHandAbsolute(hand, cssAngle) {
  if (!hand) return;
  hand.ready = true;
  hand.angle = cssAngle;
  setTurnDuration(hand, EVENT_DRIVE_MS);
  hand.el.style.transform = `rotate(${cssAngle}deg)`;
}

function isOn(pattern, row, col) {
  return row >= 0 && row < 5 && col >= 0 && col < 3 && pattern[row][col] === '1';
}

function chooseDirections(pattern, row, col) {
  if (!isOn(pattern, row, col)) return null;
  const dirs = [];
  if (isOn(pattern, row - 1, col)) dirs.push(0);
  if (isOn(pattern, row, col + 1)) dirs.push(90);
  if (isOn(pattern, row + 1, col)) dirs.push(180);
  if (isOn(pattern, row, col - 1)) dirs.push(270);
  if (dirs.length === 0) return [0, 180];
  if (dirs.length === 1) return [dirs[0], dirs[0]];
  if (dirs.length === 2) return dirs;
  const hasVertical = dirs.includes(0) && dirs.includes(180);
  const hasHorizontal = dirs.includes(90) && dirs.includes(270);
  if (hasVertical && !hasHorizontal) return [0, 180];
  if (hasHorizontal && !hasVertical) return [90, 270];
  if (dirs.includes(0) && dirs.includes(90)) return [0, 90];
  if (dirs.includes(90) && dirs.includes(180)) return [90, 180];
  if (dirs.includes(180) && dirs.includes(270)) return [180, 270];
  if (dirs.includes(270) && dirs.includes(0)) return [270, 0];
  return [dirs[0], dirs[1]];
}

function normalWindAngle(cell, seconds) {
  const drift = seconds * 3.6;
  const broadWave = 26 * Math.sin(seconds * 0.68 - cell._windX * 0.30);
  const crossWave = 8 * Math.sin(seconds * 1.04 + cell._windY * 0.68 + cell._windPhase);
  const gustEnvelope = Math.pow((Math.sin(seconds * 0.34 - cell._windX * 0.10) + 1) * 0.5, 2);
  const travellingGust = 34 * gustEnvelope * Math.sin(seconds * 1.56 - cell._windX * 0.48);
  return drift + broadWave + crossWave + travellingGust;
}

function moveInactiveWithNormalWind(cell, immediate = false) {
  if (!cell._canDrift || cell._normalActive) return;
  const axis = normalWindAngle(cell, performance.now() / 1000);
  setTurnDuration(cell._hands[0], WIND_TURN_MS);
  setTurnDuration(cell._hands[1], WIND_TURN_MS + 200);
  setHand(cell._hands[0], axis, immediate);
  setHand(cell._hands[1], axis + 180, immediate);
  if (immediate) {
    setTurnDuration(cell._hands[0], WIND_TURN_MS);
    setTurnDuration(cell._hands[1], WIND_TURN_MS + 200);
  }
}

function applyNormalCell(cell, dirs, immediate = false) {
  const active = !!dirs;
  cell._normalActive = active;
  cell.classList.toggle('is-active', active);
  cell.classList.toggle('is-inactive', !active);
  if (active) {
    setTurnDuration(cell._hands[0], ACTIVE_TURN_MS);
    setTurnDuration(cell._hands[1], ACTIVE_TURN_MS);
    setHand(cell._hands[0], dirs[0], immediate);
    setHand(cell._hands[1], dirs[1], immediate);
    if (immediate) {
      setTurnDuration(cell._hands[0], ACTIVE_TURN_MS);
      setTurnDuration(cell._hands[1], ACTIVE_TURN_MS);
    }
  } else if (cell._canDrift) {
    moveInactiveWithNormalWind(cell, immediate);
  } else {
    setTurnDuration(cell._hands[0], ACTIVE_TURN_MS);
    setTurnDuration(cell._hands[1], ACTIVE_TURN_MS);
    setHand(cell._hands[0], 0, immediate);
    setHand(cell._hands[1], 180, immediate);
  }
}

function setDigit(digitEl, value, immediate = false) {
  const pattern = DIGIT_PATTERNS[value];
  let index = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      applyNormalCell(digitEl._cells[index], chooseDirections(pattern, row, col), immediate);
      index += 1;
    }
  }
}

function setColon(colonEl, second, immediate = false) {
  const pair = second % 2 === 0 ? [0, 180] : [90, 270];
  colonEl._cells.forEach(cell => applyNormalCell(cell, pair, immediate));
}

function getTimeParts(date = new Date()) {
  const values = Object.create(null);
  for (const part of TIME_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    hh: values.hour.padStart(2, '0'),
    mm: values.minute.padStart(2, '0'),
    ss: values.second.padStart(2, '0')
  };
}

function updateEdgeText(now) {
  edgeLeft.textContent = `${now.hh}:${now.mm}:${now.ss} · ${DATE_FORMATTER.format(new Date())}`;
  edgeRight.textContent = `${WEATHER_LOCATION} · ${WEATHER_TEMP} · ${WEATHER_TEXT}`;
}

function updateNormalClock(force = false) {
  const now = getTimeParts();
  const six = `${now.hh}${now.mm}${now.ss}`;
  for (let i = 0; i < 6; i++) {
    if (force || currentDigits[i] !== six[i]) {
      currentDigits[i] = six[i];
      setDigit(digitEls[i], six[i], force);
    }
  }
  const second = Number(now.ss);
  if (force || second !== lastSecond) {
    lastSecond = second;
    colonEls.forEach(colon => setColon(colon, second, force));
    updateEdgeText(now);
  }
}

function updateNormalWind() {
  for (const cell of windCells) {
    if (!cell._normalActive) moveInactiveWithNormalWind(cell, false);
  }
}

function eventWindow() {
  if (DEMO_MODE) {
    const elapsed = performance.now() - DEMO_START;
    return { active: elapsed < EVENT_DURATION_MS, elapsed };
  }
  const now = getTimeParts();
  const second = Number(now.ss);
  const active = Number(now.mm) % 5 === 0 && second < 10;
  return {
    active,
    elapsed: second * 1000 + (Date.now() % 1000)
  };
}

function directionPosition(nx, ny) {
  if (GUST_DIRECTION === 'rtl') return 1 - nx;
  if (GUST_DIRECTION === 'ttb') return ny;
  if (GUST_DIRECTION === 'btt') return 1 - ny;
  return nx;
}

function allCells() {
  return Array.from(document.querySelectorAll('.clock-cell'));
}

function forwardEquivalent(fromAngle, targetCssAngle) {
  let target = targetCssAngle;
  while (target < fromAngle) target += 360;
  return target;
}

function targetForTime(date) {
  const now = getTimeParts(date);
  const six = `${now.hh}${now.mm}${now.ss}`;
  const targets = new Map();

  digitEls.forEach((digit, digitIndex) => {
    const pattern = DIGIT_PATTERNS[six[digitIndex]];
    let index = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const dirs = chooseDirections(pattern, row, col);
        targets.set(digit._cells[index], { dirs: dirs || [0, 180], active: !!dirs });
        index += 1;
      }
    }
  });

  const pair = Number(now.ss) % 2 === 0 ? [0, 180] : [90, 270];
  colonEls.forEach(colon => {
    colon._cells.forEach(cell => targets.set(cell, { dirs: pair, active: true }));
  });
  return targets;
}

function prepareEvent(elapsed) {
  eventActive = true;
  eventStartPerf = performance.now() - elapsed;
  eventTargetDate = new Date(Date.now() + Math.max(0, EVENT_DURATION_MS - elapsed));
  document.body.classList.add('v8-installation');

  const cells = allCells();
  const targetMap = targetForTime(eventTargetDate);
  const centres = cells.map(cell => {
    const rect = cell.getBoundingClientRect();
    return { cell, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  const xs = centres.map(item => item.x);
  const ys = centres.map(item => item.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);

  centres.forEach(({ cell, x, y }) => {
    const nx = (x - minX) / spanX;
    const ny = (y - minY) / spanY;
    const position = clamp(directionPosition(nx, ny));
    const delay = position * EVENT_GUST_TRAVEL_MS;
    const progressAtEntry = clamp((elapsed - delay) / EVENT_SPIN_MS);
    const rotationAtEntry = EVENT_ROTATION_DEG * easeInOutSine(progressAtEntry);

    cell._v8Position = position;
    cell._v8StartAngles = cell._hands.map(hand => (Number.isFinite(hand.angle) ? hand.angle : 0) - rotationAtEntry);
    cell._v8SpinEndAngles = cell._v8StartAngles.map(angle => angle + EVENT_ROTATION_DEG);
    const target = targetMap.get(cell) || { dirs: [0, 180], active: false };
    cell._v8Target = target;
    cell._v8TargetAngles = target.dirs.map((clockAngle, i) =>
      forwardEquivalent(cell._v8SpinEndAngles[i], toCssAngle(clockAngle))
    );
  });
}

function setEventColour(cell, green) {
  cell.classList.toggle('is-active', green);
  cell.classList.toggle('is-inactive', !green);
}

function driveEvent(elapsed) {
  for (const cell of allCells()) {
    const position = cell._v8Position || 0;
    const gustDelay = position * EVENT_GUST_TRAVEL_MS;
    const spinProgress = clamp((elapsed - gustDelay) / EVENT_SPIN_MS);

    if (elapsed < EVENT_OUTRO_AT_MS) {
      const gustHasArrived = elapsed >= gustDelay;
      setEventColour(cell, gustHasArrived ? true : cell._normalActive);

      if (gustHasArrived) {
        const rotation = EVENT_ROTATION_DEG * easeInOutSine(spinProgress);
        driveHandAbsolute(cell._hands[0], cell._v8StartAngles[0] + rotation);
        driveHandAbsolute(cell._hands[1], cell._v8StartAngles[1] + rotation);
      }
      continue;
    }

    const outroDelay = position * EVENT_OUTRO_TRAVEL_MS;
    const localOutro = elapsed - EVENT_OUTRO_AT_MS - outroDelay;
    const outroProgress = clamp(localOutro / EVENT_OUTRO_CELL_MS);

    if (localOutro < 0) {
      driveHandAbsolute(cell._hands[0], cell._v8SpinEndAngles[0]);
      driveHandAbsolute(cell._hands[1], cell._v8SpinEndAngles[1]);
      setEventColour(cell, true);
      continue;
    }

    const eased = easeOutCubic(outroProgress);
    driveHandAbsolute(
      cell._hands[0],
      cell._v8SpinEndAngles[0] + (cell._v8TargetAngles[0] - cell._v8SpinEndAngles[0]) * eased
    );
    driveHandAbsolute(
      cell._hands[1],
      cell._v8SpinEndAngles[1] + (cell._v8TargetAngles[1] - cell._v8SpinEndAngles[1]) * eased
    );

    if (outroProgress >= 0.48) {
      setEventColour(cell, cell._v8Target.active);
    } else {
      setEventColour(cell, true);
    }
  }
}

function finishEvent() {
  document.body.classList.remove('v8-installation');
  for (const cell of allCells()) {
    delete cell._v8Position;
    delete cell._v8StartAngles;
    delete cell._v8SpinEndAngles;
    delete cell._v8Target;
    delete cell._v8TargetAngles;
  }
  eventActive = false;
  eventTargetDate = null;
  currentDigits.fill('');
  lastSecond = -1;
  updateNormalClock(false);
  updateNormalWind();
  lastWindAt = performance.now();
}

function buildClock() {
  ['hours', 'minutes', 'seconds'].forEach((id, block) => {
    const group = document.getElementById(id);
    for (let i = 0; i < 2; i++) {
      const digit = createDigit(block * 2 + i);
      group.appendChild(digit);
      digitEls.push(digit);
    }
  });

  ['colon-1', 'colon-2'].forEach(id => {
    const mount = document.getElementById(id);
    const colon = createColon();
    mount.replaceWith(colon);
    colonEls.push(colon);
  });

  updateNormalClock(true);
  updateNormalWind();
  lastWindAt = performance.now();
}

function mainLoop() {
  if (document.hidden) {
    window.setTimeout(mainLoop, EVENT_TICK_MS);
    return;
  }

  const windowState = eventWindow();

  if (windowState.active) {
    if (!eventActive) prepareEvent(windowState.elapsed);
    const elapsed = DEMO_MODE ? performance.now() - eventStartPerf : windowState.elapsed;
    driveEvent(elapsed);
    const now = getTimeParts();
    if (Number(now.ss) !== lastSecond) {
      lastSecond = Number(now.ss);
      updateEdgeText(now);
    }
  } else {
    if (eventActive) finishEvent();
    updateNormalClock(false);
    const perf = performance.now();
    if (perf - lastWindAt >= WIND_TICK_MS) {
      updateNormalWind();
      lastWindAt = perf;
    }
  }

  window.setTimeout(mainLoop, EVENT_TICK_MS);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !eventActive) {
    currentDigits.fill('');
    lastSecond = -1;
    updateNormalClock(false);
    updateNormalWind();
    lastWindAt = performance.now();
  }
});

buildClock();
window.setTimeout(mainLoop, 100);
