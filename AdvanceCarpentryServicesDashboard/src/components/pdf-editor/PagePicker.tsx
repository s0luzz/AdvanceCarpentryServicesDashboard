import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EditorPdfFile,
  PdfPageSelection,
} from "./editorTypes";
import {
  getPdfPageCount,
  renderPdfPageToDataUrl,
} from "./pdfRendering";

type PagePickerProps = {
  open: boolean;
  title: string;
  files: EditorPdfFile[];
  initialSelection?: PdfPageSelection | null;
  onClose: () => void;
  onSelect: (selection: PdfPageSelection) => void;
};

// Previews already built this session, so reopening the picker is instant.
const previewCache = new Map<string, string>();

function PageThumbnail({
  sourceUrl,
  pageNumber,
  scrollRoot,
}: {
  sourceUrl: string;
  pageNumber: number;
  scrollRoot: HTMLElement | null;
}) {
  const key = `${sourceUrl}#${pageNumber}`;
  const holderRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState(previewCache.get(key));
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Only build a preview once its tile is on (or near) the screen.
  useEffect(() => {
    const holder = holderRef.current;

    if (!holder || src) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin: "200px" },
    );

    observer.observe(holder);

    return () => observer.disconnect();
  }, [scrollRoot, src]);

  useEffect(() => {
    if (!visible || src) {
      return;
    }

    let cancelled = false;

    renderPdfPageToDataUrl(sourceUrl, pageNumber, 0.28, "jpeg")
      .then((rendered) => {
        previewCache.set(key, rendered.src);

        if (!cancelled) {
          setSrc(rendered.src);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, src, sourceUrl, pageNumber, key]);

  return (
    <div
      ref={holderRef}
      className="flex aspect-[1/1.414] items-center justify-center overflow-hidden bg-slate-100"
    >
      {src ? (
        <img
          src={src}
          alt={`Page ${pageNumber}`}
          className="h-full w-full object-contain"
        />
      ) : failed ? (
        <span className="px-3 text-center text-xs text-red-600">
          Preview unavailable
        </span>
      ) : (
        <div
          className="h-full w-full animate-pulse bg-slate-200"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default function PagePicker({
  open,
  title,
  files,
  initialSelection,
  onClose,
  onSelect,
}: PagePickerProps) {
  const initialFileId =
    initialSelection?.fileId ?? files[0]?.id ?? "";

  const [selectedFileId, setSelectedFileId] =
    useState(initialFileId);
  const [selectedPageNumber, setSelectedPageNumber] =
    useState(initialSelection?.pageNumber ?? 1);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId),
    [files, selectedFileId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextFileId =
      initialSelection?.fileId ?? files[0]?.id ?? "";

    setSelectedFileId(nextFileId);
    setSelectedPageNumber(initialSelection?.pageNumber ?? 1);
    setError("");
  }, [open, files, initialSelection]);

  // Esc closes it (the Cancel button does the same; there's no second "Close").
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Just the page count here; each tile builds its own preview when seen.
  useEffect(() => {
    if (!open || !selectedFile) {
      setPageCount(0);
      return;
    }

    const file = selectedFile;
    let cancelled = false;

    async function loadPageCount() {
      setIsLoading(true);
      setError("");
      setPageCount(0);

      try {
        const count = await getPdfPageCount(file.sourceUrl);

        if (cancelled) {
          return;
        }

        setPageCount(count);
        setSelectedPageNumber((current) =>
          Math.min(Math.max(current, 1), count),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load PDF pages.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPageCount();

    return () => {
      cancelled = true;
    };
  }, [open, selectedFile]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a PDF, then choose the page you want to use.
          </p>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <label
            htmlFor="picker-file"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            PDF file
          </label>

          <select
            id="picker-file"
            value={selectedFileId}
            onChange={(event) => {
              setSelectedFileId(event.target.value);
              setSelectedPageNumber(1);
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.originalName}
              </option>
            ))}
          </select>
        </div>

        <div
          ref={setScrollRoot}
          className="min-h-0 flex-1 overflow-y-auto p-6"
        >
          {files.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              This job does not have any PDF files yet.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {!error && selectedFile && (
            <>
              <p className="mb-4 text-sm font-medium text-slate-700">
                {pageCount > 0
                  ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
                  : isLoading
                    ? "Loading pages…"
                    : ""}
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: pageCount }, (_, index) => {
                  const pageNumber = index + 1;
                  const selected = pageNumber === selectedPageNumber;

                  return (
                    <button
                      key={`${selectedFile.id}-${pageNumber}`}
                      type="button"
                      onClick={() => setSelectedPageNumber(pageNumber)}
                      onDoubleClick={() =>
                        onSelect({
                          fileId: selectedFile.id,
                          pageNumber,
                        })
                      }
                      aria-pressed={selected}
                      className={`overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${
                        selected
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <PageThumbnail
                        sourceUrl={selectedFile.sourceUrl}
                        pageNumber={pageNumber}
                        scrollRoot={scrollRoot}
                      />

                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm font-medium text-slate-700">
                          Page {pageNumber}
                        </span>

                        {selected && (
                          <span className="text-xs font-semibold text-blue-600">
                            Selected
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!selectedFile || pageCount === 0}
            onClick={() => {
              if (!selectedFile) {
                return;
              }

              onSelect({
                fileId: selectedFile.id,
                pageNumber: selectedPageNumber,
              });
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use Page {selectedPageNumber}
          </button>
        </div>
      </div>
    </div>
  );
}
