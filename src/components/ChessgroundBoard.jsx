import { useEffect, useRef, useCallback } from 'react';
import { Chessground } from 'chessground';

/**
 * React wrapper for chessground — Lichess's interactive board.
 *
 * Props:
 *   config     — chessground Config object (fen, orientation, movable, etc.)
 *   boardTheme — { light, dark } square colors
 *   style      — optional extra styles for the container div
 */
export default function ChessgroundBoard({ config, boardTheme, style }) {
  const containerRef = useRef(null);
  const cgRef = useRef(null);

  // Initialize chessground once
  useEffect(() => {
    if (!containerRef.current) return;
    cgRef.current = Chessground(containerRef.current, config);
    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update config when it changes
  useEffect(() => {
    if (cgRef.current && config) {
      cgRef.current.set(config);
    }
  }, [config]);

  // Apply custom board colors
  useEffect(() => {
    if (!containerRef.current || !boardTheme) return;
    const boardEl = containerRef.current.querySelector('cg-board');
    if (boardEl) {
      boardEl.style.backgroundColor = boardTheme.dark;
      // Create an SVG pattern for the light squares
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='${boardTheme.dark}'/><rect width='4' height='4' fill='${boardTheme.light}'/><rect x='4' y='4' width='4' height='4' fill='${boardTheme.light}'/></svg>`;
      boardEl.style.backgroundImage = `url("data:image/svg+xml,${svg}")`;
      boardEl.style.backgroundSize = 'cover';
    }
  }, [boardTheme, config?.fen]);

  return (
    <div
      ref={containerRef}
      className="cg-wrap"
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
}
