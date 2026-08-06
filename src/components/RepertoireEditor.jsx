import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { parsePGNToTree, countPositions, treeToPGN } from '../utils/pgnParser';
import { getBoardThemeBackground } from '../data/boardThemes';
import ChessgroundBoard from './ChessgroundBoard';

// Allowed tags for a repertoire (max 4 selected)
export const REPERTOIRE_TAGS = [
  'Tactical', 'Gambit', 'Solid', 'Positional', 'Symmetrical', 'Imbalanced',
  'Aggressive', 'Open', 'Closed', 'Semi Open', 'System', 'Tricky', 'Mainline', 'Sideline',
];
const MAX_TAGS = 4;

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

function makeNode() {
  return {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move: null,
    moveSan: null,
    children: new Map(),
    depth: 0,
  };
}

// Walk the tree along a path of SANs and return the node (or null if not found)
function nodeAt(tree, path) {
  let node = tree;
  for (const san of path) {
    if (!node.children.has(san)) return null;
    node = node.children.get(san);
  }
  return node;
}

// Collect all nodes into a flat array (for rendering a nested move list)
function flattenTree(node, path = [], out = []) {
  for (const [san, child] of node.children.entries()) {
    const np = [...path, san];
    out.push({ san, node: child, path: np, isVariation: path.length > 0 ? child.depth > 0 && path.length > 0 : false });
    flattenTree(child, np, out);
  }
  return out;
}

function sanWithNum(san, depth) {
  // depth is 1-indexed move number (each ply = +1)
  const moveNum = Math.floor((depth - 1) / 2) + 1;
  return depth % 2 === 1 ? `${moveNum}. ${san}` : `${moveNum}... ${san}`;
}

export default function RepertoireEditor({ boardTheme, onExit, onSave }) {
  const [tree, setTree] = useState(() => {
    const t = makeNode();
    return t;
  });
  const [path, setPath] = useState([]);       // current node path (array of SANs)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('white');
  const [tags, setTags] = useState([]);
  const [orientation, setOrientation] = useState('white');
  const [pgnText, setPgnText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const fileRef = useRef(null);

  const current = nodeAt(tree, path) || tree;
  const fen = current.fen;
  const dests = useMemo(() => computeDests(fen), [fen]);
  const turnColor = fen.includes(' w ') ? 'white' : 'black';

  // Rebuild tree from PGN text (import)
  const handleImportPGN = () => {
    if (!pgnText.trim()) { setImportMsg('⚠ Paste a PGN first.'); return; }
    try {
      const t = parsePGNToTree(pgnText);
      if (countPositions(t) <= 1) { setImportMsg('⚠ No valid moves found in the PGN.'); return; }
      setTree(t);
      setPath([]);
      setImportMsg(`✓ Imported ${countPositions(t) - 1} move(s). You can edit them on the board.`);
    } catch (e) {
      setImportMsg(`⚠ Failed to parse PGN: ${e.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPgnText(ev.target.result);
      setImportMsg('File loaded. Click "Import PGN" to build the repertoire.');
      if (!name) setName(file.name.replace(/\.pgn$/i, ''));
    };
    reader.readAsText(file);
  };

  const handleStartFresh = () => {
    setTree(makeNode());
    setPath([]);
    setPgnText('');
    setImportMsg('');
  };

  // Play a move on the board (add a child to the current node and navigate to it)
  const handlePlay = useCallback((orig, dest) => {
    setTree((prevTree) => {
      const node = nodeAt(prevTree, path);
      if (!node) return prevTree;
      const chess = new Chess(node.fen);
      const mv = chess.move({ from: orig, to: dest, promotion: 'q' });
      if (!mv) return prevTree;
      const san = mv.san;
      if (!node.children.has(san)) {
        node.children.set(san, {
          fen: chess.fen(),
          move: mv,
          moveSan: san,
          children: new Map(),
          depth: node.depth + 1,
        });
      }
      // navigate to it (side effect; tree is mutated in place, return a copy to re-render)
      setPath((p) => [...p, san]);
      return { ...prevTree };
    });
  }, [path]);

  // Navigate to a specific node
  const goTo = useCallback((targetPath) => {
    const node = nodeAt(tree, targetPath);
    if (node) setPath(targetPath);
  }, [tree]);

  // Delete the move at the current node (removes subtree), then move to parent
  const handleDeleteCurrent = () => {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const parent = nodeAt(tree, parentPath);
    if (!parent) return;
    parent.children.delete(path[path.length - 1]);
    setPath(parentPath);
    setTree({ ...tree }); // trigger re-render
  };

  const movesList = useMemo(() => flattenTree(tree), [tree]);
  const positionCount = countPositions(tree) - 1;

  const toggleTag = (t) => {
    setTags((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= MAX_TAGS) { setSaveMsg(`⚠ Max ${MAX_TAGS} tags allowed.`); setTimeout(()=>setSaveMsg(''),1800); return prev; }
      return [...prev, t];
    });
  };

  const handleSave = () => {
    if (!name.trim()) { setSaveMsg('⚠ Please enter a repertoire name.'); return; }
    if (positionCount === 0) { setSaveMsg('⚠ Add at least one move before saving.'); return; }
    const pgn = treeToPGN(tree, name.trim());
    const rep = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      color,
      description: description.trim() || `${name.trim()} · ${positionCount} moves`,
      tags: [...tags],
      pgn,
      tree,
      positionCount,
      isPrebuilt: false,
      createdAt: Date.now(),
    };
    onSave(rep);
  };

  const boardBg = getBoardThemeBackground(boardTheme);
  const boardSize = 'min(calc(100vw - 40px), 560px)';

  const cgConfig = useMemo(() => ({
    fen,
    orientation,
    turnColor,
    coordinates: true,
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 150 },
    movable: {
      free: false,
      dests,
      showDests: true,
      color: 'both',
      events: { after: handlePlay },
    },
    draggable: { enabled: true, showGhost: true },
    selectable: { enabled: true },
    drawable: { enabled: false, visible: true },
  }), [fen, orientation, turnColor, dests, handlePlay]);

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Editor main area */}
      <div className="flex-1 md:min-h-0 flex flex-col items-center justify-start md:justify-center p-2 md:p-6 gap-3">
        {/* Board */}
        <div className="relative rounded-lg overflow-hidden p-1.5 md:p-3" style={{ background: 'rgba(10,13,24,0.95)', border: '1px solid rgba(110,125,148,0.16)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
          <div style={{ width: boardSize }}>
            <ChessgroundBoard config={cgConfig} boardTheme={boardBg} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 w-full max-w-sm">
          <button onClick={handleStartFresh} className="px-3 py-1.5 text-[11px] rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.08)', border: '1px solid rgba(107,140,174,0.18)', color: '#8daac4', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>＋ New</button>
          <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="px-3 py-1.5 text-[11px] rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(107,140,174,0.08)', border: '1px solid rgba(107,140,174,0.18)', color: '#8daac4', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>⟳ Flip</button>
          <button onClick={handleDeleteCurrent} disabled={path.length === 0} className="px-3 py-1.5 text-[11px] rounded-lg transition-all hover:scale-105 disabled:opacity-30" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff8a8a', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.06em', cursor: path.length===0?'not-allowed':'pointer' }}>🗑 Delete Move</button>
        </div>

        <div className="text-[11px] text-center" style={{ color: 'rgba(160,152,138,0.5)' }}>
          Click/play moves on the board to build your repertoire. Step back in the move list and play a different move to add a variation.
        </div>
      </div>

      {/* Editor side panel */}
      <aside className="w-full md:w-80 lg:w-96 flex flex-col md:border-l border-t md:border-t-0 md:overflow-y-auto" style={{ background: 'rgba(6,8,16,0.97)', borderLeftColor: 'rgba(107,140,174,0.12)', borderTopColor: 'rgba(107,140,174,0.12)' }}>
        <div className="flex-1 p-4 space-y-4">

          {/* Name + description */}
          <div className="space-y-2">
            <div>
              <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>REPERTOIRE NAME *</label>
              <input type="text" value={name} onChange={(e)=>setName(e.target.value)} placeholder="My Sicilian Repertoire" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
            </div>
            <div>
              <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>DESCRIPTION</label>
              <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={2} placeholder="Optional description" className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }} />
            </div>
            <div>
              <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>PLAYING AS</label>
              <div className="flex gap-2">
                <button onClick={()=>setColor('white')} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-orbitron" style={{ background: color==='white'?'rgba(248,250,252,0.2)':'rgba(15,20,40,0.6)', border:`1px solid ${color==='white'?'rgba(248,250,252,0.4)':'rgba(107,140,174,0.15)'}`, color: color==='white'?'#fff':'#cbd5e1', cursor:'pointer' }}>♔ White</button>
                <button onClick={()=>setColor('black')} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-orbitron" style={{ background: color==='black'?'rgba(107,140,174,0.3)':'rgba(15,20,40,0.6)', border:`1px solid ${color==='black'?'rgba(107,140,174,0.5)':'rgba(107,140,174,0.15)'}`, color: color==='black'?'#fff':'#cbd5e1', cursor:'pointer' }}>♚ Black</button>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <h3 className="font-orbitron font-semibold text-[10px] mb-2" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>TAGS ({tags.length}/{MAX_TAGS})</h3>
            <div className="flex flex-wrap gap-1.5">
              {REPERTOIRE_TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} onClick={()=>toggleTag(t)} className="px-2 py-1 rounded text-[10px] transition-all hover:scale-105" style={{ background: on?'rgba(107,140,174,0.25)':'rgba(15,20,40,0.6)', border:`1px solid ${on?'rgba(107,140,174,0.5)':'rgba(107,140,174,0.12)'}`, color: on?'#8daac4':'rgba(160,152,138,0.5)', cursor:'pointer' }}>{t}</button>
                );
              })}
            </div>
          </div>

          {/* PGN import */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(168,131,74,0.06)', border: '1px solid rgba(168,131,74,0.18)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: '#a8834a', letterSpacing: '0.1em' }}>IMPORT PGN</h3>
              <button onClick={()=>fileRef.current?.click()} className="text-[10px]" style={{ color:'#6b8cae' }}>📁 Upload .pgn</button>
              <input ref={fileRef} type="file" accept=".pgn" onChange={handleFileUpload} className="hidden" />
            </div>
            <textarea value={pgnText} onChange={(e)=>setPgnText(e.target.value)} placeholder="Paste PGN here..." className="w-full px-3 py-2 rounded-lg text-sm font-mono h-24 resize-y" style={{ background:'rgba(15,20,40,0.6)', border:'1px solid rgba(107,140,174,0.15)', color:'#cbd5e1', outline:'none' }} />
            <button onClick={handleImportPGN} className="w-full mt-2 px-3 py-2 text-xs rounded-lg font-orbitron font-semibold" style={{ letterSpacing:'0.08em', background:'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border:'1px solid rgba(107,140,174,0.3)', color:'#ddd8cc', cursor:'pointer' }}>Import PGN</button>
            {importMsg && <p className="text-[10px] mt-1.5" style={{ color: importMsg.includes('✓') ? '#4ade80' : '#ff8a8a' }}>{importMsg}</p>}
          </div>

          {/* Move list */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>MOVES ({positionCount})</h3>
              {path.length > 0 && <span className="text-[10px]" style={{ color:'#8daac4' }}>{path.length} ply deep</span>}
            </div>
            {movesList.length === 0 ? (
              <p className="text-xs italic" style={{ color:'rgba(160,152,138,0.3)' }}>No moves yet. Play on the board or import a PGN.</p>
            ) : (
              <div className="flex flex-col gap-0.5 font-mono text-xs">
                {movesList.map((m) => {
                  const isOnPath = path.length >= m.path.length && path.slice(0, m.path.length).join(' ') === m.path.join(' ');
                  const isCurrent = m.path.join(' ') === path.join(' ');
                  return (
                    <button key={m.path.join(' ')} onClick={()=>goTo(m.path)} className="text-left px-2 py-1 rounded transition-colors hover:bg-[rgba(107,140,174,0.12)]" style={{
                      color: isCurrent ? '#fff' : isOnPath ? '#8daac4' : 'rgba(160,152,138,0.5)',
                      fontWeight: isCurrent ? 700 : 400,
                      background: isCurrent ? 'rgba(107,140,174,0.18)' : 'transparent',
                      paddingLeft: `${10 + (m.path.length - 1) * 12}px`,
                    }}>
                      {m.san}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex gap-2">
            <button onClick={onExit} className="flex-1 px-3 py-2 text-xs rounded-lg" style={{ background:'rgba(107,140,174,0.06)', border:'1px solid rgba(107,140,174,0.12)', color:'rgba(160,152,138,0.6)', cursor:'pointer' }}>Cancel</button>
            <button onClick={handleSave} className="flex-[2] px-3 py-2 text-xs rounded-lg font-orbitron font-semibold transition-all hover:scale-105" style={{ letterSpacing:'0.08em', background:'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border:'1px solid rgba(107,140,174,0.3)', color:'#ddd8cc', cursor:'pointer' }}>💾 Save Repertoire</button>
          </div>
          {saveMsg && <p className="text-[10px] text-center" style={{ color: saveMsg.includes('✓') ? '#4ade80' : '#ff8a8a' }}>{saveMsg}</p>}
        </div>
      </aside>
    </div>
  );
}
