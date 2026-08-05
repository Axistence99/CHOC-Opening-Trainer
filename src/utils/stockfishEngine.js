import { Chess } from 'chess.js';

/**
 * Stockfish engine wrapper for the browser.
 * Uses stockfish.js WASM via a Web Worker from public/engine/.
 *
 * Usage:
 *   const engine = new StockfishEngine();
 *   await engine.init();
 *   const bestMove = await engine.analyze(fen, { depth: 15 });
 *   engine.quit();
 */
export default class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.onLog = null;
    this._pendingResolve = null;
    this._messageBuffer = '';
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        // Load stockfish from public directory
        this.worker = new Worker('/engine/stockfish.wasm.js');
      } catch (e) {
        reject(new Error('Failed to create Stockfish worker: ' + e.message));
        return;
      }

      let initialized = false;
      const timeout = setTimeout(() => {
        if (!initialized) {
          this.quit();
          reject(new Error('Stockfish init timeout'));
        }
      }, 15000);

      this.worker.onmessage = (e) => {
        const line = typeof e === 'string' ? e : (e && e.data ? e.data : '');
        if (!line || typeof line !== 'string') return;
        if (this.onLog) this.onLog(line);

        if (!initialized && line === 'uciok') {
          initialized = true;
          this.ready = true;
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Handle bestmove responses
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const bestMove = parts[1];
          if (this._pendingResolve) {
            const r = this._pendingResolve;
            this._pendingResolve = null;
            r(bestMove);
          }
        }
      };

      this.worker.onerror = (e) => {
        if (!initialized) {
          clearTimeout(timeout);
          reject(new Error('Stockfish worker error: ' + (e.message || 'unknown')));
        }
      };

      // Initialize UCI protocol
      this.worker.postMessage('uci');
    });
  }

  /**
   * Analyze a position and return the best move.
   * @param {string} fen - FEN string
   * @param {object} options - { depth, movetime(ms), skillLevel(0-20) }
   * @returns {Promise<string>} Best move in UCI format (e.g. "e2e4")
   */
  async analyze(fen, options = {}) {
    const movetime = options.movetime || 2000;
    const skillLevel = options.skillLevel !== undefined ? options.skillLevel : 10;

    return new Promise((resolve) => {
      this._pendingResolve = resolve;

      // Set skill level (lower = weaker, more human-like mistakes)
      this.worker.postMessage('setoption name Skill Level value ' + skillLevel);
      this.worker.postMessage('isready');
      this.worker.postMessage('position fen ' + fen);

      if (movetime) {
        this.worker.postMessage('go movetime ' + movetime);
      } else {
        this.worker.postMessage('go depth ' + (options.depth || 15));
      }
    });
  }

  /** Quit and terminate the worker. */
  quit() {
    if (this.worker) {
      try { this.worker.postMessage('quit'); } catch {}
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }
}

/**
 * Convert UCI move string (e.g. "e2e4") to { from, to, promotion }.
 */
export function uciToMove(uci) {
  if (!uci || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}
