import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import StockfishEngine, { uciToMove } from '../utils/stockfishEngine';
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
  } catch {
    return new Map();
  }
}

export default function PlayVsEngine({ playerColor, boardTheme, onExit }) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState(null);
  const [orientation, setOrientation] = useState(playerColor === 'w' ? 'white' : 'black');
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing'); // playing, checkmate, stalemate, draw
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState(null);
  const [skillLevel, setSkillLevel] = useState(10);
  const [capturedByPlayer, setCapturedByPlayer] = useState([]);
  const [capturedByEngine, setCapturedByEngine] = useState([]);

  const engineRef = useRef(null);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine.init()
      .then(() => setEngineReady(true))
      .catch((err) => {
        console.error('Stockfish init error:', err);
        setEngineError(err.message);
      });

    return () => {
      engine.quit();
    };
  }, []);

  // If playing as black, engine makes first move
  useEffect(() => {
    if (engineReady && playerColor === 'b' && moveHistory.length === 0 && gameStatus === 'playing') {
      makeEngineMove();
    }
  }, [engineReady, playerColor, moveHistory.length, gameStatus]);

  const isPlayerTurn = useCallback(() => {
    const turnIsWhite = chess.turn() === 'w';
    return (playerColor === 'w' && turnIsWhite) || (playerColor === 'b' && !turnIsWhite);
  }, []); // no deps needed — reads live chess state at call time

  const makeEngineMove = useCallback(async () => {
    if (!engineRef.current || !engineRef.current.ready) return;
    setEngineThinking(true);
    try {
      const bestUci = await engineRef.current.analyze(chess.fen(), {
        movetime: 1500,
        skillLevel,
      });
      const moveData = uciToMove(bestUci);
      if (moveData) {
        const move = chess.move(moveData);
        if (move) {
          setFen(chess.fen());
          setLastMove([move.from, move.to]);
          setMoveHistory(prev => [...prev, move.san]);
          if (move.captured) {
            setCapturedByEngine(prev => [...prev, move.captured]);
          }
          // Check game end
          if (chess.isCheckmate()) setGameStatus('checkmate');
          else if (chess.isStalemate()) setGameStatus('stalemate');
          else if (chess.isDraw()) setGameStatus('draw');
        }
      }
    } catch (err) {
      console.error('Engine move error:', err);
    }
    setEngineThinking(false);
  }, [chess, skillLevel]);

  const handleUserMove = useCallback((orig, dest) => {
    if (!isPlayerTurn() || gameStatus !== 'playing') return;

    const move = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!move) return;

    setFen(chess.fen());
    setLastMove([orig, dest]);
    setMoveHistory(prev => [...prev, move.san]);
    if (move.captured) {
      setCapturedByPlayer(prev => [...prev, move.captured]);
    }

    // Check game end
    if (chess.isCheckmate()) {
      setGameStatus('checkmate');
      return;
    }
    if (chess.isStalemate()) { setGameStatus('stalemate'); return; }
    if (chess.isDraw()) { setGameStatus('draw'); return; }

    // Engine responds
    setTimeout(() => makeEngineMove(), 300);
  }, [chess, isPlayerTurn, gameStatus, makeEngineMove]);

  const handleNewGame = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setMoveHistory([]);
    setGameStatus('playing');
    setCapturedByPlayer([]);
    setCapturedByEngine([]);
    if (playerColor === 'b') {
      setTimeout(() => makeEngineMove(), 500);
    }
  }, [chess, playerColor, makeEngineMove]);

  const dests = useMemo(() => computeDests(fen), [fen]);
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  // Must depend on fen so playerCanMove recalculates after each move
  const playerCanMove = isPlayerTurn() && gameStatus === 'playing';

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
    drawable: { enabled: false, visible: true },
  }), [fen, orientation, turnColor, lastMove, dests, playerCanMove, handleUserMove]);

  const boardColors = boardTheme || { light: '#c8d9e8', dark: '#2d4a6e' };
  const boardSize = 'min(calc(100vw - 40px), 520px)';

  // Format move history with move numbers
  const formattedMoves = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    formattedMoves.push(`${num}. ${moveHistory[i]}${moveHistory[i + 1] ? ' ' + moveHistory[i + 1] : ''}`);
  }

  const statusMessage = (() => {
    if (engineError) return '⚠ Engine failed to load';
    if (!engineReady) return '⏳ Loading Stockfish...';
    if (engineThinking) return '🤔 Engine is thinking...';
    if (gameStatus === 'checkmate') return chess.turn() === playerColor.charAt(0) ? '💀 Checkmate — You lost' : '🎉 Checkmate — You won!';
    if (gameStatus === 'stalemate') return '🤝 Stalemate — Draw';
    if (gameStatus === 'draw') return '🤝 Draw';
    if (playerCanMove) return '♟ Your turn — make a move';
    return '⏳ Waiting...';
  })();

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6 p-2 md:p-8">
      {/* Header */}
      <div className="w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="px-2 md:px-3 py-1 md:py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>← Back</button>
          <div>
            <h2 className="font-orbitron font-bold text-sm" style={{ color: '#ddd8cc', letterSpacing: '0.08em' }}>Play vs Stockfish</h2>
            <p className="text-xs" style={{ color: 'rgba(150,142,130,0.5)' }}>You play as {playerColor === 'w' ? 'White' : 'Black'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-orbitron" style={{ color: engineReady ? '#6b8cae' : '#a8834a', letterSpacing: '0.08em' }}>
            {engineReady ? '● Engine Ready' : '○ Loading...'}
          </span>
        </div>
      </div>

      {/* Board + Side panel */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-start w-full max-w-4xl">
        {/* Board */}
        <div className="flex-shrink-0 space-y-2 w-full lg:w-auto">
          <div>
            <div className="relative rounded-lg overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ width: boardSize }}>
                <ChessgroundBoard config={cgConfig} boardTheme={boardColors} />
              </div>
              {gameStatus !== 'playing' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: gameStatus === 'checkmate' && chess.turn() === playerColor.charAt(0) ? 'rgba(255,50,50,0.18)' : 'rgba(0,0,0,0.35)' }}>
                  <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl" style={{ background: 'rgba(6,8,16,0.88)', border: `1px solid ${gameStatus === 'checkmate' && chess.turn() !== playerColor.charAt(0) ? 'rgba(107,140,174,0.5)' : gameStatus === 'checkmate' ? 'rgba(255,107,107,0.4)' : 'rgba(168,131,74,0.4)'}`, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    <span style={{ fontSize: '2rem' }}>{gameStatus === 'checkmate' ? (chess.turn() === playerColor.charAt(0) ? '💀' : '🎉') : '🤝'}</span>
                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', color: gameStatus === 'checkmate' && chess.turn() !== playerColor.charAt(0) ? '#8daac4' : gameStatus === 'checkmate' ? '#ff6b6b' : '#a8834a', letterSpacing: '0.1em', fontWeight: 700 }}>
                      {gameStatus === 'checkmate' ? 'CHECKMATE' : gameStatus === 'stalemate' ? 'STALEMATE' : 'DRAW'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(160,152,138,0.7)' }}>
                      {gameStatus === 'checkmate' ? (chess.turn() === playerColor.charAt(0) ? 'You lost' : 'You won!') : gameStatus === 'stalemate' ? '½–½' : '½–½'}
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-2 py-1 text-[10px] rounded transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>⟳ Flip</button>
            <button onClick={handleNewGame} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>↺ New Game</button>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex-1 min-w-0 space-y-2 md:space-y-3 w-full">
          {/* Status */}
          <div className="rounded-xl p-3 md:p-4" style={{
            background: gameStatus === 'checkmate' ? (chess.turn() !== playerColor.charAt(0) ? 'rgba(107,140,174,0.12)' : 'rgba(255,107,107,0.08)') : gameStatus !== 'playing' ? 'rgba(168,131,74,0.12)' : 'rgba(15,20,40,0.6)',
            border: `1px solid ${gameStatus !== 'playing' ? 'rgba(107,140,174,0.3)' : 'rgba(107,140,174,0.08)'}`,
          }}>
            <p className="text-sm font-medium" style={{ color: gameStatus !== 'playing' ? '#8daac4' : '#cbd5e1' }}>{statusMessage}</p>
          </div>

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

          {/* Captured pieces */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>CAPTURED</h3>
            <div className="flex items-center gap-4 text-lg">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-orbitron" style={{ color: 'rgba(150,142,130,0.4)' }}>You:</span>
                <span>{capturedByPlayer.map((p, i) => <span key={i}>{'♟♞♝♜♛'[['p','n','b','r','q'].indexOf(p)] || p}</span>)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-orbitron" style={{ color: 'rgba(150,142,130,0.4)' }}>Engine:</span>
                <span>{capturedByEngine.map((p, i) => <span key={i}>{'♟♞♝♜♛'[['p','n','b','r','q'].indexOf(p)] || p}</span>)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
