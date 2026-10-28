import { GState, jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { amountInWords, formatDateBD } from "@/lib/utils";
import { paymentStatusFromAmounts } from "@/lib/sale-finance";
import { DEFAULT_DOCUMENT_BODY } from "@/lib/default-document-body";
import { resolveDocumentSubject } from "@/lib/document-subject";
import { BRAND, companyLetterhead } from "@/lib/brand";

type Kind = "bill" | "quotation" | "challan" | "proposal";

type Item = {
  name?: string;
  sku?: string;
  description?: string;
  imageUrl?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  remarks?: string;
};

export type TradePdfSale = {
  invoiceNo?: string;
  proposalNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  currency?: string;
  poNo?: string;
  poDate?: Date | string;
  subject?: string;
  documentBody?: string;
  terms?: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  items?: Item[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  note?: string;
  soldByName?: string;
  saleDate?: Date | string;
};

export type TradePdfBusiness = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
};

function dash(v?: string | number | null) {
  if (v == null || v === "") return "";
  return String(v);
}

function enDate(v?: Date | string) {
  if (!v) return "";
  return formatDateBD(v, "en");
}

function taka(n?: number) {
  return `${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}/-`;
}

function englishName(name?: string, fallback = "Authorized Signatory") {
  const v = String(name || "").trim();
  if (!v || /[^\u0000-\u007f]/.test(v) || /admin/i.test(v)) return fallback;
  return v;
}

function isOfferKind(kind: Kind) {
  return kind === "quotation" || kind === "proposal";
}

function wechatId(phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `sigma${digits.replace(/^880/, "")}` : "";
}

async function loadImageDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function pdfImageFormat(dataUrl: string) {
  if (dataUrl.includes("image/png")) return "PNG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "JPEG";
}

function termEntries(terms?: string) {
  return String(terms || "")
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^(\d+[.)]\s*|[-•◆●○▪]\s*)/, "").trim(),
    )
    .filter(Boolean);
}

function resolveDocumentBody(documentBody?: string) {
  if (documentBody === undefined || documentBody === null) return DEFAULT_DOCUMENT_BODY;
  return String(documentBody);
}

function lastTableY(doc: jsPDF, fallback: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y = Number((doc as any).lastAutoTable?.finalY);
  return Number.isFinite(y) ? y : fallback;
}

export async function buildTradePdf(opts: {
  kind: Kind;
  sale: TradePdfSale;
  business?: TradePdfBusiness | null;
  challanNo?: string;
  challanItems?: Item[];
  headerFooter?: boolean;
}) {
  const { kind, sale, business } = opts;
  const headerFooter = opts.headerFooter !== false;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bizName = companyLetterhead(business?.name);
  const items = (kind === "challan" && opts.challanItems?.length ? opts.challanItems : sale.items) || [];
  const date = enDate(sale.saleDate);
  const m = 10;
  const boxW = 62;
  const contentW = pageW - m * 2;
  const logoData = business?.logoUrl ? await loadImageDataUrl(business.logoUrl) : null;
  const footerH = 16;
  const lineGap = 4.2;
  let headerBottom = 34;

  function drawLetterhead() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    const logoW = 18;
    const officeGap = 4;
    const officeLeft = pageW - m - boxW;
    const brandLeft = m + logoW + officeGap;
    const brandRight = officeLeft - officeGap;
    const brandMax = Math.max(40, brandRight - brandLeft);
    const brandCenter = (brandLeft + brandRight) / 2;
    const nameLines = doc.splitTextToSize(bizName, brandMax);
    const nameBottom = 16 + (nameLines.length - 1) * 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const officeLines = [
      business?.address ? `Office: ${business.address}` : "",
      business?.email ? `Email: ${business.email}` : "",
      business?.phone ? `Mobile: ${business.phone}` : "",
    ]
      .filter(Boolean)
      .flatMap((line) => doc.splitTextToSize(line, boxW - 4));
    const officeH = Math.max(20, 6 + officeLines.length * 3.6);
    const ruleY = Math.max(30, 10 + officeH, nameBottom + 12);
    headerBottom = ruleY + 4;
    if (!headerFooter) return;

    if (logoData) {
      try {
        doc.addImage(logoData, pdfImageFormat(logoData), m, 9, logoW, logoW);
      } catch {
        /* skip */
      }
    } else {
      doc.setFillColor(22, 63, 134);
      doc.circle(m + 9, 18, 9, "F");
      doc.setDrawColor(232, 137, 44);
      doc.setLineWidth(0.8);
      doc.circle(m + 9, 18, 7.2, "S");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(BRAND.logoMark, m + 9, 19.4, { align: "center" });
      doc.setTextColor(20);
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 79, 160);
    doc.setFontSize(17);
    doc.text(nameLines, brandCenter, 16, { align: "center" });
    doc.setTextColor(196, 94, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const tagLines = doc.splitTextToSize(BRAND.documentTagline, brandMax);
    doc.text(tagLines, brandCenter, nameBottom + 5.5, { align: "center" });
    doc.setTextColor(20);

    doc.setFontSize(7);
    const officeFill = isOfferKind(kind) ? [236, 236, 236] : [215, 238, 248];
    doc.setFillColor(officeFill[0], officeFill[1], officeFill[2]);
    doc.setDrawColor(51);
    doc.rect(officeLeft, 8, boxW, officeH, "FD");
    let oy = 12;
    officeLines.forEach((line) => {
      doc.text(line, officeLeft + 2, oy);
      oy += 3.6;
    });

    doc.setDrawColor(232, 137, 44);
    doc.setLineWidth(1.1);
    doc.line(m, ruleY, pageW - m, ruleY);
    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    doc.line(m, ruleY + 1.3, pageW - m, ruleY + 1.3);
  }

  drawLetterhead();
  doc.setTextColor(20);
  let y = headerBottom;

  const contentLimit = () => pageH - footerH - 6;
  function newContentPage() {
    doc.addPage();
    drawLetterhead();
    doc.setTextColor(20);
    y = headerBottom;
  }
  function ensureSpace(needed: number) {
    if (y + needed > contentLimit()) newContentPage();
  }
  function writeBlock(
    text: string,
    x: number,
    width: number,
    fontSize: number,
    style: "normal" | "bold" = "normal",
    align: "left" | "center" | "right" = "left",
  ) {
    if (!text) return;
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, Math.max(8, width));
    const h = lines.length * (fontSize * 0.38 + 1.1);
    ensureSpace(h + 1);
    if (align === "center") doc.text(lines, x, y, { align: "center" });
    else if (align === "right") doc.text(lines, x, y, { align: "right" });
    else doc.text(lines, x, y);
    y += h;
  }

  const meta: [string, string][] =
    kind === "bill"
      ? [
          ["Bill No:", dash(sale.invoiceNo)],
          ["Challan No:", dash(opts.challanNo)],
          ["Ref. No:", dash(sale.referenceNo)],
          ["PO/Order No:", dash(sale.poNo || sale.salesOrderNo)],
          ["PO/Order Date:", enDate(sale.poDate)],
        ]
      : kind === "challan"
        ? [
            ["Challan No:", dash(opts.challanNo)],
            ["PI No:", dash(sale.quotationNo)],
            ["Ref. No:", dash(sale.referenceNo)],
            ["PO/Order No:", dash(sale.poNo || sale.salesOrderNo)],
            ["PO/Order Date:", enDate(sale.poDate)],
          ]
      : kind === "proposal"
        ? [
            ["Date:", date],
            ["Proposal No:", dash(sale.proposalNo)],
            ["Ref. No.:", dash(sale.referenceNo)],
          ]
        : [
            ["Date:", date],
            ["Quotation /PI No:", dash(sale.quotationNo)],
            ["Ref. No.:", dash(sale.referenceNo)],
          ];

  autoTable(doc, {
    startY: y,
    margin: { left: pageW - m - boxW, right: m, bottom: footerH + 6 },
    tableWidth: boxW,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.4,
      textColor: 20,
      lineColor: 40,
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "top",
      minCellHeight: 6,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26, fillColor: isOfferKind(kind) ? [236, 236, 236] : [207, 232, 245] },
      1: { cellWidth: 36 },
    },
    body: meta,
  });
  const metaBottom = lastTableY(doc, y + 28);

  const leftW = contentW - boxW - 6;
  const bandTop = y + 4;
  if (!isOfferKind(kind)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const dateLines = doc.splitTextToSize(`Date: ${date}`, leftW);
    doc.text(dateLines, m, bandTop);
    const title = kind === "bill" ? "Bill" : "Delivery Challan";
    doc.setFontSize(14);
    const titleY = bandTop + 6;
    doc.text(title, m + leftW / 2, titleY, { align: "center" });
    const tw = Math.min(doc.getTextWidth(title), leftW);
    doc.setLineWidth(0.4);
    doc.line(m + leftW / 2 - tw / 2, titleY + 1.2, m + leftW / 2 + tw / 2, titleY + 1.2);
    y = Math.max(bandTop + dateLines.length * lineGap, titleY + 8);
    writeBlock("To", m, leftW, 10, "bold");
    writeBlock(sale.customerName || "", m, leftW, 9);
    if (sale.customerAddress) writeBlock(sale.customerAddress, m, leftW, 9);
  } else {
    y = bandTop;
    writeBlock("To", m, leftW, 10, "bold");
    writeBlock(sale.customerName || "", m, leftW, 9);
    if (sale.customerAddress) writeBlock(sale.customerAddress, m, leftW, 9);
  }

  y = Math.max(y + 2, metaBottom + 3);

  const subject = resolveDocumentSubject({
    stored: sale.subject,
    terms: sale.terms,
    note: sale.note,
    items,
  });
  if (subject) {
    writeBlock(`Subject: ${subject}`, m, contentW, 9, "bold");
    y += 2;
  }

  if (!isOfferKind(kind)) {
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m, bottom: footerH + 6 },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 40, lineWidth: 0.2, overflow: "linebreak", valign: "top" },
      body: [[`Customer: ${sale.customerName || ""}`, `Contact: ${sale.customerMobile || ""}`]],
      columnStyles: { 0: { cellWidth: contentW / 2 }, 1: { cellWidth: contentW / 2 } },
    });
    y = lastTableY(doc, y) + 5;
  } else {
    y = Math.max(y, metaBottom + 4);
  }

  const bodyText = resolveDocumentBody(sale.documentBody);
  if (bodyText.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const para of bodyText.split(/\r?\n/)) {
      const line = para.trim() ? para : " ";
      writeBlock(line, m, contentW, 9);
      y += para.trim() ? 1 : 0;
    }
    y += 2;
  }

  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    kind === "proposal" ? "Proposal" : kind === "quotation" ? "Quotation" : "Items/Services:",
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 3;

  const currency = String(sale.currency || (kind === "quotation" ? "USD" : "BDT")).toUpperCase();
  const isQuotation = kind === "quotation";

  const head =
    kind === "challan"
      ? [["SL No.", "Item Name", "Description", "Quantity (Piece)", "Remarks"]]
      : isQuotation
        ? [["GNL CODE", "DESCRIPTION", "Quantity", "Unit", `Unit Price (${currency})`, `Total Price (${currency})`]]
        : [["SL No.", "Item Name", "Description", "Quantity (Piece)", "Unit Price (Taka)", "Total Price (Taka)"]];

  const projectBannerRow: any[] = isQuotation
    ? [
        [
          {
            content: `( ${sale.quotationNo || sale.referenceNo || "ELV-SPEC"} ) Project Name: ${subject || sale.customerName || "ELEVATOR PROJECT"}`,
            colSpan: 6,
            styles: {
              halign: "center" as const,
              fontStyle: "bold" as const,
              fillColor: [247, 249, 250] as [number, number, number],
              textColor: [0, 0, 0] as [number, number, number],
            },
          },
        ],
      ]
    : [];

  const itemRows: any[] = items.map((item, idx) => {
    if (kind === "challan") {
      return [idx + 1, item.name || "", item.description || "", String(item.qty ?? 0), item.remarks || ""];
    }
    if (isQuotation) {
      const desc = item.name && item.description && !item.description.includes(item.name)
        ? `${item.name}\n${item.description}`
        : (item.description || item.name || "");
      return [
        item.sku || "N/A",
        desc,
        String(item.qty ?? 0),
        item.unit || "Set",
        Number(item.unitPrice || 0).toFixed(2),
        Number(item.lineTotal || 0).toFixed(2),
      ];
    }
    return [
      idx + 1,
      item.name || "",
      item.description || "",
      String(item.qty ?? 0),
      Number(item.unitPrice || 0).toLocaleString("en-IN"),
      Number(item.lineTotal || 0).toLocaleString("en-IN"),
    ];
  });
  const totalRows: any[] = [];
  if (kind === "bill") {
    if (Number(sale.discount || 0)) totalRows.push(["", "", "", "", "Discount", taka(sale.discount)]);
    if (Number(sale.tax || 0)) totalRows.push(["", "", "", "", "Tax", taka(sale.tax)]);
    if (Number(sale.shipping || 0)) totalRows.push(["", "", "", "", "Shipping", taka(sale.shipping)]);
  }
  if (isQuotation) {
    totalRows.push([
      { content: "", colSpan: 4 },
      { content: `Total (${currency})`, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: [247, 249, 250] as [number, number, number] } },
      { content: Number(sale.grandTotal || 0).toFixed(2), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: [247, 249, 250] as [number, number, number] } },
    ]);
  } else if (kind !== "challan") {
    totalRows.push(["", "", "", "", isOfferKind(kind) ? "Total Price =" : "Total Bill =", taka(sale.grandTotal)]);
  } else {
    const qtyTotal = items.reduce((a, i) => a + Number(i.qty || 0), 0);
    totalRows.push(["", "", "Total =", String(qtyTotal), ""]);
  }

  const tableOpts = {
    head,
    margin: { left: m, right: m, top: headerBottom, bottom: footerH + 8 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      valign: "top" as const,
      minCellHeight: 8,
      lineColor: 30,
      lineWidth: 0.2,
      overflow: "linebreak" as const,
    },
    headStyles: {
      fillColor: isQuotation ? ([0, 0, 0] as [number, number, number]) : ([234, 214, 176] as [number, number, number]),
      textColor: isQuotation ? 255 : 20,
      fontStyle: "bold" as const,
      halign: "center" as const,
      overflow: "linebreak" as const,
    },
    columnStyles: (kind === "challan"
      ? {
          0: { cellWidth: 16, halign: "center" as const },
          1: { cellWidth: 46 },
          2: { cellWidth: 58 },
          3: { cellWidth: 28, halign: "center" as const },
          4: { cellWidth: 42 },
        }
      : isQuotation
        ? {
            0: { cellWidth: 24, halign: "center" as const },
            1: { cellWidth: 74 },
            2: { cellWidth: 18, halign: "center" as const },
            3: { cellWidth: 16, halign: "center" as const },
            4: { cellWidth: 28, halign: "right" as const },
            5: { cellWidth: 30, halign: "right" as const },
          }
        : {
            0: { cellWidth: 14, halign: "center" as const },
            1: { cellWidth: 36 },
            2: { cellWidth: 48 },
            3: { cellWidth: 24, halign: "center" as const },
            4: { cellWidth: 34, halign: "center" as const },
            5: { cellWidth: 34, halign: "center" as const },
          }) as Record<string, { cellWidth?: number; halign?: "center" | "right" }>,
  };

  autoTable(doc, {
    ...tableOpts,
    startY: y,
    body: [...projectBannerRow, ...itemRows, ...totalRows],
    pageBreak: "auto",
    rowPageBreak: "auto",
    showHead: "everyPage",
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) drawLetterhead();
    },
  });
  y = lastTableY(doc, y) + 6;

  function drawTermsAtCursor() {
    const entries = termEntries(sale.terms);
    if (!entries.length) return;
    ensureSpace(10);
    writeBlock("Terms & Conditions", m, contentW, 9, "bold");
    entries.forEach((line, index) => {
      writeBlock(`${index + 1}. ${line}`, m, contentW, 8);
    });
    y += 3;
  }

  if (kind !== "challan") {
    ensureSpace(10);
    writeBlock(`In Word: ${amountInWords(sale.grandTotal || 0, "en")}`, pageW - m, contentW, 9, "bold", "right");
    y += 2;
  }
  if (kind === "bill") {
    const pay = paymentStatusFromAmounts(sale.grandTotal || 0, sale.paidAmount || 0);
    const payLabel = pay === "paid" ? "Paid" : pay === "partial" ? "Partial Paid" : "Due";
    writeBlock(
      `Paid Amount: ${taka(sale.paidAmount)}    Due Amount: ${taka(sale.dueAmount)}    Payment Status: ${payLabel}`,
      m,
      contentW,
      8,
      "bold",
    );
    y += 2;
  }

  if (isOfferKind(kind)) {
    drawTermsAtCursor();
    if (termEntries(sale.terms).length) {
      writeBlock(
        kind === "proposal"
          ? "Please review this proposal. After acceptance we will issue a quotation / PI, then confirm the new order."
          : "Please sign back to us if you confirm this P.I/Quotation.",
        m,
        contentW,
        8,
      );
      y += 4;
    }
  } else {
    if (termEntries(sale.terms).length) drawTermsAtCursor();
    const note =
      "Already we have supplied these services/items with good condition to your company. Now please check our bill and take necessary action to pay our bill accordingly. If you have any confusion or have any query then please inform to us feel freely and we will support you accordingly.";
    writeBlock(note, m, contentW, 8);
    writeBlock(`- ${bizName}`, pageW - m, contentW, 8, "normal", "right");
    y += 4;
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.rect(pageW / 2 - 38, y - 4, 76, 8);
    doc.text("24/7 Best Deal, Best Service", pageW / 2, y + 1.5, { align: "center" });
    y += 16;
  }

  const signH = 22;
  if (y + signH > pageH - footerH - 4) newContentPage();
  const signY = Math.max(y + 10, pageH - footerH - 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.line(m, signY, m + 50, signY);
  doc.line(pageW - m - 55, signY, pageW - m, signY);
  doc.text(isOfferKind(kind) ? "(Customer Signature)" : "(Receiver Signature)", m, signY + 5);
  doc.setFont("helvetica", "bold");
  const propName = englishName(sale.soldByName);
  const propLines = doc.splitTextToSize(propName, 70);
  doc.text(propLines, pageW - m, signY + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  const propRole = doc.splitTextToSize(`Proprietor, ${bizName}`, 70);
  doc.text(propRole, pageW - m, signY + 5 + propLines.length * 4, { align: "right" });

  const wechat = wechatId(business?.phone);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (headerFooter) {
      try {
        doc.setGState(new GState({ opacity: 0.12 }));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(150);
        doc.text(BRAND.company, pageW / 2, 145, { align: "center", angle: 32 });
        doc.setGState(new GState({ opacity: 1 }));
      } catch {
        /* watermark optional */
      }
      doc.setTextColor(20);
      if (headerFooter) {
        doc.setFillColor(143, 201, 184);
        doc.rect(0, pageH - footerH, pageW, footerH, "F");
        doc.setFontSize(7);
        doc.setTextColor(20);
        doc.text(`Office Address : ${business?.address || ""}`, pageW / 2, pageH - 10.5, {
          align: "center",
          maxWidth: pageW - 16,
        });
        doc.text(
          [
            business?.phone ? `Mobile/WhatsApp: ${business.phone}` : "",
            wechat ? `Wechat: ${wechat}` : "",
            business?.website ? `Website: ${business.website}` : "",
            business?.email ? `Email: ${business.email}` : "",
          ]
            .filter(Boolean)
            .join("  ,  "),
          pageW / 2,
          pageH - 6,
          { align: "center", maxWidth: pageW - 16 },
        );
      }
    }
  }

  return doc;
}
