# Melbl8 Clock08 Mechanical

3840 × 804 mechanical ClockClock-style wall clock prototype for the Melbourne gallery screen.

## Production goals
- GitHub Pages / HTTPS
- Enplug Web Page App on NVIDIA Shield
- Pure HTML/CSS/JavaScript
- No WebGL, no framework, no continuous canvas loop
- Fixed 3840 × 804 design canvas with automatic viewport scaling for mobile QC
- `noindex`, `nofollow`, `noarchive` and `robots.txt` disallow

## Pages
- `index.html` — circle modules
- `leaf.html` — Aurecon leaf modules using the existing Clock02 leaf silhouette as a CSS mask

## Query switches
- `?shape=leaf` or `?shape=circle`
- `?side=0` hides day/location experiments
- `?debug=1` shows viewport and scale data

## Layout
- Left: 3-letter day abbreviation drawn using 3 × 5 mini-clock letterforms
- Centre: `HH MM SS`, each digit built from a 2 × 3 array of analogue modules
- Right: `MEL`, drawn using the same 3 × 5 mini-clock letterforms

The 3 × 5 side grid is intentional. A 3 × 3 alphabet was tested conceptually but is too ambiguous for day/location text at gallery viewing distance.
