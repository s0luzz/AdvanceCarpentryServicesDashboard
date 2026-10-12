import { pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const documentCache = new Map<
  string,
  Promise<PDFDocumentProxy>
>();

export function getPdfDocument(
  sourceUrl: string,
): Promise<PDFDocumentProxy> {
  const cached = documentCache.get(sourceUrl);

  if (cached) {
    return cached;
  }

  const loadingTask = pdfjs.getDocument(sourceUrl);
  const promise = loadingTask.promise;

  documentCache.set(sourceUrl, promise);

  return promise;
}

export async function getPdfPageCount(
  sourceUrl: string,
) {
  const pdf = await getPdfDocument(sourceUrl);
  return pdf.numPages;
}

export async function renderPdfPageToDataUrl(
  sourceUrl: string,
  pageNumber: number,
  scale = 2,
  // Previews use JPEG: far quicker to encode and much smaller than PNG.
  format: "png" | "jpeg" = "png",
) {
  const pdf = await getPdfDocument(sourceUrl);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create a PDF render canvas.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  if (format === "jpeg") {
    // JPEG has no transparency, so give the page a white background.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise;

  return {
    src:
      format === "jpeg"
        ? canvas.toDataURL("image/jpeg", 0.7)
        : canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

export function loadHtmlImage(
  src: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Unable to load the rendered PDF page."));

    image.src = src;
  });
}
