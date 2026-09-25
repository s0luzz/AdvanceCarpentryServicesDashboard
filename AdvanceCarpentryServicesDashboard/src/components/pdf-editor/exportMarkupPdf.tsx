import { jsPDF } from "jspdf";
import type {
  DimensionMarkup,
  OverlayTransform,
  RenderedPdfPage,
  ShapeMarkup,
} from "./editorTypes";

type ExportMarkupPdfOptions = {
  fileName: string;
  basePage: RenderedPdfPage;
  overlayPage: RenderedPdfPage | null;
  overlayTransform: OverlayTransform;
  dimensions: DimensionMarkup[];
  shapes: ShapeMarkup[];
  labelScale: number;
  labelOpacity: number;
  baseGrayscale?: boolean;
};

function drawOverlay(
  context: CanvasRenderingContext2D,
  overlayPage: RenderedPdfPage,
  transform: OverlayTransform,
) {
  if (!transform.visible) {
    return;
  }

  context.save();
  context.globalAlpha = transform.opacity;
  context.translate(transform.x, transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scale, transform.scale);
  context.drawImage(
    overlayPage.image,
    0,
    0,
    overlayPage.width,
    overlayPage.height,
  );
  context.restore();
}

function drawShape(
  context: CanvasRenderingContext2D,
  shape: ShapeMarkup,
  exportScale: number,
) {
  const x = Math.min(shape.start.x, shape.end.x);
  const y = Math.min(shape.start.y, shape.end.y);
  const width = Math.abs(shape.end.x - shape.start.x);
  const height = Math.abs(shape.end.y - shape.start.y);

  if (width < 1 || height < 1) {
    return;
  }

  context.save();
  context.globalAlpha = shape.opacity;
  context.fillStyle = shape.fillColor;
  context.strokeStyle = shape.strokeColor;
  context.lineWidth = Math.max(shape.strokeWidth * exportScale, 1);

  if (shape.type === "rectangle") {
    context.fillRect(x, y, width, height);

    if (shape.strokeWidth > 0) {
      context.strokeRect(x, y, width, height);
    }
  } else {
    context.beginPath();
    context.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (shape.strokeWidth > 0) {
      context.stroke();
    }
  }

  context.restore();
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  angle: number,
  length: number,
) {
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(
    tip.x - length * Math.cos(angle - Math.PI / 7),
    tip.y - length * Math.sin(angle - Math.PI / 7),
  );
  context.lineTo(
    tip.x - length * Math.cos(angle + Math.PI / 7),
    tip.y - length * Math.sin(angle + Math.PI / 7),
  );
  context.closePath();
  context.fill();
}

function drawDimension(
  context: CanvasRenderingContext2D,
  dimension: DimensionMarkup,
  exportScale: number,
  labelScale: number,
  labelOpacity: number,
) {
  const dx = dimension.end.x - dimension.start.x;
  const dy = dimension.end.y - dimension.start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const normalX = -dy / length;
  const normalY = dx / length;
  const angle = Math.atan2(dy, dx);
  const tickHalf = 9 * exportScale;
  const headLength = 14 * exportScale;
  const lineWidth = Math.max(dimension.lineWidth * exportScale, 1);

  context.save();
  context.strokeStyle = dimension.lineColor;
  context.fillStyle = dimension.lineColor;
  context.lineWidth = lineWidth;
  context.lineCap = "round";

  context.beginPath();
  context.moveTo(dimension.start.x, dimension.start.y);
  context.lineTo(dimension.end.x, dimension.end.y);
  context.stroke();

  if (dimension.startArrow) {
    drawArrowHead(context, dimension.start, angle + Math.PI, headLength);
  } else {
    context.beginPath();
    context.moveTo(
      dimension.start.x - normalX * tickHalf,
      dimension.start.y - normalY * tickHalf,
    );
    context.lineTo(
      dimension.start.x + normalX * tickHalf,
      dimension.start.y + normalY * tickHalf,
    );
    context.stroke();
  }

  if (dimension.endArrow) {
    drawArrowHead(context, dimension.end, angle, headLength);
  } else {
    context.beginPath();
    context.moveTo(
      dimension.end.x - normalX * tickHalf,
      dimension.end.y - normalY * tickHalf,
    );
    context.lineTo(
      dimension.end.x + normalX * tickHalf,
      dimension.end.y + normalY * tickHalf,
    );
    context.stroke();
  }

  const midpointX = (dimension.start.x + dimension.end.x) / 2;
  const midpointY = (dimension.start.y + dimension.end.y) / 2;
  const fontSize = 15 * labelScale * exportScale;
  const labelGap = fontSize / 2 + lineWidth / 2 + 4 * exportScale;

  // Keep the label readable (never upside-down) by folding the angle into (-90, 90].
  let labelAngle = Math.atan2(dy, dx);
  if (labelAngle > Math.PI / 2) labelAngle -= Math.PI;
  if (labelAngle < -Math.PI / 2) labelAngle += Math.PI;

  context.translate(
    midpointX - normalX * labelGap + (dimension.labelOffset?.x ?? 0),
    midpointY - normalY * labelGap + (dimension.labelOffset?.y ?? 0),
  );
  context.rotate(labelAngle);

  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const segmentPaddingX = 8 * labelScale * exportScale;
  const segmentPaddingY = 5 * labelScale * exportScale;
  const segmentGap = 5 * labelScale * exportScale;
  const segmentHeight = fontSize + segmentPaddingY * 2;
  const cornerRadius = 4 * exportScale;

  const hasLabel = dimension.label.trim().length > 0;
  const labelWidth = hasLabel
    ? context.measureText(dimension.label).width +
      segmentPaddingX * 2
    : 0;

  const measurementWidth = Math.max(
    context.measureText(dimension.displayText).width +
      segmentPaddingX * 2,
    38 * labelScale * exportScale,
  );

  const totalWidth =
    labelWidth +
    (hasLabel ? segmentGap : 0) +
    measurementWidth;

  const leftEdge = -totalWidth / 2;

  if (hasLabel) {
    context.globalAlpha = labelOpacity;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(
      leftEdge,
      -segmentHeight / 2,
      labelWidth,
      segmentHeight,
      cornerRadius,
    );
    context.fill();
    context.globalAlpha = 1;

    context.fillStyle = "#111827";
    context.fillText(
      dimension.label,
      leftEdge + labelWidth / 2,
      0,
    );
  }

  const measurementX =
    leftEdge +
    (hasLabel ? labelWidth + segmentGap : 0);

  context.globalAlpha = labelOpacity;
  context.fillStyle = "#fde047";
  context.beginPath();
  context.roundRect(
    measurementX,
    -segmentHeight / 2,
    measurementWidth,
    segmentHeight,
    cornerRadius,
  );
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = dimension.textColor;
  context.fillText(
    dimension.displayText,
    measurementX + measurementWidth / 2,
    0,
  );

  context.restore();
}

function sanitiseFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");

  return cleaned || "markup";
}

export async function exportMarkupPdf({
  fileName,
  basePage,
  overlayPage,
  overlayTransform,
  dimensions,
  shapes,
  labelScale,
  labelOpacity,
  baseGrayscale,
}: ExportMarkupPdfOptions) {
  const canvas = document.createElement("canvas");
  canvas.width = basePage.width;
  canvas.height = basePage.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create the export canvas.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (baseGrayscale) context.filter = "grayscale(1)";
  context.drawImage(basePage.image, 0, 0, basePage.width, basePage.height);
  context.filter = "none";

  if (overlayPage) {
    drawOverlay(context, overlayPage, overlayTransform);
  }

  const exportScale = Math.max(basePage.width / 1400, 1);

  shapes.forEach((shape) => {
    drawShape(context, shape, exportScale);
  });

  dimensions.forEach((dimension) => {
    drawDimension(context, dimension, exportScale, labelScale, labelOpacity);
  });

  const imageData = canvas.toDataURL("image/png", 1);
  const isLandscape = basePage.width > basePage.height;

  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = pageWidth * (basePage.height / basePage.width);

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: [pageWidth, pageHeight],
    compress: true,
  });

  pdf.addImage(
    imageData,
    "PNG",
    0,
    0,
    pageWidth,
    pageHeight,
    undefined,
    "FAST",
  );

  pdf.save(`${sanitiseFileName(fileName)}.pdf`);
}
