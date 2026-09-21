import { useEffect, useState } from "react";

type DimensionDialogProps = {
  open: boolean;
  measuredMm: number;
  initialText?: string;
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSave: (displayText: string) => void;
};

function formatMeasuredDistance(distanceMm: number) {
  if (distanceMm >= 1000) {
    return `${(distanceMm / 1000).toFixed(3)} m`;
  }

  return `${Math.round(distanceMm)} mm`;
}

export default function DimensionDialog({
  open,
  measuredMm,
  initialText,
  title = "Add Dimension",
  confirmLabel = "Add Dimension",
  onCancel,
  onSave,
}: DimensionDialogProps) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    if (open) {
      setDisplayText(initialText ?? String(Math.round(measuredMm)));
    }
  }, [open, measuredMm, initialText]);

  if (!open) {
    return null;
  }

  const canSave = displayText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {title}
        </h2>

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Measured reference
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {formatMeasuredDistance(measuredMm)}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            {Math.round(measuredMm).toLocaleString("en-AU")} mm
          </p>
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Text shown on drawing
        </label>

        <input
          autoFocus
          value={displayText}
          onChange={(event) => setDisplayText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) {
              onSave(displayText.trim());
            }
          }}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold"
          placeholder="e.g. 3600"
        />

        <p className="mt-2 text-xs text-slate-500">
          The measured value is only a reference. This text is what will appear on the plan.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(displayText.trim())}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
