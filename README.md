# Melbl8 Clock08 Mechanical

3840 × 804 mechanical ClockClock-style wall clock for the Melbourne gallery screen, built for GitHub Pages and Enplug on NVIDIA Shield.

## Live pages

- Clock: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/
- 5 × 3 numeral lab: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/lab.html

## Current direction

- Pure `HH : MM : SS`
- No day or location labels
- Each numeral uses a 5 × 3 grid of analogue clock modules
- Active hands use Aurecon Green `#89C925`
- Parked/inactive hands use Aurecon Grey 2 `#4E5859`
- Background remains Aurecon Grey `#373A36`
- Parked mechanisms remain visible but visually recede
- Melbourne timezone is set explicitly with `Intl.DateTimeFormat`

## Production goals

- Native 3840 × 804 layout
- Pure HTML, CSS and JavaScript
- No WebGL, framework, external font or continuous canvas render loop
- Fixed production stage with automatic viewport scaling for browser/mobile QC
- Only digits that change animate each second
- `noindex`, `nofollow`, `noarchive` plus `robots.txt` disallow

## Numeral lab

Use `lab.html` to review all ten 5 × 3 numeral forms before further tuning the live clock.

## Debug

Add `?debug=1` to show viewport and scale information.

## Enplug

Use the normal GitHub Pages clock URL as a Web Page App. No debug query string is required for production.
