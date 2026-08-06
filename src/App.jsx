import { useState, useEffect, useCallback } from 'react';
import { getRepertoires, saveRepertoires, getPracticeHistory, getSettings, saveSettings } from './utils/storage';
import { parsePGNToTree, countPositions } from './utils/pgnParser';
import { addRepertoire } from './utils/storage';
import LandingPage from './components/LandingPage';
import RepertoirePage from './components/RepertoirePage';

const VIEWS = { HOME: 'home', REPERTOIRE: 'repertoire' };

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
        <RepertoirePage
          repertoire={selectedRepertoire}
          onExit={handleExitRepertoire}
          boardTheme={boardTheme}
          onBoardThemeChange={handleBoardThemeChange}
          onRepertoireUpdate={handleRepertoireUpdate}
        />
      )}
    </>
  );
}
