import { useEffect, useMemo, useState } from "react";
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

type ThumbnailState = {
  pageNumber: number;
  src?: string;
  error?: string;
};

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
  const [thumbnails, setThumbnails] = useState<ThumbnailState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!open || !selectedFile) {
      setPageCount(0);
      setThumbnails([]);
      return;
    }

    let cancelled = false;

    async function loadPages() {
      setIsLoading(true);
      setError("");
      setPageCount(0);
      setThumbnails([]);

      try {
        const count = await getPdfPageCount(selectedFile.sourceUrl);

        if (cancelled) {
          return;
        }

        setPageCount(count);
        setSelectedPageNumber((current) =>
          Math.min(Math.max(current, 1), count),
        );

        const initialThumbnails = Array.from(
          { length: count },
          (_, index) => ({
            pageNumber: index + 1,
          }),
        );

        setThumbnails(initialThumbnails);

        for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
          if (cancelled) {
            return;
          }

          try {
            const rendered = await renderPdfPageToDataUrl(
              selectedFile.sourceUrl,
              pageNumber,
              0.28,
            );

            if (cancelled) {
              return;
            }

            setThumbnails((current) =>
              current.map((thumbnail) =>
                thumbnail.pageNumber === pageNumber
                  ? {
                      ...thumbnail,
                      src: rendered.src,
                    }
                  : thumbnail,
              ),
            );
          } catch (thumbnailError) {
            if (cancelled) {
              return;
            }

            setThumbnails((current) =>
              current.map((thumbnail) =>
                thumbnail.pageNumber === pageNumber
                  ? {
                      ...thumbnail,
                      error:
                        thumbnailError instanceof Error
                          ? thumbnailError.message
                          : "Preview failed",
                    }
                  : thumbnail,
              ),
            );
          }
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load PDF pages.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPages();

    return () => {
      cancelled = true;
    };
  }, [open, selectedFile]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a PDF, then choose the page you want to use.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            PDF file
          </label>

          <select
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
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
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {pageCount > 0
                    ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
                    : "Loading pages..."}
                </p>

                {isLoading && (
                  <span className="text-xs text-slate-500">
                    Building previews…
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {thumbnails.map((thumbnail) => {
                  const selected =
                    thumbnail.pageNumber === selectedPageNumber;

                  return (
                    <button
                      key={thumbnail.pageNumber}
                      type="button"
                      onClick={() =>
                        setSelectedPageNumber(thumbnail.pageNumber)
                      }
                      className={`overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${
                        selected
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex aspect-[1/1.414] items-center justify-center overflow-hidden bg-slate-100">
                        {thumbnail.src ? (
                          <img
                            src={thumbnail.src}
                            alt={`Page ${thumbnail.pageNumber}`}
                            className="h-full w-full object-contain"
                          />
                        ) : thumbnail.error ? (
                          <span className="px-3 text-center text-xs text-red-600">
                            Preview unavailable
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Loading…
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm font-medium text-slate-700">
                          Page {thumbnail.pageNumber}
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
