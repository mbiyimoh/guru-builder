/**
 * Direct Self-Play Position Generator
 *
 * Bypasses Inngest and runs self-play simulation directly.
 * Usage: npx tsx scripts/run-self-play-direct.ts [gamesCount]
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { runSelfPlayBatch, type SelfPlayConfig, type GeneratedPosition } from '../lib/positionLibrary/selfPlayGenerator';
import type { GroundTruthConfig } from '../lib/groundTruth/types';

const prisma = new PrismaClient();

async function main() {
  try {
    const gamesCount = parseInt(process.argv[2]) || 5;
    const skipOpening = true;

    console.log(`\n=== Direct Self-Play Generator ===`);
    console.log(`Games to simulate: ${gamesCount}`);
    console.log(`Skip opening positions: ${skipOpening}`);

    // Get engine config
    const engine = await prisma.groundTruthEngine.findFirst({
      where: { id: 'gnubg-engine' }
    });

    if (!engine) {
      throw new Error('GNUBG engine not found in database');
    }

    console.log(`Engine URL: ${engine.engineUrl}`);
    console.log(`Engine active: ${engine.isActive}\n`);

    if (!engine.isActive) {
      throw new Error('Engine is not active');
    }

    const engineConfig: GroundTruthConfig = {
      enabled: true,
      engineUrl: engine.engineUrl,
      engineId: engine.id,
      engineName: engine.name,
      domain: engine.domain,
      configId: '',
    };

    // Create batch record
    const batch = await prisma.selfPlayBatch.create({
      data: {
        engineId: engine.id,
        gamesRequested: gamesCount,
        skipOpening,
        status: 'RUNNING',
        startedAt: new Date(),
      }
    });

    console.log(`Created batch: ${batch.id}`);
    console.log(`Starting simulation...\n`);

    // Run the simulation with progress tracking
    const config: SelfPlayConfig = {
      gamesCount,
      skipOpening,
      engineConfig,
      batchId: batch.id,
      onProgress: async (progress) => {
        console.log(
          `Game ${progress.gamesCompleted}/${progress.gamesTotal} | ` +
          `Positions: ${progress.positionsStored} | ` +
          `Duplicates skipped: ${progress.duplicatesSkipped}`
        );

        // Update database every 5 games
        if (progress.gamesCompleted % 5 === 0 || progress.gamesCompleted === gamesCount) {
          await prisma.selfPlayBatch.update({
            where: { id: batch.id },
            data: {
              gamesCompleted: progress.gamesCompleted,
              positionsStored: progress.positionsStored,
              duplicatesSkipped: progress.duplicatesSkipped,
            },
          });
        }
      },
    };

    const result = await runSelfPlayBatch(config);

    console.log(`\n=== Simulation Complete ===`);
    console.log(`Games played: ${result.gamesPlayed}`);
    console.log(`Positions collected: ${result.positions.length}`);
    console.log(`Duplicates (within batch): ${result.duplicatesSkipped}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors encountered:`);
      result.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`);
      }
    }

    // Filter against existing positions in database
    console.log(`\nFiltering against existing positions...`);
    const positionIds = result.positions.map(p => p.positionId);
    const existingPositions = await prisma.positionLibrary.findMany({
      where: { positionId: { in: positionIds } },
      select: { positionId: true },
    });

    const existingIds = new Set(existingPositions.map(p => p.positionId));
    const newPositions = result.positions.filter(p => !existingIds.has(p.positionId));

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
          data: posBatch.map(pos => ({
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

      // Mark batch complete
      await prisma.selfPlayBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: stored,
          duplicatesSkipped: result.duplicatesSkipped + (result.positions.length - newPositions.length),
          openingCount: byPhase.OPENING,
          earlyCount: byPhase.EARLY,
          middleCount: byPhase.MIDDLE,
          bearoffCount: byPhase.BEAROFF,
          errors: result.errors,
          completedAt: new Date(),
        },
      });
    } else {
      // Mark batch complete with no new positions
      await prisma.selfPlayBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: 0,
          duplicatesSkipped: result.positions.length,
          errors: result.errors,
          completedAt: new Date(),
        },
      });
    }

    // Final stats
    const totalPositions = await prisma.positionLibrary.count();
    const selfPlayPositions = await prisma.positionLibrary.count({
      where: { sourceType: 'SELF_PLAY' }
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
