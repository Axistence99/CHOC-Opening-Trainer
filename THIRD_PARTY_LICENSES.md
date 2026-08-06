# Third-Party Licenses & Attribution

This file lists all third-party software, assets, and resources used in
CHOC Opening Trainer, along with their licenses and copyright holders.

---

## Core Dependencies

### chessground
- **Version:** 9.2.1
- **Copyright:** © Thibault Duplessis (ornicar) and lichess-org contributors
- **License:** GPL-3.0-or-later
- **Source:** https://github.com/lichess-org/chessground
- **Local copy:** `licenses/GPL-3.0.txt`

### chess.js
- **Version:** 1.4.0
- **Copyright:** © 2025 Jeff Hlywa (jhlywa@gmail.com)
- **License:** BSD-2-Clause
- **Source:** https://github.com/jhlywa/chess.js

> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
> 1. Redistributions of source code must retain the above copyright notice,
>    this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution.

### React & React DOM
- **Version:** 19.x
- **Copyright:** © Meta Platforms, Inc. and affiliates
- **License:** MIT
- **Source:** https://github.com/facebook/react

### Vite
- **Version:** 8.2.0
- **Copyright:** © Evan You and Vite contributors
- **License:** MIT
- **Source:** https://github.com/vitejs/vite

### Tailwind CSS
- **Version:** 4.x
- **Copyright:** © Tailwind Labs
- **License:** MIT
- **Source:** https://github.com/tailwindlabs/tailwindcss

---

## Chess Piece Sets (from Lichess)

All piece sets are served from the Lichess CDN
(`https://lichess1.org/assets/piece/`) and are part of the
[Lichess lila repository](https://github.com/lichess-org/lila).

Full licensing details: [Lichess COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md)

### Cburnett
- **Copyright:** © Colin M.L. Burnett
- **License:** GPLv2+
- **Source:** https://github.com/lichess-org/lila/tree/master/public/piece/cburnett
- **Note:** Embedded as base64 SVGs in `chessground.cburnett.css`

### RhosGFX
- **Copyright:** © RhosGFX (https://rhosgfx.itch.io/)
- **License:** CC0 1.0 (Public Domain)
- **Source:** https://github.com/lichess-org/lila/tree/master/public/piece/rhosgfx

### Merida
- **Copyright:** © Armando Hernandez Marroquin
- **License:** GPLv2+
- **Source:** https://github.com/lichess-org/lila/tree/master/public/piece/merida

### Pirouetti
- **Copyright:** © pirouetti (https://lichess.org/@/pirouetti)
- **License:** AGPLv3+
- **Source:** https://github.com/lichess-org/lila/tree/master/public/piece/pirouetti

### Chessnut
- **Copyright:** © Alexis Luengas (https://github.com/LexLuengas)
- **License:** Apache 2.0
- **Source:** https://github.com/LexLuengas/chessnut-pieces

### Kiwen-suwi
- **Copyright:** © neverRare (https://github.com/neverRare)
- **License:** CC BY 4.0
- **Source:** https://github.com/lichess-org/lila/tree/master/public/piece/kiwen-suwi

---

## Board Themes (from Lichess)

Board theme images are served from the Lichess CDN
(`https://lichess1.org/assets/images/board/`) and are part of the
[Lichess lila repository](https://github.com/lichess-org/lila).

Full licensing details: [Lichess COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md)

The following Lichess board themes are available:
- **Brown** (`brown.png`) — Lichess default
- **Blue** (`blue.png`) — Cool blue
- **Blue 2** (`blue2.jpg`) — Blue marble
- **Blue 3** (`blue3.jpg`) — Deep blue
- **Grey** (`grey.jpg`) — Grey textured
- **Marble** (`marble.jpg`) — Marble textured
- **Purple** (`purple.png`) — Purple
- **Purple Diag** (`purple-diag.png`) — Purple diagonal
- **Newspaper** (`svg/newspaper.svg`) — Black & white
- **Maple** (`maple.jpg`) — Maple wood
- **Wood** (`wood4.jpg`) — Wood textured
- **Olive** (`olive.jpg`) — Olive
- **Metal** (`metal.jpg`) — Metallic
- **ICC** (`ic.png`) — ICC marble
- **Horsey** (`horsey.jpg`) — Fun horsey
- **Green Plastic** (`green-plastic.png`) — Green plastic
- **Pink** (`pink-pyramid.png`) — Pink pyramid
- **Canvas** (`canvas2.jpg`) — Canvas textured
- **Leather** (`leather.jpg`) — Leather textured
- **Blue Marble** (`blue-marble.jpg`) — Blue marble textured

All Lichess board images are licensed under **AGPL-3.0-or-later** as part of the lila project.

The **DeepBoard** theme is original to CHOC Opening Trainer and is not derived from any third-party design.

---

## Board Square Themes (from chessground)

### chessground.brown.css
- **Copyright:** © Thibault Duplessis and lichess-org contributors
- **License:** GPL-3.0-or-later (part of chessground)
- **Note:** Contains embedded SVG for board square colors and
  move/selection highlight styles

### chessground.base.css
- **Copyright:** © Thibault Duplessis and lichess-org contributors
- **License:** GPL-3.0-or-later (part of chessground)
- **Note:** Base layout and positioning styles for the chess board

## Engine

### Stockfish.js (WASM)
- **Version:** 10.0.2 (Stockfish 10)
- **Copyright:** © T. Romstad, M. Costalba, J. Kiiski, G. Linscott and contributors
- **License:** GPL-3.0-or-later
- **Source:** https://github.com/nmrugg/stockfish.js
- **Note:** WASM engine loaded via Web Worker from `public/engine/`

---

## Fonts

### Orbitron
- **Copyright:** © Matt McInerney
- **License:** SIL Open Font License 1.1
- **Source:** https://fonts.google.com/specimen/Orbitron
- **Loaded from:** Google Fonts CDN

### Inter
- **Copyright:** © Rasmus Andersson
- **License:** SIL Open Font License 1.1
- **Source:** https://fonts.google.com/specimen/Inter
- **Loaded from:** Google Fonts CDN

---

## Opening Data

### ECO Classification
- **Source:** Encyclopaedia of Chess Openings (public domain classification system)
- **Note:** ECO codes and standard opening names are factual data
  not subject to copyright. The specific move sequences used to
  classify openings are derived from public domain chess knowledge.

### Pre-built Repertoires
- **Note:** All opening lines are standard chess theory from
  publicly available sources. No proprietary analysis or
  copyrighted content is included.

---

## Full License Texts

- **GPL-3.0:** See `licenses/GPL-3.0.txt`
- **BSD-2-Clause:** https://opensource.org/licenses/BSD-2-Clause
- **MIT:** https://opensource.org/licenses/MIT
- **Apache-2.0:** https://opensource.org/licenses/Apache-2.0
- **CC0-1.0:** https://creativecommons.org/publicdomain/zero/1.0/
- **CC-BY-4.0:** https://creativecommons.org/licenses/by/4.0/
- **AGPL-3.0:** https://www.gnu.org/licenses/agpl-3.0.html
- **SIL-OFL-1.1:** https://scripts.sil.org/OFL
