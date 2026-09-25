import { jsPDF } from "jspdf";

export type InvoicePdfData = {
  invoiceNumber: number;
  description: string;
  amountExGst: number;
  gst: number;
  amountIncGst: number;
  amountPaidToDate: number;
  date: string;
};

export type InvoicePdfJob = {
  name: string;
  address: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_RIGHT;

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sanitiseFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ") || "invoice"
  );
}

export function generateInvoicePdf(
  job: InvoicePdfJob,
  invoice: InvoicePdfData,
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  let y = 50;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(37, 99, 235);
  pdf.text("ADVANCE", MARGIN_LEFT, y);
  pdf.setTextColor(22, 163, 74);
  pdf.text(
    "CARPENTRY SERVICES",
    MARGIN_LEFT + pdf.getTextWidth("ADVANCE ") + 4,
    y,
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text("ACN. 12 166 309 851", CONTENT_RIGHT, y - 6, {
    align: "right",
  });

  y += 26;
  pdf.text("P: 0406 641 049", MARGIN_LEFT, y);
  y += 14;
  pdf.text("E: Info@advancecarpentryservices.com.au", MARGIN_LEFT, y);
  y += 14;
  pdf.text("License Number: 270963C", MARGIN_LEFT, y);

  y += 40;
  pdf.setFontSize(11);
  pdf.text(`To: ${job.name}`, MARGIN_LEFT, y);

  pdf.setFont("helvetica", "bold");
  pdf.text("TAX INVOICE", CONTENT_RIGHT, y, { align: "right" });
  pdf.setFont("helvetica", "normal");

  y += 20;
  pdf.text(`Site Address: ${job.address}`, MARGIN_LEFT, y);

  y += 34;
  const labelX = 330;
  const valueX = 430;
  pdf.text("Invoice Number", labelX, y);
  pdf.text(String(invoice.invoiceNumber), valueX, y);
  y += 16;
  pdf.text("Date Of Invoice", labelX, y);
  pdf.text(formatDate(invoice.date), valueX, y);

  y += 34;
  pdf.setFont("helvetica", "bold");
  pdf.text("Description & Inclusions", MARGIN_LEFT, y);
  pdf.text("Total", 400, y);
  pdf.text("GST", 480, y);
  pdf.setFont("helvetica", "normal");
  pdf.setDrawColor(0, 0, 0);
  y += 6;
  pdf.line(MARGIN_LEFT, y, CONTENT_RIGHT, y);

  y += 18;
  const descriptionLines = pdf.splitTextToSize(
    `- ${invoice.description}`,
    340,
  );
  pdf.text(descriptionLines, MARGIN_LEFT, y);
  pdf.text(formatCurrency(invoice.amountExGst), 400, y);
  pdf.text(formatCurrency(invoice.gst), 480, y);
  y += descriptionLines.length * 14;

  y += 30;
  pdf.setTextColor(220, 38, 38);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Already Paid: ${formatCurrency(invoice.amountPaidToDate)}`,
    MARGIN_LEFT,
    y,
  );

  y += 60;
  pdf.text("TOTAL INC GST", 400, y);
  pdf.text(formatCurrency(invoice.amountIncGst), 480, y);

  y += 40;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const thanksLines = pdf.splitTextToSize(
    "Advance Carpentry Services appreciates your business and prompt payment of this account.",
    CONTENT_RIGHT - MARGIN_LEFT,
  );
  pdf.text(thanksLines, MARGIN_LEFT, y);
  y += thanksLines.length * 12 + 8;

  pdf.setFont("helvetica", "bold");
  pdf.text("Account Name: Advance Carpentry Services", MARGIN_LEFT, y);
  y += 14;
  pdf.text("Account Number: 1100 0160", MARGIN_LEFT, y);
  y += 14;
  pdf.text("BSB: 062 – 202", MARGIN_LEFT, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("M: 0406 641 049", MARGIN_LEFT, PAGE_HEIGHT - 40);
  pdf.text(
    "29 Meakin Street, MERRYLANDS NSW 2160",
    CONTENT_RIGHT,
    PAGE_HEIGHT - 40,
    { align: "right" },
  );

  pdf.save(
    `${sanitiseFileName(`Invoice ${invoice.invoiceNumber} - ${job.address}`)}.pdf`,
  );
}
