import {
  type ChangeEvent,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import PdfViewer from "./PdfViewer";

export default function PdfViewerPage() {
  const { jobId } = useParams<{
    jobId: string;
  }>();

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileUrl, setFileUrl] =
    useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setFileUrl(null);
      return;
    }

    const nextUrl =
      URL.createObjectURL(selectedFile);

    setFileUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedFile]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!isPdf) {
      alert(
        "Please select a PDF file.",
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  function closeViewer() {
    setSelectedFile(null);
    setFileUrl(null);
  }

  if (!jobId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50 px-8 py-10 text-center">
          <h1 className="text-lg font-semibold text-red-800">
            Quote not found
          </h1>

          <p className="mt-2 text-sm text-red-700">
            A quote ID is required to
            save measurements and
            takeoff values.
          </p>
        </div>
      </div>
    );
  }

  if (fileUrl) {
    return (
      <div className="p-4">
        <PdfViewer
          jobId={jobId}
          file={fileUrl}
          onClose={closeViewer}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <label className="flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-8 py-14 text-center transition hover:border-slate-400 hover:bg-slate-50">
        <span className="text-lg font-semibold text-slate-800">
          Open a construction plan
        </span>

        <span className="mt-2 text-sm text-slate-500">
          Select a PDF from your
          computer. Measurements will be
          saved against this quote.
        </span>

        <span className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Choose PDF
        </span>

        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
    </div>
  );
}