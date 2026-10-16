import {
    type ChangeEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    NavLink,
    useNavigate,
    useParams,
} from "react-router-dom";

import NewQuoteModal, {
    type NewQuoteFormData,
    type QuoteStatus,
} from "../components/layout/NewQuoteModal";
import { useFeedback } from "../components/ui/Feedback";
import RowMenu from "../components/ui/RowMenu";
import { CardSkeleton } from "../components/ui/Skeleton";
import InvoiceDialog, {
    type NewInvoicePayload,
} from "../components/invoices/InvoiceDialog";
import SupplierCostCard from "../components/supplier/SupplierCostCard";
import SwmsDialog from "../components/swms/SwmsDialog";
import QuoteDialog, {
    type QuoteJob,
    type SavedQuote,
} from "../components/quotes/QuoteDialog";
import { downloadInvoice, downloadQuote } from "../lib/downloadInvoice";
import { formatCurrency, formatDate } from "../lib/format";
import type { SupplierCost } from "../lib/supplierCost";
import { useDocumentTitle } from "../lib/useDocumentTitle";

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

type Job = {
    id: string;
    name: string;
    quoteNumber?: number;
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
    invoices?: Invoice[];
    invoiced?: boolean;
    quote?: SavedQuote;
    supplierCost?: SupplierCost;
};

const API_URL = "";

function JobDetailPage() {
    const { jobId } = useParams<{
        jobId: string;
    }>();

    const navigate = useNavigate();
    const { toast, confirm } = useFeedback();

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const [jobDetails, setJobDetails] =
        useState<Job>();

    // Every job, loaded when the quote dialog opens (new quotes start from
    // the same client's last one).
    const [quoteDialogJobs, setQuoteDialogJobs] = useState<QuoteJob[] | null>(null);
    const [isSwmsOpen, setIsSwmsOpen] = useState(false);

    useDocumentTitle(jobDetails?.name ?? "Job");

    const [loading, setLoading] =
        useState(true);

    const [
        isEditQuoteModalOpen,
        setIsEditQuoteModalOpen,
    ] = useState(false);

    const [
        isUploading,
        setIsUploading,
    ] = useState(false);

    const [
        deletingFileId,
        setDeletingFileId,
    ] = useState<string | null>(null);

    const [
        fileError,
        setFileError,
    ] = useState("");

    const [
        isInvoiceDialogOpen,
        setIsInvoiceDialogOpen,
    ] = useState(false);

    const [
        isCreatingInvoice,
        setIsCreatingInvoice,
    ] = useState(false);

    const [
        invoiceError,
        setInvoiceError,
    ] = useState("");

    async function openQuoteDialog() {
        try {
            const response = await fetch(`${API_URL}/api/quoted-jobs`);

            if (!response.ok) {
                throw new Error();
            }

            setQuoteDialogJobs(await response.json());
        } catch {
            toast({ message: "Couldn't open the quote form. Try again.", tone: "error" });
        }
    }

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

            const data: Job =
                await response.json();

            setJobDetails({
                ...data,
                files: data.files ?? [],
            });
        } catch (error) {
            console.error(
                "Failed to fetch job details:",
                error,
            );

            toast({
                message: "Couldn't load this job. Try refreshing the page.",
                tone: "error",
            });

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
                        "Content-Type":
                            "application/json",
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
                files:
                    updatedQuote.files ?? [],
            });

            setIsEditQuoteModalOpen(
                false,
            );
        } catch (error) {
            console.error(
                "Failed to update quote:",
                error,
            );

            toast({
                message: "Couldn't save your changes to this quote.",
                tone: "error",
            });
        }
    }

    async function handleCreateInvoice(
        payload: NewInvoicePayload,
    ) {
        if (!jobId) {
            return;
        }

        setInvoiceError("");
        setIsCreatingInvoice(true);

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}/invoices`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify(
                        payload,
                    ),
                },
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.message ??
                        "Failed to create invoice",
                );
            }

            const newInvoice: Invoice =
                result;

            setJobDetails(
                (currentJob) => {
                    if (!currentJob) {
                        return currentJob;
                    }

                    return {
                        ...currentJob,
                        invoiced: true,
                        invoices: [
                            ...(currentJob.invoices ??
                                []),
                            newInvoice,
                        ],
                    };
                },
            );

            setIsInvoiceDialogOpen(
                false,
            );
        } catch (error) {
            setInvoiceError(
                error instanceof Error
                    ? error.message
                    : "Failed to create invoice",
            );
        } finally {
            setIsCreatingInvoice(false);
        }
    }

    async function handleToggleInvoiced() {
        if (!jobId || !jobDetails) {
            return;
        }

        const next = !jobDetails.invoiced;

        setJobDetails((current) =>
            current ? { ...current, invoiced: next } : current,
        );

        try {
            const response = await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ invoiced: next }),
                },
            );

            if (!response.ok) {
                throw new Error("Failed to update");
            }
        } catch {
            setJobDetails((current) =>
                current ? { ...current, invoiced: !next } : current,
            );

            toast({
                message: "Couldn't update the Invoiced tick. It's been put back.",
                tone: "error",
            });
        }
    }

    function handleDownloadInvoice(
        invoice: Invoice,
        format: "docx" | "pdf",
    ) {
        if (!jobDetails) {
            return;
        }

        downloadInvoice(jobDetails.id, invoice.id, format).catch((error) =>
            toast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Couldn't create the invoice file.",
                tone: "error",
            }),
        );
    }

    async function handleFileUpload(
        event: ChangeEvent<HTMLInputElement>,
    ) {
        const files = Array.from(
            event.target.files ?? [],
        );

        event.target.value = "";

        if (
            !jobId ||
            files.length === 0
        ) {
            return;
        }

        const invalidFile =
            files.find((file) => {
                const hasPdfMimeType =
                    file.type ===
                    "application/pdf";

                const hasPdfExtension =
                    file.name
                        .toLowerCase()
                        .endsWith(".pdf");

                return !(
                    hasPdfMimeType ||
                    hasPdfExtension
                );
            });

        if (invalidFile) {
            setFileError(
                "Only PDF files can be uploaded.",
            );

            return;
        }

        setFileError("");
        setIsUploading(true);

        try {
            const formData =
                new FormData();

            files.forEach((file) => {
                formData.append(
                    "files",
                    file,
                );
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

            setJobDetails(
                (currentJob) => {
                    if (!currentJob) {
                        return currentJob;
                    }

                    return {
                        ...currentJob,

                        files: [
                            ...(
                                currentJob.files ??
                                []
                            ),

                            ...uploadedFiles,
                        ],
                    };
                },
            );
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

        const confirmed = await confirm({
            title: `Delete "${file.originalName}"?`,
            message:
                "It's removed from this job and from the server, along with any measurements saved against it. This can't be undone.",
            confirmLabel: "Delete file",
            destructive: true,
        });

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

            setJobDetails(
                (currentJob) => {
                    if (!currentJob) {
                        return currentJob;
                    }

                    return {
                        ...currentJob,

                        files:
                            currentJob.files.filter(
                                (
                                    currentFile,
                                ) =>
                                    currentFile.id !==
                                    file.id,
                            ),
                    };
                },
            );

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

    function openViewer(file: AttachedFile) {
        if (!jobId) {
            return;
        }

        navigate(`/jobs/${jobId}/takeoff/${file.id}`);
    }

    function openOverlayMarkup() {
        if (!jobId) {
            return;
        }

        navigate(
            `/quotes/${jobId}/pdf-editor`,
        );
    }

    function getFileUrl(
        file: AttachedFile,
    ) {
        const filePath =
            file.url ?? file.path;

        if (
            filePath.startsWith(
                "http://",
            ) ||
            filePath.startsWith(
                "https://",
            )
        ) {
            return filePath;
        }

        return `${API_URL}${filePath}`;
    }

    function formatNumber(
        value: number | undefined,
    ) {
        return (
            value ?? 0
        ).toLocaleString("en-AU");
    }

    function formatFileSize(
        size: number,
    ) {
        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(
                size / 1024
            ).toFixed(1)} KB`;
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
        const date =
            new Date(uploadedAt);

        if (
            Number.isNaN(
                date.getTime(),
            )
        ) {
            return "Unknown";
        }

        return date.toLocaleDateString(
            "en-AU",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            },
        );
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-7xl space-y-6">
                <CardSkeleton lines={6} />
                <CardSkeleton lines={4} />
            </div>
        );
    }

    if (!jobId) {
        return (
            <div>
                <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
                    A job ID was not
                    provided.
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mx-auto max-w-7xl">
                <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-2 text-sm text-gray-500"
                >
                    <NavLink
                        to="/jobs"
                        className="font-medium hover:text-gray-900 hover:underline"
                    >
                        Jobs
                    </NavLink>

                    <span aria-hidden="true">›</span>

                    <span className="truncate text-gray-700">
                        {jobDetails?.name ?? "Job"}
                    </span>
                </nav>

                <section className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                {jobDetails?.name ??
                                    "Job not found"}
                            </h1>

                            <p className="mt-1 text-sm text-gray-600">
                                {jobDetails?.address ??
                                    "No address listed"}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                    {jobDetails?.status ??
                                        "Quoted"}
                                </span>

                                {jobDetails && (
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(
                                                jobDetails.invoiced,
                                            )}
                                            onChange={() =>
                                                void handleToggleInvoiced()
                                            }
                                            className="h-3.5 w-3.5 cursor-pointer"
                                        />
                                        Invoiced
                                    </label>
                                )}

                                {jobDetails?.quoteNumber && (
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                        Quote #
                                        {
                                            jobDetails.quoteNumber
                                        }
                                    </span>
                                )}
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
                            Job details could not
                            be found.
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
                                                Ground Floor Walls
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
                                                        First Floor Walls
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
                                            Upload, measure
                                            and mark up
                                            construction plans
                                            for this job.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-sm text-gray-500">
                                            {jobDetails.files
                                                ?.length ??
                                                0}{" "}
                                            files
                                        </span>

                                        <button
                                            type="button"
                                            onClick={
                                                openOverlayMarkup
                                            }
                                            disabled={
                                                !jobDetails.files ||
                                                jobDetails.files
                                                    .length === 0
                                            }
                                            className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Overlay Markup
                                        </button>

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
                                jobDetails.files
                                    .length === 0 ? (
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
                                                                        openViewer(file)
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
                                                                            openViewer(file)
                                                                        }
                                                                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        Open viewer
                                                                    </button>

                                                                    <a
                                                                        href={getFileUrl(
                                                                            file,
                                                                        )}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        New tab
                                                                    </a>

                                                                    <RowMenu
                                                                        label={`More actions for ${file.originalName}`}
                                                                        items={[
                                                                            {
                                                                                label:
                                                                                    deletingFileId ===
                                                                                    file.id
                                                                                        ? "Deleting…"
                                                                                        : "Delete…",
                                                                                destructive: true,
                                                                                onSelect: () => {
                                                                                    if (
                                                                                        deletingFileId !==
                                                                                        file.id
                                                                                    ) {
                                                                                        void handleDeleteFile(
                                                                                            file,
                                                                                        );
                                                                                    }
                                                                                },
                                                                            },
                                                                        ]}
                                                                    />
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

                            <div className="border-t border-gray-200 p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Quote
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500">
                                            The scope of work and price sent to the client.
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSwmsOpen(true)}
                                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                        >
                                            SWMS
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void openQuoteDialog()}
                                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                        >
                                            {jobDetails.quote ? "Edit quote" : "Make quote"}
                                        </button>
                                    </div>
                                </div>

                                {!jobDetails.quote ? (
                                    <p className="rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-gray-500">
                                        No quote made yet.
                                    </p>
                                ) : (
                                    <div className="rounded-xl border border-gray-200 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="text-sm text-gray-600">
                                                <p className="text-base font-semibold text-gray-900">
                                                    Quote #{jobDetails.quote.number}
                                                </p>
                                                <p className="mt-1">
                                                    {formatDate(jobDetails.quote.date + "T00:00")} · To {jobDetails.quote.to}
                                                </p>
                                                <p className="mt-1">
                                                    {jobDetails.quote.cash
                                                        ? `${formatCurrency(jobDetails.quote.inclGst)} cash (no GST)`
                                                        : `${formatCurrency(jobDetails.quote.exGst)} + ${formatCurrency(jobDetails.quote.gst)} GST = ${formatCurrency(jobDetails.quote.inclGst)}`}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                {(["docx", "pdf"] as const).map((format) => (
                                                    <button
                                                        key={format}
                                                        type="button"
                                                        onClick={() =>
                                                            void downloadQuote(jobDetails.id, format).catch((error: Error) =>
                                                                toast({ message: error.message, tone: "error" }),
                                                            )
                                                        }
                                                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                    >
                                                        {format === "docx" ? "Word" : "PDF"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {jobDetails.quote.inclGst !== jobDetails.inclGst && (
                                            <p className="mt-3 text-xs text-gray-500">
                                                The job is currently {formatCurrency(jobDetails.inclGst)} inc GST.
                                            </p>
                                        )}

                                        <details className="mt-4">
                                            <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                                Description &amp; Inclusions ({jobDetails.quote.scope.length} lines)
                                            </summary>

                                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                                                {jobDetails.quote.scope.map((line, index) => (
                                                    <li key={index}>{line}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Invoices
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500">
                                            Issue and download
                                            invoices for this
                                            job.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInvoiceError("");
                                            setIsInvoiceDialogOpen(
                                                true,
                                            );
                                        }}
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                    >
                                        New Invoice
                                    </button>
                                </div>

                                {!jobDetails.invoices ||
                                jobDetails.invoices
                                    .length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-gray-500">
                                        No invoices issued
                                        yet.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full min-w-[720px] text-left text-sm">
                                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold">
                                                        Invoice #
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
                                                    <th className="px-6 py-3 text-right font-semibold">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-gray-200">
                                                {jobDetails.invoices.map(
                                                    (invoice) => (
                                                        <tr
                                                            key={
                                                                invoice.id
                                                            }
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                                {
                                                                    invoice.invoiceNumber
                                                                }
                                                            </td>
                                                            <td className="max-w-xs truncate px-6 py-4 text-gray-700">
                                                                {
                                                                    invoice.description
                                                                }
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                {formatUploadedDate(
                                                                    invoice.date,
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                {formatCurrency(
                                                                    invoice.amountIncGst,
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    {(
                                                                        [
                                                                            "pdf",
                                                                            "docx",
                                                                        ] as const
                                                                    ).map(
                                                                        (
                                                                            format,
                                                                        ) => (
                                                                            <button
                                                                                key={
                                                                                    format
                                                                                }
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    handleDownloadInvoice(
                                                                                        invoice,
                                                                                        format,
                                                                                    )
                                                                                }
                                                                                className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                                                            >
                                                                                {format ===
                                                                                "pdf"
                                                                                    ? "PDF"
                                                                                    : "Word"}
                                                                            </button>
                                                                        ),
                                                                    )}
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

                            <SupplierCostCard
                                jobId={jobDetails.id}
                                cost={jobDetails.supplierCost}
                                onChange={(supplierCost) =>
                                    setJobDetails({ ...jobDetails, supplierCost })
                                }
                            />
                        </>
                    )}
                </section>
            </div>

            {jobDetails && isSwmsOpen && (
                <SwmsDialog
                    job={jobDetails}
                    onClose={() => setIsSwmsOpen(false)}
                    onDone={(message) => toast(message)}
                />
            )}

            {jobDetails && quoteDialogJobs && (
                <QuoteDialog
                    job={jobDetails}
                    jobs={quoteDialogJobs}
                    onClose={() => setQuoteDialogJobs(null)}
                    onSaved={(quote) => {
                        setJobDetails({
                            ...jobDetails,
                            quote,
                            quoteNumber: quote.number,
                            quotedAmount: quote.exGst,
                            gst: quote.gst,
                            inclGst: quote.inclGst,
                        });
                        toast(`Saved quote ${quote.number}.`);
                    }}
                />
            )}

            <InvoiceDialog
                isOpen={isInvoiceDialogOpen}
                isSubmitting={isCreatingInvoice}
                error={invoiceError}
                job={
                    jobDetails
                        ? {
                              name: jobDetails.name,
                              address: jobDetails.address,
                              inclGst: jobDetails.inclGst,
                              invoicedToDate: (
                                  jobDetails.invoices ?? []
                              ).reduce(
                                  (sum, invoice) =>
                                      sum + invoice.amountIncGst,
                                  0,
                              ),
                          }
                        : undefined
                }
                onClose={() =>
                    setIsInvoiceDialogOpen(false)
                }
                onSubmit={handleCreateInvoice}
            />

            {jobDetails && (
                <NewQuoteModal
                    isOpen={
                        isEditQuoteModalOpen
                    }
                    onClose={() =>
                        setIsEditQuoteModalOpen(
                            false,
                        )
                    }
                    onCreateQuote={
                        handleUpdateQuote
                    }
                    initialQuote={{
                        ...jobDetails,
                        files: [],
                    }}
                    mode="edit"
                />
            )}
        </div>
    );
}

export default JobDetailPage;