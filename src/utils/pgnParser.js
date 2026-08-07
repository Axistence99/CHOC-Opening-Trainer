import { Chess } from 'chess.js';

/**
 * Parse a PGN string and extract all lines/variations as arrays of moves
 * @param {string} pgn - PGN text (may contain multiple games)
 * @returns {Array<{moves: string[], fen: string, moveTexts: string[]}>} Array of lines
 */
export function parsePGN(pgn) {
  const lines = [];
  
  // Split into individual games
  const games = splitPGNIntoGames(pgn);
  
  for (const gamePgn of games) {
    try {
      const chess = new Chess();
      const result = chess.loadPgn(gamePgn.trim());
      
      if (result) {
        // Get the main line moves
        const history = chess.history({ verbose: true });
        const moveTexts = chess.history();
        
        if (history.length > 0) {
          // Replay from start to get all positions
          const replay = new Chess();
          const positions = [{ fen: replay.fen(), moves: [], moveTexts: [] }];
          
          for (let i = 0; i < history.length; i++) {
            const move = history[i];
            replay.move(move.san);
            positions.push({
              fen: replay.fen(),
              moves: history.slice(0, i + 1).map(m => m.san),
              moveTexts: moveTexts.slice(0, i + 1),
            });
          }
          
          lines.push({
            moves: history.map(m => m.san),
            moveTexts,
            positions,
            finalFen: replay.fen(),
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse PGN game:', e.message);
    }
  }
  
  return lines;
}

/**
 * Split a PGN string that may contain multiple games into individual game PGNs
 */
function splitPGNIntoGames(pgn) {
  const games = [];
  const lines = pgn.split('\n');
  let currentGame = [];
  let inHeaders = false;
  let hasMoveText = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('[')) {
      // Header line
      if (hasMoveText && currentGame.length > 0) {
        // We've started a new game — save the previous one
        games.push(currentGame.join('\n'));
        currentGame = [];
        hasMoveText = false;
      }
      inHeaders = true;
      currentGame.push(line);
    } else if (trimmed.length > 0) {
      // Move text line
      hasMoveText = true;
      inHeaders = false;
      currentGame.push(line);
    } else if (inHeaders) {
      // Empty line between headers and moves
      currentGame.push(line);
    }
  }
  
  if (currentGame.length > 0 && hasMoveText) {
    games.push(currentGame.join('\n'));
  }
  
  // If no games were parsed using header detection, try the whole thing as one game
  if (games.length === 0 && pgn.trim().length > 0) {
    games.push(pgn);
  }
  
  return games;
}

// ─── Robust PGN → SAN extraction ───
// chess.js `loadPgn` is strict: it fails on multi-game PGNs that share a single
// header block, on in-line move-number tokens like "12.", and on malformed lines.
// Instead of relying on it for tree building, we extract legal SAN move tokens
// directly and play them into the tree with chess.js `move()`. This makes the
// tree robust to all of the above.

const SAN_RE =
  /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?$/;

/**
 * Strip PGN headers, comments, and split the move text into individual games
 * (segments delimited by result markers like "*", "1-0", "0-1", "1/2-1/2").
 */
export function extractGameSegments(pgn) {
  const rawText = String(pgn || '').trim();
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/);
  const blocks = [];
  let currentLines = [];
  let hasMoveText = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentLines.length > 0) currentLines.push(line);
      continue;
    }

    if (trimmed.startsWith('[')) {
      if (hasMoveText) {
        blocks.push(currentLines.join('\n'));
        currentLines = [];
        hasMoveText = false;
      }
      currentLines.push(line);
    } else {
      hasMoveText = true;
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    blocks.push(currentLines.join('\n'));
  }

  const games = [];
  for (const block of blocks) {
    let chapterName = null;
    let fen = null;
    const chapterMatch = block.match(/\[ChapterName\s+"([^"]+)"\]/i);
    const eventMatch = block.match(/\[Event\s+"([^"]+)"\]/i);
    const openingMatch = block.match(/\[Opening\s+"([^"]+)"\]/i);
    const fenMatch = block.match(/\[FEN\s+"([^"]+)"\]/i);
    if (chapterMatch && chapterMatch[1] && chapterMatch[1] !== '?' && chapterMatch[1] !== '*') {
      chapterName = chapterMatch[1];
    } else if (eventMatch && eventMatch[1] && eventMatch[1] !== '?' && eventMatch[1] !== '*') {
      chapterName = eventMatch[1];
    } else if (openingMatch && openingMatch[1] && openingMatch[1] !== '?' && openingMatch[1] !== '*') {
      chapterName = openingMatch[1];
    }
    if (fenMatch && fenMatch[1]) {
      fen = fenMatch[1].trim();
    }
    const cleaned = block
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/;[^\n]*/g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\b(?:1-0|0-1|1\/2-1\/2|½-½)\b|\*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    const subGames = cleaned
      .split(/\b(?:1-0|0-1|1\/2-1\/2|½-½)\b|\*/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < subGames.length; i++) {
      const g = subGames[i];
      const name = chapterName ? (subGames.length > 1 ? `${chapterName} (Pt. ${i+1})` : chapterName) : null;
      games.push({ text: g, name, fen });
    }
  }

  return games;
}

/**
 * Tokenize a single game's move text into an array of SAN move strings
 * and variation brackets '(' and ')', skipping move numbers and result markers.
 */
export function tokenizePGN(gameSegment) {
  let text = String(gameSegment || '').trim();
  text = text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
  const rawTokens = text.split(/\s+/);
  const tokens = [];
  for (let tok of rawTokens) {
    if (!tok) continue;
    if (tok === '(' || tok === ')') {
      tokens.push(tok);
      continue;
    }
    tok = tok.replace(/^\d+\.\.\./, '').replace(/^\d+\./, '');
    if (!tok) continue;
    tok = tok.replace(/[!?]+$/, '');
    if (SAN_RE.test(tok)) {
      tokens.push(tok);
    }
  }
  return tokens;
}

function findNodeByFen(node, targetFen) {
  if (!node || !targetFen) return null;
  const tKey = targetFen.split(' ').slice(0, 4).join(' ');
  if (node.fen && node.fen.split(' ').slice(0, 4).join(' ') === tKey) return node;
  for (const child of node.children.values()) {
    const found = findNodeByFen(child, targetFen);
    if (found) return found;
  }
  return null;
}

/**
 * Parse PGN into a tree structure suitable for training
 * Each node represents a position and its children are possible next moves
 * Supports variations in parentheses ( ... ) skillfully.
 * @param {string} pgn - PGN text
 * @returns {Object} Tree structure: { fen, move, children: Map<san, node> }
 */
export function parsePGNToTree(pgn) {
  const root = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move: null,
    moveSan: null,
    children: new Map(),
    depth: 0,
  };

  const games = extractGameSegments(pgn);

  for (const game of games) {
    const tokens = tokenizePGN(game.text || game);
    if (tokens.length === 0) continue;

    let startNode = root;
    let startFen = root.fen;
    if (game.fen) {
      try {
        const testChess = new Chess(game.fen);
        const tFen = testChess.fen();
        const existing = findNodeByFen(root, tFen);
        if (existing) {
          startNode = existing;
          startFen = tFen;
        } else if (root.children.size === 0) {
          root.fen = tFen;
          startNode = root;
          startFen = tFen;
        } else {
          startFen = tFen;
        }
      } catch (e) {
        startFen = root.fen;
      }
    }

    const stack = [{ node: startNode, chess: new Chess(startFen) }];
    let parent = { node: startNode, fen: startFen };

    for (const tok of tokens) {
      if (tok === '(') {
        stack.push({
          node: parent.node,
          chess: new Chess(parent.fen),
        });
        continue;
      } else if (tok === ')') {
        if (stack.length > 1) {
          stack.pop();
        }
        continue;
      }

      const current = stack[stack.length - 1];
      const beforeFen = current.chess.fen();
      let moveResult;
      try {
        moveResult = current.chess.move(tok);
      } catch {
        moveResult = null;
      }
      if (!moveResult) continue;

      parent = { node: current.node, fen: beforeFen };

      if (!current.node.children.has(tok)) {
        current.node.children.set(tok, {
          fen: current.chess.fen(),
          move: moveResult,
          moveSan: tok,
          children: new Map(),
          depth: current.node.depth + 1,
        });
      }
      const childNode = current.node.children.get(tok);
      current.node = childNode;

      // Ensure turn color tag is attached so training mode knows whose turn it is
      if (!childNode.turnColor) {
        childNode.turnColor = current.chess.turn() === 'w' ? 'white' : 'black';
      }
    }

    const lastNode = stack[stack.length - 1].node;
    if (game.name && lastNode) {
      lastNode.chapterName = game.name;
    }
  }

  return root;
}

/**
 * Convert a tree back to PGN format (for export)
 * Handles variations using parentheses notation
 */
export function treeToPGN(root, repertoireName = 'Exported Repertoire') {
  if (!root || root.children.size === 0) return '';
  
  const date = new Date().toISOString().split('T')[0];
  const header = `[Event "${repertoireName}"]\n[Site "CHOC Opening Trainer"]\n[Date "${date}"]\n\n`;
  
  // Build PGN with variations
  const moveText = traverseToPGN(root, true);
  
  return header + moveText + ' *';
}

/**
 * Traverse tree to build PGN text with variations (parentheses)
 */
function traverseToPGN(node, forceMoveNumber = true) {
  if (!node || node.children.size === 0) return '';
  
  const children = Array.from(node.children.entries());
  if (children.length === 0) return '';
  
  // First child is main line, rest are variations
  const [mainSan, mainChild] = children[0];
  let text = formatSAN(mainSan, mainChild, forceMoveNumber);
  
  // Continue the main line
  const mainContinuation = traverseToPGN(mainChild, false);
  if (mainContinuation) {
    text += ' ' + mainContinuation;
  }
  
  // Variations (remaining children)
  for (let i = 1; i < children.length; i++) {
    const [varSan, varChild] = children[i];
    let varText = formatSAN(varSan, varChild, true);
    const varContinuation = traverseToPGN(varChild, false);
    if (varContinuation) {
      varText += ' ' + varContinuation;
    }
    text += ' ( ' + varText.trim() + ' )';
  }
  
  return text.trim();
}

/**
 * Format a single SAN with move number prefix
 */
function formatSAN(san, child, forceMoveNumber = false) {
  const depth = child?.depth || 0;
  if (depth % 2 === 1) {
    // White's move
    return `${Math.ceil(depth / 2)}. ${san}`;
  } else {
    // Black's move
    if (forceMoveNumber) {
      return `${Math.floor(depth / 2)}... ${san}`;
    }
    return san;
  }
}

/**
 * Format move text with move numbers
 */
function formatMoveText(moveStr) {
  const moves = moveStr.split(' ');
  let result = '';
  
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      result += `${Math.floor(i / 2) + 1}. `;
    }
    result += moves[i] + ' ';
  }
  
  return result.trim();
}

/**
 * Get the total number of positions in a tree
 */
export function countPositions(node) {
  let count = 1; // count this node
  for (const child of node.children.values()) {
    count += countPositions(child);
  }
  return count;
}

/**
 * Get all leaf paths from the tree (for training)
 */
export function getLeafPaths(node) {
  const paths = [];
  
  function traverse(current, path) {
    if (current.children.size === 0 || current.chapterName) {
      if (path.length > 0) {
        const line = [...path];
        line.name = current.chapterName || null;
        paths.push(line);
      }
      if (current.children.size === 0) return;
    }
    
    for (const [san, child] of current.children) {
      path.push({ san, fen: child.fen, depth: child.depth });
      traverse(child, path);
      path.pop();
    }
  }
  
  traverse(node, []);
  return paths;
}
