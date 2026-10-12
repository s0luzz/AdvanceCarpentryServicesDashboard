import { useMemo, useState } from "react";

import { downloadQuote } from "../../lib/downloadInvoice";
import { formatCurrency } from "../../lib/format";
import {
    TYPE_LABELS,
    buildScope,
    defaultOptions,
    optionsFromScope,
    standardLines,
    type QuoteOptions,
    type QuoteType,
} from "../../lib/quoteScope";

export type SavedQuote = {
    number: number;
    date: string;
    to: string;
    site?: string;
    scope: string[];
    options?: QuoteOptions;
    cash?: boolean;
    exGst: number;
    gst: number;
    inclGst: number;
};

export type QuoteJob = {
    id: string;
    name: string;
    address: string;
    inclGst: number;
    quoteNumber?: number;
    hasSecondFloor?: boolean;
    hasHebel?: boolean;
    quote?: SavedQuote;
};

type QuoteDialogProps = {
    job: QuoteJob;
    // Every job, to start from the same client's last quote.
    jobs: QuoteJob[];
    onClose: () => void;
    onSaved: (quote: SavedQuote) => void;
};

const INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

const round2 = (value: number) => Math.round(value * 100) / 100;

function todayIso() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const sameClient = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

// Saved options, or the choices read back from the quote's lines.
const optionsOf = (quote: SavedQuote) =>
    quote.options ?? optionsFromScope(quote.scope);

// A new quote starts from this client's most recent one, then follows what the
// job itself says (second floor, hebel wall).
function startingOptions(job: QuoteJob, jobs: QuoteJob[]): QuoteOptions {
    const last = jobs
        .filter(
            (other) =>
                other.id !== job.id &&
                other.quote &&
                sameClient(other.name, job.name),
        )
        .sort((a, b) => b.quote!.date.localeCompare(a.quote!.date))[0];

    const base: QuoteOptions = last
        ? { ...optionsOf(last.quote!), removed: [] }
        : defaultOptions();

    const type: QuoteType = job.hasHebel
        ? "duplex"
        : job.hasSecondFloor === false
          ? "single"
          : job.hasSecondFloor
            ? "double"
            : base.type;

    return {
        ...base,
        type,
        steel: type === base.type ? base.steel : type !== "single",
        hebel: base.hebel || job.hasHebel === true,
    };
}

export default function QuoteDialog({ job, jobs, onClose, onSaved }: QuoteDialogProps) {
    const existing = job.quote;

    const [options, setOptions] = useState<QuoteOptions>(() =>
        existing ? optionsOf(existing) : startingOptions(job, jobs),
    );
    const [to, setTo] = useState(existing?.to ?? job.name);
    const [site, setSite] = useState(existing?.site ?? job.address);
    const [date, setDate] = useState(existing?.date ?? todayIso());
    const [number, setNumber] = useState(
        existing
            ? String(existing.number)
            : job.quoteNumber && job.quoteNumber >= 1000
              ? String(job.quoteNumber)
              : "",
    );
    const [cash, setCash] = useState(existing?.cash ?? false);
    const [price, setPrice] = useState(
        String(round2(existing?.inclGst ?? job.inclGst ?? 0) || ""),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const set = <K extends keyof QuoteOptions>(key: K, value: QuoteOptions[K]) =>
        setOptions((current) => ({ ...current, [key]: value }));

    const lines = useMemo(() => standardLines(options), [options]);
    const scope = useMemo(() => buildScope(options), [options]);

    const incl = Number(price.replace(/[$,\s]/g, ""));
    const gst = cash ? 0 : round2(incl / 11);
    const priceOk = Number.isFinite(incl) && incl > 0;

    function changeType(type: QuoteType) {
        // Single storey leaves steel and crane out; the others include them.
        setOptions((current) => ({
            ...current,
            type,
            steel: type !== "single",
        }));
    }

    function toggleLine(key: string) {
        set(
            "removed",
            options.removed.includes(key)
                ? options.removed.filter((item) => item !== key)
                : [...options.removed, key],
        );
    }

    async function save(download?: "docx" | "pdf") {
        setBusy(true);
        setError("");

        try {
            const response = await fetch(`/api/quoted-jobs/${job.id}/quote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    number,
                    date,
                    to,
                    site,
                    scope,
                    options,
                    cash,
                    inclGst: incl,
                }),
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message ?? "Couldn't save the quote.");
            }

            onSaved(result);

            if (download) {
                await downloadQuote(job.id, download);
            }

            onClose();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't save the quote.");
            setBusy(false);
        }
    }

    const chip = (active: boolean) =>
        `cursor-pointer rounded-full px-3 py-1 text-sm font-medium ${
            active
                ? "bg-gray-900 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {existing ? `Quote ${existing.number}` : "New quote"}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">{job.address}</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close dialog"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-gray-700">
                            To
                            <input className={`${INPUT} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} />
                        </label>

                        <label className="block text-sm font-medium text-gray-700">
                            Site address
                            <input className={`${INPUT} mt-1`} value={site} onChange={(e) => setSite(e.target.value)} />
                        </label>

                        <label className="block text-sm font-medium text-gray-700">
                            Date
                            <input type="date" className={`${INPUT} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
                        </label>

                        <label className="block text-sm font-medium text-gray-700">
                            Quote number
                            <input
                                className={`${INPUT} mt-1`}
                                value={number}
                                onChange={(e) => setNumber(e.target.value)}
                                placeholder="Next number"
                                inputMode="numeric"
                            />
                        </label>
                    </div>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium text-gray-700">Building</legend>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(TYPE_LABELS) as QuoteType[]).map((type) => (
                                <label key={type} className={chip(options.type === type)}>
                                    <input
                                        type="radio"
                                        name="quote-type"
                                        className="sr-only"
                                        checked={options.type === type}
                                        onChange={() => changeType(type)}
                                    />
                                    {TYPE_LABELS[type]}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={options.steel}
                                onChange={(e) => set("steel", e.target.checked)}
                            />
                            Steel and crane included
                        </label>

                        <fieldset className="flex items-center gap-2 text-sm text-gray-700">
                            <legend className="sr-only">Stud size</legend>
                            Studs
                            {(["90x35", "90x45"] as const).map((size) => (
                                <label key={size} className={chip(options.studs === size)}>
                                    <input
                                        type="radio"
                                        name="quote-studs"
                                        className="sr-only"
                                        checked={options.studs === size}
                                        onChange={() => set("studs", size)}
                                    />
                                    {size.replace("x", " x ")}
                                </label>
                            ))}
                        </fieldset>
                    </div>

                    <details
                        className="rounded-lg border border-gray-200 px-4 py-3"
                        open={options.hebel || options.granny || options.studio || options.garage}
                    >
                        <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            More options (hebel party wall, granny flat, studio, garage)
                        </summary>

                        <div className="mt-3 space-y-3 text-sm text-gray-700">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={options.hebel}
                                        onChange={(e) => set("hebel", e.target.checked)}
                                    />
                                    Hebel party wall
                                </label>

                                {options.hebel &&
                                    ([50, 75] as const).map((size) => (
                                        <label key={size} className={chip(options.hebelSize === size)}>
                                            <input
                                                type="radio"
                                                name="quote-hebel"
                                                className="sr-only"
                                                checked={options.hebelSize === size}
                                                onChange={() => set("hebelSize", size)}
                                            />
                                            {size} mm
                                        </label>
                                    ))}

                                {!options.hebel && options.type === "duplex" && (
                                    <span className="text-xs text-gray-500">
                                        Left off: the quote says "NOT Including Hebel Party Wall".
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {(
                                    [
                                        ["granny", "Granny flat"],
                                        ["studio", "Studio"],
                                        ["garage", "Detached garage"],
                                    ] as const
                                ).map(([key, label]) => (
                                    <label key={key} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={options[key]}
                                            onChange={(e) => set(key, e.target.checked)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </details>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">
                                Description &amp; Inclusions ({scope.length} lines)
                            </h3>

                            {options.removed.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => set("removed", [])}
                                    className="text-xs font-medium text-blue-600 hover:underline"
                                >
                                    Put back {options.removed.length} removed
                                </button>
                            )}
                        </div>

                        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
                            {lines.map((line) => {
                                const off = options.removed.includes(line.key);

                                return (
                                    <li key={line.key} className="flex items-start justify-between gap-3 px-3 py-1.5">
                                        <span className={off ? "text-gray-400 line-through" : "text-gray-900"}>
                                            {line.text}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => toggleLine(line.key)}
                                            aria-label={off ? `Put back: ${line.text}` : `Remove: ${line.text}`}
                                            className="shrink-0 text-base leading-none text-gray-400 hover:text-gray-900"
                                        >
                                            {off ? "+" : "×"}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        <label className="mt-3 block text-sm font-medium text-gray-700">
                            Extra lines (one per line, added above the "NOT including" lines)
                            <textarea
                                rows={3}
                                value={options.extra.join("\n")}
                                onChange={(e) => set("extra", e.target.value.split("\n"))}
                                className={`${INPUT} mt-1`}
                            />
                        </label>
                    </div>

                    <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
                        <label className="block text-sm font-medium text-gray-700">
                            {cash ? "Cash price" : "Total inc GST"}
                            <input
                                className={`${INPUT} mt-1`}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                inputMode="decimal"
                            />
                        </label>

                        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                            <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} />
                            Cash price (no GST)
                        </label>
                    </div>

                    {priceOk && (
                        <p className="text-sm text-gray-500">
                            {cash
                                ? `Total ${formatCurrency(incl)}, no GST.`
                                : `${formatCurrency(round2(incl - gst))} + ${formatCurrency(gst)} GST = ${formatCurrency(incl)}`}
                        </p>
                    )}
                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={busy || !priceOk || !to.trim() || !site.trim() || scope.length === 0}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                        Save
                    </button>

                    {(["docx", "pdf"] as const).map((format) => (
                        <button
                            key={format}
                            type="button"
                            onClick={() => void save(format)}
                            disabled={busy || !priceOk || !to.trim() || !site.trim() || scope.length === 0}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                            {busy ? "Saving..." : `Save & ${format === "docx" ? "Word" : "PDF"}`}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
