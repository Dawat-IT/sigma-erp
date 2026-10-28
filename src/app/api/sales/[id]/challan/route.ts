import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Sale, Business } from "@/models";
import { ensureDeliveryChallan } from "@/lib/delivery-challan";
import { buildTradePdf } from "@/lib/nes-trade-pdf";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") || "pdf";
  const headerFooter = new URL(req.url).searchParams.get("hf") !== "0";

  await connectDB();
  const sale = await Sale.findById(id).lean();
  const business = await Business.findOne().lean();
  if (!sale) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const challan = await ensureDeliveryChallan(sale);

  if (format === "json") {
    return NextResponse.json({
      data: challan,
      sale,
      business,
    });
  }

  const items = (challan.items?.length ? challan.items : sale.items) || [];
  const doc = await buildTradePdf({
    kind: "challan",
    sale,
    business,
    challanNo: challan.shipmentNo,
    challanItems: items,
    headerFooter,
  });
  const pdf = doc.output("arraybuffer");
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${challan.shipmentNo}.pdf"`,
    },
  });
}
