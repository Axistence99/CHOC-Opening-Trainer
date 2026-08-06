import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
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
 * Board theme prop supports two formats:
 *  - { light, dark }  — SVG-generated checkerboard from two colors
 *  - { image: url }   — Background image from a CDN URL (e.g. Lichess board images)
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
  const boardThemeRef = useRef(boardTheme);
  boardThemeRef.current = boardTheme;

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

  // Apply board colors directly to DOM — called once on mount and on theme change only.
  // NEVER re-run on FEN change (that was causing board color flash on every move).
  // Supports both { light, dark } (SVG) and { image: url } (CDN) board themes.
  const applyBoardColors = useCallback(() => {
    if (!containerRef.current || !boardThemeRef.current) return;
    const boardEl = containerRef.current.querySelector('cg-board');
    if (boardEl) {
      const bt = boardThemeRef.current;
      // Use setProperty with 'important' priority to override the CSS !important
      // default (DeepBoard) set in index.css
      if (bt.image) {
        // Image-based theme from Lichess CDN
        boardEl.style.setProperty('background-color', 'transparent', 'important');
        boardEl.style.setProperty('background-image', `url('${bt.image}')`, 'important');
      } else {
        // SVG-generated checkerboard from light/dark colors
        boardEl.style.setProperty('background-color', bt.dark, 'important');
        boardEl.style.setProperty('background-image', makeBoardURI(bt.light, bt.dark), 'important');
      }
      boardEl.style.setProperty('background-size', 'cover', 'important');
      boardEl.style.setProperty('background-position', '0 0', 'important');
      boardEl.style.setProperty('background-repeat', 'no-repeat', 'important');
    }
  }, []);

  // Initialize chessground once we have locked dimensions
  useEffect(() => {
    if (boardPx <= 0 || !containerRef.current) return;
    if (cgRef.current) {
      cgRef.current.destroy();
      cgRef.current = null;
    }
    cgRef.current = Chessground(containerRef.current, config);
    applyBoardColors();
    return () => {
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

  // Re-apply board colors when theme changes (NOT on every FEN change)
  useEffect(() => {
    applyBoardColors();
  }, [boardTheme, boardPx, applyBoardColors]);

  return (
    <div
      ref={containerRef}
      className="cg-wrap"
      style={{
        width: boardPx > 0 ? `${boardPx}px` : '100%',
        height: boardPx > 0 ? `${boardPx}px` : undefined,
        aspectRatio: boardPx > 0 ? undefined : '1 / 1',
        lineHeight: 0,
      }}
    />
  );
}
