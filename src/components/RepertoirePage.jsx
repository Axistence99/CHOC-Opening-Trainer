import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, getLeafPaths, countPositions, treeToPGN } from '../utils/pgnParser';
import { updatePracticeEntry, updateRepertoire, deleteRepertoire, getSettings, resetAllCards } from '../utils/storage';
import { getOpeningFromMoves } from '../data/ecoOpenings';
import { getBoardTheme, getBoardThemeBackground } from '../data/boardThemes';
import BoardThemePicker from './BoardThemePicker';
import ChessgroundBoard from './ChessgroundBoard';
import SparringMode from './SparringMode';

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

// Pick opponent move skillfully: prefer moves where user has an available response in recorded PGN
function pickOpponentMove(expectedMap) {
  const allMoves = Array.from(expectedMap.keys());
  if (allMoves.length === 0) return null;
  const withUserResponses = allMoves.filter(san => {
    const childNode = expectedMap.get(san);
    return childNode && childNode.children && childNode.children.size > 0;
  });
  const pool = withUserResponses.length > 0 ? withUserResponses : allMoves;
  return pool[Math.floor(Math.random() * pool.length)];
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

// Build a linear path of positions for a specific line (for multi-line / multi-chapter study)
function buildStudyPathForLine(tree, line) {
  const path = [{ fen: tree.fen, move: null, san: null, from: null, to: null, comment: null, depth: 0 }];
  if (!line || !Array.isArray(line)) return path;
  let curr = tree;
  for (const item of line) {
    const san = typeof item === 'string' ? item : (item.san || item);
    if (!curr || !curr.children || !curr.children.has(san)) break;
    const child = curr.children.get(san);
    path.push({
      fen: child.fen,
      move: child.move,
      san,
      from: child.move?.from,
      to: child.move?.to,
      comment: child.comment || null,
      depth: child.depth,
    });
    curr = child;
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
  const [studyLineIdx, setStudyLineIdx] = useState(0);
  const [studyPath, setStudyPath] = useState([]);

  // Train state
  const [trainStatus, setTrainStatus] = useState('waiting'); // waiting | user_turn | correct | wrong | complete
  const [trainMessage, setTrainMessage] = useState('');
  const [expectedMoves, setExpectedMoves] = useState(new Map());
  const [allLines, setAllLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [wrongSquare, setWrongSquare] = useState(null); // { from, to } for red X

  // ─── New drill features ───
  const [settings] = useState(() => getSettings()); // sessionCap, dailyNewCap, drillPace, lineWalkEnabled, showHints
  const [hintStage, setHintStage] = useState(0);        // 0=none, 1=source square, 2=full arrow
  const [hintShapes, setHintShapes] = useState([]);
  const [moveGlyph, setMoveGlyph] = useState(null);     // { square, glyph, tone } stamped after a move
  const [sessionCount, setSessionCount] = useState(0);  // cards answered this session
  const [sessionCap, setSessionCap] = useState(settings.sessionCap || 50);
  const [allCaughtUp, setAllCaughtUp] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [sparMode, setSparMode] = useState(false);      // true → render SparringMode
  const [autoAdvance, setAutoAdvance] = useState(settings.drillPace > 0);
  const [copyMsg, setCopyMsg] = useState(false);
  const copyTimerRef = useRef(null);

  // Track daily new cards done today (persisted)
  const [dailyCount, setDailyCount] = useState(() => {
    try {
      const d = localStorage.getItem('choc-daily-new');
      if (d) {
        const parsed = JSON.parse(d);
        const today = new Date().toDateString();
        if (parsed.date === today) return parsed.count;
      }
    } catch {}
    return 0;
  });

  const bumpDailyCount = useCallback(() => {
    setDailyCount((c) => {
      const n = c + 1;
      try { localStorage.setItem('choc-daily-new', JSON.stringify({ date: new Date().toDateString(), count: n })); } catch {}
      return n;
    });
  }, []);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaved, setEditSaved] = useState(false);

  // Board settings
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize tree from repertoire
  useEffect(() => {
    if (!repertoire) return;
    // Defensive: a tree loaded from localStorage has Map->{} corruption, so only
    // trust repertoire.tree if its children are a real Map; otherwise rebuild from PGN.
    const storedTree = repertoire.tree;
    const validTree = storedTree && storedTree.children instanceof Map ? storedTree : null;
    const parsedTree = validTree || parsePGNToTree(repertoire.pgn);
    setTree(parsedTree);
    setCurrentNode(parsedTree);
    setOrientation(repertoire.color === 'black' ? 'black' : 'white');
    setEditName(repertoire.name);
    setEditDescription(repertoire.description || '');

    // Training lines
    const lines = buildAllLines(parsedTree);
    const shuffled = [...lines].sort(() => Math.random() - 0.5);
    setAllLines(shuffled);
    setLineIndex(0);
    setStats({ correct: 0, wrong: 0, total: 0 });

    // Study path (default to line 0 if lines exist)
    const sp = lines.length > 0 ? buildStudyPathForLine(parsedTree, lines[0]) : buildStudyPath(parsedTree);
    setStudyPath(sp);
    setStudyStep(0);
    setStudyLineIdx(0);

    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
    setTrainStatus('waiting');
  }, [repertoire]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── STUDY MODE ───
  const handleSelectStudyLine = useCallback((idx) => {
    if (!allLines || idx < 0 || idx >= allLines.length) return;
    setStudyLineIdx(idx);
    const sp = buildStudyPathForLine(tree, allLines[idx]);
    setStudyPath(sp);
    setStudyStep(0);
    if (sp.length > 0) {
      setPosition(sp[0].fen);
      setLastMove(null);
      setCurrentPath([]);
    }
  }, [allLines, tree]);
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

  // ─── SESSION / DAILY CAPS ───
  // Defined here (before handleTrainUserMove) because it's referenced in that
  // callback's dependency array — defining it later caused a TDZ crash.
  const handleSessionProgress = useCallback(() => {
    setSessionCount((c) => {
      const n = c + 1;
      if (settings.sessionCap > 0 && n >= settings.sessionCap) {
        setAllCaughtUp(true);
      }
      return n;
    });
  }, [settings.sessionCap]);

  const handleRetrainFromScratch = useCallback(() => {
    resetAllCards();
    setRetraining(true);
    setAllCaughtUp(false);
    setSessionCount(0);
    setTimeout(() => setRetraining(false), 400);
  }, []);

  const handleTrainFurther = useCallback(() => {
    setAllCaughtUp(false);
    setSessionCount(0);
  }, []);

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
      const rm = pickOpponentMove(expected);
      const move = rm ? chess.move(rm) : null;
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
      // Move quality glyph: ! for a clean first-try, !? if a hint was used
      setMoveGlyph(hintStage > 0 ? { square: dest, glyph: '!?', tone: 'amber' } : { square: dest, glyph: '!', tone: 'good' });
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 5);
      setHintShapes([]);
      setHintStage(0);
      handleSessionProgress();
      bumpDailyCount();

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
          const rm = pickOpponentMove(newExpected);
          const move = rm ? chess.move(rm) : null;
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
        }, 300);
      }
    } else {
      // ❌ WRONG — show red X, then rewind with animation
      chess.undo();
      setWrongSquare({ from: orig, to: dest });
      setMoveGlyph({ square: dest, glyph: '?', tone: 'bad' });
      setTrainStatus('wrong');
      setStats(prev => ({ ...prev, wrong: prev.wrong + 1, total: prev.total + 1 }));
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 1);
      handleSessionProgress();

      const correctSans = Array.from(expectedMoves.keys());
      setTrainMessage(`Wrong! Correct: ${correctSans.join(', ')}`);

      // Clear red X and reset status after animation
      setTimeout(() => {
        setWrongSquare(null);
        setMoveGlyph(null);
        setTrainStatus('user_turn');
        setTrainMessage('Your turn — try again');
      }, 800);
    }
  }, [chess, trainStatus, expectedMoves, repertoire, hintStage, handleSessionProgress, bumpDailyCount]);

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

  // ─── PROGRESSIVE HINTS ───
  // Stage 1 = source square glows; Stage 2 = full arrow. Hint downgrades the rating to Hard.
  const handleShowHint = useCallback(() => {
    if (expectedMoves.size === 0 || trainStatus !== 'user_turn') return;
    const shapes = [];
    for (const san of expectedMoves.keys()) {
      const tc = new Chess(chess.fen());
      const m = tc.move(san);
      if (m) {
        if (hintStage === 0) {
          shapes.push({ orig: m.from, brush: 'paleBlue' });
        } else {
          shapes.push({ orig: m.from, dest: m.to, brush: 'green' });
        }
      }
    }
    setHintShapes(shapes);
    setHintStage((s) => (s >= 2 ? 0 : s + 1));
    // Record that a hint was used for the current position (downgrade)
    updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 2); // Hard
  }, [expectedMoves, trainStatus, chess, hintStage]);

  const clearHints = useCallback(() => {
    setHintShapes([]);
    setHintStage(0);
  }, []);

  // ─── COPY LINE ───
  const handleCopyLine = useCallback(() => {
    const pgn = formatMoveNotation(currentPath, currentPath.length - 1);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pgn).catch(() => {});
    }
    setCopyMsg(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyMsg(false), 1600);
  }, [currentPath]);

  // ─── PGN EXPORT ───
  const handleExportPGN = useCallback(() => {
    if (!tree) return;
    const pgn = treeToPGN(tree, repertoire.name);
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(repertoire.name || 'repertoire').replace(/[^\w]+/g, '-').toLowerCase()}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tree, repertoire.name]);

  // Auto-advance to next line after a line completes
  useEffect(() => {
    if (autoAdvance && mode === 'train' && trainStatus === 'complete' && !allCaughtUp) {
      const pace = Math.max(settings.drillPace || 400, 400);
      const t = setTimeout(handleNextLine, pace);
      return () => clearTimeout(t);
    }
  }, [autoAdvance, mode, trainStatus, allCaughtUp, settings.drillPace, handleNextLine]);

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
      if ((e.key === 'h' || e.key === 'H') && mode === 'train' && trainStatus === 'user_turn') handleShowHint();
      if (e.key === 'Escape') clearHints();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, studyForward, studyBack, studyReset, studyEnd, handleShowHint, clearHints, trainStatus]);

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
    drawable: { enabled: false, visible: true, autoShapes: [...(studyArrows || []), ...hintShapes] },
  }), [position, orientation, turnColor, lastMove, dests, isUserTurn, handleTrainUserMove, studyArrows, hintShapes]);

  // Study info
  const currentStudyStep = studyPath[studyStep];
  const studyProgress = studyPath.length > 1 ? (studyStep / (studyPath.length - 1)) * 100 : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';
  const boardSize = 'min(calc(100vw - 40px), calc(100vh - 220px), 540px)';

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

  const handleDeleteRepertoire = useCallback(() => {
    if (!repertoire || !repertoire.id) return;
    if (!window.confirm(`Are you sure you want to delete "${repertoire.name}"?`)) return;
    deleteRepertoire(repertoire.id);
    onExit();
  }, [repertoire, onExit]);

  // ─── SPARRING MODE ───
  if (sparMode) {
    return (
      <div className="relative min-h-screen overflow-hidden" style={{ background: '#080b14', fontFamily: "'Inter', sans-serif" }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 25% 45%, #0e1828 0%, transparent 58%), radial-gradient(ellipse at 75% 20%, #110e20 0%, transparent 52%), radial-gradient(ellipse at 55% 85%, #0c1520 0%, transparent 50%), #080b14' }} />
        </div>
        <div className="relative p-2 md:p-0" style={{ zIndex: 1 }}>
          <SparringMode
            repertoire={repertoire}
            boardTheme={boardBg}
            onExit={() => setSparMode(false)}
          />
        </div>
      </div>
    );
  }

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
              {repertoire.tags && repertoire.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {repertoire.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(107,140,174,0.15)', border: '1px solid rgba(107,140,174,0.25)', color: '#8daac4' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex gap-1 items-center">
              <button onClick={() => { setMode('study'); studyReset(); }} style={modeBtn('study')}>📖 STUDY</button>
              <button onClick={() => { setMode('train'); chess.reset(); setPosition(chess.fen()); setCurrentPath([]); setLastMove(null); if (tree && allLines.length > 0) startTrainLine(allLines, 0, tree); }} style={modeBtn('train')}>🎯 TRAIN</button>
              <button onClick={() => setSparMode(true)} style={modeBtn('spar')}>⚔ SPAR</button>
              <button onClick={() => setMode('edit')} style={modeBtn('edit')}>✏️ EDIT</button>
              {repertoire.isCustom && (
                <button
                  onClick={handleDeleteRepertoire}
                  title="Delete Repertoire"
                  className="px-2 py-1 text-xs rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-1 font-orbitron"
                  style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff8a8a', cursor: 'pointer' }}
                >
                  🗑
                </button>
              )}
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
              {/* Move quality glyph on landing square */}
              {moveGlyph && !wrongSquare && (
                <div className="absolute" style={{
                  top: '8px', right: '8px', zIndex: 20,
                  width: '32px', height: '32px',
                  background: moveGlyph.tone === 'good' ? 'rgba(74, 222, 128, 0.9)' : moveGlyph.tone === 'bad' ? 'rgba(255, 107, 107, 0.9)' : 'rgba(168, 131, 74, 0.9)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '0.9rem', fontWeight: 900, color: '#080b14',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                  animation: 'fadeInScale 0.2s ease-out',
                }}>{moveGlyph.glyph}</div>
              )}
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
                {allLines.length > 1 && (
                  <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)' }}>
                    <span className="text-[10px] font-orbitron font-semibold" style={{ color: '#8daac4', letterSpacing: '0.05em' }}>CHAPTER:</span>
                    <select
                      value={studyLineIdx}
                      onChange={(e) => handleSelectStudyLine(Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer flex-1 text-right font-medium"
                      style={{ background: '#0a0d18' }}
                    >
                      {allLines.map((line, idx) => {
                        const preview = line.slice(0, 4).map(l => typeof l === 'string' ? l : l.san).join(' ');
                        return (
                          <option key={idx} value={idx} style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                            Line {idx + 1} of {allLines.length} ({preview}...)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
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
                  {allLines.length > 1 && (
                    <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                      <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: '#8daac4', letterSpacing: '0.1em' }}>CHAPTER / LINE ({studyLineIdx + 1}/{allLines.length})</h3>
                      <select
                        value={studyLineIdx}
                        onChange={(e) => handleSelectStudyLine(Number(e.target.value))}
                        className="w-full bg-slate-900 text-xs text-slate-200 rounded px-2.5 py-1.5 border border-slate-700 outline-none cursor-pointer"
                      >
                        {allLines.map((line, idx) => {
                          const preview = line.slice(0, 5).map(l => typeof l === 'string' ? l : l.san).join(' ');
                          return (
                            <option key={idx} value={idx}>
                              Line {idx + 1}: {preview}...
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
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
              {mode === 'train' && allCaughtUp && (
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(168,131,74,0.1)', border: '1px solid rgba(168,131,74,0.3)' }}>
                  <div style={{ fontSize: '2rem' }}>🎉</div>
                  <h3 className="font-orbitron font-semibold text-sm my-2" style={{ color: '#ddd8cc', letterSpacing: '0.1em' }}>ALL CAUGHT UP!</h3>
                  <p className="text-xs mb-3" style={{ color: 'rgba(160,152,138,0.7)' }}>
                    You've reached your session goal of {sessionCap} moves this session.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button onClick={handleTrainFurther} className="px-4 py-2 text-xs rounded-lg font-orbitron font-semibold transition-all hover:scale-105" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>TRAIN FURTHER</button>
                    <button onClick={handleRetrainFromScratch} className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff8a8a', cursor: 'pointer' }}>↺ RETRAIN FROM SCRATCH</button>
                  </div>
                </div>
              )}

              {mode === 'train' && !allCaughtUp && (
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
                    {isUserTurn && settings.showHints && (
                      <button onClick={handleShowHint} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', cursor: 'pointer' }}>
                        💡 Hint {hintStage === 0 ? '' : hintStage === 1 ? '(source)' : '(full)'}
                      </button>
                    )}
                    <button onClick={handleRestartLine} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }}>↺ Restart</button>
                    <button onClick={handleCopyLine} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }} title="Copy current line">
                      {copyMsg ? '✓ Copied' : '📋 Copy'}
                    </button>
                    {trainStatus === 'complete' && (
                      <button onClick={handleNextLine} className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc', cursor: 'pointer' }}>NEXT →</button>
                    )}
                  </div>

                  {/* Session / daily progress */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <span style={{ color: 'rgba(160,152,138,0.5)' }}>
                      Session <b style={{ color: '#8daac4' }}>{Math.min(sessionCount, sessionCap || sessionCount)}</b>
                      {sessionCap > 0 && <span style={{ color: 'rgba(160,152,138,0.4)' }}>/{sessionCap}</span>}
                    </span>
                    <span style={{ color: 'rgba(160,152,138,0.5)' }}>
                      Today <b style={{ color: '#a8834a' }}>{dailyCount}</b>
                      {settings.dailyNewCap > 0 && <span style={{ color: 'rgba(160,152,138,0.4)' }}>/{settings.dailyNewCap}</span>}
                    </span>
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
                      <button onClick={handleExportPGN} className="flex-1 px-4 py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.1)', border: '1px solid rgba(107,140,174,0.2)', color: '#8daac4', cursor: 'pointer' }} title="Export this repertoire as a PGN file">
                        ⬇ Export PGN
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
                    {repertoire.tags && repertoire.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {repertoire.tags.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(107,140,174,0.15)', border: '1px solid rgba(107,140,174,0.25)', color: '#8daac4' }}>{t}</span>
                        ))}
                      </div>
                    )}
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
