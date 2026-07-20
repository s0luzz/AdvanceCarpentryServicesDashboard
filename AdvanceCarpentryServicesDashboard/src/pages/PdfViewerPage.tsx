import { type ChangeEvent, useEffect, useState } from "react";
import PdfViewer from "../components/layout/PdfViewer";

export default function PdfViewerPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

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
      alert("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  if (fileUrl) {
    return (
      <div className="p-4">
        <PdfViewer
          file={fileUrl}
          onClose={() => setSelectedFile(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <label className="flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-8 py-14 text-center hover:border-slate-400 hover:bg-slate-50">
        <span className="text-lg font-semibold text-slate-800">
          Open a construction plan
        </span>

        <span className="mt-2 text-sm text-slate-500">
          Select a PDF from your computer
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