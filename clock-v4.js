'use strict';

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const TIME_ZONE = 'Australia/Melbourne';
const WEATHER_LOCATION = 'Docklands';
const params = new URLSearchParams(location.search);
const WEATHER_TEMP = params.get('temp') || '17.4°';
const WEATHER_TEXT = params.get('weather') || 'Weather placeholder';
const debugMode = params.get('debug') === '1';

const WIND_TICK_MS = 1400;
const WIND_TURN_MS = 5200;
const ACTIVE_TURN_MS = 760;

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
let lastSecond = -1;

function fitStage() {
  const scale = Math.min(window.innerWidth / DISPLAY_W, window.innerHeight / DISPLAY_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  if (debugMode) {
    debug.hidden = false;
    debug.textContent = `${window.innerWidth}x${window.innerHeight} | scale ${scale.toFixed(4)} | V4 wind`;
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
  cell._isActive = false;
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
  colon._cells = [createClockCell(0, 0, false), createClockCell(0, 0, false)];
  colon._cells.forEach(cell => colon.appendChild(cell));
  return colon;
}

function toCssAngle(clockAngle) { return clockAngle - 90; }
function normaliseDelta(delta) { return ((delta + 540) % 360) - 180; }

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

function windAngle(cell, seconds) {
  const drift = seconds * 1.25;
  const broadWave = 22 * Math.sin(seconds * 0.22 - cell._windX * 0.34);
  const crossWave = 9 * Math.sin(seconds * 0.31 + cell._windY * 0.72 + cell._windPhase);
  const longGust = 7 * Math.sin(seconds * 0.075 + cell._windX * 0.12);
  return drift + broadWave + crossWave + longGust;
}

function moveInactiveCellWithWind(cell, immediate = false) {
  if (!cell._canDrift || cell._isActive) return;
  const seconds = performance.now() / 1000;
  const axis = windAngle(cell, seconds);
  setTurnDuration(cell._hands[0], WIND_TURN_MS);
  setTurnDuration(cell._hands[1], WIND_TURN_MS + 400);
  setHand(cell._hands[0], axis, immediate);
  setHand(cell._hands[1], axis + 180, immediate);
  if (immediate) {
    setTurnDuration(cell._hands[0], WIND_TURN_MS);
    setTurnDuration(cell._hands[1], WIND_TURN_MS + 400);
  }
}

function applyCellState(cell, dirs, immediate = false) {
  const active = !!dirs;
  cell._isActive = active;
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
    moveInactiveCellWithWind(cell, immediate);
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
      applyCellState(digitEl._cells[index], chooseDirections(pattern, row, col), immediate);
      index += 1;
    }
  }
}

function setColon(colonEl, second, immediate = false) {
  const pair = second % 2 === 0 ? [0, 180] : [90, 270];
  colonEl._cells.forEach(cell => applyCellState(cell, pair, immediate));
}

function updateWind() {
  if (document.hidden) return;
  for (const cell of windCells) moveInactiveCellWithWind(cell, false);
}

function getTimeParts() {
  const timeParts = TIME_FORMATTER.formatToParts(new Date());
  const values = Object.create(null);
  for (const part of timeParts) if (part.type !== 'literal') values[part.type] = part.value;
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

function buildClockPage() {
  const digitEls = [];
  let digitOrdinal = 0;
  ['hours', 'minutes', 'seconds'].forEach(id => {
    const group = document.getElementById(id);
    for (let i = 0; i < 2; i++) {
      const digit = createDigit(digitOrdinal++);
      group.appendChild(digit);
      digitEls.push(digit);
    }
  });

  const colons = [];
  ['colon-1', 'colon-2'].forEach(id => {
    const mount = document.getElementById(id);
    const colon = createColon();
    mount.replaceWith(colon);
    colons.push(colon);
  });

  function updateClock(force = false) {
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
      colons.forEach(colon => setColon(colon, second, force));
      updateEdgeText(now);
    }
  }

  function scheduleNextTick() {
    updateClock(false);
    const delay = 1010 - (Date.now() % 1000);
    window.setTimeout(scheduleNextTick, Math.max(80, delay));
  }

  updateClock(true);
  window.setTimeout(scheduleNextTick, 1010 - (Date.now() % 1000));
  window.setInterval(updateWind, WIND_TICK_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastSecond = -1;
      currentDigits.fill('');
      updateClock(false);
      updateWind();
    }
  });
}

buildClockPage();
