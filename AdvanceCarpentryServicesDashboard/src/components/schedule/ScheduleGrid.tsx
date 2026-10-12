import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import {
    DAY_LETTERS,
    DAYS_PER_WEEK,
    addDays,
    colToDate,
    dateToCol,
    formatDate,
    sortEntries,
    weekLabel,
    type ScheduleEntry,
    type ScheduleJob,
} from "./scheduleUtils";

type DragKind = "create" | "move" | "start" | "end";

type Drag = {
    kind: DragKind;
    entryId?: string;
    anchor: number;
    origStart: number;
    origEnd: number;
    start: number;
    end: number;
    moved: boolean;
};

type ScheduleGridProps = {
    monday: Date;
    weeks: number;
    entries: ScheduleEntry[];
    jobs: ScheduleJob[];
    compact?: boolean;
    // Interactive mode (schedule page). Omit all of these for read-only.
    onCreate?: (jobId: string, start: string, end: string) => void;
    onChange?: (id: string, start: string, end: string) => void;
    onSelect?: (id: string) => void;
};

const LABEL_WIDTH = "w-44";

// One colour per builder (the job's customer), stable across page loads.
const BUILDER_COLOURS = [
    { bar: "bg-blue-600", dot: "bg-blue-600" },
    { bar: "bg-emerald-600", dot: "bg-emerald-600" },
    { bar: "bg-violet-600", dot: "bg-violet-600" },
    { bar: "bg-amber-600", dot: "bg-amber-600" },
    { bar: "bg-rose-600", dot: "bg-rose-600" },
    { bar: "bg-cyan-700", dot: "bg-cyan-700" },
    { bar: "bg-orange-600", dot: "bg-orange-600" },
    { bar: "bg-teal-700", dot: "bg-teal-700" },
];

function builderColour(name: string | undefined) {
    const key = (name ?? "").trim().toLowerCase();
    let hash = 0;

    for (const char of key) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return BUILDER_COLOURS[hash % BUILDER_COLOURS.length];
}

function computeDrag(drag: Drag, col: number): Drag {
    if (drag.kind === "create") {
        return {
            ...drag,
            start: Math.min(drag.anchor, col),
            end: Math.max(drag.anchor, col),
            moved: col !== drag.anchor,
        };
    }

    if (drag.kind === "move") {
        const delta = col - drag.anchor;
        return {
            ...drag,
            start: drag.origStart + delta,
            end: drag.origEnd + delta,
            moved: delta !== 0,
        };
    }

    if (drag.kind === "start") {
        const start = Math.min(col, drag.origEnd);
        return { ...drag, start, moved: start !== drag.origStart };
    }

    const end = Math.max(col, drag.origStart);
    return { ...drag, end, moved: end !== drag.origEnd };
}

export default function ScheduleGrid({
    monday,
    weeks,
    entries,
    jobs,
    compact = false,
    onCreate,
    onChange,
    onSelect,
}: ScheduleGridProps) {
    const interactive = Boolean(onCreate && onChange && onSelect);
    const columns = weeks * DAYS_PER_WEEK;
    const cellsRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [draftJobId, setDraftJobId] = useState("");

    // Latest callbacks/draft for the window listeners added on pointer down.
    const latest = useRef({ onCreate, onChange, onSelect, draftJobId });
    latest.current = { onCreate, onChange, onSelect, draftJobId };

    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const rowHeight = compact ? "h-9" : "h-14";
    const today = new Date();
    const todayCol =
        today.getDay() === 0
            ? -1
            : dateToCol(formatDate(today), monday);

    const rows = sortEntries(entries)
        .map((entry) => ({
            entry,
            job: jobsById.get(entry.jobId),
            start: dateToCol(entry.start, monday),
            end: dateToCol(entry.end, monday),
        }))
        .filter(
            (row) =>
                row.job && row.start <= columns - 1 && row.end >= 0,
        );

    const legend = [
        ...new Set(rows.map((row) => row.job?.name).filter(Boolean)),
    ]
        .sort()
        .map((name) => ({ name: name as string, dot: builderColour(name).dot }));

    const scheduledJobIds = new Set(entries.map((entry) => entry.jobId));
    const pickable = jobs
        .filter(
            (job) =>
                job.status === "Cutting List" ||
                job.status === "Under Construction",
        )
        .sort((a, b) => a.address.localeCompare(b.address));
    const needsScheduling = pickable.filter(
        (job) => !scheduledJobIds.has(job.id),
    );
    const alreadyScheduled = pickable.filter((job) =>
        scheduledJobIds.has(job.id),
    );

    function colFromX(clientX: number) {
        const rect = cellsRef.current?.getBoundingClientRect();

        if (!rect) {
            return 0;
        }

        const col = Math.floor(
            (clientX - rect.left) / (rect.width / columns),
        );
        return Math.min(Math.max(col, 0), columns - 1);
    }

    function beginDrag(
        event: React.PointerEvent,
        initial: Omit<Drag, "moved">,
    ) {
        event.preventDefault();
        event.stopPropagation();

        let current: Drag = { ...initial, moved: false };
        setDrag(current);

        const handleMove = (moveEvent: PointerEvent) => {
            current = computeDrag(current, colFromX(moveEvent.clientX));
            setDrag(current);
        };

        const handleUp = () => {
            window.removeEventListener("pointermove", handleMove);
            setDrag(null);

            const { onCreate, onChange, onSelect, draftJobId } =
                latest.current;
            const startDate = colToDate(current.start, monday);
            const endDate = colToDate(current.end, monday);

            if (current.kind === "create") {
                if (draftJobId) {
                    onCreate?.(draftJobId, startDate, endDate);
                    setDraftJobId("");
                }
            } else if (current.entryId) {
                if (current.moved) {
                    onChange?.(current.entryId, startDate, endDate);
                } else {
                    onSelect?.(current.entryId);
                }
            }
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp, { once: true });
    }

    function renderBlock(
        start: number,
        end: number,
        options: { preview?: boolean; row?: (typeof rows)[number] } = {},
    ) {
        const colour = builderColour(options.row?.job?.name);
        const visibleStart = Math.max(start, 0);
        const visibleEnd = Math.min(end, columns - 1);
        const entryId = options.row?.entry.id;

        return (
            <div
                key={entryId ?? "preview"}
                onPointerDown={
                    interactive && entryId && options.row
                        ? (event) =>
                              beginDrag(event, {
                                  kind: "move",
                                  entryId,
                                  anchor: colFromX(event.clientX),
                                  origStart: options.row!.start,
                                  origEnd: options.row!.end,
                                  start: options.row!.start,
                                  end: options.row!.end,
                              })
                        : undefined
                }
                className={`absolute top-1 bottom-1 flex items-center justify-center overflow-hidden rounded border border-black/40 text-[11px] font-semibold text-white ${
                    options.preview ? "bg-blue-500/60" : colour.bar
                } ${interactive && !options.preview ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
                style={{
                    left: `${(visibleStart / columns) * 100}%`,
                    width: `${((visibleEnd - visibleStart + 1) / columns) * 100}%`,
                }}
            >
                <span className="truncate px-2">
                    {options.row?.job?.name
                        ? `${options.row.job.name} · `
                        : ""}
                    {end - start + 1}d
                </span>

                {interactive && entryId && options.row && (
                    <>
                        {start >= 0 && (
                            <span
                                onPointerDown={(event) =>
                                    beginDrag(event, {
                                        kind: "start",
                                        entryId,
                                        anchor: colFromX(event.clientX),
                                        origStart: options.row!.start,
                                        origEnd: options.row!.end,
                                        start: options.row!.start,
                                        end: options.row!.end,
                                    })
                                }
                                className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l bg-black/20"
                            />
                        )}

                        {end <= columns - 1 && (
                            <span
                                onPointerDown={(event) =>
                                    beginDrag(event, {
                                        kind: "end",
                                        entryId,
                                        anchor: colFromX(event.clientX),
                                        origStart: options.row!.start,
                                        origEnd: options.row!.end,
                                        start: options.row!.start,
                                        end: options.row!.end,
                                    })
                                }
                                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-black/20"
                            />
                        )}
                    </>
                )}
            </div>
        );
    }

    function renderCells() {
        return (
            <div
                className="absolute inset-0 grid"
                style={{
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                }}
            >
                {Array.from({ length: columns }, (_, col) => (
                    <div
                        key={col}
                        className={`border-l ${
                            col % DAYS_PER_WEEK === 0
                                ? "border-slate-400"
                                : "border-slate-200"
                        } ${col === todayCol ? "bg-blue-500/10" : ""}`}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto select-none">
            <div className={compact ? "min-w-[640px]" : "min-w-[980px]"}>
                <div className="flex">
                    <div className={`${LABEL_WIDTH} shrink-0`} />
                    <div
                        className="grid flex-1 border-y border-r border-slate-400"
                        style={{
                            gridTemplateColumns: `repeat(${weeks}, 1fr)`,
                        }}
                    >
                        {Array.from({ length: weeks }, (_, week) => (
                            <div
                                key={week}
                                className="border-l border-slate-400 py-2 text-center text-sm font-medium text-slate-800"
                            >
                                {weekLabel(addDays(monday, week * 7))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex">
                    <div className={`${LABEL_WIDTH} shrink-0`} />
                    <div
                        ref={cellsRef}
                        className="grid flex-1 border-b border-r border-slate-400"
                        style={{
                            gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        }}
                    >
                        {Array.from({ length: columns }, (_, col) => (
                            <div
                                key={col}
                                className={`border-l py-1.5 text-center text-xs font-bold text-slate-800 ${
                                    col % DAYS_PER_WEEK === 0
                                        ? "border-slate-400"
                                        : "border-slate-200"
                                } ${col === todayCol ? "bg-blue-500/20" : ""}`}
                            >
                                {DAY_LETTERS[col % DAYS_PER_WEEK]}
                            </div>
                        ))}
                    </div>
                </div>

                {rows.map((row) => {
                    const active =
                        drag?.entryId === row.entry.id ? drag : null;

                    return (
                        <div key={row.entry.id} className="flex">
                            <NavLink
                                to={`/jobs/${row.entry.jobId}`}
                                title="Open job details"
                                className={`${LABEL_WIDTH} ${rowHeight} flex shrink-0 flex-col justify-center border border-slate-400 px-2 text-left hover:bg-blue-500/10`}
                            >
                                <span className="line-clamp-2 text-xs font-medium leading-tight text-slate-900">
                                    {row.job?.address}
                                </span>
                                {!compact && (
                                    <span className="mt-0.5 truncate text-[11px] text-slate-500">
                                        {row.job?.name}
                                    </span>
                                )}
                            </NavLink>

                            <div
                                className={`relative flex-1 ${rowHeight} border-y border-r border-slate-400`}
                            >
                                {renderCells()}
                                {renderBlock(
                                    active?.start ?? row.start,
                                    active?.end ?? row.end,
                                    { row },
                                )}
                            </div>
                        </div>
                    );
                })}

                {interactive && (
                    <div className="flex">
                        <div
                            className={`${LABEL_WIDTH} ${rowHeight} flex shrink-0 items-center border border-dashed border-slate-400 px-1`}
                        >
                            <select
                                value={draftJobId}
                                onChange={(event) =>
                                    setDraftJobId(event.target.value)
                                }
                                aria-label="Job to add to the schedule"
                                className="w-full rounded border border-slate-300 bg-transparent px-1 py-1 text-xs text-slate-800"
                            >
                                <option value="">+ Add job…</option>

                                {needsScheduling.length > 0 && (
                                    <optgroup label="Needs scheduling">
                                        {needsScheduling.map((job) => (
                                            <option
                                                key={job.id}
                                                value={job.id}
                                            >
                                                {job.address}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}

                                {alreadyScheduled.length > 0 && (
                                    <optgroup label="Already scheduled">
                                        {alreadyScheduled.map((job) => (
                                            <option
                                                key={job.id}
                                                value={job.id}
                                            >
                                                {job.address}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        <div
                            onPointerDown={
                                draftJobId
                                    ? (event) => {
                                          const col = colFromX(
                                              event.clientX,
                                          );
                                          beginDrag(event, {
                                              kind: "create",
                                              anchor: col,
                                              origStart: col,
                                              origEnd: col,
                                              start: col,
                                              end: col,
                                          });
                                      }
                                    : undefined
                            }
                            className={`relative flex-1 ${rowHeight} border-y border-r border-dashed border-slate-400 ${
                                draftJobId
                                    ? "cursor-crosshair"
                                    : "cursor-not-allowed"
                            }`}
                        >
                            {renderCells()}

                            {drag?.kind === "create" &&
                                renderBlock(drag.start, drag.end, {
                                    preview: true,
                                })}

                            {!drag && (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                                    {draftJobId
                                        ? "Drag across the days to schedule this job"
                                        : "Pick a job on the left, then drag across the days"}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {legend.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {legend.map((item) => (
                            <li
                                key={item.name}
                                className="flex items-center gap-1.5"
                            >
                                <span
                                    className={`h-2.5 w-2.5 rounded-sm ${item.dot}`}
                                />
                                {item.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
