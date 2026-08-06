// Board color theme definitions
// Core themes: DeepBoard (custom) + Lichess (classic green)
// Additional themes: Free board images from Lichess (AGPL-3.0)
// Source: https://github.com/lichess-org/lila/blob/master/modules/pref/src/main/Theme.scala
// Images: https://lichess1.org/assets/images/board/

const LICHESS_BOARD_CDN = 'https://lichess1.org/assets/images/board/';

const BOARD_THEMES = {
  // ─── Core themes (SVG-generated, self-contained) ───
  space: {
    id: 'space',
    name: 'DeepBoard',
    description: 'Deep blue space board',
    type: 'colors',
    light: '#c8d9e8',
    dark: '#2d4a6e',
    accent: '#6b8cae',
  },
  lichess: {
    id: 'lichess',
    name: 'Lichess',
    description: 'Classic Lichess green',
    type: 'colors',
    light: '#edeed1',
    dark: '#779952',
    accent: '#779952',
  },

  // ─── Free Lichess board themes (AGPL-3.0) ───
  // These use board images served from the Lichess CDN.
  // preview colors are approximate for thumbnail rendering.
  brown: {
    id: 'brown',
    name: 'Brown',
    description: 'Classic brown board — Lichess default',
    type: 'image',
    imageFile: 'brown.png',
    accent: '#b58863',
    preview: { light: '#f0d9b5', dark: '#b58863' },
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    description: 'Cool blue board',
    type: 'image',
    imageFile: 'blue.png',
    accent: '#8ca2ad',
    preview: { light: '#dee3e6', dark: '#8ca2ad' },
  },
  blue2: {
    id: 'blue2',
    name: 'Blue 2',
    description: 'Blue marble board',
    type: 'image',
    imageFile: 'blue2.jpg',
    accent: '#7a9ab0',
    preview: { light: '#d4e4f0', dark: '#5a7a90' },
  },
  blue3: {
    id: 'blue3',
    name: 'Blue 3',
    description: 'Deep blue board',
    type: 'image',
    imageFile: 'blue3.jpg',
    accent: '#4a6a80',
    preview: { light: '#c0d0e0', dark: '#3a5a70' },
  },
  grey: {
    id: 'grey',
    name: 'Grey',
    description: 'Grey textured board',
    type: 'image',
    imageFile: 'grey.jpg',
    accent: '#7a7a7a',
    preview: { light: '#c8c8c8', dark: '#6e6e6e' },
  },
  marble: {
    id: 'marble',
    name: 'Marble',
    description: 'Marble textured board',
    type: 'image',
    imageFile: 'marble.jpg',
    accent: '#b58863',
    preview: { light: '#e8d5b5', dark: '#b58863' },
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    description: 'Purple board',
    type: 'image',
    imageFile: 'purple.png',
    accent: '#8b5e8b',
    preview: { light: '#e8d5e8', dark: '#8b5e8b' },
  },
  purpleDiag: {
    id: 'purpleDiag',
    name: 'Purple Diag',
    description: 'Purple diagonal board',
    type: 'image',
    imageFile: 'purple-diag.png',
    accent: '#9b4e9b',
    preview: { light: '#e0c8e0', dark: '#7b3e7b' },
  },
  newspaper: {
    id: 'newspaper',
    name: 'Newspaper',
    description: 'Black & white board',
    type: 'image',
    imageFile: 'svg/newspaper.svg',
    accent: '#555555',
    preview: { light: '#ffffff', dark: '#1a1a1a' },
  },
  maple: {
    id: 'maple',
    name: 'Maple',
    description: 'Maple wood board',
    type: 'image',
    imageFile: 'maple.jpg',
    accent: '#a06830',
    preview: { light: '#e8c98e', dark: '#a06830' },
  },
  wood4: {
    id: 'wood4',
    name: 'Wood',
    description: 'Wood textured board',
    type: 'image',
    imageFile: 'wood4.jpg',
    accent: '#9b7040',
    preview: { light: '#deb873', dark: '#8b5a2b' },
  },
  olive: {
    id: 'olive',
    name: 'Olive',
    description: 'Olive board',
    type: 'image',
    imageFile: 'olive.jpg',
    accent: '#6b6b3c',
    preview: { light: '#b8b878', dark: '#6b6b3c' },
  },
  metal: {
    id: 'metal',
    name: 'Metal',
    description: 'Metallic board',
    type: 'image',
    imageFile: 'metal.jpg',
    accent: '#707070',
    preview: { light: '#d0d0d0', dark: '#606060' },
  },
  ic: {
    id: 'ic',
    name: 'ICC',
    description: 'ICC marble board',
    type: 'image',
    imageFile: 'ic.png',
    accent: '#b08050',
    preview: { light: '#f0d9b5', dark: '#b58863' },
  },
  horsey: {
    id: 'horsey',
    name: 'Horsey',
    description: 'Fun horsey board',
    type: 'image',
    imageFile: 'horsey.jpg',
    accent: '#8b6e4e',
    preview: { light: '#d8c4a0', dark: '#7a5e3e' },
  },
  greenPlastic: {
    id: 'greenPlastic',
    name: 'Green Plastic',
    description: 'Green plastic board',
    type: 'image',
    imageFile: 'green-plastic.png',
    accent: '#5a8a3a',
    preview: { light: '#d0e8c0', dark: '#5a8a3a' },
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    description: 'Pink pyramid board',
    type: 'image',
    imageFile: 'pink-pyramid.png',
    accent: '#c06080',
    preview: { light: '#f0c0d0', dark: '#c06080' },
  },
  canvas: {
    id: 'canvas',
    name: 'Canvas',
    description: 'Canvas textured board',
    type: 'image',
    imageFile: 'canvas2.jpg',
    accent: '#8b7355',
    preview: { light: '#d8c8a8', dark: '#8b7355' },
  },
  leather: {
    id: 'leather',
    name: 'Leather',
    description: 'Leather textured board',
    type: 'image',
    imageFile: 'leather.jpg',
    accent: '#6b4e30',
    preview: { light: '#c8a878', dark: '#6b4e30' },
  },
  blueMarble: {
    id: 'blueMarble',
    name: 'Blue Marble',
    description: 'Blue marble textured board',
    type: 'image',
    imageFile: 'blue-marble.jpg',
    accent: '#4a6a8a',
    preview: { light: '#b8d0e0', dark: '#4a6a8a' },
  },
};

/**
 * Get a board theme by ID. Defaults to DeepBoard.
 */
export function getBoardTheme(themeId) {
  return BOARD_THEMES[themeId] || BOARD_THEMES.space;
}

/**
 * Get the board background props for ChessgroundBoard.
 * Returns { light, dark } for SVG-generated themes,
 * or { image: url } for CDN image themes.
 */
export function getBoardThemeBackground(themeId) {
  const theme = getBoardTheme(themeId);
  if (theme.type === 'image') {
    return { image: `${LICHESS_BOARD_CDN}${theme.imageFile}` };
  }
  return { light: theme.light, dark: theme.dark };
}

/**
 * Get preview colors for thumbnail rendering.
 */
export function getBoardThemePreview(themeId) {
  const theme = getBoardTheme(themeId);
  if (theme.type === 'image' && theme.preview) {
    return theme.preview;
  }
  return { light: theme.light, dark: theme.dark };
}

/**
 * Get all board themes as an array.
 */
export function getAllBoardThemes() {
  return Object.values(BOARD_THEMES);
}

export default BOARD_THEMES;
