/**
 * Test running a single self-play game directly
 */

import { simulateSingleGame } from '../lib/positionLibrary/selfPlayGenerator';
import type { GroundTruthConfig } from '../lib/groundTruth/types';

const engineConfig: GroundTruthConfig = {
  enabled: true,
  engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
  engineId: 'gnubg-engine',
  engineName: 'GNU Backgammon',
  domain: 'backgammon',
  configId: '',
};

async function main() {
  console.log('Testing single game simulation...\n');
  console.log(`Engine URL: ${engineConfig.engineUrl}`);
  console.log(`Skip opening: true\n`);

  try {
    console.log('Starting game simulation...');
    const startTime = Date.now();

    const result = await simulateSingleGame(engineConfig, 1, true);

    const elapsed = Date.now() - startTime;
    console.log(`\n=== Game Complete ===`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Positions collected: ${result.positions.length}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors:`);
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (result.positions.length > 0) {
      console.log(`\nSample position:`);
      const pos = result.positions[0];
      console.log(`  Phase: ${pos.gamePhase}`);
      console.log(`  Dice: ${pos.diceRoll}`);
      console.log(`  Best move: ${pos.bestMove}`);
      console.log(`  Equity: ${pos.bestMoveEquity}`);
    }

    console.log('\n=== Test passed! ===');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
