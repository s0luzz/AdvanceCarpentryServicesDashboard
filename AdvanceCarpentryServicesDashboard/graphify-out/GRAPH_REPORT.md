# Graph Report - AdvanceCarpentryServicesDashboard  (2026-10-12)

## Corpus Check
- 70 files · ~209,736 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 768 nodes · 1439 edges · 49 communities (42 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f20d5103`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Feedback.tsx
- PdfEditor.tsx
- package.json
- PdfViewer.tsx
- PdfEditorCanvas.tsx
- PdfViewer
- server.js
- CalibrationDialog.tsx
- graphify Skill (SKILL.md)
- compilerOptions
- devDependencies
- compilerOptions
- PdfEditorPage
- JobDetailPage.tsx
- InvoiceDialog.tsx
- NewQuoteModal
- JobDetailPage
- handleCalibrationPoint
- Icons Sprite Sheet
- clamp
- SchedulePage.tsx
- QuoteDialog.tsx
- PdfEditorPage.tsx
- invoiceDocx.js
- auth.js
- tsconfig.json
- HTML Entry Point (index.html)
- App Favicon (Purple Ribbon Mark)
- Delete/Trash Icon
- App.tsx
- EmployeesPage.tsx
- editorTypes.ts
- invoicePdf.js
- PagePicker.tsx
- dependencies
- exportMarkupPdf.tsx
- InvoicesPage.tsx
- resetAreaDrawing
- quoteDocs.js
- GlobalDimensionEditDialog.tsx
- eslint.config.js
- scripts
- Sidebar.tsx
- vite.config.ts
- DashboardPage.tsx
- src_assets_icons_delete
- JobsPage
- QuotesPage
- PdfViewerPage

## God Nodes (most connected - your core abstractions)
1. `PdfViewer()` - 73 edges
2. `PdfEditorPage()` - 31 edges
3. `react` - 30 edges
4. `useDocumentTitle()` - 26 edges
5. `PdfViewer()` - 20 edges
6. `useFeedback()` - 20 edges
7. `formatCurrency()` - 20 edges
8. `JobDetailPage()` - 19 edges
9. `SchedulePage()` - 18 edges
10. `graphify Skill (SKILL.md)` - 18 edges

## Surprising Connections (you probably didn't know these)
- `graphify Section (.claude/CLAUDE.md)` --semantically_similar_to--> `graphify Project Rules (root CLAUDE.md)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `HTML Entry Point (index.html)` --conceptually_related_to--> `React + TypeScript + Vite Template Guide`  [INFERRED]
  index.html → README.md
- `graphify Project Rules (root CLAUDE.md)` --conceptually_related_to--> `graphify claude install (native CLAUDE.md integration)`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `save()` --calls--> `downloadQuote()`  [EXTRACTED]
  src/components/quotes/QuoteDialog.tsx → src/lib/downloadInvoice.ts
- `graphify Project Rules (root CLAUDE.md)` --references--> `graphify explain command`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Graph Query/Path/Explain Flow** — _claude_skills_graphify_skill_graphify_query_command, _claude_skills_graphify_skill_graphify_path_command, _claude_skills_graphify_skill_graphify_explain_command [EXTRACTED 1.00]
- **Keeping the Graph Always-On Without Manual /graphify** — _claude_skills_graphify_skill_hook_install_command, _claude_skills_graphify_skill_claude_install_command, claude_graphify_integration [INFERRED 0.85]
- **graphify Skill Modular Documentation Set** — _claude_skills_graphify_skill_definition, _claude_skills_graphify_references_add_watch_guide, _claude_skills_graphify_references_exports_guide, _claude_skills_graphify_references_extraction_spec_prompt, _claude_skills_graphify_references_github_and_merge_guide, _claude_skills_graphify_references_hooks_guide, _claude_skills_graphify_references_query_guide, _claude_skills_graphify_references_transcribe_guide, _claude_skills_graphify_references_update_guide [INFERRED 0.85]

## Communities (49 total, 7 thin omitted)

### Community 0 - "Feedback.tsx"
Cohesion: 0.12
Nodes (13): ref_react_dom_client, ref_react_router, App(), urlOf(), ConfirmOptions, Feedback, FeedbackContext, FeedbackProvider() (+5 more)

### Community 1 - "PdfEditor.tsx"
Cohesion: 0.08
Nodes (30): ref_konva_lib_node, react-konva, ref_react_pdf_dist_page_annotationlayer_css, ref_react_pdf_dist_page_textlayer_css, BoxShape, CanvasSize, clamp(), createId() (+22 more)

### Community 2 - "package.json"
Cohesion: 0.11
Nodes (17): name, private, type, version, cors, eslint, express, json-server (+9 more)

### Community 3 - "PdfViewer.tsx"
Cohesion: 0.05
Nodes (38): AreaBox, AreaBoxOverlay(), AreaBoxOverlayProps, AreaCategory, AreaDrawingStep, AssignedPageAreaTotal, AssignedPageWallTotal, AxisCalibration (+30 more)

### Community 4 - "PdfEditorCanvas.tsx"
Cohesion: 0.11
Nodes (21): konva, AlignmentMarkerProps, chevronPoints(), clamp(), createAlignedTransform(), DimensionLine(), DimensionLineProps, distance() (+13 more)

### Community 5 - "PdfViewer"
Cohesion: 0.07
Nodes (14): getAreaAssignmentKey(), PdfViewer(), assignAreaTotal(), clearArea(), clearWalls(), getRelativePoint(), handleKeyUp(), handleOverlayMouseMove() (+6 more)

### Community 6 - "server.js"
Cohesion: 0.07
Nodes (25): app, dbPath, __dirname, EMPLOYEE_GROUPS, EMPLOYEE_TEXT_FIELDS, employeeFilesRoot, employeeRoute(), employeesPath (+17 more)

### Community 7 - "CalibrationDialog.tsx"
Cohesion: 0.40
Nodes (3): CalibrationDialog(), CalibrationDialogProps, Unit

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
Cohesion: 0.12
Nodes (7): cloneDefaultOverlayTransform(), createId(), PdfEditorPage(), addShape(), handlePageSelected(), removeOverlay(), readJsonResponse()

### Community 13 - "JobDetailPage.tsx"
Cohesion: 0.15
Nodes (18): ExistingQuoteData, JobDocument, NewQuoteFormData, NewQuoteModalProps, QuoteStatus, RowMenu(), RowMenuItem, aud (+10 more)

### Community 14 - "InvoiceDialog.tsx"
Cohesion: 0.24
Nodes (12): gstOf(), INVOICE_STATUSES, InvoiceDialog(), autofillFrom(), handleExChange(), handleIncChange(), InvoiceDialogProps, InvoiceStatus (+4 more)

### Community 15 - "NewQuoteModal"
Cohesion: 0.43
Nodes (5): NewQuoteModal(), handleClose(), handleSubmit(), resetForm(), toNumber()

### Community 17 - "handleCalibrationPoint"
Cohesion: 0.33
Nodes (11): calculateCalibratedDistance(), getPageSpaceVector(), getVectorLength(), normaliseVector(), getPageAspectRatio(), handleBeamPoint(), handleCalibrationPoint(), handleOverlayClick() (+3 more)

### Community 18 - "Icons Sprite Sheet"
Cohesion: 0.33
Nodes (7): Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social/Contacts Icon, Icons Sprite Sheet, X (Twitter) Icon

### Community 19 - "clamp"
Cohesion: 0.22
Nodes (13): calculateAxisAngleDifference(), clamp(), applyButtonZoom(), fitToWidth(), handleKeyDown(), handleViewportPointerMove(), handleWheel(), isTyping() (+5 more)

### Community 20 - "SchedulePage.tsx"
Cohesion: 0.14
Nodes (35): exportSchedulePdf(), ExportSchedulePdfOptions, SchedulePdfRow, BUILDER_COLOURS, builderColour(), computeDrag(), Drag, DragKind (+27 more)

### Community 21 - "QuoteDialog.tsx"
Cohesion: 0.16
Nodes (20): optionsOf(), QuoteDialog(), save(), QuoteDialogProps, QuoteJob, round2(), sameClient(), SavedQuote (+12 more)

### Community 22 - "PdfEditorPage.tsx"
Cohesion: 0.13
Nodes (18): AlignmentTool(), AlignmentToolProps, getStep(), DimensionDialog(), DimensionDialogProps, formatMeasuredDistance(), AlignmentDraft, AttachedFile (+10 more)

### Community 23 - "invoiceDocx.js"
Cohesion: 0.13
Nodes (21): ref_child_process, fflate, ref_os, ref_path, ref_url, buildInvoiceDocx(), __dirname, escapeXml() (+13 more)

### Community 24 - "auth.js"
Cohesion: 0.15
Nodes (19): ref_crypto, ref_readline, clientIp(), COOKIE_NAME, __dirname, failures, hashPassword(), hasPassword() (+11 more)

### Community 29 - "App.tsx"
Cohesion: 0.18
Nodes (16): react, react-router-dom, AuthState, COMING_SOON, FULL_SCREEN_ROUTES, useDocumentTitle(), LoginPage(), LoginPageProps (+8 more)

### Community 30 - "EmployeesPage.tsx"
Cohesion: 0.13
Nodes (23): addYear(), daysUntil(), Employee, EmployeeFile, parseLocal(), plStatus(), PlTone, renewedExpiry() (+15 more)

### Community 31 - "editorTypes.ts"
Cohesion: 0.14
Nodes (16): DEFAULT_OVERLAY_TRANSFORM, DimensionStyleValues, EditorCalibration, EditorTool, MarkupStyle, OverlayTransform, Point, SavedPdfMarkupEditor (+8 more)

### Community 32 - "invoicePdf.js"
Cohesion: 0.14
Nodes (15): ordinal(), ADDRESS, buildInvoicePdf(), DATE, DESCRIPTION, __dirname, EX_GST, FORM_PATH (+7 more)

### Community 33 - "PagePicker.tsx"
Cohesion: 0.17
Nodes (16): ref_pdfjs_dist, react-pdf, EditorPdfFile, PdfPageSelection, PagePicker(), loadPageCount(), PagePickerProps, PageThumbnail() (+8 more)

### Community 34 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, cors, express, fflate, jspdf, konva, multer, pdf-lib (+6 more)

### Community 35 - "exportMarkupPdf.tsx"
Cohesion: 0.20
Nodes (13): jspdf, DEFAULT_MARKUP_STYLE, DimensionMarkup, RenderedPdfPage, ShapeMarkup, drawArrowHead(), drawDimension(), drawOverlay() (+5 more)

### Community 36 - "InvoicesPage.tsx"
Cohesion: 0.18
Nodes (12): NewInvoicePayload, TableSkeleton(), downloadFile(), downloadInvoice(), downloadQuote(), Invoice, InvoiceRow, InvoicesPage() (+4 more)

### Community 37 - "resetAreaDrawing"
Cohesion: 0.22
Nodes (10): createId(), createAreaBox(), getCurrentAreaCategory(), handleAreaPoint(), resetAreaDrawing(), resetDrawingState(), saveBeam(), savePost() (+2 more)

### Community 38 - "quoteDocs.js"
Cohesion: 0.18
Nodes (16): ref_fs, pdf-lib, money(), buildQuoteDocx(), buildQuotePdf(), cell(), COLS, dateParts() (+8 more)

### Community 39 - "GlobalDimensionEditDialog.tsx"
Cohesion: 0.29
Nodes (7): COLOURS, formatValue(), GlobalDimensionEdit, GlobalDimensionEditDialog(), GlobalDimensionEditDialogProps, SLIDERS, ColourControl()

### Community 40 - "eslint.config.js"
Cohesion: 0.29
Nodes (6): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, typescript-eslint

### Community 41 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, server, set-password

### Community 42 - "Sidebar.tsx"
Cohesion: 0.29
Nodes (5): @untitledui/icons, Sidebar(), SidebarItem, sidebarItems, SidebarProps

### Community 43 - "vite.config.ts"
Cohesion: 0.50
Nodes (3): @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 44 - "DashboardPage.tsx"
Cohesion: 0.23
Nodes (8): CardSkeleton(), DashboardPage(), addTodo(), load(), toggleTodo(), PIPELINE_STATUSES, Todo, todoRequest()

### Community 46 - "JobsPage"
Cohesion: 0.40
Nodes (3): JobsPage(), fetchQuotedJobs(), handleCreateQuote()

### Community 47 - "QuotesPage"
Cohesion: 0.67
Nodes (3): QuotesPage(), fetchQuotedJobs(), handleCreateQuote()

## Knowledge Gaps
- **252 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 352 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.tsx` to `Feedback.tsx`, `PagePicker.tsx`, `package.json`, `PdfEditor.tsx`, `PdfEditorCanvas.tsx`, `PdfViewer.tsx`, `InvoicesPage.tsx`, `CalibrationDialog.tsx`, `GlobalDimensionEditDialog.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`, `JobDetailPage.tsx`, `InvoiceDialog.tsx`, `SchedulePage.tsx`, `QuoteDialog.tsx`, `PdfEditorPage.tsx`, `EmployeesPage.tsx`?**
  _High betweenness centrality (0.329) - this node is a cross-community bridge._
- **Why does `PdfViewer()` connect `PdfViewer` to `PdfViewer.tsx`, `resetAreaDrawing`, `JobDetailPage.tsx`, `handleCalibrationPoint`, `clamp`, `App.tsx`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `App.tsx` to `package.json`, `InvoicesPage.tsx`, `DashboardPage.tsx`, `JobDetailPage.tsx`, `SchedulePage.tsx`, `PdfEditorPage.tsx`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `PdfViewer()` (e.g. with `clearWalls()` and `fitToWidth()`) actually correct?**
  _`PdfViewer()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `PdfViewer()` (e.g. with `handleGlobalMouseMove()` and `handleGlobalMouseUp()`) actually correct?**
  _`PdfViewer()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Feedback.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._