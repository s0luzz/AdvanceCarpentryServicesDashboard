import { useState } from "react";

import { useFeedback } from "../ui/Feedback";
import { formatCurrency } from "../../lib/format";
import { invoicedTotal, quoteDifference, type SupplierCost } from "../../lib/supplierCost";

type Props = {
    address: string;
    cost: SupplierCost;
    onClose: () => void;
};

const INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

// A starting point only: everything is editable before it's sent. Plain text,
// so the address and amounts can't be bold like in the usual email.
function draftBody({ address, cost }: Pick<Props, "address" | "cost">) {
    const quoted = cost.quotedAmount === null ? "[quoted price]" : formatCurrency(cost.quotedAmount);
    const difference = quoteDifference(cost);
    const diff =
        difference === null
            ? ""
            : ` (diff ${difference > 0 ? "-" : "+"}${formatCurrency(Math.abs(difference))})`;

    return [
        `Good ${new Date().getHours() < 12 ? "Morning" : "Afternoon"},`,
        "Hope you are well",
        `For ${address}, there is a discrepancy between the quoted price and the invoiced totals. (attached)`,
        `${address} - Quoted price ${quoted}. Invoiced ${formatCurrency(invoicedTotal(cost))}${diff}`,
        "Could you please review and confirm the difference as well as issue the relevant credit / updated invoice in line with our agreed quoted amounts.",
        "",
        "Kind Regards,",
        "Andrew Daher",
        "Company Director | Advance Carpentry Services",
    ].join("\n");
}

export default function DiscrepancyEmailDialog({ address, cost, onClose }: Props) {
    const { toast } = useFeedback();
    const [to, setTo] = useState("");
    const [subject, setSubject] = useState(`Invoice discrepancy - ${address}`);
    const [body, setBody] = useState(() => draftBody({ address, cost }));

    async function copy() {
        try {
            await navigator.clipboard.writeText(body);
            toast({ message: "Email text copied.", tone: "success" });
        } catch {
            toast({ message: "Couldn't copy. Select the text and copy it by hand.", tone: "error" });
        }
    }

    const mailto = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Discrepancy email</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            A draft to the supplier. Edit it, then open it in your email app.
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
                    <label className="block text-sm font-medium text-gray-700">
                        To
                        <input
                            type="email"
                            className={`${INPUT} mt-1`}
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="accounts@supplier.com.au"
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Subject
                        <input className={`${INPUT} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Message
                        <textarea
                            rows={12}
                            className={`${INPUT} mt-1`}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </label>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Close
                    </button>

                    <button
                        type="button"
                        onClick={() => void copy()}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Copy
                    </button>

                    <a
                        href={mailto}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        Open in email
                    </a>
                </div>
            </div>
        </div>
    );
}
