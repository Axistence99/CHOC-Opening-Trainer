import { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessBoard({
  position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  boardWidth = 400,
  orientation = 'white',
  onPieceDrop,
  areArrowsAllowed = true,
  customArrows = [],
  customSquareStyles = {},
  isDraggablePiece = null,
  animationDuration = 300,
}) {
  return (
    <div className="chess-board-container">
      <Chessboard
        position={position}
        boardWidth={boardWidth}
        boardOrientation={orientation}
        onPieceDrop={onPieceDrop}
        areArrowsAllowed={areArrowsAllowed}
        customArrows={customArrows}
        customSquareStyles={customSquareStyles}
        isDraggablePiece={isDraggablePiece}
        animationDuration={animationDuration}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
      />
    </div>
  );
}
