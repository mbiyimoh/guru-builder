# Manual CRUD for Context Layers and Knowledge Files

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-11-09
**Related:** Guru Builder MVP Phase 3 (UI Components)

---

## Overview

Add manual CRUD (Create, Read, Update, Delete) functionality for Context Layers and Knowledge Files in the project detail view, enabling users to build their initial corpus foundation before running research.

## Problem Statement

Users currently cannot manually manage their project's context layers or knowledge files:
- Project detail page shows read-only lists
- No way to create, edit, or delete corpus entities
- Users cannot build a "starting foundation" to share or iterate on
- Entirely dependent on AI research recommendations

This prevents users from bootstrapping their projects with hand-crafted knowledge and forces them to wait for AI-generated recommendations.

## Goals

✅ Enable users to manually create context layers
✅ Enable users to manually edit/delete context layers
✅ Enable users to manually create knowledge files
✅ Enable users to manually edit/delete knowledge files
✅ Match existing UI patterns (Tailwind modals like CreateProjectButton)
✅ Follow existing API patterns (like knowledge-files API structure)

## Non-Goals

❌ Drag-and-drop reordering of layers (Future Enhancement)
❌ Bulk operations (import/export, mass delete) (Future Enhancement)
❌ Rich text editor for content (Future Enhancement)
❌ File upload for knowledge files (Future Enhancement)
❌ Collaboration/sharing features (Future Enhancement)
❌ Shadcn/ui component installation (use existing Tailwind patterns)

## Technical Approach

### High-Level Strategy

1. **Create Context Layers API** - Add `/api/context-layers` routes (GET, POST, PUT, DELETE)
2. **Adapt Foundation Components** - Use reference file components but with Tailwind styling
3. **Update Project Detail Page** - Replace read-only sections with interactive managers

### Key Files to Modify

**New Files:**
- `app/api/context-layers/route.ts` - List and create
- `app/api/context-layers/[id]/route.ts` - Update and delete
- `components/context-layers/ContextLayerManager.tsx` - Main manager component
- `components/context-layers/ContextLayerModal.tsx` - Create/edit modal
- `components/knowledge-files/KnowledgeFileManager.tsx` - Main manager component
- `components/knowledge-files/KnowledgeFileModal.tsx` - Create/edit modal

**Modified Files:**
- `app/projects/[id]/page.tsx` - Replace read-only sections with managers

### Integration Points

- **Database:** Prisma client via `lib/db.ts`
- **API Pattern:** Follow `/api/knowledge-files` structure
- **UI Pattern:** Follow `CreateProjectButton.tsx` modal pattern
- **Data Flow:** Component → API → Prisma → PostgreSQL

## Implementation Details

### 1. Context Layers API

Create `/app/api/context-layers/route.ts`:

```typescript
// GET - List layers for a project (query param: projectId)
// POST - Create new layer
```

Create `/app/api/context-layers/[id]/route.ts`:

```typescript
// GET - Get single layer
// PUT - Update layer
// DELETE - Delete layer
```

**Validation:** Reuse existing pattern from knowledge-files API

### 2. Context Layer Manager Component

Adapt from reference `LayerManager.tsx` but use Tailwind styling:

**Features:**
- List all context layers with priority order
- "Add Context Layer" button opens modal
- Each layer shows: title, content preview, priority
- Edit/Delete buttons on each layer
- Toggle active/inactive status
- Loading and empty states

**State Management:**
```typescript
const [layers, setLayers] = useState<ContextLayer[]>([])
const [editingLayer, setEditingLayer] = useState<ContextLayer | null>(null)
const [isCreateOpen, setIsCreateOpen] = useState(false)
const [isLoading, setIsLoading] = useState(true)
```

### 3. Context Layer Modal

Adapt from reference `LayerEditModal.tsx` but use CreateProjectButton modal pattern:

**Form Fields:**
- Title (required, max 200 chars)
- Content (required, textarea, max 50,000 chars)
- Priority (number, default: next available)
- Active toggle (default: true)

**Behavior:**
- Save button → POST or PUT to API
- Cancel button → close modal
- Show character count for content
- Display validation errors

### 4. Knowledge File Manager Component

Similar to Context Layer Manager:

**Features:**
- List all knowledge files grouped by category
- "Add Knowledge File" button
- Each file shows: title, description, category badge
- Edit/Delete buttons
- Empty state with call-to-action

### 5. Knowledge File Modal

**Form Fields:**
- Title (required, max 200 chars)
- Description (optional, max 500 chars)
- Content (required, textarea)
- Category (optional, text input)
- Active toggle (default: true)

### 6. Project Detail Page Updates

Replace these sections in `app/projects/[id]/page.tsx`:

**Before (Context Layers):**
```tsx
<div className="bg-white rounded-lg border mb-8">
  {/* Read-only list */}
</div>
```

**After:**
```tsx
<ContextLayerManager projectId={id} />
```

**Before (Knowledge Files):**
```tsx
<div className="bg-white rounded-lg border">
  {/* Read-only list */}
</div>
```

**After:**
```tsx
<KnowledgeFileManager projectId={id} />
```

## Testing Approach

### Manual Testing Scenarios

**Context Layers:**
1. ✅ Create new context layer → Verify appears in list
2. ✅ Edit context layer → Verify changes saved
3. ✅ Delete context layer → Verify removed from list
4. ✅ Toggle layer active/inactive → Verify status changes
5. ✅ Create layer with duplicate priority → Verify handled gracefully

**Knowledge Files:**
1. ✅ Create new knowledge file → Verify appears in list
2. ✅ Edit knowledge file → Verify changes saved
3. ✅ Delete knowledge file → Verify removed from list
4. ✅ Create file with category → Verify grouped correctly

### E2E Test Addition (Optional)

Add to `tests/corpus-management.spec.ts`:
- Create context layer workflow
- Create knowledge file workflow
- Edit and delete operations

## Open Questions

1. **Priority Conflict Handling:** If user creates layer with existing priority, auto-increment or show error?
   - **Decision:** Show error, user must choose unique priority

2. **Default Priority:** What should be the default priority for new layers?
   - **Decision:** Find max priority + 1, or default to 1 if no layers exist

3. **Confirmation Dialogs:** Confirm before delete?
   - **Decision:** Yes, use browser confirm() for simplicity

## User Experience

### Creating a Context Layer

1. User clicks "Add Context Layer" button
2. Modal opens with form
3. User fills in title and content
4. Clicks "Create Layer"
5. Modal closes, layer appears in list

### Editing a Knowledge File

1. User clicks "Edit" on a file card
2. Modal opens pre-filled with existing data
3. User modifies content
4. Clicks "Save Changes"
5. Modal closes, changes reflected in list

## Future Improvements and Enhancements

⚠️ **Everything below is OUT OF SCOPE for initial implementation**

### Enhanced UX
- **Drag-and-drop reordering** - Reorder layers by dragging
- **Bulk operations** - Select multiple items, bulk delete/activate
- **Rich text editor** - WYSIWYG editor for content (TipTap, Lexical)
- **Content preview** - Markdown preview for formatted content
- **Search/filter** - Filter layers by keyword, category

### File Management
- **File upload** - Upload .txt, .md files as knowledge files
- **Import/Export** - Export corpus as ZIP, import from templates
- **Version control** - Track changes to individual layers/files
- **Diff view** - Show what changed between edits

### Advanced Features
- **Templates** - Pre-built layer templates for common use cases
- **AI assist** - "Improve this layer" button for AI refinement
- **Duplicate detection** - Warn if content similar to existing layer
- **Analytics** - Show which layers are most referenced in AI responses

### Collaboration
- **Comments** - Add comments to layers for team review
- **Change requests** - Suggest edits without direct modification
- **Approval workflow** - Require review before layer activation

### Performance
- **Infinite scroll** - For projects with 100+ layers
- **Debounced search** - Fast search with loading indicators
- **Optimistic UI updates** - Instant feedback before API confirmation

## References

- Reference file: `reference/guru-builder-foundation-code.md` (lines 419-565)
- Existing pattern: `app/projects/CreateProjectButton.tsx`
- Existing API: `app/api/knowledge-files/route.ts`
- Database schema: `prisma/schema.prisma` (ContextLayer, KnowledgeFile models)
- E2E tests: `tests/` directory

---

## Self-Audit Checklist

✅ **Scope:** Implements exactly what was requested (manual CRUD for both entities)
✅ **Natural Extensions:** Active toggle, priority field are expected features
✅ **Testing:** Manual testing scenarios only, E2E optional
✅ **Future Improvements:** Well-populated section with deferred features
✅ **No Over-Engineering:** No bulk operations, no file upload, no rich editor
✅ **Implementable:** Clear, specific, actionable steps

---

**Estimated Implementation Time:** 1-2 hours
**Confidence Level:** 95% (pattern exists, database schema ready)
**Dependencies:** None (all required packages already installed)
