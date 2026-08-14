'use strict';

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const TIME_ZONE = 'Australia/Melbourne';
const INFO_LOCATION = 'Melbourne, Australia';
const WEATHER_LOCATION = 'Docklands';
const WEATHER_TEMP = new URLSearchParams(location.search).get('temp') || '17.4°';
const WEATHER_TEXT = new URLSearchParams(location.search).get('weather') || 'Weather placeholder';

const DIGIT_ANGLES = [
  [270,180,   0,180,   270,0,   90,180,   0,180,   90,0],
  [180,180,   0,180,   0,0,     225,225,  225,225, 225,225],
  [270,180,   270,0,   270,270, 90,90,    90,180,  90,0],
  [270,180,   0,180,   270,0,   90,90,    90,90,   90,90],
  [180,180,   0,180,   0,0,     180,180,  90,0,    225,225],
  [270,270,   270,180, 270,0,   90,180,   90,0,    90,90],
  [270,270,   270,180, 270,0,   90,180,   0,180,   90,0],
  [270,180,   0,180,   0,0,     90,90,    225,225, 225,225],
  [270,180,   270,0,   0,270,   90,180,   90,0,    0,90],
  [270,180,   0,180,   0,0,     90,180,   90,0,    225,225]
];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const params = new URLSearchParams(location.search);
const debugMode = params.get('debug') === '1';

const stage = document.getElementById('stage');
const debug = document.getElementById('debug');
const edgeLeft = document.getElementById('edge-left');
const edgeRight = document.getElementById('edge-right');
const currentDigits = ['', '', '', '', '', ''];
let lastSecond = -1;

function fitStage() {
  const scale = Math.min(window.innerWidth / DISPLAY_W, window.innerHeight / DISPLAY_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  if (debugMode) {
    debug.hidden = false;
    debug.textContent = `${window.innerWidth}x${window.innerHeight} | scale ${scale.toFixed(4)}`;
  }
}
window.addEventListener('resize', fitStage, { passive: true });
fitStage();

function makeHandState(el) {
  return { el, angle: Math.random() * 360 - 180, ready: false };
}

function createClockCell() {
  const cell = document.createElement('div');
  cell.className = 'clock-cell is-inactive';
  const handA = document.createElement('i');
  const handB = document.createElement('i');
  handA.className = 'hand hand-a';
  handB.className = 'hand hand-b';
  cell.append(handA, handB);
  cell._hands = [makeHandState(handA), makeHandState(handB)];
  return cell;
}

function createDigit() {
  const digit = document.createElement('div');
  digit.className = 'digit';
  digit._cells = [];
  for (let i = 0; i < 6; i++) {
    const cell = createClockCell();
    digit._cells.push(cell);
    digit.appendChild(cell);
  }
  return digit;
}

function createColon() {
  const colon = document.createElement('div');
  colon.className = 'colon';
  colon._cells = [createClockCell(), createClockCell()];
  colon._cells.forEach(cell => colon.appendChild(cell));
  return colon;
}

function toCssAngle(clockAngle) {
  return clockAngle - 90;
}

function normaliseDelta(delta) {
  return ((delta + 540) % 360) - 180;
}

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

function setCellState(cell, angles, immediate = false) {
  const active = !!angles;
  cell.classList.toggle('is-active', active);
  cell.classList.toggle('is-inactive', !active);
  const target = active ? angles : [0, 180];
  setHand(cell._hands[0], target[0], immediate);
  setHand(cell._hands[1], target[1], immediate);
}

function setDigit(digitEl, value, immediate = false) {
  const map = DIGIT_ANGLES[Number(value)];
  for (let cellIndex = 0; cellIndex < 6; cellIndex++) {
    setCellState(digitEl._cells[cellIndex], [map[cellIndex * 2], map[cellIndex * 2 + 1]], immediate);
  }
}

function setColon(colonEl, second, immediate = false) {
  const vertical = second % 2 === 0;
  const pair = vertical ? [0, 180] : [90, 270];
  colonEl._cells.forEach(cell => setCellState(cell, pair, immediate));
}

function getTimeParts() {
  const timeParts = TIME_FORMATTER.formatToParts(new Date());
  const values = Object.create(null);
  for (const part of timeParts) {
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
  edgeRight.textContent = `${INFO_LOCATION} · ${WEATHER_LOCATION} · ${WEATHER_TEMP} · ${WEATHER_TEXT}`;
}

function buildClockPage() {
  const digitEls = [];
  ['hours', 'minutes', 'seconds'].forEach(id => {
    const group = document.getElementById(id);
    for (let i = 0; i < 2; i++) {
      const digit = createDigit();
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

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastSecond = -1;
      currentDigits.fill('');
      updateClock(false);
    }
  });
}

buildClockPage();
