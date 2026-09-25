import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import AlignmentTool from "../components/pdf-editor/AlignmentTool";
import CalibrationDialog from "../components/pdf-editor/CalibrationDialog";
import DimensionDialog from "../components/pdf-editor/DimensionDialog";
import LayerPanel from "../components/pdf-editor/LayerPanel";
import PagePicker from "../components/pdf-editor/PagePicker";
import PdfEditorCanvas from "../components/pdf-editor/PdfEditorCanvas";
import { exportMarkupPdf } from "../components/pdf-editor/exportMarkupPdf";
import type {
  AlignmentDraft,
  DimensionMarkup,
  EditorCalibration,
  EditorPdfFile,
  EditorTool,
  MarkupStyle,
  OverlayTransform,
  PdfPageSelection,
  RenderedPdfPage,
  SavedPdfMarkupEditor,
  ShapeMarkup,
  ShapeType,
} from "../components/pdf-editor/editorTypes";
import {
  DEFAULT_MARKUP_STYLE,
  DEFAULT_OVERLAY_TRANSFORM,
} from "../components/pdf-editor/editorTypes";
import {
  loadHtmlImage,
  renderPdfPageToDataUrl,
} from "../components/pdf-editor/pdfRendering";

const API_URL = "http://localhost:3001";
const SAVE_DELAY_MS = 700;
const PAGE_RENDER_SCALE = 2.5;

type AttachedFile = {
  id: string;
  originalName: string;
  path?: string;
  url?: string;
  mimeType?: string;
};

type Job = {
  id: string;
  name: string;
  address?: string;
  files?: AttachedFile[];
  markupEditor?: unknown;
};

type PickerMode = "base" | "overlay" | null;

type PendingCalibration = {
  start: { x: number; y: number };
  end: { x: number; y: number };
  pixelDistance: number;
};

type PendingDimension = {
  id?: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  measuredMm: number;
  initialLabel?: string;
  initialText?: string;
};

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneDefaultOverlayTransform(): OverlayTransform {
  return { ...DEFAULT_OVERLAY_TRANSFORM };
}

function cloneDefaultMarkupStyle(): MarkupStyle {
  return { ...DEFAULT_MARKUP_STYLE };
}

function normaliseDimension(value: unknown): DimensionMarkup | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const dimension = value as Partial<DimensionMarkup>;

  if (
    typeof dimension.id !== "string" ||
    !dimension.start ||
    !dimension.end ||
    !Number.isFinite(dimension.measuredMm) ||
    typeof dimension.displayText !== "string"
  ) {
    return null;
  }

  return {
    id: dimension.id,
    start: dimension.start,
    end: dimension.end,
    measuredMm: dimension.measuredMm as number,
    label:
      typeof dimension.label === "string"
        ? dimension.label
        : "",
    displayText: dimension.displayText,
    lineColor:
      typeof dimension.lineColor === "string"
        ? dimension.lineColor
        : DEFAULT_MARKUP_STYLE.dimensionLineColor,
    textColor:
      typeof dimension.textColor === "string"
        ? dimension.textColor
        : DEFAULT_MARKUP_STYLE.dimensionTextColor,
    lineWidth:
      Number.isFinite(dimension.lineWidth) &&
      (dimension.lineWidth as number) > 0
        ? (dimension.lineWidth as number)
        : DEFAULT_MARKUP_STYLE.dimensionLineWidth,
    startArrow:
      typeof dimension.startArrow === "boolean"
        ? dimension.startArrow
        : DEFAULT_MARKUP_STYLE.dimensionStartArrow,
    endArrow:
      typeof dimension.endArrow === "boolean"
        ? dimension.endArrow
        : DEFAULT_MARKUP_STYLE.dimensionEndArrow,
    labelOffset: dimension.labelOffset,
  };
}

function normaliseShape(value: unknown): ShapeMarkup | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shape = value as Partial<ShapeMarkup>;

  if (
    typeof shape.id !== "string" ||
    (shape.type !== "rectangle" && shape.type !== "ellipse") ||
    !shape.start ||
    !shape.end
  ) {
    return null;
  }

  return {
    id: shape.id,
    type: shape.type,
    start: shape.start,
    end: shape.end,
    fillColor:
      typeof shape.fillColor === "string"
        ? shape.fillColor
        : DEFAULT_MARKUP_STYLE.shapeFillColor,
    opacity:
      Number.isFinite(shape.opacity) &&
      (shape.opacity as number) >= 0 &&
      (shape.opacity as number) <= 1
        ? (shape.opacity as number)
        : DEFAULT_MARKUP_STYLE.shapeOpacity,
    strokeColor:
      typeof shape.strokeColor === "string"
        ? shape.strokeColor
        : DEFAULT_MARKUP_STYLE.shapeStrokeColor,
    strokeWidth:
      Number.isFinite(shape.strokeWidth) &&
      (shape.strokeWidth as number) >= 0
        ? (shape.strokeWidth as number)
        : DEFAULT_MARKUP_STYLE.shapeStrokeWidth,
  };
}

function createEmptyEditorState(): SavedPdfMarkupEditor {
  return {
    base: null,
    overlay: null,
    overlayTransform: cloneDefaultOverlayTransform(),
    calibration: null,
    dimensions: [],
    shapes: [],
    markupStyle: cloneDefaultMarkupStyle(),
  };
}

function parseEditorState(value: unknown): SavedPdfMarkupEditor {
  if (!value || typeof value !== "object") {
    return createEmptyEditorState();
  }

  const saved = value as Partial<SavedPdfMarkupEditor>;

  const overlayTransform =
    saved.overlayTransform && typeof saved.overlayTransform === "object"
      ? {
          ...cloneDefaultOverlayTransform(),
          ...saved.overlayTransform,
        }
      : cloneDefaultOverlayTransform();

  const markupStyle =
    saved.markupStyle && typeof saved.markupStyle === "object"
      ? {
          ...cloneDefaultMarkupStyle(),
          ...saved.markupStyle,
        }
      : cloneDefaultMarkupStyle();

  const dimensions = Array.isArray(saved.dimensions)
    ? saved.dimensions
        .map(normaliseDimension)
        .filter((item): item is DimensionMarkup => Boolean(item))
    : [];

  const shapes = Array.isArray(saved.shapes)
    ? saved.shapes
        .map(normaliseShape)
        .filter((item): item is ShapeMarkup => Boolean(item))
    : [];

  return {
    base:
      saved.base &&
      typeof saved.base.fileId === "string" &&
      Number.isFinite(saved.base.pageNumber)
        ? saved.base
        : null,
    overlay:
      saved.overlay &&
      typeof saved.overlay.fileId === "string" &&
      Number.isFinite(saved.overlay.pageNumber)
        ? saved.overlay
        : null,
    overlayTransform,
    calibration:
      saved.calibration &&
      typeof saved.calibration === "object" &&
      Number.isFinite(saved.calibration.mmPerPixel)
        ? saved.calibration
        : null,
    dimensions,
    shapes,
    markupStyle,
  };
}

async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      result && typeof result === "object" && "message" in result
        ? String(
            (result as { message?: unknown }).message ??
              fallbackMessage,
          )
        : fallbackMessage;

    throw new Error(message);
  }

  return result as T;
}

export default function PdfEditorPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const hasLoadedRef = useRef(false);

  const [job, setJob] = useState<Job | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [baseSelection, setBaseSelection] =
    useState<PdfPageSelection | null>(null);
  const [overlaySelection, setOverlaySelection] =
    useState<PdfPageSelection | null>(null);
  const [overlayTransform, setOverlayTransform] =
    useState<OverlayTransform>(cloneDefaultOverlayTransform());
  const [calibration, setCalibration] =
    useState<EditorCalibration | null>(null);
  const [dimensions, setDimensions] =
    useState<DimensionMarkup[]>([]);
  const [shapes, setShapes] = useState<ShapeMarkup[]>([]);
  const [markupStyle, setMarkupStyle] =
    useState<MarkupStyle>(cloneDefaultMarkupStyle());

  const [basePage, setBasePage] =
    useState<RenderedPdfPage | null>(null);
  const [overlayPage, setOverlayPage] =
    useState<RenderedPdfPage | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [renderError, setRenderError] = useState("");

  const [tool, setTool] = useState<EditorTool>("select");
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [alignmentDraft, setAlignmentDraft] =
    useState<AlignmentDraft>({});
  const [pendingCalibration, setPendingCalibration] =
    useState<PendingCalibration | null>(null);
  const [baseGrayscale, setBaseGrayscale] = useState(false);
  const [pendingDimension, setPendingDimension] =
    useState<PendingDimension | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const editorFiles = useMemo<EditorPdfFile[]>(() => {
    return (job?.files ?? [])
      .filter((file) => {
        if (file.mimeType) {
          return file.mimeType === "application/pdf";
        }

        return file.originalName.toLowerCase().endsWith(".pdf");
      })
      .map((file) => {
        const rawPath = file.url ?? file.path ?? "";
        const sourceUrl = /^https?:\/\//i.test(rawPath)
          ? rawPath
          : `${API_URL}${rawPath}`;

        return {
          id: file.id,
          originalName: file.originalName,
          sourceUrl,
        };
      });
  }, [job]);

  const currentPickerSelection =
    pickerMode === "base" ? baseSelection : overlaySelection;

  useEffect(() => {
    if (!jobId) {
      setLoadError("No job ID was provided.");
      setLoadingJob(false);
      return;
    }

    let cancelled = false;

    async function loadJob() {
      hasLoadedRef.current = false;
      setLoadingJob(true);
      setLoadError("");
      setSaveError("");
      setExportError("");

      try {
        const response = await fetch(
          `${API_URL}/api/quoted-jobs/${jobId}`,
        );

        const loadedJob = await readJsonResponse<Job>(
          response,
          "Unable to load quote.",
        );

        if (cancelled) {
          return;
        }

        setJob({
          ...loadedJob,
          files: loadedJob.files ?? [],
        });

        const saved = parseEditorState(loadedJob.markupEditor);

        setBaseSelection(saved.base);
        setOverlaySelection(saved.overlay);
        setOverlayTransform(saved.overlayTransform);
        setCalibration(saved.calibration);
        setDimensions(saved.dimensions);
        setShapes(saved.shapes);
        setMarkupStyle(saved.markupStyle);
        setAlignmentDraft({});
        setTool("select");
        setLastSavedAt(null);

        hasLoadedRef.current = true;

        if (!saved.base && (loadedJob.files ?? []).length > 0) {
          setPickerMode("base");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load the markup editor.",
        );
      } finally {
        if (!cancelled) {
          setLoadingJob(false);
        }
      }
    }

    void loadJob();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!baseSelection) {
      setBasePage(null);
      return;
    }

    const file = editorFiles.find(
      (item) => item.id === baseSelection.fileId,
    );

    if (!file) {
      setBasePage(null);
      setRenderError(
        "The saved base PDF is no longer attached to this job.",
      );
      return;
    }

    const sourceUrl = file.sourceUrl;
    const pageNumber = baseSelection.pageNumber;

    let cancelled = false;

    async function renderBase() {
      setLoadingBase(true);
      setRenderError("");

      try {
        const rendered = await renderPdfPageToDataUrl(
          sourceUrl,
          pageNumber,
          PAGE_RENDER_SCALE,
        );
        const image = await loadHtmlImage(rendered.src);

        if (cancelled) {
          return;
        }

        setBasePage({
          ...rendered,
          image,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBasePage(null);
        setRenderError(
          error instanceof Error
            ? error.message
            : "Unable to render the base PDF page.",
        );
      } finally {
        if (!cancelled) {
          setLoadingBase(false);
        }
      }
    }

    void renderBase();

    return () => {
      cancelled = true;
    };
  }, [baseSelection, editorFiles]);

  useEffect(() => {
    if (!overlaySelection) {
      setOverlayPage(null);
      return;
    }

    const { fileId: overlayFileId, pageNumber: overlayPageNumber } =
      overlaySelection;

    const file = editorFiles.find(
      (item) => item.id === overlayFileId,
    );

    if (!file) {
      setOverlayPage(null);
      setRenderError(
        "The saved overlay PDF is no longer attached to this job.",
      );
      return;
    }

    const overlaySourceUrl = file.sourceUrl;

    let cancelled = false;

    async function renderOverlay() {
      setLoadingOverlay(true);
      setRenderError("");

      try {
        const rendered = await renderPdfPageToDataUrl(
          overlaySourceUrl,
          overlayPageNumber,
          PAGE_RENDER_SCALE,
        );
        const image = await loadHtmlImage(rendered.src);

        if (cancelled) {
          return;
        }

        setOverlayPage({
          ...rendered,
          image,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setOverlayPage(null);
        setRenderError(
          error instanceof Error
            ? error.message
            : "Unable to render the overlay PDF page.",
        );
      } finally {
        if (!cancelled) {
          setLoadingOverlay(false);
        }
      }
    }

    void renderOverlay();

    return () => {
      cancelled = true;
    };
  }, [overlaySelection, editorFiles]);

  useEffect(() => {
    if (!hasLoadedRef.current || !jobId) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const markupEditor: SavedPdfMarkupEditor = {
        base: baseSelection,
        overlay: overlaySelection,
        overlayTransform,
        calibration,
        dimensions,
        shapes,
        markupStyle,
      };

      setIsSaving(true);
      setSaveError("");

      try {
        const response = await fetch(
          `${API_URL}/api/quoted-jobs/${jobId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ markupEditor }),
          },
        );

        await readJsonResponse(
          response,
          "Unable to save markup editor.",
        );

        setLastSavedAt(new Date());
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to save markup editor.",
        );
      } finally {
        setIsSaving(false);
      }
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    jobId,
    baseSelection,
    overlaySelection,
    overlayTransform,
    calibration,
    dimensions,
    shapes,
    markupStyle,
  ]);

  function handlePageSelected(selection: PdfPageSelection) {
    if (pickerMode === "base") {
      const baseChanged =
        !baseSelection ||
        baseSelection.fileId !== selection.fileId ||
        baseSelection.pageNumber !== selection.pageNumber;

      if (
        baseChanged &&
        (dimensions.length > 0 || shapes.length > 0 || calibration) &&
        !window.confirm(
          "Changing the base page will clear the current scale, dimensions and shapes. Continue?",
        )
      ) {
        return;
      }

      setBaseSelection(selection);

      if (baseChanged) {
        setCalibration(null);
        setDimensions([]);
        setShapes([]);
        setAlignmentDraft({});
        setTool("select");
      }
    }

    if (pickerMode === "overlay") {
      setOverlaySelection(selection);
      setOverlayTransform(cloneDefaultOverlayTransform());
      setAlignmentDraft({});
      setTool("select");
    }

    setPickerMode(null);
  }

  function removeOverlay() {
    if (!overlaySelection) {
      return;
    }

    const confirmed = window.confirm(
      "Remove the overlay layer? Your scale, dimensions and shapes will remain.",
    );

    if (!confirmed) {
      return;
    }

    setOverlaySelection(null);
    setOverlayPage(null);
    setOverlayTransform(cloneDefaultOverlayTransform());
    setAlignmentDraft({});
    setTool("select");
  }

  function clearDimensions() {
    if (dimensions.length === 0) {
      return;
    }

    if (!window.confirm("Clear all dimension markup from this base page?")) {
      return;
    }

    setDimensions([]);
  }

  function clearShapes() {
    if (shapes.length === 0) {
      return;
    }

    if (!window.confirm("Clear all solid shapes from this base page?")) {
      return;
    }

    setShapes([]);
  }

  function undoLastDimension() {
    setDimensions((current) => current.slice(0, -1));
  }

  function undoLastShape() {
    setShapes((current) => current.slice(0, -1));
  }

  function deleteDimension(id: string) {
    setDimensions((current) => current.filter((item) => item.id !== id));
  }

  function deleteShape(id: string) {
    setShapes((current) => current.filter((item) => item.id !== id));
  }

  function moveDimensionLabel(id: string, labelOffset: { x: number; y: number }) {
    setDimensions((current) =>
      current.map((item) => (item.id === id ? { ...item, labelOffset } : item)),
    );
  }

  function updateDimensionPoints(
    id: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    setDimensions((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const pixelDistance = Math.hypot(
          end.x - start.x,
          end.y - start.y,
        );

        return {
          ...item,
          start,
          end,
          measuredMm: calibration
            ? pixelDistance * calibration.mmPerPixel
            : item.measuredMm,
        };
      }),
    );
  }

  function updateShapePoints(
    id: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    setShapes((current) =>
      current.map((item) =>
        item.id === id ? { ...item, start, end } : item,
      ),
    );
  }

  function startEditDimensionText(id: string) {
    const dimension = dimensions.find((item) => item.id === id);

    if (!dimension) {
      return;
    }

    setPendingDimension({
      id: dimension.id,
      start: dimension.start,
      end: dimension.end,
      measuredMm: dimension.measuredMm,
      initialLabel: dimension.label,
      initialText: dimension.displayText,
    });
  }

  async function handleExportPdf() {
    if (!basePage) {
      return;
    }

    setIsExporting(true);
    setExportError("");

    try {
      await exportMarkupPdf({
        fileName: `${job?.name ?? "Job"} - Markup`,
        basePage,
        overlayPage,
        overlayTransform,
        dimensions,
        shapes,
        baseGrayscale,
        labelScale: markupStyle.labelScale,
        labelOpacity: markupStyle.labelOpacity,
      });
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Unable to export the marked-up PDF.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  function addShape(
    type: ShapeType,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    setShapes((current) => [
      ...current,
      {
        id: createId(),
        type,
        start,
        end,
        fillColor: markupStyle.shapeFillColor,
        opacity: markupStyle.shapeOpacity,
        strokeColor: markupStyle.shapeStrokeColor,
        strokeWidth: markupStyle.shapeStrokeWidth,
      },
    ]);
  }

  if (loadingJob) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <div className="rounded-xl bg-white px-8 py-6 text-sm text-slate-600 shadow-sm">
          Loading markup editor…
        </div>
      </main>
    );
  }

  if (loadError || !job) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {loadError || "Quote not found."}
        </div>
      </main>
    );
  }

  const tools: Array<{
    id: EditorTool;
    label: string;
    disabled?: boolean;
    activeClass: string;
  }> = [
    {
      id: "select",
      label: "Select / Move Overlay",
      activeClass: "bg-slate-800 text-white",
    },
    {
      id: "pan",
      label: "Pan",
      activeClass: "bg-slate-800 text-white",
    },
    {
      id: "align",
      label: "2-Point Align",
      disabled: !overlayPage,
      activeClass: "bg-violet-600 text-white",
    },
    {
      id: "calibrate",
      label: calibration ? "Reset Scale" : "Set Scale",
      disabled: !basePage,
      activeClass: "bg-amber-500 text-white",
    },
    {
      id: "dimension",
      label: "Dimension",
      disabled: !basePage || !calibration,
      activeClass: "bg-blue-600 text-white",
    },
    {
      id: "shape-rectangle",
      label: "Rectangle",
      disabled: !basePage,
      activeClass: "bg-rose-600 text-white",
    },
    {
      id: "shape-ellipse",
      label: "Ellipse",
      disabled: !basePage,
      activeClass: "bg-rose-600 text-white",
    },
    {
      id: "edit",
      label: "Edit",
      disabled: !basePage,
      activeClass: "bg-indigo-600 text-white",
    },
    {
      id: "delete",
      label: "Delete",
      disabled: !basePage,
      activeClass: "bg-red-600 text-white",
    },
  ];

  return (
    <main className="flex h-screen min-h-[700px] flex-col overflow-hidden bg-slate-100">
      <header className="z-40 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">
              Overlay Markup Editor · {job.name}
            </h1>
            <p className="truncate text-xs text-slate-500">
              {job.address ||
                "Align plan pages, add dimensions and shapes, then export a marked-up PDF."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            {(loadingBase || loadingOverlay) && (
              <span className="text-slate-500">Rendering PDF…</span>
            )}

            {isSaving ? (
              <span className="font-medium text-blue-600">Saving…</span>
            ) : lastSavedAt ? (
              <span className="font-medium text-emerald-600">Saved</span>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!basePage || isExporting}
            onClick={() => void handleExportPdf()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </header>

      <div className="z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-3">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              setTool(item.id);

              if (item.id === "align") {
                setAlignmentDraft({});
              }
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              tool === item.id
                ? item.activeClass
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => setPickerMode("base")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Choose Base
        </button>

        <button
          type="button"
          disabled={!baseSelection}
          onClick={() => setPickerMode("overlay")}
          className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {overlaySelection ? "Change Overlay" : "Add Overlay"}
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            disabled={dimensions.length === 0}
            onClick={undoLastDimension}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Dimension
          </button>

          <button
            type="button"
            disabled={shapes.length === 0}
            onClick={undoLastShape}
            className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Shape
          </button>
        </div>
      </div>

      {(renderError || saveError || exportError) && (
        <div className="z-40 shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
          {renderError || saveError || exportError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="relative min-h-0 flex-1">
          <AlignmentTool
            visible={tool === "align" && Boolean(overlayPage)}
            draft={alignmentDraft}
            onReset={() => setAlignmentDraft({})}
          />

          <PdfEditorCanvas
            basePage={basePage}
            overlayPage={overlayPage}
            tool={tool}
            overlayTransform={overlayTransform}
            alignmentDraft={alignmentDraft}
            calibration={calibration}
            dimensions={dimensions}
            shapes={shapes}
            markupStyle={markupStyle}
            onOverlayTransformChange={setOverlayTransform}
            onAlignmentDraftChange={setAlignmentDraft}
            onAlignmentComplete={() => {
              setAlignmentDraft({});
              setTool("select");
            }}
            onCalibrationLineComplete={(start, end, pixelDistance) => {
              setPendingCalibration({
                start,
                end,
                pixelDistance,
              });
            }}
            onDimensionLineComplete={(start, end, measuredMm) => {
              setPendingDimension({
                start,
                end,
                measuredMm,
              });
            }}
            onShapeComplete={addShape}
            onDeleteDimension={deleteDimension}
            onDeleteShape={deleteShape}
            onEditDimensionText={startEditDimensionText}
            onUpdateDimensionPoints={updateDimensionPoints}
            onMoveDimensionLabel={moveDimensionLabel}
            baseGrayscale={baseGrayscale}
            onToggleGrayscale={() => setBaseGrayscale((v) => !v)}
            onUpdateShapePoints={updateShapePoints}
          />
        </section>

        <LayerPanel
          files={editorFiles}
          base={baseSelection}
          overlay={overlaySelection}
          overlayTransform={overlayTransform}
          calibration={calibration}
          dimensionCount={dimensions.length}
          shapeCount={shapes.length}
          markupStyle={markupStyle}
          onChooseBase={() => setPickerMode("base")}
          onChooseOverlay={() => setPickerMode("overlay")}
          onRemoveOverlay={removeOverlay}
          onOverlayTransformChange={setOverlayTransform}
          onResetOverlayTransform={() => {
            setOverlayTransform(cloneDefaultOverlayTransform());
            setAlignmentDraft({});
          }}
          onMarkupStyleChange={setMarkupStyle}
          onClearCalibration={() => {
            setCalibration(null);
            setTool("select");
          }}
          onClearDimensions={clearDimensions}
          onClearShapes={clearShapes}
        />
      </div>

      <PagePicker
        open={pickerMode !== null}
        title={
          pickerMode === "base"
            ? "Choose Base Page"
            : "Choose Overlay Page"
        }
        files={editorFiles}
        initialSelection={currentPickerSelection}
        onClose={() => setPickerMode(null)}
        onSelect={handlePageSelected}
      />

      <CalibrationDialog
        open={Boolean(pendingCalibration)}
        pixelDistance={pendingCalibration?.pixelDistance ?? 0}
        onCancel={() => setPendingCalibration(null)}
        onSave={(realDistanceMm) => {
          if (!pendingCalibration) {
            return;
          }

          setCalibration({
            start: pendingCalibration.start,
            end: pendingCalibration.end,
            realDistanceMm,
            pixelDistance: pendingCalibration.pixelDistance,
            mmPerPixel:
              realDistanceMm / pendingCalibration.pixelDistance,
          });

          setPendingCalibration(null);
          setTool("select");
        }}
      />

      <DimensionDialog
        open={Boolean(pendingDimension)}
        measuredMm={pendingDimension?.measuredMm ?? 0}
        initialLabel={pendingDimension?.initialLabel}
        initialText={pendingDimension?.initialText}
        title={pendingDimension?.id ? "Edit Dimension" : "Add Dimension"}
        confirmLabel={pendingDimension?.id ? "Save" : "Add Dimension"}
        onCancel={() => setPendingDimension(null)}
        onSave={(label, displayText) => {
          if (!pendingDimension) {
            return;
          }

          if (pendingDimension.id) {
            const editId = pendingDimension.id;

            setDimensions((current) =>
              current.map((item) =>
                item.id === editId
                  ? { ...item, label, displayText }
                  : item,
              ),
            );
          } else {
            const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
              Math.hypot(a.x - b.x, a.y - b.y) < 20;
            const p = pendingDimension;
            const duplicate = dimensions.some(
              (d) =>
                (near(d.start, p.start) && near(d.end, p.end)) ||
                (near(d.start, p.end) && near(d.end, p.start)),
            );

            if (
              duplicate &&
              !window.confirm(
                "A dimension already sits on this same line. Add a second one anyway?",
              )
            ) {
              return;
            }

            setDimensions((current) => [
              ...current,
              {
                id: createId(),
                start: pendingDimension.start,
                end: pendingDimension.end,
                measuredMm: pendingDimension.measuredMm,
                label,
                displayText,
                lineColor: markupStyle.dimensionLineColor,
                textColor: markupStyle.dimensionTextColor,
                lineWidth: markupStyle.dimensionLineWidth,
                startArrow: markupStyle.dimensionStartArrow,
                endArrow: markupStyle.dimensionEndArrow,
              },
            ]);
          }

          setPendingDimension(null);
        }}
      />
    </main>
  );
}
