import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Sale, Business } from "@/models";
import { buildTradePdf } from "@/lib/nes-trade-pdf";
import { nextQuotationNo, nextReferenceNo } from "@/lib/doc-numbers";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const headerFooter = new URL(req.url).searchParams.get("hf") !== "0";
  await connectDB();
  const saleDoc = await Sale.findById(id);
  const business = await Business.findOne().lean();
  if (!saleDoc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (saleDoc.status === "quotation") {
    let changed = false;
    if (!saleDoc.quotationNo) {
      saleDoc.quotationNo = await nextQuotationNo();
      changed = true;
    }
    if (!saleDoc.referenceNo) {
      saleDoc.referenceNo = await nextReferenceNo();
      changed = true;
    }
    if (changed) await saleDoc.save();
  }

  const sale = saleDoc.toObject();
  const doc = await buildTradePdf({ kind: "quotation", sale, business, headerFooter });
  const pdf = doc.output("arraybuffer");
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sale.quotationNo || sale.referenceNo || "quotation"}.pdf"`,
    },
  });
}
