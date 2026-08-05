import { useState, useRef } from 'react';
import { parsePGN, parsePGNToTree, countPositions, getLeafPaths } from '../utils/pgnParser';
import { addRepertoire, getRepertoires, saveRepertoires } from '../utils/storage';
import PREBUILT_REPERTOIRES from '../data/prebuiltRepertoires';
import { getOpeningFromMoves } from '../data/ecoOpenings';

export default function RepertoireManager({ repertoires, onRepertoiresChange, onSelectRepertoire }) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('');
  const [importColor, setImportColor] = useState('white');
  const [error, setError] = useState('');
  const [showPrebuilt, setShowPrebuilt] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportPGN = () => {
    if (!importText.trim()) {
      setError('Please paste a PGN or upload a file.');
      return;
    }
    if (!importName.trim()) {
      setError('Please enter a name for this repertoire.');
      return;
    }

    try {
      const tree = parsePGNToTree(importText);
      const positionCount = countPositions(tree) - 1; // exclude root
      
      if (positionCount === 0) {
        setError('No valid moves found in the PGN. Please check the format.');
        return;
      }

      const newRepertoire = {
        id: `custom-${Date.now()}`,
        name: importName.trim(),
        color: importColor,
        description: `Custom repertoire • ${positionCount} positions`,
        pgn: importText,
        tree,
        positionCount,
        isPrebuilt: false,
        createdAt: Date.now(),
      };

      const updated = addRepertoire(newRepertoire);
      onRepertoiresChange(updated);
      setShowImport(false);
      setImportText('');
      setImportName('');
      setError('');
    } catch (e) {
      setError(`Failed to parse PGN: ${e.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target.result);
      if (!importName) {
        setImportName(file.name.replace(/\.pgn$/i, ''));
      }
    };
    reader.readAsText(file);
  };

  const handleAddPrebuilt = (prebuilt) => {
    // Check if already added
    if (repertoires.some(r => r.id === prebuilt.id)) {
      return;
    }

    try {
      const tree = parsePGNToTree(prebuilt.pgn);
      const positionCount = countPositions(tree) - 1;

      const newRepertoire = {
        ...prebuilt,
        tree,
        positionCount,
        isPrebuilt: true,
        createdAt: Date.now(),
      };

      const updated = addRepertoire(newRepertoire);
      onRepertoiresChange(updated);
    } catch (e) {
      console.error('Failed to load prebuilt repertoire:', e);
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this repertoire? Your practice progress will be kept.')) return;
    const updated = repertoires.filter(r => r.id !== id);
    saveRepertoires(updated);
    onRepertoiresChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">My Repertoires</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrebuilt(!showPrebuilt)}
            className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            📚 Pre-built
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
          >
            📥 Import PGN
          </button>
        </div>
      </div>

      {/* Pre-built Repertoires */}
      {showPrebuilt && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Pre-built Opening Repertoires</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {PREBUILT_REPERTOIRES.map((prebuilt) => {
              const alreadyAdded = repertoires.some(r => r.id === prebuilt.id);
              return (
                <div
                  key={prebuilt.id}
                  className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        prebuilt.color === 'white' ? 'bg-amber-100 text-amber-800' : 'bg-slate-300 text-slate-800'
                      }`}>
                        {prebuilt.color === 'white' ? '♔ White' : '♚ Black'}
                      </span>
                      <span className="text-sm font-medium text-white truncate">{prebuilt.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{prebuilt.description}</p>
                  </div>
                  <button
                    onClick={() => handleAddPrebuilt(prebuilt)}
                    disabled={alreadyAdded}
                    className={`ml-2 px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                      alreadyAdded
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {alreadyAdded ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PGN Import */}
      {showImport && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-violet-700/50">
          <h3 className="text-sm font-semibold text-violet-300 mb-3">Import PGN</h3>
          
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Repertoire Name</label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="e.g., My Sicilian Repertoire"
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg text-sm border border-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Playing As</label>
                <select
                  value={importColor}
                  onChange={(e) => setImportColor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg text-sm border border-slate-600 focus:border-violet-500 focus:outline-none"
                >
                  <option value="white">♔ White</option>
                  <option value="black">♚ Black</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">PGN Text</label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  📁 Upload .pgn file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pgn"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Paste PGN here, e.g.:\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *\n\nOr upload a .pgn file`}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg text-sm border border-slate-600 focus:border-violet-500 focus:outline-none font-mono h-32 resize-y"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowImport(false); setError(''); setImportText(''); setImportName(''); }}
                className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportPGN}
                className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repertoire List */}
      {repertoires.length === 0 ? (
        <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-600">
          <p className="text-slate-400 text-sm">No repertoires yet</p>
          <p className="text-slate-500 text-xs mt-1">Add a pre-built repertoire or import your PGN</p>
        </div>
      ) : (
        <div className="space-y-2">
          {repertoires.map((rep) => (
            <div
              key={rep.id}
              className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              {/* Color indicator */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                rep.color === 'white' ? 'bg-amber-100 text-amber-800' : 'bg-slate-300 text-slate-800'
              }`}>
                {rep.color === 'white' ? '♔' : '♚'}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{rep.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {rep.positionCount || '?'} positions • {rep.color === 'white' ? 'White' : 'Black'}
                  {rep.isPrebuilt && ' • Pre-built'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectRepertoire(rep)}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
                >
                  Practice
                </button>
                <button
                  onClick={() => handleDelete(rep.id)}
                  className="px-3 py-2 text-sm bg-slate-700 hover:bg-red-600/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  title="Delete"
                >
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
