import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import StockfishEngine, { uciToMove } from '../utils/stockfishEngine';
import { getBoardThemeBackground } from '../data/boardThemes';
import ChessgroundBoard from './ChessgroundBoard';

const SKILL_LEVELS = [
  { level: 1, label: 'Beginner', elo: '~800' },
  { level: 5, label: 'Casual', elo: '~1200' },
  { level: 10, label: 'Club', elo: '~1600' },
  { level: 15, label: 'Strong', elo: '~2000' },
  { level: 20, label: 'Max', elo: '~2800' },
];

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

/**
 * Find the expected book move(s) at the current position in the tree
 * Returns a Map of SAN -> tree node
 */
function findBookMovesAtFen(tree, fen) {
  if (!tree) return new Map();
  // BFS through tree to find node matching this FEN
  const queue = [tree];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.fen === fen) {
      // Return all children as book moves
      return node.children;
    }
    for (const child of node.children.values()) {
      queue.push(child);
    }
  }
  return new Map();
}

export default function SparringMode({ repertoire, boardTheme, onExit }) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState(null);
  const [orientation, setOrientation] = useState(repertoire?.color === 'black' ? 'black' : 'white');
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [skillLevel, setSkillLevel] = useState(10);
  const [deviations, setDeviations] = useState([]); // moves not in the book
  const [lastDeviation, setLastDeviation] = useState(null); // { san, bookMoves: [string] }
  const [isUserWhite] = useState(repertoire?.color === 'white');

  const engineRef = useRef(null);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init()
      .then(() => setEngineReady(true))
      .catch(err => console.error('Stockfish init error:', err));
    return () => { engine.quit(); };
  }, []);

  // If user plays black, engine makes first move
  useEffect(() => {
    if (engineReady && !isUserWhite && moveHistory.length === 0 && gameStatus === 'playing') {
      makeEngineMove();
    }
  }, [engineReady, isUserWhite, moveHistory.length, gameStatus]); // eslint-disable-line

  const isPlayerTurn = useCallback(() => {
    const turnIsWhite = chess.turn() === 'w';
    return (isUserWhite && turnIsWhite) || (!isUserWhite && !turnIsWhite);
  }, [isUserWhite]);

  const makeEngineMove = useCallback(async () => {
    if (!engineRef.current?.ready) return;
    setEngineThinking(true);
    try {
      // Check if engine should play a book move
      const bookMoves = findBookMovesAtFen(repertoire?.tree, chess.fen());
      let bestUci;

      // 30% chance of playing a book move if available (makes it more realistic)
      if (bookMoves.size > 0 && Math.random() < 0.3) {
        const bookSans = Array.from(bookMoves.keys());
        const chosen = bookSans[Math.floor(Math.random() * bookSans.length)];
        const m = chess.move(chosen);
        if (m) {
          bestUci = m.from + m.to + (m.promotion || '');
        }
      }

      if (!bestUci) {
        bestUci = await engineRef.current.analyze(chess.fen(), {
          movetime: 1500,
          skillLevel,
        });
      }

      const moveData = uciToMove(bestUci);
      if (moveData) {
        const move = chess.move(moveData);
        if (move) {
          setFen(chess.fen());
          setLastMove([move.from, move.to]);
          setMoveHistory(prev => [...prev, move.san]);
          setLastDeviation(null);
          if (chess.isCheckmate()) setGameStatus('checkmate');
          else if (chess.isStalemate()) setGameStatus('stalemate');
          else if (chess.isDraw()) setGameStatus('draw');
        }
      }
    } catch (err) {
      console.error('Engine move error:', err);
    }
    setEngineThinking(false);
  }, [chess, skillLevel, repertoire]);

  const handleUserMove = useCallback((orig, dest) => {
    if (!isPlayerTurn() || gameStatus !== 'playing') return;

    const move = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!move) return;

    setFen(chess.fen());
    setLastMove([orig, dest]);
    setMoveHistory(prev => [...prev, move.san]);

    // Check if this is a book move
    const prevFen = chess.fen(); // current position after move
    // We need to check the position BEFORE this move to see if it was in the book
    // Temporarily undo to get the position
    chess.undo();
    const beforeFen = chess.fen();
    const bookMovesBefore = findBookMovesAtFen(repertoire?.tree, beforeFen);
    const isInBook = bookMovesBefore.has(move.san);

    // Redo the move
    chess.move(move.san);

    if (!isInBook && bookMovesBefore.size > 0) {
      // Deviation from the book!
      const bookSans = Array.from(bookMovesBefore.keys());
      setLastDeviation({ san: move.san, bookMoves: bookSans });
      setDeviations(prev => [...prev, {
        fen: beforeFen,
        played: move.san,
        expected: bookSans,
        moveNum: moveHistory.length + 1,
      }]);
    } else {
      setLastDeviation(null);
    }

    // Check game end
    if (chess.isCheckmate()) { setGameStatus('checkmate'); return; }
    if (chess.isStalemate()) { setGameStatus('stalemate'); return; }
    if (chess.isDraw()) { setGameStatus('draw'); return; }

    // Engine responds
    setTimeout(() => makeEngineMove(), 300);
  }, [chess, isPlayerTurn, gameStatus, makeEngineMove, repertoire, moveHistory.length]);

  const handleNewGame = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setMoveHistory([]);
    setGameStatus('playing');
    setDeviations([]);
    setLastDeviation(null);
    if (!isUserWhite) {
      setTimeout(() => makeEngineMove(), 500);
    }
  }, [chess, isUserWhite, makeEngineMove]);

  const dests = useMemo(() => computeDests(fen), [fen]);
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  const playerCanMove = isPlayerTurn() && gameStatus === 'playing';

  // Show book move arrow if last move was a deviation
  const deviationArrows = useMemo(() => {
    if (!lastDeviation) return [];
    // Show the first expected book move as a green arrow
    const bookSan = lastDeviation.bookMoves[0];
    const tempChess = new Chess(chess.fen());
    chess.undo(); // go back to position before deviation
    const prevFen = chess.fen();
    chess.move(lastDeviation.san); // redo
    // Use temp chess to find the move coordinates
    const tempC = new Chess(prevFen);
    const bookMove = tempC.move(bookSan);
    if (bookMove) {
      return [{ orig: bookMove.from, dest: bookMove.to, brush: 'green' }];
    }
    return [];
  }, [lastDeviation, fen, chess]);

  const cgConfig = useMemo(() => ({
    fen,
    orientation,
    turnColor,
    lastMove: lastMove || undefined,
    coordinates: true,
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 200 },
    movable: {
      free: false,
      dests: playerCanMove ? dests : new Map(),
      showDests: true,
      color: playerCanMove ? 'both' : undefined,
      events: { after: handleUserMove },
    },
    draggable: { enabled: playerCanMove, showGhost: true },
    selectable: { enabled: playerCanMove },
    drawable: { enabled: false, visible: true, autoShapes: deviationArrows },
  }), [fen, orientation, turnColor, lastMove, dests, playerCanMove, handleUserMove, deviationArrows]);

  const boardBg = typeof boardTheme === 'object' && boardTheme !== null ? boardTheme : { light: '#c8d9e8', dark: '#2d4a6e' };
  const boardSize = 'min(calc(100vw - 40px), 520px)';

  // Format move history
  const formattedMoves = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    formattedMoves.push(`${num}. ${moveHistory[i]}${moveHistory[i + 1] ? ' ' + moveHistory[i + 1] : ''}`);
  }

  const statusMessage = (() => {
    if (!engineReady) return '⏳ Loading Stockfish...';
    if (engineThinking) return '🤔 Engine is thinking...';
    if (gameStatus === 'checkmate') return chess.turn() === (isUserWhite ? 'w' : 'b') ? '🎉 You won!' : '💀 Checkmate — You lost';
    if (gameStatus === 'stalemate') return '🤝 Stalemate — Draw';
    if (gameStatus === 'draw') return '🤝 Draw';
    if (playerCanMove) return '♟ Your turn — play any move';
    return '⏳ Waiting...';
  })();

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6 p-2 md:p-8">
      {/* Header */}
      <div className="w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="px-2 md:px-3 py-1 md:py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>← Back</button>
          <div>
            <h2 className="font-orbitron font-bold text-sm" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>⚔ Sparring Mode</h2>
            <p className="text-xs" style={{ color: 'rgba(150,142,130,0.5)' }}>{repertoire?.name} — You play as {isUserWhite ? 'White' : 'Black'}</p>
          </div>
        </div>
        <span className="text-xs font-orbitron" style={{ color: engineReady ? '#6b8cae' : '#a8834a', letterSpacing: '0.08em' }}>
          {engineReady ? '● Engine Ready' : '○ Loading...'}
        </span>
      </div>

      {/* Board + Side panel */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-start w-full max-w-4xl">
        {/* Board */}
        <div className="flex-shrink-0 space-y-2 w-full lg:w-auto">
          <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ width: boardSize }}>
              <ChessgroundBoard config={cgConfig} boardTheme={boardBg} />
            </div>
            {/* Game end overlay */}
            {gameStatus !== 'playing' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.35)' }}>
                <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl" style={{ background: 'rgba(6,8,16,0.88)', border: '1px solid rgba(107,140,174,0.5)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                  <span style={{ fontSize: '2rem' }}>{gameStatus === 'checkmate' ? (chess.turn() !== (isUserWhite ? 'w' : 'b') ? '🎉' : '💀') : '🤝'}</span>
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', color: '#8daac4', letterSpacing: '0.1em', fontWeight: 700 }}>
                    {gameStatus === 'checkmate' ? 'CHECKMATE' : gameStatus === 'stalemate' ? 'STALEMATE' : 'DRAW'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 text-[10px] rounded transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>⟳ Flip</button>
            <button onClick={handleNewGame} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>↺ New Game</button>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex-1 min-w-0 space-y-2 md:space-y-3 w-full">
          {/* Status */}
          <div className="rounded-xl p-3 md:p-4" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <p className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{statusMessage}</p>
          </div>

          {/* Deviation alert */}
          {lastDeviation && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>⚠</span>
                <span style={{ color: '#ff6b6b', fontFamily: "'Orbitron', sans-serif", fontSize: '0.6rem', letterSpacing: '0.1em', fontWeight: 700 }}>DEVIATION FROM BOOK</span>
              </div>
              <p className="text-xs" style={{ color: 'rgba(160,152,138,0.7)' }}>
                You played <strong style={{ color: '#ff6b6b' }}>{lastDeviation.san}</strong> instead of <strong style={{ color: '#4ade80' }}>{lastDeviation.bookMoves.join(', ')}</strong>
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(160,152,138,0.5)' }}>Green arrow shows the book move</p>
            </div>
          )}

          {/* Difficulty */}
          <div className="rounded-xl p-2.5 md:p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>DIFFICULTY</h3>
            <div className="flex gap-1">
              {SKILL_LEVELS.map(s => (
                <button key={s.level} onClick={() => setSkillLevel(s.level)} className="flex-1 py-1 md:py-1.5 rounded-lg transition-all hover:scale-105 text-center" style={{
                  background: skillLevel === s.level ? 'rgba(107,140,174,0.2)' : 'rgba(107,140,174,0.04)',
                  border: `1px solid ${skillLevel === s.level ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.08)'}`,
                  cursor: 'pointer',
                }}>
                  <div className="text-[10px] font-orbitron font-semibold" style={{ color: skillLevel === s.level ? '#8daac4' : 'rgba(160,152,138,0.5)', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div className="text-[9px]" style={{ color: 'rgba(160,152,138,0.35)' }}>{s.elo}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Moves */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>MOVES</h3>
            <div className="font-mono text-xs leading-relaxed" style={{ color: 'rgba(160,152,138,0.6)' }}>
              {formattedMoves.length > 0 ? formattedMoves.join(' ') : <span className="italic" style={{ color: 'rgba(160,152,138,0.3)' }}>No moves yet</span>}
            </div>
          </div>

          {/* Deviations summary */}
          {deviations.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,107,107,0.04)', border: '1px solid rgba(255,107,107,0.1)' }}>
              <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(255,107,107,0.6)', letterSpacing: '0.1em' }}>DEVIATIONS ({deviations.length})</h3>
              <div className="space-y-1">
                {deviations.slice(-5).map((d, i) => (
                  <div key={i} className="text-xs" style={{ color: 'rgba(160,152,138,0.6)' }}>
                    <span style={{ color: '#ff6b6b' }}>{d.played}</span> instead of <span style={{ color: '#4ade80' }}>{d.expected.join(', ')}</span>
                  </div>
                ))}
                {deviations.length > 5 && <div className="text-xs" style={{ color: 'rgba(160,152,138,0.4)' }}>...and {deviations.length - 5} more</div>}
              </div>
            </div>
          )}

          {/* Sparring info */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-1.5" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>HOW TO SPAR</h3>
            <ul className="text-xs space-y-1" style={{ color: 'rgba(160,152,138,0.5)' }}>
              <li>• Play any move — free-form chess</li>
              <li>• ⚠ Deviations from book are flagged live</li>
              <li>• Green arrow shows the book move</li>
              <li>• Engine plays from your repertoire tree</li>
              <li>• Pressure-test lines you think you know</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
