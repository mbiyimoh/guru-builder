# Quick Reference Card

**Fast lookup for common tasks during implementation**

---

## 📖 Where to Find Things

| What You Need | Where to Look | Line Numbers |
|--------------|---------------|--------------|
| **Database schema extensions** | `specs/feat-guru-builder-system-mvp.md` | 82-187 |
| **API route structure** | `specs/feat-guru-builder-system-mvp.md` | 196-226 |
| **Validation schemas** | `specs/feat-guru-builder-system-mvp.md` | 274-305 |
| **Phase 1 validation steps** | `specs/feat-guru-builder-system-mvp.md` | 309-442 |
| **Research orchestrator code** | `specs/feat-guru-builder-system-mvp.md` | 590-654 |
| **Recommendation generator** | `specs/feat-guru-builder-system-mvp.md` | 660-712 |
| **Complete package.json** | `reference/guru-builder-project-setup.md` | Full file |
| **All config files** | `reference/guru-builder-project-setup.md` | Full file |
| **LayerCard component** | `reference/guru-builder-foundation-code.md` | Lines 318-392 |
| **LayerManager component** | `reference/guru-builder-foundation-code.md` | Lines 403-623 |
| **API route pattern** | `reference/guru-builder-foundation-code.md` | Lines 833-923 |
| **Python research script** | `reference/guru-builder-python-integration.md` | Lines 38-198 |
| **UX wireframes** | `context/guru-builder-ux-design.md` | Full file |

---

## 🚀 Common Commands

### Project Setup
```bash
# Create Next.js project
npx create-next-app@latest guru-builder

# Install dependencies
npm install

# Add Guru Builder specific deps
npm install inngest react-diff-viewer

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Add components
npx shadcn-ui@latest add button card input textarea label switch dialog badge tabs

# Set up Prisma
npx prisma init

# Run migrations
npx prisma migrate dev --name init

# Start dev server
npm run dev
```

### Python Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install gpt-researcher langchain langchain-openai python-dotenv

# Test research script
python3 research_agent.py "test query" "quick"
```

### Database Operations
```bash
# Create migration
npx prisma migrate dev --name add_guru_builder_models

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Reset database (careful!)
npx prisma migrate reset
```

---

## 🔍 Quick File Paths

### Core Library Files (copy from foundation code)
```
lib/db.ts                 - Prisma client singleton
lib/utils.ts             - Utility functions (cn)
lib/validation.ts        - Zod schemas
lib/types.ts             - TypeScript types
lib/contextComposer.ts   - Context layer composition
```

### New Library Files (implement from spec)
```
lib/researchOrchestrator.ts      - Research workflow
lib/recommendationGenerator.ts   - AI recommendation generation
lib/recommendationApplier.ts     - Apply approved changes
lib/snapshotManager.ts           - Version control
```

### Component Structure
```
components/
├── ui/                          # shadcn/ui components
├── layers/                      # From foundation code
│   ├── LayerCard.tsx
│   ├── LayerManager.tsx
│   └── LayerEditModal.tsx
├── projects/                    # New - adapt from layers
│   ├── ProjectCard.tsx
│   └── ProjectList.tsx
├── corpus/                      # New
│   ├── CorpusView.tsx
│   └── KnowledgeFileManager.tsx
├── research/                    # New
│   ├── ResearchRunConfig.tsx
│   └── ResearchProgress.tsx
└── recommendations/             # New
    ├── RecommendationCard.tsx
    └── RecommendationPreview.tsx
```

---

## 📝 Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...
INNGEST_SIGNING_KEY=signkey-prod-...
INNGEST_EVENT_KEY=inngest-...

# Optional
ANTHROPIC_API_KEY=sk-ant-api03-...  # For drill mode
INNGEST_DEV_URL=http://localhost:8288  # Local dev
```

---

## 🧪 Testing Endpoints

### Test Research (Phase 1)
```bash
curl -X POST http://localhost:3000/api/research/test \
  -H "Content-Type: application/json" \
  -d '{"instructions": "Research backgammon", "depth": "quick"}'
```

### Test Structured Outputs (Phase 1)
```bash
curl -X POST http://localhost:3000/api/recommendations/test \
  -H "Content-Type: application/json" \
  -d '{"corpus": {...}, "findings": {...}}'
```

### Create Project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Guru", "description": "Testing"}'
```

### Create Research Run
```bash
curl -X POST http://localhost:3000/api/project/{id}/research-runs \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "instructions": "...", "depth": "quick", "scope": {...}}'
```

---

## 🎯 Phase Checklist Quick Reference

### Phase 1 (Week 1) ✓
- [ ] Python + GPT Researcher working
- [ ] Inngest configured and running
- [ ] Structured outputs validated
- [ ] End-to-end POC complete
- [ ] GO/NO-GO decision made

### Phase 2 (Week 2)
- [ ] Prisma schema extended (4 models)
- [ ] All API routes implemented (~20)
- [ ] Routes tested with curl

### Phase 3 (Week 3)
- [ ] Research orchestrator working
- [ ] Recommendation generator with structured outputs
- [ ] Snapshot manager implemented
- [ ] Inngest integration complete

### Phase 4 (Week 4)
- [ ] All UI components built
- [ ] User flows functional
- [ ] react-diff-viewer integrated

### Phase 5 (Week 5)
- [ ] End-to-end testing complete
- [ ] Error handling hardened
- [ ] Deployed to production
- [ ] Documentation complete

---

## 🔧 Troubleshooting Quick Fixes

### Python subprocess not found
```typescript
// Use full path
const python = spawn('/usr/local/bin/python3', ['research_agent.py', ...])
```

### Prisma client not generated
```bash
npx prisma generate
```

### Inngest not receiving events
```bash
# Check Inngest dev server running
npx inngest-cli dev

# Verify event key in .env
echo $INNGEST_EVENT_KEY
```

### shadcn/ui component not found
```bash
# Re-init shadcn
npx shadcn-ui@latest init

# Re-add component
npx shadcn-ui@latest add [component-name]
```

---

## 💰 Cost Monitoring

### Expected Costs (Development)
- Quick research: ~$0.01 per run
- Moderate research: ~$0.05 per run
- Deep research: ~$0.10 per run
- Recommendation generation: ~$0.02 per run
- **MVP Development Total**: ~$5-10

### Production Estimates
- Active project (10 research runs/month): ~$5/month
- Heavy usage (100 research runs/month): ~$50/month

Monitor at: https://platform.openai.com/usage

---

## 📊 Key Metrics

### Performance Targets
- Quick research: 1-2 minutes
- Moderate research: 3-5 minutes
- Deep research: 5-10 minutes
- Recommendation approval rate: >50%
- Research failure rate: <5%

### Database Performance
- Layer composition: <100ms
- API response times: <500ms
- Snapshot creation: <2s

---

## 🎨 UI Component Library (shadcn/ui)

Required components:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add label
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs
```

---

## 🔗 External Resources

- **GPT Researcher**: https://docs.gptr.dev/
- **Inngest**: https://www.inngest.com/docs
- **OpenAI Structured Outputs**: https://platform.openai.com/docs/guides/structured-outputs
- **Vercel AI SDK**: https://sdk.vercel.ai/docs
- **Prisma**: https://www.prisma.io/docs
- **Next.js 15**: https://nextjs.org/docs
- **shadcn/ui**: https://ui.shadcn.com

---

## 📋 Adaptation Patterns

### From LayerCard → ProjectCard
```typescript
// Replace: layer → project
// Replace: layer.name → project.name
// Replace: layer.priority → project.icon (or similar)
// Replace: onToggle → different actions
```

### From LayerManager → KnowledgeFileManager
```typescript
// Replace: layers → files
// Replace: /context-layers → /knowledge-files
// Replace: CreateLayerInput → CreateKnowledgeFileInput
```

### From context-layers API → knowledge-files API
```typescript
// Replace: contextLayer → knowledgeFile
// Replace: CreateLayerSchema → CreateKnowledgeFileSchema
// Add: fileSize calculation (data.content.length)
```

---

**Keep this file handy during implementation for quick lookups!**

**Last Updated**: 2025-01-08
