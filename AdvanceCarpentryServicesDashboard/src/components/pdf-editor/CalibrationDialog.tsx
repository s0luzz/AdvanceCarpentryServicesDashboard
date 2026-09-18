import { useEffect, useState } from "react";

type CalibrationDialogProps = {
  open: boolean;
  pixelDistance: number;
  onCancel: () => void;
  onSave: (realDistanceMm: number) => void;
};

type Unit = "mm" | "m";

export default function CalibrationDialog({
  open,
  pixelDistance,
  onCancel,
  onSave,
}: CalibrationDialogProps) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<Unit>("mm");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue("");
      setUnit("mm");
      setError("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function save() {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Enter a distance greater than zero.");
      return;
    }

    const millimetres = unit === "m" ? numericValue * 1000 : numericValue;
    onSave(millimetres);
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">
          Set Drawing Scale
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Enter the real-world distance represented by the line you just drew.
        </p>

        <div className="mt-5 flex gap-3">
          <input
            type="number"
            min="0"
            step="any"
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                save();
              }
            }}
            placeholder={unit === "mm" ? "e.g. 6500" : "e.g. 6.5"}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />

          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value as Unit)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="mm">Millimetres</option>
            <option value="m">Metres</option>
          </select>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Reference line length: {pixelDistance.toFixed(1)} canvas px
        </p>

        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        )}

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
            onClick={save}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Save Scale
          </button>
        </div>
      </div>
    </div>
  );
}
