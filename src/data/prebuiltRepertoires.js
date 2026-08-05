// Pre-built opening repertoires for beginners
// Each repertoire has a name, color, description, and lines (PGN format)

const PREBUILT_REPERTOIRES = [
  {
    id: 'beginner-white',
    name: 'Beginner White (e4)',
    color: 'white',
    description: 'A simple e4 repertoire for beginners. Focuses on common, easy-to-play positions.',
    pgn: `[Event "Beginner White Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "You"]
[Black "Opponent"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Nce7 11. O-O O-O 12. Re1 c6 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Be7 5. O-O O-O 6. Nbd2 d6 7. c3 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. c3 O-O 7. Nbd2 *

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 e5 7. Nb3 Be7 8. O-O O-O 9. Be3 Be6 10. Qd2 Nbd7 *
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. f4 e5 7. Nf3 *

1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6 7. Ngf3 Qb6 8. Nc2 *
1. e4 e6 2. d4 d5 3. Nd2 c5 4. e5 *

1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 Ngf6 11. Bd2 e6 *

1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4 dxe5 6. fxe5 Nc6 7. Be3 Bf5 8. Nc3 e6 9. Nf3 *

1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bf5 6. Bd2 c6 7. Bc4 *

1. e4 g6 2. d4 Bg7 3. Nc3 d6 4. Nf3 Nf6 5. Be2 O-O 6. O-O *
1. e4 b6 2. d4 Bb7 3. Nc3 e6 4. Nf3 Nf6 5. Bd3 c5 6. O-O *
`
  },
  {
    id: 'beginner-black',
    name: 'Beginner Black (e5 + Caro-Kann)',
    color: 'black',
    description: 'A solid black repertoire. e5 vs e4, Caro-Kann vs d4, and simple systems vs flank openings.',
    pgn: `[Event "Beginner Black Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "Opponent"]
[Black "You"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nb4 9. a3 Nxc2+ 10. Kd1 Nxa1 *
1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. e5 Nd5 7. Bc4 Nb6 8. Bb3 *
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. c3 O-O 7. Bg5 *

1. d4 c6 2. e4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 Ngf6 11. Bd2 e6 *
1. d4 c6 2. c4 d5 3. Nc3 dxc4 4. e4 b5 5. a3 Bb7 6. Nf3 e6 7. Bxc4 *

1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Nde7 7. O-O Be7 8. d3 O-O *
1. Nf3 d5 2. c4 c6 3. e4 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 *
1. g3 d5 2. Bg2 Nf6 3. c4 c6 4. cxd5 cxd5 5. Nc3 Nc6 6. Nf3 *
`
  },
  {
    id: 'italian-game',
    name: 'Italian Game',
    color: 'white',
    description: 'The Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4) — a classic opening with rich history. Great for beginners and club players.',
    pgn: `[Event "Italian Game Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "You"]
[Black "Opponent"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Nce7 11. O-O O-O 12. Re1 c6 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nbd2 d5 8. exd5 Nxd5 9. Qb3 Nce7 10. O-O O-O *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. c3 O-O 7. Nbd2 a5 8. b4 Ba7 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Be7 5. O-O O-O 6. Nbd2 d6 7. c3 a5 *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 d5 5. exd5 Nxd5 6. O-O Be7 7. Re1 O-O *
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 b5 6. Bf1 Nxd5 7. d3 Be7 8. Nf3 O-O *
`
  },
  {
    id: 'sicilian-dragon',
    name: 'Sicilian Dragon',
    color: 'black',
    description: 'The Sicilian Dragon (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6) — aggressive and exciting!',
    pgn: `[Event "Sicilian Dragon Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "Opponent"]
[Black "You"]
[Result "*"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4 Bd7 10. O-O-O Rc8 *
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4 Bd7 10. O-O-O Qa5 *
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be2 Bg7 7. O-O O-O 8. Nb3 *
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. f4 Bg7 7. Nf3 O-O 8. Bd3 *
1. e4 c5 2. c3 d6 3. d4 cxd4 4. cxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O *
1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. Nc3 Bg7 6. Be3 Nf6 7. Bc4 O-O 8. O-O *
`
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    color: 'white',
    description: "The Queen's Gambit (1.d4 d5 2.c4) — a strategic and positional opening for White. Extremely popular at all levels.",
    pgn: `[Event "Queen's Gambit Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "You"]
[Black "Opponent"]
[Result "*"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7 7. Rc1 c6 8. Bd3 dxc4 9. Bxc4 Nd5 10. Bxe7 Qxe7 11. O-O Nxc3 12. Rxc3 e5 *
1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7 7. Rc1 c6 8. Qc2 a6 9. a4 *
1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. Bg5 dxc4 6. e4 Bb4 7. Bxc4 Qa5 8. Bxf6 *
1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 *
1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. Nc3 *
1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bg5 O-O 6. e3 Nbd7 7. Rc1 c6 8. Bd3 dxc4 9. Bxc4 *
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O *
1. d4 f5 2. c4 Nf6 3. Nc3 e6 4. Nf3 Be7 5. g3 O-O 6. Bg2 d6 7. O-O *
`
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defense",
    color: 'black',
    description: "The King's Indian Defense — a dynamic and aggressive defense against 1.d4. Favored by Kasparov and Fischer.",
    pgn: `[Event "King's Indian Defense Repertoire"]
[Site "CHOC Opening Trainer"]
[Date "2024.01.01"]
[White "Opponent"]
[Black "You"]
[Result "*"]

1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. Nd2 c6 10. a4 Ne8 *
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. d5 c6 8. Nge2 Nbd7 *
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 O-O 6. Bg5 c5 7. d5 e6 8. Nf3 *
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. b4 Nh5 *
1. c4 Nf6 2. Nc3 g6 3. Nf3 Bg7 4. e4 d6 5. d4 O-O 6. Be2 e5 7. O-O *
1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. e4 d6 6. Be2 e5 7. O-O *
`
  }
];

export default PREBUILT_REPERTOIRES;
