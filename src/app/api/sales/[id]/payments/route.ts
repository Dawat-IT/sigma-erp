import { NextRequest, NextResponse } from "next/server";
import { connectDB, runInTransaction } from "@/lib/db";
import { Contact, Sale } from "@/models";
import { canWrite, requireSession } from "@/lib/rbac";
import { applyPaymentOnDoc, parsePaymentMethod, recordLedgerPayment } from "@/lib/payment-ledger";
import { calcDueAmount, paymentStatusFromAmounts } from "@/lib/sale-finance";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await connectDB();
  const body = await req.json();
  const amount = Number(body.amount || 0);
  const method = parsePaymentMethod(body.method);
  if (!method) {
    return NextResponse.json({ error: "invalid_method" }, { status: 400 });
  }
  if (!(amount > 0)) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const existing = await Sale.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const due = calcDueAmount(existing.grandTotal || 0, existing.paidAmount || 0);
  if (amount > due) {
    return NextResponse.json({ error: "exceeds_due" }, { status: 400 });
  }

  try {
    const sale = await runInTransaction(async (mongoSession) => {
      const doc = mongoSession
        ? await Sale.findById(id).session(mongoSession)
        : await Sale.findById(id);
      if (!doc) throw new Error("not_found");

      applyPaymentOnDoc(doc, {
        method,
        amount,
        reference: body.reference ? String(body.reference) : undefined,
        note: body.note ? String(body.note) : undefined,
      });
      await doc.save(mongoSession ? { session: mongoSession } : undefined);

      await recordLedgerPayment({
        docType: "sale",
        docId: doc._id,
        docNo: doc.invoiceNo || doc.quotationNo || doc.referenceNo,
        partyId: doc.customerId,
        partyName: doc.customerName,
        method,
        amount,
        reference: body.reference ? String(body.reference) : undefined,
        note: body.note ? String(body.note) : undefined,
        createdBy: session.id,
      });

      if (doc.customerId) {
        await Contact.updateOne(
          { _id: doc.customerId },
          { $inc: { balance: -amount } },
          mongoSession ? { session: mongoSession } : {},
        );
      }
      return doc;
    });

    return NextResponse.json({
      data: sale,
      paymentStatus: paymentStatusFromAmounts(sale.grandTotal || 0, sale.paidAmount || 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
