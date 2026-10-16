import { useEffect, useRef, useState } from "react";

import { useFeedback } from "../ui/Feedback";
import { formatCurrency, formatDate } from "../../lib/format";
import {
    fileUrl,
    invoicedTotal,
    quoteDifference,
    type SupplierCost,
    type SupplierFile,
} from "../../lib/supplierCost";

type Props = {
    jobId: string;
    cost?: SupplierCost;
    onChange: (cost: SupplierCost) => void;
};

const INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

const EMPTY: SupplierCost = { supplier: "", quotedAmount: null, evidence: [], invoices: [] };

export function DifferenceText({ difference }: { difference: number | null }) {
    if (difference === null) {
        return <span className="text-gray-400">—</span>;
    }

    if (difference === 0) {
        return <span className="font-semibold text-gray-700">On quote</span>;
    }

    return (
        <span className={`font-semibold ${difference > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(Math.abs(difference))} {difference > 0 ? "under" : "over"}
        </span>
    );
}

function FileLink({ jobId, file }: { jobId: string; file: SupplierFile }) {
    return (
        <a
            href={fileUrl(jobId, file.id)}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-sm text-blue-600 hover:underline"
        >
            {file.name}
        </a>
    );
}

export default function SupplierCostCard({ jobId, cost = EMPTY, onChange }: Props) {
    const { toast, confirm } = useFeedback();
    const base = `/api/quoted-jobs/${jobId}/supplier-cost`;

    const [supplier, setSupplier] = useState(cost.supplier);
    const [quoted, setQuoted] = useState(cost.quotedAmount === null ? "" : String(cost.quotedAmount));
    const [newAmount, setNewAmount] = useState("");
    const [newNote, setNewNote] = useState("");
    const [newFile, setNewFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const evidenceInput = useRef<HTMLInputElement>(null);
    const invoiceFileInput = useRef<HTMLInputElement>(null);

    // Follow the saved values when they change underneath (after a save).
    useEffect(() => {
        setSupplier(cost.supplier);
        setQuoted(cost.quotedAmount === null ? "" : String(cost.quotedAmount));
    }, [cost.supplier, cost.quotedAmount]);

    async function call(url: string, init: RequestInit, failure: string) {
        setBusy(true);

        try {
            const response = await fetch(url, init);
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message ?? failure);
            }

            onChange(result);

            return true;
        } catch (error) {
            toast({ message: error instanceof Error ? error.message : failure, tone: "error" });

            return false;
        } finally {
            setBusy(false);
        }
    }

    const json = (method: string, body: unknown): RequestInit => ({
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    function saveDetails() {
        const parsed = quoted.trim() === "" ? null : Number(quoted.replace(/[$,\s]/g, ""));
        const unchanged =
            supplier.trim() === cost.supplier && (parsed ?? null) === (cost.quotedAmount ?? null);

        if (unchanged) {
            return;
        }

        void call(base, json("PATCH", { supplier, quotedAmount: quoted }), "Couldn't save the quote.");
    }

    async function addEvidence(list: FileList | null) {
        if (!list?.length) {
            return;
        }

        const form = new FormData();

        Array.from(list).forEach((file) => form.append("files", file));
        await call(`${base}/evidence`, { method: "POST", body: form }, "Couldn't upload the file.");

        if (evidenceInput.current) {
            evidenceInput.current.value = "";
        }
    }

    async function removeFile(url: string, name: string) {
        const ok = await confirm({
            title: `Delete ${name}?`,
            message: "The file is removed for good.",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (ok) {
            await call(url, { method: "DELETE" }, "Couldn't delete that.");
        }
    }

    async function addInvoice() {
        const form = new FormData();

        form.append("amount", newAmount);
        form.append("note", newNote);

        if (newFile) {
            form.append("file", newFile);
        }

        const ok = await call(`${base}/invoices`, { method: "POST", body: form }, "Couldn't add the invoice.");

        if (ok) {
            setNewAmount("");
            setNewNote("");
            setNewFile(null);

            if (invoiceFileInput.current) {
                invoiceFileInput.current.value = "";
            }
        }
    }

    async function attachToInvoice(invoiceId: string, file: File | undefined) {
        if (file) {
            const form = new FormData();

            form.append("file", file);
            await call(`${base}/invoices/${invoiceId}/file`, { method: "POST", body: form }, "Couldn't upload the file.");
        }
    }

    const total = invoicedTotal(cost);
    const difference = quoteDifference(cost);

    return (
        <div className="border-t border-gray-200 p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Supplier cost</h3>
                <p className="mt-1 text-sm text-gray-500">
                    What the supplier quoted for this job, and what they've invoiced so far.
                </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="block text-sm font-medium text-gray-700 lg:col-span-2">
                        Supplier
                        <input
                            className={`${INPUT} mt-1`}
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            onBlur={saveDetails}
                            placeholder="Who quoted?"
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Quoted
                        <input
                            className={`${INPUT} mt-1`}
                            value={quoted}
                            onChange={(e) => setQuoted(e.target.value)}
                            onBlur={saveDetails}
                            inputMode="decimal"
                            placeholder="0.00"
                        />
                    </label>

                    <div className="text-sm">
                        <p className="font-medium text-gray-700">Invoiced so far</p>
                        <p className="mt-2 text-base font-semibold text-gray-900">{formatCurrency(total)}</p>
                    </div>

                    <div className="text-sm">
                        <p className="font-medium text-gray-700">Quoted vs invoiced</p>
                        <p className="mt-2 text-base">
                            <DifferenceText difference={difference} />
                        </p>
                    </div>
                </div>

                <div className="mt-5 border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">
                            Evidence of the quote ({cost.evidence.length})
                        </p>

                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => evidenceInput.current?.click()}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                            Attach evidence
                        </button>

                        <input
                            ref={evidenceInput}
                            type="file"
                            multiple
                            hidden
                            onChange={(e) => void addEvidence(e.target.files)}
                        />
                    </div>

                    {cost.evidence.length > 0 && (
                        <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
                            {cost.evidence.map((file) => (
                                <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <FileLink jobId={jobId} file={file} />

                                    <button
                                        type="button"
                                        onClick={() => void removeFile(`${base}/evidence/${file.id}`, file.name)}
                                        aria-label={`Delete ${file.name}`}
                                        className="shrink-0 text-base leading-none text-gray-400 hover:text-red-600"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-5 border-t border-gray-200 pt-4">
                    <p className="text-sm font-medium text-gray-700">
                        Supplier invoices ({cost.invoices.length})
                    </p>

                    {cost.invoices.length > 0 && (
                        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[560px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold">Note</th>
                                        <th className="px-4 py-2 font-semibold">Amount</th>
                                        <th className="px-4 py-2 font-semibold">File</th>
                                        <th className="px-4 py-2 font-semibold">Added</th>
                                        <th className="px-4 py-2" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200">
                                    {cost.invoices.map((invoice) => (
                                        <tr key={invoice.id}>
                                            <td className="px-4 py-2 text-gray-700">{invoice.note || "—"}</td>

                                            <td className="px-4 py-2">
                                                <input
                                                    key={invoice.amount}
                                                    defaultValue={invoice.amount}
                                                    inputMode="decimal"
                                                    aria-label="Invoice amount"
                                                    onBlur={(e) => {
                                                        if (Number(e.target.value) !== invoice.amount) {
                                                            void call(
                                                                `${base}/invoices/${invoice.id}`,
                                                                json("PATCH", { amount: e.target.value }),
                                                                "Couldn't save the amount.",
                                                            );
                                                        }
                                                    }}
                                                    className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
                                                />
                                            </td>

                                            <td className="px-4 py-2">
                                                {invoice.file ? (
                                                    <FileLink jobId={jobId} file={invoice.file} />
                                                ) : (
                                                    <label className="cursor-pointer text-xs font-medium text-blue-600 hover:underline">
                                                        Attach file
                                                        <input
                                                            type="file"
                                                            hidden
                                                            onChange={(e) =>
                                                                void attachToInvoice(invoice.id, e.target.files?.[0])
                                                            }
                                                        />
                                                    </label>
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                                                {formatDate(invoice.addedAt)}
                                            </td>

                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void removeFile(
                                                            `${base}/invoices/${invoice.id}`,
                                                            invoice.note || formatCurrency(invoice.amount),
                                                        )
                                                    }
                                                    aria-label="Delete invoice"
                                                    className="text-base leading-none text-gray-400 hover:text-red-600"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-3 grid items-end gap-3 sm:grid-cols-[8rem_1fr_auto_auto]">
                        <label className="block text-xs font-medium text-gray-600">
                            Amount
                            <input
                                className={`${INPUT} mt-1`}
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                inputMode="decimal"
                                placeholder="0.00"
                            />
                        </label>

                        <label className="block text-xs font-medium text-gray-600">
                            Note (optional)
                            <input
                                className={`${INPUT} mt-1`}
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Invoice number, delivery..."
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => invoiceFileInput.current?.click()}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                            {newFile ? newFile.name.slice(0, 22) : "Attach invoice"}
                        </button>

                        <input
                            ref={invoiceFileInput}
                            type="file"
                            hidden
                            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                        />

                        <button
                            type="button"
                            disabled={busy || newAmount.trim() === ""}
                            onClick={() => void addInvoice()}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                            Add invoice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
