'use strict';

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const TIME_ZONE = 'Australia/Melbourne';
const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

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

const params = new URLSearchParams(location.search);
const debugMode = params.get('debug') === '1';

const stage = document.getElementById('stage');
const debug = document.getElementById('debug');
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
  for (let i = 0; i < 15; i++) {
    const cell = createClockCell();
    digit._cells.push(cell);
    digit.appendChild(cell);
  }
  return digit;
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

function applyCellState(cell, dirs, immediate = false) {
  const active = !!dirs;
  cell.classList.toggle('is-active', active);
  cell.classList.toggle('is-inactive', !active);
  const target = active ? dirs : [0, 180];
  setHand(cell._hands[0], target[0], immediate);
  setHand(cell._hands[1], target[1], immediate);
}

function setDigit(digitEl, value, immediate = false) {
  const pattern = DIGIT_PATTERNS[value];
  let index = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const dirs = chooseDirections(pattern, row, col);
      applyCellState(digitEl._cells[index], dirs, immediate);
      index += 1;
    }
  }
}

function animateColon(second) {
  const vertical = second % 2 === 0;
  document.querySelectorAll('.colon-hand').forEach((hand, i) => {
    const topBottomPhase = i % 2 === 0 ? 0 : 180;
    const angle = vertical ? topBottomPhase : 90 + topBottomPhase;
    hand.style.transform = `rotate(${angle - 90}deg)`;
    hand.style.opacity = vertical ? '0.96' : '0.72';
  });
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

  function updateClock(force = false) {
    const parts = TIME_FORMATTER.formatToParts(new Date());
    const values = Object.create(null);
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    const hh = values.hour.padStart(2, '0');
    const mm = values.minute.padStart(2, '0');
    const ss = values.second.padStart(2, '0');
    const six = `${hh}${mm}${ss}`;

    for (let i = 0; i < 6; i++) {
      if (force || currentDigits[i] !== six[i]) {
        currentDigits[i] = six[i];
        setDigit(digitEls[i], six[i], force);
      }
    }

    const second = Number(ss);
    if (force || second !== lastSecond) {
      lastSecond = second;
      animateColon(lastSecond);
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

if (document.body.dataset.page === 'lab') {
  buildLabPage();
} else {
  buildClockPage();
}
