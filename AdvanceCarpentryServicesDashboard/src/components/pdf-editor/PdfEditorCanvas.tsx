import {
  useEffect,
  useRef,
  useState,
} from "react";
import Konva from "konva";
import {
  Arrow,
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type {
  AlignmentDraft,
  DimensionMarkup,
  EditorCalibration,
  EditorTool,
  MarkupStyle,
  OverlayTransform,
  Point,
  RenderedPdfPage,
  ShapeMarkup,
  ShapeType,
} from "./editorTypes";

type PdfEditorCanvasProps = {
  basePage: RenderedPdfPage | null;
  overlayPage: RenderedPdfPage | null;
  tool: EditorTool;
  overlayTransform: OverlayTransform;
  alignmentDraft: AlignmentDraft;
  calibration: EditorCalibration | null;
  dimensions: DimensionMarkup[];
  shapes: ShapeMarkup[];
  markupStyle: MarkupStyle;
  onOverlayTransformChange: (next: OverlayTransform) => void;
  onAlignmentDraftChange: (next: AlignmentDraft) => void;
  onAlignmentComplete: () => void;
  onCalibrationLineComplete: (
    start: Point,
    end: Point,
    pixelDistance: number,
  ) => void;
  onDimensionLineComplete: (
    start: Point,
    end: Point,
    measuredMm: number,
  ) => void;
  onShapeComplete: (
    type: ShapeType,
    start: Point,
    end: Point,
  ) => void;
  onDeleteDimension: (id: string) => void;
  onDeleteShape: (id: string) => void;
  onEditDimensionText: (id: string) => void;
  onMoveDimensionLabel: (id: string, offset: Point) => void;
  baseGrayscale: boolean;
  onToggleGrayscale: () => void;
  onUpdateDimensionPoints: (
    id: string,
    start: Point,
    end: Point,
  ) => void;
  onUpdateShapePoints: (
    id: string,
    start: Point,
    end: Point,
  ) => void;
};

const MIN_VIEW_SCALE = 0.08;
const MAX_VIEW_SCALE = 5;
const MIN_DRAW_LENGTH = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function overlayLocalToWorld(
  point: Point,
  transform: OverlayTransform,
): Point {
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const scaledX = point.x * transform.scale;
  const scaledY = point.y * transform.scale;

  return {
    x: transform.x + scaledX * cos - scaledY * sin,
    y: transform.y + scaledX * sin + scaledY * cos,
  };
}

function worldToOverlayLocal(
  point: Point,
  transform: OverlayTransform,
): Point {
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const safeScale = Math.max(transform.scale, 0.0001);

  const dx = point.x - transform.x;
  const dy = point.y - transform.y;

  return {
    x: (cos * dx + sin * dy) / safeScale,
    y: (-sin * dx + cos * dy) / safeScale,
  };
}

function createAlignedTransform(
  baseA: Point,
  baseB: Point,
  overlayA: Point,
  overlayB: Point,
  previous: OverlayTransform,
): OverlayTransform | null {
  const baseVector = {
    x: baseB.x - baseA.x,
    y: baseB.y - baseA.y,
  };

  const overlayVector = {
    x: overlayB.x - overlayA.x,
    y: overlayB.y - overlayA.y,
  };

  const baseLength = Math.hypot(baseVector.x, baseVector.y);
  const overlayLength = Math.hypot(
    overlayVector.x,
    overlayVector.y,
  );

  if (
    baseLength < MIN_DRAW_LENGTH ||
    overlayLength < MIN_DRAW_LENGTH
  ) {
    return null;
  }

  const scale = baseLength / overlayLength;
  const baseAngle = Math.atan2(baseVector.y, baseVector.x);
  const overlayAngle = Math.atan2(
    overlayVector.y,
    overlayVector.x,
  );
  const rotationRadians = baseAngle - overlayAngle;
  const rotation = (rotationRadians * 180) / Math.PI;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  const transformedOverlayA = {
    x: scale * (cos * overlayA.x - sin * overlayA.y),
    y: scale * (sin * overlayA.x + cos * overlayA.y),
  };

  return {
    ...previous,
    x: baseA.x - transformedOverlayA.x,
    y: baseA.y - transformedOverlayA.y,
    scale,
    rotation,
    visible: true,
  };
}

function isShapeTool(tool: EditorTool) {
  return tool === "shape-rectangle" || tool === "shape-ellipse";
}

export default function PdfEditorCanvas({
  basePage,
  overlayPage,
  tool,
  overlayTransform,
  alignmentDraft,
  calibration,
  dimensions,
  shapes,
  markupStyle,
  onOverlayTransformChange,
  onAlignmentDraftChange,
  onAlignmentComplete,
  onCalibrationLineComplete,
  onDimensionLineComplete,
  onShapeComplete,
  onDeleteDimension,
  onDeleteShape,
  onEditDimensionText,
  onUpdateDimensionPoints,
  onMoveDimensionLabel,
  baseGrayscale,
  onToggleGrayscale,
  onUpdateShapePoints,
}: PdfEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const baseImageRef = useRef<Konva.Image>(null);
  const overlayImageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [viewportSize, setViewportSize] = useState({
    width: 900,
    height: 700,
  });

  const [viewScale, setViewScale] = useState(1);
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  useEffect(() => {
    const node = baseImageRef.current;

    if (!node) {
      return;
    }

    node.cache();
    node.getLayer()?.batchDraw();
  }, [baseGrayscale, basePage]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      setViewportSize({
        width: Math.max(container.clientWidth, 320),
        height: Math.max(container.clientHeight, 320),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDrawStart(null);
    setHoverPoint(null);
  }, [tool]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const overlayNode = overlayImageRef.current;

    if (!transformer) {
      return;
    }

    if (
      tool === "select" &&
      overlayNode &&
      overlayPage &&
      overlayTransform.visible &&
      !overlayTransform.locked
    ) {
      transformer.nodes([overlayNode]);
    } else {
      transformer.nodes([]);
    }

    transformer.getLayer()?.batchDraw();
  }, [
    tool,
    overlayPage,
    overlayTransform.visible,
    overlayTransform.locked,
  ]);

  useEffect(() => {
    if (!basePage) {
      return;
    }

    fitToPage();
    // Refit whenever a new base page is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePage?.src]);

  function fitToPage() {
    if (!basePage) {
      return;
    }

    const padding = 48;
    const availableWidth = Math.max(
      viewportSize.width - padding * 2,
      100,
    );
    const availableHeight = Math.max(
      viewportSize.height - padding * 2,
      100,
    );

    const nextScale = clamp(
      Math.min(
        availableWidth / basePage.width,
        availableHeight / basePage.height,
      ),
      MIN_VIEW_SCALE,
      1,
    );

    setViewScale(nextScale);
    setViewPosition({
      x: (viewportSize.width - basePage.width * nextScale) / 2,
      y: (viewportSize.height - basePage.height * nextScale) / 2,
    });
  }

  function viewAtActualSize() {
    if (!basePage) {
      return;
    }

    setViewScale(1);
    setViewPosition({
      x: (viewportSize.width - basePage.width) / 2,
      y: (viewportSize.height - basePage.height) / 2,
    });
  }

  function getWorldPointer(): Point | null {
    const stage = stageRef.current;

    if (!stage) {
      return null;
    }

    const pointer = stage.getPointerPosition();

    if (!pointer) {
      return null;
    }

    return {
      x: (pointer.x - viewPosition.x) / viewScale,
      y: (pointer.y - viewPosition.y) / viewScale,
    };
  }

  function handleWheel(
    event: Konva.KonvaEventObject<WheelEvent>,
  ) {
    event.evt.preventDefault();

    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();

    if (!pointer) {
      return;
    }

    const oldScale = viewScale;
    const direction = event.evt.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? 1.12 : 1 / 1.12;
    const nextScale = clamp(
      oldScale * factor,
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE,
    );

    const worldPoint = {
      x: (pointer.x - viewPosition.x) / oldScale,
      y: (pointer.y - viewPosition.y) / oldScale,
    };

    setViewScale(nextScale);
    setViewPosition({
      x: pointer.x - worldPoint.x * nextScale,
      y: pointer.y - worldPoint.y * nextScale,
    });
  }

  function handlePointerDown() {
    if (!basePage) {
      return;
    }

    const point = getWorldPointer();

    if (!point) {
      return;
    }

    if (
      tool === "calibrate" ||
      tool === "dimension" ||
      isShapeTool(tool)
    ) {
      if (!drawStart) {
        setDrawStart(point);
        setHoverPoint(point);
        return;
      }

      const lineLength = distance(drawStart, point);

      if (lineLength < MIN_DRAW_LENGTH) {
        setDrawStart(null);
        setHoverPoint(null);
        return;
      }

      if (tool === "calibrate") {
        onCalibrationLineComplete(drawStart, point, lineLength);
      } else if (tool === "dimension") {
        if (calibration) {
          onDimensionLineComplete(
            drawStart,
            point,
            lineLength * calibration.mmPerPixel,
          );
        }
      } else {
        onShapeComplete(
          tool === "shape-rectangle" ? "rectangle" : "ellipse",
          drawStart,
          point,
        );
      }

      setDrawStart(null);
      setHoverPoint(null);
      return;
    }

    if (
      tool !== "align" ||
      !overlayPage ||
      !overlayTransform.visible
    ) {
      return;
    }

    if (!alignmentDraft.baseA) {
      onAlignmentDraftChange({
        ...alignmentDraft,
        baseA: point,
      });
      return;
    }

    if (!alignmentDraft.overlayA) {
      onAlignmentDraftChange({
        ...alignmentDraft,
        overlayA: worldToOverlayLocal(point, overlayTransform),
      });
      return;
    }

    if (!alignmentDraft.baseB) {
      onAlignmentDraftChange({
        ...alignmentDraft,
        baseB: point,
      });
      return;
    }

    if (!alignmentDraft.overlayB) {
      const overlayB = worldToOverlayLocal(point, overlayTransform);
      const completedDraft: AlignmentDraft = {
        ...alignmentDraft,
        overlayB,
      };

      onAlignmentDraftChange(completedDraft);

      const nextTransform = createAlignedTransform(
        alignmentDraft.baseA,
        alignmentDraft.baseB,
        alignmentDraft.overlayA,
        overlayB,
        overlayTransform,
      );

      if (nextTransform) {
        onOverlayTransformChange(nextTransform);
        onAlignmentComplete();
      }
    }
  }

  function handlePointerMove() {
    if (
      !drawStart ||
      !(
        tool === "calibrate" ||
        tool === "dimension" ||
        isShapeTool(tool)
      )
    ) {
      return;
    }

    const point = getWorldPointer();

    if (point) {
      setHoverPoint(point);
    }
  }

  const overlayAWorld = alignmentDraft.overlayA
    ? overlayLocalToWorld(alignmentDraft.overlayA, overlayTransform)
    : null;

  const overlayBWorld = alignmentDraft.overlayB
    ? overlayLocalToWorld(alignmentDraft.overlayB, overlayTransform)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[520px] w-full overflow-hidden bg-slate-800"
    >
      {!basePage && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-8">
          <div className="rounded-2xl border border-dashed border-slate-500 bg-slate-900/60 px-10 py-12 text-center text-slate-300">
            <p className="text-lg font-semibold">
              Choose a base PDF page to begin.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              The base page remains fixed while the overlay is aligned on top.
            </p>
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-20 flex gap-2 rounded-lg bg-white/95 p-2 shadow-lg">
        <button
          type="button"
          onClick={() =>
            setViewScale((current) =>
              clamp(
                current / 1.15,
                MIN_VIEW_SCALE,
                MAX_VIEW_SCALE,
              ),
            )
          }
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          −
        </button>

        <span className="min-w-14 px-2 py-1.5 text-center text-xs font-semibold text-slate-600">
          {Math.round(viewScale * 100)}%
        </span>

        <button
          type="button"
          onClick={() =>
            setViewScale((current) =>
              clamp(
                current * 1.15,
                MIN_VIEW_SCALE,
                MAX_VIEW_SCALE,
              ),
            )
          }
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          +
        </button>

        <button
          type="button"
          onClick={fitToPage}
          disabled={!basePage}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Fit
        </button>

        <button
          type="button"
          onClick={viewAtActualSize}
          disabled={!basePage}
          title="Reset to the file's original scale, then zoom in to crop in further"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          100%
        </button>

        <button
          type="button"
          onClick={onToggleGrayscale}
          disabled={!basePage}
          title="Toggle black & white base plan"
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
            baseGrayscale
              ? "border-slate-700 bg-slate-800 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          B&amp;W
        </button>
      </div>

      <Stage
        ref={stageRef}
        width={viewportSize.width}
        height={viewportSize.height}
        x={viewPosition.x}
        y={viewPosition.y}
        scaleX={viewScale}
        scaleY={viewScale}
        draggable={tool === "pan"}
        onDragEnd={(event) => {
          setViewPosition({
            x: event.target.x(),
            y: event.target.y(),
          });
        }}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
      >
        <Layer listening={tool !== "pan"}>
          {basePage && (
            <KonvaImage
              ref={baseImageRef}
              image={basePage.image}
              x={0}
              y={0}
              width={basePage.width}
              height={basePage.height}
              listening={false}
              filters={baseGrayscale ? [Konva.Filters.Grayscale] : []}
            />
          )}
        </Layer>

        <Layer listening={tool !== "pan"}>
          {overlayPage && overlayTransform.visible && (
            <KonvaImage
              ref={overlayImageRef}
              image={overlayPage.image}
              x={overlayTransform.x}
              y={overlayTransform.y}
              width={overlayPage.width}
              height={overlayPage.height}
              scaleX={overlayTransform.scale}
              scaleY={overlayTransform.scale}
              rotation={overlayTransform.rotation}
              opacity={overlayTransform.opacity}
              draggable={tool === "select" && !overlayTransform.locked}
              listening={tool === "select" && !overlayTransform.locked}
              onDragEnd={(event) => {
                onOverlayTransformChange({
                  ...overlayTransform,
                  x: event.target.x(),
                  y: event.target.y(),
                });
              }}
              onTransformEnd={(event) => {
                const node = event.target;
                const uniformScale = Math.max(
                  (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2,
                  0.01,
                );

                onOverlayTransformChange({
                  ...overlayTransform,
                  x: node.x(),
                  y: node.y(),
                  scale: uniformScale,
                  rotation: node.rotation(),
                });
              }}
            />
          )}

          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio
            flipEnabled={false}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]}
            anchorSize={12 / viewScale}
            borderStrokeWidth={2 / viewScale}
            boundBoxFunc={(oldBox, newBox) => {
              if (
                Math.abs(newBox.width) < 40 ||
                Math.abs(newBox.height) < 40
              ) {
                return oldBox;
              }

              return newBox;
            }}
          />
        </Layer>

        <Layer listening={tool === "delete" || tool === "edit"}>
          {shapes.map((shape) => (
            <ShapeOverlay
              key={shape.id}
              shape={shape}
              viewScale={viewScale}
              tool={tool}
              onDelete={onDeleteShape}
              onUpdatePoints={onUpdateShapePoints}
            />
          ))}

          {calibration && (
            <>
              <Line
                listening={false}
                points={[
                  calibration.start.x,
                  calibration.start.y,
                  calibration.end.x,
                  calibration.end.y,
                ]}
                stroke="#f59e0b"
                strokeWidth={3 / viewScale}
                dash={[10 / viewScale, 7 / viewScale]}
              />
              <Circle
                listening={false}
                x={calibration.start.x}
                y={calibration.start.y}
                radius={5 / viewScale}
                fill="#f59e0b"
              />
              <Circle
                listening={false}
                x={calibration.end.x}
                y={calibration.end.y}
                radius={5 / viewScale}
                fill="#f59e0b"
              />
            </>
          )}

          {dimensions.map((dimension) => (
            <DimensionLine
              key={dimension.id}
              dimension={dimension}
              viewScale={viewScale}
              tool={tool}
              onDelete={onDeleteDimension}
              onEditText={onEditDimensionText}
              onUpdatePoints={onUpdateDimensionPoints}
              onMoveLabel={onMoveDimensionLabel}
              labelScale={markupStyle.labelScale}
              labelOpacity={markupStyle.labelOpacity}
            />
          ))}

          {drawStart && hoverPoint && tool === "calibrate" && (
            <Line
              listening={false}
              points={[
                drawStart.x,
                drawStart.y,
                hoverPoint.x,
                hoverPoint.y,
              ]}
              stroke="#f59e0b"
              strokeWidth={3 / viewScale}
              dash={[10 / viewScale, 7 / viewScale]}
            />
          )}

          {drawStart && hoverPoint && tool === "dimension" && (
            <Arrow
              listening={false}
              points={[
                drawStart.x,
                drawStart.y,
                hoverPoint.x,
                hoverPoint.y,
              ]}
              stroke={markupStyle.dimensionLineColor}
              fill={markupStyle.dimensionLineColor}
              strokeWidth={markupStyle.dimensionLineWidth / viewScale}
              pointerAtBeginning={markupStyle.dimensionStartArrow}
              pointerAtEnding={markupStyle.dimensionEndArrow}
              pointerLength={12 / viewScale}
              pointerWidth={10 / viewScale}
              dash={[10 / viewScale, 7 / viewScale]}
            />
          )}

          {drawStart && hoverPoint && isShapeTool(tool) && (
            <ShapePreview
              tool={tool}
              start={drawStart}
              end={hoverPoint}
              markupStyle={markupStyle}
              viewScale={viewScale}
            />
          )}

          {alignmentDraft.baseA && (
            <AlignmentMarker
              point={alignmentDraft.baseA}
              label="A base"
              colour="#16a34a"
              viewScale={viewScale}
            />
          )}

          {overlayAWorld && (
            <AlignmentMarker
              point={overlayAWorld}
              label="A overlay"
              colour="#7c3aed"
              viewScale={viewScale}
            />
          )}

          {alignmentDraft.baseB && (
            <AlignmentMarker
              point={alignmentDraft.baseB}
              label="B base"
              colour="#16a34a"
              viewScale={viewScale}
            />
          )}

          {overlayBWorld && (
            <AlignmentMarker
              point={overlayBWorld}
              label="B overlay"
              colour="#7c3aed"
              viewScale={viewScale}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}

type ShapeOverlayProps = {
  shape: ShapeMarkup;
  viewScale: number;
  tool: EditorTool;
  onDelete: (id: string) => void;
  onUpdatePoints: (id: string, start: Point, end: Point) => void;
};

function ShapeOverlay({
  shape,
  viewScale,
  tool,
  onDelete,
  onUpdatePoints,
}: ShapeOverlayProps) {
  const x = Math.min(shape.start.x, shape.end.x);
  const y = Math.min(shape.start.y, shape.end.y);
  const width = Math.abs(shape.end.x - shape.start.x);
  const height = Math.abs(shape.end.y - shape.start.y);
  const interactive = tool === "delete" || tool === "edit";
  const handleRadius = 6 / viewScale;

  function handleClick(event: Konva.KonvaEventObject<Event>) {
    if (tool !== "delete") {
      return;
    }

    event.cancelBubble = true;
    onDelete(shape.id);
  }

  const shapeNode =
    shape.type === "ellipse" ? (
      <Ellipse
        x={x + width / 2}
        y={y + height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={shape.fillColor}
        stroke={shape.strokeColor}
        strokeWidth={shape.strokeWidth / viewScale}
        opacity={shape.opacity}
        listening={interactive}
        onClick={handleClick}
        onTap={handleClick}
      />
    ) : (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={shape.fillColor}
        stroke={shape.strokeColor}
        strokeWidth={shape.strokeWidth / viewScale}
        opacity={shape.opacity}
        listening={interactive}
        onClick={handleClick}
        onTap={handleClick}
      />
    );

  return (
    <Group>
      {shapeNode}

      {tool === "edit" && (
        <>
          <Circle
            x={shape.start.x}
            y={shape.start.y}
            radius={handleRadius}
            fill="#ffffff"
            stroke={shape.strokeColor}
            strokeWidth={2 / viewScale}
            draggable
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onUpdatePoints(
                shape.id,
                { x: event.target.x(), y: event.target.y() },
                shape.end,
              );
            }}
          />

          <Circle
            x={shape.end.x}
            y={shape.end.y}
            radius={handleRadius}
            fill="#ffffff"
            stroke={shape.strokeColor}
            strokeWidth={2 / viewScale}
            draggable
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onUpdatePoints(
                shape.id,
                shape.start,
                { x: event.target.x(), y: event.target.y() },
              );
            }}
          />
        </>
      )}
    </Group>
  );
}

type ShapePreviewProps = {
  tool: EditorTool;
  start: Point;
  end: Point;
  markupStyle: MarkupStyle;
  viewScale: number;
};

function ShapePreview({
  tool,
  start,
  end,
  markupStyle,
  viewScale,
}: ShapePreviewProps) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const opacity = Math.max(markupStyle.shapeOpacity, 0.15);

  if (tool === "shape-ellipse") {
    return (
      <Ellipse
        listening={false}
        x={x + width / 2}
        y={y + height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={markupStyle.shapeFillColor}
        stroke={markupStyle.shapeStrokeColor}
        strokeWidth={markupStyle.shapeStrokeWidth / viewScale}
        opacity={opacity}
        dash={[8 / viewScale, 5 / viewScale]}
      />
    );
  }

  return (
    <Rect
      listening={false}
      x={x}
      y={y}
      width={width}
      height={height}
      fill={markupStyle.shapeFillColor}
      stroke={markupStyle.shapeStrokeColor}
      strokeWidth={markupStyle.shapeStrokeWidth / viewScale}
      opacity={opacity}
      dash={[8 / viewScale, 5 / viewScale]}
    />
  );
}

type DimensionLineProps = {
  dimension: DimensionMarkup;
  viewScale: number;
  tool: EditorTool;
  onDelete: (id: string) => void;
  onEditText: (id: string) => void;
  onUpdatePoints: (id: string, start: Point, end: Point) => void;
  onMoveLabel: (id: string, offset: Point) => void;
  labelScale: number;
  labelOpacity: number;
};

function DimensionLine({
  dimension,
  viewScale,
  tool,
  onDelete,
  onEditText,
  onUpdatePoints,
  onMoveLabel,
  labelScale,
  labelOpacity,
}: DimensionLineProps) {
  const dx = dimension.end.x - dimension.start.x;
  const dy = dimension.end.y - dimension.start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const normal = {
    x: -dy / length,
    y: dx / length,
  };

  // Keep the label readable (never upside-down) by folding the angle into (-90, 90].
  let labelAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (labelAngle > 90) labelAngle -= 180;
  if (labelAngle < -90) labelAngle += 180;

  const tickHalf = 9 / viewScale;
  const midpoint = {
    x: (dimension.start.x + dimension.end.x) / 2,
    y: (dimension.start.y + dimension.end.y) / 2,
  };

  const fontSize = (14 * labelScale) / viewScale;
  const hasLabel = dimension.label.trim().length > 0;
  const segmentPaddingX = (6 * labelScale) / viewScale;
  const segmentPaddingY = (4 * labelScale) / viewScale;
  const segmentGap = (4 * labelScale) / viewScale;
  const segmentHeight = fontSize + segmentPaddingY * 2;

  const labelSegmentWidth = hasLabel
    ? dimension.label.length * fontSize * 0.6 +
      segmentPaddingX * 2
    : 0;

  const measurementSegmentWidth = Math.max(
    dimension.displayText.length * fontSize * 0.62 +
      segmentPaddingX * 2,
    (36 * labelScale) / viewScale,
  );

  const totalLabelWidth =
    labelSegmentWidth +
    (hasLabel ? segmentGap : 0) +
    measurementSegmentWidth;

  const lineWidth = dimension.lineWidth / viewScale;
  const labelGap = fontSize / 2 + lineWidth / 2 + 4 / viewScale;
  const offset = dimension.labelOffset ?? { x: 0, y: 0 };
  const defaultCenter = {
    x: midpoint.x - normal.x * labelGap,
    y: midpoint.y - normal.y * labelGap,
  };
  const labelCenter = {
    x: defaultCenter.x + offset.x,
    y: defaultCenter.y + offset.y,
  };
  const interactive = tool === "delete" || tool === "edit";
  const hitStrokeWidth = Math.max(lineWidth * 3, 14 / viewScale);
  const handleRadius = 6 / viewScale;

  function handleBodyClick(event: Konva.KonvaEventObject<Event>) {
    event.cancelBubble = true;

    if (tool === "delete") {
      onDelete(dimension.id);
    } else if (tool === "edit") {
      onEditText(dimension.id);
    }
  }

  return (
    <Group>
      {interactive && (
        <Line
          points={[
            dimension.start.x,
            dimension.start.y,
            dimension.end.x,
            dimension.end.y,
          ]}
          stroke="#000000"
          opacity={0}
          strokeWidth={hitStrokeWidth}
          hitStrokeWidth={hitStrokeWidth}
          onClick={handleBodyClick}
          onTap={handleBodyClick}
        />
      )}

      <Arrow
        listening={false}
        points={[
          dimension.start.x,
          dimension.start.y,
          dimension.end.x,
          dimension.end.y,
        ]}
        stroke={dimension.lineColor}
        fill={dimension.lineColor}
        strokeWidth={lineWidth}
        pointerAtBeginning={dimension.startArrow}
        pointerAtEnding={dimension.endArrow}
        pointerLength={12 / viewScale}
        pointerWidth={10 / viewScale}
      />

      {!dimension.startArrow && (
        <Line
          listening={false}
          points={[
            dimension.start.x - normal.x * tickHalf,
            dimension.start.y - normal.y * tickHalf,
            dimension.start.x + normal.x * tickHalf,
            dimension.start.y + normal.y * tickHalf,
          ]}
          stroke={dimension.lineColor}
          strokeWidth={lineWidth}
        />
      )}

      {!dimension.endArrow && (
        <Line
          listening={false}
          points={[
            dimension.end.x - normal.x * tickHalf,
            dimension.end.y - normal.y * tickHalf,
            dimension.end.x + normal.x * tickHalf,
            dimension.end.y + normal.y * tickHalf,
          ]}
          stroke={dimension.lineColor}
          strokeWidth={lineWidth}
        />
      )}

      <Group
        x={labelCenter.x}
        y={labelCenter.y}
        rotation={labelAngle}
        draggable={tool === "edit"}
        onDragEnd={(event) => {
          event.cancelBubble = true;
          onMoveLabel(dimension.id, {
            x: event.target.x() - defaultCenter.x,
            y: event.target.y() - defaultCenter.y,
          });
        }}
      >
        {hasLabel && (
          <>
            <Rect
              listening={false}
              x={-totalLabelWidth / 2}
              y={-segmentHeight / 2}
              width={labelSegmentWidth}
              height={segmentHeight}
              cornerRadius={3 / viewScale}
              fill="#ffffff"
              opacity={labelOpacity}
            />

            <Text
              listening={false}
              x={-totalLabelWidth / 2}
              y={-fontSize / 2}
              width={labelSegmentWidth}
              text={dimension.label}
              align="center"
              fontSize={fontSize}
              fontStyle="bold"
              fill="#111827"
            />
          </>
        )}

        <Rect
          x={
            -totalLabelWidth / 2 +
            (hasLabel
              ? labelSegmentWidth + segmentGap
              : 0)
          }
          y={-segmentHeight / 2}
          width={measurementSegmentWidth}
          height={segmentHeight}
          cornerRadius={3 / viewScale}
          fill="#fde047"
          opacity={labelOpacity}
        />

        <Text
          listening={false}
          x={
            -totalLabelWidth / 2 +
            (hasLabel
              ? labelSegmentWidth + segmentGap
              : 0)
          }
          y={-fontSize / 2}
          width={measurementSegmentWidth}
          text={dimension.displayText}
          align="center"
          fontSize={fontSize}
          fontStyle="bold"
          fill={dimension.textColor}
        />
      </Group>

      {tool === "edit" && (
        <>
          <Circle
            x={dimension.start.x}
            y={dimension.start.y}
            radius={handleRadius}
            fill="#ffffff"
            stroke={dimension.lineColor}
            strokeWidth={2 / viewScale}
            draggable
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onUpdatePoints(
                dimension.id,
                { x: event.target.x(), y: event.target.y() },
                dimension.end,
              );
            }}
          />

          <Circle
            x={dimension.end.x}
            y={dimension.end.y}
            radius={handleRadius}
            fill="#ffffff"
            stroke={dimension.lineColor}
            strokeWidth={2 / viewScale}
            draggable
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onUpdatePoints(
                dimension.id,
                dimension.start,
                { x: event.target.x(), y: event.target.y() },
              );
            }}
          />
        </>
      )}
    </Group>
  );
}

type AlignmentMarkerProps = {
  point: Point;
  label: string;
  colour: string;
  viewScale: number;
};

function AlignmentMarker({
  point,
  label,
  colour,
  viewScale,
}: AlignmentMarkerProps) {
  const radius = 7 / viewScale;
  const fontSize = 11 / viewScale;

  return (
    <Group>
      <Circle
        listening={false}
        x={point.x}
        y={point.y}
        radius={radius}
        fill={colour}
        stroke="#ffffff"
        strokeWidth={2 / viewScale}
      />

      <Text
        listening={false}
        x={point.x + 10 / viewScale}
        y={point.y - 7 / viewScale}
        text={label}
        fontSize={fontSize}
        fontStyle="bold"
        fill={colour}
      />
    </Group>
  );
}
