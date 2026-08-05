import { useEffect, useRef, useState } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { Chessground } from 'chessground';

/**
 * Generate SVG board background for chessground.
 * Uses %23 encoding for # in hex colors within SVG data URIs.
 */
function makeBoardSVG(light, dark) {
  const l = light.replace('#', '%23');
  const d = dark.replace('#', '%23');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'>`
    + `<rect width='8' height='8' fill='${d}'/>`
    + `<rect width='4' height='4' fill='${l}'/>`
    + `<rect x='4' y='4' width='4' height='4' fill='${l}'/>`
    + `</svg>`;
  return `url("data:image/svg+xml,${svg}")`;
}

/**
 * React wrapper for chessground — Lichess's interactive board.
 *
 * Chessground reads the container's size via getBoundingClientRect()
 * and uses ResizeObserver internally to handle resizes.
 *
 * SIZING STRATEGY:
 *   - The .cg-wrap div uses width:100% + aspect-ratio:1/1 to form a square
 *     based on the parent's width (which MUST be set by the caller).
 *   - We do NOT set height:100% because the parent typically has height:auto,
 *     which would make height resolve to 0 and override aspect-ratio.
 *   - After the browser computes layout, we read back the actual pixel width,
 *     round it to a multiple of 8 (for crisp square edges), and lock it in
 *     as explicit px dimensions. This is the size chessground sees.
 *
 * Props:
 *   config     — chessground Config object
 *   boardTheme — { light, dark } square colors
 */
export default function ChessgroundBoard({ config, boardTheme }) {
  const containerRef = useRef(null);
  const cgRef = useRef(null);
  const [lockedPx, setLockedPx] = useState(0);

  // After mount, read the browser-computed width and lock it as explicit px.
  // This ensures chessground always sees a concrete pixel size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const lockSize = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        // Round to multiple of 8 for pixel-perfect squares
        const px = Math.floor(w / 8) * 8;
        if (px >= 8) setLockedPx(px);
      }
    };

    // Try immediately (layout should be computed by now)
    lockSize();

    // Also observe resizes
    const ro = new ResizeObserver(lockSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialize chessground once we have locked pixel dimensions
  useEffect(() => {
    if (lockedPx <= 0 || !containerRef.current) return;

    if (cgRef.current) {
      cgRef.current.destroy();
      cgRef.current = null;
    }

    cgRef.current = Chessground(containerRef.current, config);

    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, [lockedPx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update config on change
  useEffect(() => {
    if (cgRef.current && config) {
      cgRef.current.set(config);
    }
  }, [config]);

  // Apply custom board colors
  useEffect(() => {
    if (!containerRef.current || !boardTheme) return;
    const apply = () => {
      const boardEl = containerRef.current?.querySelector('cg-board');
      if (boardEl) {
        boardEl.style.backgroundColor = boardTheme.dark;
        boardEl.style.backgroundImage = makeBoardSVG(boardTheme.light, boardTheme.dark);
        boardEl.style.backgroundSize = 'cover';
      }
    };
    apply();
    const t = setTimeout(apply, 50);
    return () => clearTimeout(t);
  }, [boardTheme, config?.fen]);

  return (
    <div
      ref={containerRef}
      className="cg-wrap"
      style={{
        // Width: always fill parent
        width: '100%',
        // Height: use locked px if available, otherwise let aspect-ratio compute it
        // NEVER use height:100% — it resolves to 0 when parent has height:auto
        ...(lockedPx > 0
          ? { height: `${lockedPx}px` }   // Phase 2: explicit px
          : { aspectRatio: '1 / 1' }),    // Phase 1: CSS computes from width
      }}
    />
  );
}
