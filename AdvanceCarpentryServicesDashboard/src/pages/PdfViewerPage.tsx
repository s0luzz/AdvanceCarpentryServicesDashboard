import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import PdfViewer from "../components/PdfViewer.tsx";
import { useDocumentTitle } from "../lib/useDocumentTitle";

// Open any PDF straight from this computer (nothing is uploaded or saved).
export default function PdfViewerPage() {
  useDocumentTitle("Plan Viewer");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setFileUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setFileUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("That isn't a PDF. Please choose a .pdf file.");
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  if (fileUrl) {
    return (
      <PdfViewer
        file={fileUrl}
        onClose={() => setSelectedFile(null)}
      />
    );
  }

  return (
    <div className="p-4 md:p-8">
      <NavLink
        to="/"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Dashboard
      </NavLink>

      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex w-full max-w-lg flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-8 py-14 text-center">
          <h1 className="text-lg font-semibold text-slate-800">
            Open a construction plan
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Select a PDF from your computer
          </p>

          {/* A real button, so it can be reached and used from the keyboard. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Choose PDF
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
