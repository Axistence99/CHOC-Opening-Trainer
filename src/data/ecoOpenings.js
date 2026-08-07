// ECO-based opening name lookup
// Maps a position (as FEN without move counters) to an opening name
// This is a simplified subset — a full ECO database has ~500 openings

const ECO_OPENINGS = {
  // Starting position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq': 'Starting Position',
  
  // After 1.e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'King\'s Pawn Game',
  // After 1.e4 e5
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6': 'King\'s Pawn Game',
  // After 1.e4 c5
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6': 'Sicilian Defense',
  // After 1.e4 e6
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': 'French Defense',
  // After 1.e4 c6
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6': 'Caro-Kann Defense',
  // After 1.e4 Nf6
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': 'Alekhine\'s Defense',
  // After 1.e4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6': 'Scandinavian Defense',
  // After 1.e4 g6
  'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': 'Modern Defense',
  // After 1.e4 b6
  'rnbqkbnr/pppp1ppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq b6': 'Owen\'s Defense',
  // After 1.e4 d6
  'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': 'Pirc Defense',
  
  // After 1.d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'Queen\'s Pawn Game',
  // After 1.d4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': 'Queen\'s Pawn Game',
  // After 1.d4 Nf6
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': 'Indian Defense',
  // After 1.d4 f5
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq f6': 'Dutch Defense',
  // After 1.d4 g6
  'rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': 'Modern Defense',
  
  // After 1.c4
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3': 'English Opening',
  // After 1.Nf3
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq': 'Réti Opening',
  // After 1.g3
  'rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR b KQkq g2': 'Hungarian Opening',
};

/**
 * Get the opening name for a given FEN
 * @param {string} fen - Full FEN string
 * @returns {string} Opening name or "Unknown Opening"
 */
export function getOpeningName(fen) {
  // Remove halfmove and fullmove clocks for matching
  const fenParts = fen.split(' ');
  const positionKey = fenParts.slice(0, 4).join(' ');
  
  return ECO_OPENINGS[positionKey] || 'Unknown Opening';
}

/**
 * Try to determine the opening name from a move list
 * Uses pattern matching on the first few moves
 */
export function getOpeningFromMoves(moves) {
  const moveStr = moves.join(' ');
  
  const patterns = [
    { pattern: /^e4 e5 Nf3 Nc6 Bc4/, name: 'Italian Game' },
    { pattern: /^e4 e5 Nf3 Nc6 Bb5/, name: 'Ruy Lopez' },
    { pattern: /^e4 e5 Nf3 Nc6 d4/, name: 'Scotch Game' },
    { pattern: /^e4 e5 Nf3 Nf6/, name: 'Petrov\'s Defense' },
    { pattern: /^e4 e5 Nf3 d6/, name: 'Philidor Defense' },
    { pattern: /^e4 e5/, name: 'King\'s Pawn Opening' },
    { pattern: /^e4 c5 Nf3 d6 d4/, name: 'Sicilian Najdorf/Classical' },
    { pattern: /^e4 c5 Nf3 Nc6/, name: 'Sicilian: Old Open' },
    { pattern: /^e4 c5 Nf3 d6/, name: 'Sicilian: Open' },
    { pattern: /^e4 c5/, name: 'Sicilian Defense' },
    { pattern: /^e4 e6/, name: 'French Defense' },
    { pattern: /^e4 c6/, name: 'Caro-Kann Defense' },
    { pattern: /^e4 Nf6/, name: 'Alekhine\'s Defense' },
    { pattern: /^e4 d5/, name: 'Scandinavian Defense' },
    { pattern: /^e4 g6/, name: 'Modern/Pirc Defense' },
    { pattern: /^e4 d6/, name: 'Pirc Defense' },
    { pattern: /^d4 d5 c4 e6/, name: 'Queen\'s Gambit Declined' },
    { pattern: /^d4 d5 c4 c6/, name: 'Slav Defense' },
    { pattern: /^d4 d5 c4 dxc4/, name: 'Queen\'s Gambit Accepted' },
    { pattern: /^d4 d5 c4/, name: 'Queen\'s Gambit' },
    { pattern: /^d4 Nf6 c4 g6 Nc3 Bg7 e4/, name: 'King\'s Indian Defense' },
    { pattern: /^d4 Nf6 c4 e6/, name: 'Nimzo-Indian Defense' },
    { pattern: /^d4 Nf6 c4 g6/, name: 'King\'s Indian Fianchetto' },
    { pattern: /^d4 Nf6/, name: 'Indian Defense' },
    { pattern: /^d4 d5/, name: 'Queen\'s Pawn Game' },
    { pattern: /^d4/, name: 'Queen\'s Pawn Opening' },
    { pattern: /^c4/, name: 'English Opening' },
    { pattern: /^Nf3/, name: 'Réti Opening' },
    { pattern: /^g3/, name: 'Hungarian Opening' },
    { pattern: /^b3/, name: 'Larsen\'s Opening' },
    { pattern: /^f4/, name: 'Bird\'s Opening' },
  ];
  
  for (const { pattern, name } of patterns) {
    if (pattern.test(moveStr)) {
      return name;
    }
  }
  
  return 'Unknown Opening';
}

export default ECO_OPENINGS;
