import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, getLeafPaths } from '../utils/pgnParser';
import { getPracticeHistory, updatePracticeEntry } from '../utils/storage';
import { getOpeningFromMoves } from '../data/ecoOpenings';
import { getBoardTheme } from '../data/boardThemes';
import BoardThemePicker from './BoardThemePicker';
import ChessgroundBoard from './ChessgroundBoard';

const STATUS = { READY: 'ready', USER_TURN: 'user_turn', CORRECT: 'correct', WRONG: 'wrong', COMPLETE: 'complete', LINE_COMPLETE: 'line_complete' };

function computeDests(fen) {
  try {
    const chess = new Chess(fen);
    const dests = new Map();
    for (const move of chess.moves({ verbose: true })) {
      const existing = dests.get(move.from) || [];
      existing.push(move.to);
      dests.set(move.from, existing);
    }
    return dests;
  } catch {
    return new Map();
  }
}

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
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [hintArrows, setHintArrows] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!repertoire) return;
    const parsedTree = repertoire.tree || parsePGNToTree(repertoire.pgn);
    setTree(parsedTree); setCurrentNode(parsedTree);
    setOrientation(repertoire.color === 'white' ? 'white' : 'black');
    const lines = getLeafPaths(parsedTree);
    const shuffled = [...lines].sort(() => Math.random() - 0.5);
    setAllLines(shuffled); setLineIndex(0);
    setStats({ correct: 0, wrong: 0, total: 0 });
    if (shuffled.length > 0) startLine(shuffled, 0, parsedTree);
  }, [repertoire]);

  const startLine = useCallback((lines, idx, rootNode) => {
    if (!lines || lines.length === 0 || idx >= lines.length) { setStatus(STATUS.COMPLETE); return; }
    const line = lines[idx]; const isUserWhite = repertoire.color === 'white';
    chess.reset(); setPosition(chess.fen()); setCurrentPath([]);
    setHintArrows([]); setLastMove(null);
    setMessage(`Line ${idx + 1} of ${lines.length}`);
    let node = rootNode || tree;
    if (!isUserWhite) { const firstMove = line[0]; if (firstMove) { const move = chess.move(firstMove.san); if (move) { setPosition(chess.fen()); setCurrentPath([firstMove.san]); node = node.children.get(firstMove.san) || node; setLastMove([move.from, move.to]); } } }
    setCurrentNode(node);
    const expected = new Map(); for (const [san, child] of node.children.entries()) expected.set(san, child);
    setExpectedMoves(expected);
    const turnIsWhite = chess.turn() === 'w'; const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);
    if (isUserTurn) { setStatus(STATUS.USER_TURN); if (expected.size > 0) setMessage('Your turn — play the correct move!'); }
    else { if (expected.size > 0) { const arr = Array.from(expected.keys()); const rm = arr[Math.floor(Math.random() * arr.length)]; const move = chess.move(rm); if (move) { setPosition(chess.fen()); setCurrentPath(prev => [...prev, rm]); setLastMove([move.from, move.to]); const nn = expected.get(rm); setCurrentNode(nn); const ne = new Map(); for (const [s, c] of nn.children.entries()) ne.set(s, c); setExpectedMoves(ne); const ntw = chess.turn() === 'w'; const niu = (isUserWhite && ntw) || (!isUserWhite && !ntw); if (niu && ne.size > 0) { setStatus(STATUS.USER_TURN); setMessage('Your turn — play the correct move!'); } else if (ne.size === 0) { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); } else { handleOpponentTurn(nn, ne); } } } else { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); } }
  }, [chess, repertoire, tree]);

  const handleOpponentTurn = useCallback((node, expectedMap) => {
    if (expectedMap.size === 0) return;
    const arr = Array.from(expectedMap.keys()); const rm = arr[Math.floor(Math.random() * arr.length)]; const move = chess.move(rm);
    if (move) { setPosition(chess.fen()); setCurrentPath(prev => [...prev, rm]); setLastMove([move.from, move.to]); const nn = expectedMap.get(rm); setCurrentNode(nn); const ne = new Map(); for (const [s, c] of nn.children.entries()) ne.set(s, c); setExpectedMoves(ne); const isUW = repertoire.color === 'white'; const tw = chess.turn() === 'w'; const iu = (isUW && tw) || (!isUW && !tw); if (iu && ne.size > 0) { setStatus(STATUS.USER_TURN); setMessage('Your turn — play the correct move!'); } else if (ne.size === 0) { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); } }
  }, [chess, repertoire]);

  // chessground move handler
  const handleUserMove = useCallback((orig, dest) => {
    if (status !== STATUS.USER_TURN) return;
    const moveResult = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!moveResult) return;
    const san = moveResult.san;
    if (expectedMoves.has(san)) {
      setPosition(chess.fen()); setCurrentPath(prev => [...prev, san]); setLastMove([orig, dest]);
      const nextNode = expectedMoves.get(san); setCurrentNode(nextNode); setStatus(STATUS.CORRECT);
      setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 5);
      const newExpected = new Map(); for (const [s, child] of nextNode.children.entries()) newExpected.set(s, child); setExpectedMoves(newExpected);
      if (newExpected.size === 0) { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); return; }
      const isUW = repertoire.color === 'white'; const tw = chess.turn() === 'w'; const iu = (isUW && tw) || (!isUW && !tw);
      if (iu) { setTimeout(() => { setStatus(STATUS.USER_TURN); setMessage('Your turn — play the correct move!'); }, 600); }
      else { setMessage('Correct! Opponent is thinking...'); setTimeout(() => handleOpponentTurn(nextNode, newExpected), 800); }
    } else {
      chess.undo(); setStatus(STATUS.WRONG); setStats(prev => ({ ...prev, wrong: prev.wrong + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 1);
      const correctArrows = Array.from(expectedMoves.keys()).map(s => { const tc = new Chess(chess.fen()); const m = tc.move(s); return m ? [m.from, m.to] : null; }).filter(Boolean);
      setHintArrows(correctArrows);
      setMessage(`❌ Wrong! Correct: ${Array.from(expectedMoves.keys()).join(', ')}`);
      setTimeout(() => { setStatus(STATUS.USER_TURN); setHintArrows([]); setMessage('Try again!'); }, 2000);
    }
  }, [chess, status, expectedMoves, repertoire, handleOpponentTurn]);

  const handleNextLine = useCallback(() => {
    const ni = lineIndex + 1;
    if (ni >= allLines.length) { const rs = [...allLines].sort(() => Math.random() - 0.5); setAllLines(rs); setLineIndex(0); startLine(rs, 0, tree); }
    else { setLineIndex(ni); startLine(allLines, ni, tree); }
  }, [lineIndex, allLines, tree, startLine]);

  const handleShowHint = useCallback(() => {
    if (expectedMoves.size === 0) return;
    const ca = Array.from(expectedMoves.keys()).map(s => { const tc = new Chess(chess.fen()); const m = tc.move(s); return m ? [m.from, m.to] : null; }).filter(Boolean);
    setHintArrows(ca); setTimeout(() => setHintArrows([]), 1500);
  }, [expectedMoves, chess]);

  const handleRestartLine = useCallback(() => { startLine(allLines, lineIndex, tree); }, [allLines, lineIndex, tree, startLine]);

  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';
  if (!repertoire) return <div className="text-center py-12" style={{ color: 'rgba(160,152,138,0.4)' }}><p>Select a repertoire to practice</p></div>;

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const isUserTurn = status === STATUS.USER_TURN;
  const isComplete = status === STATUS.LINE_COMPLETE;
  const theme = getBoardTheme(boardTheme);

  // Compute dests for current position
  const dests = useMemo(() => computeDests(position), [position]);
  const turnColor = position.includes(' w ') ? 'white' : 'black';
  const isUserColor = (repertoire.color === 'white' && turnColor === 'white') || (repertoire.color === 'black' && turnColor === 'black');

  // Build autoShapes for hint arrows
  const autoShapes = useMemo(() => {
    if (hintArrows.length === 0) return [];
    return hintArrows.map(([from, to]) => ({
      orig: from,
      dest: to,
      brush: 'green',
    }));
  }, [hintArrows]);

  const cgConfig = useMemo(() => ({
    fen: position,
    orientation,
    turnColor,
    lastMove: lastMove ? [lastMove[0], lastMove[1]] : undefined,
    coordinates: true,
    highlight: {
      lastMove: true,
      check: true,
    },
    animation: {
      enabled: true,
      duration: 200,
    },
    movable: {
      free: false,
      dests: isUserTurn ? dests : new Map(),
      showDests: true,
      color: isUserTurn ? turnColor : undefined,
      events: {
        after: handleUserMove,
      },
    },
    draggable: {
      enabled: isUserTurn,
      showGhost: true,
    },
    selectable: {
      enabled: isUserTurn,
    },
    drawable: {
      enabled: false,
      visible: true,
      autoShapes,
    },
  }), [position, orientation, turnColor, lastMove, dests, isUserTurn, handleUserMove, autoShapes]);

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>← Back</button>
          <div>
            <h2 className="font-orbitron font-bold text-sm" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>{repertoire.name}</h2>
            <p className="text-xs" style={{ color: 'rgba(150,142,130,0.5)' }}>{openingName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: '#6b8cae' }}>✓ {stats.correct}</span>
          <span style={{ color: '#ff6b6b' }}>✗ {stats.wrong}</span>
          <span style={{ color: '#cbd5e1' }}>{accuracy}%</span>
          <span style={{ color: 'rgba(160,152,138,0.4)' }} className="text-xs">Line {lineIndex + 1}/{allLines.length}</span>
        </div>
      </div>

      {/* Board + Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-shrink-0 space-y-2">
          <div className="board-appear">
            <div className="rounded-lg overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', width: 'clamp(280px, 50vw, 520px)', aspectRatio: '1' }}>
              <ChessgroundBoard
                config={cgConfig}
                boardTheme={{ light: theme.lightSquare, dark: theme.darkSquare }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BoardThemePicker currentTheme={boardTheme} onThemeChange={onBoardThemeChange} compact />
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 text-[10px] rounded transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>⟳ Flip</button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex-1 min-w-0 space-y-3 lg:max-w-xs w-full slide-in-right">
          {/* Status */}
          <div className="rounded-xl p-4" style={{
            background: status === STATUS.CORRECT ? 'rgba(107,140,174,0.12)' : status === STATUS.WRONG ? 'rgba(255,107,107,0.08)' : isComplete ? 'rgba(168,131,74,0.12)' : 'rgba(15,20,40,0.6)',
            border: `1px solid ${status === STATUS.CORRECT ? 'rgba(107,140,174,0.3)' : status === STATUS.WRONG ? 'rgba(255,107,107,0.2)' : isComplete ? 'rgba(168,131,74,0.3)' : 'rgba(107,140,174,0.08)'}`,
          }}>
            <p className="text-sm font-medium" style={{ color: status === STATUS.CORRECT ? '#8daac4' : status === STATUS.WRONG ? '#ff6b6b' : isComplete ? '#a8834a' : '#cbd5e1' }}>
              {message || (isUserTurn ? 'Your turn!' : 'Waiting...')}
            </p>
          </div>

          {/* Moves */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>MOVES</h3>
            <div className="flex flex-wrap gap-1">
              {currentPath.map((move, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{
                  background: i === currentPath.length - 1 ? 'rgba(107,140,174,0.15)' : 'rgba(107,140,174,0.04)',
                  color: i === currentPath.length - 1 ? '#8daac4' : 'rgba(160,152,138,0.6)',
                }}>
                  {i % 2 === 0 && <span style={{ color: 'rgba(160,152,138,0.4)' }} className="mr-0.5">{Math.floor(i / 2) + 1}.</span>}
                  {move}
                </span>
              ))}
              {currentPath.length === 0 && <span className="text-xs italic" style={{ color: 'rgba(160,152,138,0.3)' }}>No moves yet</span>}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {isUserTurn && (
              <button onClick={handleShowHint} className="px-3 py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a' }}>💡 Hint</button>
            )}
            <button onClick={handleRestartLine} className="px-3 py-2 text-xs rounded-lg transition-all" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>↺ Restart</button>
            {isComplete && (
              <button onClick={handleNextLine} className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc' }}>NEXT →</button>
            )}
          </div>

          {/* Info */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO PRACTICE</h3>
            <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
              <li>• Drag or click to play moves</li>
              <li>• Wrong moves are shown with red arrows</li>
              <li>• Use 💡 Hint to see the correct move</li>
              <li>• Green highlights confirm correct moves</li>
              <li>• Progress is saved automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
