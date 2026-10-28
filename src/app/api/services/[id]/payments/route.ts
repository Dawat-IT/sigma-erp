import { NextRequest, NextResponse } from "next/server";
import { connectDB, runInTransaction } from "@/lib/db";
import { ServiceJob } from "@/models";
import { canWrite, requireSession } from "@/lib/rbac";
import { calcDueAmount } from "@/lib/sale-finance";
import { applyPaymentOnDoc, parsePaymentMethod, recordLedgerPayment } from "@/lib/payment-ledger";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  if (!canWrite(session.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  await connectDB();
  const body = await req.json();
  const method = parsePaymentMethod(body.method);
  const amount = Number(body.amount || 0);
  if (!method) return NextResponse.json({ error: "invalid_method" }, { status: 400 });
  if (!(amount > 0)) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });

  const existing = await ServiceJob.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const due = calcDueAmount(existing.grandTotal || 0, existing.paidAmount || 0);
  if (amount > due) return NextResponse.json({ error: "exceeds_due" }, { status: 400 });

  try {
    const job = await runInTransaction(async (mongoSession) => {
      const doc = mongoSession ? await ServiceJob.findById(id).session(mongoSession) : await ServiceJob.findById(id);
      if (!doc) throw new Error("not_found");
      applyPaymentOnDoc(doc, {
        method,
        amount,
        reference: body.reference ? String(body.reference) : undefined,
        note: body.note ? String(body.note) : undefined,
      });
      await doc.save(mongoSession ? { session: mongoSession } : undefined);
      await recordLedgerPayment({
        docType: "service",
        docId: doc._id,
        docNo: doc.jobNo,
        partyId: doc.customerId,
        partyName: String(doc.siteName || ""),
        method,
        amount,
        reference: body.reference ? String(body.reference) : undefined,
        note: body.note ? String(body.note) : undefined,
        createdBy: session.id,
      });
      return doc;
    });
    return NextResponse.json({ data: job });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
