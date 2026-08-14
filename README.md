# Melbl8 Clock08 Mechanical

3840 × 804 mechanical ClockClock-style wall clock for the Melbourne gallery screen, built for GitHub Pages and Enplug on NVIDIA Shield.

## Live pages

- Circle version: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/
- Aurecon leaf version: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/leaf.html

The circle page is the current default Enplug candidate. The leaf page uses the existing Clock02 Aurecon leaf silhouette embedded directly in `style.css`, so there is no runtime dependency on another repository.

## Production goals

- Native 3840 × 804 layout
- Pure HTML, CSS and JavaScript
- No WebGL, framework, external font or continuous canvas render loop
- Fixed production stage with automatic viewport scaling for browser/mobile QC
- Explicit `Australia/Melbourne` timezone via `Intl.DateTimeFormat`
- Only clock digits that change animate
- `noindex`, `nofollow`, `noarchive` plus `robots.txt` disallow

## Layout

- Left: three-letter day abbreviation built from 3 × 5 mini mechanical clocks
- Centre: `HH MM SS`, each digit built from a 2 × 3 array of analogue clock modules
- Right: `MEL`, built from the same 3 × 5 mini-clock letterforms

The 3 × 5 side grid is intentional. A 3 × 3 alphabet is too ambiguous for reliable day/location reading at gallery distance.

## Query switches

- `?shape=leaf` or `?shape=circle`
- `?side=0` hides day/location experiments
- `?debug=1` shows viewport and scale information

## Enplug

Use the normal GitHub Pages URL as a Web Page App. No debug query string is required for production.
