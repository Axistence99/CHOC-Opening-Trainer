// Board color theme definitions
// Each theme has a name, id, and colors for light/dark squares
// All themes are original or inspired by open-source designs (Lichess AGPL)

const BOARD_THEMES = {
  lichess: {
    id: 'lichess',
    name: 'Lichess',
    description: 'Classic Lichess green board',
    lightSquare: '#edeed1',
    darkSquare: '#779952',
    preview: { light: '#edeed1', dark: '#779952' },
  },
  greyblack: {
    id: 'greyblack',
    name: 'Grey & Black',
    description: 'Dark minimal theme',
    lightSquare: '#a8a8a8',
    darkSquare: '#4a4a4a',
    preview: { light: '#a8a8a8', dark: '#4a4a4a' },
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    description: 'Cool blue tones',
    lightSquare: '#dee3e6',
    darkSquare: '#8ca2ad',
    preview: { light: '#dee3e6', dark: '#8ca2ad' },
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    description: 'Warm wood tones',
    lightSquare: '#e8c98e',
    darkSquare: '#a06830',
    preview: { light: '#e8c98e', dark: '#a06830' },
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    description: 'Rich emerald green',
    lightSquare: '#d4e8d0',
    darkSquare: '#5d8a5c',
    preview: { light: '#d4e8d0', dark: '#5d8a5c' },
  },
  icc: {
    id: 'icc',
    name: 'Marble',
    description: 'Classic marble board',
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    preview: { light: '#f0d9b5', dark: '#b58863' },
  },
};

export function getBoardTheme(themeId) {
  return BOARD_THEMES[themeId] || BOARD_THEMES.lichess;
}

export function getBoardThemeColors(themeId) {
  const theme = getBoardTheme(themeId);
  return {
    customLightSquareStyle: { backgroundColor: theme.lightSquare },
    customDarkSquareStyle: { backgroundColor: theme.darkSquare },
  };
}

export function getAllBoardThemes() {
  return Object.values(BOARD_THEMES);
}

export default BOARD_THEMES;
