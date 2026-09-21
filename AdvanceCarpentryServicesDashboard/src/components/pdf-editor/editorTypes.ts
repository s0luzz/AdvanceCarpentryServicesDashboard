export type Point = {
  x: number;
  y: number;
};

export type EditorTool =
  | "select"
  | "pan"
  | "align"
  | "calibrate"
  | "dimension"
  | "shape-rectangle"
  | "shape-ellipse"
  | "edit"
  | "delete";

export type PdfPageSelection = {
  fileId: string;
  pageNumber: number;
};

export type EditorPdfFile = {
  id: string;
  originalName: string;
  sourceUrl: string;
};

export type OverlayTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type EditorCalibration = {
  start: Point;
  end: Point;
  realDistanceMm: number;
  pixelDistance: number;
  mmPerPixel: number;
};

export type MarkupStyle = {
  dimensionLineColor: string;
  dimensionTextColor: string;
  dimensionLineWidth: number;
  dimensionStartArrow: boolean;
  dimensionEndArrow: boolean;
  shapeFillColor: string;
  shapeOpacity: number;
  shapeStrokeColor: string;
  shapeStrokeWidth: number;
};

export type DimensionMarkup = {
  id: string;
  start: Point;
  end: Point;
  measuredMm: number;
  displayText: string;
  lineColor: string;
  textColor: string;
  lineWidth: number;
  startArrow: boolean;
  endArrow: boolean;
};

export type ShapeType = "rectangle" | "ellipse";

export type ShapeMarkup = {
  id: string;
  type: ShapeType;
  start: Point;
  end: Point;
  fillColor: string;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
};

export type AlignmentDraft = {
  baseA?: Point;
  overlayA?: Point;
  baseB?: Point;
  overlayB?: Point;
};

export type SavedPdfMarkupEditor = {
  base: PdfPageSelection | null;
  overlay: PdfPageSelection | null;
  overlayTransform: OverlayTransform;
  calibration: EditorCalibration | null;
  dimensions: DimensionMarkup[];
  shapes: ShapeMarkup[];
  markupStyle: MarkupStyle;
};

export type RenderedPdfPage = {
  src: string;
  width: number;
  height: number;
  image: HTMLImageElement;
};

export const DEFAULT_OVERLAY_TRANSFORM: OverlayTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 0.45,
  visible: true,
  locked: false,
};

export const DEFAULT_MARKUP_STYLE: MarkupStyle = {
  dimensionLineColor: "#2563eb",
  dimensionTextColor: "#2563eb",
  dimensionLineWidth: 2.5,
  dimensionStartArrow: false,
  dimensionEndArrow: false,
  shapeFillColor: "#ef4444",
  shapeOpacity: 0.3,
  shapeStrokeColor: "#b91c1c",
  shapeStrokeWidth: 2.5,
};
