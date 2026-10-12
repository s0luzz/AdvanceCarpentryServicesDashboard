import { useEffect, useMemo, useRef, useState } from "react";

import { useFeedback } from "../components/ui/Feedback";
import { TableSkeleton } from "../components/ui/Skeleton";
import { formatDate } from "../lib/format";
import {
    plStatus,
    renewedExpiry,
    type Employee,
    type EmployeeFile,
    type PlTone,
} from "../lib/publicLiability";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const API = "/api/employees";

const GROUPS: { id: Employee["group"]; title: string; blurb: string }[] = [
    // { id: "owner", title: "Me", blurb: "Owner and office." },
    {
        id: "abn",
        title: "ABN employees",
        blurb: "Subcontractors. Each needs current public liability cover.",
    },
    {
        id: "apprentice",
        title: "Apprentice trainees",
        blurb: "On training contracts.",
    },
];

// Solid fills read the same in light and dark mode.
const TONE: Record<PlTone, { fill: string; text: string }> = {
    red: { fill: "bg-red-600", text: "text-red-600" },
    amber: { fill: "bg-amber-500", text: "text-amber-600" },
    green: { fill: "bg-emerald-600", text: "text-emerald-600" },
    none: { fill: "bg-gray-400", text: "text-gray-500" },
};

async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(result?.message ?? "Request failed");
    }

    return response.json();
}

// A native date input fires onChange while the year is half typed ("0002-..."),
// so keep a draft and only pass real 20xx dates (or a cleared field) upward.
function ExpiryInput({
    value,
    onCommit,
}: {
    value: string | null;
    onCommit: (value: string | null) => void;
}) {
    const [draft, setDraft] = useState(value ?? "");

    useEffect(() => setDraft(value ?? ""), [value]);

    return (
        <input
            type="date"
            value={draft}
            onChange={(event) => {
                setDraft(event.target.value);

                if (!event.target.value) {
                    onCommit(null);
                } else if (/^20\d{2}-/.test(event.target.value)) {
                    onCommit(event.target.value);
                }
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
        />
    );
}

function PublicLiability({
    employee,
    onChange,
}: {
    employee: Employee;
    onChange: (expiry: string | null) => void;
}) {
    const { tone, label, days } = plStatus(employee.plExpiry);
    // The bar is the time left in a 12-month policy; empty = lapsed or unknown.
    const fill = days === null ? 0 : Math.max(0, Math.min(1, days / 365));

    return (
        <div className="w-full min-w-0 sm:w-80">
            <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${TONE[tone].text}`}>
                    {label}
                </span>

                <button
                    type="button"
                    onClick={() => onChange(renewedExpiry(employee.plExpiry))}
                    title="Set the expiry to the next policy year"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                    {employee.plExpiry ? "Renew +1 yr" : "Start +1 yr"}
                </button>
            </div>

            <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
                role="img"
                aria-label={label}
            >
                <div
                    className={`h-full rounded-full ${TONE[tone].fill}`}
                    style={{ width: `${Math.max(fill * 100, tone === "none" ? 0 : 3)}%` }}
                />
            </div>

            <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                Expires
                <ExpiryInput value={employee.plExpiry} onCommit={onChange} />
            </label>
        </div>
    );
}

function formatSize(bytes: number) {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Certificates, contracts, forms: anything related to the person.
function Documents({
    employee,
    onChange,
}: {
    employee: Employee;
    onChange: (updated: Employee) => void;
}) {
    const { toast, confirm } = useFeedback();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const files = employee.files ?? [];
    const base = `${API}/${employee.id}/files`;

    async function upload(list: FileList | null) {
        if (!list?.length) {
            return;
        }

        const form = new FormData();

        Array.from(list).forEach((file) => form.append("files", file));
        setBusy(true);

        try {
            const response = await fetch(base, { method: "POST", body: form });

            if (!response.ok) {
                throw new Error();
            }

            onChange(await response.json());
            setOpen(true);
            toast(`Added ${list.length} file${list.length === 1 ? "" : "s"} to ${employee.name}.`);
        } catch {
            toast({ message: "Couldn't upload (files must be under 25 MB).", tone: "error" });
        } finally {
            setBusy(false);

            if (input.current) {
                input.current.value = "";
            }
        }
    }

    async function remove(file: EmployeeFile) {
        const ok = await confirm({
            title: `Delete ${file.name}?`,
            message: "The file is removed from this person for good.",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (!ok) {
            return;
        }

        try {
            onChange(await send(`${base}/${file.id}`, "DELETE"));
        } catch {
            toast({ message: "Couldn't delete that file.", tone: "error" });
        }
    }

    return (
        <div className="basis-full">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    aria-expanded={open}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                    {open ? "▾" : "▸"} Documents ({files.length})
                </button>

                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                    {busy ? "Uploading..." : "Add files"}
                </button>

                <input
                    ref={input}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => void upload(event.target.files)}
                />
            </div>

            {open && (
                <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
                    {files.length === 0 && (
                        <li className="px-3 py-2 text-xs text-gray-500">No documents yet.</li>
                    )}

                    {files.map((file) => (
                        <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <a
                                href={`${base}/${file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 truncate text-sm text-blue-600 hover:underline"
                            >
                                {file.name}
                            </a>

                            <span className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                                {formatSize(file.size)}

                                <button
                                    type="button"
                                    onClick={() => void remove(file)}
                                    aria-label={`Delete ${file.name}`}
                                    className="text-base leading-none text-gray-400 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function EmployeeDialog({
    initial,
    onSave,
    onDelete,
    onClose,
}: {
    initial: Partial<Employee> & { group: Employee["group"] };
    onSave: (values: Partial<Employee>) => Promise<void>;
    onDelete?: () => void;
    onClose: () => void;
}) {
    const [values, setValues] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const set = <K extends keyof Employee>(key: K, value: Employee[K]) =>
        setValues((current) => ({ ...current, [key]: value }));

    async function submit() {
        setSaving(true);
        setError("");

        try {
            await onSave(values);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't save.");
            setSaving(false);
        }
    }

    const text = (key: "name" | "role" | "phone" | "email" | "abn", label: string) => (
        <label className="block text-sm font-medium text-gray-700">
            {label}
            <input
                type="text"
                value={values[key] ?? ""}
                onChange={(event) => set(key, event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {initial.id ? "Edit person" : "Add person"}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close dialog"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-4">
                    {text("name", "Name")}

                    <label className="block text-sm font-medium text-gray-700">
                        Group
                        <select
                            value={values.group}
                            onChange={(event) =>
                                set("group", event.target.value as Employee["group"])
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        >
                            {GROUPS.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.title}
                                </option>
                            ))}
                        </select>
                    </label>

                    {text("role", "Role")}
                    {text("phone", "Phone")}
                    {text("email", "Email")}

                    {values.group === "abn" && (
                        <>
                            {text("abn", "ABN")}

                            <label className="block text-sm font-medium text-gray-700">
                                Public liability expires
                                <input
                                    type="date"
                                    value={values.plExpiry ?? ""}
                                    onChange={(event) =>
                                        set("plExpiry", event.target.value || null)
                                    }
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                                />
                            </label>
                        </>
                    )}

                    <label className="block text-sm font-medium text-gray-700">
                        Notes
                        <textarea
                            value={values.notes ?? ""}
                            onChange={(event) => set("notes", event.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        />
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={values.status === "inactive"}
                            onChange={(event) =>
                                set("status", event.target.checked ? "inactive" : "active")
                            }
                        />
                        No longer working with us
                    </label>
                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex items-center justify-between gap-3">
                    {onDelete ? (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="text-sm font-medium text-red-600 hover:underline"
                        >
                            Delete
                        </button>
                    ) : (
                        <span />
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={submit}
                            disabled={saving || !values.name?.trim()}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmployeesPage() {
    useDocumentTitle("Employees");
    const { toast, confirm } = useFeedback();
    const [employees, setEmployees] = useState<Employee[] | null>(null);
    const [editing, setEditing] = useState<
        (Partial<Employee> & { group: Employee["group"] }) | null
    >(null);

    useEffect(() => {
        send(API, "GET")
            .then(setEmployees)
            .catch(() => setEmployees([]));
    }, []);

    const replace = (updated: Employee) =>
        setEmployees((current) =>
            (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );

    async function patch(employee: Employee, changes: Partial<Employee>) {
        replace({ ...employee, ...changes });

        try {
            replace(await send(`${API}/${employee.id}`, "PATCH", changes));
        } catch {
            replace(employee);
            toast({ message: "Couldn't save that change.", tone: "error" });
        }
    }

    function changeExpiry(employee: Employee, expiry: string | null) {
        const previous = employee.plExpiry;

        patch(employee, { plExpiry: expiry });
        toast({
            message: expiry
                ? `${employee.name}: public liability now expires ${formatDate(expiry + "T00:00")}.`
                : `${employee.name}: expiry cleared.`,
            action: {
                label: "Undo",
                onClick: () => patch({ ...employee, plExpiry: expiry }, { plExpiry: previous }),
            },
        });
    }

    async function save(values: Partial<Employee>) {
        if (values.id) {
            replace(await send(`${API}/${values.id}`, "PATCH", values));
        } else {
            const created: Employee = await send(API, "POST", values);

            setEmployees((current) => [...(current ?? []), created]);
        }

        setEditing(null);
    }

    async function remove(employee: Employee) {
        const ok = await confirm({
            title: `Delete ${employee.name}?`,
            message: "This removes them from the list. Mark them as no longer working with us to keep their details instead.",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (!ok) {
            return;
        }

        try {
            await send(`${API}/${employee.id}`, "DELETE");
            setEmployees((current) => (current ?? []).filter((item) => item.id !== employee.id));
            setEditing(null);
        } catch {
            toast({ message: "Couldn't delete that person.", tone: "error" });
        }
    }

    const abnActive = useMemo(
        () => (employees ?? []).filter((e) => e.group === "abn" && e.status === "active"),
        [employees],
    );

    const summary = useMemo(() => {
        const states = abnActive.map((e) => plStatus(e.plExpiry));

        return {
            expired: states.filter((s) => s.days !== null && s.days < 0).length,
            soon: states.filter((s) => s.days !== null && s.days >= 0 && s.days <= 42).length,
            missing: states.filter((s) => s.days === null).length,
            covered: states.filter((s) => s.days !== null && s.days > 42).length,
        };
    }, [abnActive]);

    if (employees === null) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <TableSkeleton rows={8} columns={4} />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-gray-500">Employees</p>

                    <h1 className="mt-1 text-3xl font-semibold text-gray-900">
                        Team
                    </h1>
                </div>

                <button
                    type="button"
                    onClick={() => setEditing({ group: "abn", status: "active" })}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                    Add person
                </button>
            </div>

            <div className="space-y-8">
                {GROUPS.map((group) => {
                    const people = employees
                        .filter((e) => e.group === group.id)
                        .sort((a, b) => {
                            if (a.status !== b.status) {
                                return a.status === "active" ? -1 : 1;
                            }

                            if (group.id === "abn") {
                                // Soonest (and missing / lapsed) first.
                                const left = (e: Employee) =>
                                    plStatus(e.plExpiry).days ?? -Infinity;

                                return left(a) - left(b);
                            }

                            return a.name.localeCompare(b.name);
                        });

                    return (
                        <section
                            key={group.id}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm"
                        >
                            <div className="border-b border-gray-200 px-6 py-4">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {group.title}{" "}
                                    <span className="text-sm font-normal text-gray-500">
                                        ({people.length})
                                    </span>
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">{group.blurb}</p>

                                {group.id === "abn" && (
                                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {(
                                            [
                                                ["Expired", summary.expired, "red"],
                                                ["Due in 6 weeks", summary.soon, "amber"],
                                                ["No certificate", summary.missing, "none"],
                                                ["Covered", summary.covered, "green"],
                                            ] as const
                                        ).map(([name, count, tone]) => (
                                            <div
                                                key={name}
                                                className="rounded-lg border border-gray-200 px-3 py-2"
                                            >
                                                <p
                                                    className={`text-2xl font-semibold ${
                                                        count ? TONE[tone].text : "text-gray-400"
                                                    }`}
                                                >
                                                    {count}
                                                </p>
                                                <p className="text-xs text-gray-500">{name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {people.length === 0 ? (
                                <p className="px-6 py-8 text-center text-sm text-gray-500">
                                    Nobody here yet.
                                </p>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {people.map((person) => (
                                        <li
                                            key={person.id}
                                            className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 ${
                                                person.status === "inactive" ? "opacity-50" : ""
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1 basis-56">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(person)}
                                                    className="text-left font-medium text-gray-900 hover:underline"
                                                >
                                                    {person.name}
                                                </button>

                                                {person.status === "inactive" && (
                                                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                                        Inactive
                                                    </span>
                                                )}

                                                <p className="text-sm text-gray-500">
                                                    {[person.role, person.group === "abn" && person.abn && `ABN ${person.abn}`]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </p>

                                                <p className="truncate text-sm text-gray-500">
                                                    {person.phone && (
                                                        <a href={`tel:${person.phone}`} className="hover:underline">
                                                            {person.phone}
                                                        </a>
                                                    )}
                                                    {person.phone && person.email && " · "}
                                                    {person.email && (
                                                        <a href={`mailto:${person.email}`} className="hover:underline">
                                                            {person.email}
                                                        </a>
                                                    )}
                                                </p>
                                            </div>

                                            {group.id === "abn" && person.status === "active" && (
                                                <PublicLiability
                                                    employee={person}
                                                    onChange={(expiry) => changeExpiry(person, expiry)}
                                                />
                                            )}

                                            <Documents employee={person} onChange={replace} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>

            {editing && (
                <EmployeeDialog
                    key={editing.id ?? "new"}
                    initial={editing}
                    onSave={save}
                    onDelete={
                        editing.id
                            ? () => remove(editing as Employee)
                            : undefined
                    }
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}

export default EmployeesPage;
