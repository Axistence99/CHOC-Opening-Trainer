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

/**
 * Parse PGN into a tree structure suitable for training
 * Each node represents a position and its children are possible next moves
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
  
  const parsedLines = parsePGN(pgn);
  
  for (const line of parsedLines) {
    let currentNode = root;
    const chess = new Chess();
    
    for (let i = 0; i < line.moves.length; i++) {
      const san = line.moves[i];
      const moveResult = chess.move(san);
      
      if (!moveResult) break;
      
      if (!currentNode.children.has(san)) {
        currentNode.children.set(san, {
          fen: chess.fen(),
          move: moveResult,
          moveSan: san,
          children: new Map(),
          depth: i + 1,
        });
      }
      
      currentNode = currentNode.children.get(san);
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
  const moveText = traverseToPGN(root);
  
  return header + moveText + ' *';
}

/**
 * Traverse tree to build PGN text with variations (parentheses)
 */
function traverseToPGN(node) {
  if (node.children.size === 0) return '';
  
  const children = Array.from(node.children.entries());
  if (children.length === 0) return '';
  
  // First child is main line, rest are variations
  const [mainSan, mainChild] = children[0];
  let text = formatSAN(mainSan, mainChild);
  
  // Continue the main line
  text += ' ' + traverseToPGN(mainChild);
  
  // Variations (remaining children)
  for (let i = 1; i < children.length; i++) {
    const [varSan, varChild] = children[i];
    let varText = formatSAN(varSan, varChild);
    varText += ' ' + traverseToPGN(varChild);
    text += ' ( ' + varText.trim() + ' )';
  }
  
  return text.trim();
}

/**
 * Format a single SAN with move number prefix
 */
function formatSAN(san, child) {
  const depth = child?.depth || 0;
  if (depth % 2 === 1) {
    // White's move
    return `${Math.ceil(depth / 2)}. ${san}`;
  } else {
    // Black's move — need move number prefix if after a variation
    return `${Math.floor(depth / 2)}... ${san}`;
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
    if (current.children.size === 0) {
      if (path.length > 0) {
        paths.push([...path]);
      }
      return;
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
