import { type ChangeEvent, useRef, useState } from "react";

export type JobDocument = {
  id: string;
  name: string;
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type JobDocumentsProps = {
  jobId: string;
  documents: JobDocument[];
  onDocumentUploaded: (document: JobDocument) => void;
  onDocumentDeleted: (documentId: string) => void;
  onOpenDocument: (document: JobDocument) => void;
};

const API_URL = "http://localhost:3001";

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JobDocuments({
  jobId,
  documents,
  onDocumentUploaded,
  onDocumentDeleted,
  onOpenDocument,
}: JobDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const uploadDocument = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    setError("");
    setIsUploading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/quoted-jobs/${jobId}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? "Upload failed.");
      }

      onDocumentUploaded(result);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the PDF.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    const confirmed = window.confirm(
      "Delete this PDF from the job?",
    );

    if (!confirmed) return;

    setError("");
    setDeletingId(documentId);

    try {
      const response = await fetch(
        `${API_URL}/api/quoted-jobs/${jobId}/documents/${documentId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          result?.message ?? "Unable to delete the document.",
        );
      }

      onDocumentDeleted(documentId);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the document.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">
            Plans and documents
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Upload PDF plans for this job.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Upload PDF"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={uploadDocument}
          className="hidden"
        />
      </header>

      {error && (
        <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No plans uploaded
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Upload the architectural plans to begin.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <button
                type="button"
                onClick={() => onOpenDocument(document)}
                className="min-w-0 text-left"
              >
                <p className="truncate font-medium text-slate-900 hover:underline">
                  {document.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatFileSize(document.size)}
                  {" · "}
                  {new Date(
                    document.uploadedAt,
                  ).toLocaleDateString("en-AU")}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDocument(document)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Open
                </button>

                <button
                  type="button"
                  onClick={() => deleteDocument(document.id)}
                  disabled={deletingId === document.id}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === document.id
                    ? "Deleting…"
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}