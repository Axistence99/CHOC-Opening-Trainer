import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { parsePGNToTree, getLeafPaths } from '../utils/pgnParser';
import { getPracticeHistory, updatePracticeEntry, getDuePositions } from '../utils/storage';
import { getOpeningFromMoves } from '../data/ecoOpenings';
import { getBoardThemeColors } from '../data/boardThemes';
import BoardThemePicker from './BoardThemePicker';

const STATUS = {
  READY: 'ready',
  USER_TURN: 'user_turn',
  CORRECT: 'correct',
  WRONG: 'wrong',
  COMPLETE: 'complete',
  LINE_COMPLETE: 'line_complete',
};

export default function PracticeMode({ repertoire, onExit, boardTheme, onBoardThemeChange }) {
  const [chess] = useState(() => new Chess());
  const [position, setPosition] = useState(chess.fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState(STATUS.READY);
  const [currentPath, setCurrentPath] = useState([]);
  const [expectedMoves, setExpectedMoves] = useState([]);
  const [message, setMessage] = useState('');
  const [tree, setTree] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [allLines, setAllLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const [arrows, setArrows] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [completedLines, setCompletedLines] = useState(new Set());
  const [boardWidth, setBoardWidth] = useState(400);

  const containerRef = useRef(null);

  // Responsive board width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 32, 520);
        setBoardWidth(Math.max(280, width));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Initialize the practice session
  useEffect(() => {
    if (!repertoire) return;

    const parsedTree = repertoire.tree || parsePGNToTree(repertoire.pgn);
    setTree(parsedTree);
    setCurrentNode(parsedTree);

    const isWhite = repertoire.color === 'white';
    setOrientation(isWhite ? 'white' : 'black');

    const lines = getLeafPaths(parsedTree);
    const shuffled = [...lines].sort(() => Math.random() - 0.5);
    setAllLines(shuffled);
    setLineIndex(0);
    setMoveIndex(0);
    setCompletedLines(new Set());
    setStats({ correct: 0, wrong: 0, total: 0 });

    if (shuffled.length > 0) {
      startLine(shuffled, 0, parsedTree);
    }
  }, [repertoire]);

  const startLine = useCallback((lines, idx, rootNode) => {
    if (!lines || lines.length === 0 || idx >= lines.length) {
      setStatus(STATUS.COMPLETE);
      return;
    }

    const line = lines[idx];
    const isUserWhite = repertoire.color === 'white';

    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setMoveIndex(0);
    setShowHint(false);
    setHighlightedSquares({});
    setArrows([]);
    setMessage(`Line ${idx + 1} of ${lines.length}`);

    let node = rootNode || tree;

    if (!isUserWhite) {
      const firstMove = line[0];
      if (firstMove) {
        const move = chess.move(firstMove.san);
        if (move) {
          setPosition(chess.fen());
          setCurrentPath([firstMove.san]);
          setMoveIndex(1);
          node = node.children.get(firstMove.san) || node;
        }
      }
    }

    setCurrentNode(node);

    const expected = new Map();
    for (const [san, child] of node.children.entries()) {
      expected.set(san, child);
    }
    setExpectedMoves(expected);

    const turnIsWhite = chess.turn() === 'w';
    const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);

    if (isUserTurn) {
      setStatus(STATUS.USER_TURN);
      if (expected.size > 0) {
        setMessage('Your turn — play the correct move!');
      }
    } else {
      if (expected.size > 0) {
        const expectedArr = Array.from(expected.keys());
        const randomMove = expectedArr[Math.floor(Math.random() * expectedArr.length)];
        const move = chess.move(randomMove);
        if (move) {
          setPosition(chess.fen());
          setCurrentPath(prev => [...prev, randomMove]);
          setMoveIndex(prev => prev + 1);
          const nextNode = expected.get(randomMove);
          setCurrentNode(nextNode);

          const newExpected = new Map();
          for (const [san, child] of nextNode.children.entries()) {
            newExpected.set(san, child);
          }
          setExpectedMoves(newExpected);

          const newTurnIsWhite = chess.turn() === 'w';
          const newIsUserTurn = (isUserWhite && newTurnIsWhite) || (!isUserWhite && !newTurnIsWhite);

          if (newIsUserTurn && newExpected.size > 0) {
            setStatus(STATUS.USER_TURN);
            setMessage('Your turn — play the correct move!');
          } else if (newExpected.size === 0) {
            setStatus(STATUS.LINE_COMPLETE);
            setMessage('✅ Line complete!');
          } else {
            handleOpponentTurn(nextNode, newExpected);
          }
        }
      } else {
        setStatus(STATUS.LINE_COMPLETE);
        setMessage('✅ Line complete!');
      }
    }
  }, [chess, repertoire, tree]);

  const handleOpponentTurn = useCallback((node, expectedMap) => {
    if (expectedMap.size === 0) return;

    const expectedArr = Array.from(expectedMap.keys());
    const randomMove = expectedArr[Math.floor(Math.random() * expectedArr.length)];
    const move = chess.move(randomMove);
    if (move) {
      setPosition(chess.fen());
      setCurrentPath(prev => [...prev, randomMove]);
      const nextNode = expectedMap.get(randomMove);
      setCurrentNode(nextNode);

      const newExpected = new Map();
      for (const [san, child] of nextNode.children.entries()) {
        newExpected.set(san, child);
      }
      setExpectedMoves(newExpected);

      const isUserWhite = repertoire.color === 'white';
      const turnIsWhite = chess.turn() === 'w';
      const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);

      if (isUserTurn && newExpected.size > 0) {
        setStatus(STATUS.USER_TURN);
        setMessage('Your turn — play the correct move!');
      } else if (newExpected.size === 0) {
        setStatus(STATUS.LINE_COMPLETE);
        setMessage('✅ Line complete!');
      }
    }
  }, [chess, repertoire]);

  const onPieceDrop = useCallback((sourceSquare, targetSquare, piece) => {
    if (status !== STATUS.USER_TURN) return false;

    const moveResult = chess.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1]?.toLowerCase() || 'q',
    });

    if (!moveResult) return false;

    const san = moveResult.san;

    if (expectedMoves.has(san)) {
      setPosition(chess.fen());
      setCurrentPath(prev => [...prev, san]);
      const nextNode = expectedMoves.get(san);
      setCurrentNode(nextNode);
      setStatus(STATUS.CORRECT);
      setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));

      const positionKey = chess.fen().split(' ').slice(0, 4).join(' ');
      updatePracticeEntry(positionKey, 5);

      setHighlightedSquares({
        [targetSquare]: { backgroundColor: 'rgba(76, 175, 80, 0.4)' },
      });
      setTimeout(() => setHighlightedSquares({}), 500);

      const newExpected = new Map();
      for (const [s, child] of nextNode.children.entries()) {
        newExpected.set(s, child);
      }
      setExpectedMoves(newExpected);

      if (newExpected.size === 0) {
        setStatus(STATUS.LINE_COMPLETE);
        setMessage('✅ Line complete! Great job!');
        return true;
      }

      const isUserWhite = repertoire.color === 'white';
      const turnIsWhite = chess.turn() === 'w';
      const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);

      if (isUserTurn) {
        setTimeout(() => {
          setStatus(STATUS.USER_TURN);
          setMessage('Your turn — play the correct move!');
        }, 600);
      } else {
        setMessage('Correct! Opponent is thinking...');
        setTimeout(() => {
          handleOpponentTurn(nextNode, newExpected);
        }, 800);
      }

      return true;
    } else {
      chess.undo();
      setStatus(STATUS.WRONG);
      setStats(prev => ({ ...prev, wrong: prev.wrong + 1, total: prev.total + 1 }));

      const positionKey = chess.fen().split(' ').slice(0, 4).join(' ');
      updatePracticeEntry(positionKey, 1);

      const correctArrows = Array.from(expectedMoves.keys()).map(san => {
        const tempChess = new Chess(chess.fen());
        const move = tempChess.move(san);
        if (move) return [move.from, move.to];
        return null;
      }).filter(Boolean);

      setArrows(correctArrows);
      setHighlightedSquares({
        [sourceSquare]: { backgroundColor: 'rgba(244, 67, 54, 0.4)' },
      });

      const correctMovesList = Array.from(expectedMoves.keys()).join(', ');
      setMessage(`❌ Wrong! Correct move${expectedMoves.size > 1 ? 's' : ''}: ${correctMovesList}`);

      setTimeout(() => {
        setStatus(STATUS.USER_TURN);
        setArrows([]);
        setHighlightedSquares({});
        setMessage('Try again — play the correct move!');
      }, 2000);

      return false;
    }
  }, [chess, status, expectedMoves, repertoire, handleOpponentTurn]);

  const handleNextLine = useCallback(() => {
    const nextIndex = lineIndex + 1;
    if (nextIndex >= allLines.length) {
      const reshuffled = [...allLines].sort(() => Math.random() - 0.5);
      setAllLines(reshuffled);
      setLineIndex(0);
      setCompletedLines(new Set());
      startLine(reshuffled, 0, tree);
    } else {
      setLineIndex(nextIndex);
      startLine(allLines, nextIndex, tree);
    }
  }, [lineIndex, allLines, tree, startLine]);

  const handleShowHint = useCallback(() => {
    if (expectedMoves.size === 0) return;
    const correctArrows = Array.from(expectedMoves.keys()).map(san => {
      const tempChess = new Chess(chess.fen());
      const move = tempChess.move(san);
      if (move) return [move.from, move.to];
      return null;
    }).filter(Boolean);
    setArrows(correctArrows);
    setShowHint(true);
    setTimeout(() => {
      setArrows([]);
      setShowHint(false);
    }, 1500);
  }, [expectedMoves, chess]);

  const handleRestartLine = useCallback(() => {
    startLine(allLines, lineIndex, tree);
  }, [allLines, lineIndex, tree, startLine]);

  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';

  if (!repertoire) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Select a repertoire to practice</p>
      </div>
    );
  }

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const isUserTurn = status === STATUS.USER_TURN;
  const isComplete = status === STATUS.LINE_COMPLETE;
  const themeColors = getBoardThemeColors(boardTheme);

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">{repertoire.name}</h2>
            <p className="text-xs text-slate-400">{openingName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-400">✓ {stats.correct}</span>
          <span className="text-red-400">✗ {stats.wrong}</span>
          <span className="text-slate-300">{accuracy}%</span>
          <span className="text-slate-500 text-xs">
            Line {lineIndex + 1}/{allLines.length}
          </span>
        </div>
      </div>

      {/* Board + Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Chess Board + Theme Picker */}
        <div className="flex-shrink-0 space-y-2">
          <Chessboard
            position={position}
            boardWidth={boardWidth}
            boardOrientation={orientation}
            onPieceDrop={onPieceDrop}
            customBoardStyle={{
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            }}
            customDarkSquareStyle={themeColors.customDarkSquareStyle}
            customLightSquareStyle={themeColors.customLightSquareStyle}
            customSquareStyles={highlightedSquares}
            customArrows={arrows}
            areArrowsAllowed={true}
            isDraggablePiece={({ pieceColor }) => {
              if (!isUserTurn) return false;
              const isUserWhite = repertoire.color === 'white';
              return (isUserWhite && pieceColor === 'w') || (!isUserWhite && pieceColor === 'b');
            }}
            animationDuration={200}
          />
          {/* Always-visible compact theme swatches right below the board */}
          <BoardThemePicker currentTheme={boardTheme} onThemeChange={onBoardThemeChange} compact />
        </div>

        {/* Side Panel */}
        <div className="flex-1 min-w-0 space-y-3 lg:max-w-xs w-full">
          {/* Status Message */}
          <div className={`rounded-xl p-4 border ${
            status === STATUS.CORRECT ? 'bg-emerald-900/30 border-emerald-700/50' :
            status === STATUS.WRONG ? 'bg-red-900/30 border-red-700/50' :
            isComplete ? 'bg-blue-900/30 border-blue-700/50' :
            'bg-slate-800/50 border-slate-700'
          }`}>
            <p className={`text-sm font-medium ${
              status === STATUS.CORRECT ? 'text-emerald-300' :
              status === STATUS.WRONG ? 'text-red-300' :
              isComplete ? 'text-blue-300' :
              'text-slate-300'
            }`}>
              {message || (isUserTurn ? 'Your turn!' : 'Waiting...')}
            </p>
          </div>

          {/* Move History */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">Moves</h3>
            <div className="flex flex-wrap gap-1">
              {currentPath.map((move, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                    i === currentPath.length - 1 ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  {i % 2 === 0 && <span className="text-slate-500 mr-0.5">{Math.floor(i / 2) + 1}.</span>}
                  {move}
                </span>
              ))}
              {currentPath.length === 0 && (
                <span className="text-xs text-slate-500 italic">No moves yet</span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {isUserTurn && (
              <button
                onClick={handleShowHint}
                className="px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                💡 Hint
              </button>
            )}
            <button
              onClick={handleRestartLine}
              className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              🔄 Restart Line
            </button>
            {isComplete && (
              <button
                onClick={handleNextLine}
                className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium"
              >
                Next Line →
              </button>
            )}
          </div>

          {/* Practice Info */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">How to Practice</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Play the moves from your repertoire</li>
              <li>• Wrong moves are highlighted in red</li>
              <li>• Use 💡 Hint to see the correct move</li>
              <li>• Green highlights confirm correct moves</li>
              <li>• Progress is saved automatically (spaced repetition)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
