# ♞ CHOC Opening Trainer

A free, open-source chess opening repertoire trainer that runs entirely in your browser. Host it on GitHub Pages for free!

![CHOC Opening Trainer](https://img.shields.io/badge/React-19-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8) ![chess.js](https://img.shields.io/badge/chess.js-latest-green)

## Features

- 📚 **Pre-built Repertoires** — Beginner-friendly opening lines for White & Black
- 📥 **PGN Import** — Import your own PGN files or paste from Lichess Studies, ChessBase, etc.
- 🧠 **Spaced Repetition** — SM-2 algorithm tracks which lines you need to review
- 🎯 **Interactive Practice** — Play moves on the board, get instant feedback
- 💡 **Hints** — See the correct move when you're stuck
- 🎨 **Board Themes** — 6 color themes: Lichess, Chess.com, Grey & Black, Blue, Wood, Emerald
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
| Lichess Green | `#edeed1` | `#779952` |
| Chess.com | `#f0d9b5` | `#b58863` |
| Grey & Black | `#a8a8a8` | `#4a4a4a` |
| Blue | `#dee3e6` | `#8ca2ad` |
| Wood | `#e8c98e` | `#a06830` |
| Emerald | `#d4e8d0` | `#5d8a5c` |

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19 + Vite** | Framework & build tool |
| **react-chessboard** | Interactive chess board UI |
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
- **Chess.com** — Copy PGN from game review
- **Other trainers** — Export from Chessbook, OpenBook, etc.
- **Manual entry** — Type moves like: `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *`

## License

MIT
