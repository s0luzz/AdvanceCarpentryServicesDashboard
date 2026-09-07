import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { KonvaEventObject } from "konva/lib/Node";

import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

import {
  Image as KonvaImage,
  Layer,
  Line as KonvaLine,
  Rect as KonvaRect,
  Stage,
} from "react-konva";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfViewerProps = {
  jobId: string;
  file: File | string;
  onClose?: () => void;
};

type DrawAction = "box" | "line";

type GraphicColor =
  | "red"
  | "blue"
  | "green";

type BoxShape = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type LineShape = {
  id: string;

  points: [
    number,
    number,
    number,
    number,
  ];

  color: string;
  thickness: number;

  startTail: boolean;
  endTail: boolean;
};

type CanvasSize = {
  width: number;
  height: number;
};

type PanPosition = {
  x: number;
  y: number;
};

type HistoryEntry = {
  type: DrawAction;
  id: string;
};

type PanDragStart = {
  mouseX: number;
  mouseY: number;
  panX: number;
  panY: number;
};

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 800;

const MAX_CANVAS_WIDTH = 1100;
const MAX_CANVAS_HEIGHT = 1400;

const PREVIEW_WIDTH = 160;

const PDF_RESOLUTION_MULTIPLIER = 5;

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

const MIN_LINE_THICKNESS = 1;
const MAX_LINE_THICKNESS = 20;

const GRAPHIC_COLORS: Record<
  GraphicColor,
  string
> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isEditableTarget(
  target: EventTarget | null,
) {
  const element =
    target as HTMLElement | null;

  if (!element) {
    return false;
  }

  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}

function getArrowHeadPoints(
  tipX: number,
  tipY: number,

  directionX: number,
  directionY: number,

  length: number,
  halfWidth: number,
): [
  number,
  number,
  number,
  number,
  number,
  number,
] {
  const baseX =
    tipX -
    directionX *
      length;

  const baseY =
    tipY -
    directionY *
      length;

  const perpendicularX =
    -directionY;

  const perpendicularY =
    directionX;

  const firstX =
    baseX +
    perpendicularX *
      halfWidth;

  const firstY =
    baseY +
    perpendicularY *
      halfWidth;

  const secondX =
    baseX -
    perpendicularX *
      halfWidth;

  const secondY =
    baseY -
    perpendicularY *
      halfWidth;

  return [
    firstX,
    firstY,

    tipX,
    tipY,

    secondX,
    secondY,
  ];
}

export default function PdfViewer({
  onClose,
}: PdfViewerProps) {
  const [
    drawAction,
    setDrawAction,
  ] = useState<DrawAction>(
    "box",
  );

  const [
    graphicColor,
    setGraphicColor,
  ] = useState<GraphicColor>(
    "red",
  );

  const [
    lineThickness,
    setLineThickness,
  ] = useState(4);

  const [
    startTail,
    setStartTail,
  ] = useState(false);

  const [
    endTail,
    setEndTail,
  ] = useState(false);

  const [
    boxes,
    setBoxes,
  ] = useState<BoxShape[]>([]);

  const [
    lines,
    setLines,
  ] = useState<LineShape[]>([]);

  const [
    pdfFile,
    setPdfFile,
  ] = useState<File | null>(
    null,
  );

  const [
    numberOfPages,
    setNumberOfPages,
  ] = useState(0);

  const [
    isPagePickerOpen,
    setIsPagePickerOpen,
  ] = useState(false);

  const [
    selectedPreviewPage,
    setSelectedPreviewPage,
  ] = useState<
    number | null
  >(null);

  const [
    selectedPage,
    setSelectedPage,
  ] = useState<
    number | null
  >(null);

  const [
    selectedPageImage,
    setSelectedPageImage,
  ] = useState<
    HTMLImageElement | null
  >(null);

  const [
    canvasSize,
    setCanvasSize,
  ] = useState<CanvasSize>({
    width:
      DEFAULT_CANVAS_WIDTH,

    height:
      DEFAULT_CANVAS_HEIGHT,
  });

  const [
    isImporting,
    setIsImporting,
  ] = useState(false);

  const [
    scale,
    setScale,
  ] = useState(1);

  const [
    pan,
    setPan,
  ] = useState<PanPosition>({
    x: 0,
    y: 0,
  });

  const [
    isPanKeyHeld,
    setIsPanKeyHeld,
  ] = useState(false);

  const [
    isPanning,
    setIsPanning,
  ] = useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const stageRef =
    useRef<any>(null);

  const isDrawingRef =
    useRef(false);

  const currentShapeRef =
    useRef<string | null>(
      null,
    );

  const scaleRef =
    useRef(1);

  const panRef =
    useRef<PanPosition>({
      x: 0,
      y: 0,
    });

  const isPanKeyHeldRef =
    useRef(false);

  const panDragStartRef =
    useRef<PanDragStart | null>(
      null,
    );

  const historyRef =
    useRef<HistoryEntry[]>([]);

  function updateScale(
    nextScale: number,
  ) {
    scaleRef.current =
      nextScale;

    setScale(
      nextScale,
    );
  }

  function updatePan(
    nextPan: PanPosition,
  ) {
    panRef.current =
      nextPan;

    setPan(
      nextPan,
    );
  }

  function resetView() {
    updateScale(1);

    updatePan({
      x: 0,
      y: 0,
    });
  }

  function clearGraphics() {
    setBoxes([]);
    setLines([]);

    historyRef.current =
      [];

    isDrawingRef.current =
      false;

    currentShapeRef.current =
      null;
  }

  const undoLast =
    useCallback(() => {
      const lastEntry =
        historyRef.current.pop();

      if (!lastEntry) {
        return;
      }

      isDrawingRef.current =
        false;

      currentShapeRef.current =
        null;

      if (
        lastEntry.type ===
        "box"
      ) {
        setBoxes(
          (current) =>
            current.filter(
              (box) =>
                box.id !==
                lastEntry.id,
            ),
        );

        return;
      }

      setLines(
        (current) =>
          current.filter(
            (line) =>
              line.id !==
              lastEntry.id,
          ),
      );
    }, []);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        isPagePickerOpen
      ) {
        return;
      }

      if (
        isEditableTarget(
          event.target,
        )
      ) {
        return;
      }

      const isUndo =
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "z";

      if (isUndo) {
        event.preventDefault();

        undoLast();

        return;
      }

      if (
        event.key.toLowerCase() ===
          "h" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();

        if (
          event.repeat
        ) {
          return;
        }

        isPanKeyHeldRef.current =
          true;

        setIsPanKeyHeld(
          true,
        );
      }
    }

    function handleKeyUp(
      event: KeyboardEvent,
    ) {
      if (
        event.key.toLowerCase() !==
        "h"
      ) {
        return;
      }

      isPanKeyHeldRef.current =
        false;

      setIsPanKeyHeld(
        false,
      );

      panDragStartRef.current =
        null;

      setIsPanning(
        false,
      );
    }

    function handleWindowBlur() {
      isPanKeyHeldRef.current =
        false;

      setIsPanKeyHeld(
        false,
      );

      panDragStartRef.current =
        null;

      setIsPanning(
        false,
      );

      isDrawingRef.current =
        false;

      currentShapeRef.current =
        null;
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    window.addEventListener(
      "keyup",
      handleKeyUp,
    );

    window.addEventListener(
      "blur",
      handleWindowBlur,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      window.removeEventListener(
        "keyup",
        handleKeyUp,
      );

      window.removeEventListener(
        "blur",
        handleWindowBlur,
      );
    };
  }, [
    isPagePickerOpen,
    undoLast,
  ]);

  useEffect(() => {
    function handleGlobalMouseMove(
      event: MouseEvent,
    ) {
      const dragStart =
        panDragStartRef.current;

      if (
        !dragStart ||
        !isPanKeyHeldRef.current
      ) {
        return;
      }

      const nextPan = {
        x:
          dragStart.panX +
          event.clientX -
          dragStart.mouseX,

        y:
          dragStart.panY +
          event.clientY -
          dragStart.mouseY,
      };

      panRef.current =
        nextPan;

      setPan(
        nextPan,
      );
    }

    function handleGlobalMouseUp() {
      panDragStartRef.current =
        null;

      setIsPanning(
        false,
      );

      isDrawingRef.current =
        false;

      currentShapeRef.current =
        null;
    }

    window.addEventListener(
      "mousemove",
      handleGlobalMouseMove,
    );

    window.addEventListener(
      "mouseup",
      handleGlobalMouseUp,
    );

    return () => {
      window.removeEventListener(
        "mousemove",
        handleGlobalMouseMove,
      );

      window.removeEventListener(
        "mouseup",
        handleGlobalMouseUp,
      );
    };
  }, []);

  function zoomAroundPoint(
    requestedScale: number,

    screenPoint: {
      x: number;
      y: number;
    },
  ) {
    const currentScale =
      scaleRef.current;

    const nextScale =
      clamp(
        Number(
          requestedScale.toFixed(
            2,
          ),
        ),
        MIN_SCALE,
        MAX_SCALE,
      );

    if (
      nextScale ===
      currentScale
    ) {
      return;
    }

    const currentPan =
      panRef.current;

    const pointOnCanvas = {
      x:
        (screenPoint.x -
          currentPan.x) /
        currentScale,

      y:
        (screenPoint.y -
          currentPan.y) /
        currentScale,
    };

    const nextPan = {
      x:
        screenPoint.x -
        pointOnCanvas.x *
          nextScale,

      y:
        screenPoint.y -
        pointOnCanvas.y *
          nextScale,
    };

    updateScale(
      nextScale,
    );

    updatePan(
      nextPan,
    );
  }

  function zoomIn() {
    zoomAroundPoint(
      scaleRef.current +
        SCALE_STEP,

      {
        x:
          canvasSize.width /
          2,

        y:
          canvasSize.height /
          2,
      },
    );
  }

  function zoomOut() {
    zoomAroundPoint(
      scaleRef.current -
        SCALE_STEP,

      {
        x:
          canvasSize.width /
          2,

        y:
          canvasSize.height /
          2,
      },
    );
  }

  function handleWheel(
    event:
      KonvaEventObject<WheelEvent>,
  ) {
    event.evt.preventDefault();

    const stage =
      stageRef.current;

    if (!stage) {
      return;
    }

    const pointer =
      stage.getPointerPosition();

    if (!pointer) {
      return;
    }

    const direction =
      event.evt.deltaY <
      0
        ? 1
        : -1;

    zoomAroundPoint(
      scaleRef.current +
        direction *
          SCALE_STEP,

      {
        x: pointer.x,
        y: pointer.y,
      },
    );
  }

  function getCanvasPointerPosition() {
    const stage =
      stageRef.current;

    if (!stage) {
      return null;
    }

    const pointer =
      stage.getPointerPosition();

    if (!pointer) {
      return null;
    }

    return {
      x:
        (pointer.x -
          panRef.current.x) /
        scaleRef.current,

      y:
        (pointer.y -
          panRef.current.y) /
        scaleRef.current,
    };
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handlePdfUpload(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const uploadedFile =
      event.target.files?.[0];

    if (!uploadedFile) {
      return;
    }

    if (
      uploadedFile.type !==
      "application/pdf"
    ) {
      return;
    }

    setPdfFile(
      uploadedFile,
    );

    setNumberOfPages(
      0,
    );

    setSelectedPreviewPage(
      null,
    );

    setSelectedPage(
      null,
    );

    setSelectedPageImage(
      null,
    );

    setCanvasSize({
      width:
        DEFAULT_CANVAS_WIDTH,

      height:
        DEFAULT_CANVAS_HEIGHT,
    });

    clearGraphics();

    resetView();

    setIsPagePickerOpen(
      true,
    );

    event.target.value =
      "";
  }

  async function importSelectedPage() {
    if (
      !pdfFile ||
      selectedPreviewPage ===
        null
    ) {
      return;
    }

    setIsImporting(
      true,
    );

    try {
      const arrayBuffer =
        await pdfFile.arrayBuffer();

      const loadingTask =
        pdfjs.getDocument({
          data: arrayBuffer,
        });

      const pdf =
        await loadingTask.promise;

      const page =
        await pdf.getPage(
          selectedPreviewPage,
        );

      const originalViewport =
        page.getViewport({
          scale: 1,
        });

      const displayScale =
        Math.min(
          MAX_CANVAS_WIDTH /
            originalViewport.width,

          MAX_CANVAS_HEIGHT /
            originalViewport.height,
        );

      const displayWidth =
        originalViewport.width *
        displayScale;

      const displayHeight =
        originalViewport.height *
        displayScale;

      const nextCanvasSize = {
        width:
          Math.round(
            displayWidth,
          ),

        height:
          Math.round(
            displayHeight,
          ),
      };

      const renderViewport =
        page.getViewport({
          scale:
            displayScale *
            PDF_RESOLUTION_MULTIPLIER,
        });

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        Math.ceil(
          renderViewport.width,
        );

      canvas.height =
        Math.ceil(
          renderViewport.height,
        );

      const context =
        canvas.getContext(
          "2d",
        );

      if (!context) {
        await pdf.destroy();

        return;
      }

      await page.render({
        canvas,

        canvasContext:
          context,

        viewport:
          renderViewport,
      }).promise;

      const image =
        new Image();

      image.src =
        canvas.toDataURL(
          "image/png",
        );

      await new Promise<void>(
        (
          resolve,
          reject,
        ) => {
          image.onload =
            () => {
              resolve();
            };

          image.onerror =
            () => {
              reject(
                new Error(
                  "Unable to create PDF page image.",
                ),
              );
            };
        },
      );

      setCanvasSize(
        nextCanvasSize,
      );

      setSelectedPageImage(
        image,
      );

      setSelectedPage(
        selectedPreviewPage,
      );

      clearGraphics();

      resetView();

      setIsPagePickerOpen(
        false,
      );

      await pdf.destroy();
    } catch (error) {
      console.error(
        "Unable to import PDF page:",
        error,
      );
    } finally {
      setIsImporting(
        false,
      );
    }
  }

  const handleMouseDown =
    useCallback(
      (
        event:
          KonvaEventObject<MouseEvent>,
      ) => {
        if (
          event.evt.button !==
          0
        ) {
          return;
        }

        if (
          isPanKeyHeldRef.current
        ) {
          event.evt.preventDefault();

          isDrawingRef.current =
            false;

          currentShapeRef.current =
            null;

          panDragStartRef.current =
            {
              mouseX:
                event.evt.clientX,

              mouseY:
                event.evt.clientY,

              panX:
                panRef.current.x,

              panY:
                panRef.current.y,
            };

          setIsPanning(
            true,
          );

          return;
        }

        const position =
          getCanvasPointerPosition();

        if (!position) {
          return;
        }

        const {
          x,
          y,
        } =
          position;

        const id =
          createId();

        const color =
          GRAPHIC_COLORS[
            graphicColor
          ];

        currentShapeRef.current =
          id;

        isDrawingRef.current =
          true;

        historyRef.current.push({
          type:
            drawAction,

          id,
        });

        if (
          drawAction ===
          "box"
        ) {
          setBoxes(
            (
              current,
            ) => [
              ...current,

              {
                id,
                x,
                y,
                width: 1,
                height: 1,
                color,
              },
            ],
          );

          return;
        }

        const points:
          LineShape["points"] =
            [
              x,
              y,
              x,
              y,
            ];

        setLines(
          (
            current,
          ) => [
            ...current,

            {
              id,
              points,
              color,

              thickness:
                lineThickness,

              startTail,

              endTail,
            },
          ],
        );
      },
      [
        drawAction,
        graphicColor,
        lineThickness,
        startTail,
        endTail,
      ],
    );

  const handleMouseMove =
    useCallback(() => {
      if (
        isPanKeyHeldRef.current ||
        panDragStartRef.current
      ) {
        return;
      }

      if (
        !isDrawingRef.current
      ) {
        return;
      }

      const position =
        getCanvasPointerPosition();

      if (!position) {
        return;
      }

      const {
        x,
        y,
      } =
        position;

      const currentShapeId =
        currentShapeRef.current;

      if (
        drawAction ===
        "box"
      ) {
        setBoxes(
          (
            current,
          ) =>
            current.map(
              (
                box,
              ) =>
                box.id ===
                currentShapeId
                  ? {
                      ...box,

                      width:
                        x -
                        box.x,

                      height:
                        y -
                        box.y,
                    }
                  : box,
            ),
        );

        return;
      }

      setLines(
        (
          current,
        ) =>
          current.map(
            (
              line,
            ) => {
              if (
                line.id !==
                currentShapeId
              ) {
                return line;
              }

              const points:
                LineShape["points"] =
                  [
                    line
                      .points[0],

                    line
                      .points[1],

                    x,
                    y,
                  ];

              return {
                ...line,
                points,
              };
            },
          ),
      );
    }, [drawAction]);

  const handleMouseUp =
    useCallback(() => {
      if (
        panDragStartRef.current
      ) {
        panDragStartRef.current =
          null;

        setIsPanning(
          false,
        );

        return;
      }

      isDrawingRef.current =
        false;

      currentShapeRef.current =
        null;
    }, []);

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[650px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <input
        ref={
          fileInputRef
        }
        type="file"
        accept="application/pdf"
        onChange={
          handlePdfUpload
        }
        className="hidden"
      />

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          )}

          <span className="text-sm font-semibold text-slate-800">
            PDF Editor
          </span>

          {selectedPage !==
            null && (
            <span className="text-xs text-slate-500">
              Page{" "}
              {
                selectedPage
              }
            </span>
          )}

          {selectedPageImage && (
            <span className="text-xs text-slate-400">
              {canvasSize.width}
              {" × "}
              {canvasSize.height}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pdfFile && (
            <button
              type="button"
              onClick={() =>
                setIsPagePickerOpen(
                  true,
                )
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Choose Page
            </button>
          )}

          <button
            type="button"
            onClick={
              handleUploadClick
            }
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Upload PDF
          </button>
        </div>
      </header>

      <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"

          onClick={() =>
            setDrawAction(
              "box",
            )
          }

          className={`rounded-md px-4 py-2 text-sm font-medium ${
            drawAction ===
            "box"
              ? "bg-slate-800 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Box
        </button>

        <div className="group relative">
          <button
            type="button"

            onClick={() =>
              setDrawAction(
                "line",
              )
            }

            className={`rounded-md px-4 py-2 text-sm font-medium ${
              drawAction ===
              "line"
                ? "bg-slate-800 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Line
          </button>

          <div className="pointer-events-none absolute left-1/2 top-full z-50 w-40 -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="mb-4 flex h-12 items-center justify-center">
                <div
                  className="rounded-full"

                  style={{
                    width:
                      Math.max(
                        lineThickness,
                        2,
                      ),

                    height:
                      Math.max(
                        lineThickness,
                        2,
                      ),

                    backgroundColor:
                      GRAPHIC_COLORS[
                        graphicColor
                      ],
                  }}
                />
              </div>

              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Thickness
                </span>

                <span className="text-xs font-semibold text-slate-800">
                  {lineThickness}
                  {" px"}
                </span>
              </div>

              <input
                type="range"

                min={
                  MIN_LINE_THICKNESS
                }

                max={
                  MAX_LINE_THICKNESS
                }

                step={1}

                value={
                  lineThickness
                }

                onChange={(
                  event,
                ) =>
                  setLineThickness(
                    Number(
                      event.target.value,
                    ),
                  )
                }

                className="w-full cursor-pointer accent-slate-800"
              />

              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>
                  {
                    MIN_LINE_THICKNESS
                  }
                </span>

                <span>
                  {
                    MAX_LINE_THICKNESS
                  }
                </span>
              </div>

              <div className="my-3 h-px bg-slate-200" />

              <div className="mb-2 text-xs font-medium text-slate-600">
                Arrow tails
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    Start
                  </span>

                  <button
                    type="button"

                    role="switch"

                    aria-checked={
                      startTail
                    }

                    onClick={() =>
                      setStartTail(
                        (current) =>
                          !current,
                      )
                    }

                    className={`relative h-5 w-9 rounded-full transition ${
                      startTail
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                        startTail
                          ? "left-[18px]"
                          : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    End
                  </span>

                  <button
                    type="button"

                    role="switch"

                    aria-checked={
                      endTail
                    }

                    onClick={() =>
                      setEndTail(
                        (current) =>
                          !current,
                      )
                    }

                    className={`relative h-5 w-9 rounded-full transition ${
                      endTail
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                        endTail
                          ? "left-[18px]"
                          : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-slate-300" />

        <span className="text-sm font-medium text-slate-600">
          Colour
        </span>

        <button
          type="button"
          title="Red"

          onClick={() =>
            setGraphicColor(
              "red",
            )
          }

          className={`h-8 w-8 rounded-md bg-red-600 ${
            graphicColor ===
            "red"
              ? "ring-2 ring-slate-900 ring-offset-2"
              : "hover:opacity-80"
          }`}
        />

        <button
          type="button"
          title="Blue"

          onClick={() =>
            setGraphicColor(
              "blue",
            )
          }

          className={`h-8 w-8 rounded-md bg-blue-600 ${
            graphicColor ===
            "blue"
              ? "ring-2 ring-slate-900 ring-offset-2"
              : "hover:opacity-80"
          }`}
        />

        <button
          type="button"
          title="Green"

          onClick={() =>
            setGraphicColor(
              "green",
            )
          }

          className={`h-8 w-8 rounded-md bg-green-600 ${
            graphicColor ===
            "green"
              ? "ring-2 ring-slate-900 ring-offset-2"
              : "hover:opacity-80"
          }`}
        />

        <div className="mx-2 h-6 w-px bg-slate-300" />

        <button
          type="button"

          onClick={
            zoomOut
          }

          disabled={
            scale <=
            MIN_SCALE
          }

          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <span className="min-w-16 text-center text-sm font-medium text-slate-700">
          {Math.round(
            scale *
              100,
          )}
          %
        </span>

        <button
          type="button"

          onClick={
            zoomIn
          }

          disabled={
            scale >=
            MAX_SCALE
          }

          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>

        <button
          type="button"

          onClick={
            resetView
          }

          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset View
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span
            className={
              isPanKeyHeld
                ? "font-semibold text-slate-800"
                : ""
            }
          >
            Hold H to Pan
          </span>

          <span>•</span>

          <span>
            Ctrl/⌘ Z Undo
          </span>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-auto bg-slate-200 p-8">
        <div className="flex min-h-full justify-center">
          <div
            className={`shrink-0 overflow-hidden border border-slate-300 bg-white shadow-xl ${
              isPanning
                ? "cursor-grabbing"
                : isPanKeyHeld
                  ? "cursor-grab"
                  : "cursor-crosshair"
            }`}

            style={{
              width:
                canvasSize.width,

              height:
                canvasSize.height,
            }}
          >
            <Stage
              ref={
                stageRef
              }

              width={
                canvasSize.width
              }

              height={
                canvasSize.height
              }

              x={
                pan.x
              }

              y={
                pan.y
              }

              scaleX={
                scale
              }

              scaleY={
                scale
              }

              onWheel={
                handleWheel
              }

              onMouseDown={
                handleMouseDown
              }

              onMouseMove={
                handleMouseMove
              }

              onMouseUp={
                handleMouseUp
              }
            >
              <Layer>
                {selectedPageImage && (
                  <KonvaImage
                    image={
                      selectedPageImage
                    }

                    x={0}
                    y={0}

                    width={
                      canvasSize.width
                    }

                    height={
                      canvasSize.height
                    }

                    listening={
                      false
                    }
                  />
                )}

                {boxes.map(
                  (
                    box,
                  ) => (
                    <KonvaRect
                      key={
                        box.id
                      }

                      x={
                        box.x
                      }

                      y={
                        box.y
                      }

                      width={
                        box.width
                      }

                      height={
                        box.height
                      }

                      stroke={
                        box.color
                      }

                      strokeWidth={
                        2 /
                        scale
                      }

                      listening={
                        false
                      }
                    />
                  ),
                )}

                {lines.map(
                  (
                    line,
                  ) => {
                    const [
                      startX,
                      startY,
                      endX,
                      endY,
                    ] =
                      line.points;

                    const deltaX =
                      endX -
                      startX;

                    const deltaY =
                      endY -
                      startY;

                    const length =
                      Math.sqrt(
                        deltaX **
                          2 +
                          deltaY **
                            2,
                      );

                    const strokeWidth =
                      line.thickness /
                      scale;

                    if (
                      length === 0
                    ) {
                      return null;
                    }

                    const unitX =
                      deltaX /
                      length;

                    const unitY =
                      deltaY /
                      length;

                    /*
                     * Arrowhead dimensions grow
                     * with the selected line
                     * thickness.
                     *
                     * Dividing by zoom keeps the
                     * visual size consistent while
                     * zooming.
                     */
                    const arrowLength =
                      Math.max(
                        10,
                        line.thickness *
                          4,
                      ) /
                      scale;

                    const arrowHalfWidth =
                      Math.max(
                        5,
                        line.thickness *
                          2,
                      ) /
                      scale;

                    const startArrowPoints =
                      getArrowHeadPoints(
                        startX,
                        startY,

                        -unitX,
                        -unitY,

                        arrowLength,
                        arrowHalfWidth,
                      );

                    const endArrowPoints =
                      getArrowHeadPoints(
                        endX,
                        endY,

                        unitX,
                        unitY,

                        arrowLength,
                        arrowHalfWidth,
                      );

                    return (
                      <g key={line.id}>
                        <KonvaLine
                          points={
                            line.points
                          }

                          stroke={
                            line.color
                          }

                          strokeWidth={
                            strokeWidth
                          }

                          lineCap="round"

                          lineJoin="round"

                          listening={
                            false
                          }
                        />

                        {line.startTail && (
                          <KonvaLine
                            points={
                              startArrowPoints
                            }

                            stroke={
                              line.color
                            }

                            strokeWidth={
                              strokeWidth
                            }

                            lineCap="round"

                            lineJoin="round"

                            listening={
                              false
                            }
                          />
                        )}

                        {line.endTail && (
                          <KonvaLine
                            points={
                              endArrowPoints
                            }

                            stroke={
                              line.color
                            }

                            strokeWidth={
                              strokeWidth
                            }

                            lineCap="round"

                            lineJoin="round"

                            listening={
                              false
                            }
                          />
                        )}
                      </g>
                    );
                  },
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </main>

      {isPagePickerOpen &&
        pdfFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Choose PDF Page
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Select a page to place
                    on the canvas.
                  </p>
                </div>

                <button
                  type="button"

                  onClick={() =>
                    setIsPagePickerOpen(
                      false,
                    )
                  }

                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-5">
                <Document
                  file={
                    pdfFile
                  }

                  loading={
                    <div className="py-12 text-center text-sm text-slate-500">
                      Loading PDF…
                    </div>
                  }

                  error={
                    <div className="py-12 text-center text-sm text-red-600">
                      Unable to open PDF.
                    </div>
                  }

                  onLoadSuccess={({
                    numPages,
                  }) => {
                    setNumberOfPages(
                      numPages,
                    );

                    setSelectedPreviewPage(
                      (
                        current,
                      ) =>
                        current ??
                        1,
                    );
                  }}
                >
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from(
                      {
                        length:
                          numberOfPages,
                      },

                      (
                        _,
                        index,
                      ) => {
                        const pageNumber =
                          index +
                          1;

                        const isSelected =
                          selectedPreviewPage ===
                          pageNumber;

                        return (
                          <button
                            key={
                              pageNumber
                            }

                            type="button"

                            onClick={() =>
                              setSelectedPreviewPage(
                                pageNumber,
                              )
                            }

                            className={`overflow-hidden rounded-lg border-2 bg-white text-left shadow-sm transition ${
                              isSelected
                                ? "border-blue-600 ring-2 ring-blue-200"
                                : "border-transparent hover:border-slate-300"
                            }`}
                          >
                            <div className="flex justify-center overflow-hidden bg-slate-200 p-2">
                              <Page
                                pageNumber={
                                  pageNumber
                                }

                                width={
                                  PREVIEW_WIDTH
                                }

                                renderAnnotationLayer={
                                  false
                                }

                                renderTextLayer={
                                  false
                                }
                              />
                            </div>

                            <div
                              className={`px-3 py-2 text-center text-sm font-medium ${
                                isSelected
                                  ? "text-blue-700"
                                  : "text-slate-700"
                              }`}
                            >
                              Page{" "}
                              {
                                pageNumber
                              }
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </Document>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
                <span className="text-sm text-slate-500">
                  {selectedPreviewPage !==
                  null
                    ? `Page ${selectedPreviewPage} selected`
                    : "Select a page"}
                </span>

                <button
                  type="button"

                  disabled={
                    selectedPreviewPage ===
                      null ||
                    isImporting
                  }

                  onClick={
                    importSelectedPage
                  }

                  className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isImporting
                    ? "Loading…"
                    : "Use Page"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}