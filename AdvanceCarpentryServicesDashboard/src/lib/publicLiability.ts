// Public liability renewal maths, shared by the Employees page and the dashboard.

export type Employee = {
    id: string;
    number: string;
    name: string;
    group: "owner" | "abn" | "apprentice";
    role: string;
    phone: string;
    email: string;
    abn: string;
    status: "active" | "inactive";
    plExpiry: string | null; // YYYY-MM-DD
    notes: string;
    files?: EmployeeFile[];
};

export type EmployeeFile = {
    id: string;
    name: string;
    size: number;
    type: string;
    addedAt: string;
};

export type PlTone = "red" | "amber" | "green" | "none";

const DAY_MS = 86_400_000;

function parseLocal(iso: string) {
    const [year, month, day] = iso.split("-").map(Number);

    return new Date(year, month - 1, day);
}

function toIso(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addYear(date: Date) {
    // Feb 29 + 1 year lands on Mar 1 by itself, which is fine for a renewal date.
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
}

function startOfToday() {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntil(iso: string | null) {
    return iso
        ? Math.round((parseLocal(iso).getTime() - startOfToday().getTime()) / DAY_MS)
        : null;
}

// Red = expired or within 2 weeks, amber = within 6 weeks, otherwise green.
export function plStatus(iso: string | null): {
    tone: PlTone;
    label: string;
    days: number | null;
} {
    const days = daysUntil(iso);

    if (days === null) {
        return { tone: "none", label: "No certificate", days };
    }

    if (days < 0) {
        const ago = -days;

        return {
            tone: "red",
            label: `Expired ${ago} day${ago === 1 ? "" : "s"} ago`,
            days,
        };
    }

    const label =
        days === 0
            ? "Expires today"
            : days <= 60
              ? `${days} day${days === 1 ? "" : "s"} left`
              : `${Math.round(days / 30.4)} months left`;

    return {
        tone: days <= 14 ? "red" : days <= 42 ? "amber" : "green",
        label,
        days,
    };
}

// Next policy year: old expiry + 1 year, or from today if that's already past.
export function renewedExpiry(iso: string | null) {
    const today = startOfToday();
    const next = addYear(iso ? parseLocal(iso) : today);

    return toIso(next < today ? addYear(today) : next);
}
