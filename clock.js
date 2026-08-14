'use strict';

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const TIME_ZONE = 'Australia/Melbourne';
const INFO_LOCATION = 'Melbourne, Australia';
const WEATHER_LOCATION = 'Docklands';

const params = new URLSearchParams(location.search);
const WEATHER_TEMP = params.get('temp') || '17.4°';
const WEATHER_TEXT = params.get('weather') || 'Weather placeholder';
const debugMode = params.get('debug') === '1';

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

const LETTER_PATTERNS = {
  A: ['010','101','111','101','101'],
  D: ['110','101','101','101','110'],
  E: ['111','100','110','100','111'],
  F: ['111','100','110','100','100'],
  H: ['101','101','111','101','101'],
  I: ['111','010','010','010','111'],
  L: ['100','100','100','100','111'],
  M: ['101','111','111','101','101'],
  N: ['101','111','111','111','101'],
  O: ['111','101','101','101','111'],
  R: ['110','101','110','101','101'],
  S: ['111','100','111','001','111'],
  T: ['111','010','010','010','010'],
  U: ['101','101','101','101','111'],
  W: ['101','101','101','111','101']
};

const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const DAY_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  weekday: 'short'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const stage = document.getElementById('stage');
const debug = document.getElementById('debug');
const currentDigits = ['', '', '', '', '', ''];
let currentDay = '';
let lastSecond = -1;

function fitStage() {
  const scale = Math.min(window.innerWidth / DISPLAY_W, window.innerHeight / DISPLAY_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  if (debugMode && debug) {
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
  for (let i = 0; i < 15; i++) {
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
  colon.append(...colon._cells);
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

function letterDirections(char, pattern, row, col) {
  const base = chooseDirections(pattern, row, col);
  if (!base) return null;

  if (char === 'M') {
    if (row === 0 && col === 0) return [180, 135];
    if (row === 0 && col === 2) return [180, 225];
    if (row === 1 && col === 1) return [315, 45];
  }
  if (char === 'W') {
    if (row === 3 && col === 0) return [0, 135];
    if (row === 3 && col === 2) return [0, 225];
    if (row === 3 && col === 1) return [315, 45];
  }
  if (char === 'R') {
    if (row === 2 && col === 1) return [270, 135];
    if (row === 3 && col === 2) return [315, 180];
  }
  return base;
}

function applyCellState(cell, dirs, immediate = false) {
  const active = !!dirs;
  cell.classList.toggle('is-active', active);
  cell.classList.toggle('is-inactive', !active);
  const target = active ? dirs : [0, 180];
  setHand(cell._hands[0], target[0], immediate);
  setHand(cell._hands[1], target[1], immediate);
}

function setPatternCells(cells, pattern, immediate = false, char = '') {
  let index = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const dirs = char ? letterDirections(char, pattern, row, col) : chooseDirections(pattern, row, col);
      applyCellState(cells[index], dirs, immediate);
      index += 1;
    }
  }
}

function setDigit(digitEl, value, immediate = false) {
  setPatternCells(digitEl._cells, DIGIT_PATTERNS[value], immediate);
}

function createMechanicalLetter(char) {
  const letter = document.createElement('div');
  letter.className = 'mechanical-letter';
  letter._cells = [];
  for (let i = 0; i < 15; i++) {
    const cell = createClockCell();
    letter._cells.push(cell);
    letter.appendChild(cell);
  }
  const pattern = LETTER_PATTERNS[char] || LETTER_PATTERNS.O;
  setPatternCells(letter._cells, pattern, true, char);
  return letter;
}

function renderMechanicalWord(container, word) {
  if (!container || container._word === word) return;
  container._word = word;
  container.replaceChildren();
  [...word].forEach((char) => container.appendChild(createMechanicalLetter(char)));
}

function setColon(colon, second, immediate = false) {
  const dirs = second % 2 === 0 ? [0, 180] : [90, 270];
  colon._cells.forEach((cell) => applyCellState(cell, dirs, immediate));
}

function getTimeParts() {
  const now = new Date();
  const timeParts = TIME_FORMATTER.formatToParts(now);
  const values = Object.create(null);
  for (const part of timeParts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    date: now,
    hh: values.hour.padStart(2, '0'),
    mm: values.minute.padStart(2, '0'),
    ss: values.second.padStart(2, '0'),
    day: DAY_FORMATTER.format(now).toUpperCase().slice(0, 3)
  };
}

function updateTopline(now) {
  const left = document.getElementById('topline-left');
  const right = document.getElementById('topline-right');
  if (left) left.innerHTML = `<strong>${now.hh}:${now.mm}:${now.ss}</strong> · ${DATE_FORMATTER.format(now.date)}`;
  if (right) right.innerHTML = `<strong>${INFO_LOCATION}</strong> · ${WEATHER_LOCATION} · ${WEATHER_TEMP} · ${WEATHER_TEXT}`;
}

function buildClockPage() {
  const digitEls = [];
  ['hours', 'minutes', 'seconds'].forEach((id) => {
    const group = document.getElementById(id);
    for (let i = 0; i < 2; i++) {
      const digit = createDigit();
      group.appendChild(digit);
      digitEls.push(digit);
    }
  });

  const colons = [];
  ['colon-1', 'colon-2'].forEach((id) => {
    const mount = document.getElementById(id);
    const colon = createColon();
    mount.replaceWith(colon);
    colons.push(colon);
  });

  const dayMount = document.getElementById('day-word');
  const locationMount = document.getElementById('location-word');
  if (locationMount) renderMechanicalWord(locationMount, 'MEL');

  function updateClock(force = false) {
    const now = getTimeParts();
    const six = `${now.hh}${now.mm}${now.ss}`;

    for (let i = 0; i < 6; i++) {
      if (force || currentDigits[i] !== six[i]) {
        currentDigits[i] = six[i];
        setDigit(digitEls[i], six[i], force);
      }
    }

    if (force || currentDay !== now.day) {
      currentDay = now.day;
      if (dayMount) renderMechanicalWord(dayMount, currentDay);
    }

    const second = Number(now.ss);
    if (force || second !== lastSecond) {
      lastSecond = second;
      colons.forEach((colon) => setColon(colon, second, force));
      updateTopline(now);
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
      currentDay = '';
      currentDigits.fill('');
      updateClock(false);
    }
  });
}

function buildLabPage() {
  const lab = document.getElementById('digit-lab');
  Object.keys(DIGIT_PATTERNS).forEach((value) => {
    const card = document.createElement('article');
    card.className = 'lab-card';
    const digit = createDigit();
    const label = document.createElement('div');
    label.className = 'lab-label';
    label.textContent = value;
    card.append(digit, label);
    lab.appendChild(card);
    setDigit(digit, value, true);
  });
}

function buildDaysPage() {
  const grid = document.getElementById('day-lab-grid');
  DAYS.forEach((day) => {
    const card = document.createElement('article');
    card.className = 'day-card';
    const word = document.createElement('div');
    word.className = 'mechanical-word';
    renderMechanicalWord(word, day);
    const label = document.createElement('div');
    label.className = 'day-card__label';
    label.textContent = day;
    card.append(word, label);
    grid.appendChild(card);
  });
}

switch (document.body.dataset.page) {
  case 'lab': buildLabPage(); break;
  case 'days': buildDaysPage(); break;
  default: buildClockPage();
}
