# JellyFish Backgammon .txt/.mat Match Format Specification

**Research Date:** 2025-12-15
**Research Depth:** Focused Investigation

---

## Executive Summary

The JellyFish backgammon match format (.mat/.txt) is an ASCII text-based format originally developed by Fredrik Dahl for the JellyFish backgammon program (released 1994). While **not formally specified**, it has become a de facto standard for exchanging backgammon matches between programs. The format is widely supported by GNU Backgammon, Snowie, eXtremeGammon, BGBlitz, and other major backgammon software.

**Key Finding:** The format is not formally documented, and implementations often produce "minor discrepancies" that compliant software (like GNU Backgammon) attempts to handle automatically.

---

## 1. File Format Structure

### 1.1 Basic Structure

The .mat format is a plain ASCII text file with the following structure:

```
[Match Length Header]

Game [N]
[Player A Name] : [Score]
[Player B Name] : [Score]
[Move Notation Lines]

Game [N+1]
[Player A Name] : [Score]
[Player B Name] : [Score]
[Move Notation Lines]
...
```

### 1.2 Match Length Header

The first line specifies the match length:

```
 7 point match
```

**Important:** The format includes an empty space before the number to accommodate 2-digit match lengths (e.g., " 15 point match").

### 1.3 Game Headers

Each game within the match starts with:

```
Game 1
PlayerA : 0
PlayerB : 0
```

Or with nationality metadata:

```
Game 2
joe joe(JPN) : 0
John Doe(ITA) : 2
```

**Format:** `PlayerName(COUNTRY_CODE) : Score`

---

## 2. Move Notation Syntax

### 2.1 Basic Move Format

Moves are recorded in a two-column format on a single line:

```
1) 15: 24/23 13/8    54: 13/9 13/8
```

**Structure:**
- `1)` - Move number
- `15:` - Player A's dice roll (die1 concatenated with die2)
- `24/23 13/8` - Player A's moves (from/to notation)
- `54:` - Player B's dice roll (starts at column 35-40, typically position 35)
- `13/9 13/8` - Player B's moves

### 2.2 Point Numbering System

**Critical:** Points are numbered 1-24 **always from the perspective of the player on roll**.

- Points 1-24: Regular board points
- Point 25: The bar (for checkers that have been hit)
- Point 0: Bearing off (removing checkers from the board)

**Example Moves:**
- `8/5 6/5` - Roll 3-1, making the 5-point
- `24/21 13/11` - Opening roll 3-2
- `25/20` - Entering from the bar with a 5
- `6/0 5/0` - Bearing off with 6-5

### 2.3 JellyFish-Specific Notation Rules

The JellyFish .mat format has **strict requirements** that differ from other notation systems:

#### Rule 1: Bar Point Notation
**MUST use "25"** for the bar point (not "bar" or other designations)

```
25/20  ✓ Correct
bar/20 ✗ Wrong
```

#### Rule 2: Bearing Off Notation
**MUST use "0"** for bearing off (not "off" or "o")

```
6/0 5/0  ✓ Correct
6/off    ✗ Wrong
6/o 5/o  ✗ Wrong
```

#### Rule 3: No Shorthand for Multiple Moves
**CANNOT use (2) notation** for repeated moves. Each move must be written individually.

```
8/5 8/5  ✓ Correct
8/5(2)   ✗ Wrong
```

#### Rule 4: No Move Notation
When a player cannot move (e.g., on the bar and cannot enter), **no move is recorded** (the dice and move section is empty or omitted).

```
# Player on bar, cannot enter - no notation
# (Other systems might use "-" or "Dances")
```

### 2.4 Special Notations

**Hitting (Capturing):** Marked with an asterisk `*`

```
13/7*  # Move from 13 to 7 and hit opponent's checker
```

**Doubles:** Each of the four moves is written separately

```
33: 8/5 8/5 6/3 6/3
```

---

## 3. Dice Roll Representation

### 3.1 Format

Dice rolls are written as two digits concatenated (no separator):

```
15:  # Roll of 1 and 5
63:  # Roll of 6 and 3
33:  # Double 3s
```

**Note:** The order of the dice (higher first vs. lower first) varies by implementation, but the moves that follow clarify the actual roll.

### 3.2 Column Positioning

- **Player A's dice:** Appears after the move number (e.g., `1) 15:`)
- **Player B's dice:** Starts at **column position 35-40** (commonly 35)

This fixed positioning allows parsers to easily separate the two players' moves on the same line.

---

## 4. Metadata Encoding

### 4.1 Player Names

Player names appear in the game header:

```
PlayerName : Score
```

### 4.2 Nationality/Country Codes

Countries are encoded in parentheses after the player name:

```
joe joe(JPN) : 0
John Doe(ITA) : 2
```

**Format:** Three-letter country codes (ISO 3166-1 alpha-3 likely, though not explicitly documented)

### 4.3 Tournament Name

Based on research, tournament names are encoded in the **filename** rather than within the file content:

> "Each backgammon online match is automatically stored in a separate file with a 'mat' expansion. The name of a file contains match identifiers, tournament and nick names of both players."

**Example filename pattern:** `tournament-name_player1-vs-player2.mat`

### 4.4 Additional Metadata (GNU Backgammon)

GNU Backgammon allows entering additional metadata via **Match Information** dialog:
- Annotator name
- Date
- Locale
- Event/tournament name
- Round

However, the storage format for this metadata in .mat files is not documented in search results.

---

## 5. Board State Reconstruction

### 5.1 Initial Position

The standard backgammon starting position is assumed:

**Player A (moving from 24 to 1):**
- 2 checkers on point 24
- 5 checkers on point 13
- 3 checkers on point 8
- 5 checkers on point 6

**Player B (moving from 24 to 1 from their perspective):**
- Same setup, mirrored

### 5.2 Reconstruction Algorithm

To reconstruct board state from moves:

1. **Start with the initial position**
2. **For each move line:**
   - Parse Player A's dice and moves
   - Apply moves to Player A's checkers
   - Handle hits (move opponent to bar)
   - Parse Player B's dice and moves
   - Apply moves to Player B's checkers
   - Handle hits (move opponent to bar)
3. **Track score progression** from game headers
4. **Handle cube actions** (if recorded - format unclear from search results)

### 5.3 Move Validation

When applying moves:
- Verify the from-point contains a checker of the moving player
- Verify the to-point is legal (not blocked by 2+ opponent checkers)
- For bar moves (25/X), verify player has checker on bar
- For bear-off moves (X/0), verify all checkers are in home board

### 5.4 Limitations

The .mat format **does NOT store:**
- Analysis results (use .sgf format for GNU Backgammon analysis)
- Cube actions explicitly (may be inferred or stored in variant syntax)
- Board state checksums (must be reconstructed from moves)
- Timestamps for individual moves
- Opening roll determination (who goes first)

---

## 6. File Format Variants

### 6.1 .mat vs .txt vs .gam

- **.mat** - JellyFish Match format (stores entire match)
- **.txt** - Often used interchangeably with .mat, or refers to "Snowie Standard Text"
- **.gam** - JellyFish Game format (stores a single game instead of full match)

**Note:** ".gam files are basically the same as a .mat file. The difference is that a .gam stores a game instead of a full match."

### 6.2 Snowie Standard Text

"Snowie Standard Text" is an **extension of the JellyFish .mat format**:
- Can be imported using .mat importers
- Saved as 40 semicolon-separated values
- Does NOT save positions at Take/Pass points, only at Double/No Double points

**Important distinction:** "Snowie .txt position" (for single positions) is different from "Snowie Standard Text" (for matches).

### 6.3 JellyFish .pos Format

The .pos format is for **single positions** (not matches):
- Does not save analysis
- Format documented on the original JellyFish website (no longer accessible)
- Supported by GNU Backgammon for import/export

---

## 7. Compatibility and Interoperability

### 7.1 Software Support

The JellyFish .mat format is supported by:
- **GNU Backgammon** (import/export)
- **eXtremeGammon** (import/export)
- **Snowie** (import/export)
- **BGBlitz** (can convert other formats to .mat)
- **JellyFish** (native format)
- **GreedyGammon** (can load .mat files)
- **PartyGammon** (via conversion)
- **GamesGrid** (via BGBlitz conversion)

### 7.2 Known Compatibility Issues

- **Not formally defined:** Different software may produce "minor discrepancies"
- **Multiple matches in one file:** Some programs (e.g., BBGT) write multiple matches to the same .mat file, but GNU Backgammon only reads the first one
- **Column positioning:** Player B's moves may start at column 35 or 40 depending on implementation
- **Metadata fields:** Additional metadata may not transfer between programs

---

## 8. Example Match File

```
 7 point match

Game 1
John Smith(USA) : 0
Jane Doe(GBR) : 0
 1) 31: 8/5 6/5                42: 24/20 13/11
 2) 53: 24/16                  65: 24/18 13/8
 3) 22: 16/14(2) 6/4(2)        61: 8/2 6/5
 4) 64: 24/14                  43: 18/14 6/3
 5) 11: 5/4(2) 14/13(2)        55: 14/9(2) 6/1(2)

Game 2
John Smith(USA) : 0
Jane Doe(GBR) : 1
 1) 42: 8/4 6/4                31: 8/5 6/5
 2) 63: 24/15                  54: 24/20 13/8
 ...
```

**Note:** This is a simplified example. Real match files would include more games and potentially different formatting variations.

---

## 9. Research Gaps and Limitations

### 9.1 Missing Information

Despite thorough searching, the following details were **NOT found**:
1. **Cube action notation** - How doubling, accepting/passing are recorded
2. **Crawford game indication** - How the Crawford rule is marked
3. **Resignation notation** - How wins by resignation are recorded
4. **Match winner indication** - End-of-match marker format
5. **Opening roll determination** - How the initial roll for first move is recorded
6. **Exact column positions** - Precise spacing requirements for parsing
7. **Comment/annotation syntax** - If inline comments are supported
8. **Beaver/Raccoon notation** - Advanced cube rules

### 9.2 Format Specification Status

The format is **not formally specified**. According to GNU Backgammon documentation:

> "Jellyfish Match is not formally defined and software exporting matches to this format often produce minor discrepancies. GNU Backgammon tries to cater to most of them automatically."

The original JellyFish website (which may have had specification documentation) is no longer accessible.

---

## 10. Practical Recommendations

### 10.1 For Parsing .mat Files

1. **Use existing libraries** when possible (GNU Backgammon source code, BGBlitz)
2. **Be flexible with whitespace** - column positions may vary
3. **Validate moves** against board state to catch parsing errors
4. **Handle missing moves** gracefully (when player cannot move)
5. **Test with multiple .mat sources** due to format variations

### 10.2 For Generating .mat Files

1. **Follow JellyFish-specific rules** (25 for bar, 0 for off, no shorthand)
2. **Use fixed column positions** (Player B at column 35 is safest)
3. **Include nationality codes** for better compatibility
4. **Validate output** by importing into GNU Backgammon or eXtremeGammon
5. **Keep metadata in filename** if unsure about in-file format

### 10.3 For Research/Analysis

1. **Convert to .sgf for analysis** - GNU Backgammon's native format stores analysis
2. **Use Hardy's matches** - hardyhuebener.de has a large archive in .txt format
3. **Cross-reference formats** - Compare .mat exports from different programs to understand variations

---

## 11. Sources and References

### Primary Sources

- **GNU Backgammon Manual** - Official documentation for .mat import/export
- **Hardy's Backgammon Pages** - Extensive match archive and notation guide (www.hardyhuebener.de)
- **Backgammon notation Wikipedia** - History and standardization

### Sample Match Archives

- Hardy's Backgammon Pages: https://www.hardyhuebener.de/engl/matches.html
  - "All matches are in the .txt-format (Jelly Fish™), which can also be imported by GNU Backgammon, eXtremeGammon and Snowie™"

### Conversion Tools

- GNU Backgammon: http://www.gnubg.org/
- Michael Petch's XG Data Tools: http://vcs.capp-sysware.com/gitweb/?p=backgammon/xgdatatools.git
- Google Drive conversion tools: https://drive.google.com/drive/folders/0B7L6em2ChhMOZmpxYmtrTE5aUlU

---

## 12. Historical Context

### JellyFish Software

- **Developer:** Fredrik Dahl
- **Release:** 1994
- **Significance:** First commercially available backgammon software using neural networks
- **Performance:** Approached or surpassed best human players
- **Training:** Used self-play to develop neural network weights (similar to TD-Gammon)
- **Platform:** Windows PC
- **Latest Version:** JellyFish 3.5 (Tutor version includes move evaluation and commentary)

The JellyFish .mat format emerged as a standard because JellyFish was one of the first powerful computer backgammon programs, and its file format was adopted by subsequent software for compatibility.

---

## Appendix: Quick Reference

### Notation Summary Table

| Element | JellyFish .mat Format | Alternative Formats |
|---------|----------------------|---------------------|
| Bar point | `25` | `bar` |
| Bear off | `0` | `off`, `o` |
| Multiple moves | `8/5 8/5` | `8/5(2)` |
| Hit | `13/7*` | Same |
| Dice roll | `42:` (concatenated) | `4-2:` (hyphenated) |
| No move | (empty/omitted) | `-`, `Dances` |
| Move separator | `/` | Same |
| Points | 1-24 (player perspective) | Same |

### File Structure Template

```
[SPACE]N point match

Game 1
PlayerName1(XXX) : Score1
PlayerName2(XXX) : Score2
 M) DD: from/to from/to    DD: from/to from/to
 ...

Game 2
PlayerName1(XXX) : Score1
PlayerName2(XXX) : Score2
 M) DD: from/to from/to    DD: from/to from/to
 ...
```

**Legend:**
- `[SPACE]` - Leading space for alignment
- `N` - Match length (e.g., 7, 11, 15)
- `XXX` - Three-letter country code
- `M` - Move number
- `DD` - Dice roll (two digits)
- `from/to` - Move notation (point numbers)
