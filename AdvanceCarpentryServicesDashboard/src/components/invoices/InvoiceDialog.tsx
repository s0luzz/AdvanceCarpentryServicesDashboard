import { useEffect, useState } from "react";

export type NewInvoicePayload = {
    description: string;
    amountIncGst: number;
    date: string;
    invoiceNumber?: string;
};

type InvoiceDialogProps = {
    isOpen: boolean;
    isSubmitting: boolean;
    error: string;
    onClose: () => void;
    onSubmit: (payload: NewInvoicePayload) => void;
};

const API_URL = "http://localhost:3001";

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

export default function InvoiceDialog({
    isOpen,
    isSubmitting,
    error,
    onClose,
    onSubmit,
}: InvoiceDialogProps) {
    const [description, setDescription] = useState("");
    const [amountIncGst, setAmountIncGst] = useState("");
    const [date, setDate] = useState(todayIsoDate());
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState<
        number | null
    >(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setDescription("");
        setAmountIncGst("");
        setDate(todayIsoDate());
        setInvoiceNumber("");

        fetch(`${API_URL}/api/counters`)
            .then((response) => response.json())
            .then((counters) =>
                setNextInvoiceNumber(
                    Number(counters?.nextInvoiceNumber) || null
                )
            )
            .catch(() => setNextInvoiceNumber(null));
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const parsedAmount = Number(amountIncGst);
    const canSubmit =
        description.trim().length > 0 &&
        Number.isFinite(parsedAmount) &&
        parsedAmount > 0 &&
        !isSubmitting;

    function handleSubmit() {
        if (!canSubmit) {
            return;
        }

        onSubmit({
            description: description.trim(),
            amountIncGst: parsedAmount,
            date: new Date(date).toISOString(),
            invoiceNumber: invoiceNumber.trim() || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            New Invoice
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Issue an invoice against this job.
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
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Description
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            placeholder="e.g. Installation of cladding (100% of total)"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Amount (incl. GST)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountIncGst}
                            onChange={(event) =>
                                setAmountIncGst(event.target.value)
                            }
                            placeholder="e.g. 4950.00"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                        {Number.isFinite(parsedAmount) &&
                            parsedAmount > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    GST ${(parsedAmount / 11).toFixed(2)}{" "}
                                    &middot; Ex GST $
                                    {(
                                        parsedAmount -
                                        parsedAmount / 11
                                    ).toFixed(2)}
                                </p>
                            )}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Invoice Number
                        </label>
                        <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(event) =>
                                setInvoiceNumber(event.target.value)
                            }
                            placeholder={
                                nextInvoiceNumber
                                    ? `Leave blank to use ${nextInvoiceNumber}`
                                    : "Leave blank to auto-assign"
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
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
                        {isSubmitting ? "Creating..." : "Create Invoice"}
                    </button>
                </div>
            </div>
        </div>
    );
}
