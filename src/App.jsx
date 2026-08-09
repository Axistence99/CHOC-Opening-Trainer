import React, { useState, useEffect, useCallback } from 'react';
import { getRepertoires, saveRepertoires, getPracticeHistory, getSettings, saveSettings } from './utils/storage';
import { parsePGNToTree, countPositions } from './utils/pgnParser';
import { addRepertoire } from './utils/storage';
import LandingPage from './components/LandingPage';
import RepertoirePage from './components/RepertoirePage';

const VIEWS = { HOME: 'home', REPERTOIRE: 'repertoire' };

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: '#080b14', fontFamily: "'Inter', sans-serif", color: '#ddd8cc' }}>
          <div className="max-w-md w-full rounded-2xl p-6 border space-y-4 shadow-2xl" style={{ background: 'rgba(15,20,40,0.8)', borderColor: 'rgba(255,107,107,0.3)' }}>
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold font-orbitron text-red-400" style={{ letterSpacing: '0.08em' }}>
              REPERTOIRE DISPLAY ERROR
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              We encountered an unexpected error while rendering this repertoire.
            </p>
            {this.state.error && (
              <div className="p-3 rounded bg-black/50 border border-red-500/20 text-left overflow-x-auto font-mono text-[10px] text-red-300 max-h-32">
                {String(this.state.error.message || this.state.error)}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              className="w-full py-2.5 px-4 rounded-lg font-orbitron font-semibold text-xs transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgba(107,140,174,0.3), rgba(168,131,74,0.2))', border: '1px solid rgba(107,140,174,0.35)', color: '#ddd8cc', cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              ↺ RETURN TO OPENINGS LIST
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState(VIEWS.HOME);
  const [selectedRepertoire, setSelectedRepertoire] = useState(null);
  const [boardTheme, setBoardTheme] = useState('space');
  const [repertoires, setRepertoires] = useState([]);

  useEffect(() => {
    const saved = getRepertoires();
    setRepertoires(saved);
    const settings = getSettings();
    if (settings.boardTheme) setBoardTheme(settings.boardTheme);
  }, []);

  const handleSelectRepertoire = useCallback((rep) => {
    setSelectedRepertoire(rep);
    setCurrentView(VIEWS.REPERTOIRE);
  }, []);

  const handleExitRepertoire = useCallback(() => {
    setSelectedRepertoire(null);
    setCurrentView(VIEWS.HOME);
    setRepertoires(getRepertoires());
  }, []);

  const handleRepertoireUpdate = useCallback((updatedRep) => {
    setSelectedRepertoire(updatedRep);
    setRepertoires(getRepertoires());
  }, []);

  const handleBoardThemeChange = useCallback((themeId) => {
    setBoardTheme(themeId);
    const settings = getSettings();
    settings.boardTheme = themeId;
    saveSettings(settings);
  }, []);

  return (
    <>
      {currentView === VIEWS.HOME && (
        <LandingPage
          boardTheme={boardTheme}
          onBoardThemeChange={handleBoardThemeChange}
          onSelectRepertoire={handleSelectRepertoire}
        />
      )}
      {currentView === VIEWS.REPERTOIRE && selectedRepertoire && (
        <ErrorBoundary onReset={handleExitRepertoire}>
          <RepertoirePage
            repertoire={selectedRepertoire}
            onExit={handleExitRepertoire}
            boardTheme={boardTheme}
            onBoardThemeChange={handleBoardThemeChange}
            onRepertoireUpdate={handleRepertoireUpdate}
          />
        </ErrorBoundary>
      )}
    </>
  );
}
