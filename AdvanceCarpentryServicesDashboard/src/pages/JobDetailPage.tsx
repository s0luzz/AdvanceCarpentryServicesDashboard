import {
    type ChangeEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { useParams } from "react-router-dom";
import NewQuoteModal, {
    type NewQuoteFormData,
    type QuoteStatus,
} from "../components/layout/NewQuoteModal";
import PdfViewer from "../components/layout/PdfViewer";

type AttachedFile = {
    id: string;
    name?: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    path: string;
    url?: string;
    uploadedAt: string;
};

type Job = {
    id: string;
    name: string;
    status: QuoteStatus;
    quotedAmount: number;
    gst: number;
    inclGst: number;
    address: string;

    wallsRoofRate: number;
    gfw: number;
    roof: number;

    hasSecondFloor: boolean;
    floorRate: number;
    ffw: number;
    floor: number;

    hasHebel: boolean;
    hebelHeight: number;
    hebelLength: number;
    hebelRate: number;
    hebelCost: number;

    additionalCost: number;
    steel: number;
    files: AttachedFile[];
};

const API_URL = "http://localhost:3001";

function JobDetailPage() {
    const { jobId } = useParams<{ jobId: string }>();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [jobDetails, setJobDetails] = useState<Job>();
    const [loading, setLoading] = useState(true);
    const [isEditQuoteModalOpen, setIsEditQuoteModalOpen] =
        useState(false);

    const [selectedFile, setSelectedFile] =
        useState<AttachedFile | null>(null);

    const [isUploading, setIsUploading] =
        useState(false);

    const [deletingFileId, setDeletingFileId] =
        useState<string | null>(null);

    const [fileError, setFileError] = useState("");

    async function fetchJobDetails() {
        if (!jobId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}`,
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to fetch job details",
                );
            }

            const data: Job = await response.json();

            setJobDetails({
                ...data,
                files: data.files ?? [],
            });
        } catch (error) {
            console.error(
                "Failed to fetch job details:",
                error,
            );

            setJobDetails(undefined);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchJobDetails();
    }, [jobId]);

    async function handleUpdateQuote(
        formData: NewQuoteFormData,
    ) {
        if (!jobId) {
            return;
        }

        try {
            const {
                files: _newFiles,
                ...quoteWithoutFiles
            } = formData;

            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(
                        quoteWithoutFiles,
                    ),
                },
            );

            if (!response.ok) {
                const result = await response
                    .json()
                    .catch(() => null);

                throw new Error(
                    result?.message ??
                        "Failed to update quote",
                );
            }

            const updatedQuote: Job =
                await response.json();

            setJobDetails({
                ...updatedQuote,
                files: updatedQuote.files ?? [],
            });

            setIsEditQuoteModalOpen(false);
        } catch (error) {
            console.error(
                "Failed to update quote:",
                error,
            );
        }
    }

    async function handleFileUpload(
        event: ChangeEvent<HTMLInputElement>,
    ) {
        const files = Array.from(
            event.target.files ?? [],
        );

        event.target.value = "";

        if (!jobId || files.length === 0) {
            return;
        }

        const invalidFile = files.find(
            (file) =>
                file.type !== "application/pdf" ||
                !file.name.toLowerCase().endsWith(".pdf"),
        );

        if (invalidFile) {
            setFileError(
                "Only PDF files can be uploaded.",
            );
            return;
        }

        setFileError("");
        setIsUploading(true);

        try {
            const formData = new FormData();

            files.forEach((file) => {
                formData.append("files", file);
            });

            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}/files/multiple`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.message ??
                        "Failed to upload PDFs",
                );
            }

            const uploadedFiles: AttachedFile[] =
                Array.isArray(result)
                    ? result
                    : [result];

            setJobDetails((currentJob) => {
                if (!currentJob) {
                    return currentJob;
                }

                return {
                    ...currentJob,
                    files: [
                        ...(currentJob.files ?? []),
                        ...uploadedFiles,
                    ],
                };
            });
        } catch (error) {
            setFileError(
                error instanceof Error
                    ? error.message
                    : "Failed to upload PDFs",
            );
        } finally {
            setIsUploading(false);
        }
    }

    async function handleDeleteFile(
        file: AttachedFile,
    ) {
        if (!jobId) {
            return;
        }

        const confirmed = window.confirm(
            `Delete "${file.originalName}" from this job?`,
        );

        if (!confirmed) {
            return;
        }

        setFileError("");
        setDeletingFileId(file.id);

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}/files/${file.id}`,
                {
                    method: "DELETE",
                },
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.message ??
                        "Failed to delete file",
                );
            }

            setJobDetails((currentJob) => {
                if (!currentJob) {
                    return currentJob;
                }

                return {
                    ...currentJob,
                    files: currentJob.files.filter(
                        (currentFile) =>
                            currentFile.id !== file.id,
                    ),
                };
            });

            if (selectedFile?.id === file.id) {
                setSelectedFile(null);
            }
        } catch (error) {
            setFileError(
                error instanceof Error
                    ? error.message
                    : "Failed to delete file",
            );
        } finally {
            setDeletingFileId(null);
        }
    }

    function getFileUrl(file: AttachedFile) {
        return `${API_URL}${file.url ?? file.path}`;
    }

    function formatCurrency(
        value: number | undefined,
    ) {
        return `$${(value ?? 0).toLocaleString(
            "en-AU",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            },
        )}`;
    }

    function formatNumber(
        value: number | undefined,
    ) {
        return (value ?? 0).toLocaleString(
            "en-AU",
        );
    }

    function formatFileSize(size: number) {
        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }

        return `${(
            size /
            1024 /
            1024
        ).toFixed(2)} MB`;
    }

    function formatUploadedDate(
        uploadedAt: string,
    ) {
        const date = new Date(uploadedAt);

        if (Number.isNaN(date.getTime())) {
            return "Unknown";
        }

        return date.toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    if (loading) {
        return (
            <p className="p-6">
                Loading job details...
            </p>
        );
    }

    if (selectedFile) {
        return (
            <main className="min-h-screen bg-gray-100 p-4">
                <PdfViewer
                    file={getFileUrl(selectedFile)}
                    onClose={() =>
                        setSelectedFile(null)
                    }
                />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-7xl">
                <h1 className="text-3xl font-semibold text-gray-900">
                    Job Details
                </h1>

                <section className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Quote Details
                            </p>

                            <h2 className="mt-1 text-xl font-semibold text-gray-900">
                                {jobDetails?.name ??
                                    "Job not found"}
                            </h2>

                            <p className="mt-1 text-sm text-gray-600">
                                {jobDetails?.address ??
                                    "No address listed"}
                            </p>

                            <div className="mt-3">
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                    {jobDetails?.status ??
                                        "Quoted"}
                                </span>
                            </div>

                            <button
                                type="button"
                                disabled={
                                    !jobDetails?.address
                                }
                                onClick={() =>
                                    navigator.clipboard.writeText(
                                        jobDetails?.address ??
                                            "",
                                    )
                                }
                                className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Copy address
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {jobDetails && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsEditQuoteModalOpen(
                                            true,
                                        )
                                    }
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                >
                                    Edit Quote
                                </button>
                            )}

                            <div className="rounded-lg bg-gray-100 px-4 py-2 text-right">
                                <p className="text-xs font-medium uppercase text-gray-500">
                                    Quoted Amount Incl.
                                    GST
                                </p>

                                <p className="text-lg font-semibold text-gray-900">
                                    {formatCurrency(
                                        jobDetails?.inclGst,
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {!jobDetails ? (
                        <div className="px-6 py-8 text-sm text-gray-500">
                            Job details could not be
                            found.
                        </div>
                    ) : (
                        <>
                            <div
                                className={`grid gap-6 p-6 ${
                                    jobDetails.hasHebel
                                        ? "lg:grid-cols-4"
                                        : "lg:grid-cols-3"
                                }`}
                            >
                                <div className="rounded-xl border border-gray-200 p-5">
                                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                        Quote Summary
                                    </h3>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">
                                                Ex GST
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatCurrency(
                                                    jobDetails.quotedAmount,
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">
                                                GST
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatCurrency(
                                                    jobDetails.gst,
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between border-t border-gray-200 pt-3">
                                            <span className="font-medium text-gray-700">
                                                Incl GST
                                            </span>

                                            <span className="font-semibold text-gray-900">
                                                {formatCurrency(
                                                    jobDetails.inclGst,
                                                )}
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
                                                {formatCurrency(
                                                    jobDetails.wallsRoofRate,
                                                )}
                                            </span>
                                        </div>

                                        {jobDetails.hasSecondFloor && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    Floor Rate
                                                </span>

                                                <span className="font-medium text-gray-900">
                                                    {formatCurrency(
                                                        jobDetails.floorRate,
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">
                                                Steel
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatCurrency(
                                                    jobDetails.steel,
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">
                                                Additional Cost
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatCurrency(
                                                    jobDetails.additionalCost,
                                                )}
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
                                                Ground Floor
                                                Walls
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatNumber(
                                                    jobDetails.gfw,
                                                )}{" "}
                                                lm
                                            </span>
                                        </div>

                                        {jobDetails.hasSecondFloor && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">
                                                        First
                                                        Floor
                                                        Walls
                                                    </span>

                                                    <span className="font-medium text-gray-900">
                                                        {formatNumber(
                                                            jobDetails.ffw,
                                                        )}{" "}
                                                        lm
                                                    </span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">
                                                        Floor
                                                    </span>

                                                    <span className="font-medium text-gray-900">
                                                        {formatNumber(
                                                            jobDetails.floor,
                                                        )}{" "}
                                                        m²
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">
                                                Roof
                                            </span>

                                            <span className="font-medium text-gray-900">
                                                {formatNumber(
                                                    jobDetails.roof,
                                                )}{" "}
                                                m²
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {jobDetails.hasHebel && (
                                    <div className="rounded-xl border border-gray-200 p-5">
                                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                            Hebel
                                        </h3>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    Height
                                                </span>

                                                <span className="font-medium text-gray-900">
                                                    {formatNumber(
                                                        jobDetails.hebelHeight,
                                                    )}{" "}
                                                    m
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    Length
                                                </span>

                                                <span className="font-medium text-gray-900">
                                                    {formatNumber(
                                                        jobDetails.hebelLength,
                                                    )}{" "}
                                                    m
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    Rate
                                                </span>

                                                <span className="font-medium text-gray-900">
                                                    {formatCurrency(
                                                        jobDetails.hebelRate,
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex justify-between border-t border-gray-200 pt-3">
                                                <span className="font-medium text-gray-700">
                                                    Hebel Cost
                                                </span>

                                                <span className="font-semibold text-gray-900">
                                                    {formatCurrency(
                                                        jobDetails.hebelCost,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Plans and PDFs
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500">
                                            Upload and open
                                            construction plans
                                            for this job.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500">
                                            {jobDetails.files
                                                ?.length ??
                                                0}{" "}
                                            files
                                        </span>

                                        <button
                                            type="button"
                                            disabled={
                                                isUploading
                                            }
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isUploading
                                                ? "Uploading..."
                                                : "Upload PDFs"}
                                        </button>

                                        <input
                                            ref={
                                                fileInputRef
                                            }
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            multiple
                                            onChange={
                                                handleFileUpload
                                            }
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                {fileError && (
                                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {fileError}
                                    </div>
                                )}

                                {!jobDetails.files ||
                                jobDetails.files.length ===
                                    0 ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="w-full rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center hover:border-gray-400 hover:bg-gray-50"
                                    >
                                        <p className="font-medium text-gray-700">
                                            No PDFs uploaded
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500">
                                            Click to upload
                                            architectural or
                                            engineering plans.
                                        </p>
                                    </button>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full min-w-[760px] text-left text-sm">
                                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold">
                                                        File
                                                        Name
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

                                                    <th className="px-6 py-3 text-right font-semibold">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-gray-200">
                                                {jobDetails.files.map(
                                                    (
                                                        file,
                                                    ) => (
                                                        <tr
                                                            key={
                                                                file.id
                                                            }
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="max-w-xs px-6 py-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSelectedFile(
                                                                            file,
                                                                        )
                                                                    }
                                                                    className="block max-w-full truncate text-left font-medium text-gray-900 hover:underline"
                                                                >
                                                                    {
                                                                        file.originalName
                                                                    }
                                                                </button>
                                                            </td>

                                                            <td className="px-6 py-4 text-gray-700">
                                                                PDF
                                                            </td>

                                                            <td className="px-6 py-4 text-gray-700">
                                                                {formatFileSize(
                                                                    file.size,
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-4 text-gray-700">
                                                                {formatUploadedDate(
                                                                    file.uploadedAt,
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-4">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setSelectedFile(
                                                                                file,
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        Open
                                                                        viewer
                                                                    </button>

                                                                    <a
                                                                        href={getFileUrl(
                                                                            file,
                                                                        )}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        New
                                                                        tab
                                                                    </a>

                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            deletingFileId ===
                                                                            file.id
                                                                        }
                                                                        onClick={() =>
                                                                            void handleDeleteFile(
                                                                                file,
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        {deletingFileId ===
                                                                        file.id
                                                                            ? "Deleting..."
                                                                            : "Delete"}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {jobDetails && (
                <NewQuoteModal
                    isOpen={isEditQuoteModalOpen}
                    onClose={() =>
                        setIsEditQuoteModalOpen(false)
                    }
                    onCreateQuote={handleUpdateQuote}
                    initialQuote={{
                        ...jobDetails,
                        files: [],
                    }}
                    mode="edit"
                />
            )}
        </main>
    );
}

export default JobDetailPage;