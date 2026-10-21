import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import NewQuoteModal, {
    JOB_STATUS_LIST,
    type NewQuoteFormData,
    type QuoteStatus,
} from "../components/layout/NewQuoteModal";
import { useFeedback } from "../components/ui/Feedback";
import RowMenu from "../components/ui/RowMenu";
import { TableSkeleton } from "../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../lib/format";
import { patchJob } from "../lib/patchJob";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type QuotedJob = {
    id: string;
    name: string;
    status?: string;
    invoiced?: boolean;
    steelSent?: boolean;
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

const STATUS_FILTERS: Array<QuoteStatus | "All"> = ["All", ...JOB_STATUS_LIST];

const JOB_STATUSES = STATUS_FILTERS.filter(
    (status): status is QuoteStatus => status !== "All",
);

export default function JobsPage() {
    const { toast, confirm } = useFeedback();
    useDocumentTitle("Jobs");

    const [quotedJobs, setQuotedJobs] = useState<QuotedJob[]>([]);
    const [loading, setLoading] = useState(true);

    const [
        isNewQuoteModalOpen,
        setIsNewQuoteModalOpen,
    ] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] =
        useState<QuoteStatus | "All">("All");

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

    const filteredJobs = useMemo(() => {
        const search = searchTerm
            .trim()
            .toLowerCase();

        return quotedJobs.filter((job) => {
            const status = job.status ?? "Quoted";

            if (
                statusFilter !== "All" &&
                status !== statusFilter
            ) {
                return false;
            }

            if (!search) {
                return true;
            }

            const formattedDate = formatDate(job.date);

            return (
                job.name
                    .toLowerCase()
                    .includes(search) ||
                job.address
                    .toLowerCase()
                    .includes(search) ||
                status
                    .toLowerCase()
                    .includes(search) ||
                formattedDate
                    .toLowerCase()
                    .includes(search)
            );
        });
    }, [quotedJobs, searchTerm, statusFilter]);

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

    async function handleStatusChange(
        id: string,
        status: QuoteStatus,
    ) {
        const previous = quotedJobs.find(
            (job) => job.id === id,
        )?.status;

        const setStatus = (value?: string) =>
            setQuotedJobs((current) =>
                current.map((job) =>
                    job.id === id
                        ? { ...job, status: value }
                        : job,
                ),
            );

        setStatus(status);

        try {
            const response = await fetch(
                `/api/quoted-jobs/${id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({ status }),
                },
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to update status",
                );
            }
        } catch (error) {
            console.error(
                "Failed to update status:",
                error,
            );
            setStatus(previous);
            toast({
                message: "Couldn't update the status. It's been put back.",
                tone: "error",
            });
        }
    }

    async function handleSteelSentChange(id: string, steelSent: boolean) {
        const set = (value: boolean) =>
            setQuotedJobs((current) =>
                current.map((job) =>
                    job.id === id ? { ...job, steelSent: value } : job,
                ),
            );

        set(steelSent);

        try {
            await patchJob(id, { steelSent });
        } catch {
            set(!steelSent);
            toast({
                message: "Couldn't update the Steel sent tick. It's been put back.",
                tone: "error",
            });
        }
    }

    async function handleInvoicedChange(
        id: string,
        invoiced: boolean,
    ) {
        const setInvoiced = (value: boolean) =>
            setQuotedJobs((current) =>
                current.map((job) =>
                    job.id === id
                        ? { ...job, invoiced: value }
                        : job,
                ),
            );

        setInvoiced(invoiced);

        try {
            const response = await fetch(
                `/api/quoted-jobs/${id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({ invoiced }),
                },
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to update invoiced",
                );
            }
        } catch (error) {
            console.error(
                "Failed to update invoiced:",
                error,
            );
            setInvoiced(!invoiced);
            toast({
                message:
                    "Couldn't update the Invoiced tick. It's been put back.",
                tone: "error",
            });
        }
    }

    async function handleDeleteQuote(
        id: string,
    ) {
        const job = quotedJobs.find((item) => item.id === id);
        const label = job?.address || job?.name || "this job";

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
                    "Failed to delete job",
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
                "Failed to delete job:",
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
                    Jobs
                </p>

                <h1 className="mt-1 text-3xl font-semibold text-gray-900">
                    All Jobs
                </h1>

                <p className="mt-2 text-gray-600">
                    Track quoted, cutting list, under
                    construction and completed jobs.
                </p>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
                    <div>
                        <p className="text-sm text-gray-500">
                            {quotedJobs.length} jobs in total.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setIsNewQuoteModalOpen(
                                true,
                            )
                        }
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        New job
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

                    <div className="mt-3 flex flex-wrap gap-2">
                        {STATUS_FILTERS.map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() =>
                                    setStatusFilter(status)
                                }
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                    statusFilter === status
                                        ? "bg-gray-900 text-white"
                                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {(searchTerm || statusFilter !== "All") && (
                        <p className="mt-2 text-xs text-gray-500">
                            Showing{" "}
                            {filteredJobs.length} of{" "}
                            {quotedJobs.length} jobs
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

                                <th className="px-6 py-3 text-center font-semibold">
                                    Steel sent
                                </th>

                                <th className="px-6 py-3 text-center font-semibold">
                                    Invoiced
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
                                        <select
                                            value={
                                                job.status ??
                                                "Quoted"
                                            }
                                            onChange={(event) =>
                                                void handleStatusChange(
                                                    job.id,
                                                    event.target
                                                        .value as QuoteStatus,
                                                )
                                            }
                                            aria-label={`Status for ${job.name}`}
                                            className="cursor-pointer rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                                        >
                                            {JOB_STATUSES.map(
                                                (status) => (
                                                    <option
                                                        key={status}
                                                        value={status}
                                                    >
                                                        {status}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(job.steelSent)}
                                            onChange={(event) =>
                                                void handleSteelSentChange(
                                                    job.id,
                                                    event.target.checked,
                                                )
                                            }
                                            aria-label={`Steel sent: ${job.address || job.name}`}
                                            className="h-4 w-4 cursor-pointer"
                                        />
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(
                                                job.invoiced,
                                            )}
                                            onChange={(event) =>
                                                void handleInvoicedChange(
                                                    job.id,
                                                    event.target
                                                        .checked,
                                                )
                                            }
                                            aria-label={`Invoiced: ${job.address || job.name}`}
                                            className="h-4 w-4 cursor-pointer"
                                        />
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
                                        colSpan={8}
                                        className="px-6 py-10 text-center text-sm text-gray-500"
                                    >
                                        {searchTerm ||
                                        statusFilter !== "All"
                                            ? "No jobs match the current search and filter."
                                            : "No jobs yet."}
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
