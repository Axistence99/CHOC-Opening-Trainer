import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, getLeafPaths } from '../utils/pgnParser';
import { getPracticeHistory, updatePracticeEntry } from '../utils/storage';
import { getOpeningFromMoves } from '../data/ecoOpenings';
import { getBoardTheme, getBoardThemeBackground } from '../data/boardThemes';
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
  } catch { return new Map(); }
}

// Build all positions + annotations from a line of SAN moves
function buildLinePositions(moves) {
  const chess = new Chess();
  const steps = [{ fen: chess.fen(), lastMove: null, san: null, annotation: 'Starting position' }];
  for (let i = 0; i < moves.length; i++) {
    const m = chess.move(moves[i]);
    if (!m) break;
    const moveNum = Math.floor(i / 2) + 1;
    const prefix = i % 2 === 0 ? `${moveNum}. ` : (i === 1 ? '' : `${moveNum}... `);
    steps.push({ fen: chess.fen(), lastMove: [m.from, m.to], san: m.san, annotation: `${prefix}${m.san}` });
  }
  return steps;
}

// Move explanations database (common opening ideas)
const MOVE_IDEAS = {
  'e4': 'Control the center and open lines for the bishop and queen.',
  'd4': 'Control the center with the queen pawn.',
  'Nf3': 'Develop the knight and prepare to control the center.',
  'Nc3': 'Develop the knight and fight for the center.',
  'Bf4': 'Develop the bishop outside the pawn chain (London System idea).',
  'Bb5': 'Pin the knight defending the e5 pawn (Ruy López).',
  'Bc4': 'Develop the bishop targeting the f7 weak square.',
  'c5': 'Challenge the center with a flank pawn (Sicilian).',
  'e5': 'Occupy the center and open lines.',
  'd5': 'Challenge the center directly.',
  'c4': 'Offer a pawn sacrifice for center control (Queen\'s Gambit).',
  'g6': 'Fianchetto the dark-squared bishop (King\'s Indian setup).',
  'e6': 'Solidify the pawn chain (French / Queen\'s Gambit Declined).',
  'Nf6': 'Develop the knight and control the center.',
  'Nc6': 'Develop the knight defending the e5 pawn.',
  'd6': 'Support the c5 pawn and prepare development (Sicilian).',
  'Be7': 'Develop the bishop and prepare castling.',
  'O-O': 'Castle to safety and connect the rooks.',
  'a6': 'Useful waiting move — chases the bishop off the a4–b5 diagonal.',
  'b5': 'Gain space on the queenside.',
  'Re1': 'Place the rook on the semi-open e-file.',
  'Bd3': 'Develop the bishop and prepare castling.',
  'h3': 'Prevent the enemy bishop from pinning on the g4 square.',
  'e3': 'Support the d4 pawn and open the dark-squared bishop.',
};

function getMoveIdea(san) {
  return MOVE_IDEAS[san] || null;
}

export default function PracticeMode({ repertoire, onExit, boardTheme, onBoardThemeChange }) {
  const [mode, setMode] = useState('study'); // 'study' or 'training'
  const [chess] = useState(() => new Chess());
  const [position, setPosition] = useState(chess.fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState(STATUS.READY);
  const [currentPath, setCurrentPath] = useState([]);
  const [expectedMoves, setExpectedMoves] = useState(new Map());
  const [message, setMessage] = useState('');
  const [tree, setTree] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [allLines, setAllLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [hintArrows, setHintArrows] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const containerRef = useRef(null);

  // Study mode state
  const [studyStep, setStudyStep] = useState(0);
  const [studyPositions, setStudyPositions] = useState([]);

  useEffect(() => {
    if (!repertoire) return;
    const parsedTree = repertoire.tree || parsePGNToTree(repertoire.pgn);
    setTree(parsedTree); setCurrentNode(parsedTree);
    setOrientation(repertoire.color === 'white' ? 'white' : 'black');
    const lines = getLeafPaths(parsedTree);
    const shuffled = [...lines].sort(() => Math.random() - 0.5);
    setAllLines(shuffled); setLineIndex(0);
    setStats({ correct: 0, wrong: 0, total: 0 });

    if (mode === 'study' && shuffled.length > 0) {
      initStudyLine(shuffled, 0, parsedTree);
    } else if (shuffled.length > 0) {
      startLine(shuffled, 0, parsedTree);
    }
  }, [repertoire]);

  // When switching modes, re-init
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    if (!tree || allLines.length === 0) return;
    chess.reset(); setPosition(chess.fen()); setCurrentPath([]);
    setHintArrows([]); setLastMove(null); setStats({ correct: 0, wrong: 0, total: 0 });

    if (newMode === 'study') {
      initStudyLine(allLines, 0, tree);
    } else {
      setLineIndex(0);
      startLine(allLines, 0, tree);
    }
  }, [tree, allLines, chess]);

  // ─── STUDY MODE ───
  const initStudyLine = useCallback((lines, idx, rootNode) => {
    if (!lines || lines.length === 0 || idx >= lines.length) { setStatus(STATUS.COMPLETE); return; }
    const line = lines[idx];
    const sans = line.map(m => m.san);
    const positions = buildLinePositions(sans);
    setStudyPositions(positions);
    setStudyStep(0);
    chess.reset(); setPosition(chess.fen()); setCurrentPath([]);
    setLastMove(null);
    setMessage(`Line ${idx + 1} of ${lines.length}`);
  }, [chess]);

  const studyForward = useCallback(() => {
    if (studyStep >= studyPositions.length - 1) return;
    const next = studyStep + 1;
    setStudyStep(next);
    const p = studyPositions[next];
    setPosition(p.fen);
    setLastMove(p.lastMove);
    setCurrentPath(studyPositions.slice(1, next + 1).map(s => s.san));
  }, [studyStep, studyPositions]);

  const studyBack = useCallback(() => {
    if (studyStep <= 0) return;
    const prev = studyStep - 1;
    setStudyStep(prev);
    const p = studyPositions[prev];
    setPosition(p.fen);
    setLastMove(p.lastMove);
    setCurrentPath(studyPositions.slice(1, prev + 1).map(s => s.san));
  }, [studyStep, studyPositions]);

  const studyReset = useCallback(() => {
    setStudyStep(0);
    chess.reset(); setPosition(chess.fen()); setCurrentPath([]); setLastMove(null);
  }, [chess]);

  const studyEnd = useCallback(() => {
    const last = studyPositions.length - 1;
    setStudyStep(last);
    const p = studyPositions[last];
    setPosition(p.fen);
    setLastMove(p.lastMove);
    setCurrentPath(studyPositions.slice(1).map(s => s.san));
  }, [studyPositions]);

  // ─── TRAINING MODE ───
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
    else { if (expected.size > 0) { handleOpponentTurnImmediate(node, expected); } else { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); } }
  }, [chess, repertoire, tree]);

  const handleOpponentTurnImmediate = useCallback((node, expectedMap) => {
    if (expectedMap.size === 0) return;
    const arr = Array.from(expectedMap.keys()); const rm = arr[Math.floor(Math.random() * arr.length)]; const move = chess.move(rm);
    if (move) { setPosition(chess.fen()); setCurrentPath(prev => [...prev, rm]); setLastMove([move.from, move.to]); const nn = expectedMap.get(rm); setCurrentNode(nn); const ne = new Map(); for (const [s, c] of nn.children.entries()) ne.set(s, c); setExpectedMoves(ne); const isUW = repertoire.color === 'white'; const tw = chess.turn() === 'w'; const iu = (isUW && tw) || (!isUW && !tw); if (iu && ne.size > 0) { setStatus(STATUS.USER_TURN); setMessage('Your turn — play the correct move!'); } else if (ne.size === 0) { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); } else { setTimeout(() => handleOpponentTurnDelayed(nn, ne), 600); } }
  }, [chess, repertoire]);

  const handleOpponentTurnDelayed = useCallback((node, expectedMap) => {
    handleOpponentTurnImmediate(node, expectedMap);
  }, [handleOpponentTurnImmediate]);

  const handleUserMove = useCallback((orig, dest) => {
    if (status !== STATUS.USER_TURN) return;
    const moveResult = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!moveResult) return;
    const san = moveResult.san;
    if (expectedMoves.has(san)) {
      setPosition(chess.fen()); setCurrentPath(prev => [...prev, san]); setLastMove([orig, dest]);
      const nextNode = expectedMoves.get(san); setCurrentNode(nextNode); setStatus(STATUS.CORRECT);
      setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 4);
      const newExpected = new Map(); for (const [s, child] of nextNode.children.entries()) newExpected.set(s, child); setExpectedMoves(newExpected);
      if (newExpected.size === 0) { setStatus(STATUS.LINE_COMPLETE); setMessage('✅ Line complete!'); return; }
      const isUW = repertoire.color === 'white'; const tw = chess.turn() === 'w'; const iu = (isUW && tw) || (!isUW && !tw);
      if (iu) { setTimeout(() => { setStatus(STATUS.USER_TURN); setMessage('Your turn — play the correct move!'); }, 400); }
      else { setMessage('✓ Correct! Opponent responding...'); setTimeout(() => handleOpponentTurnDelayed(nextNode, newExpected), 700); }
    } else {
      chess.undo(); setStatus(STATUS.WRONG); setStats(prev => ({ ...prev, wrong: prev.wrong + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 1);
      const correctArrows = Array.from(expectedMoves.keys()).map(s => { const tc = new Chess(chess.fen()); const m = tc.move(s); return m ? [m.from, m.to] : null; }).filter(Boolean);
      setHintArrows(correctArrows);
      setMessage(`❌ Wrong! Correct: ${Array.from(expectedMoves.keys()).join(', ')}`);
      setTimeout(() => { setStatus(STATUS.USER_TURN); setHintArrows([]); setMessage('Try again!'); }, 2000);
    }
  }, [chess, status, expectedMoves, repertoire, handleOpponentTurnDelayed]);

  const handleNextLine = useCallback(() => {
    const ni = lineIndex + 1;
    if (ni >= allLines.length) { const rs = [...allLines].sort(() => Math.random() - 0.5); setAllLines(rs); setLineIndex(0); if (mode === 'study') initStudyLine(rs, 0, tree); else startLine(rs, 0, tree); }
    else { setLineIndex(ni); if (mode === 'study') initStudyLine(allLines, ni, tree); else startLine(allLines, ni, tree); }
  }, [lineIndex, allLines, tree, mode, startLine, initStudyLine]);

  const handleShowHint = useCallback(() => {
    if (expectedMoves.size === 0) return;
    const ca = Array.from(expectedMoves.keys()).map(s => { const tc = new Chess(chess.fen()); const m = tc.move(s); return m ? [m.from, m.to] : null; }).filter(Boolean);
    setHintArrows(ca); setTimeout(() => setHintArrows([]), 1500);
  }, [expectedMoves, chess]);

  const handleRestartLine = useCallback(() => {
    if (mode === 'study') initStudyLine(allLines, lineIndex, tree);
    else startLine(allLines, lineIndex, tree);
  }, [allLines, lineIndex, tree, mode, startLine, initStudyLine]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (mode === 'study') {
        if (e.key === 'ArrowRight') studyForward();
        if (e.key === 'ArrowLeft') studyBack();
        if (e.key === 'Home') studyReset();
        if (e.key === 'End') studyEnd();
      }
      if (e.key === 'f') setOrientation(o => o === 'white' ? 'black' : 'white');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, studyForward, studyBack, studyReset, studyEnd]);

  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const isUserTurn = mode === 'training' && status === STATUS.USER_TURN;
  const isComplete = status === STATUS.LINE_COMPLETE;
  const theme = getBoardTheme(boardTheme);
  const boardBg = getBoardThemeBackground(boardTheme);

  const dests = useMemo(() => computeDests(position), [position]);
  const turnColor = position.includes(' w ') ? 'white' : 'black';

  // Study mode: compute arrows for next move(s)
  const studyArrows = useMemo(() => {
    if (mode !== 'study' || studyStep >= studyPositions.length - 1) return [];
    const nextPos = studyPositions[studyStep + 1];
    if (nextPos?.lastMove) {
      return [{ orig: nextPos.lastMove[0], dest: nextPos.lastMove[1], brush: 'green' }];
    }
    return [];
  }, [mode, studyStep, studyPositions]);

  // Training mode: hint arrows
  const trainingArrows = useMemo(() => {
    if (mode !== 'training' || hintArrows.length === 0) return [];
    return hintArrows.map(([from, to]) => ({ orig: from, dest: to, brush: 'green' }));
  }, [mode, hintArrows]);

  const autoShapes = mode === 'study' ? studyArrows : trainingArrows;

  // Study mode info
  const currentStudySan = studyPositions[studyStep]?.san;
  const currentStudyAnnotation = studyPositions[studyStep]?.annotation || 'Starting position';
  const studyMoveIdea = currentStudySan ? getMoveIdea(currentStudySan) : null;
  const studyProgress = studyPositions.length > 1 ? (studyStep / (studyPositions.length - 1)) * 100 : 0;

  const cgConfig = useMemo(() => ({
    fen: position,
    orientation,
    turnColor,
    lastMove: lastMove ? [lastMove[0], lastMove[1]] : undefined,
    coordinates: true,
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 200 },
    movable: {
      free: false,
      dests: isUserTurn ? dests : new Map(),
      showDests: true,
      color: isUserTurn ? 'both' : undefined,
      events: { after: handleUserMove },
    },
    draggable: { enabled: isUserTurn, showGhost: true },
    selectable: { enabled: isUserTurn },
    drawable: { enabled: false, visible: true, autoShapes },
  }), [position, orientation, turnColor, lastMove, dests, isUserTurn, handleUserMove, autoShapes]);

  // Mode toggle style helper
  const modeBtn = (m, label) => ({
    padding: '4px 10px',
    fontSize: '0.6rem',
    fontFamily: "'Orbitron', sans-serif",
    letterSpacing: '0.06em',
    fontWeight: mode === m ? 700 : 400,
    color: mode === m ? '#ddd8cc' : 'rgba(160,152,138,0.5)',
    background: mode === m ? 'rgba(107,140,174,0.2)' : 'rgba(107,140,174,0.04)',
    border: `1px solid ${mode === m ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.08)'}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  if (!repertoire) return <div className="text-center py-12" style={{ color: 'rgba(160,152,138,0.4)' }}><p>Select a repertoire to practice</p></div>;

  return (
    <div ref={containerRef} className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-1.5 md:gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="px-2 md:px-3 py-1 md:py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>← Back</button>
          <div>
            <h2 className="font-orbitron font-bold text-sm" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>{repertoire.name}</h2>
            <p className="text-xs" style={{ color: 'rgba(150,142,130,0.5)' }}>{openingName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex gap-1.5">
            <button onClick={() => switchMode('study')} style={modeBtn('study', 'Study')}>📖 STUDY</button>
            <button onClick={() => switchMode('training')} style={modeBtn('training', 'Training')}>🎯 TRAIN</button>
          </div>
          {mode === 'training' && (
            <div className="flex items-center gap-3 text-sm">
              <span style={{ color: '#6b8cae' }}>✓ {stats.correct}</span>
              <span style={{ color: '#ff6b6b' }}>✗ {stats.wrong}</span>
              <span style={{ color: '#cbd5e1' }}>{accuracy}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Board + Controls */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-start">
        <div className="flex-shrink-0 space-y-2 w-full lg:w-auto">
          <div>
            <div className="rounded-lg overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', width: 'min(calc(100vw - 40px), 520px)' }}>
              <ChessgroundBoard
                config={cgConfig}
                boardTheme={boardBg}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <BoardThemePicker currentTheme={boardTheme} onThemeChange={onBoardThemeChange} compact />
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 text-[10px] rounded transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>⟳ Flip</button>
            <span className="text-[10px]" style={{ color: 'rgba(160,152,138,0.3)' }}>Line {lineIndex + 1}/{allLines.length}</span>
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex-1 min-w-0 space-y-2 md:space-y-3 lg:max-w-xs w-full">

          {/* ─── STUDY MODE PANEL ─── */}
          {mode === 'study' && (
            <>
              {/* Current move annotation */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontFamily: "'Orbitron', sans-serif", color: '#a8834a', fontSize: '0.75rem', letterSpacing: '0.1em', fontWeight: 700 }}>{currentStudyAnnotation}</span>
                </div>
                {studyMoveIdea && (
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(160,152,138,0.7)' }}>{studyMoveIdea}</p>
                )}
                {!studyMoveIdea && studyStep < studyPositions.length - 1 && (
                  <p className="text-sm italic" style={{ color: 'rgba(160,152,138,0.4)' }}>Advance to see the next move</p>
                )}
                {studyStep === 0 && (
                  <p className="text-sm" style={{ color: 'rgba(160,152,138,0.5)' }}>Starting position. Press → to begin the line.</p>
                )}
              </div>

              {/* Arrow legend */}
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                <div className="w-6 h-1 rounded" style={{ background: '#6b8cae' }} />
                <span className="text-[11px]" style={{ color: 'rgba(160,152,138,0.6)' }}>Green arrow = next move</span>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>PROGRESS</span>
                  <span className="text-[10px] font-orbitron" style={{ color: '#8daac4' }}>{studyStep} / {studyPositions.length - 1}</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(107,140,174,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${studyProgress}%`, background: 'linear-gradient(90deg, #6b8cae, #7a8caa)' }} />
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
                <button onClick={studyReset} className="px-2 md:px-3 py-1.5 md:py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)', color: '#7a746a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>↺</button>
                <button onClick={studyBack} disabled={studyStep === 0} className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30" style={{ background: 'rgba(107,140,174,0.12)', border: '1px solid rgba(107,140,174,0.28)', color: '#8daac4', fontSize: '1rem', cursor: studyStep === 0 ? 'not-allowed' : 'pointer' }}>‹</button>
                <button onClick={studyForward} disabled={studyStep >= studyPositions.length - 1} className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30" style={{ background: studyStep >= studyPositions.length - 1 ? 'rgba(107,140,174,0.08)' : 'rgba(107,140,174,0.18)', border: '1px solid rgba(107,140,174,0.35)', color: '#a8c0d6', fontSize: '1rem', cursor: studyStep >= studyPositions.length - 1 ? 'not-allowed' : 'pointer' }}>›</button>
                <button onClick={studyEnd} className="px-2 md:px-3 py-1.5 md:py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>END →</button>
              </div>

              {/* Moves list */}
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
                  {currentPath.length === 0 && <span className="text-xs italic" style={{ color: 'rgba(160,152,138,0.3)' }}>Starting position</span>}
                </div>
              </div>

              {isComplete || studyStep >= studyPositions.length - 1 ? (
                <button onClick={handleNextLine} className="w-full px-4 py-2.5 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc' }}>NEXT LINE →</button>
              ) : null}

              {/* Study info */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO STUDY</h3>
                <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
                  <li>• Use ← → keys or buttons to step through</li>
                  <li>• Green arrow shows the next move</li>
                  <li>• Each move has an idea or explanation</li>
                  <li>• Study all lines, then switch to Training</li>
                </ul>
              </div>
            </>
          )}

          {/* ─── TRAINING MODE PANEL ─── */}
          {mode === 'training' && (
            <>
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

              {/* Training info */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO TRAIN</h3>
                <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
                  <li>• Play your moves from the repertoire</li>
                  <li>• The computer auto-responds with the book move</li>
                  <li>• Wrong moves show red arrows for the correct one</li>
                  <li>• Use 💡 Hint if you're stuck</li>
                  <li>• Your accuracy is tracked automatically</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
