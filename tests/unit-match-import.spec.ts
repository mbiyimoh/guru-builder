import { test, expect } from '@playwright/test';
import {
  parseJellyFishMatch,
  enrichMatchMetadata,
  validateParsedMatch,
  countExpectedPositions,
} from '@/lib/matchImport/jellyFishParser';
import {
  INITIAL_BOARD,
  cloneBoard,
  calculatePipCount,
  allInHomeBoard,
  applyMove,
  replayGame,
  generateAsciiBoard,
} from '@/lib/matchImport/replayEngine';
import {
  classifyPhase,
  isBearoffPosition,
  isRacePosition,
  getPhaseDistribution,
} from '@/lib/matchImport/phaseClassifier';
import type { ParsedGame, MoveNotation, BoardState } from '@/lib/matchImport/types';

/**
 * Match Archive Import System - Unit Tests
 *
 * Tests the JellyFish parser, replay engine, and phase classifier
 * for importing backgammon match archives.
 */

// Sample JellyFish match data for testing
const SAMPLE_MATCH = ` 7 point match

Game 1
John Smith(USA) : 0
Jane Doe(GBR) : 0
 1) 31: 8/5 6/5                  42: 24/20 13/11
 2) 53: 13/8 13/10               65: 24/18 13/8

Game 2
John Smith(USA) : 0
Jane Doe(GBR) : 1
 1) 42: 8/4 6/4                  31: 8/5 6/5
`;

const MINIMAL_MATCH = ` 5 point match

Game 1
PlayerA : 0
PlayerB : 0
 1) 31: 8/5 6/5                  42: 24/20 13/11
`;

// =============================================================================
// JELLYFISH PARSER TESTS
// =============================================================================

test.describe('JellyFish Parser', () => {
  test.describe('parseJellyFishMatch', () => {
    test('should parse match length header', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.matchLength).toBe(7);
    });

    test('should parse multiple games', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.games.length).toBe(2);
    });

    test('should parse player names', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const game1 = result.match?.games[0];
      expect(game1?.player1.name).toBe('John Smith');
      expect(game1?.player2.name).toBe('Jane Doe');
    });

    test('should parse player country codes', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const game1 = result.match?.games[0];
      expect(game1?.player1.country).toBe('USA');
      expect(game1?.player2.country).toBe('GBR');
    });

    test('should parse player scores', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const game2 = result.match?.games[1];
      expect(game2?.player1.score).toBe(0);
      expect(game2?.player2.score).toBe(1);
    });

    test('should parse move lines', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const game1 = result.match?.games[0];
      expect(game1?.moves.length).toBe(2);
    });

    test('should parse dice rolls', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const move1 = result.match?.games[0]?.moves[0];
      expect(move1?.player1Dice).toEqual([3, 1]);
      expect(move1?.player2Dice).toEqual([4, 2]);
    });

    test('should parse move notation', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const move1 = result.match?.games[0]?.moves[0];
      expect(move1?.player1Moves).toHaveLength(2);
      expect(move1?.player1Moves?.[0]).toEqual({ from: 8, to: 5, isHit: false });
      expect(move1?.player1Moves?.[1]).toEqual({ from: 6, to: 5, isHit: false });
    });

    test('should handle players without country codes', () => {
      const result = parseJellyFishMatch(MINIMAL_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.games[0]?.player1.country).toBeUndefined();
    });

    test('should return errors for empty file', () => {
      const result = parseJellyFishMatch('');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return errors for invalid header', () => {
      const result = parseJellyFishMatch('Invalid header\nGame 1');
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Invalid match header');
    });

    test('should respect maxGames option', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH, { maxGames: 1 });
      expect(result.success).toBe(true);
      expect(result.match?.games.length).toBe(1);
    });
  });

  test.describe('Hardy Format Support', () => {
    // Sample Hardy format match with combined player lines and leading whitespace on game headers
    const HARDY_FORMAT_MATCH = ` 7 point match

 Game 1
Suzuki_Mochy_(JPN) : 0     Falafel_Nick_(USA) : 0
 1) 31: 8/5 6/5                  42: 24/20 13/11
 2) 53: 13/8 13/10               65: 24/18 13/8

 Game 2
Suzuki_Mochy_(JPN) : 1     Falafel_Nick_(USA) : 0
 1) 42: 8/4 6/4                  31: 8/5 6/5
`;

    test('should parse game header with leading whitespace', () => {
      const result = parseJellyFishMatch(HARDY_FORMAT_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.games.length).toBe(2);
    });

    test('should parse combined player line format', () => {
      const result = parseJellyFishMatch(HARDY_FORMAT_MATCH);
      expect(result.success).toBe(true);
      const game1 = result.match?.games[0];
      expect(game1?.player1.name).toBe('Suzuki Mochy');
      expect(game1?.player1.country).toBe('JPN');
      expect(game1?.player2.name).toBe('Falafel Nick');
      expect(game1?.player2.country).toBe('USA');
    });

    test('should normalize underscores to spaces in player names', () => {
      const result = parseJellyFishMatch(HARDY_FORMAT_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.games[0]?.player1.name).not.toContain('_');
      expect(result.match?.games[0]?.player2.name).not.toContain('_');
    });

    test('should handle combined format with missing country codes', () => {
      const missingCountry = ` 5 point match

 Game 1
PlayerA : 0     PlayerB_(USA) : 0
 1) 31: 8/5 6/5                  42: 24/20 13/11
`;
      const result = parseJellyFishMatch(missingCountry);
      expect(result.success).toBe(true);
      expect(result.match?.games[0]?.player1.country).toBeUndefined();
      expect(result.match?.games[0]?.player2.country).toBe('USA');
    });

    test('should handle hyphenated player names', () => {
      const hyphenated = ` 5 point match

 Game 1
Van-Der-Berg_(NED) : 0     Kim-Yong_(KOR) : 0
 1) 31: 8/5 6/5                  42: 24/20 13/11
`;
      const result = parseJellyFishMatch(hyphenated);
      expect(result.success).toBe(true);
      expect(result.match?.games[0]?.player1.name).toBe('Van Der Berg');
      expect(result.match?.games[0]?.player2.name).toBe('Kim Yong');
    });

    test('should handle moves correctly after combined player line', () => {
      const result = parseJellyFishMatch(HARDY_FORMAT_MATCH);
      expect(result.success).toBe(true);
      expect(result.match?.games[0]?.moves.length).toBe(2);
      expect(result.match?.games[0]?.moves[0]?.player1Dice).toEqual([3, 1]);
    });

    test('should parse player scores in combined format', () => {
      const result = parseJellyFishMatch(HARDY_FORMAT_MATCH);
      expect(result.success).toBe(true);
      const game2 = result.match?.games[1];
      expect(game2?.player1.score).toBe(1);
      expect(game2?.player2.score).toBe(0);
    });
  });

  test.describe('enrichMatchMetadata', () => {
    test('should add filename to metadata', () => {
      const result = parseJellyFishMatch(MINIMAL_MATCH);
      expect(result.success).toBe(true);
      const enriched = enrichMatchMetadata(result.match!, 'tournament_match.mat', 'Hardy');
      expect(enriched.metadata.filename).toBe('tournament_match.mat');
    });

    test('should extract tournament name from filename', () => {
      const result = parseJellyFishMatch(MINIMAL_MATCH);
      expect(result.success).toBe(true);
      const enriched = enrichMatchMetadata(result.match!, 'WorldChampionship_player1-vs-player2.mat');
      expect(enriched.metadata.tournamentName).toBe('WorldChampionship');
    });

    test('should add source collection', () => {
      const result = parseJellyFishMatch(MINIMAL_MATCH);
      expect(result.success).toBe(true);
      const enriched = enrichMatchMetadata(result.match!, 'match.mat', 'BigBrother');
      expect(enriched.metadata.sourceCollection).toBe('BigBrother');
    });
  });

  test.describe('countExpectedPositions', () => {
    test('should count positions based on dice rolls', () => {
      const result = parseJellyFishMatch(MINIMAL_MATCH);
      expect(result.success).toBe(true);
      const count = countExpectedPositions(result.match!);
      // 1 move line × 2 dice rolls = 2 positions
      expect(count).toBe(2);
    });

    test('should count positions across multiple games', () => {
      const result = parseJellyFishMatch(SAMPLE_MATCH);
      expect(result.success).toBe(true);
      const count = countExpectedPositions(result.match!);
      // Game 1: 2 moves × 2 dice = 4
      // Game 2: 1 move × 2 dice = 2
      // Total: 6
      expect(count).toBe(6);
    });
  });
});

// =============================================================================
// REPLAY ENGINE TESTS
// =============================================================================

test.describe('Replay Engine', () => {
  test.describe('INITIAL_BOARD', () => {
    test('should have 26 positions (bar + 24 points + bar)', () => {
      expect(INITIAL_BOARD.length).toBe(26);
    });

    test('should have correct starting pip count for X', () => {
      const pipCount = calculatePipCount(INITIAL_BOARD, 'x');
      expect(pipCount).toBe(167); // Standard starting pip count
    });

    test('should have correct starting pip count for O', () => {
      const pipCount = calculatePipCount(INITIAL_BOARD, 'o');
      expect(pipCount).toBe(167); // Standard starting pip count
    });

    test('should have empty bars', () => {
      expect(INITIAL_BOARD[0]).toBe(0); // X bar
      expect(INITIAL_BOARD[25]).toBe(0); // O bar
    });
  });

  test.describe('cloneBoard', () => {
    test('should create independent copy', () => {
      const original = cloneBoard(INITIAL_BOARD);
      const clone = cloneBoard(original);
      clone[1] = 99;
      expect(original[1]).not.toBe(99);
    });
  });

  test.describe('calculatePipCount', () => {
    test('should calculate pip count after move', () => {
      const board = cloneBoard(INITIAL_BOARD);
      // Simulate X moving from point 8 to 5
      board[8] -= 1;
      board[5] += 1;
      const pipCount = calculatePipCount(board, 'x');
      expect(pipCount).toBe(167 - 3); // 3 pips closer
    });

    test('should include bar checkers in pip count', () => {
      const board = cloneBoard(INITIAL_BOARD);
      // Put X on bar
      board[0] = 1;
      board[6] -= 1;
      const pipCount = calculatePipCount(board, 'x');
      // Original: 167, minus 6 (from point 6), plus 25 (bar)
      expect(pipCount).toBe(167 - 6 + 25);
    });
  });

  test.describe('allInHomeBoard', () => {
    test('should return false for starting position', () => {
      expect(allInHomeBoard(INITIAL_BOARD, 'x')).toBe(false);
      expect(allInHomeBoard(INITIAL_BOARD, 'o')).toBe(false);
    });

    test('should return true when all checkers in home', () => {
      // Create a board with all X in home (points 1-6)
      const board: BoardState = Array(26).fill(0);
      board[1] = 5;
      board[2] = 5;
      board[3] = 5;
      expect(allInHomeBoard(board, 'x')).toBe(true);
    });

    test('should return false if checker on bar', () => {
      const board: BoardState = Array(26).fill(0);
      board[1] = 5;
      board[2] = 5;
      board[3] = 4;
      board[0] = 1; // One on bar
      expect(allInHomeBoard(board, 'x')).toBe(false);
    });
  });

  test.describe('applyMove', () => {
    test('should move checker from one point to another', () => {
      const board = cloneBoard(INITIAL_BOARD);
      const move: MoveNotation = { from: 8, to: 5, isHit: false };
      const result = applyMove(board, move, 'x');
      expect(result.error).toBeUndefined();
      expect(board[8]).toBe(2); // Was 3, now 2
      expect(board[5]).toBe(1); // Was 0, now 1
    });

    test('should handle bar entry for X', () => {
      const board = cloneBoard(INITIAL_BOARD);
      board[0] = 1; // X on bar (index 0 is X's bar)
      // In JellyFish, 25 means "bar" from player's perspective
      const move: MoveNotation = { from: 25, to: 20, isHit: false };
      const result = applyMove(board, move, 'x');
      expect(result.error).toBeUndefined();
      // After the move, X's bar (index 0) should be empty
      expect(board[0]).toBe(0);
      // X should now have a checker on point 20
      expect(board[20]).toBe(1);
    });

    test('should handle bearing off', () => {
      const board: BoardState = Array(26).fill(0);
      board[6] = 2; // X checkers on 6-point
      const move: MoveNotation = { from: 6, to: 0, isHit: false };
      const result = applyMove(board, move, 'x');
      expect(result.error).toBeUndefined();
      expect(board[6]).toBe(1); // One borne off
    });
  });

  test.describe('replayGame', () => {
    test('should produce positions for each dice roll', () => {
      const game: ParsedGame = {
        gameNumber: 1,
        player1: { name: 'Test1', score: 0 },
        player2: { name: 'Test2', score: 0 },
        moves: [
          {
            moveNumber: 1,
            player1Dice: [3, 1],
            player1Moves: [
              { from: 8, to: 5, isHit: false },
              { from: 6, to: 5, isHit: false },
            ],
            // O responds with 6-5: 24/18 13/8 (standard response)
            // From O's perspective: 24->18 = X's 1->7, 13->8 = X's 12->17
            player2Dice: [6, 5],
            player2Moves: [
              { from: 24, to: 18, isHit: false },
              { from: 13, to: 8, isHit: false },
            ],
          },
        ],
      };

      const result = replayGame(game);
      expect(result.positions.length).toBe(2); // Two positions (before each player's move)
      expect(result.errors.length).toBe(0);
    });

    test('should capture position BEFORE each move', () => {
      const game: ParsedGame = {
        gameNumber: 1,
        player1: { name: 'Test1', score: 0 },
        player2: { name: 'Test2', score: 0 },
        moves: [
          {
            moveNumber: 1,
            player1Dice: [3, 1],
            player1Moves: [
              { from: 8, to: 5, isHit: false },
              { from: 6, to: 5, isHit: false },
            ],
          },
        ],
      };

      const result = replayGame(game);
      // First position should be the opening position (before 3-1)
      const pos = result.positions[0];
      expect(pos.pipCountX).toBe(167); // Starting pip count
      expect(pos.dice).toEqual([3, 1]);
      expect(pos.player).toBe('x');
    });

    test('should set correct game and move numbers', () => {
      const game: ParsedGame = {
        gameNumber: 3,
        player1: { name: 'Test1', score: 0 },
        player2: { name: 'Test2', score: 0 },
        moves: [
          {
            moveNumber: 5,
            player1Dice: [6, 5],
            player1Moves: [{ from: 24, to: 13, isHit: false }],
          },
        ],
      };

      const result = replayGame(game);
      expect(result.positions[0].gameNumber).toBe(3);
      expect(result.positions[0].moveNumber).toBe(5);
    });
  });

  test.describe('generateAsciiBoard', () => {
    test('should generate valid ASCII representation', () => {
      const ascii = generateAsciiBoard(INITIAL_BOARD);
      expect(ascii).toContain('X'); // X checkers
      expect(ascii).toContain('O'); // O checkers
      expect(ascii).toContain('BAR'); // Bar separator
    });

    test('should include point numbers', () => {
      const ascii = generateAsciiBoard(INITIAL_BOARD);
      expect(ascii).toContain('13');
      expect(ascii).toContain('24');
      expect(ascii).toContain('12');
      expect(ascii).toContain('1');
    });
  });
});

// =============================================================================
// PHASE CLASSIFIER TESTS
// =============================================================================

test.describe('Phase Classifier', () => {
  test.describe('classifyPhase', () => {
    test('should classify move 1 as OPENING', () => {
      const position = {
        board: cloneBoard(INITIAL_BOARD),
        dice: [3, 1] as [number, number],
        player: 'x' as const,
        moveNumber: 1,
        gameNumber: 1,
        pipCountX: 167,
        pipCountO: 167,
      };

      const result = classifyPhase(position);
      expect(result.phase).toBe('OPENING');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('should classify move 2 as OPENING', () => {
      const position = {
        board: cloneBoard(INITIAL_BOARD),
        dice: [6, 5] as [number, number],
        player: 'o' as const,
        moveNumber: 2,
        gameNumber: 1,
        pipCountX: 164,
        pipCountO: 167,
      };

      const result = classifyPhase(position);
      expect(result.phase).toBe('OPENING');
    });

    test('should classify early moves with high pip count as EARLY', () => {
      const position = {
        board: cloneBoard(INITIAL_BOARD),
        dice: [4, 2] as [number, number],
        player: 'x' as const,
        moveNumber: 4,
        gameNumber: 1,
        pipCountX: 155,
        pipCountO: 160,
      };

      const result = classifyPhase(position);
      expect(result.phase).toBe('EARLY');
    });

    test('should classify later positions as MIDDLE', () => {
      const position = {
        board: cloneBoard(INITIAL_BOARD),
        dice: [5, 3] as [number, number],
        player: 'x' as const,
        moveNumber: 15,
        gameNumber: 1,
        pipCountX: 90,
        pipCountO: 95,
      };

      const result = classifyPhase(position);
      expect(result.phase).toBe('MIDDLE');
    });

    test('should classify bearoff position as BEAROFF', () => {
      // Create bearoff position - all X in home board
      const board: BoardState = Array(26).fill(0);
      board[1] = 3;
      board[2] = 3;
      board[3] = 3;
      board[4] = 3;
      board[5] = 2;
      board[6] = 1;

      const position = {
        board,
        dice: [6, 5] as [number, number],
        player: 'x' as const,
        moveNumber: 25,
        gameNumber: 1,
        pipCountX: 40,
        pipCountO: 50,
      };

      const result = classifyPhase(position);
      expect(result.phase).toBe('BEAROFF');
      expect(result.confidence).toBe(1.0);
    });
  });

  test.describe('isBearoffPosition', () => {
    test('should return false for starting position', () => {
      expect(isBearoffPosition(INITIAL_BOARD)).toBe(false);
    });

    test('should return true when X all in home', () => {
      const board: BoardState = Array(26).fill(0);
      board[1] = 5;
      board[2] = 5;
      board[3] = 5;
      expect(isBearoffPosition(board)).toBe(true);
    });
  });

  test.describe('isRacePosition', () => {
    test('should return false for starting position', () => {
      expect(isRacePosition(INITIAL_BOARD)).toBe(false);
    });

    test('should return true when sides disengaged', () => {
      // X in home, O in their home (X's outer)
      const board: BoardState = Array(26).fill(0);
      board[1] = 5;
      board[2] = 5;
      board[3] = 5;
      board[19] = -5;
      board[20] = -5;
      board[21] = -5;
      expect(isRacePosition(board)).toBe(true);
    });
  });

  test.describe('getPhaseDistribution', () => {
    test('should count positions by phase', () => {
      const positions = [
        { board: INITIAL_BOARD, dice: [3, 1] as [number, number], player: 'x' as const, moveNumber: 1, gameNumber: 1, pipCountX: 167, pipCountO: 167 },
        { board: INITIAL_BOARD, dice: [4, 2] as [number, number], player: 'o' as const, moveNumber: 1, gameNumber: 1, pipCountX: 164, pipCountO: 167 },
        { board: INITIAL_BOARD, dice: [6, 5] as [number, number], player: 'x' as const, moveNumber: 10, gameNumber: 1, pipCountX: 100, pipCountO: 105 },
      ];

      const distribution = getPhaseDistribution(positions);
      expect(distribution.OPENING).toBe(2);
      expect(distribution.MIDDLE).toBe(1);
    });
  });
});
