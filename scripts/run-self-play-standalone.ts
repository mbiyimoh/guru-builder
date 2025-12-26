/**
 * Standalone Self-Play Position Generator
 *
 * Doesn't use the mcpClient module - implements MCP calls directly.
 * This avoids any session caching issues.
 */

import { PrismaClient, Prisma, type GamePhase } from '@prisma/client';
import {
  INITIAL_BOARD,
  cloneBoard,
  calculatePipCount,
  countCheckers,
  generateAsciiBoard,
  generatePositionIdFromBoard,
  boardStateToMCPFormat,
} from '../lib/matchImport/replayEngine';
import { classifyPhase } from '../lib/matchImport/phaseClassifier';
import type { BoardState, ReplayedPosition } from '../lib/matchImport/types';

const prisma = new PrismaClient();
const ENGINE_URL = 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com';

interface MoveResult {
  play: Array<{ from: string; to: string }>;
  evaluation: {
    eq: number;
    diff: number;
    probability?: {
      win: number;
      winG: number;
      winBG: number;
      lose: number;
      loseG: number;
      loseBG: number;
    };
  };
}

interface GeneratedPosition {
  positionId: string;
  gamePhase: GamePhase;
  diceRoll: string;
  board: BoardState;
  player: 'x' | 'o';
  bestMove: string;
  bestMoveEquity: number;
  secondBestMove?: string;
  secondEquity?: number;
  thirdBestMove?: string;
  thirdEquity?: number;
  probabilityBreakdown?: {
    best?: MoveResult['evaluation']['probability'];
    second?: MoveResult['evaluation']['probability'];
    third?: MoveResult['evaluation']['probability'];
  };
  asciiBoard: string;
  gameNumber: number;
  moveNumber: number;
}

// ============================================================================
// DIRECT MCP COMMUNICATION
// ============================================================================

let sessionId: string | null = null;

async function initMCPSession(): Promise<string> {
  if (sessionId) return sessionId;

  console.log('  Initializing MCP session...');
  const response = await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'self-play-generator', version: '1.0.0' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP init failed: ${response.status}`);
  }

  sessionId = response.headers.get('Mcp-Session-Id');
  if (!sessionId) throw new Error('No session ID received');

  // Send initialized notification
  await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  console.log(`  Session initialized: ${sessionId}`);
  return sessionId;
}

async function getPlays(
  board: BoardState,
  dice: [number, number],
  player: 'x' | 'o'
): Promise<MoveResult[]> {
  const session = await initMCPSession();

  const boardPos = boardStateToMCPFormat(board);
  const requestBody = {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 10000),
    method: 'tools/call',
    params: {
      name: 'plays',
      arguments: {
        board: {
          board: boardPos,
          cubeful: false,
          dice: dice,
          player: player,
          'max-moves': 3,
          'score-moves': true,
        },
      },
    },
  };

  const response = await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': session,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Plays call failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`);
  }

  if (!result.result?.content?.[0]?.text) {
    throw new Error('Empty response from engine');
  }

  return JSON.parse(result.result.content[0].text);
}

// ============================================================================
// GAME LOGIC
// ============================================================================

function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return [die1, die2];
}

function formatDiceRoll(dice: [number, number]): string {
  const [d1, d2] = dice;
  return d1 >= d2 ? `${d1}-${d2}` : `${d2}-${d1}`;
}

function formatMove(play: Array<{ from: string; to: string }>): string {
  return play.map((p) => `${p.from}/${p.to}`).join(' ');
}

function isGameOver(board: BoardState): { over: boolean; winner?: 'x' | 'o' } {
  const xCheckers = countCheckers(board, 'x');
  const oCheckers = countCheckers(board, 'o');

  if (xCheckers === 0) return { over: true, winner: 'x' };
  if (oCheckers === 0) return { over: true, winner: 'o' };

  return { over: false };
}

function applyMove(
  board: BoardState,
  play: Array<{ from: string; to: string }>,
  player: 'x' | 'o'
): BoardState {
  const newBoard = cloneBoard(board);

  for (const move of play) {
    if (player === 'x') {
      const from = move.from === 'bar' ? 0 : parseInt(move.from);
      const to = move.to === 'off' ? -1 : parseInt(move.to);

      if (from === 0) {
        newBoard[0]--;
      } else {
        newBoard[from]--;
      }

      if (to !== -1) {
        if (newBoard[to] === -1) {
          newBoard[to] = 1;
          newBoard[25]--;
        } else {
          newBoard[to]++;
        }
      }
    } else {
      const fromO = move.from === 'bar' ? 'bar' : parseInt(move.from);
      const toO = move.to === 'off' ? 'off' : parseInt(move.to);

      const from = fromO === 'bar' ? 25 : 25 - fromO;
      const to = toO === 'off' ? -1 : 25 - toO;

      if (from === 25) {
        newBoard[25]++;
      } else {
        newBoard[from]++;
      }

      if (to !== -1) {
        if (newBoard[to] === 1) {
          newBoard[to] = -1;
          newBoard[0]++;
        } else {
          newBoard[to]--;
        }
      }
    }
  }

  return newBoard;
}

// ============================================================================
// GAME SIMULATION
// ============================================================================

async function simulateGame(
  gameNumber: number,
  skipOpening: boolean
): Promise<{ positions: GeneratedPosition[]; errors: string[] }> {
  const positions: GeneratedPosition[] = [];
  const errors: string[] = [];

  let board = cloneBoard(INITIAL_BOARD);
  let moveNumber = 0;
  let player: 'x' | 'o' = 'x';
  const MAX_MOVES = 200;

  while (moveNumber < MAX_MOVES) {
    const gameStatus = isGameOver(board);
    if (gameStatus.over) break;

    const dice = rollDice();
    moveNumber++;

    try {
      const moves = await getPlays(board, dice, player);

      if (moves.length === 0) {
        player = player === 'x' ? 'o' : 'x';
        continue;
      }

      const bestMove = moves[0];
      const secondBest = moves[1];
      const thirdBest = moves[2];

      // Classify phase
      const replayedPos: ReplayedPosition = {
        board: cloneBoard(board),
        dice: dice,
        player: player,
        moveNumber: moveNumber,
        gameNumber: gameNumber,
        pipCountX: calculatePipCount(board, 'x'),
        pipCountO: calculatePipCount(board, 'o'),
      };
      const phase = classifyPhase(replayedPos);

      const shouldStore = !skipOpening || phase.phase !== 'OPENING';

      if (shouldStore) {
        const positionId = generatePositionIdFromBoard(board, dice, player);

        positions.push({
          positionId,
          gamePhase: phase.phase as GamePhase,
          diceRoll: formatDiceRoll(dice),
          board: cloneBoard(board),
          player,
          bestMove: formatMove(bestMove.play),
          bestMoveEquity: bestMove.evaluation.eq,
          secondBestMove: secondBest ? formatMove(secondBest.play) : undefined,
          secondEquity: secondBest?.evaluation.eq,
          thirdBestMove: thirdBest ? formatMove(thirdBest.play) : undefined,
          thirdEquity: thirdBest?.evaluation.eq,
          probabilityBreakdown: {
            best: bestMove.evaluation.probability,
            second: secondBest?.evaluation.probability,
            third: thirdBest?.evaluation.probability,
          },
          asciiBoard: generateAsciiBoard(board),
          gameNumber,
          moveNumber,
        });
      }

      board = applyMove(board, bestMove.play, player);
      player = player === 'x' ? 'o' : 'x';
    } catch (error) {
      errors.push(
        `Game ${gameNumber}, Move ${moveNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
      player = player === 'x' ? 'o' : 'x';
    }
  }

  return { positions, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const gamesCount = parseInt(process.argv[2]) || 5;
    const skipOpening = true;

    console.log(`\n=== Standalone Self-Play Generator ===`);
    console.log(`Engine URL: ${ENGINE_URL}`);
    console.log(`Games to simulate: ${gamesCount}`);
    console.log(`Skip opening positions: ${skipOpening}\n`);

    // Get engine record
    const engine = await prisma.groundTruthEngine.findFirst({
      where: { id: 'gnubg-engine' },
    });

    if (!engine) throw new Error('GNUBG engine not found');

    // Create batch
    const batch = await prisma.selfPlayBatch.create({
      data: {
        engineId: engine.id,
        gamesRequested: gamesCount,
        skipOpening,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    console.log(`Created batch: ${batch.id}\n`);

    const allPositions: GeneratedPosition[] = [];
    const allErrors: string[] = [];
    const seenIds = new Set<string>();
    let duplicatesSkipped = 0;

    for (let gameNum = 1; gameNum <= gamesCount; gameNum++) {
      console.log(`\nGame ${gameNum}/${gamesCount}...`);
      const startTime = Date.now();

      const gameResult = await simulateGame(gameNum, skipOpening);
      const elapsed = Date.now() - startTime;

      // Deduplicate
      for (const pos of gameResult.positions) {
        if (seenIds.has(pos.positionId)) {
          duplicatesSkipped++;
        } else {
          seenIds.add(pos.positionId);
          allPositions.push(pos);
        }
      }

      allErrors.push(...gameResult.errors);

      console.log(
        `  Completed in ${elapsed}ms | Positions: ${gameResult.positions.length} | ` +
          `Total unique: ${allPositions.length} | Errors: ${gameResult.errors.length}`
      );

      // Update batch
      await prisma.selfPlayBatch.update({
        where: { id: batch.id },
        data: {
          gamesCompleted: gameNum,
          positionsStored: allPositions.length,
          duplicatesSkipped,
        },
      });
    }

    console.log(`\n=== Simulation Complete ===`);
    console.log(`Games played: ${gamesCount}`);
    console.log(`Unique positions: ${allPositions.length}`);
    console.log(`Duplicates skipped: ${duplicatesSkipped}`);
    console.log(`Errors: ${allErrors.length}`);

    // Filter against existing
    console.log(`\nFiltering against existing positions...`);
    const positionIds = allPositions.map((p) => p.positionId);
    const existingPositions = await prisma.positionLibrary.findMany({
      where: { positionId: { in: positionIds } },
      select: { positionId: true },
    });

    const existingIds = new Set(existingPositions.map((p) => p.positionId));
    const newPositions = allPositions.filter((p) => !existingIds.has(p.positionId));

    console.log(`Already in database: ${existingIds.size}`);
    console.log(`New positions to store: ${newPositions.length}`);

    // Store new positions
    if (newPositions.length > 0) {
      console.log(`\nStoring positions...`);

      const byPhase: Record<string, number> = { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 };
      const BATCH_SIZE = 50;
      let stored = 0;

      for (let i = 0; i < newPositions.length; i += BATCH_SIZE) {
        const posBatch = newPositions.slice(i, i + BATCH_SIZE);

        await prisma.positionLibrary.createMany({
          data: posBatch.map((pos) => ({
            positionId: pos.positionId,
            gamePhase: pos.gamePhase,
            diceRoll: pos.diceRoll,
            bestMove: pos.bestMove,
            bestMoveEquity: pos.bestMoveEquity,
            secondBestMove: pos.secondBestMove,
            secondEquity: pos.secondEquity,
            thirdBestMove: pos.thirdBestMove,
            thirdEquity: pos.thirdEquity,
            probabilityBreakdown: pos.probabilityBreakdown as Prisma.InputJsonValue,
            asciiBoard: pos.asciiBoard,
            sourceType: 'SELF_PLAY',
            engineId: engine.id,
            selfPlayBatchId: batch.id,
            selfPlayGameNum: pos.gameNumber,
            selfPlayMoveNum: pos.moveNumber,
          })),
          skipDuplicates: true,
        });

        for (const pos of posBatch) {
          byPhase[pos.gamePhase]++;
        }

        stored += posBatch.length;
        console.log(`  Stored ${stored}/${newPositions.length}...`);
      }

      console.log(`\nPositions by phase:`);
      console.log(`  OPENING: ${byPhase.OPENING}`);
      console.log(`  EARLY: ${byPhase.EARLY}`);
      console.log(`  MIDDLE: ${byPhase.MIDDLE}`);
      console.log(`  BEAROFF: ${byPhase.BEAROFF}`);

      await prisma.selfPlayBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: stored,
          duplicatesSkipped: duplicatesSkipped + (allPositions.length - newPositions.length),
          openingCount: byPhase.OPENING,
          earlyCount: byPhase.EARLY,
          middleCount: byPhase.MIDDLE,
          bearoffCount: byPhase.BEAROFF,
          errors: allErrors,
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.selfPlayBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: 0,
          duplicatesSkipped: allPositions.length,
          errors: allErrors,
          completedAt: new Date(),
        },
      });
    }

    // Final stats
    const totalPositions = await prisma.positionLibrary.count();
    const selfPlayPositions = await prisma.positionLibrary.count({
      where: { sourceType: 'SELF_PLAY' },
    });

    console.log(`\n=== Final Position Library Stats ===`);
    console.log(`Total positions: ${totalPositions}`);
    console.log(`Self-play positions: ${selfPlayPositions}`);
    console.log(`\nDone!`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
