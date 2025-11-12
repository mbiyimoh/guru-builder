# Guru Builder System - Implementation Package

**Complete Standalone Package for Implementing the Guru Builder MVP**

This directory contains everything needed to implement the Guru Builder system from scratch in a brand new directory, with no dependencies on the existing backgammon-guru codebase.

---

## 🎯 Project Overview

**What is Guru Builder?**

A multi-project platform that allows users to create AI teaching assistants (gurus) for any game/domain through:
- Initial corpus creation (context layers + knowledge files)
- Autonomous research runs that analyze external sources
- AI-generated structured recommendations for corpus improvements
- Human-in-the-loop approval workflow
- Automated application of approved changes

**Core User Flow**:
```
Create Project → Add Initial Corpus → Configure Research Run →
System Researches & Analyzes → Review Recommendations →
Approve/Reject → Apply Changes → Iterate
```

---

## 📚 Documentation Structure

This package contains 5 key documents in order of importance:

### 1. **START HERE** → `00-IMPLEMENTATION-GUIDE.md` (this file)
   - Project orientation and quick start
   - Document reading order
   - Implementation checklist

### 2. `specs/feat-guru-builder-system-mvp.md` ⭐ MAIN SPEC
   - Complete implementation specification
   - 5-phase rollout plan (4-5 weeks)
   - Database schemas, API routes, code examples
   - Testing approach and success criteria
   - **Read this first after this README**

### 3. `reference/guru-builder-foundation-code.md`
   - Complete reusable patterns from backgammon-guru (~860 lines)
   - Core library files (db.ts, utils.ts, validation.ts, types.ts, contextComposer.ts)
   - Reusable UI components (LayerCard, LayerManager, LayerEditModal)
   - API route patterns with adaptation examples
   - **Reference when implementing UI components and API routes**

### 4. `reference/guru-builder-project-setup.md`
   - All configuration files for fresh installation
   - Complete package.json with dependencies
   - TypeScript, Next.js, Tailwind, PostCSS configs
   - Base Prisma schema (before extensions)
   - Environment variables template
   - Step-by-step installation commands
   - **Use this to bootstrap the project**

### 5. `reference/guru-builder-python-integration.md`
   - Complete GPT Researcher integration code
   - Full research_agent.py script (150+ lines)
   - Python environment setup
   - Integration with Next.js via subprocess
   - Testing and troubleshooting guide
   - **Use for Phase 1 validation**

### 6. `reference/spec-validation-analysis.md`
   - Comprehensive validation of the main spec
   - Gap analysis and completeness assessment
   - Overengineering analysis
   - Recommendations and next steps
   - **Read for context on spec quality**

### 7. `context/` directory (research artifacts)
   - `guru-builder-ux-design.md` - Complete UX wireframes (8 screens)
   - `guru-builder-project-scaffold.md` - Analysis of reusable components
   - `guru-builder-building-blocks-research.md` - External tools research
   - `guru-builder-system.md` - Original system description
   - **Background reading - not required for implementation**

---

## 🚀 Quick Start Guide

### Step 1: Review Documentation (2-3 hours)

**Essential Reading** (must read before coding):
1. ✅ This README (you are here)
2. ✅ `specs/feat-guru-builder-system-mvp.md` - Main implementation spec
3. ✅ `reference/guru-builder-project-setup.md` - Project setup guide

**Reference Materials** (read as needed during implementation):
4. 📖 `reference/guru-builder-foundation-code.md` - When building UI/APIs
5. 📖 `reference/guru-builder-python-integration.md` - When implementing research

**Optional Background**:
6. 📖 `reference/spec-validation-analysis.md` - Understanding spec quality
7. 📖 `context/*.md` - UX design, research, and planning artifacts

### Step 2: Bootstrap Project (30 minutes)

```bash
# 1. Create new Next.js project
npx create-next-app@latest guru-builder
cd guru-builder

# 2. Follow guru-builder-project-setup.md to:
#    - Install dependencies
#    - Set up Prisma
#    - Configure environment variables
#    - Install shadcn/ui components

# 3. Copy foundation code from guru-builder-foundation-code.md:
#    - lib/db.ts, lib/utils.ts, lib/validation.ts, lib/types.ts, lib/contextComposer.ts
#    - components/layers/* (LayerCard, LayerManager, LayerEditModal)

# 4. Set up Python environment from guru-builder-python-integration.md:
#    - Create requirements.txt
#    - Install gpt-researcher
#    - Create research_agent.py
```

### Step 3: Execute 5-Phase Implementation (4-5 weeks)

Follow the phase-by-phase plan in `specs/feat-guru-builder-system-mvp.md`:

**Phase 1: Validation & POC (Week 1)** - Critical go/no-go decision
- Day 1-2: GPT Researcher integration POC
- Day 3: Inngest background jobs setup
- Day 4: OpenAI Structured Outputs test
- Day 5: Integration test & decision point

**Phase 2: Database & API Foundation (Week 2)**
- Extend Prisma schema with new models
- Build Project & Knowledge File APIs
- Build Research Run & Recommendation APIs
- Build Apply Changes & Snapshot APIs

**Phase 3: Core Research Orchestration (Week 3)**
- Implement research orchestrator
- Implement recommendation generator with structured outputs
- Implement recommendation applier & snapshot manager

**Phase 4: UI Components (Week 4)**
- Build projects dashboard
- Build knowledge file management
- Build research run configuration & progress
- Build recommendation review UI

**Phase 5: Integration & Production Readiness (Week 5)**
- End-to-end testing
- Error handling & edge cases
- Performance optimization
- Documentation & deployment

---

## 🏗️ Architecture Summary

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Vercel AI SDK + OpenAI GPT-4o-mini
- **Research**: GPT Researcher (Python)
- **Background Jobs**: Inngest (serverless)
- **Validation**: Zod

### Core Concepts

**Context Layers** (always-loaded):
- Foundational knowledge included in every LLM prompt
- Priority-ordered, toggleable, editable
- Foundation from existing backgammon-guru

**Knowledge Files** (conditionally-loaded):
- Referenced files loaded when mentioned in user message
- Reduces token usage for large corpora
- New feature for Guru Builder

**Research Runs**:
- Autonomous research cycles using GPT Researcher
- Three depth levels: quick (1-2min), moderate (3-5min), deep (5-10min)
- Generates structured recommendations

**Recommendations**:
- Typed objects (not just text): add/edit/delete
- Target: layer or knowledge-file
- Metadata: confidence, impact, priority
- Approval workflow before application

**Corpus Snapshots**:
- Version control for corpus changes
- Created before applying recommendations
- Restore capability for rollback

### Database Schema

**Existing Models** (from backgammon-guru):
- `Project` - Multi-project support
- `ContextLayer` - Always-loaded knowledge layers

**New Models** (Guru Builder extensions):
- `KnowledgeFile` - Conditionally-loaded files
- `ResearchRun` - Research task tracking
- `Recommendation` - Structured change proposals
- `CorpusSnapshot` - Version control

See full schema in `specs/feat-guru-builder-system-mvp.md` lines 82-187

---

## 📋 Implementation Checklist

### Phase 1: Validation & POC (CRITICAL) ✅ **COMPLETE**
- [x] Python environment set up with GPT Researcher
- [x] research_agent.py working and returning JSON
- [x] Next.js can spawn Python subprocess successfully
- [x] Inngest account created and configured
- [x] Inngest background jobs execute successfully
- [x] OpenAI Structured Outputs return valid recommendation JSON
- [x] End-to-end POC: Research → Recommendations complete
- [x] **GO/NO-GO DECISION**: ✅ **PROCEED TO PHASE 2**

**Status**: All core technologies validated and integrated successfully.
**Documents**: See `PHASE1-STATUS.md` and `PHASE1-TESTING-GUIDE.md` for details.

### Phase 2: Database & APIs
- [ ] Prisma schema extended with 4 new models
- [ ] Migration created and applied
- [ ] Project CRUD APIs implemented and tested
- [ ] Knowledge File CRUD APIs implemented
- [ ] Research Run APIs implemented
- [ ] Recommendation approval API implemented
- [ ] Apply changes API implemented
- [ ] Snapshot APIs implemented
- [ ] All routes tested with curl/Postman

### Phase 3: Research Orchestration
- [ ] researchOrchestrator.ts implemented
- [ ] recommendationGenerator.ts with structured outputs
- [ ] recommendationApplier.ts with snapshot creation
- [ ] snapshotManager.ts with restore capability
- [ ] Inngest job integrated with orchestrator
- [ ] End-to-end research workflow tested

### Phase 4: UI Components
- [ ] Projects dashboard implemented
- [ ] Project creation modal implemented
- [ ] Corpus view with tabs (layers + files)
- [ ] Knowledge file management components
- [ ] Research run configuration form
- [ ] Research progress tracker (polling)
- [ ] Recommendation review UI with diff viewer
- [ ] Apply progress and changes summary
- [ ] All user flows functional

### Phase 5: Production Readiness
- [ ] End-to-end testing complete (5 scenarios)
- [ ] Error handling hardened
- [ ] Performance optimized
- [ ] User documentation written
- [ ] Developer documentation complete
- [ ] Deployed to Vercel/Railway
- [ ] Environment variables configured in production
- [ ] Database migrations run in production
- [ ] Monitoring and logging configured

---

## 🎯 Success Criteria

### Phase 1 Validation (Week 1)
- ✅ GPT Researcher returns valid JSON
- ✅ Python subprocess integration works
- ✅ Inngest jobs execute and track status
- ✅ Structured outputs validate with Zod
- ✅ End-to-end POC completes in <10 minutes
- ✅ Cost per research run <$0.01

### MVP Complete (Week 5)
- ✅ Can create and manage multiple projects
- ✅ Can configure and execute research runs
- ✅ Research generates structured recommendations
- ✅ Can review, approve/reject recommendations
- ✅ Can apply approved changes and see summary
- ✅ Can restore from snapshots
- ✅ All core workflows tested end-to-end
- ✅ Deployed to production
- ✅ Documentation complete

### Post-MVP Metrics
- **Efficiency**: Research cycle takes <30 minutes user time
- **Quality**: 50%+ recommendation approval rate
- **Reliability**: <5% research run failure rate
- **Performance**: Research completes in <10 minutes (moderate depth)
- **Cost**: <$1 per research run

---

## 🛠️ Development Workflow

### Daily Workflow
1. Reference the spec for current phase tasks
2. Use foundation code as templates
3. Test each component/API as you build
4. Update checklist above as you complete items
5. Commit frequently with descriptive messages

### When Stuck
1. Check `reference/spec-validation-analysis.md` for gaps
2. Review `reference/guru-builder-foundation-code.md` for patterns
3. Check `reference/guru-builder-python-integration.md` for Python issues
4. Review UX design in `context/guru-builder-ux-design.md`

### Testing Strategy
- **Phase 1**: Test each component individually (Python, Inngest, Structured Outputs)
- **Phase 2**: Test each API route with curl/Postman
- **Phase 3**: Test orchestration workflow end-to-end
- **Phase 4**: Test UI with real data
- **Phase 5**: Test complete user journeys

---

## 📊 Project Stats

- **Total Estimated Effort**: 4-5 weeks (single developer, full-time)
- **Confidence Level**: 95% (after adding reference files)
- **Lines of Code (estimated)**:
  - Reusable foundation: ~860 lines
  - New functionality: ~2,000 lines
  - Configuration: ~300 lines
  - Python integration: ~200 lines
  - Total: ~3,400 lines

- **New Dependencies**: 2 (Inngest, react-diff-viewer)
- **External Services**: 3 (OpenAI, Inngest, PostgreSQL)
- **Database Models**: 4 new (KnowledgeFile, ResearchRun, Recommendation, CorpusSnapshot)
- **API Routes**: ~20 new endpoints
- **UI Components**: ~15 new components

---

## 🔑 Key Design Decisions

### Why Multi-Layer Context?
- **Modularity**: Separate concerns (fundamentals vs advanced strategy)
- **Experimentation**: Users can A/B test different configurations
- **Transparency**: Users see what influences AI responses
- **Maintainability**: Update knowledge without code changes

### Why GPT Researcher?
- **Purpose-built**: Designed for autonomous research
- **Time savings**: 5-7 days vs custom build
- **Quality**: Well-tested, 16,900+ GitHub stars
- **Cost-effective**: ~$0.005 per research run

### Why Inngest?
- **Serverless-native**: Perfect for Vercel deployment
- **No Redis needed**: Simpler infrastructure
- **Reliability**: Built-in retry logic and error handling
- **Observability**: Dashboard for job monitoring

### Why Structured Outputs?
- **Guaranteed JSON**: No parsing errors
- **Type safety**: Validates against schema
- **Better UX**: Reliable recommendation objects
- **Error reduction**: Eliminates malformed data

---

## 🚧 Known Limitations (MVP Scope)

The following are explicitly **OUT OF SCOPE** for MVP:

- ❌ Multi-user collaboration or team features
- ❌ Authentication or authorization (single-user MVP)
- ❌ Real-time collaboration on corpus editing
- ❌ Advanced analytics or data visualization
- ❌ Export/import of projects
- ❌ Custom AI model selection (GPT-4o-mini only)
- ❌ Web scraping infrastructure (leverage GPT Researcher)
- ❌ Advanced conflict resolution
- ❌ Undo/redo beyond snapshot restore
- ❌ Advanced search or filtering

These can be added in post-MVP iterations based on user feedback.

---

## 📦 What's in This Package

```
guru-builder-implementation/
├── README.md (this file)                          # Start here
├── specs/
│   └── feat-guru-builder-system-mvp.md            # Main implementation spec
├── reference/
│   ├── guru-builder-foundation-code.md            # Reusable patterns (~860 lines)
│   ├── guru-builder-project-setup.md              # Configuration files
│   ├── guru-builder-python-integration.md         # GPT Researcher integration
│   └── spec-validation-analysis.md                # Spec quality assessment
└── context/
    ├── guru-builder-ux-design.md                  # UX wireframes (8 screens)
    ├── guru-builder-project-scaffold.md           # Reusable component analysis
    ├── guru-builder-building-blocks-research.md   # External tools research
    └── guru-builder-system.md                     # Original system description
```

---

## 🎓 For Claude Code

When opening this project in Claude Code:

1. **Read this README first** to understand the project structure
2. **Read `specs/feat-guru-builder-system-mvp.md`** for implementation details
3. **Use reference files** as needed during implementation:
   - Foundation code for UI/API patterns
   - Project setup for configuration
   - Python integration for research functionality
4. **Follow the 5-phase plan** in order
5. **Complete Phase 1 validation** before proceeding to Phase 2
6. **Update checklists** as you complete tasks
7. **Ask for clarification** if anything is unclear

**Key Principle**: This is a **standalone package**. All code and configuration needed is included in these files. No need to reference the original backgammon-guru directory.

---

## 💡 Tips for Success

1. **Phase 1 is critical** - Don't skip validation. The go/no-go decision prevents wasted effort.
2. **Copy foundation code exactly** - It's battle-tested from backgammon-guru
3. **Test as you go** - Don't wait until the end to test integrations
4. **Use the checklists** - They track progress and ensure nothing is missed
5. **Reference the UX design** - Visual wireframes help clarify requirements
6. **Start simple** - Use "quick" research depth during development
7. **Monitor costs** - Keep an eye on OpenAI API usage
8. **Commit frequently** - Small, incremental commits are easier to debug

---

## 🆘 Getting Help

If you encounter issues:

1. Check `reference/spec-validation-analysis.md` for known gaps
2. Review troubleshooting sections in reference files
3. Check the spec's "Open Questions" section (lines 1048-1062)
4. Consult external documentation:
   - [GPT Researcher Docs](https://docs.gptr.dev/)
   - [Inngest Docs](https://www.inngest.com/docs)
   - [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
   - [Vercel AI SDK](https://sdk.vercel.ai/docs)
   - [Prisma Docs](https://www.prisma.io/docs)

---

## 📈 What Comes Next (Post-MVP)

After successful MVP deployment, consider:

1. **User authentication** - Support multiple users
2. **Real-time collaboration** - Collaborative corpus editing
3. **Advanced analytics** - Research velocity, approval rates
4. **Custom AI models** - GPT-4o, Claude, o1-mini
5. **Scheduled research** - Recurring research runs
6. **Knowledge graph** - Visual corpus relationships
7. **Mobile app** - React Native version

See full list in spec lines 1196-1269

---

## ✅ Ready to Begin?

You now have everything needed to implement the Guru Builder system from scratch:

- ✅ Complete implementation spec with 5-phase plan
- ✅ All reusable foundation code (~860 lines)
- ✅ All configuration files and setup instructions
- ✅ Complete Python GPT Researcher integration
- ✅ Comprehensive validation analysis
- ✅ UX design wireframes and research artifacts

**Next Step**: Open `specs/feat-guru-builder-system-mvp.md` and begin Phase 1: Validation & POC

Good luck! 🚀

---

**Package Created**: 2025-01-08
**Spec Version**: MVP v1.0
**Confidence Level**: 95%
**Estimated Duration**: 4-5 weeks
