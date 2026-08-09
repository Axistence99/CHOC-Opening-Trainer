import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, getLeafPaths, countPositions, treeToPGN, updateChapterNamesInPGN } from '../utils/pgnParser';
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

function executeMoveSafe(chessInstance, moveSan, nodeObject) {
  if (!chessInstance) return null;
  try {
    const res = chessInstance.move(moveSan);
    if (res) return res;
  } catch {}
  if (nodeObject && nodeObject.move && nodeObject.move.from && nodeObject.move.to) {
    try {
      const res = chessInstance.move({
        from: nodeObject.move.from,
        to: nodeObject.move.to,
        promotion: nodeObject.move.promotion || 'q',
      });
      if (res) return res;
    } catch {}
  }
  return null;
}

function findExpectedNode(expectedMovesMap, san, orig, dest) {
  if (!expectedMovesMap || expectedMovesMap.size === 0) return null;
  if (expectedMovesMap.has(san)) return { san, node: expectedMovesMap.get(san) };
  for (const [keySan, childNode] of expectedMovesMap.entries()) {
    if (childNode?.move?.from === orig && childNode?.move?.to === dest) {
      return { san: keySan, node: childNode };
    }
  }
  return null;
}

// Strictly restrict expected moves to the chosen repertoire line/chapter step
function getExpectedForLineStep(node, currentLine, stepIndex) {
  const map = new Map();
  if (!node || !node.children) return map;
  if (currentLine && currentLine[stepIndex]) {
    const targetSan = currentLine[stepIndex].san;
    if (node.children.has(targetSan)) {
      map.set(targetSan, node.children.get(targetSan));
      return map;
    }
  }
  for (const [s, c] of node.children.entries()) map.set(s, c);
  return map;
}

// Pick opponent move skillfully: prefer move from chosen repertoire line/chapter
function pickOpponentMove(expectedMap, currentLine, stepIndex) {
  if (!expectedMap || expectedMap.size === 0) return null;
  if (currentLine && currentLine[stepIndex]) {
    const targetSan = currentLine[stepIndex].san;
    if (expectedMap.has(targetSan)) {
      return targetSan;
    }
  }
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

// Format chapter title without repeating numbers (e.g. "1. 1.")
function formatChapterLabel(name, idx, fallbackText) {
  if (!name) return fallbackText || `Line ${idx + 1}`;
  const clean = String(name).replace(/^\d+[\.\-):]\s*/, '').trim();
  return `${idx + 1}. ${clean}`;
}

function PGNTreeView({ node, currentPath, pathSoFar = [], onSelectNode, isRoot = true }) {
  if (!node || !node.children || node.children.size === 0) return null;
  const entries = Array.from(node.children.entries());
  if (entries.length === 0) return null;

  return (
    <span className="inline">
      {isRoot && node.comment && (
        <span className="block text-[11px] italic my-1 p-2 rounded" style={{ color: '#a8c5e2', background: 'rgba(107,140,174,0.12)', borderLeft: '2px solid #6b8cae' }}>
          {node.comment}
        </span>
      )}
      {entries.map(([san, child], i) => {
        const path = [...pathSoFar, san];
        const isCurrent = currentPath.join(' ') === path.join(' ');
        const depth = child.depth;
        const moveNum = Math.floor((depth - 1) / 2) + 1;
        const isWhite = depth % 2 === 1;
        const prefix = isWhite ? `${moveNum}. ` : ((i > 0 || isRoot || depth === 2) ? `${moveNum}... ` : '');
        const isVar = i > 0;

        return (
          <span key={path.join(' ')} className="inline">
            {isVar && <span style={{ color: 'rgba(234,179,8,0.7)', fontWeight: 700, margin: '0 2px' }}>(</span>}
            {prefix && <span style={{ color: 'rgba(160,152,138,0.4)', marginRight: 2 }}>{prefix}</span>}
            <span
              onClick={() => onSelectNode && onSelectNode(path, child)}
              className="cursor-pointer transition-colors hover:text-white"
              style={{
                color: isCurrent ? '#fff' : isVar ? '#fbbf24' : '#8daac4',
                fontWeight: isCurrent ? 700 : 400,
                background: isCurrent ? 'rgba(107,140,174,0.25)' : 'transparent',
                padding: '1px 3px',
                borderRadius: 3,
              }}
            >
              {san}
              {child.glyph && (
                <span className="font-bold ml-0.5" style={{ color: child.glyph.includes('?') ? '#ff8a8a' : '#4ade80' }}>
                  {child.glyph}
                </span>
              )}
            </span>
            {child.comment && (
              <span className="inline-block text-[11px] italic mx-1 px-1.5 py-0.5 rounded" style={{ color: '#a8c5e2', background: 'rgba(107,140,174,0.12)' }}>
                {child.comment}
              </span>
            )}
            {' '}
            <PGNTreeView node={child} currentPath={currentPath} pathSoFar={path} onSelectNode={onSelectNode} isRoot={false} />
            {isVar && <span style={{ color: 'rgba(234,179,8,0.7)', fontWeight: 700, margin: '0 2px' }}>)</span>}{' '}
          </span>
        );
      })}
    </span>
  );
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
  const [showStudyArrows, setShowStudyArrows] = useState(true);
  const [studyNode, setStudyNode] = useState(null);

  // Train state
  const [trainStatus, setTrainStatus] = useState('waiting'); // waiting | user_turn | correct | wrong | complete
  const [trainMessage, setTrainMessage] = useState('');
  const [expectedMoves, setExpectedMoves] = useState(new Map());
  const [allLines, setAllLines] = useState([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [trainLineFilter, setTrainLineFilter] = useState('all');
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [wrongSquare, setWrongSquare] = useState(null); // { from, to } for red X
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
  const [editChapterNames, setEditChapterNames] = useState([]);
  const [editSaved, setEditSaved] = useState(false);

  // Board settings
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize tree from repertoire
  useEffect(() => {
    if (!repertoire) return;
    // Always parse from PGN so any stale/broken tree objects from older saves are ignored.
    const parsedTree = parsePGNToTree(repertoire.pgn);
    setTree(parsedTree);
    setCurrentNode(parsedTree);
    setOrientation(repertoire.color === 'black' ? 'black' : 'white');
    setEditName(repertoire.name);
    setEditDescription(repertoire.description || '');

    // Training lines (ordered sequentially from Part 1 to last)
    const lines = buildAllLines(parsedTree);
    setAllLines(lines);
    setEditChapterNames(lines.map((l, idx) => l.name || `Chapter ${idx + 1}`));
    setLineIndex(0);
    setStats({ correct: 0, wrong: 0, total: 0 });

    // Study path (default to line 0 if lines exist)
    const sp = lines.length > 0 ? buildStudyPathForLine(parsedTree, lines[0]) : buildStudyPath(parsedTree);
    setStudyPath(sp);
    setStudyStep(0);
    setStudyLineIdx(0);
    setStudyNode(parsedTree);

    chess.reset();
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
    setTrainStatus('waiting');
  }, [repertoire]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── AUTOMATED BOT AUTO-RESPONSE IN TRAIN MODE ───
  useEffect(() => {
    if (mode !== 'train' || trainStatus === 'complete' || trainStatus === 'wrong' || trainStatus === 'waiting') return;
    if (!expectedMoves || expectedMoves.size === 0) return;

    const isUserWhite = !repertoire?.color || repertoire.color.toLowerCase() === 'white';
    const isWhiteTurn = chess.turn() === 'w';
    const isUserTurnNow = (isUserWhite && isWhiteTurn) || (!isUserWhite && !isWhiteTurn);

    if (!isUserTurnNow) {
      let currentExpected = expectedMoves;
      let currentIsUserTurn = isUserTurnNow;
      let lastM = null;
      let lastRM = null;
      let lastNN = currentNode;
      let stepCount = currentPath.length;
      const currentLine = activeTrainLines && activeTrainLines[lineIndex] ? activeTrainLines[lineIndex] : null;

      while (!currentIsUserTurn && currentExpected && currentExpected.size > 0) {
        const rm = pickOpponentMove(currentExpected, currentLine, stepCount);
        if (!rm) break;
        const nn = currentExpected.get(rm);
        const move = executeMoveSafe(chess, rm, nn);
        if (!move) break;
        lastRM = rm;
        lastM = move;
        lastNN = nn;
        stepCount += 1;
        currentExpected = getExpectedForLineStep(nn, currentLine, stepCount);
        currentIsUserTurn = isUserWhite ? chess.turn() === 'w' : chess.turn() === 'b';
      }

      setPosition(chess.fen());
      if (lastM && lastRM) {
        setCurrentPath(prev => [...prev, lastRM]);
        setLastMove([lastM.from, lastM.to]);
      }
      setCurrentNode(lastNN);
      setExpectedMoves(currentExpected);

      if (currentIsUserTurn && currentExpected && currentExpected.size > 0) {
        setTrainStatus('user_turn');
        setTrainMessage('Your turn — play the correct move');
      } else {
        setTrainStatus('complete');
        setTrainMessage('✅ Line complete!');
      }
    }
  }, [mode, trainStatus, expectedMoves, chess, repertoire?.color, currentNode, activeTrainLines, lineIndex, currentPath.length]);

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
    let node = rootNode || tree;
    if ((!node || !node.children || node.children.size === 0) && repertoire?.pgn) {
      node = parsePGNToTree(repertoire.pgn);
      setTree(node);
    }
    const startFen = node?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    chess.load(startFen);
    setPosition(chess.fen());
    setCurrentPath([]);
    setLastMove(null);
    setWrongSquare(null);
    setTrainMessage(`Line ${idx + 1} of ${lines.length}`);

    setCurrentNode(node);
    const currentLine = lines && lines[idx] ? lines[idx] : null;
    const expected = getExpectedForLineStep(node, currentLine, 0);
    setExpectedMoves(expected);

    const isUserWhite = !repertoire.color || repertoire.color.toLowerCase() === 'white';
    const turnIsWhite = chess.turn() === 'w';
    const isUserTurn = (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);

    if (isUserTurn) {
      setTrainStatus('user_turn');
      setTrainMessage('Your turn — play the correct move');
    } else if (expected.size > 0) {
      setTrainStatus('correct');
      setTrainMessage('Computer to move...');
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
    const matched = findExpectedNode(expectedMoves, san, orig, dest);
    if (matched) {
      const { san: matchedSan, node: nextNode } = matched;
      // ✅ CORRECT
      setPosition(chess.fen());
      setCurrentPath(prev => [...prev, matchedSan]);
      setLastMove([orig, dest]);
      setWrongSquare(null);
      setTrainStatus('correct');
      setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      // Move quality glyph: ! for a clean first-try, !? if a hint was used
      setMoveGlyph(hintStage > 0 ? { square: dest, glyph: '!?', tone: 'amber' } : { square: dest, glyph: '!', tone: 'good' });
      setTimeout(() => setMoveGlyph(null), 1200);
      updatePracticeEntry(chess.fen().split(' ').slice(0, 4).join(' '), 4);
      setHintShapes([]);
      setHintStage(0);
      handleSessionProgress();
      bumpDailyCount();

      setCurrentNode(nextNode);
      const currentLine = activeTrainLines && activeTrainLines[lineIndex] ? activeTrainLines[lineIndex] : null;
      const nextStepIndex = currentPath.length + 1;
      const newExpected = getExpectedForLineStep(nextNode, currentLine, nextStepIndex);
      setExpectedMoves(newExpected);

      if (newExpected.size === 0) {
        setTrainStatus('complete');
        setTrainMessage('✅ Line complete!');
        return;
      }

      // Check if it's still user's turn or computer responds
      const isUserWhite = !repertoire.color || repertoire.color.toLowerCase() === 'white';
      const isUserTurn = isUserWhite ? chess.turn() === 'w' : chess.turn() === 'b';

      if (isUserTurn) {
        setTrainStatus('user_turn');
        setTrainMessage('Your turn — play the correct move');
      } else {
        setTrainStatus('correct');
        setTrainMessage('✓ Correct! Computer responding...');
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

  const activeTrainLines = useMemo(() => {
    return trainLineFilter === 'all' ? allLines : [allLines[Number(trainLineFilter)]];
  }, [allLines, trainLineFilter]);

  const handleTrainFilterChange = useCallback((val) => {
    setTrainLineFilter(val);
    const targetLines = val === 'all' ? allLines : [allLines[Number(val)]];
    setLineIndex(0);
    startTrainLine(targetLines, 0, tree);
  }, [allLines, tree, startTrainLine]);

  const handleNextLine = useCallback(() => {
    const ni = lineIndex + 1;
    if (ni >= activeTrainLines.length) {
      setLineIndex(0);
      startTrainLine(activeTrainLines, 0, tree);
    } else {
      setLineIndex(ni);
      startTrainLine(activeTrainLines, ni, tree);
    }
  }, [lineIndex, activeTrainLines, tree, startTrainLine]);

  const handleRestartLine = useCallback(() => {
    setExpectedMoves(new Map());
    startTrainLine(activeTrainLines, lineIndex, tree);
  }, [activeTrainLines, lineIndex, tree, startTrainLine]);

  const clearVisualOverlays = useCallback(() => {
    setWrongSquare(null);
    setMoveGlyph(null);
    setHintShapes([]);
    setHintStage(0);
  }, []);

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
    const newPgn = updateChapterNamesInPGN(repertoire.pgn, editChapterNames);
    const updates = { name: editName.trim(), description: editDescription.trim(), pgn: newPgn };
    updateRepertoire(repertoire.id, updates);
    if (onRepertoireUpdate) {
      const updatedTree = parsePGNToTree(newPgn);
      onRepertoireUpdate({ ...repertoire, ...updates, tree: updatedTree });
    }
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  }, [repertoire, editName, editDescription, editChapterNames, onRepertoireUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
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

  // Board config
  const themeObj = getBoardTheme(boardTheme);
  const boardBg = getBoardThemeBackground(boardTheme);
  const dests = useMemo(() => computeDests(position), [position]);
  const turnColor = position.includes(' w ') ? 'white' : 'black';
  const isUserTurn = mode === 'train' && trainStatus === 'user_turn';

  // Study arrows (show next move)
  const studyArrows = useMemo(() => {
    if (!showStudyArrows || mode !== 'study') return [];
    if (studyLineIdx === 'all') {
      if (!studyNode || !studyNode.children || studyNode.children.size === 0) return [];
      const arr = [];
      let i = 0;
      for (const child of studyNode.children.values()) {
        if (child.move && child.move.from && child.move.to) {
          arr.push({ orig: child.move.from, dest: child.move.to, brush: i === 0 ? 'green' : 'blue' });
          i++;
        }
      }
      return arr;
    }
    if (studyStep >= studyPath.length - 1) return [];
    const nextPos = studyPath[studyStep + 1];
    if (nextPos?.from && nextPos?.to) {
      return [{ orig: nextPos.from, dest: nextPos.to, brush: 'green' }];
    }
    return [];
  }, [showStudyArrows, mode, studyLineIdx, studyNode, studyStep, studyPath]);

  const handleStudyUserMove = useCallback((orig, dest) => {
    if (mode !== 'study') return;
    clearVisualOverlays();
    if (studyLineIdx === 'all') {
      const c = new Chess(position);
      const m = c.move({ from: orig, to: dest, promotion: 'q' });
      if (m) {
        setPosition(c.fen());
        setLastMove([orig, dest]);
        setCurrentPath(prev => [...prev, m.san]);
        if (studyNode && studyNode.children && studyNode.children.has(m.san)) {
          setStudyNode(studyNode.children.get(m.san));
        } else {
          setStudyNode(null);
        }
      }
      return;
    }
    const nextStep = studyPath[studyStep + 1];
    if (nextStep && nextStep.from === orig && nextStep.to === dest) {
      studyForward();
      return;
    }
    const c = new Chess(position);
    const m = c.move({ from: orig, to: dest, promotion: 'q' });
    if (m) {
      setPosition(c.fen());
      setLastMove([orig, dest]);
      setCurrentPath(prev => [...prev, m.san]);
      const matchIdx = studyPath.findIndex((sp, idx) => idx > 0 && sp.san === m.san && studyPath[idx - 1]?.fen === position);
      if (matchIdx !== -1) {
        setStudyStep(matchIdx);
      }
    }
  }, [mode, studyLineIdx, position, studyNode, studyPath, studyStep, studyForward, clearVisualOverlays]);

  const cgConfig = useMemo(() => {
    const interactive = mode === 'study' || isUserTurn;
    const destsMap = interactive ? dests : new Map();
    return {
      fen: position,
      orientation,
      turnColor,
      lastMove: lastMove ? [lastMove[0], lastMove[1]] : undefined,
      coordinates: true,
      highlight: { lastMove: true, check: true },
      animation: { enabled: !isUserTurn, duration: 200 },
      movable: {
        free: false,
        dests: destsMap,
        showDests: interactive,
        color: interactive ? 'both' : undefined,
        events: { after: mode === 'study' ? handleStudyUserMove : handleTrainUserMove },
      },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      drawable: { enabled: false, visible: true, autoShapes: [...(studyArrows || []), ...hintShapes] },
    };
  }, [position, orientation, turnColor, lastMove, dests, isUserTurn, mode, handleStudyUserMove, handleTrainUserMove, studyArrows, hintShapes]);

  // Study info
  const currentStudyStep = studyPath[studyStep];
  const studyProgress = studyPath.length > 1 ? (studyStep / (studyPath.length - 1)) * 100 : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const openingName = currentPath.length > 0 ? getOpeningFromMoves(currentPath) : 'Starting Position';
  const boardSize = 'min(calc(100vw - 40px), calc(100vh - 220px), 540px)';

  // Mode button helper
  const modeBtn = (m) => ({
    padding: '6px 4px',
    fontSize: '0.62rem',
    fontFamily: "'Orbitron', sans-serif",
    letterSpacing: '0.04em',
    fontWeight: mode === m ? 700 : 400,
    color: mode === m ? '#ddd8cc' : 'rgba(160,152,138,0.5)',
    background: mode === m ? 'rgba(107,140,174,0.2)' : 'rgba(107,140,174,0.04)',
    border: `1px solid ${mode === m ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.08)'}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    width: '100%',
  });

  const handleDeleteRepertoire = useCallback(() => {
    if (!repertoire || !repertoire.id) return;
    setShowDeleteModal(true);
  }, [repertoire]);

  const confirmDeleteRepertoire = useCallback(() => {
    if (!repertoire || !repertoire.id) return;
    deleteRepertoire(repertoire.id);
    setShowDeleteModal(false);
    onExit();
  }, [repertoire, onExit]);

  if (!repertoire) return null;

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
        {/* Header — 2-row layout on mobile so all 4 buttons (STUDY, TRAIN, SPAR, EDIT) fit side-by-side */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between px-3 md:px-6 py-2 sm:py-2.5 border-b gap-2" style={{ borderColor: 'rgba(107,140,174,0.12)', background: 'rgba(6,8,16,0.9)' }}>
          {/* Top Row on Mobile / Left Side on Desktop: Back button, Repertoire name, and mobile Settings */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button onClick={onExit} className="px-2.5 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)', cursor: 'pointer' }}>← Back</button>
              <div className="min-w-0">
                <h1 className="font-orbitron font-bold text-xs sm:text-sm truncate" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>{repertoire.name}</h1>
                <p className="text-[10px] truncate hidden sm:block" style={{ color: 'rgba(150,142,130,0.5)' }}>{openingName}</p>
                {repertoire.tags && repertoire.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {repertoire.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(107,140,174,0.15)', border: '1px solid rgba(107,140,174,0.25)', color: '#8daac4' }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Settings button visible on mobile top-right */}
            <button onClick={() => setSettingsOpen(v => !v)} title="Settings" className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-105 shrink-0" style={{ background: settingsOpen ? 'rgba(107,140,174,0.18)' : 'rgba(107,140,174,0.07)', border: `1px solid ${settingsOpen ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.14)'}`, color: settingsOpen ? '#8daac4' : '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>⚙</button>
          </div>

          {/* Bottom Row on Mobile / Right Side on Desktop: Mode toggle buttons + Desktop Settings */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Mode toggle — 4-column grid on mobile so STUDY, TRAIN, SPAR, EDIT all fit side-by-side */}
            <div className="grid grid-cols-4 sm:flex gap-1 items-center w-full sm:w-auto">
              <button onClick={() => { setMode('study'); studyReset(); }} style={modeBtn('study')}>📖 STUDY</button>
              <button onClick={() => { setMode('train'); chess.reset(); setPosition(chess.fen()); setCurrentPath([]); setLastMove(null); if (tree && allLines.length > 0) startTrainLine(allLines, 0, tree); }} style={modeBtn('train')}>🎯 TRAIN</button>
              <button onClick={() => setSparMode(true)} style={modeBtn('spar')}>⚔ SPAR</button>
              <button onClick={() => setMode('edit')} style={modeBtn('edit')}>✏️ EDIT</button>
            </div>
            {mode === 'train' && (
              <div className="hidden md:flex items-center gap-2 text-xs shrink-0" style={{ color: 'rgba(150,142,130,0.6)' }}>
                <span style={{ color: '#6b8cae' }}>✓{stats.correct}</span>
                <span style={{ color: '#ff6b6b' }}>✗{stats.wrong}</span>
                <span style={{ color: '#cbd5e1' }}>{accuracy}%</span>
              </div>
            )}
            <button onClick={() => setSettingsOpen(v => !v)} title="Settings" className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-105 shrink-0" style={{ background: settingsOpen ? 'rgba(107,140,174,0.18)' : 'rgba(107,140,174,0.07)', border: `1px solid ${settingsOpen ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.14)'}`, color: settingsOpen ? '#8daac4' : '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>⚙</button>
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
            {/* Status indicators (OUTSIDE the chessboard so they never cover any squares or pieces) */}
            <div className="flex items-center justify-center gap-2 h-[36px] w-full shrink-0">
              {moveGlyph && !wrongSquare && (
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-orbitron font-bold shadow-lg transition-all duration-200"
                  style={{
                    background: moveGlyph.tone === 'good' ? 'rgba(74, 222, 128, 0.18)' : 'rgba(251, 191, 36, 0.18)',
                    border: `1px solid ${moveGlyph.tone === 'good' ? '#4ade80' : '#fbbf24'}`,
                    color: moveGlyph.tone === 'good' ? '#4ade80' : '#fbbf24',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span className="text-sm">{moveGlyph.glyph}</span>
                  <span>Correct Move!</span>
                </div>
              )}
              {wrongSquare && (
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-orbitron font-bold shadow-lg transition-all duration-200"
                  style={{
                    background: 'rgba(255, 107, 107, 0.18)',
                    border: '1px solid #ff6b6b',
                    color: '#ff6b6b',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span className="text-sm">✕</span>
                  <span>Incorrect Move — Try Again</span>
                </div>
              )}
            </div>

            {/* Board */}
            <div className="relative">
              <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
                <div style={{ width: boardSize }}>
                  <ChessgroundBoard config={cgConfig} boardTheme={boardBg} />
                </div>
              </div>
            </div>

            {/* Board controls for Study mode */}
            {mode === 'study' && (
              <div className="flex flex-col items-center gap-2 w-full max-w-sm md:max-w-md">
                {allLines.length > 1 && (
                  <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)' }}>
                    <span className="text-[10px] font-orbitron font-semibold" style={{ color: '#8daac4', letterSpacing: '0.05em' }}>CHAPTER:</span>
                    <select
                      value={studyLineIdx}
                      onChange={(e) => handleSelectStudyLine(e.target.value)}
                      className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer flex-1 text-right font-medium"
                      style={{ background: '#0a0d18' }}
                    >
                      <option value="all" style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                        Whole Repertoire ({allLines.length} lines)
                      </option>
                      {allLines.map((line, idx) => {
                        const preview = line.slice(0, 4).map(l => typeof l === 'string' ? l : l.san).join(' ');
                        return (
                          <option key={idx} value={idx} style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                            {formatChapterLabel(line.name, idx, `Line ${idx + 1} of ${allLines.length}`)} ({preview}...)
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
                {/* Arrows Toggle */}
                <div className="flex items-center justify-between w-full px-1">
                  <button
                    onClick={() => setShowStudyArrows(a => !a)}
                    className="text-[10px] font-orbitron transition-all hover:scale-105"
                    style={{ color: showStudyArrows ? '#4ade80' : 'rgba(160,152,138,0.5)', cursor: 'pointer' }}
                  >
                    👁 ARROWS: {showStudyArrows ? 'ON' : 'OFF'}
                  </button>
                  {studyLineIdx === 'all' && (
                    <span className="text-[10px] font-orbitron" style={{ color: '#6b8cae' }}>
                      {studyNode?.children?.size || 0} candidate move(s) in PGN
                    </span>
                  )}
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
            {mode === 'train' && allLines.length > 1 && (
              <div className="w-full max-w-sm md:max-w-md flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)' }}>
                <span className="text-[10px] font-orbitron font-semibold" style={{ color: '#8daac4', letterSpacing: '0.05em' }}>PRACTICE:</span>
                <select
                  value={trainLineFilter}
                  onChange={(e) => handleTrainFilterChange(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer flex-1 text-right font-medium"
                  style={{ background: '#0a0d18' }}
                >
                  <option value="all" style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                    Whole Repertoire ({allLines.length} lines)
                  </option>
                  {allLines.map((line, idx) => {
                    const preview = line.slice(0, 4).map(l => typeof l === 'string' ? l : l.san).join(' ');
                    return (
                      <option key={idx} value={idx} style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                        {formatChapterLabel(line.name, idx, `Line ${idx + 1}`)} ({preview}...)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
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
                        onChange={(e) => handleSelectStudyLine(e.target.value)}
                        className="w-full bg-slate-900 text-xs text-slate-200 rounded px-2.5 py-1.5 border border-slate-700 outline-none cursor-pointer"
                      >
                        <option value="all" style={{ background: '#0a0d18', color: '#cbd5e1' }}>
                          Whole Repertoire ({allLines.length} lines)
                        </option>
                        {allLines.map((line, idx) => {
                          const preview = line.slice(0, 5).map(l => typeof l === 'string' ? l : l.san).join(' ');
                          return (
                            <option key={idx} value={idx}>
                              {formatChapterLabel(line.name, idx, `Line ${idx + 1}`)}: {preview}...
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  {/* Move notation list — Scrollable box so it never stretches the whole study page */}
                  <div className="rounded-xl p-3 flex flex-col max-h-[45vh]" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                    <h3 className="font-orbitron font-semibold text-[10px] mb-2 shrink-0" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>WHOLE PGN & ANNOTATIONS</h3>
                    <div className="leading-relaxed whitespace-normal font-mono text-xs p-1.5 overflow-y-auto overflow-x-hidden min-h-0 flex-1 pr-1" style={{ maxHeight: '360px' }}>
                      <PGNTreeView
                        node={tree}
                        currentPath={currentPath}
                        onSelectNode={(p, child) => {
                          if (child && child.fen) {
                            setPosition(child.fen);
                            setLastMove(child.move?.from && child.move?.to ? [child.move.from, child.move.to] : null);
                            setCurrentPath(p);
                            setStudyNode(child);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {studyLineIdx === 'all' && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                      <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: '#8daac4', letterSpacing: '0.1em' }}>NEXT MOVES IN REPERTOIRE ({studyNode?.children?.size || 0})</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(studyNode?.children?.entries() || []).map(([san, child], i) => (
                          <button
                            key={san}
                            onClick={() => {
                              setPosition(child.fen);
                              setLastMove(child.move?.from && child.move?.to ? [child.move.from, child.move.to] : null);
                              setCurrentPath(prev => [...prev, san]);
                              setStudyNode(child);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono transition-all hover:scale-105"
                            style={{
                              background: i === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(96,165,250,0.15)',
                              border: `1px solid ${i === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(96,165,250,0.4)'}`,
                              color: i === 0 ? '#4ade80' : '#60a5fa',
                              cursor: 'pointer',
                            }}
                          >
                            {san}
                          </button>
                        ))}
                        {(studyNode?.children?.size || 0) === 0 && (
                          <span className="text-xs italic text-slate-500">End of line in PGN</span>
                        )}
                      </div>
                    </div>
                  )}

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
                  {allLines.length > 1 && (
                    <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
                      <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: '#8daac4', letterSpacing: '0.1em' }}>PRACTICE FILTER</h3>
                      <select
                        value={trainLineFilter}
                        onChange={(e) => handleTrainFilterChange(e.target.value)}
                        className="w-full bg-slate-900 text-xs text-slate-200 rounded px-2.5 py-1.5 border border-slate-700 outline-none cursor-pointer"
                      >
                        <option value="all">
                          Whole Repertoire ({allLines.length} lines)
                        </option>
                        {allLines.map((line, idx) => {
                          const preview = line.slice(0, 5).map(l => typeof l === 'string' ? l : l.san).join(' ');
                          return (
                            <option key={idx} value={idx}>
                              {formatChapterLabel(line.name, idx, `Line ${idx + 1}`)}: {preview}...
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

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
                    <button
                      onClick={handleDeleteRepertoire}
                      className="w-full px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold mt-2"
                      style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff8a8a', cursor: 'pointer', letterSpacing: '0.08em' }}
                    >
                      🗑 Delete Repertoire
                    </button>

                    {/* Chapter renaming */}
                    {allLines && allLines.length > 0 && (
                      <div className="rounded-xl p-3 space-y-2 mt-2" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.12)' }}>
                        <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>
                          RENAME CHAPTERS ({allLines.length})
                        </h3>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {allLines.map((line, idx) => {
                            const preview = line.slice(0, 4).map(l => typeof l === 'string' ? l : l.san).join(' ');
                            const currName = editChapterNames[idx] ?? (line.name || `Chapter ${idx + 1}`);
                            return (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono w-5 text-right shrink-0" style={{ color: 'rgba(150,142,130,0.5)' }}>
                                  {idx + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={currName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditChapterNames(prev => {
                                      const next = [...prev];
                                      next[idx] = val;
                                      return next;
                                    });
                                  }}
                                  placeholder={`Chapter ${idx + 1}`}
                                  className="flex-1 px-2 py-1 rounded text-xs"
                                  style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)', color: '#cbd5e1', outline: 'none' }}
                                />
                                <span className="text-[10px] font-mono truncate max-w-[70px] shrink-0" style={{ color: 'rgba(160,152,138,0.4)' }} title={preview}>
                                  {preview}...
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
              <button
                onClick={handleDeleteRepertoire}
                className="w-full px-3 py-2 text-xs rounded-lg transition-all hover:scale-105 font-orbitron font-semibold"
                style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff8a8a', cursor: 'pointer', letterSpacing: '0.08em' }}
              >
                🗑 Delete Repertoire
              </button>

              {/* Chapter renaming */}
              {allLines && allLines.length > 0 && (
                <div className="rounded-xl p-3 space-y-2 mt-2" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.12)' }}>
                  <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>
                    RENAME CHAPTERS ({allLines.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {allLines.map((line, idx) => {
                      const preview = line.slice(0, 4).map(l => typeof l === 'string' ? l : l.san).join(' ');
                      const currName = editChapterNames[idx] ?? (line.name || `Chapter ${idx + 1}`);
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono w-5 text-right shrink-0" style={{ color: 'rgba(150,142,130,0.5)' }}>
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={currName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditChapterNames(prev => {
                                const next = [...prev];
                                next[idx] = val;
                                return next;
                              });
                            }}
                            placeholder={`Chapter ${idx + 1}`}
                            className="flex-1 px-2 py-1 rounded text-xs"
                            style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)', color: '#cbd5e1', outline: 'none' }}
                          />
                          <span className="text-[10px] font-mono truncate max-w-[70px] shrink-0" style={{ color: 'rgba(160,152,138,0.4)' }} title={preview}>
                            {preview}...
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
