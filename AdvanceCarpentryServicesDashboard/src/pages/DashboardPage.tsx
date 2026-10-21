import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { JOB_STATUS_LIST } from "../components/layout/NewQuoteModal";
import ScheduleGrid from "../components/schedule/ScheduleGrid";
import { useFeedback } from "../components/ui/Feedback";
import { CardSkeleton } from "../components/ui/Skeleton";
import { formatCurrency } from "../lib/format";
import { plStatus, type Employee } from "../lib/publicLiability";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import {
    mondayOfCurrentWeek,
    type ScheduleEntry,
    type ScheduleJob,
} from "../components/schedule/scheduleUtils";

const API = "/api";
const LEAD_WEEKS = 3;

type Todo = {
    id: string;
    text: string;
    done: boolean;
    createdAt?: string;
};

const UNDO_WINDOW_MS = 6000;

async function todoRequest(url: string, init?: RequestInit) {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error("Request failed");
    }

    return response.json();
}

// Quoted jobs are deliberately left out of the pipeline.
const PIPELINE_STATUSES = JOB_STATUS_LIST.filter((status) => status !== "Quoted");

function DashboardPage() {
    const { toast } = useFeedback();
    useDocumentTitle("Dashboard");

    const [jobs, setJobs] = useState<ScheduleJob[]>([]);
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [newTodo, setNewTodo] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const pendingDeletes = useRef(new Set<number>());

    useEffect(() => {
        async function load() {
            try {
                const [loadedJobs, loadedEntries, loadedTodos] =
                    await Promise.all([
                        todoRequest(`${API}/quoted-jobs`),
                        todoRequest(`${API}/schedule`),
                        todoRequest(`${API}/todos`),
                    ]);

                setJobs(loadedJobs);
                setEntries(loadedEntries);
                setTodos(loadedTodos);

                // Secondary card: the dashboard still loads if this fails.
                setEmployees(
                    await todoRequest(`${API}/employees`).catch(() => []),
                );
            } catch (error) {
                console.error(error);
                setLoadFailed(true);
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, []);

    async function addTodo() {
        const text = newTodo.trim();

        if (!text) {
            return;
        }

        setNewTodo("");

        try {
            const created: Todo = await todoRequest(`${API}/todos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            setTodos((current) => [...current, created]);
        } catch (error) {
            console.error("Failed to add todo:", error);
            setNewTodo(text);
            toast({
                message: "Couldn't add that task. It's still in the box so you can retry.",
                tone: "error",
            });
        }
    }

    async function toggleTodo(todo: Todo) {
        const done = !todo.done;
        const apply = (value: boolean) =>
            setTodos((current) =>
                current.map((item) =>
                    item.id === todo.id ? { ...item, done: value } : item,
                ),
            );

        apply(done);

        try {
            await todoRequest(`${API}/todos/${todo.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ done }),
            });
        } catch (error) {
            console.error("Failed to update todo:", error);
            apply(todo.done);
            toast({
                message: "Couldn't update that task. It's been put back.",
                tone: "error",
            });
        }
    }

    // Deleting is instant on screen with an Undo; the server delete only
    // happens once the Undo window has passed.
    function removeTodos(items: Todo[], message: string) {
        if (items.length === 0) {
            return;
        }

        const ids = new Set(items.map((item) => item.id));
        setTodos((current) => current.filter((item) => !ids.has(item.id)));

        const timer = window.setTimeout(() => {
            pendingDeletes.current.delete(timer);

            items.forEach((item) => {
                fetch(`${API}/todos/${item.id}`, { method: "DELETE" }).catch(
                    () => undefined,
                );
            });
        }, UNDO_WINDOW_MS);

        pendingDeletes.current.add(timer);

        toast({
            message,
            durationMs: UNDO_WINDOW_MS,
            action: {
                label: "Undo",
                onClick: () => {
                    window.clearTimeout(timer);
                    pendingDeletes.current.delete(timer);
                    setTodos((current) =>
                        [...current, ...items].sort((a, b) =>
                            (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
                        ),
                    );
                },
            },
        });
    }

    const openTodos = todos.filter((todo) => !todo.done);
    const doneTodos = todos.filter((todo) => todo.done);

    const scheduledJobIds = new Set(entries.map((entry) => entry.jobId));
    const needsScheduling = jobs
        .filter(
            (job) =>
                (job.status === "Cutting List" ||
                    job.status === "Under Construction") &&
                !scheduledJobIds.has(job.id),
        )
        .sort((a, b) => a.address.localeCompare(b.address));

    const pipeline = PIPELINE_STATUSES.map((status) => {
        const matching = jobs.filter((job) => job.status === status);

        return {
            status,
            count: matching.length,
            value: matching.reduce(
                (total, job) => total + (job.inclGst ?? 0),
                0,
            ),
        };
    });

    // ABN workers whose cover has lapsed, is missing, or ends within 6 weeks.
    const plAlerts = employees
        .filter((e) => e.group === "abn" && e.status === "active")
        .map((employee) => ({ employee, status: plStatus(employee.plExpiry) }))
        .filter(({ status }) => status.tone !== "green")
        .sort((a, b) => (a.status.days ?? -Infinity) - (b.status.days ?? -Infinity));

    return (
        <div>
            <h1 className="text-3xl font-semibold text-gray-900">
                Advance Carpentry Dashboard
            </h1>

            <p className="mt-2 text-gray-600">
                What's on, what still needs a date, and where jobs are at.
            </p>

            {loading ? (
                <div className="mt-8 space-y-6">
                    <CardSkeleton lines={6} />

                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                </div>
            ) : loadFailed ? (
                <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Couldn't reach the server, so nothing is shown here.
                    Check it's running and refresh the page.
                </p>
            ) : (
                <div className="mt-8 space-y-6">
                    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Next {LEAD_WEEKS} weeks
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Who's on site and when.
                                </p>
                            </div>

                            <NavLink
                                to="/schedule"
                                className="text-sm font-medium text-blue-600 hover:underline"
                            >
                                Open schedule →
                            </NavLink>
                        </div>

                        <ScheduleGrid
                            monday={mondayOfCurrentWeek()}
                            weeks={LEAD_WEEKS}
                            entries={entries}
                            jobs={jobs}
                            compact
                        />
                    </section>

                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {plAlerts.length > 0 && (
                            <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Public liability
                                    </h2>

                                    <NavLink
                                        to="/employees"
                                        className="text-sm font-medium text-blue-600 hover:underline"
                                    >
                                        Employees →
                                    </NavLink>
                                </div>

                                <ul className="divide-y divide-gray-200">
                                    {plAlerts.map(({ employee, status }) => (
                                        <li
                                            key={employee.id}
                                            className="flex items-center justify-between gap-3 py-3"
                                        >
                                            <p className="min-w-0 truncate text-sm font-semibold text-gray-900">
                                                {employee.name}
                                            </p>

                                            <span
                                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white ${
                                                    status.tone === "red"
                                                        ? "bg-red-600"
                                                        : status.tone === "amber"
                                                          ? "bg-amber-500"
                                                          : "bg-gray-500"
                                                }`}
                                            >
                                                {status.label}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Needs scheduling
                                </h2>

                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                    {needsScheduling.length}
                                </span>
                            </div>

                            {needsScheduling.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    Every active job has a date.
                                </p>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {needsScheduling.map((job) => (
                                        <li
                                            key={job.id}
                                            className="flex items-center justify-between gap-3 py-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900">
                                                    {job.address}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {job.name} · {job.status}
                                                </p>
                                            </div>

                                            <NavLink
                                                to="/schedule"
                                                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                            >
                                                Schedule
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    To-do
                                </h2>

                                {doneTodos.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeTodos(
                                                doneTodos,
                                                `Cleared ${doneTodos.length} done task${doneTodos.length === 1 ? "" : "s"}.`,
                                            )
                                        }
                                        className="text-xs font-medium text-gray-500 hover:text-gray-900"
                                    >
                                        Clear {doneTodos.length} done
                                    </button>
                                )}
                            </div>

                            <input
                                type="text"
                                value={newTodo}
                                onChange={(event) =>
                                    setNewTodo(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        void addTodo();
                                    }
                                }}
                                placeholder="Add a task and press Enter"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                            />

                            {todos.length === 0 ? (
                                <p className="mt-3 text-sm text-gray-500">
                                    Nothing to do. Nice.
                                </p>
                            ) : (
                                <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                                    {[...openTodos, ...doneTodos].map((todo) => (
                                        <li
                                            key={todo.id}
                                            className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={todo.done}
                                                onChange={() =>
                                                    void toggleTodo(todo)
                                                }
                                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                                                aria-label={`Mark "${todo.text}" ${todo.done ? "not done" : "done"}`}
                                            />

                                            <span
                                                className={`min-w-0 flex-1 break-words text-sm ${
                                                    todo.done
                                                        ? "text-gray-400 line-through"
                                                        : "text-gray-900"
                                                }`}
                                            >
                                                {todo.text}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeTodos(
                                                        [todo],
                                                        `Deleted "${todo.text}".`,
                                                    )
                                                }
                                                className="shrink-0 px-1 text-lg leading-none text-gray-400 hover:text-red-600"
                                                aria-label={`Delete "${todo.text}"`}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                            <h2 className="mb-4 text-lg font-semibold text-gray-900">
                                Pipeline
                            </h2>

                            <div className="space-y-3">
                                {pipeline.map((item) => (
                                    <div
                                        key={item.status}
                                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {item.status}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.count} job
                                                {item.count === 1 ? "" : "s"}
                                            </p>
                                        </div>

                                        <p className="text-lg font-semibold text-gray-900">
                                            {formatCurrency(item.value)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-3 text-xs text-gray-500">
                                Values include GST. Quoted jobs aren't
                                counted.
                            </p>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
