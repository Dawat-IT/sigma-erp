import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Product } from "@/models";
import { isSuperAdmin } from "@/lib/rbac";

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

  const rows = await Product.find({
    isActive: true,
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .lean();

  const showCost = isSuperAdmin(session.role);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products");
  ws.columns = [
    { header: "SL No", width: 8 },
    { header: "Product Name", width: 28 },
    { header: "SKU", width: 16 },
    { header: "Brand", width: 16 },
    { header: "Stock", width: 10 },
    { header: "Cost", width: 12 },
    { header: "Sales Price", width: 14 },
    { header: "Description", width: 30 },
    { header: "Created Date", width: 14 },
  ];
  rows.forEach((row, i) => {
    const stock = Array.isArray(row.stocks)
      ? row.stocks.reduce((a: number, s: { qty?: number }) => a + Number(s.qty || 0), 0)
      : Number(row.quantity || 0);
    ws.addRow([
      i + 1,
      row.name || "",
      row.sku || "",
      row.brand || "",
      stock,
      showCost ? Number(row.purchasePrice || 0) : "",
      Number(row.sellPrice || 0),
      row.description || "",
      row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "",
    ]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `products_${from}_to_${to}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
