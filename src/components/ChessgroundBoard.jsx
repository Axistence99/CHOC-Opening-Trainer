import { useEffect, useRef, useState, useLayoutEffect } from 'react';
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
 * CRITICAL FOR PIECE POSITIONING:
 * - Both width AND height are set to the same boardPx (multiple of 8)
 * - chessground pieces use 12.5% width/height + transform:translate() for positioning
 * - With boardPx divisible by 8, 12.5% = exact integer pixels → no sub-pixel drift
 * - We NEVER set CSS transform on pieces (chessground manages that via inline styles)
 * - We NEVER use background-size: contain (cover is required to fill the square)
 * - We NEVER apply transform/scale to any ancestor of .cg-wrap (breaks getBoundingClientRect)
 */
export default function ChessgroundBoard({ config, boardTheme }) {
  const containerRef = useRef(null);
  const cgRef = useRef(null);
  const [boardPx, setBoardPx] = useState(0);
  const configRef = useRef(config);
  configRef.current = config;

  // Measure parent width and lock to multiple-of-8 px
  useLayoutEffect(() => {
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
    const cg = Chessground(containerRef.current, configRef.current);
    cgRef.current = cg;

    // Force bounds recalculation after the browser has completed layout.
    // This is critical because chessground reads getBoundingClientRect() on init,
    // which may return stale or incorrect dimensions if called too early.
    // The requestAnimationFrame ensures the browser has painted at least once
    // with the correct dimensions before we ask chessground to re-render.
    const raf1 = requestAnimationFrame(() => {
      if (cgRef.current) {
        cgRef.current.set(configRef.current);
      }
      // Second frame for extra safety (ensures paint has definitely happened)
      const raf2 = requestAnimationFrame(() => {
        if (cgRef.current) {
          cgRef.current.set(configRef.current);
        }
      });
      // Store raf2 for cleanup (we can't store it in a ref easily, so use a closure)
      return () => cancelAnimationFrame(raf2);
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, [boardPx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update config on change
  useEffect(() => {
    if (cgRef.current && config && boardPx > 0) {
      cgRef.current.set(config);
    }
  }, [config, boardPx]);

  // Apply custom board colors — use useLayoutEffect to avoid flicker.
  // Must FULLY override chessground.brown.css which sets background-color
  // and background-image on cg-board. We set all background properties
  // to ensure no leftover from the brown CSS bleeds through.
  useLayoutEffect(() => {
    if (!containerRef.current || !boardTheme) return;
    const boardEl = containerRef.current.querySelector('cg-board');
    if (boardEl) {
      boardEl.style.backgroundColor = boardTheme.dark;
      boardEl.style.backgroundImage = makeBoardURI(boardTheme.light, boardTheme.dark);
      boardEl.style.backgroundSize = 'cover';
      boardEl.style.backgroundPosition = '0 0';
      boardEl.style.backgroundRepeat = 'no-repeat';
    }
  }, [boardTheme, config?.fen, boardPx]);

  return (
    <div
      ref={containerRef}
      className="cg-wrap"
      style={{
        // Both width and height as explicit px — perfect square, integer width/8
        width: boardPx > 0 ? `${boardPx}px` : '100%',
        height: boardPx > 0 ? `${boardPx}px` : undefined,
        // Phase 1 (before measurement): let aspect-ratio derive height
        aspectRatio: boardPx > 0 ? undefined : '1 / 1',
        // Prevent mobile browsers from adding odd spacing
        lineHeight: 0,
      }}
    />
  );
}
