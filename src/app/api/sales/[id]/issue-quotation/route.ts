import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { canWrite, requireSession } from "@/lib/rbac";
import { Sale } from "@/models";
import {
  DEFAULT_QUOTATION_TERMS,
  nextQuotationNo,
  nextReferenceNo,
} from "@/lib/doc-numbers";

type Ctx = { params: Promise<{ id: string }> };

/** Turn a proposal (or draft) into a priced quotation on the same document. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await connectDB();

  const existing = await Sale.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (existing.status === "quotation") {
    return NextResponse.json({ data: existing });
  }

  if (existing.status === "final" || existing.status === "returned" || existing.status === "voided") {
    return NextResponse.json({ error: "cannot_issue_quotation" }, { status: 400 });
  }

  if (existing.status !== "proposal" && existing.status !== "draft") {
    return NextResponse.json({ error: "cannot_issue_quotation" }, { status: 400 });
  }

  const quotationNo = existing.quotationNo || (await nextQuotationNo());
  const referenceNo = existing.referenceNo || (await nextReferenceNo());
  const currentTerms = String(existing.terms || "").trim();
  const proposalDefault = /not a confirmed order/i.test(currentTerms);
  const terms = !currentTerms || proposalDefault ? DEFAULT_QUOTATION_TERMS : currentTerms;

  await Sale.collection.updateOne(
    { _id: existing._id },
    {
      $set: {
        status: "quotation",
        quotationNo,
        referenceNo,
        terms,
        pfNo: existing.pfNo || quotationNo,
      },
    },
  );

  existing.status = "quotation";
  existing.quotationNo = quotationNo;
  existing.referenceNo = referenceNo;
  existing.terms = terms;
  try {
    await existing.save();
  } catch {
    /* collection $set already persisted */
  }

  const fresh = await Sale.findById(id).lean();
  return NextResponse.json({
    data: { ...(fresh || existing.toObject()), quotationNo, status: "quotation" },
  });
}
