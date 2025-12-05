To use the MCP server with Claude, you must add the server to the Claude configuration file, typically located at `~/.claude/claude-config.json`. You can add a new entry under the `mcpServers` section. Here is an example configuration:

This command adds a new MCP server named `backgammon-plays` using the HTTP transport method. The server URL is set to `https://gnubg-mcp-d1c3c7a814e8.herokuapp.com/mcp`. You can replace `backgammon-plays` with any name you prefer for the server.
```bash
claude mcp add --transport http --scope user backgammon-plays "https://gnubg-mcp-d1c3c7a814e8.herokuapp.com/mcp"
```

Afterwards, you can start claude and use the MCP server for backgammon plays.

In a claude session

q: > what tools are available for the backgammon-plays mcp server
a:  I can see the available backgammon-plays MCP server tools from the function definitions. Here are the tools:

1. mcp__backgammon-plays__plays - Get backgammon plays and their scores for a given position and dice throw
   - Parameters: board configuration, dice roll, player, scoring options
2. mcp__backgammon-plays__opening - Get backgammon plays and their scores for the opening position
   - Parameters: die1, die2, optional max number of plays
3. mcp__backgammon-plays__test-opening - Test function for opening plays
   - No parameters required
4. mcp__backgammon-plays__get_session - Get the session ID and context
   - No parameters required

These tools allow you to analyze backgammon positions, get optimal moves, and work with game sessions.

---------------
q:> If I throw a 3 and a 4, what are the scores for different opening plays use backgammon-plays mcp server
a: For a 3-4 opening roll, here are the top backgammon plays with their evaluations:

Best plays:

1. 24/21, 13/9 (equity: +0.007) - Move from 24-point to 21-point and 13-point to 9-point
2. 13/10, 13/9 (equity: +0.006) - Split the 13-point, moving to 10-point and 9-point
3. 13/10, 24/20 (equity: +0.005) - Move from 13-point to 10-point and 24-point to 20-point

Notable alternatives:
- 24/21, 24/20 (equity: -0.008) - Running both back checkers
- 8/5, 13/9 (equity: -0.051) - Building the 5-point
- 13/10, 10/6 (equity: -0.058) - Making the 10-point

The top three plays are very close in evaluation (within 0.002 equity), making them essentially equivalent. The classic 24/21,
13/9 play is slightly favored, bringing a back checker to safety while making a good building move.

---------------

A board for plays looks like the following:
```json
{
  "board": {
    "o": {
      "6": 5,
      "8": 3,
      "13": 5,
      "24": 2
    },
    "x": {
      "6": 5,
      "8": 3,
      "13": 5,
      "24": 2
    }
  },
  "cubeful": false,
  "dice": [3, 1],
  "max-moves": 2,
  "player": "x",
  "score-moves": true
}
```
If max-moves is omitted, all possible moves are returned.

A Claude request should include the board layout.

---------------
The same server will work with a direct API call. Here is an example of how to call the API directly using curl:

```bash
curl -L -X POST 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com/plays' \
-H 'accept: application/json' \
-H 'Content-Type: application/json' \
--data-raw '{
  "board": {
    "o": {
      "6": 5,
      "8": 3,
      "13": 5,
      "24": 2
    },
    "x": {
      "6": 5,
      "8": 3,
      "13": 5,
      "24": 2
    }
  },
  "cubeful": false,
  "dice": [3, 1],
  "max-moves": 2,
  "player": "x",
  "score-moves": true
}'
```
