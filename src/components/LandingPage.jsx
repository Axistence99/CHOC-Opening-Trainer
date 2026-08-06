import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { Chess } from 'chess.js';
import { getRepertoires, addRepertoire } from '../utils/storage';
import { parsePGNToTree, countPositions } from '../utils/pgnParser';
import PREBUILT_REPERTOIRES from '../data/prebuiltRepertoires';
import { getAllBoardThemes, getBoardTheme, getBoardThemeBackground, getBoardThemePreview } from '../data/boardThemes';
import PlayVsEngine from './PlayVsEngine';
import RepertoireEditor from './RepertoireEditor';

const OPENINGS = [
  { id: 'sicilian', name: 'Sicilian Defense', eco: 'B20', tags: ['Aggressive', 'Black', 'Semi-Open'], description: 'The most popular response to 1.e4. Creates an asymmetrical game full of tactical complexity.', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4'] },
  { id: 'ruy-lopez', name: 'Ruy López', eco: 'C60', tags: ['Classical', 'White', 'Open'], description: 'One of the oldest and most classic openings. White immediately pressures the e5 pawn defense.', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06', tags: ['Positional', 'White', 'Closed'], description: "White offers a pawn to control the center. One of chess's most respected openings.", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3'] },
  { id: 'kings-indian', name: "King's Indian Defense", eco: 'E60', tags: ['Dynamic', 'Black', 'Closed'], description: 'Black allows White full center control then counterattacks fiercely. Favored by Fischer and Kasparov.', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3'] },
  { id: 'french', name: 'French Defense', eco: 'C00', tags: ['Solid', 'Black', 'Semi-Open'], description: 'A solid, counter-punching defense. Black builds a pawn chain and fights for the center from behind.', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { id: 'london', name: 'London System', eco: 'D02', tags: ['Solid', 'White', 'Closed'], description: 'A reliable and solid setup for White. Easy to learn with consistent plans across variations.', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'] },
  { id: 'catalan-white', name: 'Catalan for White', eco: 'E05', tags: ['Positional', 'White', 'Closed'], description: 'A complete Catalan repertoire for White (46 chapters & 845 positions). Covers Open Catalan (Qc2, Ne5, a6 lines), Closed Catalan (e4 plans), and responses to KID, Slav, QID, Tarrasch, Dutch, Benoni, and Grünfeld.', moves: ['d4', 'd5', 'c4', 'e6', 'Nf3', 'Nf6', 'g3'] },
];

// Extract main line SAN moves from custom repertoire
function getCustomRepertoireMoves(rep) {
  if (rep.moves && Array.isArray(rep.moves) && rep.moves.length > 0) return rep.moves;
  if (rep.pgn) {
    try {
      const tree = parsePGNToTree(rep.pgn);
      const history = [];
      let curr = tree;
      while (curr && curr.children && curr.children.size > 0) {
        const [san, next] = curr.children.entries().next().value;
        history.push(san);
        curr = next;
      }
      return history;
    } catch { return []; }
  }
  return [];
}

// Combine saved custom repertoires with default prebuilt openings
function loadAllOpenings() {
  const customReps = getRepertoires();
  const formattedCustoms = customReps.map(rep => {
    const isWhite = rep.color === 'white' || (rep.tags && rep.tags.includes('White'));
    const colorTag = isWhite ? 'White' : 'Black';
    const existingTags = Array.isArray(rep.tags) ? rep.tags : [];
    const tags = existingTags.includes(colorTag) ? existingTags : [colorTag, ...existingTags];
    const moves = rep.moves || getCustomRepertoireMoves(rep);
    return {
      id: rep.id,
      name: rep.name || 'Custom Repertoire',
      eco: rep.eco || 'Custom',
      tags,
      description: rep.description || 'Custom user repertoire',
      moves,
      color: isWhite ? 'white' : 'black',
      isCustom: true,
      pgn: rep.pgn,
      tree: rep.tree,
      createdAt: rep.createdAt,
    };
  });
  return [...formattedCustoms, ...OPENINGS];
}

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

// No BOARD_THEMES_MAP here — all board themes come from boardThemes.js

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

// Lichess piece file naming: K=king, Q=queen, R=rook, B=bishop, N=knight, P=pawn
// Note: knight uses 'N' (kNight), NOT 'K' — role[0] would give 'k'→'K' which is WRONG
const ROLE_LETTER = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };

// Generate CSS for piece set URLs from Lichess CDN
// Uses !important to override the bundled cburnett CSS (Vite bundles it as <style>,
// not <link>, so we can't disable it — we must win with !important specificity).
function generatePieceSetCSS(setKey) {
  if (setKey === 'cburnett') return ''; // clear overrides → bundled cburnett CSS takes effect
  const baseUrl = `https://lichess1.org/assets/piece/${setKey}/`;
  const roles = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
  const colors = ['white', 'black'];
  let css = '';
  for (const color of colors) {
    for (const role of roles) {
      const letter = ROLE_LETTER[role];
      const colorLetter = color[0];
      css += `.cg-wrap piece.${role}.${color} { background-image: url('${baseUrl}${colorLetter}${letter}.svg') !important; background-size: cover !important; }\n`;
    }
  }
  return css;
}

// Preload all SVGs for a piece set so they're cached before we switch CSS.
// Returns a Promise that resolves when all 12 SVGs are loaded (or timed out).
function preloadPieceSetSVGs(setKey) {
  if (setKey === 'cburnett') return Promise.resolve(); // bundled, no preload needed
  const baseUrl = `https://lichess1.org/assets/piece/${setKey}/`;
  const letters = ['K', 'Q', 'R', 'B', 'N', 'P']; // N = knight
  const colors = ['w', 'b'];
  const loads = [];
  for (const color of colors) {
    for (const letter of letters) {
      const url = `${baseUrl}${color}${letter}.svg`;
      loads.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = url;
      }));
    }
  }
  return Promise.all(loads);
}

// Read persisted piece set from localStorage
function getSavedPieceSet() {
  try {
    const saved = localStorage.getItem('choc-piece-set');
    if (saved && PIECE_SETS[saved]) return saved;
  } catch {}
  return 'cburnett';
}

export default function LandingPage({ boardTheme, onBoardThemeChange, onSelectRepertoire }) {
  // playerColor is ONLY for browsing openings in the sidebar (which openings to show).
  const [playerColor, setPlayerColor] = useState(null);
  // engineColor controls who the user plays as vs Stockfish — independent of playerColor.
  const [engineColor, setEngineColor] = useState('w');
  const [selectedOpening, setSelectedOpening] = useState(() => loadAllOpenings()[0]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentBoardTheme, setCurrentBoardTheme] = useState(boardTheme || 'space');
  const [pieceSet, setPieceSetRaw] = useState(getSavedPieceSet);
  const [pieceSetReady, setPieceSetReady] = useState(true); // false while preloading
  const setPieceSet = useCallback((key) => {
    if (key === pieceSet) return;
    setPieceSetReady(false);
    preloadPieceSetSVGs(key).then(() => {
      setPieceSetRaw(key);
      setPieceSetReady(true);
      try { localStorage.setItem('choc-piece-set', key); } catch {}
    });
  }, [pieceSet]);
  const [orientation, setOrientation] = useState('white');

  const pieceStyleRef = useRef(null);

  const allOpenings = useMemo(() => loadAllOpenings(), [editorOpen, playerColor]);

  // Compute positions for current opening
  const positions = useMemo(() => computePositions(selectedOpening.moves), [selectedOpening]);
  const annotations = useMemo(() => buildAnnotations(selectedOpening.moves), [selectedOpening]);

  const filteredOpenings = playerColor
    ? allOpenings.filter(o => o.tags.includes(playerColor === 'w' ? 'White' : 'Black') || (playerColor === 'w' ? o.color === 'white' : o.color === 'black'))
    : [];

  const chooseColor = (c) => {
    const list = loadAllOpenings();
    const first = list.find(o => o.tags.includes(c === 'w' ? 'White' : 'Black') || (c === 'w' ? o.color === 'white' : o.color === 'black')) || list[0];
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

  // Inject piece set CSS synchronously BEFORE paint to avoid flash of wrong pieces.
  // useLayoutEffect fires synchronously after DOM mutation but before the browser paints.
  // When switching to cburnett: clear overrides so bundled CSS takes effect.
  // When switching to other sets: inject !important overrides (wins over bundled cburnett).
  useLayoutEffect(() => {
    let styleEl = pieceStyleRef.current;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'chessground-piece-override';
      document.head.appendChild(styleEl);
      pieceStyleRef.current = styleEl;
    }
    const css = generatePieceSetCSS(pieceSet);
    styleEl.textContent = css;
  }, [pieceSet]);

  // Preload the current piece set SVGs on mount (in case they're not cached)
  useEffect(() => {
    if (pieceSet !== 'cburnett') {
      preloadPieceSetSVGs(pieceSet);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const handleThemeChange = (key) => {
    setCurrentBoardTheme(key);
    onBoardThemeChange(key);
  };

  const handlePractice = (openingOverride) => {
    // The opening to practice (defaults to the currently selected opening).
    // Note: the PRACTICE button must call this with () => to avoid React passing
    // the click event here (openingOverride would then be a SyntheticEvent).
    const target = (openingOverride && openingOverride.id) ? openingOverride : activeOpening;

    // Exact, intentional matches between browse openings and prebuilt repertoires.
    const OPENING_TO_PREBUILT = {
      'sicilian': 'sicilian-dragon',
      'queens-gambit': 'queens-gambit',
      'kings-indian': 'kings-indian',
      'catalan-white': 'catalan-white',
    };
    const mappedId = OPENING_TO_PREBUILT[target.id];
    const matching = mappedId
      ? PREBUILT_REPERTOIRES.find((p) => p.id === mappedId)
      : null;

    if (matching) {
      const repertoires = getRepertoires();
      if (!repertoires.some((r) => r.id === matching.id)) {
        try {
          // NOTE: do NOT persist `tree` — Map objects don't survive JSON serialization.
          addRepertoire({ ...matching, positionCount: 0, isPrebuilt: true, createdAt: Date.now() });
        } catch (e) { console.error(e); }
      }
      // Always rebuild a fresh tree from the PGN.
      try {
        const tree = parsePGNToTree(matching.pgn);
        onSelectRepertoire({ ...matching, tree });
      } catch (e) {
        console.error(e);
        onSelectRepertoire(matching);
      }
      return;
    }

    // No dedicated prebuilt repertoire — build a correctly-named repertoire from
    // the browse opening's own preview moves so the page title matches what the
    // user clicked (e.g. "Ruy López" opens a Ruy López repertoire, not Italian).
    try {
      // Replay the opening moves in order on a single board to get valid SANs.
      const c = new Chess();
      const sans = [];
      for (const m of (target.moves || [])) {
        const r = c.move(m);
        sans.push(r ? r.san : m);
      }
      const pgn = `[Event "${target.name}"]\n\n${sans.map((s, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${s}` : s)).join(' ')} *`;
      const tree = parsePGNToTree(pgn);
      const color = target.tags && target.tags.includes('Black') ? 'black' : 'white';
      const rep = {
        id: `opening-${target.id}`,
        name: target.name,
        color,
        description: target.description || '',
        pgn,
        tree,
        positionCount: countPositions(tree) - 1,
        isPrebuilt: false,
        createdAt: Date.now(),
      };
      onSelectRepertoire(rep);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditorSave = useCallback((rep) => {
    // Persist the newly created repertoire (without tree — Map doesn't survive JSON).
    const toStore = { ...rep, tree: undefined };
    try {
      addRepertoire(toStore);
    } catch (e) { console.error(e); }
    setEditorOpen(false);
    onSelectRepertoire(rep);
  }, [onSelectRepertoire]);

  const themeObj = getBoardTheme(currentBoardTheme);
  const boardBg = getBoardThemeBackground(currentBoardTheme);
  const activeOpening = selectedOpening;

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
      <div className="relative flex flex-col h-screen" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="flex items-center justify-between px-3 md:px-8 py-2.5 md:py-4 border-b" style={{ borderColor: 'rgba(107,140,174,0.12)', background: 'rgba(6,8,16,0.85)' }}>
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
                <span style={{ color: '#8daac4' }}>{allOpenings.length}</span> Repertoires
              </div>
              <div className="h-4 w-px" style={{ background: 'rgba(107,140,174,0.22)' }} />
              <div style={{ color: 'rgba(170,162,148,0.75)', fontSize: '0.8rem', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em' }}>← → Navigate</div>
            </div>
            <button onClick={() => setEditorOpen(true)} title="Create Repertoire" className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg transition-all hover:scale-105 text-xs font-orbitron" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.35)', color: '#ddd8cc', letterSpacing: '0.08em', cursor: 'pointer' }}>＋ CREATE</button>
            <button onClick={() => setSettingsOpen(v => !v)} title="Board Settings" className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: settingsOpen ? 'rgba(107,140,174,0.18)' : 'rgba(107,140,174,0.07)', border: `1px solid ${settingsOpen ? 'rgba(107,140,174,0.35)' : 'rgba(107,140,174,0.14)'}`, color: settingsOpen ? '#8daac4' : '#475569', fontSize: '1rem', cursor: 'pointer' }}>⚙</button>
            <button className="md:hidden flex flex-col gap-1 p-2" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle repertoires">
              {[0,1,2].map(i => <div key={i} className="w-5 h-0.5 rounded" style={{ background: '#8daac4' }} />)}
            </button>
          </div>
        </header>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="border-b px-3 md:px-8 py-3 md:py-4 overflow-x-auto" style={{ background: 'rgba(6,8,16,0.92)', borderColor: 'rgba(107,140,174,0.1)' }}>
            <div className="flex flex-nowrap md:flex-wrap gap-4 md:gap-8 min-w-max md:min-w-0">
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>BOARD</div>
                <div className="flex gap-2 flex-wrap">
                  {getAllBoardThemes().map((t) => {
                    const preview = getBoardThemePreview(t.id);
                    const isActive = currentBoardTheme === t.id;
                    return (
                      <button key={t.id} onClick={() => handleThemeChange(t.id)} className="flex flex-col items-center gap-1.5 transition-all hover:scale-105" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                        <div className="rounded overflow-hidden" style={{ width: 40, height: 40, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', outline: isActive ? `2px solid ${t.accent}` : '2px solid transparent', outlineOffset: 2 }}>
                          {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? preview.light : preview.dark }} />)}
                        </div>
                        <span style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: isActive ? '#fff' : 'rgba(150,142,130,0.5)', letterSpacing: '0.05em' }}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="w-px self-stretch" style={{ background: 'rgba(107,140,174,0.12)' }} />
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>PIECES</div>
                <div className="flex gap-1.5 md:gap-2">
                  {Object.entries(PIECE_SETS).map(([key, s]) => {
                    const previewUrl = `https://lichess1.org/assets/piece/${key}/wK.svg`;
                    const isActive = pieceSet === key;
                    const isSwitching = !pieceSetReady && !isActive;
                    return (
                      <button key={key}
                        onClick={() => setPieceSet(key)}
                        onMouseEnter={() => preloadPieceSetSVGs(key)}
                        className="flex flex-col items-center gap-1 transition-all hover:scale-105"
                        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, opacity: isSwitching ? 0.5 : 1 }}
                      >
                        <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, background: 'rgba(15,20,40,0.8)', outline: isActive ? '2px solid #6b8cae' : '2px solid rgba(107,140,174,0.12)', outlineOffset: 1, fontSize: '1.6rem' }}>
                          <img src={previewUrl} alt={s.label} style={{ width: 26, height: 26, objectFit: 'contain' }} loading="lazy" />
                        </div>
                        <span style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: pieceSet === key ? '#fff' : 'rgba(150,142,130,0.5)', letterSpacing: '0.05em' }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="w-px self-stretch" style={{ background: 'rgba(107,140,174,0.12)' }} />
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#8daac4', fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>ORIENT</div>
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
        {editorOpen ? (
          <RepertoireEditor
            boardTheme={boardTheme}
            onExit={() => setEditorOpen(false)}
            onSave={handleEditorSave}
          />
        ) : (
        <div className="flex flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {/* Center — Play vs Stockfish board */}
          <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 my-auto">
            <PlayVsEngine
              key={engineColor}
              playerColor={engineColor}
              boardTheme={boardBg}
              embedded
              onColorChange={setEngineColor}
            />
          </main>

          {/* Sidebar */}
          <aside className={`fixed md:relative inset-y-0 right-0 md:inset-auto w-[280px] md:w-80 lg:w-96 flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} style={{ background: 'rgba(6,8,16,0.97)', borderLeft: '1px solid rgba(107,140,174,0.12)', zIndex: 50 }}>
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
                    <div style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.65rem', marginTop: 4, textAlign: 'center' }}>{allOpenings.filter(o => o.tags.includes('White') || o.color === 'white').length} openings available</div>
                  </div>
                </button>
                <button onClick={() => chooseColor('b')} className="w-full rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.6))', border: '1px solid rgba(107,140,174,0.22)', boxShadow: '0 0 30px rgba(107,140,174,0.07)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '3rem', lineHeight: 1 }}>♚</span>
                  <div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", color: '#b8b2a8', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', textAlign: 'center' }}>BLACK</div>
                    <div style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.65rem', marginTop: 4, textAlign: 'center' }}>{allOpenings.filter(o => o.tags.includes('Black') || o.color === 'black').length} openings available</div>
                  </div>
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
                    <button key={opening.id} onClick={() => { resetToOpening(opening); setSidebarOpen(false); handlePractice(opening); }} className="w-full text-left rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.01]" style={{ background: active ? 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(100,95,140,0.15))' : 'rgba(15,20,40,0.6)', border: active ? '1px solid rgba(107,140,174,0.35)' : '1px solid rgba(107,140,174,0.08)', boxShadow: active ? '0 0 20px rgba(107,140,174,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
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
        )}

      {/* Mobile sidebar backdrop — inside the zIndex:1 wrapper so it stays BELOW
          the drawer (aside zIndex:50) but ABOVE the board/content. */}
      {sidebarOpen && (
        <div className="fixed inset-0 md:hidden" style={{ background: 'rgba(0,0,0,0.7)', zIndex: 30 }} onClick={() => setSidebarOpen(false)} />
      )}
      </div>

      {/* Footer — License & Credits */}
      <footer className="relative w-full px-3 md:px-8 py-2 md:py-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ zIndex: 1, borderColor: 'rgba(107,140,174,0.08)', background: 'rgba(6,8,16,0.5)' }}>
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
