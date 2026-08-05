import { useEffect, useRef, useState } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { Chessground } from 'chessground';

/**
 * Generate a proper 8×8 checkerboard SVG as a data URI for the board background.
 *
 * This creates 64 individual <rect> elements in an SVG with viewBox="0 0 8 8",
 * alternating between light and dark colors. When used as a background-image
 * on cg-board with background-size:cover, it renders all 64 squares correctly.
 *
 * Previous version only drew 3 rects (a 2×2 grid of big blocks) which is why
 * the board appeared as just 4 colored quadrants instead of 64 squares.
 */
function makeBoardSVG(light, dark) {
  // Build the SVG with all 64 squares
  let rects = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const isLight = (x + y) % 2 === 0;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${isLight ? light : dark}"/>`;
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const lockSize = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const px = Math.floor(w / 8) * 8;
        if (px >= 8) setLockedPx(px);
      }
    };

    lockSize();

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

  // Apply custom board colors via direct DOM manipulation
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
        width: '100%',
        ...(lockedPx > 0
          ? { height: `${lockedPx}px` }
          : { aspectRatio: '1 / 1' }),
      }}
    />
  );
}
