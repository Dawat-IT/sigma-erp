import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite, requireSession } from "@/lib/rbac";
import { Sale, Business, Location, Shipment, Contact } from "@/models";
import { paymentStatusFromAmounts } from "@/lib/sale-finance";
import { nextProposalNo, nextQuotationNo, nextReferenceNo } from "@/lib/doc-numbers";
import { resolveDocumentSubject } from "@/lib/document-subject";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await connectDB();

  const sale = await Sale.findById(id);
  if (!sale) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (sale.status === "proposal" || sale.status === "quotation") {
    let changed = false;
    if (sale.status === "proposal" && !sale.proposalNo) {
      sale.proposalNo = await nextProposalNo();
      changed = true;
    }
    if (sale.status === "quotation") {
      if (!sale.quotationNo) {
        sale.quotationNo = await nextQuotationNo();
        changed = true;
      }
    }
    if (!sale.referenceNo) {
      sale.referenceNo = await nextReferenceNo();
      changed = true;
    }
    if (changed) await sale.save();
  }

  const [business, location, shipment] = await Promise.all([
    Business.findOne().lean(),
    sale.locationId ? Location.findById(sale.locationId).lean() : null,
    Shipment.findOne({ saleId: id }).lean(),
  ]);

  let previousDue = 0;
  let customerCompanyName = "";
  let customerContactPerson = "";

  if (sale.customerId) {
    const contact = await Contact.findById(sale.customerId).lean();
    if (contact) {
      customerCompanyName = contact.name || "";
      customerContactPerson = contact.contactPerson || "";

      const prevSales = await Sale.find({
        customerId: sale.customerId,
        _id: { $ne: sale._id },
        saleDate: { $lt: sale.saleDate },
        status: "final",
      })
        .select("dueAmount")
        .lean();

      const prevSalesDue = prevSales.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);
      previousDue = Number(contact.openingBalance || 0) + prevSalesDue;
    }
  }

  const saleObj = sale.toObject ? sale.toObject() : sale;
  saleObj.previousDue = previousDue;
  saleObj.customerCompanyName = customerCompanyName;
  saleObj.customerContactPerson = customerContactPerson;

  return NextResponse.json({
    data: saleObj,
    business,
    location,
    shipment,
    paymentStatus: paymentStatusFromAmounts(sale.grandTotal || 0, sale.paidAmount || 0),
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const body = await req.json();
  const existing = await Sale.findById(id).select("status").lean();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "voided") {
    return NextResponse.json({ error: "voided" }, { status: 400 });
  }

  const $set: Record<string, unknown> = {};
  for (const key of ["customerName", "note", "staffNote"]) {
    if (body[key] !== undefined) $set[key] = body[key];
  }
  if (body.status !== undefined) {
    const next = String(body.status);
    const alreadyClosed = existing.status === "final";
    if (!alreadyClosed && next !== "final" && session.role === "admin") {
      $set.status = next;
    }
  }
  if (existing.status === "quotation" || existing.status === "proposal") {
    for (const key of [
      "proposalNo",
      "quotationNo",
      "referenceNo",
      "customerMobile",
      "customerAddress",
      "customerEmail",
      "pfNo",
      "poNo",
      "challanNo",
      "binNo",
      "subject",
      "attention",
      "documentBody",
      "terms",
      "currency",
    ]) {
      if (body[key] !== undefined) $set[key] = body[key];
    }
    if (body.items !== undefined && Array.isArray(body.items)) {
      $set.items = body.items;
    }
    if ($set.subject != null) {
      $set.subject = resolveDocumentSubject({
        stored: String($set.subject),
        terms: body.terms,
        note: body.note,
        items: body.items || [],
      });
    }
    for (const key of [
      "subtotal",
      "discount",
      "tax",
      "shipping",
      "grandTotal",
      "paidAmount",
      "dueAmount",
    ]) {
      if (body[key] !== undefined) $set[key] = Number(body[key] || 0);
    }
    if (body.saleDate !== undefined) $set.saleDate = new Date(body.saleDate);
  }

  const updated = await Sale.findByIdAndUpdate(
    id,
    { $set },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, _ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  return NextResponse.json({ error: "void_only" }, { status: 403 });
}
