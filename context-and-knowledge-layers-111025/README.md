# Backgammon Guru Context & Knowledge Layers Export
**Export Date**: November 10, 2025

This export contains the context layers and knowledge files for the Backgammon Guru AI coaching system.

## Directory Structure

### `/layers` - Context Layers (Always-Loaded Foundational Knowledge)
Context layers are loaded into every AI prompt and define the coach's personality, teaching style, and core principles.

**Files (Priority-Ordered):**
1. `guru-definition-layer-identity-protocol.md` - Guru identity, protocol, and core behavior (4,062 chars)
2. `core-commandments-alwayson-heuristics.md` - Always-on heuristics and decision rules (912 chars)
3. `phase-modifiers-game-progression.md` - Game progression phase-specific guidance (1,439 chars)
4. `style-modifiers-player-approach.md` - Playing style adaptations (1,236 chars)

**Total**: 7,649 characters across 4 layers

**Characteristics:**
- Always included in AI prompts
- Priority-ordered (1 = highest priority, loaded first)
- Defines coaching personality and approach
- Layered architecture allows fine-grained control

---

### `/knowledge` - Knowledge Files (Conditionally-Loaded Reference Documents)
Knowledge files are detailed reference materials loaded only when relevant to the user's query.

**Files:**
- `backgammon_training_guide.md` - Full 20-module curriculum outline
- `module_01_basic_opening_rolls.md` - Detailed module 1 content with exercises
- `module_01_drills.json` - Structured drill data for module 1 (75KB, detailed position data)
- `DRILLING_MODE_RECOMMENDATIONS.md` - Implementation guide for drilling mode features
- `PHASE_1_IMPLEMENTATION_SPEC.md` - Technical implementation specification

**Characteristics:**
- Loaded conditionally based on query relevance
- Category-based organization
- Token-efficient (not in every prompt)
- Detailed reference materials

---

## Architecture Overview

### Context Layers
**Purpose**: Define the AI's behavior, personality, and foundational knowledge
**When to use**: Information needed for EVERY query
**Examples**:
- System instructions ("You are a backgammon coach...")
- Core principles and methodologies
- Teaching style and tone guidelines

### Knowledge Files
**Purpose**: Provide detailed reference information when needed
**When to use**: Detailed reference material relevant to specific queries
**Examples**:
- Training modules and detailed guides
- Exercise and drill collections
- Strategy references and examples

---

## Current Implementation Status

### Database Schema
- ✅ `ContextLayer` model (priority-ordered, always-loaded)
- ✅ `KnowledgeFile` model (category-based, conditionally-loaded)

### Features Implemented
- ✅ Multi-layer context composition
- ✅ Audit trail showing layers and files used
- ✅ Interactive audit trail (clickable layer/file references)
- ✅ Drill mode integration with actual context layers
- ✅ Separation of layers (behavior) from files (knowledge)

### Future Enhancements
- Semantic search for relevant knowledge files
- API endpoints for knowledge file CRUD
- Full content viewing/editing from audit trail
- Migration of drill JSON to database knowledge files

---

## Usage Notes

### For AI Prompting
1. **Always load** context layers first (defines coaching style)
2. **Conditionally load** relevant knowledge files based on query
3. **Reference both** in structured system prompts

### For Content Management
- Context layers should be concise and focused (avoid redundancy)
- Knowledge files can be extensive and detailed
- Category tagging helps with conditional loading
- Regular audits prevent layer bloat

---

## Version History
- **v1.0** (2025-11-10): Initial export with 4 context layers and 5 knowledge files
  - Context Layers: Guru definition, core commandments, phase modifiers, style modifiers
  - Knowledge Files: Training guide, module 1 content, drills, implementation docs
