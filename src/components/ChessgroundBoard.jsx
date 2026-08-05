import { useEffect, useRef, useState } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { Chessground } from 'chessground';

/**
 * Generate a proper 8×8 checkerboard as a base64-encoded SVG data URI.
 */
function makeBoardURI(light, dark) {
  let rects = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const isLight = (x + y) % 2 === 0;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${isLight ? light : dark}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">${rects}</svg>`;
  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}")`;
}

/**
 * React wrapper for chessground — Lichess's interactive board.
 *
 * SIZING: Measures parent width, rounds to multiple of 8 for crisp squares,
 * then sets BOTH width AND height as explicit px on the .cg-wrap div.
 * This guarantees chessground sees a perfect square where width/8 and
 * height/8 are integers, so pieces land exactly centered on squares.
 *
 * MOBILE: On small viewports, we use a tighter minimum and allow the board
 * to shrink more aggressively. The ResizeObserver re-measures on any
 * parent width change (rotation, sidebar toggle, etc.).
 */
export default function ChessgroundBoard({ config, boardTheme }) {
  const containerRef = useRef(null);
  const cgRef = useRef(null);
  const [boardPx, setBoardPx] = useState(0);

  // Measure parent width and lock to multiple-of-8 px
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const padL = parseFloat(style.paddingLeft) || 0;
      const padR = parseFloat(style.paddingRight) || 0;
      const contentW = rect.width - padL - padR;
      if (contentW > 0) {
        // Minimum 256px on mobile (8*32), ensures at least 32px per square
        const minPx = 256;
        const px = Math.max(minPx, Math.floor(contentW / 8) * 8);
        if (px >= minPx) setBoardPx(px);
      }
    };

    measure();
    const parent = el.parentElement;
    if (parent) {
      const ro = new ResizeObserver(measure);
      ro.observe(parent);
      return () => ro.disconnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize chessground once we have locked dimensions
  useEffect(() => {
    if (boardPx <= 0 || !containerRef.current) return;
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
  }, [boardPx]); // eslint-disable-line react-hooks/exhaustive-deps

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
        boardEl.style.backgroundImage = makeBoardURI(boardTheme.light, boardTheme.dark);
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
        // Both width and height as explicit px — perfect square, integer width/8
        width: boardPx > 0 ? `${boardPx}px` : '100%',
        height: boardPx > 0 ? `${boardPx}px` : undefined,
        // Phase 1: let aspect-ratio derive height from width
        aspectRatio: boardPx > 0 ? undefined : '1 / 1',
        // Prevent mobile browsers from adding odd spacing
        lineHeight: 0,
      }}
    />
  );
}
