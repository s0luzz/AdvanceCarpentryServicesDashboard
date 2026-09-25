import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { generateInvoicePdf } from "../components/invoices/generateInvoicePdf";

type Invoice = {
    id: string;
    invoiceNumber: number;
    description: string;
    amountIncGst: number;
    gst: number;
    amountExGst: number;
    amountPaidToDate: number;
    date: string;
};

type QuotedJob = {
    id: string;
    name: string;
    address: string;
    invoices?: Invoice[];
};

type InvoiceRow = {
    job: QuotedJob;
    invoice: Invoice;
};

const API_URL = "http://localhost:3001";

export default function InvoicesPage() {
    const [jobs, setJobs] = useState<QuotedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

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
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchJobs();
    }, []);

    function formatCurrency(value: number) {
        return `$${value.toLocaleString("en-AU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    function formatDate(value: string) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

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

    const filteredRows = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        if (!search) {
            return rows;
        }

        return rows.filter(({ job, invoice }) => {
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
    }, [rows, searchTerm]);

    if (loading) {
        return <p className="p-6">Loading invoices...</p>;
    }

    return (
        <main className="min-h-screen bg-gray-50 p-8">
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
                                <th className="px-6 py-3 font-semibold">
                                    Amount Inc GST
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

                                    <td className="px-6 py-4 text-gray-700">
                                        {formatDate(invoice.date)}
                                    </td>

                                    <td className="px-6 py-4 text-gray-700">
                                        {formatCurrency(
                                            invoice.amountIncGst,
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                generateInvoicePdf(
                                                    {
                                                        name: job.name,
                                                        address:
                                                            job.address,
                                                    },
                                                    invoice,
                                                )
                                            }
                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                        >
                                            Download PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-10 text-center text-sm text-gray-500"
                                    >
                                        {searchTerm
                                            ? `No invoices found matching "${searchTerm}".`
                                            : "No invoices issued yet."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
