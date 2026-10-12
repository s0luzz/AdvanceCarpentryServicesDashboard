import { useEffect, useMemo, useState } from "react";

import { formatDate as formatLocalDate } from "../schedule/scheduleUtils";

export const INVOICE_STATUSES = ["Sent", "Paid", "Overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type NewInvoicePayload = {
    jobId?: string;
    description: string;
    amountIncGst: number;
    date: string;
    invoiceNumber?: string;
    status?: InvoiceStatus;
};

type PickableJob = {
    id: string;
    name: string;
    address: string;
};

type InvoiceDialogProps = {
    isOpen: boolean;
    isSubmitting: boolean;
    error: string;
    onClose: () => void;
    onSubmit: (payload: NewInvoicePayload) => void;
    // Invoices page: choose which job this invoice belongs to.
    jobs?: PickableJob[];
    // Job page: the job is already known.
    job?: { name: string; address: string };
};

const API_URL = "";

const round2 = (value: number) => Math.round(value * 100) / 100;

// The GST in a GST-inclusive amount is a eleventh of it.
const gstOf = (incGst: number) => round2(incGst / 11);

const INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

export default function InvoiceDialog({
    isOpen,
    isSubmitting,
    error,
    onClose,
    onSubmit,
    jobs,
    job,
}: InvoiceDialogProps) {
    const picking = Boolean(jobs);

    const [jobId, setJobId] = useState("");
    const [jobFilter, setJobFilter] = useState("");
    const [description, setDescription] = useState("");
    // Whichever price box was typed in last drives the other one.
    const [incText, setIncText] = useState("");
    const [exText, setExText] = useState("");
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [status, setStatus] = useState<InvoiceStatus>("Sent");
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState<
        number | null
    >(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setJobId("");
        setJobFilter("");
        setDescription("");
        setIncText("");
        setExText("");
        setDate(formatLocalDate(new Date()));
        setInvoiceNumber("");
        setStatus("Sent");

        fetch(`${API_URL}/api/counters`)
            .then((response) => response.json())
            .then((counters) =>
                setNextInvoiceNumber(
                    Number(counters?.nextInvoiceNumber) || null,
                ),
            )
            .catch(() => setNextInvoiceNumber(null));
    }, [isOpen]);

    const filteredJobs = useMemo(() => {
        const needle = jobFilter.trim().toLowerCase();

        return (jobs ?? [])
            .filter(
                (item) =>
                    !needle ||
                    `${item.address} ${item.name}`
                        .toLowerCase()
                        .includes(needle),
            )
            .sort((a, b) => a.address.localeCompare(b.address));
    }, [jobs, jobFilter]);

    if (!isOpen) {
        return null;
    }

    const chosenJob = picking
        ? jobs?.find((item) => item.id === jobId)
        : job;

    const incValue = Number(incText);
    const hasAmount =
        incText.trim() !== "" &&
        Number.isFinite(incValue) &&
        incValue > 0;

    const canSubmit =
        hasAmount && (!picking || Boolean(jobId)) && !isSubmitting;

    function handleIncChange(value: string) {
        setIncText(value);

        const inc = Number(value);

        setExText(
            value.trim() !== "" && Number.isFinite(inc)
                ? round2(inc - gstOf(inc)).toFixed(2)
                : "",
        );
    }

    function handleExChange(value: string) {
        setExText(value);

        const ex = Number(value);

        setIncText(
            value.trim() !== "" && Number.isFinite(ex)
                ? round2(ex * 1.1).toFixed(2)
                : "",
        );
    }

    function handleSubmit() {
        if (!canSubmit) {
            return;
        }

        onSubmit({
            jobId: picking ? jobId : undefined,
            description: description.trim(),
            amountIncGst: incValue,
            date: new Date(date).toISOString(),
            invoiceNumber: invoiceNumber.trim() || undefined,
            status: picking ? status : undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {picking ? "Add invoice" : "New Invoice"}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {picking
                                ? "Record an invoice you've already made."
                                : "Issue an invoice against this job."}
                        </p>
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

                <div className="space-y-4">
                    {picking && (
                        <div>
                            <label
                                htmlFor="invoice-job-filter"
                                className="mb-1 block text-sm font-medium text-gray-700"
                            >
                                Job
                            </label>

                            <input
                                id="invoice-job-filter"
                                autoFocus
                                type="text"
                                value={jobFilter}
                                onChange={(event) =>
                                    setJobFilter(event.target.value)
                                }
                                placeholder="Search by address or name…"
                                className={INPUT}
                            />

                            <select
                                size={5}
                                value={jobId}
                                onChange={(event) =>
                                    setJobId(event.target.value)
                                }
                                aria-label="Choose the job"
                                className={`${INPUT} mt-2`}
                            >
                                {filteredJobs.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.address} — {item.name}
                                    </option>
                                ))}
                            </select>

                            {filteredJobs.length === 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    No jobs match "{jobFilter}".
                                </p>
                            )}
                        </div>
                    )}

                    {chosenJob && (
                        <dl className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                            <div className="flex gap-2">
                                <dt className="w-24 shrink-0 text-gray-500">
                                    To
                                </dt>
                                <dd className="font-medium text-gray-900">
                                    {chosenJob.name}
                                </dd>
                            </div>

                            <div className="flex gap-2">
                                <dt className="w-24 shrink-0 text-gray-500">
                                    Site address
                                </dt>
                                <dd className="font-medium text-gray-900">
                                    {chosenJob.address || "—"}
                                </dd>
                            </div>
                        </dl>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="invoice-number"
                                className="mb-1 block text-sm font-medium text-gray-700"
                            >
                                Invoice number
                            </label>
                            <input
                                id="invoice-number"
                                type="text"
                                inputMode="numeric"
                                value={invoiceNumber}
                                onChange={(event) =>
                                    setInvoiceNumber(event.target.value)
                                }
                                placeholder={
                                    nextInvoiceNumber
                                        ? `Next: ${nextInvoiceNumber}`
                                        : "Auto"
                                }
                                className={INPUT}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="invoice-date"
                                className="mb-1 block text-sm font-medium text-gray-700"
                            >
                                Date of invoice
                            </label>
                            <input
                                id="invoice-date"
                                type="date"
                                value={date}
                                onChange={(event) =>
                                    setDate(event.target.value)
                                }
                                className={INPUT}
                            />
                        </div>
                    </div>

                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-700">
                            Price
                        </p>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label
                                    htmlFor="invoice-ex"
                                    className="mb-1 block text-xs text-gray-500"
                                >
                                    Ex GST
                                </label>
                                <input
                                    id="invoice-ex"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={exText}
                                    onChange={(event) =>
                                        handleExChange(event.target.value)
                                    }
                                    placeholder="0.00"
                                    className={INPUT}
                                />
                            </div>

                            <div>
                                <p className="mb-1 text-xs text-gray-500">
                                    GST
                                </p>
                                <p className="rounded-lg border border-transparent px-3 py-2 text-sm tabular-nums text-gray-700">
                                    {hasAmount
                                        ? gstOf(incValue).toFixed(2)
                                        : "—"}
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="invoice-inc"
                                    className="mb-1 block text-xs text-gray-500"
                                >
                                    Incl. GST
                                </label>
                                <input
                                    id="invoice-inc"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={incText}
                                    onChange={(event) =>
                                        handleIncChange(event.target.value)
                                    }
                                    placeholder="0.00"
                                    className={INPUT}
                                />
                            </div>
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                            Fill in either price; the other updates to match.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="invoice-description"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Description{" "}
                            <span className="font-normal text-gray-400">
                                (optional)
                            </span>
                        </label>
                        <input
                            id="invoice-description"
                            autoFocus={!picking}
                            type="text"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            placeholder="e.g. Completion of Structural Carpentry (100% of total)"
                            className={INPUT}
                        />
                    </div>

                    {picking && (
                        <div>
                            <label
                                htmlFor="invoice-status"
                                className="mb-1 block text-sm font-medium text-gray-700"
                            >
                                Status
                            </label>
                            <select
                                id="invoice-status"
                                value={status}
                                onChange={(event) =>
                                    setStatus(
                                        event.target.value as InvoiceStatus,
                                    )
                                }
                                className={INPUT}
                            >
                                {INVOICE_STATUSES.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
                        >
                            {error}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isSubmitting
                            ? "Saving…"
                            : picking
                              ? "Add invoice"
                              : "Create Invoice"}
                    </button>
                </div>
            </div>
        </div>
    );
}
