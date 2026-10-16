export type SupplierFile = {
    id: string;
    name: string;
    size: number;
    type: string;
    addedAt: string;
};

export type SupplierInvoice = {
    id: string;
    amount: number;
    note: string;
    file: SupplierFile | null;
    addedAt: string;
};

export type SupplierCost = {
    supplier: string;
    quotedAmount: number | null;
    evidence: SupplierFile[];
    invoices: SupplierInvoice[];
};

export const invoicedTotal = (cost?: SupplierCost | null) =>
    Math.round(
        (cost?.invoices ?? []).reduce((sum, invoice) => sum + invoice.amount, 0) * 100,
    ) / 100;

// Quoted minus invoiced so far: positive = still under the quote, negative =
// over it. Null until a quote is entered.
export function quoteDifference(cost?: SupplierCost | null) {
    if (cost?.quotedAmount === null || cost?.quotedAmount === undefined) {
        return null;
    }

    return Math.round((cost.quotedAmount - invoicedTotal(cost)) * 100) / 100;
}

export const fileUrl = (jobId: string, fileId: string) =>
    `/api/quoted-jobs/${jobId}/supplier-files/${fileId}`;
