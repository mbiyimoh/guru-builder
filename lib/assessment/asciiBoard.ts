// lib/assessment/asciiBoard.ts

/**
 * Render backgammon opening position as ASCII art
 */
export function renderOpeningBoard(diceRoll: [number, number]): string {
  const lines: string[] = [
    '┌────────────────────────────────────────┐',
    '│   BACKGAMMON OPENING POSITION          │',
    '├────────────────────────────────────────┤',
    '│  13 14 15 16 17 18   19 20 21 22 23 24 │',
    '│  ○○ .  .  .  ●  .  │  ●  .  .  .  .  ○○ │',
    '│  ○○          ●     │  ●              ○○ │',
    '│  ○○          ●     │  ●                 │',
    '│  ○○          ●     │  ●                 │',
    '│  ○○          ●     │  ●                 │',
    '├────────────────────────────────────────┤',
    '│  12 11 10  9  8  7    6  5  4  3  2  1 │',
    '│  ●● .  .  .  ○○ .  │  ○○ .  .  .  .  ●● │',
    '│  ●●          ○○    │  ○○              ●● │',
    '│  ●●          ○○    │  ○○                 │',
    '│  ●●          ○○    │  ○○                 │',
    '│  ●●          ○○    │  ○○                 │',
    '└────────────────────────────────────────┘',
    '',
    `BLACK (●) to play: ${diceRoll[0]}-${diceRoll[1]}`,
    '',
    'What is the best move?',
  ]

  return lines.join('\n')
}
