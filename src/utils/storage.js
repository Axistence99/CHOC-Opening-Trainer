// Local storage utilities for persisting repertoire data and progress
// Uses FSRS (Free Spaced Repetition Scheduler) — the same algorithm as Anki 23.10+

import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

const STORAGE_KEYS = {
  REPERTOIRES: 'chess-trainer-repertoires',
  PRACTICE_HISTORY: 'chess-trainer-practice-history',
  SETTINGS: 'chess-trainer-settings',
};

// Create FSRS instance with default parameters
const f = fsrs();

/**
 * Get all saved repertoires from localStorage
 */
export function getRepertoires() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPERTOIRES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save repertoires to localStorage
 */
export function saveRepertoires(repertoires) {
  localStorage.setItem(STORAGE_KEYS.REPERTOIRES, JSON.stringify(repertoires));
}

/**
 * Add a single repertoire
 */
export function addRepertoire(repertoire) {
  const repertoires = getRepertoires();
  repertoires.push(repertoire);
  saveRepertoires(repertoires);
  return repertoires;
}

/**
 * Update a repertoire by id
 */
export function updateRepertoire(id, updates) {
  const repertoires = getRepertoires();
  const index = repertoires.findIndex(r => r.id === id);
  if (index !== -1) {
    repertoires[index] = { ...repertoires[index], ...updates };
    saveRepertoires(repertoires);
  }
  return repertoires;
}

/**
 * Delete a repertoire by id
 */
export function deleteRepertoire(id) {
  const repertoires = getRepertoires().filter(r => r.id !== id);
  saveRepertoires(repertoires);
  return repertoires;
}

/**
 * Get practice history (FSRS card data)
 * Format: { [positionKey]: { card: FSRSCard, schedulingLog: [...] } }
 */
export function getPracticeHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRACTICE_HISTORY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save practice history
 */
export function savePracticeHistory(history) {
  localStorage.setItem(STORAGE_KEYS.PRACTICE_HISTORY, JSON.stringify(history));
}

/**
 * Get or create an FSRS card for a position
 * @param {string} positionKey - FEN-based key for the position
 * @returns {object} FSRS card
 */
export function getOrCreateCard(positionKey) {
  const history = getPracticeHistory();
  if (history[positionKey] && history[positionKey].card) {
    return history[positionKey].card;
  }
  // Create a new empty FSRS card
  const card = createEmptyCard();
  return card;
}

/**
 * Update a single position's practice data using FSRS algorithm
 * @param {string} positionKey - FEN-based key for the position
 * @param {number} rating - FSRS Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
 * @returns {object} Updated history
 */
export function updatePracticeEntry(positionKey, rating) {
  const history = getPracticeHistory();
  const card = (history[positionKey] && history[positionKey].card) || createEmptyCard();
  const now = new Date();

  // FSRS scheduling
  const scheduling = f.repeat(card, now);
  const grade = rating; // Rating.Again=1, Rating.Hard=2, Rating.Good=3, Rating.Easy=4

  // Get the next card state for this rating
  const nextCard = scheduling[grade].card;

  history[positionKey] = {
    card: nextCard,
    lastRating: grade,
    lastPracticed: now.getTime(),
    nextReview: nextCard.due ? new Date(nextCard.due).getTime() : now.getTime(),
  };

  savePracticeHistory(history);
  return history;
}

/**
 * Get positions that are due for review
 * @returns {Array} Due positions sorted by due date
 */
export function getDuePositions() {
  const history = getPracticeHistory();
  const now = Date.now();
  return Object.entries(history)
    .filter(([_, entry]) => entry.nextReview <= now)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.nextReview - b.nextReview); // earliest due first
}

/**
 * Get all position cards (for stats)
 */
export function getAllPracticeCards() {
  const history = getPracticeHistory();
  return Object.entries(history).map(([key, entry]) => ({
    key,
    ...entry,
    isDue: entry.nextReview <= Date.now(),
  }));
}

/**
 * Get retention stats
 * @returns {object} { total, due, learned, newCards }
 */
export function getRetentionStats() {
  const history = getPracticeHistory();
  const now = Date.now();
  const entries = Object.values(history);
  return {
    total: entries.length,
    due: entries.filter(e => e.nextReview <= now).length,
    learned: entries.filter(e => e.card && e.card.state >= 2).length, // State.Learning=1, State.Review=2, State.Relearning=3
    newCards: entries.filter(e => !e.card || e.card.state === 0).length, // State.New=0
  };
}

/**
 * Reset all FSRS cards — "Retrain from scratch"
 * Keeps the position keys but resets all scheduling to new
 */
export function resetAllCards() {
  const history = getPracticeHistory();
  for (const key of Object.keys(history)) {
    history[key] = {
      card: createEmptyCard(),
      lastRating: null,
      lastPracticed: 0,
      nextReview: Date.now(),
    };
  }
  savePracticeHistory(history);
  return history;
}

/**
 * Reset FSRS cards for a specific repertoire
 * @param {object} tree - PGN tree to collect all position keys from
 */
export function resetRepertoireCards(tree) {
  if (!tree) return;
  const history = getPracticeHistory();
  const keys = collectTreeFenKeys(tree);
  for (const key of keys) {
    history[key] = {
      card: createEmptyCard(),
      lastRating: null,
      lastPracticed: 0,
      nextReview: Date.now(),
    };
  }
  savePracticeHistory(history);
}

/**
 * Collect all FEN-based position keys from a tree
 */
function collectTreeFenKeys(node, keys = new Set()) {
  if (!node) return keys;
  if (node.fen) {
    // Use same key format as updatePracticeEntry: first 4 parts of FEN
    const key = node.fen.split(' ').slice(0, 4).join(' ');
    keys.add(key);
  }
  if (node.children) {
    for (const child of node.children.values()) {
      collectTreeFenKeys(child, keys);
    }
  }
  return keys;
}

/**
 * Export all data as JSON (for backup)
 */
export function exportAllData() {
  return JSON.stringify({
    repertoires: getRepertoires(),
    practiceHistory: getPracticeHistory(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

/**
 * Import all data from JSON backup (DESTRUCTIVE — replaces all data)
 */
export function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.repertoires) saveRepertoires(data.repertoires);
  if (data.practiceHistory) savePracticeHistory(data.practiceHistory);
  if (data.settings) saveSettings(data.settings);
  return data;
}

/**
 * Get settings (with defaults for all new features)
 */
export function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const saved = data ? JSON.parse(data) : {};
    return {
      // Board
      boardOrientation: 'white',
      showOpeningNames: true,
      autoFlipBoard: false,
      practiceColor: 'both',
      boardTheme: saved.boardTheme || 'space',
      pieceSet: saved.pieceSet || 'cburnett',
      // Drill settings
      drillPace: saved.drillPace || 400,        // auto-advance delay in ms (0=off, 200=fast, 400=normal, 800=slow)
      sessionCap: saved.sessionCap || 50,        // max cards per drill session
      dailyNewCap: saved.dailyNewCap || 20,      // max new cards per day
      lineWalkEnabled: saved.lineWalkEnabled !== false, // walk full line before due card (default: true)
      animateLearnedMoves: saved.animateLearnedMoves || 30, // days stability threshold for animation
      showHints: saved.showHints !== false,      // progressive hints enabled
      // Sparring
      sparSkillLevel: saved.sparSkillLevel || 10,
      sparShowDeviation: saved.sparShowDeviation !== false, // show deviation arrows in sparring
      // Misc
      introAnimSpeed: saved.introAnimSpeed || 'normal', // 'off' | 'slow' | 'normal' | 'fast'
      ...saved,
    };
  } catch {
    return {
      boardOrientation: 'white',
      boardTheme: 'space',
      drillPace: 400,
      sessionCap: 50,
      dailyNewCap: 20,
      lineWalkEnabled: true,
      animateLearnedMoves: 30,
      showHints: true,
      sparSkillLevel: 10,
      sparShowDeviation: true,
      introAnimSpeed: 'normal',
    };
  }
}

/**
 * Save settings
 */
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}
