# Mobile & Piece Rendering Fixes — 2026-08-06

## Summary of Changes

### 🐛 Critical Bug Fix: Piece Set CSS Override
**File:** `src/components/LandingPage.jsx`

- **Problem:** When switching piece sets (e.g., Cburnett → RhosGFX), the new piece images didn't appear because:
  1. The dynamic CSS override rules lacked `!important`, so they couldn't override the bundled cburnett CSS
  2. The `cburnettLink.disabled` code referenced a non-existent `<link>` element (Vite bundles CSS as `<style>`, not `<link>`)
- **Fix:** Added `!important` to all dynamic piece set CSS rules. Removed broken `cburnettLink` toggle code. When switching back to cburnett, the override `<style>` element is cleared, allowing the bundled cburnett CSS to take effect naturally.

### 📱 Board Sizing for Mobile
**Files:** `LandingPage.jsx`, `PlayVsEngine.jsx`, `PracticeMode.jsx`

- **Problem:** `clamp(320px, 55vw, 560px)` overflows on small phones (375px viewport) because the minimum (320px) plus padding exceeds available width. On a 375px phone with padding, only ~335px is available for the board.
- **Fix:** Changed to `min(calc(100vw - 40px), 560px)` which:
  - Automatically fills available width on mobile (minus 40px for padding/borders)
  - Caps at 560px on desktop
  - On 375px phone → 335px → rounds to 336px (42×8) ✓
  - On 414px phone → 374px → rounds to 368px (46×8) ✓

### 📐 Reduced Padding on Mobile
**Files:** `LandingPage.jsx`, `PlayVsEngine.jsx`, `PracticeMode.jsx`

| Element | Before | After |
|---------|--------|-------|
| Board container | `p-3` (12px) | `p-1.5 md:p-3` (6px mobile, 12px desktop) |
| Main area | `p-4` (16px) | `p-2 md:p-8` (8px mobile, 32px desktop) |
| Header | `px-4 py-4` | `px-3 md:px-8 py-2.5 md:py-4` |
| Footer | `px-4 py-3` | `px-3 md:px-8 py-2 md:py-3` |

### 🎨 Compact Mobile Controls
**File:** `LandingPage.jsx`

- Color choice buttons: `p-4 gap-2` → `p-3 gap-1`, font `2rem` → `1.5rem`
- Play vs Engine buttons: Stacked vertically → side-by-side on same row as color choice
- "PRACTICE THIS OPENING" button: `py-3` → `py-2`, text `0.85rem` → `0.7rem`
- Navigation step buttons: `w-11 h-11` → `w-9 h-9 md:w-11 md:h-11`
- Main gap: `gap-6` → `gap-3 md:gap-6`

### ⚙️ Settings Panel on Mobile
**File:** `LandingPage.jsx`

- Settings row now scrollable horizontally on mobile (`overflow-x-auto`, `flex-nowrap`)
- Pieces and Orientation sections now visible on mobile (previously hidden)
- Piece preview thumbnails: 44×44 → 36×36 with `loading="lazy"`

### 🔧 PracticeMode Mobile
- Study navigation buttons: `w-10 h-10` → `w-9 h-9 md:w-10 md:h-10`
- Mode toggle: `padding: 6px 14px` → `4px 10px`
- Side panel spacing: `space-y-3` → `space-y-2 md:space-y-3`
- Board + panel layout: `w-full lg:w-auto` on board container for mobile

### 🔧 PlayVsEngine Mobile
- Difficulty buttons: `gap-1.5 py-1.5` → `gap-1 py-1 md:py-1.5`
- Status panel: `p-4` → `p-3 md:p-4`
- Difficulty panel: `p-3` → `p-2.5 md:p-3`
- Board container: `w-full lg:w-auto` for proper mobile width

### 🎯 Piece Rendering CSS Fixes
**File:** `src/index.css`

Added mobile-specific CSS for chessground pieces:
- GPU compositing (`backface-visibility: hidden`, `translateZ(0)`) to prevent flicker
- `background-size: contain !important` on mobile (prevents crop distortion on fractional pixels)
- `touch-action: none` on board (prevents scroll interference with drag)
- `-webkit-tap-highlight-color: transparent` (removes tap flash)
- Smaller coordinate labels on small boards (`font-size: 7px` below 480px)

### 📋 Viewport
**File:** `index.html`

Added `maximum-scale=1.0, user-scalable=no` to prevent accidental zoom when tapping the board on mobile.

## Testing Checklist
- [ ] 64 alternating color squares visible on board (all viewports)
- [ ] Pieces centered on squares in all modes (landing, study, training, play vs engine)
- [ ] Board doesn't overflow on 375px viewport (iPhone SE)
- [ ] Board doesn't overflow on 414px viewport (iPhone Pro Max)
- [ ] Piece set switching works (Cburnett → RhosGFX → Merida → back to Cburnett)
- [ ] Pieces render correctly after switching sets
- [ ] Touch drag works on mobile without page scrolling
- [ ] Settings panel scrollable horizontally on mobile
- [ ] No white screen / blank pieces on mobile
- [ ] Stockfish engine loads and responds on GitHub Pages
- [ ] Can move pieces as both white and black in Play vs Engine
