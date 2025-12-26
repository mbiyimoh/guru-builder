/**
 * Simple MCP test - just make one plays call
 */

const ENGINE_URL = 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com';

async function main() {
  console.log('Testing MCP connection to GNUBG engine...');
  console.log(`Engine URL: ${ENGINE_URL}\n`);

  // Step 1: Initialize session
  console.log('Step 1: Initializing session...');
  const initResponse = await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    })
  });

  if (!initResponse.ok) {
    throw new Error(`Init failed: ${initResponse.status}`);
  }

  const sessionId = initResponse.headers.get('Mcp-Session-Id');
  console.log(`Session ID: ${sessionId}`);

  const initResult = await initResponse.json();
  console.log('Init response:', JSON.stringify(initResult, null, 2));

  // Step 2: Send initialized notification
  console.log('\nStep 2: Sending initialized notification...');
  await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId!
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    })
  });
  console.log('Notification sent.');

  // Step 3: Test opening move query (simpler than plays)
  console.log('\nStep 3: Testing opening move query (3-1)...');
  const openingResponse = await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId!
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'opening',
        arguments: {
          die1: 3,
          die2: 1,
          max: 3
        }
      }
    })
  });

  if (!openingResponse.ok) {
    throw new Error(`Opening query failed: ${openingResponse.status}`);
  }

  const openingResult = await openingResponse.json();
  console.log('Opening result:', JSON.stringify(openingResult, null, 2));

  // Step 4: Test plays query (like used in self-play)
  console.log('\nStep 4: Testing plays query with board position...');
  const playsResponse = await fetch(`${ENGINE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId!
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'plays',
        arguments: {
          board: {
            board: {
              x: { '6': 5, '8': 3, '13': 5, '24': 2 },
              o: { '1': 2, '12': 5, '17': 3, '19': 5 }
            },
            cubeful: false,
            dice: [4, 2],
            player: 'x',
            'max-moves': 3,
            'score-moves': true
          }
        }
      }
    })
  });

  if (!playsResponse.ok) {
    const errorText = await playsResponse.text();
    throw new Error(`Plays query failed: ${playsResponse.status} - ${errorText}`);
  }

  const playsResult = await playsResponse.json();
  console.log('Plays result:', JSON.stringify(playsResult, null, 2));

  console.log('\n=== All tests passed! ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
