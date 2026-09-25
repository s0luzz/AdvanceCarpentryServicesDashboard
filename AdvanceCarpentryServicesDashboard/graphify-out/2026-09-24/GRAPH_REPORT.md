# Graph Report - AdvanceCarpentryServicesDashboard  (2026-09-17)

## Corpus Check
- 48 files · ~94,382 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 442 nodes · 678 edges · 29 communities (22 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.82)
- Token cost: 217,665 input · 0 output

## Community Hubs (Navigation)
- App Shell & Pages
- PDF Markup Editor (Konva)
- Build & Lint Config
- Takeoff Measurement Data Model
- PDF Editor Types & Panels
- Takeoff Viewer Interactions
- Backend API Server
- PDF Editor Canvas
- Graphify Tooling Docs
- TS Config (App)
- Dev Dependencies
- TS Config (Node)
- PDF Editor Page State
- Runtime Dependencies
- PDF Export (jsPDF)
- PDF Rendering Pipeline
- Job Detail Page Logic
- Takeoff Calibration & Geometry
- UI Icon Sprite Sheet
- Takeoff Viewer Zoom/Pan
- Takeoff Overlay Interactions
- PDF Alignment Tool
- Dimension Input Dialog
- Layer Panel Controls
- Quoted Jobs Data Store
- TS Config (Root)
- Vite Template Boilerplate
- App Favicon
- Delete Icon Asset

## God Nodes (most connected - your core abstractions)
1. `PdfViewer()` - 46 edges
2. `PdfViewer()` - 20 edges
3. `PdfEditorPage()` - 20 edges
4. `graphify Skill (SKILL.md)` - 18 edges
5. `compilerOptions` - 17 edges
6. `compilerOptions` - 16 edges
7. `react` - 14 edges
8. `JobDetailPage()` - 12 edges
9. `PdfEditorCanvas()` - 10 edges
10. `NewQuoteModal()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `graphify Section (.claude/CLAUDE.md)` --semantically_similar_to--> `graphify Project Rules (root CLAUDE.md)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `graphify Project Rules (root CLAUDE.md)` --conceptually_related_to--> `graphify claude install (native CLAUDE.md integration)`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `HTML Entry Point (index.html)` --conceptually_related_to--> `React + TypeScript + Vite Template Guide`  [INFERRED]
  index.html → README.md
- `graphify Project Rules (root CLAUDE.md)` --references--> `graphify explain command`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `graphify Project Rules (root CLAUDE.md)` --references--> `graphify path command`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Skill Modular Documentation Set** — _claude_skills_graphify_skill_definition, _claude_skills_graphify_references_add_watch_guide, _claude_skills_graphify_references_exports_guide, _claude_skills_graphify_references_extraction_spec_prompt, _claude_skills_graphify_references_github_and_merge_guide, _claude_skills_graphify_references_hooks_guide, _claude_skills_graphify_references_query_guide, _claude_skills_graphify_references_transcribe_guide, _claude_skills_graphify_references_update_guide [INFERRED 0.85]
- **graphify Graph Query/Path/Explain Flow** — _claude_skills_graphify_skill_graphify_query_command, _claude_skills_graphify_skill_graphify_path_command, _claude_skills_graphify_skill_graphify_explain_command [EXTRACTED 1.00]
- **Keeping the Graph Always-On Without Manual /graphify** — _claude_skills_graphify_skill_hook_install_command, _claude_skills_graphify_skill_claude_install_command, claude_graphify_integration [INFERRED 0.85]

## Communities (29 total, 7 thin omitted)

### Community 0 - "App Shell & Pages"
Cohesion: 0.06
Nodes (34): react, ref_react_dom_client, ref_react_router, react-router-dom, App(), src_assets_icons_delete, PdfViewerPage(), ExistingQuoteData (+26 more)

### Community 1 - "PDF Markup Editor (Konva)"
Cohesion: 0.07
Nodes (31): ref_konva_lib_node, react-konva, react-pdf, ref_react_pdf_dist_page_annotationlayer_css, ref_react_pdf_dist_page_textlayer_css, BoxShape, CanvasSize, clamp() (+23 more)

### Community 2 - "Build & Lint Config"
Cohesion: 0.07
Nodes (30): name, private, scripts, build, dev, lint, preview, server (+22 more)

### Community 3 - "Takeoff Measurement Data Model"
Cohesion: 0.07
Nodes (27): AreaBox, AreaBoxOverlay(), AreaBoxOverlayProps, AreaCategory, AreaDrawingStep, AssignedPageAreaTotal, AssignedPageWallTotal, AxisCalibration (+19 more)

### Community 4 - "PDF Editor Types & Panels"
Cohesion: 0.14
Nodes (21): DEFAULT_MARKUP_STYLE, DEFAULT_OVERLAY_TRANSFORM, EditorCalibration, EditorPdfFile, EditorTool, MarkupStyle, OverlayTransform, PdfPageSelection (+13 more)

### Community 5 - "Takeoff Viewer Interactions"
Cohesion: 0.12
Nodes (18): formatCalibrationDistance(), formatDistance(), formatTotalDistance(), getAreaAssignmentKey(), PdfViewer(), assignAreaTotal(), clearArea(), clearWalls() (+10 more)

### Community 6 - "Backend API Server"
Cohesion: 0.10
Nodes (20): cors, ref_crypto, express, ref_fs, multer, ref_path, ref_url, app (+12 more)

### Community 7 - "PDF Editor Canvas"
Cohesion: 0.13
Nodes (18): konva, AlignmentMarkerProps, clamp(), createAlignedTransform(), DimensionLineProps, distance(), isShapeTool(), overlayLocalToWorld() (+10 more)

### Community 8 - "Graphify Tooling Docs"
Cohesion: 0.16
Nodes (20): graphify Section (.claude/CLAUDE.md), Add URL & Watch Folder Reference Guide, Exports & Benchmark Reference Guide, Extraction Subagent Prompt Spec, GitHub Clone & Cross-Repo Merge Guide, Commit Hook & Native CLAUDE.md Integration Guide, Query/Path/Explain Reference Guide, Video/Audio Transcription Guide (+12 more)

### Community 9 - "TS Config (App)"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 10 - "Dev Dependencies"
Cohesion: 0.11
Nodes (18): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, json-server, nodemon (+10 more)

### Community 11 - "TS Config (Node)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 12 - "PDF Editor Page State"
Cohesion: 0.17
Nodes (13): cloneDefaultMarkupStyle(), cloneDefaultOverlayTransform(), createEmptyEditorState(), createId(), normaliseDimension(), normaliseShape(), parseEditorState(), PdfEditorPage() (+5 more)

### Community 13 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, cors, express, jspdf, konva, multer, react, react-dom (+4 more)

### Community 14 - "PDF Export (jsPDF)"
Cohesion: 0.23
Nodes (11): jspdf, DimensionMarkup, RenderedPdfPage, ShapeMarkup, drawDimension(), drawOverlay(), drawShape(), exportMarkupPdf() (+3 more)

### Community 15 - "PDF Rendering Pipeline"
Cohesion: 0.31
Nodes (10): ref_pdfjs_dist, PagePicker(), loadPages(), documentCache, getPdfDocument(), getPdfPageCount(), loadHtmlImage(), renderPdfPageToDataUrl() (+2 more)

### Community 17 - "Takeoff Calibration & Geometry"
Cohesion: 0.36
Nodes (10): calculateCalibratedDistance(), createId(), getPageSpaceVector(), getVectorLength(), normaliseVector(), createAreaBox(), getPageAspectRatio(), handleCalibrationPoint() (+2 more)

### Community 18 - "UI Icon Sprite Sheet"
Cohesion: 0.33
Nodes (7): Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social/Contacts Icon, Icons Sprite Sheet, X (Twitter) Icon

### Community 19 - "Takeoff Viewer Zoom/Pan"
Cohesion: 0.38
Nodes (7): applyButtonZoom(), fitToWidth(), resetView(), updatePan(), updateScale(), zoomIn(), zoomOut()

### Community 20 - "Takeoff Overlay Interactions"
Cohesion: 0.33
Nodes (6): calculateAxisAngleDifference(), clamp(), getRelativePoint(), handleOverlayClick(), handleOverlayMouseMove(), handleWheel()

### Community 21 - "PDF Alignment Tool"
Cohesion: 0.50
Nodes (4): AlignmentTool(), AlignmentToolProps, getStep(), AlignmentDraft

### Community 22 - "Dimension Input Dialog"
Cohesion: 0.67
Nodes (3): DimensionDialog(), DimensionDialogProps, formatMeasuredDistance()

## Knowledge Gaps
- **168 isolated node(s):** `quotedJobs`, `$schema`, `name`, `private`, `version` (+163 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 223 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Shell & Pages` to `PDF Markup Editor (Konva)`, `Build & Lint Config`, `Takeoff Measurement Data Model`, `PDF Editor Types & Panels`, `PDF Editor Canvas`, `Dimension Input Dialog`?**
  _High betweenness centrality (0.269) - this node is a cross-community bridge._
- **Why does `PdfViewer()` connect `Takeoff Viewer Interactions` to `App Shell & Pages`, `Takeoff Measurement Data Model`, `Takeoff Calibration & Geometry`, `Takeoff Viewer Zoom/Pan`, `Takeoff Overlay Interactions`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `App Shell & Pages` to `Build & Lint Config`, `PDF Editor Types & Panels`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `PdfViewer()` (e.g. with `handleMouseMove()` and `handleMouseUp()`) actually correct?**
  _`PdfViewer()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `PdfViewer()` (e.g. with `handleGlobalMouseMove()` and `handleGlobalMouseUp()`) actually correct?**
  _`PdfViewer()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `quotedJobs`, `$schema`, `name` to the rest of the system?**
  _168 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05587808417997097 - nodes in this community are weakly interconnected._