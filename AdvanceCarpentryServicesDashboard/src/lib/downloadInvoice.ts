// Downloads a file the server builds (an invoice or a quote), saved under the
// name the server chose (address + number).
export async function downloadFile(
    url: string,
    fallbackName: string,
    init?: RequestInit,
) {
    const response = await fetch(url, init);

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Couldn't create the file.");
    }

    const disposition = response.headers.get("Content-Disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : fallbackName;

    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

// An invoice: your Word template with the details filled in (.docx), or the
// same invoice as a PDF.
export function downloadInvoice(
    jobId: string,
    invoiceId: string,
    format: "docx" | "pdf",
) {
    return downloadFile(
        `/api/quoted-jobs/${jobId}/invoices/${invoiceId}/${format}`,
        `Invoice.${format}`,
    );
}

// A quote built from the job's saved scope of work and price.
export function downloadQuote(jobId: string, format: "docx" | "pdf") {
    return downloadFile(
        `/api/quoted-jobs/${jobId}/quote/${format}`,
        `Quote.${format}`,
    );
}

export type SwmsDetails = {
    principalContractor: string;
    person: string;
    location: string;
    date: string; // YYYY-MM-DD
    workers: string[];
};

// A SWMS: your Word template with these few fields swapped in, or as a PDF.
export function downloadSwms(details: SwmsDetails, format: "docx" | "pdf") {
    return downloadFile(`/api/swms/${format}`, `SWMS.${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
    });
}
