import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Sale, Business, Shipment } from "@/models";
import { amountInWords, formatDateBD } from "@/lib/utils";
import { paymentStatusFromAmounts } from "@/lib/sale-finance";
import { buildTradePdf } from "@/lib/nes-trade-pdf";
import { BRAND } from "@/lib/brand";
import ExcelJS from "exceljs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") || "pdf";
  const locale = (new URL(req.url).searchParams.get("locale") || "bn") as "bn" | "en";
  const headerFooter = new URL(req.url).searchParams.get("hf") !== "0";

  await connectDB();
  const sale = await Sale.findById(id).lean();
  const business = await Business.findOne().lean();
  if (!sale) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bizName = locale === "bn" && business?.nameBn ? business.nameBn : business?.name || BRAND.appName;
  const bizAddress =
    locale === "bn" && business?.addressBn ? business.addressBn : business?.address || "";

  if (format === "excel") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(locale === "bn" ? "চালান" : "Invoice");
    wb.creator = BRAND.appName;

    ws.mergeCells("A1:G1");
    ws.getCell("A1").value = bizName;
    ws.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF1E6BB8" } };

    ws.mergeCells("A2:G2");
    ws.getCell("A2").value =
      locale === "bn" ? "বিক্রয় চালান / ট্যাক্স ইনভয়েস" : "Sales Invoice / Tax Invoice";
    ws.getCell("A2").font = { bold: true, size: 12 };

    ws.addRow([]);
    ws.addRow([
      locale === "bn" ? "চালান নং" : "Invoice No",
      sale.invoiceNo,
      "",
      locale === "bn" ? "তারিখ" : "Date",
      formatDateBD(sale.saleDate, locale),
    ]);
    ws.addRow([
      locale === "bn" ? "বিল প্রাপক" : "Bill To",
      sale.customerName,
      "",
      "BIN",
      business?.bin || "",
    ]);
    ws.addRow([
      locale === "bn" ? "মোবাইল" : "Mobile",
      sale.customerMobile || "",
      "",
      "TIN",
      business?.tin || "",
    ]);
    ws.addRow([
      locale === "bn" ? "ঠিকানা" : "Address",
      sale.customerAddress || "",
      "",
      "Mushak",
      business?.mushak || "",
    ]);
    ws.addRow([]);

    const headerRow = ws.addRow([
      locale === "bn" ? "ক্রমিক" : "SL",
      locale === "bn" ? "পণ্যের বিবরণ" : "Description",
      locale === "bn" ? "এসকেইউ" : "SKU",
      locale === "bn" ? "পরিমাণ" : "Qty",
      locale === "bn" ? "দর" : "Rate",
      locale === "bn" ? "ছাড়" : "Discount",
      locale === "bn" ? "মূল্য" : "Amount",
    ]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E6BB8" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    sale.items.forEach((item: {
      name?: string;
      description?: string;
      sku?: string;
      qty: number;
      unitPrice: number;
      discount?: number;
      lineTotal: number;
    }, idx: number) => {
      const desc = item.description
        ? `${item.name || ""}\n${item.description}`
        : item.name;
      ws.addRow([
        idx + 1,
        desc,
        item.sku || "",
        item.qty,
        item.unitPrice,
        item.discount || 0,
        item.lineTotal,
      ]);
    });

    ws.addRow([]);
    ws.addRow(["", "", "", "", "", locale === "bn" ? "উপমোট" : "Subtotal", sale.subtotal]);
    ws.addRow(["", "", "", "", "", locale === "bn" ? "ছাড়" : "Discount", sale.discount]);
    ws.addRow(["", "", "", "", "", locale === "bn" ? "কর" : "Tax", sale.tax]);
    ws.addRow(["", "", "", "", "", locale === "bn" ? "পরিবহন" : "Shipping", sale.shipping || 0]);
    const totalRow = ws.addRow([
      "",
      "",
      "",
      "",
      "",
      locale === "bn" ? "সর্বমোট" : "Grand Total",
      sale.grandTotal,
    ]);
    totalRow.font = { bold: true };
    ws.addRow(["", "", "", "", "", locale === "bn" ? "পরিশোধিত" : "Paid", sale.paidAmount]);
    ws.addRow(["", "", "", "", "", locale === "bn" ? "বাকি" : "Due", sale.dueAmount]);
    const payStatus = paymentStatusFromAmounts(sale.grandTotal || 0, sale.paidAmount || 0);
    const payLabel =
      payStatus === "paid"
        ? locale === "bn" ? "পরিশোধিত" : "Paid"
        : payStatus === "partial"
          ? locale === "bn" ? "আংশিক পরিশোধ" : "Partial Paid"
          : locale === "bn" ? "বাকি" : "Due";
    ws.addRow(["", "", "", "", "", locale === "bn" ? "পেমেন্ট স্ট্যাটাস" : "Payment Status", payLabel]);
    ws.addRow([]);
    ws.addRow([
      locale === "bn" ? "কথায়" : "In words",
      amountInWords(sale.grandTotal, locale),
    ]);

    ws.columns.forEach((col, i) => {
      col.width = i === 1 ? 28 : 14;
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sale.invoiceNo}.xlsx"`,
      },
    });
  }

  const shipment = await Shipment.findOne({ saleId: id }).lean();
  const doc = await buildTradePdf({
    kind: "bill",
    sale,
    business,
    challanNo: shipment?.shipmentNo,
    headerFooter,
  });
  const pdf = doc.output("arraybuffer");
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sale.invoiceNo || sale.referenceNo || "bill"}.pdf"`,
    },
  });
}
