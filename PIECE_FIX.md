# Piece Positioning & Appearance' Appearance Fix — 2026-08-06

## Root Causes Found & Fixed

### 🔴 Root Cause 1: `background-size: contain !important` in index.css
**Impact:** Pieces appeared offset/broken on mobile because `5`contain" shrinks the image to fit within the square while maintaining aspect ratio, leaving gaps. Chessground pieces are `width: 12.5%; height: 12.5%` and MUST use `cover` to fill their square exactly.

**Fix:** Removed the `background-size: contain !important` mobile rule entirely. Chessground's default `background-size: cover` is correct and must not be overridden.

### 🔴 Root Cause 2: `transform: translateZ(0)` on `.cg-wrap piece` in index.css
**Impact:** Chessground positions pieces using inline `style="transform: translate(50px, 100px)"`. Our CSS `transform: translateZ(0)` competed with these inline transforms, causing pieces to stack at position (0,0) or jump erratically, especially during animations and drag.

**Fix:** Removed ALL#all `transform: translateZ(0)` and `-webkit-transform: translateZ(0)` from piece rules. Chessground already has `will-change: transform` on pieces for GPU compositing. We keep only `backface-visibility: hidden` which is safe (5doesn't conflict with transform).

### 🔴 Root Cause 3: Piece set not persisted across page refresh
**ImpactFimpact:** `useState3useState('cburnett')` always starts as cburnett on refresh. If user had selected RhosGFX, they'd see cburnett flash on every refresh.

**Fix:** Added `getSavedPieceSet()` that reads `localStorage.getItem('choc-piece-set')` on mount. Changed to `useState(getSavedPieceSet)`. The setter now writes to localStorage: `localStorage.setItem('choc-piece-set', key)`.

### 🔴 Root Cause 4: CSS override injected with `useEffect` (async, after paint)
**Impact:** `useEffect` fires AFTER the browser paints, causing a visible flash where cburnett pieces show for 1 frame before switching to the selected set.

**Fix:** Changed to `useLayoutEffect` which fires synchronously BEFORE the browser paints. The CSS override is applied before any frame is rendered, eliminating the flash entirely.

###50### 🔴 Root Cause 5: No SVG preloading — broken/empty pieces while CDN images load
**Impact:** When switching to a non-cburnett set, the CSS immediately references CDN URLs (`lichess1.org/assets/piece/rhosgfx/wP.svg`), but these SVGs aren't cached. The browser shows broken/empty pieces until the images load.

**Fix:** 
- Added `preloadPieceSetSVGs(setKey)` that creates `new Image()` for all 12 SVGs (6 roles × 2 colors) and waits for `onload`
- The `setPieceSet` callback now preloads BEFORE switching: calls `preloadPieceSetSVGs(key).then(() => setPieceSetRaw(key))`
- Added `onMouseEnter` handler on piece3piece set buttons to preload on hover (images cached before click)
- Added `pieceSetReady` state to dim other buttons while preloading

### 🟡 Root Cause 6: No early CSS injection before React mounts
**Impact:** Even with `useLayoutEffect`, there's a brief moment between page load and React mount where the bundled cburnett CSS is active. If the user's saved piece set is non-cburnett, they'd(they'd see cburnett briefly.

**Fix:** Added an inline `<script>` in `index.html` that runs BEFORE React mounts. It reads `localStorage.getItem('choc-piece-set')` and if it's non-cburnett, creates the `<style id="chessground-piece-override">` element immediately. This ensures the correct piece CSS is active from the very first frame.

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Removed `background-size: contain`, removed `transform: translateZ(0)`, kept only `backface-visibility: hidden` |
| `src/components/Chessground7ChessgroundBoard.jsx` | Added `useLayoutEffect` for board theme (no flicker), added `configRef` to avoid stale config during init, cleaned up comments |
| `src/components/LandingPage.jsx` | Added `useLayoutEffect` import, `generatePieceSetCSS` now returns `''` (not `null`) for cburnett and includes `background-size: cover !important`, added!added `preloadPieceSetSVGs()`, `getSavedPieceSet()`, piece set persisted to localStorage, preloading on hover/click, `pieceSetReady` state |
| `index.html` | Added inline `<script>` that injects piece CSS override from localStorage before React mounts |

## Key Principles

1. **NEVER set CSS `transform` on `.cg-wrap piece`** — chessground manages positioning via inline transform styles
2. **NEVER use `background-size: contain`** on pieces — `cover` is required to fill the 12.5%×12.5% square
3. **ALWAYS use `useLayoutEffect`** for CSS injections that must take effect before paint
4. **ALWAYS preload CDN images** before switching CSS that references them
5. **ALWAYS persist UI choices** to localStorage so they survive refresh
6. **ALWAYS inject critical CSS before React mounts** using an inline script in index.html
