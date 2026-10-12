// Downloads an invoice built by the app: your Word template with the details
// filled in (.docx), or the same invoice as a PDF.
export async function downloadInvoice(
    jobId: string,
    invoiceId: string,
    format: "docx" | "pdf",
) {
    const response = await fetch(
        `/api/quoted-jobs/${jobId}/invoices/${invoiceId}/${format}`,
    );

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Couldn't create the invoice file.");
    }

    // Use the name the server chose (the address + invoice number).
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const filename = encoded
        ? decodeURIComponent(encoded)
        : `Invoice.${format}`;

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
