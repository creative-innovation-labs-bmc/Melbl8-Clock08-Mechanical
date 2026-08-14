# Project brief

## Description

Aurecon mechanical ClockClock-style wall clock for the 3840x804 Melbourne gallery screen, optimised for Enplug on NVIDIA Shield.

## Build brief

Purpose: Create a lightweight mechanical wall clock for the Aurecon Melbourne gallery screen.

Display: native 3840 × 804.

Main clock: HH MM SS, with each numeral formed by a 2 × 3 group of analogue clock modules. Each module has two Aurecon-green hands that rotate to form the numeral. Only values that change should animate.

Brand: background #373A36. Hands #89C925. Darker grey module shadows. No proprietary font assets.

Side experiments: day abbreviation on the left and MEL location abbreviation on the right, built from miniature mechanical clock cells. Use 3 × 5 cells for legibility.

Variants: circle modules as the default index page and Aurecon leaf modules on leaf.html. The leaf silhouette is sourced from the existing Clock02 Aurecon leaf asset and must be bundled locally or embedded so this clock has no runtime dependency on older repositories.

Time zone: explicitly Australia/Melbourne using browser Intl APIs.

Platform: plain HTML/CSS/JavaScript only. No WebGL, no framework, no continuous canvas render loop. Optimise for Enplug Web Page App on NVIDIA Shield. Include noindex/nofollow/noarchive and robots.txt disallow. GitHub Pages deployment required.

Reference implementation will be uploaded immediately after repository creation.
