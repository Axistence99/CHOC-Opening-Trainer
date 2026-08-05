import { useState, useEffect, useCallback } from 'react';
import { getRepertoires, saveRepertoires, getPracticeHistory, getSettings, saveSettings } from './utils/storage';
import { parsePGNToTree, countPositions } from './utils/pgnParser';
import { addRepertoire } from './utils/storage';
import LandingPage from './components/LandingPage';
import PracticeMode from './components/PracticeMode';

const VIEWS = { HOME: 'home', PRACTICE: 'practice' };

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
    setCurrentView(VIEWS.PRACTICE);
  }, []);

  const handleExitPractice = useCallback(() => {
    setSelectedRepertoire(null);
    setCurrentView(VIEWS.HOME);
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
      {currentView === VIEWS.PRACTICE && (
        <PracticeMode
          repertoire={selectedRepertoire}
          onExit={handleExitPractice}
          boardTheme={boardTheme}
          onBoardThemeChange={handleBoardThemeChange}
        />
      )}
    </>
  );
}
