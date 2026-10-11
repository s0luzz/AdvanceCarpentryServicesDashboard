import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import ScheduleGrid from "../components/schedule/ScheduleGrid";
import {
    mondayOfCurrentWeek,
    type ScheduleEntry,
    type ScheduleJob,
} from "../components/schedule/scheduleUtils";

const API = "http://localhost:3001/api";
const LEAD_WEEKS = 3;

type Todo = {
    id: string;
    text: string;
    done: boolean;
};

async function todoRequest(url: string, init?: RequestInit) {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error("Request failed");
    }

    return response.json();
}

// Quoted jobs are deliberately left out of the pipeline.
const PIPELINE_STATUSES = [
    "Cutting List",
    "Under Construction",
    "Complete",
] as const;

function formatCurrency(value: number) {
    return `$${Math.round(value).toLocaleString("en-AU")}`;
}

function DashboardPage() {
    const [jobs, setJobs] = useState<ScheduleJob[]>([]);
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

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
        }
    }

    async function deleteTodo(id: string) {
        const previous = todos;
        setTodos((current) => current.filter((item) => item.id !== id));

        try {
            await todoRequest(`${API}/todos/${id}`, { method: "DELETE" });
        } catch (error) {
            console.error("Failed to delete todo:", error);
            setTodos(previous);
        }
    }

    async function clearDoneTodos() {
        const previous = todos;
        setTodos((current) => current.filter((item) => !item.done));

        try {
            await todoRequest(`${API}/todos`, { method: "DELETE" });
        } catch (error) {
            console.error("Failed to clear todos:", error);
            setTodos(previous);
        }
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

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-3xl font-semibold text-gray-900">
                Advance Carpentry Dashboard
            </h1>

            <p className="mt-2 text-gray-600">
                What's on, what still needs a date, and where jobs are at.
            </p>

            {loading ? (
                <p className="mt-8 text-gray-500">Loading...</p>
            ) : loadFailed ? (
                <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Couldn't reach the server, so nothing is shown here.
                    Check it's running and refresh the page.
                </p>
            ) : (
                <div className="mt-8 space-y-6">
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
                        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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

                        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    To-do
                                </h2>

                                {doneTodos.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => void clearDoneTodos()}
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
                                                    void deleteTodo(todo.id)
                                                }
                                                className="shrink-0 text-lg leading-none text-gray-400 opacity-0 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                                                aria-label={`Delete "${todo.text}"`}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
        </main>
    );
}

export default DashboardPage;
