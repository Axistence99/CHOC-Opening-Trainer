// Local storage utilities for persisting repertoire data and progress

const STORAGE_KEYS = {
  REPERTOIRES: 'chess-trainer-repertoires',
  PRACTICE_HISTORY: 'chess-trainer-practice-history',
  SETTINGS: 'chess-trainer-settings',
};

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
 * Get practice history (spaced repetition data)
 * Format: { [positionKey]: { lastPracticed, easeFactor, interval, repetitions, nextReview } }
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
 * Update a single position's practice data using SM-2 algorithm
 * @param {string} positionKey - FEN-based key for the position
 * @param {number} quality - 0-5 rating (0=complete failure, 5=perfect)
 */
export function updatePracticeEntry(positionKey, quality) {
  const history = getPracticeHistory();
  const entry = history[positionKey] || {
    lastPracticed: 0,
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: Date.now(),
  };

  // SM-2 Algorithm
  let { easeFactor, interval, repetitions } = entry;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  const now = Date.now();
  history[positionKey] = {
    lastPracticed: now,
    easeFactor,
    interval,
    repetitions,
    nextReview: now + interval * 24 * 60 * 60 * 1000, // interval in days
  };

  savePracticeHistory(history);
  return history;
}

/**
 * Get positions that are due for review
 */
export function getDuePositions() {
  const history = getPracticeHistory();
  const now = Date.now();
  return Object.entries(history)
    .filter(([_, entry]) => entry.nextReview <= now)
    .map(([key, entry]) => ({ key, ...entry }));
}

/**
 * Get settings
 */
export function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      boardOrientation: 'white',
      showOpeningNames: true,
      autoFlipBoard: false,
      practiceColor: 'both',
    };
  } catch {
    return {};
  }
}

/**
 * Save settings
 */
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}
