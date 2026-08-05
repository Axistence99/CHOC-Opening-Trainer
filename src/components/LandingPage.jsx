import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { getRepertoires, addRepertoire } from '../utils/storage';
import { parsePGNToTree, countPositions } from '../utils/pgnParser';
import PREBUILT_REPERTOIRES from '../data/prebuiltRepertoires';
import ChessgroundBoard from './ChessgroundBoard';
import PlayVsEngine from './PlayVsEngine';

const OPENINGS = [
  { id: 'sicilian', name: 'Sicilian Defense', eco: 'B20', tags: ['Aggressive', 'Black', 'Semi-Open'], description: 'The most popular response to 1.e4. Creates an asymmetrical game full of tactical complexity.', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4'] },
  { id: 'ruy-lopez', name: 'Ruy López', eco: 'C60', tags: ['Classical', 'White', 'Open'], description: 'One of the oldest and most classic openings. White immediately pressures the e5 pawn defense.', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06', tags: ['Positional', 'White', 'Closed'], description: "White offers a pawn to control the center. One of chess's most respected openings.", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3'] },
  { id: 'kings-indian', name: "King's Indian Defense", eco: 'E60', tags: ['Dynamic', 'Black', 'Closed'], description: 'Black allows White full center control then counterattacks fiercely. Favored by Fischer and Kasparov.', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3'] },
  { id: 'french', name: 'French Defense', eco: 'C00', tags: ['Solid', 'Black', 'Semi-Open'], description: 'A solid, counter-punching defense. Black builds a pawn chain and fights for the center from behind.', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { id: 'london', name: 'London System', eco: 'D02', tags: ['Solid', 'White', 'Closed'], description: 'A reliable and solid setup for White. Easy to learn with consistent plans across variations.', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'] },
  { id: 'catalan-white', name: 'Catalan for White', eco: 'E05', tags: ['Positional', 'White', 'Closed'], description: 'A complex, theory-based opening where White fianchettos and pressures the long diagonal. Leads to small but lingering advantages and better pawn structures.', moves: ['d4', 'd5', 'c4', 'e6', 'Nf3', 'Nf6', 'g3'] },
];

// Build annotation strings from opening moves
function buildAnnotations(moves) {
  const chess = new Chess();
  return moves.map((move, i) => {
    const m = chess.move(move);
    const prefix = chess.turn() === 'b' && i === 0 ? '' : (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '');
    return `${prefix}${m.san}`;
  });
}

// Compute FEN and lastMove keys at each step
function computePositions(moves) {
  const chess = new Chess();
  const positions = [{ fen: chess.fen(), lastMove: null, turnColor: 'white' }];
  for (const move of moves) {
    const m = chess.move(move);
    positions.push({
      fen: chess.fen(),
      lastMove: [m.from, m.to],
      turnColor: chess.turn() === 'w' ? 'white' : 'black',
    });
  }
  return positions;
}

// Compute legal move destinations from a FEN
function computeDests(fen) {
  const chess = new Chess(fen);
  const dests = new Map();
  for (const move of chess.moves({ verbose: true })) {
    const existing = dests.get(move.from) || [];
    existing.push(move.to);
    dests.set(move.from, existing);
  }
  return dests;
}

function tagColor(tag) {
  const map = {
    'Aggressive': 'bg-red-950/60 text-red-300/80 border-red-900/40',
    'Classical':  'bg-amber-950/60 text-amber-300/80 border-amber-900/40',
    'Positional': 'bg-emerald-950/60 text-emerald-300/80 border-emerald-900/40',
    'Dynamic':    'bg-purple-950/60 text-purple-300/80 border-purple-900/40',
    'Solid':      'bg-slate-800/50 text-slate-300/80 border-slate-700/40',
    'White':      'bg-slate-700/40 text-slate-300/80 border-slate-600/30',
    'Black':      'bg-zinc-800/50 text-zinc-400/80 border-zinc-700/30',
    'Open':       'bg-sky-950/60 text-sky-300/80 border-sky-900/40',
    'Semi-Open':  'bg-teal-950/60 text-teal-300/80 border-teal-900/40',
    'Closed':     'bg-indigo-950/60 text-indigo-300/80 border-indigo-900/40',
  };
  return map[tag] || 'bg-slate-800/40 text-slate-400/80 border-slate-700/30';
}

const BOARD_THEMES_MAP = {
  space:    { light: '#c8d9e8', dark: '#2d4a6e', label: 'DeepBoard',  accent: '#6b8cae' },
  lichess:  { light: '#edeed1', dark: '#779952', label: 'Lichess',    accent: '#779952' },
  marble:   { light: '#f0d9b5', dark: '#b58863', label: 'Marble',     accent: '#b58863' },
};

// Piece sets from Lichess — all CC0, MIT, Apache 2.0, or GPLv2+
// See: https://github.com/lichess-org/lila/blob/master/COPYING.md
const PIECE_SETS = {
  cburnett:  { label: 'Cburnett',   license: 'GPLv2+', preview: '🟦' },
  rhosgfx:   { label: 'RhosGFX',    license: 'CC0',    preview: '🔷' },
  merida:    { label: 'Merida',     license: 'GPLv2+', preview: '🔶' },
  pirouetti: { label: 'Pirouetti',  license: 'AGPLv3+',preview: '🟣' },
  chessnut:  { label: 'Chessnut',   license: 'Apache', preview: '🟤' },
  kiwen:     { label: 'Kiwen-suwi', license: 'CC-BY',  preview: '🔺' },
};

// Generate CSS for piece set URLs from Lichess CDN
function generatePieceSetCSS(setKey) {
  if (setKey === 'cburnett') return null; // handled by chessground.cburnett.css
  const baseUrl = `https://lichess1.org/assets/piece/${setKey}/`;
  const roles = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
  const colors = ['white', 'black'];
  let css = '';
  for (const color of colors) {
    for (const role of roles) {
      const letter = role[0].toUpperCase();
      const colorLetter = color[0];
      css += `.cg-wrap piece.${role}.${color} { background-image: url('${baseUrl}${colorLetter}${letter}.svg'); }\n`;
    }
  }
  return css;
}

export default function LandingPage({ boardTheme, onBoardThemeChange, onSelectRepertoire }) {
  const [playerColor, setPlayerColor] = useState(null);
  const [selectedOpening, setSelectedOpening] = useState(OPENINGS[0]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentBoardTheme, setCurrentBoardTheme] = useState(boardTheme || 'space');
  const [pieceSet, setPieceSet] = useState('cburnett');
  const [orientation, setOrientation] = useState('white');
  const [playVsEngine, setPlayVsEngine] = useState(null); // null or 'w'/'b'

  const pieceStyleRef = useRef(null);

  // Compute positions for current opening
  const positions = useMemo(() => computePositions(selectedOpening.moves), [selectedOpening]);
  const annotations = useMemo(() => buildAnnotations(selectedOpening.moves), [selectedOpening]);

  const filteredOpenings = playerColor
    ? OPENINGS.filter(o => o.tags.includes(playerColor === 'w' ? 'White' : 'Black'))
    : [];

  const chooseColor = (c) => {
    const first = OPENINGS.find(o => o.tags.includes(c === 'w' ? 'White' : 'Black')) || OPENINGS[0];
    setPlayerColor(c);
    setSelectedOpening(first);
    setMoveIndex(0);
    setOrientation(c === 'w' ? 'white' : 'black');
  };

  const resetToOpening = useCallback((opening) => {
    setSelectedOpening(opening);
    setMoveIndex(0);
  }, []);

  const stepForward = useCallback(() => {
    setMoveIndex(i => Math.min(i + 1, positions.length - 1));
  }, [positions.length]);

  const stepBack = useCallback(() => {
    setMoveIndex(i => Math.max(i - 1, 0));
  }, []);

  const resetBoard = useCallback(() => {
    setMoveIndex(0);
  }, []);

  const goToEnd = useCallback(() => {
    setMoveIndex(positions.length - 1);
  }, [positions.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') stepForward();
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === 'Home') resetBoard();
      if (e.key === 'End') goToEnd();
      if (e.key === 'f') setOrientation(o => o === 'white' ? 'black' : 'white');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepForward, stepBack, resetBoard, goToEnd]);

  // Handle user making a move on the board (drag/click)
  const handleUserMove = useCallback((orig, dest) => {
    const chess = new Chess(positions[moveIndex].fen);
    const move = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (move) {
      // Check if this matches the next expected move in the opening
      if (moveIndex < selectedOpening.moves.length) {
        const expectedSan = selectedOpening.moves[moveIndex];
        if (move.san === expectedSan) {
          setMoveIndex(i => i + 1);
        } else {
          // Wrong move — briefly flash and reset
          setMoveIndex(i => i); // force re-render to reset board
        }
      }
    }
  }, [positions, moveIndex, selectedOpening]);

  // Compute dests for current position
  const currentFen = positions[moveIndex]?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentLastMove = positions[moveIndex]?.lastMove || undefined;
  const currentTurnColor = positions[moveIndex]?.turnColor || 'white';
  const dests = useMemo(() => computeDests(currentFen), [currentFen]);

  // Chessground config
  const cgConfig = useMemo(() => ({
    fen: currentFen,
    orientation,
    turnColor: currentTurnColor,
    lastMove: currentLastMove,
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
      dests,
      showDests: true,
      color: 'both',
      events: {
        after: handleUserMove,
      },
    },
    draggable: {
      enabled: true,
      showGhost: true,
    },
    selectable: {
      enabled: true,
    },
    drawable: {
      enabled: true,
      visible: true,
      eraseOnClick: true,
    },
  }), [currentFen, orientation, currentTurnColor, currentLastMove, dests, handleUserMove]);

  // Inject piece set CSS dynamically
  useEffect(() => {
    let styleEl = pieceStyleRef.current;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'chessground-piece-override';
      document.head.appendChild(styleEl);
      pieceStyleRef.current = styleEl;
    }
    const css = generatePieceSetCSS(pieceSet);
    styleEl.textContent = css || '';
    // Toggle cburnett CSS
    const cburnettLink = document.getElementById('chessground-cburnett-css');
    if (cburnettLink) {
      cburnettLink.disabled = pieceSet !== 'cburnett';
    }
  }, [pieceSet]);

  const currentAnnotation = moveIndex > 0 ? annotations[moveIndex - 1] : 'Starting position';
  const progressPct = (moveIndex / selectedOpening.moves.length) * 100;

  const handleThemeChange = (key) => {
    setCurrentBoardTheme(key);
    onBoardThemeChange(key);
  };

  const handlePractice = () => {
    const matching = PREBUILT_REPERTOIRES.find(p =>
      activeOpening.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) ||
      p.name.toLowerCase().includes(activeOpening.name.toLowerCase().split(' ')[0])
    );
    if (matching) {
      const repertoires = getRepertoires();
      if (!repertoires.some(r => r.id === matching.id)) {
        try {
          const tree = parsePGNToTree(matching.pgn);
          const positionCount = countPositions(tree) - 1;
          const newRep = { ...matching, tree, positionCount, isPrebuilt: true, createdAt: Date.now() };
          addRepertoire(newRep);
        } catch (e) { console.error(e); }
      }
      onSelectRepertoire(matching);
    } else {
      const repertoires = getRepertoires();
      if (repertoires.length > 0) {
        onSelectRepertoire(repertoires[0]);
      }
    }
  };

  const theme = BOARD_THEMES_MAP[currentBoardTheme] || BOARD_THEMES_MAP.space;
  const activeOpening = selectedOpening;
  const boardSize = 'clamp(320px, 55vw, 560px)';

  // If playing vs engine, render that instead
  if (playVsEngine) {
    return (
      <div className="relative min-h-screen overflow-hidden" style={{ background: '#080b14', fontFamily: "'Inter', sans-serif" }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 25% 45%, #0e1828 0%, transparent 58%), radial-gradient(ellipse at 75% 20%, #110e20 0%, transparent 52%), radial-gradient(ellipse at 55% 85%, #0c1520 0%, transparent 50%), #080b14' }} />
        </div>
        <div className="relative" style={{ zIndex: 1 }}>
          <PlayVsEngine
            playerColor={playVsEngine}
            boardTheme={{ light: theme.light, dark: theme.dark }}
            onExit={() => setPlayVsEngine(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#080b14', fontFamily: "'Inter', sans-serif" }}>
      {/* Nebula background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 25% 45%, #0e1828 0%, transparent 58%), radial-gradient(ellipse at 75% 20%, #110e20 0%, transparent 52%), radial-gradient(ellipse at 55% 85%, #0c1520 0%, transparent 50%), #080b14'
        }} />
        <div className="nebula-blob-1 absolute" style={{ top: '-20%', left: '-15%', width: '90vw', height: '90vw', background: 'radial-gradient(ellipse, rgba(18,28,52,0.85) 0%, rgba(12,18,36,0.5) 45%, transparent 70%)', borderRadius: '62% 38% 46% 54% / 52% 64% 36% 48%', filter: 'blur(80px)' }} />
        <div className="nebula-blob-2 absolute" style={{ top: '30%', right: '-25%', width: '100vw', height: '80vw', background: 'radial-gradient(ellipse, rgba(22,14,38,0.75) 0%, rgba(14,10,28,0.4) 45%, transparent 70%)', borderRadius: '38% 62% 54% 46% / 64% 38% 62% 38%', filter: 'blur(90px)' }} />
        <div className="nebula-blob-3 absolute" style={{ bottom: '-25%', left: '10%', width: '85vw', height: '85vw', background: 'radial-gradient(ellipse, rgba(10,20,40,0.7) 0%, rgba(8,14,28,0.4) 50%, transparent 70%)', borderRadius: '54% 46% 38% 62% / 44% 56% 44% 56%', filter: 'blur(100px)' }} />
      </div>

      {/* Main layout */}
      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b" style={{ borderColor: 'rgba(107,140,174,0.12)', background: 'rgba(6,8,16,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center text-2xl">♟</div>
            <div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#ddd8cc', letterSpacing: '0.08em' }}>
                CHOC <span style={{ color: '#6b8cae' }}>Opening Trainer</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-6">
              <div style={{ color: 'rgba(170,162,148,0.75)', fontSize: '0.8rem' }}>
                <span style={{ color: '#8daac4' }}>{OPENINGS.length}</span> Repertoires
              </div>
              <div className="h-4 w-px" style={{ background: 'rgba(107,140,174,0.22)' }} />
              <div style={{ color: 'rgba(170,162,148,0.75)', fontSize: '0.8rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em' }}>← → Navigate</div>
            </div>
            <button onClick={() => setSettingsOpen(v => !v)} title="Board Settings" className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: settingsOpen ? 'rgba(107,140,174,0.18)' : 'rgba(107,140,174,0.07)', border: `1px solid ${settingsOpen ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.14)'}`, color: settingsOpen ? '#8daac4' : '#475569', fontSize: '1rem', cursor: 'pointer' }}>⚙</button>
            <button className="md:hidden flex flex-col gap-1 p-2" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle repertoires">
              {[0,1,2].map(i => <div key={i} className="w-5 h-0.5 rounded" style={{ background: '#8daac4' }} />)}
            </button>
          </div>
        </header>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="border-b px-4 md:px-8 py-4" style={{ background: 'rgba(6,8,16,0.85)', borderColor: 'rgba(107,140,174,0.1)', backdropFilter: 'blur(12px)' }}>
            <div className="flex flex-wrap gap-8">
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>BOARD</div>
                <div className="flex gap-2">
                  {Object.entries(BOARD_THEMES_MAP).map(([key, t]) => (
                    <button key={key} onClick={() => handleThemeChange(key)} className="flex flex-col items-center gap-1.5 transition-all hover:scale-105" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                      <div className="rounded overflow-hidden" style={{ width: 40, height: 40, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', outline: currentBoardTheme === key ? `2px solid ${t.accent}` : '2px solid transparent', outlineOffset: 2 }}>
                        {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? t.light : t.dark }} />)}
                      </div>
                      <span style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: currentBoardTheme === key ? '#fff' : 'rgba(150,142,130,0.5)', letterSpacing: '0.05em' }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="hidden md:block w-px self-stretch" style={{ background: 'rgba(107,140,174,0.12)' }} />
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>PIECES</div>
                <div className="flex gap-2">
                  {Object.entries(PIECE_SETS).map(([key, s]) => {
                    const previewUrl = `https://lichess1.org/assets/piece/${key}/wK.svg`;
                    return (
                      <button key={key} onClick={() => setPieceSet(key)} className="flex flex-col items-center gap-1.5 transition-all hover:scale-105" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                        <div className="rounded-lg flex items-center justify-center" style={{ width: 44, height: 44, background: 'rgba(15,20,40,0.8)', outline: pieceSet === key ? '2px solid #6b8cae' : '2px solid rgba(107,140,174,0.12)', outlineOffset: 2, fontSize: '1.6rem' }}>
                          <img src={previewUrl} alt={s.label} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                        </div>
                        <span style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: pieceSet === key ? '#fff' : 'rgba(150,142,130,0.5)', letterSpacing: '0.05em' }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hidden md:block w-px self-stretch" style={{ background: 'rgba(107,140,174,0.12)' }} />
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>ORIENTATION</div>
                <div className="flex gap-2">
                  {['white', 'black'].map(c => (
                    <button key={c} onClick={() => setOrientation(c)} className="flex flex-col items-center gap-1.5 transition-all hover:scale-105" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                      <div className="rounded-lg flex items-center justify-center" style={{ width: 44, height: 44, background: 'rgba(15,20,40,0.8)', outline: orientation === c ? '2px solid #6b8cae' : '2px solid rgba(107,140,174,0.12)', outlineOffset: 2, fontSize: '1.6rem' }}>
                        {c === 'white' ? '♔' : '♚'}
                      </div>
                      <span style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: orientation === c ? '#fff' : 'rgba(150,142,130,0.5)', letterSpacing: '0.05em' }}>{c.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Center — Chessboard */}
          <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 gap-6">
            <div className="md:hidden text-center">
              <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 600, fontSize: '0.9rem' }}>{activeOpening.name}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: 2 }}>ECO {activeOpening.eco}</div>
            </div>

            {/* Interactive Chess Board */}
            <div className="board-appear relative">
              <div className="relative rounded-lg overflow-hidden p-3" style={{ background: 'rgba(10,13,24,0.95)', border: '1px solid rgba(110,125,148,0.16)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
                <div style={{ width: boardSize }}>
                  <ChessgroundBoard
                    config={cgConfig}
                    boardTheme={{ light: theme.light, dark: theme.dark }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile-only: Choose Color + Play vs Engine (hidden on md+) */}
            <div className="md:hidden flex flex-col gap-3 w-full max-w-sm">
              {!playerColor ? (
                <>
                  <div style={{ color: 'rgba(150,142,130,0.5)', fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', textAlign: 'center' }}>Which side do you play?</div>
                  <div className="flex gap-3">
                    <button onClick={() => chooseColor('w')} className="flex-1 rounded-xl p-4 flex flex-col items-center gap-2 transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(248,250,252,0.12), rgba(203,213,225,0.06))', border: '1px solid rgba(248,250,252,0.25)', cursor: 'pointer' }}>
                      <span style={{ fontSize: '2rem', lineHeight: 1 }}>♔</span>
                      <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em' }}>WHITE</div>
                    </button>
                    <button onClick={() => chooseColor('b')} className="flex-1 rounded-xl p-4 flex flex-col items-center gap-2 transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.6))', border: '1px solid rgba(107,140,174,0.22)', cursor: 'pointer' }}>
                      <span style={{ fontSize: '2rem', lineHeight: 1 }}>♚</span>
                      <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#b8b2a8', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em' }}>BLACK</div>
                    </button>
                  </div>
                  <div style={{ color: 'rgba(150,142,130,0.35)', fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.15em', textAlign: 'center' }}>— OR —</div>
                  <button onClick={() => setPlayVsEngine('w')} className="w-full rounded-xl p-3 flex items-center gap-3 transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.15), rgba(168,131,74,0.08))', border: '1px solid rgba(107,140,174,0.25)', cursor: 'pointer' }}>
                    <span style={{ fontSize: '1.3rem' }}>⚔</span>
                    <div className="text-left flex-1">
                      <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.08em' }}>PLAY AS WHITE</div>
                      <div style={{ color: 'rgba(160,152,138,0.5)', fontSize: '0.55rem', marginTop: 2 }}>vs Stockfish</div>
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#6b8cae' }}>♔</span>
                  </button>
                  <button onClick={() => setPlayVsEngine('b')} className="w-full rounded-xl p-3 flex items-center gap-3 transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.15), rgba(168,131,74,0.08))', border: '1px solid rgba(107,140,174,0.25)', cursor: 'pointer' }}>
                    <span style={{ fontSize: '1.3rem' }}>⚔</span>
                    <div className="text-left flex-1">
                      <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#b8b2a8', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.08em' }}>PLAY AS BLACK</div>
                      <div style={{ color: 'rgba(160,152,138,0.5)', fontSize: '0.55rem', marginTop: 2 }}>vs Stockfish</div>
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#6b8cae' }}>♚</span>
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setPlayerColor(null)} className="flex-1 py-2.5 rounded-lg transition-all active:scale-95" style={{ background: 'rgba(107,140,174,0.07)', border: '1px solid rgba(107,140,174,0.14)', cursor: 'pointer' }}>
                    <span style={{ color: '#8daac4', fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>← CHANGE COLOR</span>
                  </button>
                  <button onClick={() => chooseColor(playerColor === 'w' ? 'b' : 'w')} className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95" style={{ background: 'rgba(107,140,174,0.07)', border: '1px solid rgba(107,140,174,0.14)', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.75rem' }}>{playerColor === 'w' ? '♚' : '♔'}</span>
                    <span style={{ color: '#8daac4', fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>SWITCH</span>
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-3 w-full max-w-sm md:max-w-md">
              <div className="w-full rounded-lg px-4 py-2.5 text-center" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.14)', backdropFilter: 'blur(8px)' }}>
                <div style={{ color: '#a8834a', fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em' }}>{currentAnnotation}</div>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(107,140,174,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #6b8cae, #7a8caa)', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }} />
              </div>
              <div style={{ color: 'rgba(150,142,130,0.5)', fontSize: '0.65rem', fontFamily: "'Orbitron', sans-serif" }}>Move {moveIndex} / {activeOpening.moves.length}</div>
              <div className="flex items-center gap-3">
                <button onClick={resetBoard} className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(10,15,35,0.8)', border: '1px solid rgba(107,140,174,0.18)', color: '#7a746a', fontSize: '0.75rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>↺ RESET</button>
                <button onClick={stepBack} disabled={moveIndex === 0} className="w-11 h-11 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: 'rgba(107,140,174,0.12)', border: '1px solid rgba(107,140,174,0.28)', color: '#8daac4', fontSize: '1.1rem', cursor: moveIndex === 0 ? 'not-allowed' : 'pointer' }}>‹</button>
                <button onClick={stepForward} disabled={moveIndex >= activeOpening.moves.length} className="w-11 h-11 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: moveIndex >= activeOpening.moves.length ? 'rgba(107,140,174,0.08)' : 'rgba(107,140,174,0.18)', border: '1px solid rgba(107,140,174,0.35)', color: '#a8c0d6', fontSize: '1.1rem', cursor: moveIndex >= activeOpening.moves.length ? 'not-allowed' : 'pointer' }}>›</button>
                <button onClick={goToEnd} className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(168,131,74,0.12)', border: '1px solid rgba(168,131,74,0.25)', color: '#a8834a', fontSize: '0.75rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', cursor: 'pointer' }}>END →</button>
              </div>
              {/* Flip + Practice buttons */}
              <div className="flex gap-3 w-full">
                <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="flex-1 px-4 py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(107,140,174,0.08)', border: '1px solid rgba(107,140,174,0.18)', color: '#8daac4', fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', letterSpacing: '0.08em', cursor: 'pointer' }}>⟳ FLIP</button>
                <button onClick={handlePractice} className="flex-[2] px-6 py-3 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.35)', color: '#ddd8cc', fontFamily: "'Orbitron', sans-serif", fontSize: '0.85rem', letterSpacing: '0.12em', cursor: 'pointer', boxShadow: '0 0 20px rgba(107,140,174,0.1)' }}>♠ PRACTICE THIS OPENING</button>
              </div>
            </div>
          </main>

          {/* Sidebar */}
          <aside className={`fixed md:relative inset-y-0 right-0 md:inset-auto w-72 md:w-80 lg:w-96 flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} style={{ background: 'rgba(6,8,16,0.92)', borderLeft: '1px solid rgba(107,140,174,0.12)', backdropFilter: 'blur(20px)', zIndex: 50 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(107,140,174,0.1)' }}>
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.15em' }}>{playerColor ? 'REPERTOIRES' : 'CHOOSE COLOR'}</div>
                <div style={{ color: 'rgba(150,142,130,0.5)', fontSize: '0.6rem', marginTop: 2 }}>{playerColor ? `Playing as ${playerColor === 'w' ? 'White' : 'Black'} · ${filteredOpenings.length} openings` : 'Select your side to see openings'}</div>
              </div>
              <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(false)} style={{ color: '#7a746a' }}>✕</button>
            </div>

            {!playerColor && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
                <div style={{ color: 'rgba(150,142,130,0.5)', fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', textAlign: 'center' }}>Which side do you play?</div>
                <button onClick={() => chooseColor('w')} className="w-full rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(248,250,252,0.12), rgba(203,213,225,0.06))', border: '1px solid rgba(248,250,252,0.25)', boxShadow: '0 0 30px rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '3rem', lineHeight: 1 }}>♔</span>
                  <div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', textAlign: 'center' }}>WHITE</div>
                    <div style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.65rem', marginTop: 4, textAlign: 'center' }}>{OPENINGS.filter(o => o.tags.includes('White')).length} openings available</div>
                  </div>
                </button>
                <button onClick={() => chooseColor('b')} className="w-full rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.6))', border: '1px solid rgba(107,140,174,0.22)', boxShadow: '0 0 30px rgba(107,140,174,0.07)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '3rem', lineHeight: 1 }}>♚</span>
                  <div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#b8b2a8', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', textAlign: 'center' }}>BLACK</div>
                    <div style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.65rem', marginTop: 4, textAlign: 'center' }}>{OPENINGS.filter(o => o.tags.includes('Black')).length} openings available</div>
                  </div>
                </button>
                {/* Play vs Stockfish */}
                <div style={{ color: 'rgba(150,142,130,0.35)', fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.15em', textAlign: 'center', width: '100%' }}>— OR —</div>
                <button onClick={() => setPlayVsEngine('w')} className="w-full rounded-xl p-3.5 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.15), rgba(168,131,74,0.08))', border: '1px solid rgba(107,140,174,0.25)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚔</span>
                  <div className="text-left flex-1">
                    <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#ddd8cc', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.08em' }}>PLAY AS WHITE</div>
                    <div style={{ color: 'rgba(160,152,138,0.5)', fontSize: '0.6rem', marginTop: 2 }}>vs Stockfish engine</div>
                  </div>
                  <span style={{ fontSize: '1.2rem', color: '#6b8cae' }}>♔</span>
                </button>
                <button onClick={() => setPlayVsEngine('b')} className="w-full rounded-xl p-3.5 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.15), rgba(168,131,74,0.08))', border: '1px solid rgba(107,140,174,0.25)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚔</span>
                  <div className="text-left flex-1">
                    <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#b8b2a8', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.08em' }}>PLAY AS BLACK</div>
                    <div style={{ color: 'rgba(160,152,138,0.5)', fontSize: '0.6rem', marginTop: 2 }}>vs Stockfish engine</div>
                  </div>
                  <span style={{ fontSize: '1.2rem', color: '#6b8cae' }}>♚</span>
                </button>
              </div>
            )}

            {playerColor && (
              <div className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-2">
                <button onClick={() => { setPlayerColor(null); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'rgba(107,140,174,0.07)', border: '1px solid rgba(107,140,174,0.14)', cursor: 'pointer' }}>
                  <span style={{ color: '#8daac4', fontSize: '0.65rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>← BACK TO COLOR SELECT</span>
                </button>
                <button onClick={() => chooseColor(playerColor === 'w' ? 'b' : 'w')} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'rgba(107,140,174,0.07)', border: '1px solid rgba(107,140,174,0.14)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.85rem' }}>{playerColor === 'w' ? '♔' : '♚'}</span>
                  <span style={{ color: '#8daac4', fontSize: '0.65rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.08em' }}>SWITCH TO {playerColor === 'w' ? 'BLACK' : 'WHITE'}</span>
                  <span style={{ fontSize: '0.85rem' }}>{playerColor === 'w' ? '♚' : '♔'}</span>
                </button>
                {filteredOpenings.map((opening, idx) => {
                  const active = opening.id === activeOpening.id;
                  return (
                    <button key={opening.id} onClick={() => { resetToOpening(opening); setSidebarOpen(false); }} className="w-full text-left rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.01]" style={{ background: active ? 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(100,95,140,0.15))' : 'rgba(15,20,40,0.6)', border: active ? '1px solid rgba(107,140,174,0.35)' : '1px solid rgba(107,140,174,0.08)', boxShadow: active ? '0 0 20px rgba(107,140,174,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.6rem', color: active ? '#a8834a' : 'rgba(150,142,130,0.5)', letterSpacing: '0.1em', fontWeight: 600 }}>{opening.eco}</span>
                            {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6b8cae', flexShrink: 0 }} />}
                          </div>
                          <div style={{ color: active ? '#fff' : '#cbd5e1', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{opening.name}</div>
                          <p style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.7rem', marginTop: '0.35rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{opening.description}</p>
                        </div>
                        <div style={{ color: active ? '#6b8cae' : 'rgba(130,122,110,0.35)', fontSize: '1.3rem', flexShrink: 0 }}>{idx % 2 === 0 ? '♔' : '♛'}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {opening.tags.map(tag => (
                          <span key={tag} className={`px-1.5 py-0.5 rounded border ${tagColor(tag)}`} style={{ fontSize: '0.6rem' }}>{tag}</span>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(107,140,174,0.08)' }}>
                          {active && <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(moveIndex / activeOpening.moves.length) * 100}%`, background: 'linear-gradient(90deg, #6b8cae, #7a8caa)' }} />}
                        </div>
                        <span style={{ color: 'rgba(140,132,120,0.45)', fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", flexShrink: 0 }}>{opening.moves.length} moves</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(107,140,174,0.1)' }}>
              <div className="rounded-lg p-3" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)' }}>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.65rem', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>KEYBOARD SHORTCUTS</div>
                <div style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.65rem', lineHeight: 1.6 }}>
                  <span style={{ color: '#94a3b8' }}>←</span> Prev &nbsp; <span style={{ color: '#94a3b8' }}>→</span> Next &nbsp; <span style={{ color: '#94a3b8' }}>F</span> Flip &nbsp; <span style={{ color: '#94a3b8' }}>Home</span> Reset &nbsp; <span style={{ color: '#94a3b8' }}>End</span> End
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 md:hidden" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 40 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Footer — License & Credits */}
      <footer className="relative w-full px-4 md:px-8 py-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ zIndex: 1, borderColor: 'rgba(107,140,174,0.08)', background: 'rgba(6,8,16,0.5)' }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(150,142,130,0.4)' }}>
          <span>© 2024–2026 CHOC Opening Trainer</span>
          <span>·</span>
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(107,140,174,0.5)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>GPL-3.0-or-later</a>
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(150,142,130,0.4)' }}>
          <span>Board by</span>
          <a href="https://github.com/lichess-org/chessground" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(107,140,174,0.5)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>chessground</a>
          <span>·</span>
          <span>Engine</span>
          <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(107,140,174,0.5)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Stockfish</a>
          <span>·</span>
          <span>Pieces from</span>
          <a href="https://lichess.org" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(107,140,174,0.5)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Lichess</a>
          <span>(<a href="https://github.com/lichess-org/lila/blob/master/COPYING.md" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(107,140,174,0.5)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>licenses</a>)</span>
        </div>
      </footer>
    </div>
  );
}
