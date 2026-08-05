import { useState, useEffect, useCallback } from 'react';
import { getRepertoires, saveRepertoires, getPracticeHistory, getSettings, saveSettings } from './utils/storage';
import { getBoardThemeColors } from './data/boardThemes';
import RepertoireManager from './components/RepertoireManager';
import PracticeMode from './components/PracticeMode';
import BoardThemePicker from './components/BoardThemePicker';

const VIEWS = {
  HOME: 'home',
  PRACTICE: 'practice',
};

export default function App() {
  const [repertoires, setRepertoires] = useState([]);
  const [currentView, setCurrentView] = useState(VIEWS.HOME);
  const [selectedRepertoire, setSelectedRepertoire] = useState(null);
  const [practiceHistory, setPracticeHistory] = useState({});
  const [boardTheme, setBoardTheme] = useState('lichess');
  const [showSettings, setShowSettings] = useState(false);

  // Load settings and repertoires on mount
  useEffect(() => {
    const saved = getRepertoires();
    setRepertoires(saved);
    setPracticeHistory(getPracticeHistory());
    
    const settings = getSettings();
    if (settings.boardTheme) {
      setBoardTheme(settings.boardTheme);
    }
  }, []);

  const handleRepertoiresChange = useCallback((updated) => {
    setRepertoires(updated);
  }, []);

  const handleSelectRepertoire = useCallback((rep) => {
    setSelectedRepertoire(rep);
    setCurrentView(VIEWS.PRACTICE);
  }, []);

  const handleExitPractice = useCallback(() => {
    setSelectedRepertoire(null);
    setCurrentView(VIEWS.HOME);
    // Refresh repertoires and history
    setRepertoires(getRepertoires());
    setPracticeHistory(getPracticeHistory());
  }, []);

  const handleBoardThemeChange = useCallback((themeId) => {
    setBoardTheme(themeId);
    const settings = getSettings();
    settings.boardTheme = themeId;
    saveSettings(settings);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900/50">
      {/* Nav Bar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => { setCurrentView(VIEWS.HOME); setSelectedRepertoire(null); }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">♞</span>
            <div className="text-left">
              <h1 className="text-base font-bold text-white leading-tight">CHOC Opening Trainer</h1>
              <p className="text-[10px] text-slate-400">CHOC Repertoire Practice</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
              <span>{repertoires.length} repertoire{repertoires.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{Object.keys(practiceHistory).length} practiced</span>
            </div>
            {/* Settings gear */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettings ? 'bg-violet-600/30 text-violet-300' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.195.977.844 1.79 1.766 2.16l.542.242c.654.291 1.09 1.017 1.09 1.816v.118c0 .8-.463 1.51-1.09 1.816l-.542.242c-.922.367-1.571 1.18-1.766 2.16l-.213 1.281c-.09.543-.56.94-1.11.94h-2.592c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.196-.977-.844-1.79-1.766-2.16l-.542-.242c-.654-.291-1.09-1.017-1.09-1.816v-.118c0-.8.463-1.51 1.09-1.816l.542-.242c.922-.367 1.571-1.18 1.766-2.16l.213-1.281zM15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Settings Panel (global, shown from nav) */}
      {showSettings && (
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">⚙️ Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                Close
              </button>
            </div>
            <BoardThemePicker currentTheme={boardTheme} onThemeChange={handleBoardThemeChange} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {currentView === VIEWS.HOME && (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-violet-900/30 to-indigo-900/30 rounded-2xl p-6 border border-violet-700/30">
              <h2 className="text-2xl font-bold text-white mb-2">
                Train Your Chess Openings ♟
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed max-w-lg">
                Build your opening repertoire with pre-built lines or import your own PGN. 
                Practice with spaced repetition so you never forget your lines.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <span className="text-emerald-400">✓</span> Pre-built Repertoires
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <span className="text-emerald-400">✓</span> PGN Import
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <span className="text-emerald-400">✓</span> Spaced Repetition
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <span className="text-emerald-400">✓</span> 100% Free & Offline
                </div>
              </div>
            </div>

            {/* Repertoire Manager */}
            <RepertoireManager
              repertoires={repertoires}
              onRepertoiresChange={handleRepertoiresChange}
              onSelectRepertoire={handleSelectRepertoire}
            />

            {/* Quick Start Guide */}
            {repertoires.length === 0 && (
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-dashed border-slate-600">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">🚀 Quick Start</h3>
                <ol className="text-sm text-slate-400 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-violet-400 font-bold">1.</span>
                    <span>Click <strong className="text-slate-300">📚 Pre-built</strong> to add a starter repertoire, or</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 font-bold">2.</span>
                    <span>Click <strong className="text-slate-300">📥 Import PGN</strong> to load your own opening lines</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 font-bold">3.</span>
                    <span>Click <strong className="text-slate-300">Practice</strong> to start drilling your lines!</span>
                  </li>
                </ol>
              </div>
            )}

            {/* Tips */}
            {repertoires.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">💡 Tips</h3>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• Import PGNs from <a href="https://lichess.org/study" target="_blank" rel="noopener" className="text-violet-400 hover:underline">Lichess Studies</a> — export any study as PGN</li>
                  <li>• You can also paste PGN from chess.com, ChessBase, or any chess app</li>
                  <li>• Practice a few minutes daily — spaced repetition works best with consistency</li>
                  <li>• Your data is saved in your browser. Export your PGN anytime for backup.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {currentView === VIEWS.PRACTICE && (
          <PracticeMode
            repertoire={selectedRepertoire}
            onExit={handleExitPractice}
            boardTheme={boardTheme}
            onBoardThemeChange={handleBoardThemeChange}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-4 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-600">
            ♟ CHOC Opening Trainer • Built with React + chess.js + react-chessboard
          </p>
        </div>
      </footer>
    </div>
  );
}
