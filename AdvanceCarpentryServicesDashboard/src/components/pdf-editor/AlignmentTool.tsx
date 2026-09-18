import type { AlignmentDraft } from "./editorTypes";

type AlignmentToolProps = {
  visible: boolean;
  draft: AlignmentDraft;
  onReset: () => void;
};

function getStep(draft: AlignmentDraft) {
  if (!draft.baseA) {
    return 1;
  }

  if (!draft.overlayA) {
    return 2;
  }

  if (!draft.baseB) {
    return 3;
  }

  if (!draft.overlayB) {
    return 4;
  }

  return 4;
}

export default function AlignmentTool({
  visible,
  draft,
  onReset,
}: AlignmentToolProps) {
  if (!visible) {
    return null;
  }

  const step = getStep(draft);

  const instructions: Record<number, string> = {
    1: "Click point A on the BASE plan.",
    2: "Click the matching point A on the OVERLAY plan.",
    3: "Click point B on the BASE plan.",
    4: "Click the matching point B on the OVERLAY plan.",
  };

  return (
    <div className="absolute left-1/2 top-4 z-30 w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-xl border border-violet-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            Two-point alignment · Step {step} of 4
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {instructions[step]}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Use two wall corners that are easy to identify on both drawings. The editor will calculate position, rotation and scale automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Restart
        </button>
      </div>
    </div>
  );
}
