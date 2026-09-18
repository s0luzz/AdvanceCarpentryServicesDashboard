import type {
  EditorCalibration,
  EditorPdfFile,
  MarkupStyle,
  OverlayTransform,
  PdfPageSelection,
} from "./editorTypes";

type LayerPanelProps = {
  files: EditorPdfFile[];
  base: PdfPageSelection | null;
  overlay: PdfPageSelection | null;
  overlayTransform: OverlayTransform;
  calibration: EditorCalibration | null;
  dimensionCount: number;
  shapeCount: number;
  markupStyle: MarkupStyle;
  onChooseBase: () => void;
  onChooseOverlay: () => void;
  onRemoveOverlay: () => void;
  onOverlayTransformChange: (next: OverlayTransform) => void;
  onResetOverlayTransform: () => void;
  onMarkupStyleChange: (next: MarkupStyle) => void;
  onClearCalibration: () => void;
  onClearDimensions: () => void;
  onClearShapes: () => void;
};

const COLOUR_PRESETS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#111827",
  "#ffffff",
];

function getSelectionLabel(
  files: EditorPdfFile[],
  selection: PdfPageSelection | null,
) {
  if (!selection) {
    return "Not selected";
  }

  const file = files.find((item) => item.id === selection.fileId);

  return `${file?.originalName ?? "Unknown PDF"} · Page ${selection.pageNumber}`;
}

type ColourControlProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ColourControl({
  label,
  value,
  onChange,
}: ColourControlProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-slate-600">
          {label}
        </label>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          />
          <span className="w-16 text-right font-mono text-[10px] uppercase text-slate-500">
            {value}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {COLOUR_PRESETS.map((colour) => (
          <button
            key={colour}
            type="button"
            title={colour}
            onClick={() => onChange(colour)}
            className={`h-6 w-6 rounded-full border shadow-sm ${
              colour.toLowerCase() === value.toLowerCase()
                ? "ring-2 ring-blue-400 ring-offset-1"
                : "border-slate-300"
            }`}
            style={{ backgroundColor: colour }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LayerPanel({
  files,
  base,
  overlay,
  overlayTransform,
  calibration,
  dimensionCount,
  shapeCount,
  markupStyle,
  onChooseBase,
  onChooseOverlay,
  onRemoveOverlay,
  onOverlayTransformChange,
  onResetOverlayTransform,
  onMarkupStyleChange,
  onClearCalibration,
  onClearDimensions,
  onClearShapes,
}: LayerPanelProps) {
  function updateOverlay(
    patch: Partial<OverlayTransform>,
  ) {
    onOverlayTransformChange({
      ...overlayTransform,
      ...patch,
    });
  }

  function updateMarkupStyle(
    patch: Partial<MarkupStyle>,
  ) {
    onMarkupStyleChange({
      ...markupStyle,
      ...patch,
    });
  }

  return (
    <aside className="w-full shrink-0 border-l border-slate-200 bg-white xl:w-80">
      <div className="border-b border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">
          Layers & Markup
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Overlay controls are temporary. Dimensions and shapes remain on the base drawing.
        </p>
      </div>

      <div className="space-y-4 overflow-y-auto p-4 xl:max-h-[calc(100vh-180px)]">
        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Base
              </p>
              <p className="mt-1 break-words text-sm font-medium text-slate-900">
                {getSelectionLabel(files, base)}
              </p>
            </div>

            <button
              type="button"
              onClick={onChooseBase}
              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Change
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-violet-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Overlay
              </p>
              <p className="mt-1 break-words text-sm font-medium text-slate-900">
                {getSelectionLabel(files, overlay)}
              </p>
            </div>

            <button
              type="button"
              onClick={onChooseOverlay}
              disabled={!base}
              className="shrink-0 rounded-lg border border-violet-300 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {overlay ? "Change" : "Add"}
            </button>
          </div>

          {overlay && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateOverlay({
                      visible: !overlayTransform.visible,
                    })
                  }
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                    overlayTransform.visible
                      ? "bg-violet-600 text-white"
                      : "border border-slate-300 text-slate-700"
                  }`}
                >
                  {overlayTransform.visible ? "Visible" : "Hidden"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateOverlay({
                      locked: !overlayTransform.locked,
                    })
                  }
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                    overlayTransform.locked
                      ? "bg-slate-800 text-white"
                      : "border border-slate-300 text-slate-700"
                  }`}
                >
                  {overlayTransform.locked ? "Locked" : "Unlocked"}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    Opacity
                  </label>
                  <span className="text-xs font-semibold text-slate-700">
                    {Math.round(overlayTransform.opacity * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={overlayTransform.opacity}
                  onChange={(event) =>
                    updateOverlay({
                      opacity: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-slate-600">
                  X
                  <input
                    type="number"
                    value={Math.round(overlayTransform.x)}
                    onChange={(event) =>
                      updateOverlay({
                        x: Number(event.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>

                <label className="text-xs font-medium text-slate-600">
                  Y
                  <input
                    type="number"
                    value={Math.round(overlayTransform.y)}
                    onChange={(event) =>
                      updateOverlay({
                        y: Number(event.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>

                <label className="text-xs font-medium text-slate-600">
                  Scale
                  <input
                    type="number"
                    min="0.05"
                    step="0.01"
                    value={Number(overlayTransform.scale.toFixed(3))}
                    onChange={(event) =>
                      updateOverlay({
                        scale: Math.max(
                          Number(event.target.value) || 0.05,
                          0.05,
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>

                <label className="text-xs font-medium text-slate-600">
                  Rotation
                  <input
                    type="number"
                    step="0.1"
                    value={Number(overlayTransform.rotation.toFixed(2))}
                    onChange={(event) =>
                      updateOverlay({
                        rotation: Number(event.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onResetOverlayTransform}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Transform
                </button>

                <button
                  type="button"
                  onClick={onRemoveOverlay}
                  className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Remove Overlay
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-amber-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Drawing Scale
          </p>

          {calibration ? (
            <>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {calibration.realDistanceMm.toLocaleString("en-AU")} mm reference
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {calibration.mmPerPixel.toFixed(5)} mm per canvas pixel
              </p>
              <button
                type="button"
                onClick={onClearCalibration}
                className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              >
                Clear Scale
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No scale set.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-blue-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Dimension Style
          </p>

          <div className="mt-4 space-y-4">
            <ColourControl
              label="Line / label colour"
              value={markupStyle.dimensionLineColor}
              onChange={(value) =>
                updateMarkupStyle({
                  dimensionLineColor: value,
                })
              }
            />

            <ColourControl
              label="Text colour"
              value={markupStyle.dimensionTextColor}
              onChange={(value) =>
                updateMarkupStyle({
                  dimensionTextColor: value,
                })
              }
            />

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  Line thickness
                </label>
                <span className="text-xs font-semibold text-slate-700">
                  {markupStyle.dimensionLineWidth.toFixed(1)} px
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={markupStyle.dimensionLineWidth}
                onChange={(event) =>
                  updateMarkupStyle({
                    dimensionLineWidth: Number(event.target.value),
                  })
                }
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">
              {dimensionCount} dimension{dimensionCount === 1 ? "" : "s"}
            </p>

            <button
              type="button"
              disabled={dimensionCount === 0}
              onClick={onClearDimensions}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-rose-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
            Solid Shape Style
          </p>

          <div className="mt-4 space-y-4">
            <ColourControl
              label="Fill colour"
              value={markupStyle.shapeFillColor}
              onChange={(value) =>
                updateMarkupStyle({
                  shapeFillColor: value,
                })
              }
            />

            <ColourControl
              label="Border colour"
              value={markupStyle.shapeStrokeColor}
              onChange={(value) =>
                updateMarkupStyle({
                  shapeStrokeColor: value,
                })
              }
            />

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  Shape opacity
                </label>
                <span className="text-xs font-semibold text-slate-700">
                  {Math.round(markupStyle.shapeOpacity * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={markupStyle.shapeOpacity}
                onChange={(event) =>
                  updateMarkupStyle({
                    shapeOpacity: Number(event.target.value),
                  })
                }
                className="mt-2 w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  Border thickness
                </label>
                <span className="text-xs font-semibold text-slate-700">
                  {markupStyle.shapeStrokeWidth.toFixed(1)} px
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={markupStyle.shapeStrokeWidth}
                onChange={(event) =>
                  updateMarkupStyle({
                    shapeStrokeWidth: Number(event.target.value),
                  })
                }
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">
              {shapeCount} shape{shapeCount === 1 ? "" : "s"}
            </p>

            <button
              type="button"
              disabled={shapeCount === 0}
              onClick={onClearShapes}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
