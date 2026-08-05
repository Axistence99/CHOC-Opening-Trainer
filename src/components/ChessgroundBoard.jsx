import { useEffect, useRef, useState } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { Chessground } from 'chessground';

/**
 * Generate a proper 8×8 checkerboard as a base64-encoded SVG data URI.
 * Base64 encoding avoids all fragile #%23 escaping issues.
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
 */
export default function ChessgroundBoard({ config, boardTheme }) {
  const containerRef = useRef(null);
  const cgRef = useRef(null);
  const [lockedPx, setLockedPx] = useState(0);

  // Lock container to explicit pixel size after layout
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

  // Update config on change and force bounds recalculation
  useEffect(() => {
    if (cgRef.current && config) {
      cgRef.current.set(config);
      // Force chessground to recalculate piece positions after config change.
      // Without this, pieces can be misaligned when the FEN changes drastically
      // (e.g., switching repertoires) because chessground caches bounds.
      requestAnimationFrame(() => {
        const boardEl = containerRef.current?.querySelector('cg-board');
        if (boardEl) {
          // Dispatch a resize event so chessground recalculates
          window.dispatchEvent(new Event('resize'));
        }
      });
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
        width: '100%',
        ...(lockedPx > 0
          ? { height: `${lockedPx}px` }
          : { aspectRatio: '1 / 1' }),
      }}
    />
  );
}
