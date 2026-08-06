import { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, getLeafPaths, countPositions } from '../utils/pgnParser';
import { updatePracticeEntry, updateRepertoire } from '../utils/storage';
import { getOpeningFromMoves } from '../data/ecoOpenings';
import { getBoardTheme, getBoardThemeBackground } from '../data/boardThemes';
import BoardThemePicker from './BoardThemePicker';
import ChessgroundBoard from './ChessgroundBoard';

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

// Build a linear path of positions from the tree for study navigation
function buildStudyPath(tree) {
  const path = [{ fen: tree.fen, move: null, san: null, from: null, to: null, comment: null, depth: 0 }];
  let node = tree;
  while (node.children.size > 0) {
    // Take the first (main) line
    const [san, child] = node.children.entries().next().value;
    path.push({
      fen: child.fen,
      move: child.move,
      san,
      from: child.move?.from,
      to: child.move?.to,
      comment: child.comment || null,
      depth: child.depth,
    });
    node = child;
  }
  return path;
}

// Build all lines (for training)
function buildAllLines(tree) {
  return getLeafPaths(tree);
}

// Format move notation with numbers
function formatMoveNotation(moves, upToIndex) {
  const parts = [];
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    const san = moves[i];
    if (i % 2 === 0) {
      parts.push(`${Math.floor(i / 2) + 1}. ${san}`);
    } else {
      parts.push(san);
    }
  }
  return parts.join(' ');
}

export default function RepertoirePage({ repertoire, onExit, boardTheme, onBoardThemeChange, onRepertoireUpdate }) {
  const [mode, setMode] = useState('study'); // 'study' | 'train' | 'edit'
  const [chess] = useState(() => new Chess());
  const [position, setPosition] = useState(chess.fen());
  const [orientation, setOrientation] = useState(repertoire?.color === 'black' ? 'black' : 'white');
  const [lastMove, setLastMove] = useState(null);
  const [currentPath, setCurrentPath] = useState([]); // SAN moves played
  const [tree, setTree] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);

  // Study state
  const [studyStep, setStudyStep] = useState(0);
  const [studyPath, setStudyPath] = useState([]);

  // Train state
  const [trainStatus, setTrainStatus] = useState('waiting'); // waiting | user_turn | correct | wrong | complete
  const [trainMessage, setTrainMessage] = useState('');
  const [expectedMoves, setExpectedMoves] = useState(new Map());
  const [allLines, setAllLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [wrongSquare, setWrongSquare] = useState(null); // { from, to } for red X

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaved, setEditSaved] = useState(false);

  // Board settings
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize tree from repertoire
  useEffect(() => {
    if (!repertoire) return;
    const parsedTree = repertoire.tree || parsePGNToTree(repertoire.pgn);
    setTree(parsedTree);
    setCurrentNode(parsedTree);
    setOrientation(repertoire.color === 'black' ? 'black' : 'white');
    setEditName(repertoire.name);
    setEditDescription(repertoire.description || '');

    // Study path
    const sp = buildStudyPath(parsedTree);
    setStudyPath(sp);
    setStudyStep(0);

    // Training lines
    const lines = buildAllLines(parsedTree);
    const shuffled = [...lines].sort(() => Math.random() - 0.5);
    setAllLines(shuffled);
    setLineIndex(0);
    setStats({ correct: 0, wrong: 0, total: 0 });

    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
    setTrainStatus('waiting');
  }, [repertoire]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── STUDY MODE ───
  const studyForward = useCallback(() => {
    if (studyStep >= studyPath.length - 1) return;
    const next = studyStep + 1;
    setStudyStep(next);
    const p = studyPath[next];
    setPosition(p.fen);
    setLastMove(p.from && p.to ? [p.from, p.to] : null);
    setCurrentPath(studyPath.slice(1, next + 1).map(s => s.san).filter(Boolean));
  }, [studyStep, studyPath]);

  const studyBack = useCallback(() => {
    if (studyStep <= 0) return;
    const prev = studyStep - 1;
    setStudyStep(prev);
    const p = studyPath[prev];
    setPosition(p.fen);
    setLastMove(p.from && p.to ? [p.from, p.to] : null);
    setCurrentPath(studyPath.slice(1, prev + 1).map(s => s.san).filter(Boolean));
  }, [studyStep, studyPath]);

  const studyReset = useCallback(() => {
    setStudyStep(0);
    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
  }, [chess]);

  const studyEnd = useCallback(() => {
    const last = studyPath.length - 1;
    setStudyStep(last);
    const p = studyPath[last];
    setPosition(p.fen);
    setLastMove(p.from && p.to ? [p.from, p.to] : null);
    setCurrentPath(studyPath.slice(1).map(s => s.san).filter(Boolean));
  }, [studyPath]);

  // ─── TRAIN MODE ───
  const startTrainLine = useCallback((lines, idx, rootNode) => {
    if (!lines || lines.length === 0 || idx >= lines.length) {
      setTrainStatus('complete');
      setTrainMessage('All lines completed!');
      return;
    }
    const line = lines[idx];
    const isUserWhite = repertoire.color === 'white';
    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
    setWrongSquare(null);
    setTrainMessage(`Line ${idx + 1} of ${lines.length}`);

    let node = rootNode || tree;
    // If user plays black, computer (white) makes the first move
    if (!isUserWhite) {
      const firstMove = line[0];
      if (firstMove) {
        const move = chess.move(firstMove.san);
        if (move) {
          setPosition(chess.fen());
          setCurrentPath([firstMove.san]);
          node = node.children.get(firstMove.san) || node;
          setLastMove([move.from, move.to]);
        }
      }
    }
    setCurrentNode(node);
    const expected = new Map();
    for (const [san, child] of node.children.entries()) expected.set(san, child);
    setExpectedMoves(expected);

    const turnIsWhite = chess.turn() === 'w';
    const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);
    if (isUserTurn) {
      setTrainStatus('user_turn');
      setTrainMessage('Your turn — play the correct move');
    } else if (expected.size > 0) {
      // Computer responds immediately
      const arr = Array.from(expected.keys());
      const rm = arr[Math.floor(Math.random() * arr.length)];
      const move = chess.move(rm);
      if (move) {
        setPosition(chess.fen());
        setCurrentPath(prev => [...prev, rm]);
        setLastMove([move.from, move.to]);
        const nn = expected.get(rm);
        setCurrentNode(nn);
        const ne = new Map();
        for (const [s, c] of nn.children.entries()) ne.set(s, c);
        setExpectedMoves(ne);
        const tw = chess.turn() === 'w';
        const iu = (isUserWhite && tw) || (!isUserWhite && !tw);
        if (iu && ne.size > 0) {
          setTrainStatus('user_turn');
          setTrainMessage('Your turn — play the correct move');
        } else if (ne.size === 0) {
          setTrainStatus('complete');
          setTrainMessage('✅ Line complete!');
        }
      }
    } else {
      setTrainStatus('complete');
      setTrainMessage('✅ Line complete!');
    }
  }, [chess, repertoire, tree]);

  const handleTrainUserMove = useCallback((orig, dest) => {
    if (trainStatus !== 'user_turn') return;
    const moveResult = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!moveResult) return;

    const san = moveResult.san;
    if (expectedMoves.has(san)) {
      // ✅ CORRECT
      setPosition(chess.fen());
      setCurrentPath(prev => [...prev, san]);
      setLastMove([orig, dest]);
      setWrongSquare(null);
      setTrainStatus('correct');
      setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 5);

      const nextNode = expectedMoves.get(san);
      setCurrentNode(nextNode);
      const newExpected = new Map();
      for (const [s, child] of nextNode.children.entries()) newExpected.set(s, child);
      setExpectedMoves(newExpected);

      if (newExpected.size === 0) {
        setTrainStatus('complete');
        setTrainMessage('✅ Line complete!');
        return;
      }

      // Check if it's still user's turn or computer responds
      const isUserWhite = repertoire.color === 'white';
      const tw = chess.turn() === 'w';
      const isUserTurn = (isUserWhite && tw) || (!isUserWhite && !tw);

      if (isUserTurn) {
        setTimeout(() => {
          setTrainStatus('user_turn');
          setTrainMessage('Your turn — play the correct move');
        }, 400);
      } else {
        // Computer auto-responds with book move
        setTrainMessage('✓ Correct!');
        setTimeout(() => {
          const arr = Array.from(newExpected.keys());
          const rm = arr[Math.floor(Math.random() * arr.length)];
          const move = chess.move(rm);
          if (move) {
            setPosition(chess.fen());
            setCurrentPath(prev => [...prev, rm]);
            setLastMove([move.from, move.to]);
            const nn = newExpected.get(rm);
            setCurrentNode(nn);
            const ne = new Map();
            for (const [s, c] of nn.children.entries()) ne.set(s, c);
            setExpectedMoves(ne);
            const tw2 = chess.turn() === 'w';
            const iu2 = (isUserWhite && tw2) || (!isUserWhite && !tw2);
            if (iu2 && ne.size > 0) {
              setTrainStatus('user_turn');
              setTrainMessage('Your turn — play the correct move');
            } else if (ne.size === 0) {
              setTrainStatus('complete');
              setTrainMessage('✅ Line complete!');
            }
          }
        }, 600);
      }
    } else {
      // ❌ WRONG — show red X, then rewind with animation
      chess.undo();
      setWrongSquare({ from: orig, to: dest });
      setTrainStatus('wrong');
      setStats(prev => ({ ...prev, wrong: prev.wrong + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 1);

      const correctSans = Array.from(expectedMoves.keys());
      setTrainMessage(`Wrong! Correct: ${correctSans.join(', ')}`);

      // Clear red X and reset status after animation
      setTimeout(() => {
        setWrongSquare(null);
        setTrainStatus('user_turn');
        setTrainMessage('Your turn — try again');
      }, 800);
    }
  }, [chess, trainStatus, expectedMoves, repertoire]);

  const handleNextLine = useCallback(() => {
    const ni = lineIndex + 1;
    if (ni >= allLines.length) {
      const rs = [...allLines].sort(() => Math.random() - 0.5);
      setAllLines(rs);
      setLineIndex(0);
      startTrainLine(rs, 0, tree);
    } else {
      setLineIndex(ni);
      startTrainLine(allLines, ni, tree);
    }
  }, [lineIndex, allLines, tree, startTrainLine]);

  const handleRestartLine = useCallback(() => {
    startTrainLine(allLines, lineIndex, tree);
  }, [allLines, lineIndex, tree, startTrainLine]);

  // ─── EDIT MODE ───
  const handleSaveEdit = useCallback(() => {
    if (!repertoire) return;
    const updates = { name: editName.trim(), description: editDescription.trim() };
    updateRepertoire(repertoire.id, updates);
    if (onRepertoireUpdate) onRepertoireUpdate({ ...repertoire, ...updates });
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  }, [repertoire, editName, editDescription, onRepertoireUpdate]);

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

  if (!repertoire) return null;

  // Board config
  const themeObj = getBoardTheme(boardTheme);
  const boardBg = getBoardThemeBackground(boardTheme);
  const dests = useMemo(() => computeDests(position), [position]);
  const turnColor = position.includes(' w ') ? 'white' : 'black';
  const isUserTurn = mode === 'train' && trainStatus === 'user_turn';

  // Study arrows (show next move)
  const studyArrows = useMemo(() => {
    if (mode !== 'study' || studyStep >= studyPath.length - 1) return [];
    const nextPos = studyPath[studyStep + 1];
    if (nextPos?.from && nextPos?.to) {
      return [{ orig: nextPos.from, dest: nextPos.to, brush: 'green' }];
    }
    return [];
  }, [mode, studyStep, studyPath]);

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
      showDests: isUserTurn,
      color: isUserTurn ? 'both' : undefined,
      events: { after: handleTrainUserMove },
    },
    draggable: { enabled: isUserTurn, showGhost: true },
    selectable: { enabled: isUserTurn },
    drawable: { enabled: false, visible: true, autoShapes: studyArrows },
  }), [position, orientation, turnColor, lastMove, dests, isUserTurn, handleTrainUserMove, studyArrows]);

  // Study info
  const currentStudyStep = studyPath[studyStep];
  const studyProgress = studyPath.length > 1 ? (studyStep / (studyPath.length - 1)) * 100 : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';
  const boardSize = 'min(calc(100vw - 40px), 560px)';

  // Mode button helper
  const modeBtn = (m) => ({
    padding: '5px 12px',
    fontSize: '0.65rem',
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

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#080b14', fontFamily: "'Inter', sans-serif" }}>
      {/* Nebula bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 25% 45%, #0e1828 0%, transparent 58%), radial-gradient(ellipse at 75% 20%, #110e20 0%, transparent 52%), radial-gradient(ellipse at 55% 85%, #0c1520 0%, transparent 50%), #080b14' }} />
      </div>

      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="flex items-center justify-between px-3 md:px-6 py-2.5 border-b" style={{ borderColor: 'rgba(107,140,174,0.12)', background: 'rgba(6,8,16,0.9)' }}>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={onExit} className="px-2.5 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }}>← Back</button>
            <div className="min-w-0">
              <h1 className="font-orbitron font-bold text-sm truncate" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>{repertoire.name}</h1>
              <p className="text-[10px] truncate" style={{ color: 'rgba(150,142,130,0.5)' }}>{openingName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex gap-1">
              <button onClick={() => { setMode('study'); studyReset(); }} style={modeBtn('study')}>📖 STUDY</button>
              <button onClick={() => { setMode('train'); chess.reset(); setPosition(chess.fen()); setCurrentPath([]); setLastMove(null); if (tree && allLines.length > 0) startTrainLine(allLines, 0, tree); }} style={modeBtn('train')}>🎯 TRAIN</button>
              <button onClick={() => setMode('edit')} style={modeBtn('edit')}>✏️ EDIT</button>
            </div>
            {mode === 'train' && (
              <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: 'rgba(150,142,130,0.6)' }}>
                <span style={{ color: '#6b8cae' }}>✓{stats.correct}</span>
                <span style={{ color: '#ff6b6b' }}>✗{stats.wrong}</span>
                <span style={{ color: '#cbd5e1' }}>{accuracy}%</span>
              </div>
            )}
            <button onClick={() => setSettingsOpen(v => !v)} title="Settings" className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-105" style={{ background: settingsOpen ? 'rgba(107,140,174,0.18)' : 'rgba(107,140,174,0.07)', border: `1px solid ${settingsOpen ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.14)'}`, color: settingsOpen ? '#8daac4' : '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>⚙</button>
          </div>
        </header>

        {/* Settings row */}
        {settingsOpen && (
          <div className="border-b px-3 md:px-6 py-2.5 overflow-x-auto" style={{ background: 'rgba(6,8,16,0.92)', borderColor: 'rgba(107,140,174,0.1)' }}>
            <div className="flex flex-nowrap gap-4 min-w-max items-center">
              <BoardThemePicker currentTheme={boardTheme} onThemeChange={onBoardThemeChange} compact />
              <div className="w-px h-6" style={{ background: 'rgba(107,140,174,0.12)' }} />
              <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.08)', border: '1px solid rgba(107,140,174,0.18)', color: '#8daac4', cursor: 'pointer' }}>⟳ Flip</button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Board area — pb-44 on mobile to clear the bottom panel */}
          <main className="flex-1 flex flex-col items-center justify-center p-2 pb-44 md:p-6 md:pb-6 gap-3">
            {/* Board */}
            <div className="relative">
              <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
                <div style={{ width: boardSize }}>
                  <ChessgroundBoard config={cgConfig} boardTheme={boardBg} />
                </div>
                {/* Wrong move red X overlay */}
                {wrongSquare && (
                  <div className="absolute pointer-events-none" style={{
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 10,
                  }}>
                    <div style={{
                      position: 'absolute',
                      // Position X at the destination square
                      // We overlay the whole board with a red tint + X
                      inset: 0,
                      background: 'rgba(255, 50, 50, 0.08)',
                      transition: 'opacity 0.3s',
                    }} />
                  </div>
                )}
              </div>
              {/* Wrong move red X badge on the piece */}
              {wrongSquare && (
                <div className="absolute" style={{
                  top: '8px', right: '8px', zIndex: 20,
                  width: '32px', height: '32px',
                  background: 'rgba(255, 60, 60, 0.9)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '1rem', fontWeight: 900, color: '#fff',
                  boxShadow: '0 2px 12px rgba(255,60,60,0.5)',
                  animation: 'fadeInScale 0.2s ease-out',
                }}>✕</div>
              )}
            </div>

            {/* Board controls for Study mode */}
            {mode === 'study' && (
              <div className="flex flex-col items-center gap-2 w-full max-w-sm md:max-w-md">
                {/* Move annotation */}
                <div className="w-full rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.14)' }}>
                  <div style={{ color: '#a8834a', fontFamily: "'Orbitron', sans-serif", fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                    {studyStep === 0 ? 'Starting position' : formatMoveNotation(studyPath.slice(1).map(s => s.san).filter(Boolean), studyStep - 1)}
                  </div>
                </div>
                {/* Progress */}
                <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(107,140,174,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${studyProgress}%`, background: 'linear-gradient(90deg, #6b8cae, #7a8caa)' }} />
                </div>
                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <button onClick={studyReset} className="px-2.5 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)', color: '#7a746a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>↺</button>
                  <button onClick={studyBack} disabled={studyStep === 0} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30" style={{ background: 'rgba(107,140,174,0.12)', border: '1px solid rgba(107,140,174,0.28)', color: '#8daac4', fontSize: '1rem', cursor: studyStep === 0 ? 'not-allowed' : 'pointer' }}>‹</button>
                  <button onClick={studyForward} disabled={studyStep >= studyPath.length - 1} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30" style={{ background: studyStep >= studyPath.length - 1 ? 'rgba(107,140,174,0.08)' : 'rgba(107,140,174,0.18)', border: '1px solid rgba(107,140,174,0.35)', color: '#a8c0d6', fontSize: '1rem', cursor: studyStep >= studyPath.length - 1 ? 'not-allowed' : 'pointer' }}>›</button>
                  <button onClick={studyEnd} className="px-2.5 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>END →</button>
                </div>
              </div>
            )}

            {/* Board controls for Train mode */}
            {mode === 'train' && trainStatus === 'complete' && (
              <button onClick={handleNextLine} className="px-5 py-2.5 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>NEXT LINE →</button>
            )}
            {mode === 'train' && (trainStatus === 'wrong' || trainStatus === 'user_turn') && currentPath.length > 0 && (
              <button onClick={handleRestartLine} className="px-3 py-1.5 text-xs rounded-lg transition-all" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }}>↺ Restart Line</button>
            )}

            {/* Mobile flip button */}
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="md:hidden px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.08)', border: '1px solid rgba(107,140,174,0.18)', color: '#8daac4', cursor: 'pointer' }}>⟳ Flip</button>
          </main>

          {/* Side panel */}
          <aside className="hidden md:flex w-80 lg:w-96 flex-col border-l overflow-y-auto" style={{ background: 'rgba(6,8,16,0.97)', borderLeftColor: 'rgba(107,140,174,0.12)' }}>
            <div className="flex-1 p-4 space-y-4">

              {/* ─── STUDY MODE PANEL ─── */}
              {mode === 'study' && (
                <>
                  {/* Move notation list (lichess-style) */}
                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>MOVES</h3>
                    <div className="flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-xs leading-relaxed" style={{ color: 'rgba(160,152,138,0.7)' }}>
                      {studyPath.slice(1).map((step, i) => {
                        const isCurrent = i === studyStep - 1;
                        const isPast = i < studyStep - 1;
                        return (
                          <span key={i} onClick={() => {
                            setStudyStep(i + 1);
                            setPosition(step.fen);
                            setLastMove(step.from && step.to ? [step.from, step.to] : null);
                            setCurrentPath(studyPath.slice(1, i + 2).map(s => s.san).filter(Boolean));
                          }} className="cursor-pointer transition-colors hover:text-white" style={{
                            color: isCurrent ? '#fff' : isPast ? '#8daac4' : 'rgba(160,152,138,0.4)',
                            fontWeight: isCurrent ? 700 : 400,
                            background: isCurrent ? 'rgba(107,140,174,0.15)' : 'transparent',
                            padding: '1px 3px',
                            borderRadius: 3,
                          }}>
                            {i % 2 === 0 && <span style={{ color: 'rgba(160,152,138,0.35)', marginRight: 2 }}>{Math.floor(i / 2) + 1}.</span>}
                            {step.san}
                          </span>
                        );
                      })}
                      {studyPath.length <= 1 && <span className="italic" style={{ color: 'rgba(160,152,138,0.3)' }}>No moves</span>}
                    </div>
                  </div>

                  {/* Comment / Explanation */}
                  {currentStudyStep?.comment && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(168,131,74,0.08)', border: '1px solid rgba(168,131,74,0.2)' }}>
                      <h3 className="font-orbitron font-semibold text-[10px] mb-1.5" style={{ color: '#a8834a', letterSpacing: '0.1em' }}>COMMENT</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(160,152,138,0.8)' }}>{currentStudyStep.comment}</p>
                    </div>
                  )}

                  {/* Arrow legend */}
                  <div className="rounded-xl p-2.5 flex items-center gap-2.5" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <div className="w-5 h-1 rounded" style={{ background: '#4ade80' }} />
                    <span className="text-[11px]" style={{ color: 'rgba(160,152,138,0.5)' }}>Green arrow = next move</span>
                  </div>

                  {/* Study info */}
                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-1.5" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO STUDY</h3>
                    <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
                      <li>• Use ← → keys or buttons to step</li>
                      <li>• Click moves in notation to jump</li>
                      <li>• Green arrow shows the next move</li>
                      <li>• Switch to Train to test yourself</li>
                    </ul>
                  </div>
                </>
              )}

              {/* ─── TRAIN MODE PANEL ─── */}
              {mode === 'train' && (
                <>
                  {/* Status */}
                  <div className="rounded-xl p-3.5" style={{
                    background: trainStatus === 'correct' ? 'rgba(107,140,174,0.12)' : trainStatus === 'wrong' ? 'rgba(255,107,107,0.08)' : trainStatus === 'complete' ? 'rgba(168,131,74,0.12)' : 'rgba(15,20,40,0.6)',
                    border: `1px solid ${trainStatus === 'correct' ? 'rgba(107,140,174,0.3)' : trainStatus === 'wrong' ? 'rgba(255,107,107,0.2)' : trainStatus === 'complete' ? 'rgba(168,131,74,0.3)' : 'rgba(107,140,174,0.08)'}`,
                  }}>
                    <p className="text-sm font-medium" style={{ color: trainStatus === 'correct' ? '#8daac4' : trainStatus === 'wrong' ? '#ff6b6b' : trainStatus === 'complete' ? '#a8834a' : '#cbd5e1' }}>
                      {trainMessage || (trainStatus === 'user_turn' ? 'Your turn — play the correct move' : 'Waiting...')}
                    </p>
                  </div>

                  {/* Accuracy */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: '#6b8cae' }}>✓ {stats.correct}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: '#ff6b6b' }}>✗ {stats.wrong}</span>
                    </div>
                    <div className="flex-1" />
                    <span className="font-orbitron text-xs" style={{ color: accuracy >= 80 ? '#6b8cae' : accuracy >= 50 ? '#a8834a' : '#ff6b6b' }}>{accuracy}%</span>
                  </div>

                  {/* Move list */}
                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>MOVES</h3>
                    <div className="flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-xs" style={{ color: 'rgba(160,152,138,0.6)' }}>
                      {currentPath.map((move, i) => (
                        <span key={i} style={{
                          color: i === currentPath.length - 1 ? '#8daac4' : 'rgba(160,152,138,0.5)',
                          background: i === currentPath.length - 1 ? 'rgba(107,140,174,0.1)' : 'transparent',
                          padding: '1px 3px',
                          borderRadius: 3,
                        }}>
                          {i % 2 === 0 && <span style={{ color: 'rgba(160,152,138,0.35)', marginRight: 2 }}>{Math.floor(i / 2) + 1}.</span>}
                          {move}
                        </span>
                      ))}
                      {currentPath.length === 0 && <span className="italic" style={{ color: 'rgba(160,152,138,0.3)' }}>No moves yet</span>}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleRestartLine} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }}>↺ Restart</button>
                    {trainStatus === 'complete' && (
                      <button onClick={handleNextLine} className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>NEXT →</button>
                    )}
                  </div>

                  {/* Training info */}
                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-1.5" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO TRAIN</h3>
                    <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
                      <li>• Play your moves from the repertoire</li>
                      <li>• Wrong moves show a red ✕ mark</li>
                      <li>• The board rewinds after wrong moves</li>
                      <li>• Correct moves show ✓ feedback</li>
                      <li>• Computer auto-responds with book moves</li>
                    </ul>
                  </div>
                </>
              )}

              {/* ─── EDIT MODE PANEL ─── */}
              {mode === 'edit' && (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>NAME</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
                    </div>
                    <div>
                      <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>DESCRIPTION</label>
                      <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>
                        {editSaved ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>

                  {/* Repertoire info */}
                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>INFO</h3>
                    <div className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.6)' }}>
                      <p>Color: {repertoire.color === 'white' ? '♔ White' : '♚ Black'}</p>
                      <p>Positions: {repertoire.positionCount || '?'}</p>
                      <p>Lines: {allLines.length}</p>
                      <p>PGN size: {repertoire.pgn?.length || 0} chars</p>
                    </div>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-1.5" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>EDIT TIPS</h3>
                    <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
                      <li>• Edit name and description above</li>
                      <li>• To add/remove moves, edit the PGN</li>
                      <li>• Use Import PGN on the home page</li>
                      <li>• Changes save to local storage</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bottom panel */}
      <div className="md:hidden fixed bottom-0 left-0 right-0" style={{ background: 'rgba(6,8,16,0.97)', borderTop: '1px solid rgba(107,140,174,0.12)', zIndex: 30, maxHeight: '45vh', overflowY: 'auto' }}>
        <div className="p-3 space-y-2">
          {mode === 'study' && (
            <>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-xs" style={{ color: 'rgba(160,152,138,0.7)' }}>
                {studyPath.slice(1).map((step, i) => {
                  const isCurrent = i === studyStep - 1;
                  return (
                    <span key={i} style={{ color: isCurrent ? '#fff' : i < studyStep - 1 ? '#8daac4' : 'rgba(160,152,138,0.4)', fontWeight: isCurrent ? 700 : 400, background: isCurrent ? 'rgba(107,140,174,0.15)' : 'transparent', padding: '1px 3px', borderRadius: 3 }}>
                      {i % 2 === 0 && <span style={{ color: 'rgba(160,152,138,0.35)', marginRight: 2 }}>{Math.floor(i / 2) + 1}.</span>}
                      {step.san}
                    </span>
                  );
                })}
              </div>
              {currentStudyStep?.comment && (
                <p className="text-xs" style={{ color: 'rgba(160,152,138,0.7)' }}>{currentStudyStep.comment}</p>
              )}
            </>
          )}
          {mode === 'train' && (
            <>
              <div className="rounded-lg px-3 py-2" style={{
                background: trainStatus === 'correct' ? 'rgba(107,140,174,0.12)' : trainStatus === 'wrong' ? 'rgba(255,107,107,0.08)' : trainStatus === 'complete' ? 'rgba(168,131,74,0.12)' : 'rgba(15,20,40,0.6)',
                border: `1px solid ${trainStatus === 'correct' ? 'rgba(107,140,174,0.3)' : trainStatus === 'wrong' ? 'rgba(255,107,107,0.2)' : trainStatus === 'complete' ? 'rgba(168,131,74,0.3)' : 'rgba(107,140,174,0.08)'}`,
              }}>
                <p className="text-sm" style={{ color: trainStatus === 'correct' ? '#8daac4' : trainStatus === 'wrong' ? '#ff6b6b' : trainStatus === 'complete' ? '#a8834a' : '#cbd5e1' }}>
                  {trainMessage || (trainStatus === 'user_turn' ? 'Your turn' : '...')}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span style={{ color: '#6b8cae' }}>✓{stats.correct}</span>
                <span style={{ color: '#ff6b6b' }}>✗{stats.wrong}</span>
                <span style={{ color: '#cbd5e1' }}>{accuracy}%</span>
              </div>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-xs" style={{ color: 'rgba(160,152,138,0.5)' }}>
                {currentPath.map((move, i) => (
                  <span key={i} style={{ color: i === currentPath.length - 1 ? '#8daac4' : 'rgba(160,152,138,0.4)' }}>
                    {i % 2 === 0 && <span style={{ color: 'rgba(160,152,138,0.35)', marginRight: 2 }}>{Math.floor(i / 2) + 1}.</span>}
                    {move}
                  </span>
                ))}
              </div>
            </>
          )}
          {mode === 'edit' && (
            <div className="space-y-2">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
              <button onClick={handleSaveEdit} className="w-full px-3 py-2 text-xs rounded-lg font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>
                {editSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
