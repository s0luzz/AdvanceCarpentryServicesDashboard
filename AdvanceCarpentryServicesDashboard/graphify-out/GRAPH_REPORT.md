# Graph Report - AdvanceCarpentryServicesDashboard  (2026-09-24)

## Corpus Check
- 48 files · ~119,728 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 502 nodes · 773 edges · 28 communities (24 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17c76e17`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- PdfEditor.tsx
- package.json
- PdfViewer.tsx
- PdfEditorPage.tsx
- PdfViewer
- server.js
- react
- graphify Skill (SKILL.md)
- compilerOptions
- devDependencies
- compilerOptions
- PdfEditorPage
- JobsPage.tsx
- JobDetailPage.tsx
- NewQuoteModal
- JobDetailPage
- handleCalibrationPoint
- Icons Sprite Sheet
- applyButtonZoom
- clamp
- JobsPage
- DimensionDialog.tsx
- QuotesPage
- tsconfig.json
- HTML Entry Point (index.html)
- App Favicon (Purple Ribbon Mark)
- Delete/Trash Icon

## God Nodes (most connected - your core abstractions)
1. `PdfViewer()` - 62 edges
2. `PdfEditorPage()` - 26 edges
3. `PdfViewer()` - 20 edges
4. `graphify Skill (SKILL.md)` - 18 edges
5. `react` - 17 edges
6. `compilerOptions` - 17 edges
7. `compilerOptions` - 16 edges
8. `JobDetailPage()` - 15 edges
9. `PdfEditorCanvas()` - 11 edges
10. `NewQuoteModal()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `graphify Section (.claude/CLAUDE.md)` --semantically_similar_to--> `graphify Project Rules (root CLAUDE.md)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `HTML Entry Point (index.html)` --conceptually_related_to--> `React + TypeScript + Vite Template Guide`  [INFERRED]
  index.html → README.md
- `graphify Project Rules (root CLAUDE.md)` --conceptually_related_to--> `graphify claude install (native CLAUDE.md integration)`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `graphify Project Rules (root CLAUDE.md)` --references--> `graphify explain command`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `graphify Project Rules (root CLAUDE.md)` --references--> `graphify path command`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Graph Query/Path/Explain Flow** — _claude_skills_graphify_skill_graphify_query_command, _claude_skills_graphify_skill_graphify_path_command, _claude_skills_graphify_skill_graphify_explain_command [EXTRACTED 1.00]
- **Keeping the Graph Always-On Without Manual /graphify** — _claude_skills_graphify_skill_hook_install_command, _claude_skills_graphify_skill_claude_install_command, claude_graphify_integration [INFERRED 0.85]
- **graphify Skill Modular Documentation Set** — _claude_skills_graphify_skill_definition, _claude_skills_graphify_references_add_watch_guide, _claude_skills_graphify_references_exports_guide, _claude_skills_graphify_references_extraction_spec_prompt, _claude_skills_graphify_references_github_and_merge_guide, _claude_skills_graphify_references_hooks_guide, _claude_skills_graphify_references_query_guide, _claude_skills_graphify_references_transcribe_guide, _claude_skills_graphify_references_update_guide [INFERRED 0.85]

## Communities (28 total, 4 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.20
Nodes (9): ref_react_dom_client, ref_react_router, App(), Sidebar(), SidebarItem, sidebarItems, src_index, DashboardPage() (+1 more)

### Community 1 - "PdfEditor.tsx"
Cohesion: 0.08
Nodes (30): ref_konva_lib_node, react-konva, ref_react_pdf_dist_page_annotationlayer_css, ref_react_pdf_dist_page_textlayer_css, BoxShape, CanvasSize, clamp(), createId() (+22 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (42): dependencies, cors, express, jspdf, konva, multer, react, react-dom (+34 more)

### Community 3 - "PdfViewer.tsx"
Cohesion: 0.06
Nodes (35): AreaBox, AreaBoxOverlay(), AreaBoxOverlayProps, AreaCategory, AreaDrawingStep, AssignedPageAreaTotal, AssignedPageWallTotal, AxisCalibration (+27 more)

### Community 4 - "PdfEditorPage.tsx"
Cohesion: 0.05
Nodes (58): konva, AlignmentTool(), AlignmentToolProps, getStep(), AlignmentDraft, DEFAULT_MARKUP_STYLE, DEFAULT_OVERLAY_TRANSFORM, DimensionMarkup (+50 more)

### Community 5 - "PdfViewer"
Cohesion: 0.08
Nodes (15): formatCalibrationDistance(), formatTotalDistance(), getAreaAssignmentKey(), PdfViewer(), assignAreaTotal(), clearArea(), clearWalls(), removeAreaAssignment() (+7 more)

### Community 6 - "server.js"
Cohesion: 0.09
Nodes (20): cors, ref_crypto, express, ref_fs, multer, ref_path, ref_url, app (+12 more)

### Community 7 - "react"
Cohesion: 0.15
Nodes (7): react, react-router-dom, PdfViewerPage(), CalibrationDialog(), CalibrationDialogProps, Unit, PdfViewerPage()

### Community 8 - "graphify Skill (SKILL.md)"
Cohesion: 0.16
Nodes (20): graphify Section (.claude/CLAUDE.md), Add URL & Watch Folder Reference Guide, Exports & Benchmark Reference Guide, Extraction Subagent Prompt Spec, GitHub Clone & Cross-Repo Merge Guide, Commit Hook & Native CLAUDE.md Integration Guide, Query/Path/Explain Reference Guide, Video/Audio Transcription Guide (+12 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 10 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, json-server, nodemon (+10 more)

### Community 11 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 12 - "PdfEditorPage"
Cohesion: 0.09
Nodes (24): ref_pdfjs_dist, react-pdf, PagePicker(), loadPages(), documentCache, getPdfDocument(), getPdfPageCount(), loadHtmlImage() (+16 more)

### Community 13 - "JobsPage.tsx"
Cohesion: 0.23
Nodes (9): src_assets_icons_delete, ExistingQuoteData, JobDocument, NewQuoteFormData, NewQuoteModalProps, QuoteStatus, QuotedJob, STATUS_FILTERS (+1 more)

### Community 14 - "JobDetailPage.tsx"
Cohesion: 0.27
Nodes (7): InvoiceDialog(), InvoiceDialogProps, NewInvoicePayload, todayIsoDate(), AttachedFile, Invoice, Job

### Community 15 - "NewQuoteModal"
Cohesion: 0.43
Nodes (5): NewQuoteModal(), handleClose(), handleSubmit(), resetForm(), toNumber()

### Community 16 - "JobDetailPage"
Cohesion: 0.08
Nodes (13): jspdf, formatCurrency(), formatDate(), generateInvoicePdf(), InvoicePdfData, InvoicePdfJob, sanitiseFileName(), Invoice (+5 more)

### Community 17 - "handleCalibrationPoint"
Cohesion: 0.20
Nodes (17): calculateCalibratedDistance(), createId(), getPageSpaceVector(), getVectorLength(), normaliseVector(), createAreaBox(), getCurrentAreaCategory(), getPageAspectRatio() (+9 more)

### Community 18 - "Icons Sprite Sheet"
Cohesion: 0.33
Nodes (7): Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social/Contacts Icon, Icons Sprite Sheet, X (Twitter) Icon

### Community 19 - "applyButtonZoom"
Cohesion: 0.38
Nodes (7): applyButtonZoom(), fitToWidth(), resetView(), updatePan(), updateScale(), zoomIn(), zoomOut()

### Community 20 - "clamp"
Cohesion: 0.40
Nodes (5): calculateAxisAngleDifference(), clamp(), getRelativePoint(), handleOverlayMouseMove(), handleWheel()

### Community 21 - "JobsPage"
Cohesion: 0.50
Nodes (3): JobsPage(), fetchQuotedJobs(), handleCreateQuote()

### Community 22 - "DimensionDialog.tsx"
Cohesion: 0.50
Nodes (3): DimensionDialog(), DimensionDialogProps, formatMeasuredDistance()

### Community 23 - "QuotesPage"
Cohesion: 0.50
Nodes (3): QuotesPage(), fetchQuotedJobs(), handleCreateQuote()

## Knowledge Gaps
- **180 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+175 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 260 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `App.tsx`, `PdfEditor.tsx`, `package.json`, `PdfViewer.tsx`, `PdfEditorPage.tsx`, `JobsPage.tsx`, `JobDetailPage.tsx`, `JobDetailPage`, `DimensionDialog.tsx`?**
  _High betweenness centrality (0.280) - this node is a cross-community bridge._
- **Why does `PdfViewer()` connect `PdfViewer` to `PdfViewer.tsx`, `react`, `JobDetailPage.tsx`, `handleCalibrationPoint`, `applyButtonZoom`, `clamp`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `react` to `App.tsx`, `package.json`, `PdfEditorPage.tsx`, `JobsPage.tsx`, `JobDetailPage.tsx`, `JobDetailPage`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `PdfViewer()` (e.g. with `handleMouseMove()` and `handleMouseUp()`) actually correct?**
  _`PdfViewer()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `PdfViewer()` (e.g. with `handleGlobalMouseMove()` and `handleGlobalMouseUp()`) actually correct?**
  _`PdfViewer()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _180 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PdfEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07657657657657657 - nodes in this community are weakly interconnected._