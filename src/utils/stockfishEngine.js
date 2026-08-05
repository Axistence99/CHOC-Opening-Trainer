/**
 * Stockfish Web Worker wrapper.
 * Uses stockfish.js WASM via a Web Worker from public/engine/.
 *
 * IMPORTANT: The worker path must be relative (not absolute /) so it works
 * when hosted in a subdirectory like GitHub Pages (e.g., /CHOC-Opening-Trainer/).
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
        // Use relative path so it works in subdirectories (GitHub Pages)
        this.worker = new Worker('./engine/stockfish.wasm.js');
      } catch (e) {
        reject(Error(`Failed to create Stockfish worker: ${e.message}`));
        return;
      }

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          this.quit();
          reject(Error(`Stockfish init timeout`));
        }
      }, 15000);

      this.worker.onmessage = (e) => {
        const msg = typeof e === 'string' ? e : (e && e.data ? e.data : '');
        if (!msg || typeof msg !== 'string') return;

        if (this.onLog) this.onLog(msg);

        if (!resolved && msg === 'uciok') {
          resolved = true;
          this.ready = true;
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (msg.startsWith('bestmove')) {
          const move = msg.split(' ')[1];
          if (this._pendingResolve) {
            const r = this._pendingResolve;
            this._pendingResolve = null;
            r(move);
          }
        }
      };

      this.worker.onerror = (e) => {
        if (!resolved) {
          clearTimeout(timeout);
          reject(Error(`Stockfish worker error: ${e.message || 'unknown'}`));
        }
      };

      this.worker.postMessage('uci');
    });
  }

  async analyze(fen, options = {}) {
    const movetime = options.movetime || 2000;
    const skillLevel = options.skillLevel === undefined ? 10 : options.skillLevel;

    return new Promise((resolve) => {
      this._pendingResolve = resolve;

      this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
      this.worker.postMessage('isready');
      this.worker.postMessage(`position fen ${fen}`);

      if (movetime) {
        this.worker.postMessage(`go movetime ${movetime}`);
      } else {
        this.worker.postMessage(`go depth ${options.depth || 15}`);
      }
    });
  }

  quit() {
    if (this.worker) {
      try { this.worker.postMessage('quit'); } catch {}
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }
}

export function uciToMove(uci) {
  if (!uci || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}
