import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import NewQuoteModal, {
    type NewQuoteFormData,
} from "../components/layout/NewQuoteModal";
import { useFeedback } from "../components/ui/Feedback";
import RowMenu from "../components/ui/RowMenu";
import { TableSkeleton } from "../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type QuotedJob = {
    id: string;
    name: string;
    status?: string;
    quotedAmount: number;
    gst: number;
    inclGst: number;
    address: string;
    wallsRoofRate: number;
    floorRate: number;
    ffw: number;
    gfw: number;
    floor: number;
    roof: number;
    additionalCost: number;
    steel: number;
    date: string;
};

export default function QuotesPage() {
    const { toast, confirm } = useFeedback();
    useDocumentTitle("Quotes");

    const [quotedJobs, setQuotedJobs] = useState<QuotedJob[]>([]);
    const [loading, setLoading] = useState(true);

    const [
        isNewQuoteModalOpen,
        setIsNewQuoteModalOpen,
    ] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");

    async function fetchQuotedJobs() {
        try {
            const response = await fetch(
                "/api/quoted-jobs",
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to fetch quoted jobs",
                );
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                setQuotedJobs(data);
            } else {
                console.error(
                    "Expected array but got:",
                    data,
                );
            }
        } catch (error) {
            console.error(
                "Failed to fetch quoted jobs:",
                error,
            );

            toast({
                message: "Couldn't load the list. Try refreshing the page.",
                tone: "error",
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchQuotedJobs();
    }, []);

    // This page is for quotes still waiting on a decision; once a job moves
    // on (cutting list, under construction, complete) it lives on Jobs.
    const quotesOnly = useMemo(
        () =>
            quotedJobs.filter(
                (job) => (job.status ?? "Quoted") === "Quoted",
            ),
        [quotedJobs],
    );

    const filteredJobs = useMemo(() => {
        const search = searchTerm
            .trim()
            .toLowerCase();

        if (!search) {
            return quotesOnly;
        }

        return quotesOnly.filter((job) => {
            const formattedDate = formatDate(job.date);

            return (
                job.name
                    .toLowerCase()
                    .includes(search) ||
                job.address
                    .toLowerCase()
                    .includes(search) ||
                (job.status ?? "Quoted")
                    .toLowerCase()
                    .includes(search) ||
                formattedDate
                    .toLowerCase()
                    .includes(search)
            );
        });
    }, [quotesOnly, searchTerm]);

    async function handleCreateQuote(
        formData: NewQuoteFormData,
    ) {
        try {
            const quoteData = new FormData();

            quoteData.append(
                "status",
                formData.status,
            );

            quoteData.append(
                "name",
                formData.name,
            );

            quoteData.append(
                "quoteNumber",
                formData.quoteNumber,
            );

            quoteData.append(
                "quotedAmount",
                String(formData.quotedAmount),
            );

            quoteData.append(
                "gst",
                String(formData.gst),
            );

            quoteData.append(
                "inclGst",
                String(formData.inclGst),
            );

            quoteData.append(
                "address",
                formData.address,
            );

            quoteData.append(
                "wallsRoofRate",
                String(formData.wallsRoofRate),
            );

            quoteData.append(
                "floorRate",
                String(formData.floorRate),
            );

            quoteData.append(
                "ffw",
                String(formData.ffw),
            );

            quoteData.append(
                "gfw",
                String(formData.gfw),
            );

            quoteData.append(
                "floor",
                String(formData.floor),
            );

            quoteData.append(
                "roof",
                String(formData.roof),
            );

            quoteData.append(
                "additionalCost",
                String(formData.additionalCost),
            );

            quoteData.append(
                "steel",
                String(formData.steel),
            );

            quoteData.append(
                "hasSecondFloor",
                String(formData.hasSecondFloor),
            );

            quoteData.append(
                "hasHebel",
                String(formData.hasHebel),
            );

            quoteData.append(
                "hebelHeight",
                String(formData.hebelHeight),
            );

            quoteData.append(
                "hebelLength",
                String(formData.hebelLength),
            );

            quoteData.append(
                "hebelRate",
                String(formData.hebelRate),
            );

            quoteData.append(
                "hebelCost",
                String(formData.hebelCost),
            );

            formData.files.forEach((file) => {
                quoteData.append(
                    "files",
                    file,
                );
            });

            const response = await fetch(
                "/api/quoted-jobs",
                {
                    method: "POST",
                    body: quoteData,
                },
            );

            if (!response.ok) {
                const errorBody = await response
                    .json()
                    .catch(() => null);

                throw new Error(
                    errorBody?.message ??
                        "Failed to create quote",
                );
            }

            await fetchQuotedJobs();

            setIsNewQuoteModalOpen(false);
        } catch (error) {
            console.error(
                "Failed to save quote:",
                error,
            );

            toast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to save quote.",
                tone: "error",
            });
        }
    }

    async function handleDeleteQuote(
        id: string,
    ) {
        const job = quotedJobs.find((item) => item.id === id);
        const label = job?.address || job?.name || "this quote";

        const confirmed = await confirm({
            title: `Delete ${label}?`,
            message:
                "This permanently deletes it, along with its measurements, invoices and uploaded plans. This can't be undone.",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/quoted-jobs/${id}`,
                {
                    method: "DELETE",
                },
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to delete quote",
                );
            }

            setQuotedJobs(
                (currentJobs) =>
                    currentJobs.filter(
                        (item) =>
                            item.id !== id,
                    ),
            );

            toast(`Deleted ${label}.`);
        } catch (error) {
            console.error(
                "Failed to delete quote:",
                error,
            );

            toast({
                message: `Couldn't delete ${label}. Nothing was changed.`,
                tone: "error",
            });
        }
    }

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <TableSkeleton rows={10} columns={5} />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <p className="text-sm font-medium text-gray-500">
                    Quotes
                </p>

                <h1 className="mt-1 text-3xl font-semibold text-gray-900">
                    Quoted Jobs
                </h1>

                <p className="mt-2 text-gray-600">
                    Track jobs that have been quoted
                    before they move into cutting list or
                    construction.
                </p>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
                    <p className="text-sm text-gray-500">
                        {quotesOnly.length} quote
                        {quotesOnly.length === 1 ? "" : "s"} waiting
                        on a decision.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            setIsNewQuoteModalOpen(
                                true,
                            )
                        }
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        New quote
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
                            <circle
                                cx="11"
                                cy="11"
                                r="8"
                            />

                            <path d="m21 21-4.35-4.35" />
                        </svg>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(
                                    event.target.value,
                                )
                            }
                            placeholder="Search name, address, status or date..."
                            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() =>
                                    setSearchTerm("")
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-400 hover:text-gray-700"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {searchTerm && (
                        <p className="mt-2 text-xs text-gray-500">
                            Showing{" "}
                            {filteredJobs.length} of{" "}
                            {quotesOnly.length} quotes
                        </p>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-6 py-3 font-semibold">
                                    Name
                                </th>

                                <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">
                                    Amount inc GST
                                </th>

                                <th className="px-6 py-3 font-semibold">
                                    Address
                                </th>

                                <th className="px-6 py-3 font-semibold">
                                    Date
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
                            {filteredJobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="hover:bg-gray-50"
                                >
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {job.name}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-gray-700">
                                        {formatCurrency(
                                            job.inclGst,
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-gray-700">
                                        {job.address}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                                        {formatDate(job.date)}
                                    </td>

                                    <td className="px-6 py-4">
                                        <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                            {job.status ??
                                                "Quoted"}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <NavLink
                                                to={`/jobs/${job.id}`}
                                                className="flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                            >
                                                View
                                            </NavLink>

                                            <RowMenu
                                                label={`More actions for ${job.address || job.name}`}
                                                items={[
                                                    {
                                                        label: "Delete…",
                                                        destructive: true,
                                                        onSelect: () =>
                                                            void handleDeleteQuote(
                                                                job.id,
                                                            ),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredJobs.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-10 text-center text-sm text-gray-500"
                                    >
                                        {searchTerm
                                            ? `No jobs found matching "${searchTerm}".`
                                            : "No quotes waiting on a decision."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <NewQuoteModal
                isOpen={isNewQuoteModalOpen}
                onClose={() =>
                    setIsNewQuoteModalOpen(
                        false,
                    )
                }
                onCreateQuote={
                    handleCreateQuote
                }
            />
        </div>
    );
}