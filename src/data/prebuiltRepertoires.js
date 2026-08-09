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
  },
  {
    id: 'catalan-white',
    name: 'Catalan for White',
    color: 'white',
    description: 'A complete Catalan repertoire for White. Covers Open Catalan (Qc2, Ne5, a6 lines), Closed Catalan (e4 plans), and responses to KID, Slav, QID, Tarrasch, Dutch, Benoni, and Grünfeld. Based on the Lichess study by cokeaxistence.',
    pgn: `[Event "1. Open Catalan: 7. Qc2 a6 8. a4"]
{ The Catalan is not a system. It is very complex and theory based but if white plays accurately they will have a small yet lingering advantage and usually a better pawn structure. Not aggressive but very positional. If you like endgames, this opening is for you. }

1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O dxc4 7. Qc2 a6 8. a4 Bd7 9. Qxc4 Bc6 10. Bg5 Bd5 11. Qc2 Be4 12. Qc1 h6 13. Bxf6 Bxf6 14. Rd1 a5 15. Nbd2 Bxf3 16. Bxf3 Qxd4 17. Ne4 *

[Event "2. Open Catalan: 7. Qc2 a6 8. a4 Bd7"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O dxc4 7. Qc2 a6 8. a4 Bd7 9. Qxc4 Bc6 10. Bg5 Bd5 11. Qc2 Be4 12. Qc1 h6 13. Bxf6 Bxf6 14. Rd1 a5 15. Nbd2 Bh7 16. Nb3 c6 17. Qc3 *

[Event "3. Open Catalan: 7. Qc2 a6 8. Qxc4 b5"]
1. d4 d5 2. c4 e6 34. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O dxc4 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7 10. Bd2 Be4 11. Qc1 Bb7 12. Bf4 Bd6 13. Nbd2 Bxf4 14. gxf4 Nbd7 15. Nb3 Rc8 16. Rd1 Qe8 *

[Event "4. Open Catalan: 7. Ne5 Nc6 8. Bxc6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O dxc4 7. Ne5 Nc6 8. Bxc6 bxc6 9. Nxc6 Qe8 10. Nxe7+ Qxe7 11. Qa4 e5 12. dxe5 Qxe5 13. Qxc4 Be6 14. Qc2 Bf5 15. Qd2 Bh3 16. Re1 Rad8 17. Qe3 Qd5 18. f3 Ng4 19. Qc3 Rfe8 20. Na3 Qb7 21. Bf4 Qb6+ 22. e3 Qb7 23. e4 Qb6+ 24. Be3 Nxe3 25. Rxe3 *

[Event "5. Open Catalan: 7. Ne5 Nc6 8. Nxc6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O dxc4 7. Ne5 Nc6 8. Nxc6 bxc6 9. Na3 Bxa3 10. bxa3 Ba6 11. Qd2 Rb8 12. Qa5 Qc8 13. a4 Rd8 14. Ba3 Rxd4 15. Rfb1 *

[Event "6. Open Catalan: 4... dxc4 5. Bg2 a6 6. O-O Nc6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 a6 6. O-O Nc6 7. e3 Bd7 8. Qe2 b5 9. b3 cxb3 10. axb3 Be7 11. Bb2 O-O 12. Rc1 Nb4 13. Ne5 Nfd5 14. Na3 Be8 15. e4 Nb6 16. Nc2 a5 17. Nxb4 Bxb4 18. Nc6 Bxc6 19. Rxc6 a4 *

[Event "7. Open Catalan: 4... dxc4 5. Bg2 c5 6. O-O Nc6 7. Qa4"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 c5 6. O-O Nc6 7. Qa4 Bd7 8. Qxc4 b5 9. Qd3 Rc8 10. dxc5 Bxc5 11. Nc3 b4 12. Ne4 Nxe4 13. Qxe4 *

[Event "8. Open Catalan: 4... dxc4 5. Bg2 c5 6. O-O Nc6 7. dxc5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 c5 6. O-O Nc6 7. dxc5 Bxc5 8. Qa4+ Qd7 9. Nb5 O-O 10. Qxc4 Qe7 11. b4 Bb6 12. N5c3 *

[Event "9. Open Catalan: 4... dxc4 5. Bg2 Nc6 6. Qa4 Bb4+"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Nc6 6. Qa4 Bb4+ 7. Bd2 Nd5 8. Bxb4 Nxb4 9. O-O Rb8 10. Na3 O-O 11. Qb5 b6 12. Qxc4 Ba6 13. Nb5 Qd5 14. Qxd5 Nxd5 15. a4 Bb7 16. Ne5 *

[Event "10. Open Catalan: 4... dxc4 5. Bg2 b5 6. a4 c6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 b5 6. a4 c6 7. Ne5 Nd5 8. O-O Bb7 9. e4 Nf6 10. Nc3 a6 11. d5 cxd5 12. exd5 Nxd5 13. Qh5 g6 14. Nxg6 fxg6 15. Qe5 Qf6 16. Qxf6 Nxf6 17. Bxb7 Ra7 18. Bg2 *

[Event "11. Open Catalan: 4... dxc4 5. Bg2 a6 6. O-O b5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 a6 6. O-O b5 7. Ne5 Nd5 8. a4 Bb7 9. b3 c3 10. e4 b4 11. exd5 Bxd5 12. Qh5 g6 13. Qh3 *

[Event "12. Open Catalan: 4... dxc4 5. Bg2 Nbd7"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Nbd7 5. Bg2 dxc4 6. O-O b5 7. Ne5 Rb8 8. Nc6 Bb7 9. Nxb8 Qxb8 *

[Event "13. Open Catalan: 4... dxc4 5. Bg2 c5 6. O-O"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Nbd7 5. Bg2 dxc4 6. O-O c5 7. Na3 Nb6 8. Nxc4 Nxc4 9. Qa4+ Bd7 10. Qxc4 b5 11. Qc2 Rc8 12. dxc5 Bxc5 13. Qb3 O-O *

[Event "14. Open Catalan: 4... dxc4 5. Bg2 c6 6. Ne5 Bb4+"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 c6 6. Ne5 Bb4+ 7. Bd2 Be7 8. e3 b5 9. Nxc6 Nxc6 10. Bxc6+ Bd7 11. Bxa8 Qxa8 12. f3 e5 13. O-O *

[Event "15. Open Catalan: 4... dxc4 5. Bg2 Bb4+ 6. Bd2 a5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc2 Bxd2+ 8. Qxd2 c6 9. a4 Ne4 10. Qf4 Nd6 11. O-O Na6 12. Ne5 Nb4 13. Qc1 O-O 14. Na3 Ra6 15. Naxc4 Nxc4 16. Qxc4 f6 17. Nf3 Qe7 *

[Event "16. Open Catalan: 4... dxc4 5. Bg2 Bb4+ 6. Bd2 c5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 c5 7. Bxb4 cxb4 8. Ne5 O-O 9. Nxc4 Nc6 10. e3 e5 11. d5 b5 12. dxc6 Qxd1+ 13. Kxd1 bxc4 14. a3 Bg4+ 15. Kc1 *

[Event "17. Open Catalan: 4... dxc4 5. Bg2 Bd7 6. Ne5 Bc6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bd7 6. Ne5 Bc6 7. Nxc6 Nxc6 8. O-O Qd7 9. e3 O-O-O 10. Nd2 h5 11. Nxc4 h4 12. Bd2 *

[Event "18. Closed Catalan: 6... c6 7. Qc2 b6 8. Nbd2 Bb7"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O c6 7. Qc2 b6 8. Nbd2 Bb7 9. e4 dxe4 10. Nxe4 Nxe4 11. Qxe4 Nf6 12. Qe2 c5 13. Rd1 cxd4 14. Nxd4 Qb6 15. Be3 Bc5 *

[Event "19. Closed Catalan: 6... c6 7. Qc2 b6 8. Nbd2 Bb7 (Main)"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O c6 7. Qc2 b6 8. Nbd2 Bb7 9. e4 Nbd7 10. e5 Ne8 11. cxd5 cxd5 12. Re1 Rc8 13. Qa4 Nc7 14. Nf1 b5 15. Qd1 b4 16. h4 a5 *

[Event "20. Closed Catalan: 6... c6 7. b3 Nbd7 8. Bb2 b6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O c6 7. b3 Nbd7 8. Bb2 b6 9. Nbd2 Bb7 10. Qc2 Rc8 11. e4 c5 12. exd5 exd5 13. dxc5 Bxc5 14. Rad1 dxc4 15. Nxc4 Qc7 16. Qf5 *

[Event "21. Closed Catalan: 4... Bb4+ 5. Bd2 Be7 6. Bg2 O-O"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Bb4+ 5. Bd2 Be7 6. Bg2 O-O 7. O-O c6 8. Qc2 b6 9. Rd1 Nbd7 10. Bf4 Bb7 11. Ne5 Nh5 12. Bd2 Nhf6 *

[Event "22. Closed Catalan: 4... Bb4+ 5. Bd2 Bxd2+ 6. Nbxd2"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Bb4+ 5. Bd2 Bxd2+ 6. Nbxd2 O-O 7. Bg2 Nbd7 8. O-O c6 9. Qc2 b6 10. e4 Bb7 11. e5 Ne8 12. cxd5 cxd5 13. Rfc1 Rc8 14. Qa4 *

[Event "23. Closed Catalan: 4... Bb4+ 5. Bd2 a5 6. Bg2"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Bb4+ 5. Bd2 a5 6. Bg2 dxc4 7. Qc2 Bxd2+ 8. Qxd2 c6 9. a4 Ne4 10. Qf4 Qb6 11. O-O Qxb2 12. Ne5 O-O 13. Na3 Nc3 14. Qe3 Qb4 *

[Event "24. Closed Catalan: 4... Bb4+ 5. Bd2 Bd6 6. Bg2"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Bb4+ 5. Bd2 Bd6 6. Bg2 c6 7. Qc2 Nbd7 8. O-O O-O 9. Bg5 h6 10. Bxf6 Nxf6 11. Nbd2 b6 12. e4 Be7 13. e5 Nd7 14. Rfc1 *

[Event "25. Closed Catalan: 6... c5 7. O-O cxd4 8. Nxd4"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. Qc2 c5 7. O-O cxd4 8. Nxd4 Nc6 9. Nxc6 bxc6 10. b3 a5 11. Nc3 Ba6 12. Rd1 *

[Event "26. Closed Catalan: 6... b6 7. Nc3 Bb7 8. Ne5 Na6"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O b6 7. Nc3 Bb7 8. Ne5 Na6 9. cxd5 exd5 10. Bf4 c5 11. dxc5 Nxc5 *

[Event "27. Closed Catalan: 6... b6 7. cxd5 exd5 8. Nc3 Bb7"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O b6 7. cxd5 exd5 8. Nc3 Bb7 9. Bf4 Nbd7 10. Rc1 c6 11. Qc2 Re8 12. Rfd1 *

[Event "28. Closed Catalan: 4... Ne4 5. Bg2 Bb4+ 6. Nbd2"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Ne4 5. Bg2 Bb4+ 6. Nbd2 O-O 7. O-O Nc6 8. e3 Nxd2 9. Bxd2 Bxd2 10. Qxd2 dxc4 11. Qc3 *

[Event "29. Closed Catalan: 6... Ne4 7. Nc3 f5 (Stonewall Hybrid)"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O Ne4 7. Nc3 f5 8. Ne5 c6 9. f3 Nxc3 10. bxc3 Nd7 11. Nxd7 Bxd7 12. e4 fxe4 13. fxe4 Rxf1+ 14. Qxf1 *

[Event "30. vs King's Indian: 6... Nc6 7. Nc3 a6"]
1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. O-O Nc6 7. Nc3 a6 8. h3 Rb8 9. e4 b5 10. e5 dxe5 11. dxe5 Qxd1 12. Rxd1 Nd7 13. e6 fxe6 14. cxb5 axb5 15. Bf4 Nde5 16. Nxe5 Nxe5 17. Rac1 c5 18. Ne4 c4 19. Nc5 Rb6 *

[Event "31. vs King's Indian: 6... Nbd7 7. Nc3 e5 (Main Line)"]
1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. O-O Nbd7 7. Nc3 e5 8. e4 exd4 9. Nxd4 Re8 10. h3 Nc5 11. Re1 a5 12. Qc2 a4 13. Be3 c6 14. Rad1 Qa5 15. Bf4 Bf8 16. b3 axb3 17. axb3 Ne6 18. Be3 Bg7 *

[Event "32. vs King's Indian: 6... c5 7. d5 b5 (Benko Hybrid)"]
1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. O-O c5 7. d5 b5 8. cxb5 a6 9. bxa6 Bxa6 10. Nc3 Nbd7 11. Rb1 *

[Event "33. vs Slav Defense: 4... Bf5 5. Nc3 e6"]
1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. g3 Bf5 5. Nc3 e6 6. Bg2 Nbd7 7. O-O Be7 8. Nh4 Bg6 9. Nxg6 hxg6 10. e4 dxe4 11. Nxe4 Nxe4 12. Bxe4 Nf6 13. Bg2 O-O 14. Be3 Qc7 15. Qe2 *

[Event "34. vs Semi-Slav Defense: 4... e6 5. Bg2 Nbd7"]
1. d4 d5 2. c4 c6 3. Nf3 e6 4. g3 Nf6 5. Bg2 Nbd7 6. O-O Bd6 7. Nc3 O-O 8. Nd2 Re8 9. e4 dxe4 10. Ndxe4 Nxe4 11. Nxe4 Be7 12. c5 *

[Event "35. vs Semi-Slav Defense: 6... dxc4 7. Ne5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 c6 6. O-O dxc4 7. Ne5 O-O 8. Nxc4 b5 9. Ne5 Bb7 10. a4 *

[Event "36. vs Queen's Indian: 4... Ba6 5. b3 d5"]
1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Ba6 5. b3 d5 6. Bg2 Bb4+ 7. Bd2 Be7 8. cxd5 exd5 9. O-O O-O 10. Nc3 Bb7 11. Qc2 *

[Event "37. vs Queen's Indian: 3... Bb7 4. g3 e6"]
1. d4 b6 2. c4 Bb7 3. Nf3 e6 4. g3 Nf6 5. Bg2 Be7 6. Nc3 O-O 7. O-O Ne4 8. Qc2 Nxc3 9. Qxc3 Be4 *

[Event "38. vs Dutch Defense: 1... f5 2. g3 d6 3. Bg2 g6"]
1. d4 f5 2. g3 d6 3. Bg2 g6 4. c4 Bg7 5. Nc3 Nf6 6. Nf3 O-O 7. O-O Qe8 8. d5 Na6 9. Rb1 Bd7 10. b4 c6 11. dxc6 bxc6 12. a3 Nc7 13. Bb2 Rd8 14. a4 Ne6 15. Ba1 f4 16. b5 *

[Event "39. vs Tarrasch Defense: 4... c5 5. cxd5 exd5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 c5 5. cxd5 exd5 6. Bg2 Nc6 7. O-O Be7 8. Nc3 O-O 9. Bg5 cxd4 10. Nxd4 h6 11. Be3 Re8 12. Rc1 Bf8 13. Nxc6 bxc6 14. Na4 Bd7 15. Bc5 Bxc5 16. Nxc5 Bg4 17. Re1 Qa5 18. h3 Bf5 19. Qd4 Rab8 *

[Event "40. vs Tarrasch Defense: 4... c5 5. cxd5 exd5 6. g3 Nc6"]
1. d4 d5 2. c4 e6 3. Nf3 c5 4. cxd5 exd5 5. g3 Nc6 6. Bg2 Nf6 7. O-O Be7 8. Nc3 O-O 9. Bg5 cxd4 10. Nxd4 h6 11. Be3 Re8 12. Rc1 Bf8 13. Qa4 Na5 14. Rcd1 Bd7 15. Qc2 Rc8 *

[Event "41. vs Stonewall Dutch: 4... c6 5. Bg2 f5"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 c6 5. Bg2 f5 6. Nc3 Bd6 7. O-O O-O 8. Qc2 Ne4 9. Rb1 Nd7 10. b4 b5 11. cxb5 Nxc3 12. Qxc3 cxb5 13. Bg5 Qb6 14. Rfc1 Bb7 15. Qe3 Rfe8 *

[Event "42. Closed Catalan: 6... b6 Main Line"]
1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 5. Bg2 O-O 6. O-O b6 7. cxd5 exd5 8. Nc3 Bb7 9. Bf4 Nbd7 10. Rc1 c6 11. Qc2 Re8 12. Rfd1 *

[Event "43. vs Flank Systems: 1... g6 2. c4 Nf6 3. Nf3 Bg7"]
1. d4 g6 2. c4 Nf6 3. Nf3 Bg7 4. g3 b6 5. Bg2 Bb7 6. O-O O-O 7. Nc3 d6 8. Qc2 Nbd7 9. e4 e5 10. dxe5 dxe5 11. Rd1 *

[Event "44. vs Modern Benoni: 1... c5 2. d5 e6 3. c4 Nf6"]
1. d4 c5 2. d5 e6 3. c4 Nf6 4. Nc3 exd5 5. cxd5 d6 6. e4 g6 7. f4 Bg7 8. Bb5+ Nfd7 9. a4 O-O 10. Nf3 Na6 11. O-O Nb4 12. Re1 a6 13. Bf1 *

[Event "45. vs Grünfeld Defense: 4. cxd5 Nxd5 5. e4 Nb6"]
1. d4 Nf6 2. c4 g6 3. Nf3 d5 4. cxd5 Nxd5 5. e4 Nb6 6. Bb5+ c6 7. Be2 Bg7 8. Nc3 Bg4 9. Be3 O-O 10. O-O Bh5 11. Ne5 Bxe2 12. Qxe2 *

[Event "46. vs Grünfeld Defense: 4. g3 Bg7 5. Bg2 d5"]
1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d5 6. cxd5 Nxd5 7. O-O Nb6 8. Nc3 Nc6 9. e3 e5 10. d5 e4 *`
  }
];

export default PREBUILT_REPERTOIRES;
