export type ScheduleEntry = {
    id: string;
    jobId: string;
    start: string;
    end: string;
};

export type ScheduleJob = {
    id: string;
    name: string;
    address: string;
    status?: string;
    inclGst?: number;
};

export const DAYS_PER_WEEK = 6;
export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S"];

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates are local "YYYY-MM-DD" strings (same format the server stores).
export function parseDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatDate(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + days,
    );
}

// The schedule has no Sunday, so on a Sunday "this week" is the coming one.
export function mondayOfCurrentWeek(today = new Date()) {
    const day = today.getDay();
    const offset = day === 0 ? 1 : 1 - day;
    return addDays(
        new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
        ),
        offset,
    );
}

// Column index (Mon-Sat only) of a date, relative to the window's Monday.
// Negative / past-the-end values are fine: the window is just a view.
export function dateToCol(date: string, monday: Date) {
    const diff = Math.round(
        (parseDate(date).getTime() - monday.getTime()) / DAY_MS,
    );
    const week = Math.floor(diff / 7);
    const dayOfWeek = Math.min(diff - week * 7, DAYS_PER_WEEK - 1);
    return week * DAYS_PER_WEEK + dayOfWeek;
}

export function colToDate(col: number, monday: Date) {
    const week = Math.floor(col / DAYS_PER_WEEK);
    const dayOfWeek = col - week * DAYS_PER_WEEK;
    return formatDate(addDays(monday, week * 7 + dayOfWeek));
}

export function weekLabel(monday: Date) {
    const saturday = addDays(monday, DAYS_PER_WEEK - 1);
    const month = (date: Date, style: "long" | "short") =>
        date.toLocaleDateString("en-AU", { month: style });

    if (monday.getMonth() === saturday.getMonth()) {
        return `${month(monday, "long")} ${monday.getDate()}-${saturday.getDate()}`;
    }

    return `${month(monday, "long")} ${monday.getDate()} - ${month(saturday, "short")} ${saturday.getDate()}`;
}

export function formatLongDate(date: string) {
    return parseDate(date).toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

export function sortEntries(entries: ScheduleEntry[]) {
    return [...entries].sort(
        (a, b) =>
            a.start.localeCompare(b.start) ||
            a.id.localeCompare(b.id),
    );
}
