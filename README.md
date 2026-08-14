# Melbl8 Clock08 Mechanical

3840 × 804 mechanical ClockClock-style wall clock for the Melbourne gallery screen, built for GitHub Pages and Enplug on NVIDIA Shield.

## Live pages

- Default / V2: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/
- V1, mechanical day on left: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/v1.html
- V2, mechanical day left + MEL right: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/v2.html
- 3 × 5 day-letter lab: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/days.html
- 5 × 3 numeral lab: https://creative-innovation-labs-bmc.github.io/Melbl8-Clock08-Mechanical/lab.html

## Current direction

- Main time uses 5 × 3 mechanical numerals
- V1 adds a three-letter mechanical day abbreviation on the left
- V2 adds the same day abbreviation on the left and `MEL` on the right
- Day/location letters use 3 × 5 mini mechanical grids
- `M`, `W` and `R` have custom hand directions to improve their shapes
- Colon separators now use only two real full-size circles, aligned to the main 5-row grid
- Hub dots are independently centred at the exact clock pivot
- Main hands are thicker for improved legibility
- Active hands use Aurecon Green `#89C925`
- Parked/inactive hands use Aurecon Grey 2 `#4E5859`
- Hub uses Aurecon grey `#8E9C9C`
- Background remains Aurecon Grey `#373A36`
- Top metadata is a single Open Sans line, split left/right across the 3840 stage
- Open Sans is sourced from the approved `Melbl8-Clock03-Split-flap-Open-Sans` repository
- Melbourne timezone is set explicitly with `Intl.DateTimeFormat`

## Top metadata

Left: current time and full date.

Right: Melbourne/location/weather line. Weather values are currently layout placeholders and can be overridden with `?temp=` and `?weather=` while the live weather feed is wired in.

## Production goals

- Native 3840 × 804 layout
- Pure HTML, CSS and JavaScript
- No WebGL, framework or continuous canvas render loop
- Fixed production stage with automatic viewport scaling for browser/mobile QC
- Only digits that change animate each second
- `noindex`, `nofollow`, `noarchive` plus `robots.txt` disallow

## Debug

Add `?debug=1` to show viewport and scale information.

## Enplug

Use the normal GitHub Pages URL as a Web Page App. No debug query string is required for production.
