'use strict';

/*
  Melbl8 Clock08 Mechanical prototype
  -----------------------------------
  - Fixed production canvas: 3840 x 804
  - Pure HTML/CSS/JS, no framework, no WebGL, no canvas loop
  - Each main digit = 2 x 3 analogue-clock modules, two hands per module
  - Side labels = 3 x 5 mini-clock letterforms
  - Only changed digits animate
  - Resynchronises to the wall clock every second
  - Circle and Aurecon-leaf variants share the same code
  - Designed for GitHub Pages + Enplug Web Page App / NVIDIA Shield
*/

const DISPLAY_W = 3840;
const DISPLAY_H = 804;
const LOCATION = 'MEL';
const TIME_ZONE = 'Australia/Melbourne';

const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

// 0° = 12 o'clock, 90° = 3 o'clock, 180° = 6 o'clock, 270° = 9 o'clock.
// Each row contains six clock cells in row-major order, two hand angles per cell.
// The mapping follows the established ClockClock 2x3 construction.
const DIGIT_ANGLES = [
  [270,180,   0,180,   270,0,   90,180,   0,180,   90,0],   // 0
  [180,180,   0,180,   0,0,     225,225,  225,225,  225,225],// 1
  [270,180,   270,0,   270,270, 90,90,    90,180,   90,0],   // 2
  [270,180,   0,180,   270,0,   90,90,    90,90,    90,90],  // 3
  [180,180,   0,180,   0,0,     180,180,  90,0,     225,225],// 4
  [270,270,   270,180, 270,0,   90,180,   90,0,     90,90],  // 5
  [270,270,   270,180, 270,0,   90,180,   0,180,    90,0],   // 6
  [270,180,   0,180,   0,0,     90,90,    225,225,  225,225],// 7
  [270,180,   270,0,   0,270,   90,180,   90,0,     0,90],   // 8
  [270,180,   0,180,   0,0,     90,180,   90,0,     225,225] // 9
];

// Compact 3x5 dot-matrix glyphs. Hands connect neighbouring active cells to turn
// the matrix into a line drawing rather than a glowing pixel font.
const GLYPHS = {
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

const params = new URLSearchParams(location.search);
if (params.has('shape')) {
  document.documentElement.dataset.shape = params.get('shape') === 'leaf' ? 'leaf' : 'circle';
}

const showSides = params.get('side') !== '0';
const debugMode = params.get('debug') === '1';
if (!showSides) {
  document.querySelectorAll('.side-panel').forEach(el => { el.style.display = 'none'; });
  document.getElementById('time-panel').style.left = '0';
  document.getElementById('time-panel').style.width = '3840px';
}

const stage = document.getElementById('stage');
const debug = document.getElementById('debug');
const currentDigits = ['', '', '', '', '', ''];
let currentDay = '';
let currentLocation = '';
let lastSecond = -1;
let colonPhase = 0;

function fitStage() {
  const scale = Math.min(window.innerWidth / DISPLAY_W, window.innerHeight / DISPLAY_H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  if (debugMode) {
    debug.hidden = false;
    debug.textContent = `${window.innerWidth}x${window.innerHeight} | scale ${scale.toFixed(4)} | ${document.documentElement.dataset.shape}`;
  }
}
window.addEventListener('resize', fitStage, { passive: true });
fitStage();

function createClockCell(extraClass = '') {
  const cell = document.createElement('div');
  cell.className = `clock-cell${extraClass ? ` ${extraClass}` : ''}`;
  const handA = document.createElement('i');
  const handB = document.createElement('i');
  handA.className = 'hand hand-a';
  handB.className = 'hand hand-b';
  cell.append(handA, handB);
  cell._hands = [makeHandState(handA), makeHandState(handB)];
  return cell;
}

function makeHandState(el) {
  return { el, angle: Math.random() * 360 - 180, ready: false };
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
    hand.angle = Math.random() * 360 - 180;
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

function buildDigit(container) {
  const digit = document.createElement('div');
  digit.className = 'digit';
  digit._cells = [];
  for (let i = 0; i < 6; i++) {
    const cell = createClockCell();
    digit._cells.push(cell);
    digit.appendChild(cell);
  }
  container.appendChild(digit);
  return digit;
}

const digitEls = [];
['hours', 'minutes', 'seconds'].forEach(id => {
  const container = document.getElementById(id);
  digitEls.push(buildDigit(container));
  digitEls.push(buildDigit(container));
});

function setDigit(index, value, immediate = false) {
  if (!immediate && currentDigits[index] === value) return;
  currentDigits[index] = value;
  const map = DIGIT_ANGLES[Number(value)];
  const digit = digitEls[index];
  for (let cellIndex = 0; cellIndex < 6; cellIndex++) {
    const cell = digit._cells[cellIndex];
    setHand(cell._hands[0], map[cellIndex * 2], immediate);
    setHand(cell._hands[1], map[cellIndex * 2 + 1], immediate);
  }
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

  if (dirs.length === 0) return [0, 0];
  if (dirs.length === 1) return [dirs[0], dirs[0]];
  if (dirs.length === 2) return dirs;

  // Junctions can ask for three or four connections but an analogue module has
  // two hands. Keep the strongest axis pair. This is deliberate: side text is
  // a line-art abbreviation, not a conventional font.
  const hasVertical = dirs.includes(0) && dirs.includes(180);
  const hasHorizontal = dirs.includes(90) && dirs.includes(270);
  if (hasVertical) return [0, 180];
  if (hasHorizontal) return [90, 270];
  return [dirs[0], dirs[1]];
}

function buildLetter(char) {
  const pattern = GLYPHS[char] || GLYPHS.O;
  const letter = document.createElement('div');
  letter.className = 'matrix-letter';
  letter._cells = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const dirs = chooseDirections(pattern, row, col);
      const cell = createClockCell(dirs ? '' : 'is-off');
      cell._dirs = dirs;
      letter._cells.push(cell);
      letter.appendChild(cell);
    }
  }
  return letter;
}

function setWord(container, word, immediate = false) {
  if (container._word === word && !immediate) return;
  container._word = word;
  container.replaceChildren();

  [...word].forEach((char, charIndex) => {
    const letter = buildLetter(char);
    container.appendChild(letter);
    requestAnimationFrame(() => {
      letter._cells.forEach((cell, cellIndex) => {
        if (!cell._dirs) return;
        const delay = (charIndex * 15 + cellIndex) * 7;
        setTimeout(() => {
          setHand(cell._hands[0], cell._dirs[0], immediate);
          setHand(cell._hands[1], cell._dirs[1], immediate);
        }, immediate ? 0 : delay);
      });
    });
  });
}

function animateColon(second) {
  colonPhase = second % 2;
  const base = colonPhase ? 0 : 90;
  document.querySelectorAll('.colon-hand').forEach((hand, i) => {
    hand.style.transform = `rotate(${base + (i % 2 ? 180 : 0)}deg)`;
    hand.style.opacity = colonPhase ? '.95' : '.62';
  });
}

function getMelbourneTime() {
  const parts = TIME_FORMATTER.formatToParts(new Date());
  const values = Object.create(null);
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    hh: values.hour.padStart(2, '0'),
    mm: values.minute.padStart(2, '0'),
    ss: values.second.padStart(2, '0'),
    day: values.weekday.toUpperCase().slice(0, 3)
  };
}

function updateClock(force = false) {
  const now = getMelbourneTime();
  const six = `${now.hh}${now.mm}${now.ss}`;

  for (let i = 0; i < 6; i++) setDigit(i, six[i], force);

  const second = Number(now.ss);
  if (force || second !== lastSecond) {
    lastSecond = second;
    animateColon(lastSecond);
  }

  const day = now.day;
  if (force || day !== currentDay) {
    currentDay = day;
    setWord(document.getElementById('day-word'), day, force);
  }

  if (force || LOCATION !== currentLocation) {
    currentLocation = LOCATION;
    setWord(document.getElementById('location-word'), LOCATION, force);
  }
}

function scheduleNextTick() {
  updateClock(false);
  const delay = 1010 - (Date.now() % 1000);
  window.setTimeout(scheduleNextTick, Math.max(80, delay));
}

// Paint from random mechanical positions into the current time once on load.
updateClock(false);
window.setTimeout(scheduleNextTick, 1010 - (Date.now() % 1000));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastSecond = -1;
    currentDigits.fill('');
    updateClock(false);
  }
});
