import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB, runInTransaction } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { Sale, Product, Contact } from "@/models";
import {
  DEFAULT_QUOTATION_TERMS,
  DEFAULT_PROPOSAL_TERMS,
  ensureSaleNumberIndexes,
  nextInvoiceNo,
  nextProposalNo,
  nextQuotationNo,
  nextReferenceNo,
  nextSalesOrderNo,
} from "@/lib/doc-numbers";
import { calcDueAmount, roundMoney } from "@/lib/sale-finance";
import { ensureDeliveryChallan } from "@/lib/delivery-challan";
import { DEFAULT_DOCUMENT_BODY, DEFAULT_PROPOSAL_BODY } from "@/lib/default-document-body";
import { resolveDocumentSubject } from "@/lib/document-subject";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await connectDB();
    await ensureSaleNumberIndexes();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const locationId = searchParams.get("locationId");
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(200, Number(searchParams.get("limit") || 50));

    const filter: Record<string, unknown> = {};
    if (from || to) {
      filter.saleDate = {};
      if (from) (filter.saleDate as Record<string, Date>).$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (filter.saleDate as Record<string, Date>).$lte = end;
      }
    }
    if (locationId) filter.locationId = locationId;
    if (customerId) filter.customerId = customerId;
    const includeVoided =
      searchParams.get("includeVoided") === "1" &&
      (session.role === "admin" || session.role === "manager");
    if (status && status !== "voided") filter.status = status;
    else if (status === "voided" && includeVoided) filter.status = "voided";
    else if (!includeVoided) filter.status = { $ne: "voided" };
    if (paymentMethod) filter["payments.method"] = paymentMethod;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { invoiceNo: rx },
        { proposalNo: rx },
        { quotationNo: rx },
        { salesOrderNo: rx },
        { referenceNo: rx },
        { customerName: rx },
        { customerMobile: rx },
        { challanNo: rx },
        { pfNo: rx },
        { poNo: rx },
        { "items.name": rx },
        { "items.description": rx },
        { "payments.reference": rx },
      ];
    }
    const quotationNo = searchParams.get("quotationNo")?.trim();
    if (quotationNo) filter.quotationNo = quotationNo.toUpperCase();
    const proposalNo = searchParams.get("proposalNo")?.trim();
    if (proposalNo) filter.proposalNo = proposalNo.toUpperCase();

    const [data, total, aggregates] = await Promise.all([
      Sale.find(filter)
        .sort({ saleDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
      Sale.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            grandTotal: { $sum: "$grandTotal" },
            paidAmount: { $sum: "$paidAmount" },
            dueAmount: { $sum: "$dueAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      summary: aggregates[0] || { grandTotal: 0, paidAmount: 0, dueAmount: 0, count: 0 },
    });
  } catch (err) {
    console.error("GET /api/sales", err);
    return NextResponse.json(
      { error: "failed", data: null, summary: null },
      { status: 500 },
    );
  }
}

function saleProductId(id: unknown) {
  const s = String(id || "").trim();
  if (!s || !Types.ObjectId.isValid(s)) return undefined;
  try {
    if (new Types.ObjectId(s).toString() !== s) return undefined;
  } catch {
    return undefined;
  }
  return s;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  await ensureSaleNumberIndexes();
  const body = await req.json();
  const status = body.status || "final";

  const items = (body.items || []).map(
    (it: {
      productId: string;
      name: string;
      sku?: string;
      unit?: string;
      description?: string;
      imageUrl?: string;
      qty: number;
      bonusQty?: number;
      unitPrice: number;
      discount?: number;
      taxPercent?: number;
    }) => {
      const qty = Math.max(0, Number(it.qty));
      const unitPrice = roundMoney(it.unitPrice);
      const discount = roundMoney(it.discount || 0);
      const taxPercent = Number(it.taxPercent || 0);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
      const base = safeQty * unitPrice - discount;
      const lineTotal = roundMoney(base + (base * taxPercent) / 100);
      return {
        productId: saleProductId(it.productId),
        name: String(it.name || "").trim() || it.sku || "Item",
        sku: it.sku,
        unit: it.unit || "Pcs",
        description: it.description != null ? String(it.description) : "",
        imageUrl: it.imageUrl ? String(it.imageUrl) : "",
        qty: safeQty,
        bonusQty: Number(it.bonusQty || 0),
        unitPrice,
        discount,
        taxPercent,
        lineTotal,
      };
    },
  ).filter((it: { qty: number }) => it.qty > 0);

  if (!items.length) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }

  const missingImages = items.filter((it: { productId?: string; imageUrl?: string }) => it.productId && !it.imageUrl);
  if (missingImages.length) {
    const masters = await Product.find({
      _id: { $in: missingImages.map((it: { productId: string }) => it.productId) },
    })
      .select("imageUrl")
      .lean();
    const byId = new Map(masters.map((p) => [String(p._id), p.imageUrl || ""]));
    for (const it of items) {
      if (!it.imageUrl) it.imageUrl = byId.get(String(it.productId)) || "";
    }
  }

  const subtotal = roundMoney(
    items.reduce(
      (a: number, i: { qty: number; unitPrice: number }) => a + i.qty * i.unitPrice,
      0,
    ),
  );
  const discount = roundMoney(body.discount || 0);
  const tax = roundMoney(body.tax || 0);
  const shipping = roundMoney(body.shipping || 0);
  const grandTotal = roundMoney(subtotal - discount + tax + shipping);
  const payments = (body.payments || []).filter(
    (p: { amount?: number }) => Number(p.amount || 0) > 0,
  );
  const paidAmount = roundMoney(
    payments.reduce((a: number, p: { amount: number; method?: string }) => {
      if (p.method === "credit") return a;
      return a + Number(p.amount || 0);
    }, 0),
  );
  if (paidAmount - grandTotal > 0.009) {
    return NextResponse.json({ error: "overpayment" }, { status: 400 });
  }
  const dueAmount = calcDueAmount(grandTotal, paidAmount);

  let referenceNo: string;
  let quotationNo: string | undefined;
  let proposalNo: string | undefined;
  let sourceQuotationId = body.sourceQuotationId || undefined;
  let sourceProposalId = body.sourceProposalId || undefined;
  if (sourceQuotationId) {
    const source = await Sale.findById(sourceQuotationId).lean();
    if (!source || source.status !== "quotation") {
      return NextResponse.json({ error: "quotation_not_found" }, { status: 404 });
    }
    quotationNo = source.quotationNo;
    proposalNo = source.proposalNo;
    referenceNo = source.referenceNo || (await nextReferenceNo());
  } else if (sourceProposalId) {
    const source = await Sale.findById(sourceProposalId).lean();
    if (!source || source.status !== "proposal") {
      return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });
    }
    proposalNo = source.proposalNo;
    referenceNo = source.referenceNo || (await nextReferenceNo());
    quotationNo =
      status === "quotation"
        ? String(body.quotationNo || "").trim() || (await nextQuotationNo())
        : undefined;
  } else if (status === "proposal") {
    proposalNo = String(body.proposalNo || "").trim() || (await nextProposalNo());
    referenceNo = String(body.referenceNo || "").trim() || (await nextReferenceNo());
  } else if (status === "quotation") {
    quotationNo = String(body.quotationNo || "").trim() || (await nextQuotationNo());
    referenceNo = String(body.referenceNo || "").trim() || (await nextReferenceNo());
  } else {
    referenceNo = await nextReferenceNo();
    quotationNo = undefined;
  }
  const salesOrderNo =
    status === "final" ? body.salesOrderNo || (await nextSalesOrderNo()) : body.salesOrderNo || undefined;
  const invoiceNo =
    status === "final" ? body.invoiceNo || (await nextInvoiceNo()) : body.invoiceNo || undefined;

  let customerName = body.customerName || "Walk-in Customer";
  let customerMobile = body.customerMobile || "";
  let customerAddress = body.customerAddress || "";
  let customerEmail = body.customerEmail || "";
  let binNo = body.binNo || "";
  if (body.customerId) {
    const contact = await Contact.findById(body.customerId).lean();
    if (contact) {
      customerName = body.customerName || contact.name || customerName;
      customerMobile = body.customerMobile || contact.mobile || "";
      customerAddress = body.customerAddress || contact.address || "";
      customerEmail = body.customerEmail || contact.email || "";
      binNo = body.binNo || contact.bin || "";
    }
  }

  const payload: Record<string, unknown> = {
    referenceNo,
    poNo: body.poNo || body.pfNo,
    pfNo: body.pfNo || body.poNo,
    challanNo: body.challanNo,
    binNo,
    customerEmail,
    poDate: body.poDate ? new Date(body.poDate) : undefined,
    subject: resolveDocumentSubject({
      stored: body.subject,
      terms: body.terms,
      note: body.note,
      items,
    }),
    attention: body.attention != null ? String(body.attention) : "",
    documentBody:
      body.documentBody != null
        ? String(body.documentBody)
        : status === "proposal"
          ? DEFAULT_PROPOSAL_BODY
          : DEFAULT_DOCUMENT_BODY,
    terms:
      status === "proposal"
        ? (body.terms ?? DEFAULT_PROPOSAL_TERMS)
        : status === "quotation"
          ? (body.terms ?? DEFAULT_QUOTATION_TERMS)
          : body.terms,
    status,
    currency: body.currency ? String(body.currency).toUpperCase() : (status === "quotation" ? "USD" : "BDT"),
    locationId: body.locationId,
    customerId: body.customerId || undefined,
    customerName,
    customerMobile,
    customerAddress,
    items,
    subtotal,
    discount,
    tax,
    shipping,
    grandTotal,
    paidAmount,
    dueAmount,
    payments,
    note: body.note,
    staffNote: body.staffNote,
    soldBy: session.id,
    soldByName: session.name,
    saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
    sourceQuotationId,
    sourceProposalId,
  };
  if (invoiceNo) payload.invoiceNo = invoiceNo;
  if (quotationNo) payload.quotationNo = quotationNo;
  if (proposalNo) payload.proposalNo = proposalNo;
  if (salesOrderNo) payload.salesOrderNo = salesOrderNo;

  try {
    const created = await runInTransaction(async (mongoSession) => {
      const sale = mongoSession
        ? (await Sale.create([payload], { session: mongoSession }))[0]
        : await Sale.create(payload);

      if (status === "final") {
        if (body.locationId) {
          for (const it of items) {
            if (!it.productId) continue;
            const deduct = it.qty + (it.bonusQty || 0);
            if (deduct <= 0) continue;
            await Product.updateOne(
              { _id: it.productId, "stocks.locationId": body.locationId },
              { $inc: { "stocks.$.qty": -deduct } },
              mongoSession ? { session: mongoSession } : {},
            );
          }
        }
        if (body.customerId && dueAmount > 0) {
          await Contact.updateOne(
            { _id: body.customerId },
            { $inc: { balance: dueAmount } },
            mongoSession ? { session: mongoSession } : {},
          );
        }
        await ensureDeliveryChallan(sale, mongoSession);
      }

      return sale;
    });

    if ((status === "proposal" || status === "quotation") && created?._id) {
      const extra: Record<string, unknown> = {};
      if (proposalNo) extra.proposalNo = proposalNo;
      if (quotationNo) extra.quotationNo = quotationNo;
      if (Object.keys(extra).length) {
        await Sale.collection.updateOne({ _id: created._id }, { $set: extra });
      }
    }

    return NextResponse.json(
      { data: { ...(created.toObject?.() || created), ...((proposalNo && { proposalNo }) || {}), ...((quotationNo && { quotationNo }) || {}) } },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
