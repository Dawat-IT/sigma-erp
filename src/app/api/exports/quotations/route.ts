import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Sale } from "@/models";

function rangeError(from: string | null, to: string | null) {
  if (!from || !to) return "date_range_required";
  if (from > to) return "invalid_date_range";
  return null;
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const invalid = rangeError(from, to);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  await connectDB();
  const start = new Date(from as string);
  const end = new Date(to as string);
  end.setHours(23, 59, 59, 999);

  const rows = await Sale.find({
    status: "quotation",
    saleDate: { $gte: start, $lte: end },
  })
    .sort({ saleDate: -1 })
    .lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quotations");
  ws.columns = [
    { header: "SL No", width: 8 },
    { header: "Date", width: 14 },
    { header: "Quotation No", width: 20 },
    { header: "Reference No", width: 20 },
    { header: "Customer", width: 28 },
    { header: "Grand Total", width: 16 },
    { header: "Status", width: 14 },
  ];
  rows.forEach((row, i) => {
    ws.addRow([
      i + 1,
      row.saleDate ? new Date(row.saleDate).toISOString().slice(0, 10) : "",
      row.quotationNo || "",
      row.referenceNo || "",
      row.customerName || "",
      Number(row.grandTotal || 0),
      row.status || "",
    ]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `quotations_${from}_to_${to}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
