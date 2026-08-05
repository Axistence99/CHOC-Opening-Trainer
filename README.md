# ♞ CHOC Opening Trainer

A free, open-source chess opening repertoire trainer that runs entirely in your browser. Host it on GitHub Pages for free!

![CHOC Opening Trainer](https://img.shields.io/badge/React-19-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8) ![chess.js](https://img.shields.io/badge/chess.js-latest-green) ![chessground](https://img.shields.io/badge/chessground-9-GPLv2)

## Features

- 📚 **Pre-built Repertoires** — Beginner-friendly opening lines for White & Black
- 📥 **PGN Import** — Import your own PGN files or paste from Lichess Studies, ChessBase, etc.
- 🧠 **Spaced Repetition** — SM-2 algorithm tracks which lines you need to review
- 🎯 **Interactive Practice** — Drag & click moves on a Lichess-grade chessboard (chessground)
- 💡 **Hints** — See the correct move when you're stuck
- 🎨 **Board Themes** — 6 color themes: Lichess, Marble, Grey & Black, Blue, Wood, Emerald
- ♟️ **Piece Sets** — 6 free/open piece sets from Lichess (CC0, GPLv2+, Apache 2.0)
- 💾 **Offline & Private** — All data saved in your browser, no account needed
- 📱 **Mobile Friendly** — Responsive design works on phones and tablets
- 🔄 **PGN Export** — Export your repertoire anytime for backup

## Pre-built Repertoires

| Repertoire | Color | Description |
|---|---|---|
| Beginner White (e4) | ♔ White | Simple e4 repertoire: Italian, anti-Sicilian, French, Caro-Kann |
| Beginner Black (e5 + Caro-Kann) | ♚ Black | Solid repertoire: e5 vs e4, Caro-Kann vs d4 |
| Italian Game | ♔ White | 1.e4 e5 2.Nf3 Nc6 3.Bc4 — Classic opening |
| Sicilian Dragon | ♚ Black | 1.e4 c5 — Aggressive and exciting |
| Queen's Gambit | ♔ White | 1.d4 d5 2.c4 — Strategic & positional |
| King's Indian Defense | ♚ Black | Dynamic and aggressive defense vs 1.d4 |

## Board Themes

| Theme | Light Square | Dark Square |
|---|---|---|
| Lichess | `#edeed1` | `#779952` |
| Marble | `#f0d9b5` | `#b58863` |
| Grey & Black | `#a8a8a8` | `#4a4a4a` |
| Blue | `#dee3e6` | `#8ca2ad` |
| Wood | `#e8c98e` | `#a06830` |
| Emerald | `#d4e8d0` | `#5d8a5c` |

## Piece Sets

All piece sets are from the [Lichess repository](https://github.com/lichess-org/lila) and are free/open-source:

| Set | License | Author |
|---|---|---|
| Cburnett | GPLv2+ | [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett) |
| RhosGFX | CC0 1.0 | [RhosGFX](https://rhosgfx.itch.io/) |
| Merida | GPLv2+ | Armando Hernandez Marroquin |
| Pirouetti | AGPLv3+ | [pirouetti](https://lichess.org/@/pirouetti) |
| Chessnut | Apache 2.0 | [Alexis Luengas](https://github.com/LexLuengas) |
| Kiwen-suwi | CC BY 4.0 | [neverRare](https://github.com/neverRare) |

See [Lichess COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) for full details.

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19 + Vite** | Framework & build tool |
| **chessground** | Lichess interactive chess board UI |
| **chess.js** | Chess logic (move validation, PGN parsing) |
| **Tailwind CSS 4** | Styling |
| **localStorage** | Persistent data (no backend needed) |

## Getting Started

### Development

```bash
git clone <your-repo-url>
cd chess-opening-trainer
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Deploy to GitHub Pages

**Option 1: GitHub Actions (automatic)**

1. Push to GitHub
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The `.github/workflows/deploy.yml` will auto-deploy on push to `main`

**Option 2: Manual deployment**

```bash
npm run build
# Deploy the dist/ folder to GitHub Pages
```

## Importing PGNs

You can import PGN from any source:

- **Lichess Studies** — Go to a study → ⋯ → Export PGN
- **ChessBase** — Export games as PGN
- **Other trainers** — Export from Chessbook, OpenBook, etc.
- **Manual entry** — Type moves like: `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *`

## License

GPL-3.0-or-later — See [LICENSE](./LICENSE) for the full text.

This project uses [chessground](https://github.com/lichess-org/chessground) (GPL-3.0-or-later)
which requires the combined work to be distributed under GPL-3.0.

See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for all third-party
attributions including piece sets, fonts, and dependencies.
