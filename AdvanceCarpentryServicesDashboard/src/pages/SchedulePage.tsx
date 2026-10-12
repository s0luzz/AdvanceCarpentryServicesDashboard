import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { useFeedback } from "../components/ui/Feedback";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import ScheduleGrid from "../components/schedule/ScheduleGrid";
import { exportSchedulePdf } from "../components/schedule/exportSchedulePdf";
import {
    DAYS_PER_WEEK,
    addDays,
    colToDate,
    dateToCol,
    formatLongDate,
    mondayOfCurrentWeek,
    sortEntries,
    type ScheduleEntry,
    type ScheduleJob,
} from "../components/schedule/scheduleUtils";

const API = "/api";
const WEEKS = 4;

async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, init);

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Request failed");
    }

    return response.json();
}

function jsonInit(method: string, body: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

function SchedulePage() {
    const { toast } = useFeedback();
    useDocumentTitle("Schedule");

    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [jobs, setJobs] = useState<ScheduleJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const monday = addDays(mondayOfCurrentWeek(), weekOffset * 7);
    const lastSaturday = addDays(monday, (WEEKS - 1) * 7 + 5);

    const load = useCallback(async () => {
        try {
            const [loadedJobs, loadedEntries] = await Promise.all([
                request(`${API}/quoted-jobs`),
                request(`${API}/schedule`),
            ]);
            setJobs(loadedJobs);
            setEntries(loadedEntries);
        } catch (error) {
            console.error("Failed to load schedule:", error);
            toast({
                message: "Couldn't load the schedule. Try refreshing the page.",
                tone: "error",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    function fail(error: unknown) {
        console.error(error);
        toast({
            message:
                error instanceof Error
                    ? error.message
                    : "Something went wrong.",
            tone: "error",
        });
        void load();
    }

    async function createEntry(jobId: string, start: string, end: string) {
        try {
            const created: ScheduleEntry = await request(
                `${API}/schedule`,
                jsonInit("POST", { jobId, start, end }),
            );
            setEntries((current) => [...current, created]);
        } catch (error) {
            fail(error);
        }
    }

    async function changeEntry(id: string, start: string, end: string) {
        setEntries((current) =>
            current.map((entry) =>
                entry.id === id ? { ...entry, start, end } : entry,
            ),
        );

        try {
            await request(
                `${API}/schedule/${id}`,
                jsonInit("PATCH", { start, end }),
            );
        } catch (error) {
            fail(error);
        }
    }

    async function removeEntry(id: string) {
        setSelectedId(null);
        setEntries((current) => current.filter((entry) => entry.id !== id));

        try {
            await request(`${API}/schedule/${id}`, { method: "DELETE" });
        } catch (error) {
            fail(error);
        }
    }

    // A second stage is a new row: same job, same length, next working days.
    async function duplicateEntry(entry: ScheduleEntry) {
        setSelectedId(null);

        const startCol = dateToCol(entry.start, monday);
        const endCol = dateToCol(entry.end, monday);
        const length = endCol - startCol + 1;

        await createEntry(
            entry.jobId,
            colToDate(endCol + 1, monday),
            colToDate(endCol + length, monday),
        );
    }

    function handleExport() {
        const jobsById = new Map(jobs.map((job) => [job.id, job]));
        const columns = WEEKS * DAYS_PER_WEEK;

        const rows = sortEntries(entries)
            .map((entry) => ({
                label: jobsById.get(entry.jobId)?.address ?? "",
                startCol: dateToCol(entry.start, monday),
                endCol: dateToCol(entry.end, monday),
            }))
            .filter(
                (row) =>
                    row.label &&
                    row.startCol <= columns - 1 &&
                    row.endCol >= 0,
            );

        exportSchedulePdf({ monday, weeks: WEEKS, rows });
    }

    const selected = entries.find((entry) => entry.id === selectedId);
    const selectedJob = jobs.find((job) => job.id === selected?.jobId);
    const selectedLength = selected
        ? dateToCol(selected.end, monday) -
          dateToCol(selected.start, monday) +
          1
        : 0;

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <TableSkeleton rows={7} columns={4} />
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900">
                        Schedule
                    </h1>

                    <p className="mt-2 text-gray-600">
                        {monday.toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                        })}{" "}
                        –{" "}
                        {lastSaturday.toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                        })}
                        {" "}· 4 weeks, Sundays skipped
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setWeekOffset((value) => value - 1)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        ‹ Prev week
                    </button>

                    <button
                        type="button"
                        onClick={() => setWeekOffset(0)}
                        disabled={weekOffset === 0}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    >
                        Today
                    </button>

                    <button
                        type="button"
                        onClick={() => setWeekOffset((value) => value + 1)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Next week ›
                    </button>

                    <button
                        type="button"
                        onClick={handleExport}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        Export PDF
                    </button>
                </div>
            </div>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <ScheduleGrid
                    monday={monday}
                    weeks={WEEKS}
                    entries={entries}
                    jobs={jobs}
                    onCreate={createEntry}
                    onChange={changeEntry}
                    onSelect={setSelectedId}
                />
            </section>

            <p className="mt-3 text-xs text-gray-500">
                Pick a job in the last row and drag across the days to
                schedule it. Drag a block to move it, drag its ends to resize
                it, click it for more options.
            </p>

            {selected && selectedJob && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {selectedJob.address}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            {selectedJob.name}
                        </p>

                        <p className="mt-4 text-sm text-gray-700">
                            {formatLongDate(selected.start)} –{" "}
                            {formatLongDate(selected.end)} ({selectedLength}{" "}
                            working day{selectedLength === 1 ? "" : "s"})
                        </p>

                        <NavLink
                            to={`/jobs/${selectedJob.id}`}
                            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
                        >
                            Open job
                        </NavLink>

                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => void removeEntry(selected.id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                                Remove
                            </button>

                            <button
                                type="button"
                                onClick={() => void duplicateEntry(selected)}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                                Add second stage (new row)
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedId(null)}
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SchedulePage;
