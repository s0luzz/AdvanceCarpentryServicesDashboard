import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import InvoiceDialog, {
    INVOICE_STATUSES,
    type InvoiceStatus,
    type NewInvoicePayload,
} from "../components/invoices/InvoiceDialog";
import { downloadInvoice } from "../lib/downloadInvoice";
import { useFeedback } from "../components/ui/Feedback";
import { TableSkeleton } from "../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Invoice = {
    id: string;
    invoiceNumber: number;
    description: string;
    amountIncGst: number;
    gst: number;
    amountExGst: number;
    amountPaidToDate: number;
    status?: string;
    date: string;
};

type QuotedJob = {
    id: string;
    name: string;
    address: string;
    inclGst?: number;
    invoices?: Invoice[];
};

type InvoiceRow = {
    job: QuotedJob;
    invoice: Invoice;
};

const API_URL = "";

export default function InvoicesPage() {
    const { toast } = useFeedback();
    useDocumentTitle("Invoices");

    const [jobs, setJobs] = useState<QuotedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        InvoiceStatus | "All"
    >("All");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [addError, setAddError] = useState("");

    async function fetchJobs() {
        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs`,
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to fetch quoted jobs",
                );
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                setJobs(data);
            }
        } catch (error) {
            console.error(
                "Failed to fetch invoices:",
                error,
            );

            toast({
                message: "Couldn't load invoices. Try refreshing the page.",
                tone: "error",
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchJobs();
    }, []);


    const rows = useMemo<InvoiceRow[]>(() => {
        return jobs
            .flatMap((job) =>
                (job.invoices ?? []).map((invoice) => ({
                    job,
                    invoice,
                })),
            )
            .sort(
                (a, b) =>
                    b.invoice.invoiceNumber -
                    a.invoice.invoiceNumber,
            );
    }, [jobs]);

    async function handleAddInvoice(payload: NewInvoicePayload) {
        const { jobId, ...body } = payload;

        if (!jobId) {
            return;
        }

        setIsSaving(true);
        setAddError("");

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}/invoices`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                },
            );

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.message ?? "Couldn't add the invoice.",
                );
            }

            await fetchJobs();
            setIsAddOpen(false);
            toast(`Added invoice #${result.invoiceNumber}.`);
        } catch (error) {
            setAddError(
                error instanceof Error
                    ? error.message
                    : "Couldn't add the invoice.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function handleStatusChange(
        jobId: string,
        invoiceId: string,
        status: InvoiceStatus,
    ) {
        const previous = jobs
            .find((job) => job.id === jobId)
            ?.invoices?.find((invoice) => invoice.id === invoiceId)
            ?.status;

        const apply = (value?: string) =>
            setJobs((current) =>
                current.map((job) =>
                    job.id !== jobId
                        ? job
                        : {
                              ...job,
                              invoices: job.invoices?.map((invoice) =>
                                  invoice.id === invoiceId
                                      ? { ...invoice, status: value }
                                      : invoice,
                              ),
                          },
                ),
            );

        apply(status);

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}/invoices/${invoiceId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                },
            );

            if (!response.ok) {
                throw new Error("Failed to update status");
            }
        } catch {
            apply(previous);
            toast({
                message: "Couldn't update the status. It's been put back.",
                tone: "error",
            });
        }
    }

    const filteredRows = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        const byStatus = rows.filter(
            ({ invoice }) =>
                statusFilter === "All" ||
                (invoice.status ?? "Sent") === statusFilter,
        );

        if (!search) {
            return byStatus;
        }

        return byStatus.filter(({ job, invoice }) => {
            return (
                job.name.toLowerCase().includes(search) ||
                job.address.toLowerCase().includes(search) ||
                invoice.description
                    .toLowerCase()
                    .includes(search) ||
                String(invoice.invoiceNumber).includes(
                    search,
                )
            );
        });
    }, [rows, searchTerm, statusFilter]);

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <TableSkeleton rows={8} columns={5} />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <p className="text-sm font-medium text-gray-500">
                    Invoices
                </p>

                <h1 className="mt-1 text-3xl font-semibold text-gray-900">
                    All Invoices
                </h1>

                <p className="mt-2 text-gray-600">
                    Every invoice issued across all jobs, newest first.
                </p>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Invoices
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            {rows.length} invoice
                            {rows.length === 1 ? "" : "s"} issued.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setAddError("");
                            setIsAddOpen(true);
                        }}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        Add invoice
                    </button>
                </div>

                <div className="border-b border-gray-200 px-6 py-4">
                    <div className="relative max-w-md">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            placeholder="Search invoice number, job or description..."
                            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-400 hover:text-gray-700"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-gray-200 px-6 py-3">
                    {(["All", ...INVOICE_STATUSES] as const).map(
                        (item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setStatusFilter(item)}
                                aria-pressed={statusFilter === item}
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                    statusFilter === item
                                        ? "bg-gray-900 text-white"
                                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                {item}
                            </button>
                        ),
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-6 py-3 font-semibold">
                                    Invoice #
                                </th>
                                <th className="px-6 py-3 font-semibold">
                                    Job
                                </th>
                                <th className="px-6 py-3 font-semibold">
                                    Description
                                </th>
                                <th className="px-6 py-3 font-semibold">
                                    Date
                                </th>
                                <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">
                                    Amount inc GST
                                </th>
                                <th className="px-6 py-3 font-semibold">
                                    Status
                                </th>
                                <th className="px-6 py-3 font-semibold">
                                    Quick Action
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200">
                            {filteredRows.map(({ job, invoice }) => (
                                <tr
                                    key={invoice.id}
                                    className="hover:bg-gray-50"
                                >
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {invoice.invoiceNumber}
                                    </td>

                                    <td className="max-w-xs px-6 py-4">
                                        <NavLink
                                            to={`/jobs/${job.id}`}
                                            className="block truncate font-medium text-gray-900 hover:underline"
                                        >
                                            {job.name}
                                        </NavLink>
                                        <p className="truncate text-xs text-gray-500">
                                            {job.address}
                                        </p>
                                    </td>

                                    <td className="max-w-xs truncate px-6 py-4 text-gray-700">
                                        {invoice.description}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                                        {formatDate(invoice.date)}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-gray-700">
                                        {formatCurrency(
                                            invoice.amountIncGst,
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <select
                                            value={invoice.status ?? "Sent"}
                                            onChange={(event) =>
                                                void handleStatusChange(
                                                    job.id,
                                                    invoice.id,
                                                    event.target
                                                        .value as InvoiceStatus,
                                                )
                                            }
                                            aria-label={`Status of invoice ${invoice.invoiceNumber}`}
                                            className="cursor-pointer rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                                        >
                                            {INVOICE_STATUSES.map((item) => (
                                                <option key={item} value={item}>
                                                    {item}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {(["pdf", "docx"] as const).map(
                                                (format) => (
                                                    <button
                                                        key={format}
                                                        type="button"
                                                        onClick={() =>
                                                            downloadInvoice(
                                                                job.id,
                                                                invoice.id,
                                                                format,
                                                            ).catch(
                                                                (error) =>
                                                                    toast({
                                                                        message:
                                                                            error instanceof
                                                                            Error
                                                                                ? error.message
                                                                                : "Couldn't create the invoice file.",
                                                                        tone: "error",
                                                                    }),
                                                            )
                                                        }
                                                        className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                    >
                                                        {format === "pdf"
                                                            ? "PDF"
                                                            : "Word"}
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-10 text-center text-sm text-gray-500"
                                    >
                                        {searchTerm || statusFilter !== "All"
                                            ? "No invoices match the current search and filter."
                                            : "No invoices issued yet."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <InvoiceDialog
                isOpen={isAddOpen}
                isSubmitting={isSaving}
                error={addError}
                jobs={jobs.map(({ id, name, address, inclGst, invoices }) => ({
                    id,
                    name,
                    address,
                    inclGst,
                    invoicedToDate: (invoices ?? []).reduce(
                        (sum, invoice) => sum + invoice.amountIncGst,
                        0,
                    ),
                }))}
                onClose={() => setIsAddOpen(false)}
                onSubmit={handleAddInvoice}
            />
        </div>
    );
}
