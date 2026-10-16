import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { DifferenceText } from "../components/supplier/SupplierCostCard";
import { useFeedback } from "../components/ui/Feedback";
import { TableSkeleton } from "../components/ui/Skeleton";
import { formatCurrency } from "../lib/format";
import {
    invoicedTotal,
    quoteDifference,
    type SupplierCost,
} from "../lib/supplierCost";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Job = {
    id: string;
    name: string;
    address: string;
    status?: string;
    date: string;
    supplierCost?: SupplierCost;
};

const FILTERS = ["All", "With supplier cost", "No supplier cost"] as const;
type Filter = (typeof FILTERS)[number];

const hasCost = (job: Job) =>
    Boolean(
        job.supplierCost &&
            (job.supplierCost.supplier ||
                job.supplierCost.quotedAmount !== null ||
                job.supplierCost.invoices.length > 0),
    );

export default function MaterialPricesPage() {
    useDocumentTitle("Material Prices");
    const { toast } = useFeedback();
    const [jobs, setJobs] = useState<Job[] | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("All");

    useEffect(() => {
        fetch("/api/quoted-jobs")
            .then((response) => response.json())
            .then((data) => setJobs(Array.isArray(data) ? data : []))
            .catch(() => {
                setJobs([]);
                toast({ message: "Couldn't load the jobs. Try refreshing the page.", tone: "error" });
            });
    }, [toast]);

    // Jobs that have moved past "Quoted": the ones materials are being bought for.
    const rows = useMemo(
        () =>
            (jobs ?? [])
                .filter((job) => (job.status ?? "Quoted") !== "Quoted")
                .sort((a, b) => String(b.date).localeCompare(String(a.date))),
        [jobs],
    );

    const shown = useMemo(() => {
        const term = search.trim().toLowerCase();

        return rows.filter((job) => {
            if (filter === "With supplier cost" && !hasCost(job)) return false;
            if (filter === "No supplier cost" && hasCost(job)) return false;

            return (
                !term ||
                job.address.toLowerCase().includes(term) ||
                job.name.toLowerCase().includes(term) ||
                (job.supplierCost?.supplier ?? "").toLowerCase().includes(term)
            );
        });
    }, [rows, search, filter]);

    // Totals only count jobs that have a quote entered, so the difference adds up.
    const totals = useMemo(() => {
        const quoted = shown.filter((job) => job.supplierCost?.quotedAmount != null);
        const quotedSum = quoted.reduce((sum, job) => sum + (job.supplierCost?.quotedAmount ?? 0), 0);
        const invoicedSum = quoted.reduce((sum, job) => sum + invoicedTotal(job.supplierCost), 0);

        return {
            count: quoted.length,
            quoted: quotedSum,
            invoiced: invoicedSum,
            difference: Math.round((quotedSum - invoicedSum) * 100) / 100,
        };
    }, [shown]);

    if (jobs === null) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <TableSkeleton rows={8} columns={5} />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <p className="text-sm font-medium text-gray-500">Material Prices</p>
                <h1 className="mt-1 text-3xl font-semibold text-gray-900">Supplier costs</h1>
                <p className="mt-2 text-gray-600">
                    What each supplier quoted against what they've invoiced, for every job past the quote stage.
                    Open a job to enter or change them.
                </p>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search address, client or supplier..."
                        className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    />

                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setFilter(item)}
                                aria-pressed={filter === item}
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                    filter === item
                                        ? "bg-gray-900 text-white"
                                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <p className="ml-auto text-sm text-gray-500">
                        {shown.length} of {rows.length} jobs
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Address</th>
                                <th className="px-6 py-3 font-semibold">Supplier</th>
                                <th className="px-6 py-3 text-right font-semibold">Quoted</th>
                                <th className="px-6 py-3 text-right font-semibold">Invoiced</th>
                                <th className="px-6 py-3 text-right font-semibold">Difference</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200">
                            {shown.map((job) => {
                                const cost = job.supplierCost;
                                const entered = hasCost(job);

                                return (
                                    <tr key={job.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <NavLink
                                                to={`/jobs/${job.id}`}
                                                className="font-medium text-gray-900 hover:underline"
                                            >
                                                {job.address || job.name}
                                            </NavLink>
                                            <p className="text-xs text-gray-500">
                                                {job.name} · {job.status}
                                            </p>
                                        </td>

                                        <td className="px-6 py-4 text-gray-700">{cost?.supplier || "—"}</td>

                                        <td className="whitespace-nowrap px-6 py-4 text-right text-gray-700">
                                            {cost?.quotedAmount != null ? formatCurrency(cost.quotedAmount) : "—"}
                                        </td>

                                        <td className="whitespace-nowrap px-6 py-4 text-right text-gray-700">
                                            {entered ? formatCurrency(invoicedTotal(cost)) : "—"}
                                        </td>

                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <DifferenceText difference={quoteDifference(cost)} />
                                        </td>
                                    </tr>
                                );
                            })}

                            {shown.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                                        No jobs match.
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {totals.count > 0 && (
                            <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
                                <tr>
                                    <td className="px-6 py-3" colSpan={2}>
                                        Total · {totals.count} job{totals.count === 1 ? "" : "s"} with a quote
                                    </td>
                                    <td className="px-6 py-3 text-right">{formatCurrency(totals.quoted)}</td>
                                    <td className="px-6 py-3 text-right">{formatCurrency(totals.invoiced)}</td>
                                    <td className="px-6 py-3 text-right">
                                        <DifferenceText difference={totals.difference} />
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </section>
        </div>
    );
}
