import { useState } from "react";
import { ColourControl } from "./LayerPanel";

export type GlobalDimensionEdit = {
  lineColor: string;
  textColor: string;
  highlightColor: string;
  lineWidth: number;
  labelScale: number;
  labelOpacity: number;
};

type GlobalDimensionEditDialogProps = {
  scope: "all" | "selected";
  dimensionCount: number;
  initial: GlobalDimensionEdit;
  onCancel: () => void;
  onApply: (next: GlobalDimensionEdit) => void;
};

const SLIDERS = [
  { key: "lineWidth", title: "Line thickness", min: 1, max: 8, step: 0.5 },
  { key: "labelScale", title: "Label size", min: 0.4, max: 1.5, step: 0.05 },
  { key: "labelOpacity", title: "Highlight opacity", min: 0.3, max: 1, step: 0.05 },
] as const;

const COLOURS = [
  { key: "lineColor", title: "Line colour" },
  { key: "textColor", title: "Measurement text colour" },
  { key: "highlightColor", title: "Highlight colour" },
] as const;

function formatValue(key: (typeof SLIDERS)[number]["key"], value: number) {
  return key === "lineWidth"
    ? `${value.toFixed(1)} px`
    : `${Math.round(value * 100)}%`;
}

export default function GlobalDimensionEditDialog({
  scope,
  dimensionCount,
  initial,
  onCancel,
  onApply,
}: GlobalDimensionEditDialogProps) {
  // Seeded once on mount; the parent only mounts this while open.
  const [values, setValues] = useState<GlobalDimensionEdit>(initial);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {scope === "all" ? "Edit All Dimensions" : "Edit Selected Dimensions"}
        </h2>

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Selected
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {dimensionCount} dimension{dimensionCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            {scope === "all"
              ? "Changes apply to every dimension on this page and to new ones."
              : "Changes apply only to the dimensions you picked."}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {COLOURS.map(({ key, title }) => (
            <ColourControl
              key={key}
              label={title}
              value={values[key]}
              onChange={(value) =>
                setValues((current) => ({ ...current, [key]: value }))
              }
            />
          ))}
        </div>

        <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
          {SLIDERS.map(({ key, title, min, max, step }) => (
            <div key={key}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  {title}
                </label>
                <span className="text-sm font-semibold text-slate-900">
                  {formatValue(key, values[key])}
                </span>
              </div>

              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={values[key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full"
              />
            </div>
          ))}
        </div>

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
            autoFocus
            onClick={() => onApply(values)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {scope === "all" ? "Apply to All" : "Apply to Selected"}
          </button>
        </div>
      </div>
    </div>
  );
}
