import { useState, useRef } from 'react';
import { parsePGNToTree, countPositions } from '../utils/pgnParser';
import { addRepertoire, getRepertoires, saveRepertoires } from '../utils/storage';
import PREBUILT_REPERTOIRES from '../data/prebuiltRepertoires';

export default function RepertoireManager({ repertoires, onRepertoiresChange, onSelectRepertoire }) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('');
  const [importColor, setImportColor] = useState('white');
  const [error, setError] = useState('');
  const [showPrebuilt, setShowPrebuilt] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportPGN = () => {
    if (!importText.trim()) { setError('Please paste a PGN or upload a file.'); return; }
    if (!importName.trim()) { setError('Please enter a name for this repertoire.'); return; }
    try {
      const tree = parsePGNToTree(importText);
      const positionCount = countPositions(tree) - 1;
      if (positionCount === 0) { setError('No valid moves found in the PGN.'); return; }
      const newRepertoire = {
        id: `custom-${Date.now()}`, name: importName.trim(), color: importColor,
        description: `Custom repertoire • ${positionCount} positions`,
        pgn: importText, tree, positionCount, isPrebuilt: false, createdAt: Date.now(),
      };
      const updated = addRepertoire(newRepertoire);
      onRepertoiresChange(updated);
      setShowImport(false); setImportText(''); setImportName(''); setError('');
    } catch (e) { setError(`Failed to parse PGN: ${e.message}`); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setImportText(event.target.result); if (!importName) setImportName(file.name.replace(/\.pgn$/i, '')); };
    reader.readAsText(file);
  };

  const handleAddPrebuilt = (prebuilt) => {
    if (repertoires.some(r => r.id === prebuilt.id)) return;
    try {
      const tree = parsePGNToTree(prebuilt.pgn);
      const positionCount = countPositions(tree) - 1;
      const newRepertoire = { ...prebuilt, tree, positionCount, isPrebuilt: true, createdAt: Date.now() };
      const updated = addRepertoire(newRepertoire);
      onRepertoiresChange(updated);
    } catch (e) { console.error('Failed to load prebuilt repertoire:', e); }
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this repertoire?')) return;
    const updated = repertoires.filter(r => r.id !== id);
    saveRepertoires(updated);
    onRepertoiresChange(updated);
  };

  const cardStyle = (isSelected = false) => ({
    background: isSelected ? 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(100,95,140,0.15))' : 'rgba(15,20,40,0.6)',
    border: isSelected ? '1px solid rgba(107,140,174,0.35)' : '1px solid rgba(107,140,174,0.08)',
    boxShadow: isSelected ? '0 0 20px rgba(107,140,174,0.12)' : 'none',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron font-bold text-xs" style={{ color: '#ddd8cc', letterSpacing: '0.15em' }}>REPERTOIRES</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowPrebuilt(!showPrebuilt)} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(107,140,174,0.1)', border: '1px solid rgba(107,140,174,0.2)', color: '#8daac4' }}>
            📚 Pre-built
          </button>
          <button onClick={() => setShowImport(!showImport)} className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.2), rgba(168,131,74,0.15))', border: '1px solid rgba(107,140,174,0.25)', color: '#ddd8cc' }}>
            📥 Import PGN
          </button>
        </div>
      </div>

      {showPrebuilt && (
        <div className="rounded-xl p-4 slide-in-right" style={{ background: 'rgba(6,8,16,0.92)', border: '1px solid rgba(107,140,174,0.12)', backdropFilter: 'blur(20px)' }}>
          <h3 className="font-orbitron font-semibold text-[10px] mb-3" style={{ color: '#8daac4', letterSpacing: '0.12em' }}>PRE-BUILT OPENINGS</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {PREBUILT_REPERTOIRES.map((prebuilt) => {
              const alreadyAdded = repertoires.some(r => r.id === prebuilt.id);
              return (
                <button key={prebuilt.id} onClick={() => handleAddPrebuilt(prebuilt)} disabled={alreadyAdded}
                  className="text-left rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.01]"
                  style={cardStyle(alreadyAdded)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-orbitron text-[10px] font-semibold" style={{ color: alreadyAdded ? '#a8834a' : 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>
                      {prebuilt.color === 'white' ? '♔ WHITE' : '♚ BLACK'}
                    </span>
                    {alreadyAdded && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6b8cae' }} />}
                  </div>
                  <div style={{ color: alreadyAdded ? '#fff' : '#cbd5e1', fontWeight: 600, fontSize: '0.85rem' }}>{prebuilt.name}</div>
                  <p style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.7rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{prebuilt.description}</p>
                  <div className="mt-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: alreadyAdded ? 'rgba(107,140,174,0.15)' : 'rgba(107,140,174,0.06)', border: `1px solid rgba(107,140,174,${alreadyAdded ? '0.2' : '0.1'})`, color: alreadyAdded ? '#8daac4' : 'rgba(160,152,138,0.6)' }}>
                      {alreadyAdded ? '✓ Added' : '+ Add'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showImport && (
        <div className="rounded-xl p-4 slide-in-right" style={{ background: 'rgba(6,8,16,0.92)', border: '1px solid rgba(168,131,74,0.2)', backdropFilter: 'blur(20px)' }}>
          <h3 className="font-orbitron font-semibold text-[10px] mb-3" style={{ color: '#a8834a', letterSpacing: '0.12em' }}>IMPORT PGN</h3>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>NAME</label>
                <input type="text" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="My Sicilian Repertoire"
                  className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }}
                />
              </div>
              <div>
                <label className="text-[10px] mb-1 block font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>PLAYING AS</label>
                <select value={importColor} onChange={(e) => setImportColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1' }}
                >
                  <option value="white">♔ White</option>
                  <option value="black">♚ Black</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-orbitron" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.08em' }}>PGN TEXT</label>
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px]" style={{ color: '#6b8cae' }}>📁 Upload .pgn</button>
                <input ref={fileInputRef} type="file" accept=".pgn" onChange={handleFileUpload} className="hidden" />
              </div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste PGN here..."
                className="w-full px-3 py-2 rounded-lg text-sm font-mono h-32 resize-y" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(107,140,174,0.15)', color: '#cbd5e1', outline: 'none' }}
              />
            </div>
            {error && <p className="text-xs" style={{ color: '#ff6b6b' }}>{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowImport(false); setError(''); setImportText(''); setImportName(''); }}
                className="px-4 py-2 text-xs rounded-lg" style={{ background: 'rgba(107,140,174,0.06)', border: '1px solid rgba(107,140,174,0.12)', color: 'rgba(160,152,138,0.6)' }}>
                Cancel
              </button>
              <button onClick={handleImportPGN}
                className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc' }}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {repertoires.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ border: '1px dashed rgba(107,140,174,0.15)', background: 'rgba(15,20,40,0.3)' }}>
          <p style={{ color: 'rgba(160,152,138,0.4)' }} className="text-sm">No repertoires yet</p>
          <p style={{ color: 'rgba(160,152,138,0.3)' }} className="text-xs mt-1">Add a pre-built repertoire or import your PGN</p>
        </div>
      ) : (
        <div className="space-y-2">
          {repertoires.map((rep) => (
            <div key={rep.id} className="flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.01]" style={cardStyle()}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{
                background: rep.color === 'white' ? 'linear-gradient(135deg, rgba(248,250,252,0.12), rgba(203,213,225,0.06))' : 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.6))',
                border: rep.color === 'white' ? '1px solid rgba(248,250,252,0.2)' : '1px solid rgba(107,140,174,0.15)',
              }}>
                {rep.color === 'white' ? '♔' : '♚'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-orbitron text-[10px] font-semibold" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>
                    {rep.color === 'white' ? 'WHITE' : 'BLACK'}
                  </span>
                  {rep.isPrebuilt && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6b8cae' }} />}
                </div>
                <div style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.85rem' }}>{rep.name}</div>
                <p style={{ color: 'rgba(160,152,138,0.6)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                  {rep.positionCount || '?'} moves
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onSelectRepertoire(rep)}
                  className="px-4 py-2 text-xs rounded-lg transition-all hover:scale-105 active:scale-95 font-orbitron font-semibold" style={{ letterSpacing: '0.08em', background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.3)', color: '#ddd8cc' }}>
                  PRACTICE
                </button>
                <button onClick={() => handleDelete(rep.id)}
                  className="px-2 py-2 text-xs rounded-lg transition-all" style={{ background: 'rgba(107,140,174,0.04)', border: '1px solid rgba(107,140,174,0.08)', color: 'rgba(160,152,138,0.3)' }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
