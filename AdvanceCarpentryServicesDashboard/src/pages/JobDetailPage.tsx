import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NewQuoteModal, {
    type NewQuoteFormData,
} from "../components/layout/NewQuoteModal";

type AttachedFile = {
    id: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    path: string;
    uploadedAt: string;
};

type Job = {
    id: string;
    name: string;
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
    files?: AttachedFile[];
};

function JobDetailPage() {
    const { jobId } = useParams<{ jobId: string }>();

    const [jobDetails, setJobDetails] = useState<Job>();
    const [loading, setLoading] = useState(true);
    const [isEditQuoteModalOpen, setIsEditQuoteModalOpen] = useState(false);

    async function fetchJobDetails() {
        if (!jobId) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:3001/api/quoted-jobs/${jobId}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch job details");
            }

            const data = await response.json();
            setJobDetails(data);
        } catch (error) {
            console.error("Failed to fetch job details:", error);
            setJobDetails(undefined);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchJobDetails();
    }, [jobId]);

    async function handleUpdateQuote(formData: NewQuoteFormData) {
        if (!jobId) {
            return;
        }

        try {
            const { files, ...quoteWithoutFiles } = formData;

            const response = await fetch(
                `http://localhost:3001/api/quoted-jobs/${jobId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(quoteWithoutFiles),
                }
            );

            if (!response.ok) {
                throw new Error("Failed to update quote");
            }

            const updatedQuote = await response.json();

            setJobDetails(updatedQuote);
            setIsEditQuoteModalOpen(false);
        } catch (error) {
            console.error("Failed to update quote:", error);
        }
    }

    function formatCurrency(value: number | undefined) {
        return `$${(value ?? 0).toLocaleString()}`;
    }

    function formatNumber(value: number | undefined) {
        return (value ?? 0).toLocaleString();
    }

    function formatFileSize(size: number) {
        return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }

    if (loading) {
        return <p className="p-6">Loading job details...</p>;
    }

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-3xl font-semibold text-gray-900">
                Job Details
            </h1>

            <section className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">
                            Quote Details
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-gray-900">
                            {jobDetails?.name ?? "Job not found"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-600">
                            {jobDetails?.address ?? "No address listed"}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {jobDetails && (
                            <button
                                type="button"
                                onClick={() => setIsEditQuoteModalOpen(true)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                                Edit Quote
                            </button>
                        )}

                        <div className="rounded-lg bg-gray-100 px-4 py-2 text-right">
                            <p className="text-xs font-medium uppercase text-gray-500">
                                Quoted Amount Incl. GST
                            </p>

                            <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(jobDetails?.inclGst)}
                            </p>
                        </div>
                    </div>
                </div>

                {!jobDetails ? (
                    <div className="px-6 py-8 text-sm text-gray-500">
                        Job details could not be found.
                    </div>
                ) : (
                    <>
                        <div className="grid gap-6 p-6 lg:grid-cols-3">
                            <div className="rounded-xl border border-gray-200 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Quote Summary
                                </h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Ex GST</span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.quotedAmount)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">GST</span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.gst)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between border-t border-gray-200 pt-3">
                                        <span className="font-medium text-gray-700">
                                            Incl GST
                                        </span>
                                        <span className="font-semibold text-gray-900">
                                            {formatCurrency(jobDetails.inclGst)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Rates
                                </h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">
                                            Walls/Roof Rate
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.wallsRoofRate)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">
                                            Floor Rate
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.floorRate)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Steel</span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.steel)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">
                                            Additional Cost
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {formatCurrency(jobDetails.additionalCost)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 p-5">
                                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Measurements
                                </h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">
                                            Ground Floor Walls
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {formatNumber(jobDetails.gfw)} lm
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">
                                            First Floor Walls
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {formatNumber(jobDetails.ffw)} lm
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Floor</span>
                                        <span className="font-medium text-gray-900">
                                            {formatNumber(jobDetails.floor)} m²
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Roof</span>
                                        <span className="font-medium text-gray-900">
                                            {formatNumber(jobDetails.roof)} m²
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Attached Files
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-500">
                                        Files uploaded with this quote.
                                    </p>
                                </div>

                                <p className="text-sm text-gray-500">
                                    {jobDetails.files?.length ?? 0} files
                                </p>
                            </div>

                            {!jobDetails.files || jobDetails.files.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-gray-500">
                                    No files attached to this quote yet.
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">
                                                    File Name
                                                </th>
                                                <th className="px-6 py-3 font-semibold">
                                                    Type
                                                </th>
                                                <th className="px-6 py-3 font-semibold">
                                                    Size
                                                </th>
                                                <th className="px-6 py-3 font-semibold">
                                                    Uploaded
                                                </th>
                                                <th className="px-6 py-3 font-semibold">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-gray-200">
                                            {jobDetails.files.map((file) => (
                                                <tr
                                                    key={file.id}
                                                    className="hover:bg-gray-50"
                                                >
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        {file.originalName}
                                                    </td>

                                                    <td className="px-6 py-4 text-gray-700">
                                                        {file.mimeType}
                                                    </td>

                                                    <td className="px-6 py-4 text-gray-700">
                                                        {formatFileSize(file.size)}
                                                    </td>

                                                    <td className="px-6 py-4 text-gray-700">
                                                        {new Date(
                                                            file.uploadedAt
                                                        ).toLocaleDateString()}
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <a
                                                            href={`http://localhost:3001${file.path}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                        >
                                                            Open
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            {jobDetails && (
                <NewQuoteModal
                    isOpen={isEditQuoteModalOpen}
                    onClose={() => setIsEditQuoteModalOpen(false)}
                    onCreateQuote={handleUpdateQuote}
                    initialQuote={jobDetails}
                    mode="edit"
                />
            )}
        </main>
    );
}

export default JobDetailPage;