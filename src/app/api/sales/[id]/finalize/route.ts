import { NextRequest, NextResponse } from "next/server";
import { connectDB, runInTransaction } from "@/lib/db";
import { canWrite, requireSession } from "@/lib/rbac";
import { Sale, Product, Contact } from "@/models";
import { ensureSaleNumberIndexes, nextInvoiceNo, nextReferenceNo, nextSalesOrderNo } from "@/lib/doc-numbers";
import { ensureDeliveryChallan } from "@/lib/delivery-challan";
import { calcDueAmount, paymentStatusFromAmounts } from "@/lib/sale-finance";

type Ctx = { params: Promise<{ id: string }> };

/** Convert a quotation (or draft) into a sales order + invoice on the same Sale document. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await connectDB();
  await ensureSaleNumberIndexes();

  const existing = await Sale.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (existing.status === "final") {
    await ensureDeliveryChallan(existing);
    return NextResponse.json({
      data: existing,
      paymentStatus: paymentStatusFromAmounts(existing.grandTotal || 0, existing.paidAmount || 0),
    });
  }

  if (existing.status === "returned" || existing.status === "voided") {
    return NextResponse.json({ error: "cannot_finalize" }, { status: 400 });
  }

  if (existing.status === "proposal") {
    return NextResponse.json({ error: "need_quotation" }, { status: 400 });
  }

  const dueAmount = calcDueAmount(existing.grandTotal || 0, existing.paidAmount || 0);
  if (existing.customerId && dueAmount > 0) {
    const contact = await Contact.findById(existing.customerId).select("creditLimit balance");
    const limit = Number(contact?.creditLimit || 0);
    if (limit > 0 && Number(contact?.balance || 0) + dueAmount > limit) {
      return NextResponse.json(
        { error: "credit_limit", limit, balance: Number(contact?.balance || 0), due: dueAmount },
        { status: 400 },
      );
    }
  }

  if (existing.status === "quotation") {
    const converted = await Sale.findOne({
      sourceQuotationId: existing._id,
      status: "final",
    });
    if (converted) {
      await ensureDeliveryChallan(converted);
      return NextResponse.json({
        data: converted,
        paymentStatus: paymentStatusFromAmounts(
          converted.grandTotal || 0,
          converted.paidAmount || 0,
        ),
      });
    }
  }

  const referenceNo = existing.referenceNo || (await nextReferenceNo());
  const salesOrderNo = existing.salesOrderNo || (await nextSalesOrderNo());
  const invoiceNo = existing.invoiceNo || (await nextInvoiceNo());
  const cloneQuotation = existing.status === "quotation";

  try {
    const sale = await runInTransaction(async (mongoSession) => {
      if (cloneQuotation) {
        const payload = {
          invoiceNo,
          quotationNo: existing.quotationNo,
          salesOrderNo,
          referenceNo,
          poNo: existing.poNo,
          poDate: existing.poDate,
          pfNo: existing.pfNo,
          challanNo: existing.challanNo,
          binNo: existing.binNo,
          subject: existing.subject,
          documentBody: existing.documentBody,
          terms: existing.terms,
          status: "final" as const,
          locationId: existing.locationId,
          customerId: existing.customerId,
          customerName: existing.customerName,
          customerMobile: existing.customerMobile,
          customerAddress: existing.customerAddress,
          customerEmail: existing.customerEmail,
          items: existing.items,
          subtotal: existing.subtotal,
          discount: existing.discount,
          tax: existing.tax,
          shipping: existing.shipping,
          grandTotal: existing.grandTotal,
          paidAmount: existing.paidAmount,
          dueAmount: calcDueAmount(existing.grandTotal || 0, existing.paidAmount || 0),
          payments: existing.payments,
          note: existing.note,
          staffNote: existing.staffNote,
          soldBy: existing.soldBy,
          soldByName: existing.soldByName,
          saleDate: new Date(),
          sourceQuotationId: existing._id,
        };
        const created = mongoSession
          ? (await Sale.create([payload], { session: mongoSession }))[0]
          : await Sale.create(payload);
        if (created.locationId) {
          for (const it of created.items || []) {
            const deduct = Number(it.qty || 0) + Number(it.bonusQty || 0);
            if (!it.productId || deduct <= 0) continue;
            await Product.updateOne(
              { _id: it.productId, "stocks.locationId": created.locationId },
              { $inc: { "stocks.$.qty": -deduct } },
              mongoSession ? { session: mongoSession } : {},
            );
          }
        }
        if (created.customerId && created.dueAmount > 0) {
          await Contact.updateOne(
            { _id: created.customerId },
            { $inc: { balance: created.dueAmount } },
            mongoSession ? { session: mongoSession } : {},
          );
        }
        await ensureDeliveryChallan(created, mongoSession);
        return created;
      }

      const doc = mongoSession
        ? await Sale.findById(id).session(mongoSession)
        : await Sale.findById(id);
      if (!doc) throw new Error("not_found");

      doc.referenceNo = referenceNo;
      doc.salesOrderNo = salesOrderNo;
      doc.invoiceNo = invoiceNo;
      doc.status = "final";
      doc.dueAmount = calcDueAmount(doc.grandTotal || 0, doc.paidAmount || 0);
      await doc.save(mongoSession ? { session: mongoSession } : undefined);

      if (doc.locationId) {
        for (const it of doc.items || []) {
          const deduct = Number(it.qty || 0) + Number(it.bonusQty || 0);
          if (!it.productId || deduct <= 0) continue;
          await Product.updateOne(
            { _id: it.productId, "stocks.locationId": doc.locationId },
            { $inc: { "stocks.$.qty": -deduct } },
            mongoSession ? { session: mongoSession } : {},
          );
        }
      }
      if (doc.customerId && doc.dueAmount > 0) {
        await Contact.updateOne(
          { _id: doc.customerId },
          { $inc: { balance: doc.dueAmount } },
          mongoSession ? { session: mongoSession } : {},
        );
      }
      await ensureDeliveryChallan(doc, mongoSession);
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
