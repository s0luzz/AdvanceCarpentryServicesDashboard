const aud = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
});

// Money is always shown to the cent, e.g. $58,999.996 -> $59,000.00.
export function formatCurrency(value: number | null | undefined) {
    return aud.format(value ?? 0);
}

const shortDate = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

// One date format everywhere: "08 Oct 2026" (can't be misread as US order).
export function formatDate(value: string | number | Date | null | undefined) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "—" : shortDate.format(date);
}
