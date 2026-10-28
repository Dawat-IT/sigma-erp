import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Purchase, Product, Contact, Business, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import mongoose from "mongoose";
import { isSuperAdmin, requireWrite } from "@/lib/rbac";

function moneyCurrency(value: unknown, fallback = "BDT") {
  const c = String(value || "");
  return ["BDT", "USD", "RMB"].includes(c) ? c : fallback;
}

function redactCostPrice<T extends Record<string, unknown>>(doc: T, role: string): T {
  if (isSuperAdmin(role)) return doc;
  const next = { ...doc };
  delete next.costPrice;
  return next;
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const locationId = searchParams.get("locationId");
  const supplierId = searchParams.get("supplierId");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Number(searchParams.get("limit") || 50));

  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.purchaseDate = {};
    if (from) (filter.purchaseDate as Record<string, Date>).$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      (filter.purchaseDate as Record<string, Date>).$lte = end;
    }
  }
  if (locationId) filter.locationId = locationId;
  if (supplierId) filter.supplierId = supplierId;
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [
      { referenceNo: rx },
      { supplierName: rx },
      { productName: rx },
      { "items.name": rx },
    ];
  }

  const [data, total, summary] = await Promise.all([
    Purchase.find(filter).sort({ purchaseDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Purchase.countDocuments(filter),
    Purchase.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          grandTotal: { $sum: "$grandTotal" },
          dueAmount: { $sum: "$dueAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    data: (data as Record<string, unknown>[]).map((row) => redactCostPrice(row, session.role)),
    total,
    page,
    limit,
    summary: summary[0] || { grandTotal: 0, dueAmount: 0, count: 0 },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const body = await req.json();
  const business = await Business.findOne();
  const seq = await nextSeq("purchase");
  const referenceNo = generateDocNo(business?.purchasePrefix || "PUR", seq);

  const qty = Number(body.quantity ?? body.items?.[0]?.qty ?? 0);
  const unitCost = Number(body.buyingPrice ?? body.items?.[0]?.unitCost ?? 0);
  let items = (body.items || []).map(
    (it: {
      productId: string;
      name: string;
      sku?: string;
      qty: number;
      unitCost: number;
      batchNo?: string;
      expiryDate?: string;
    }) => ({
      productId: it.productId,
      name: it.name,
      sku: it.sku,
      qty: Number(it.qty),
      unitCost: Number(it.unitCost),
      lineTotal: Number(it.qty) * Number(it.unitCost),
      batchNo: it.batchNo,
      expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
    }),
  );
  if (!items.length) {
    items = [
      {
        productId: body.productId || undefined,
        name: String(body.productName || "Item"),
        sku: body.sku,
        qty,
        unitCost,
        lineTotal: qty * unitCost,
      },
    ];
  }

  const subtotal = items.reduce((a: number, i: { lineTotal: number }) => a + i.lineTotal, 0);
  const discount = Number(body.discount || 0);
  const tax = Number(body.tax || 0);
  const shippingCost = Number(body.shippingCost || 0);
  const otherCost = Number(body.otherCost || 0);
  const grandTotal = subtotal + shippingCost + otherCost - discount + tax;
  const payments = body.payments || [];
  const paidAmount =
    payments.length > 0
      ? payments.reduce((a: number, p: { amount: number }) => a + Number(p.amount || 0), 0)
      : Number(body.paidAmount || 0);
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const paymentMethod = String(body.paymentMethod || payments[0]?.method || "cash");
  const paymentStatus =
    dueAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Due";

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  try {
    const purchase = await Purchase.create(
      [
        {
          referenceNo,
          status: body.status || "received",
          locationId: body.locationId,
          purchaseType: body.purchaseType === "import" ? "import" : "local",
          supplierId: body.supplierId,
          supplierName: body.supplierName,
          supplierWhatsapp: body.supplierWhatsapp,
          supplierWechat: body.supplierWechat,
          supplierAddress: body.supplierAddress,
          supplierMobile: body.supplierMobile,
          supplierLocation: body.supplierLocation,
          productName: body.productName,
          productDescription: body.productDescription,
          categoryId: body.categoryId || undefined,
          brand: body.brand,
          quantity: qty,
          buyingPrice: unitCost,
          shippingCurrency: moneyCurrency(body.shippingCurrency),
          costPrice: isSuperAdmin(session.role) ? Number(body.costPrice || 0) : 0,
          paymentMethod,
          paymentStatus,
          items,
          subtotal,
          discount,
          tax,
          shippingCost,
          otherCost,
          currency: moneyCurrency(body.currency),
          grandTotal,
          paidAmount,
          dueAmount,
          payments:
            payments.length > 0
              ? payments
              : paidAmount > 0
                ? [{ method: paymentMethod, amount: paidAmount }]
                : [],
          note: body.note,
          receivingDate: body.receivingDate ? new Date(body.receivingDate) : undefined,
          documentName: body.documentName,
          documentUrl: body.documentUrl,
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
          createdBy: session.id,
        },
      ],
      { session: mongoSession },
    );

    if ((body.status || "received") === "received" && body.locationId) {
      for (const it of items) {
        if (!it.productId) continue;
        const product = await Product.findById(it.productId).session(mongoSession);
        if (!product) continue;
        const idx = product.stocks.findIndex(
          (s: { locationId?: unknown }) => String(s.locationId) === String(body.locationId),
        );
        if (idx >= 0) {
          product.stocks[idx].qty += it.qty;
          if (it.batchNo) product.stocks[idx].batchNo = it.batchNo;
          if (it.expiryDate) product.stocks[idx].expiryDate = it.expiryDate;
        } else {
          product.stocks.push({
            locationId: body.locationId,
            qty: it.qty,
            batchNo: it.batchNo,
            expiryDate: it.expiryDate,
          });
        }
        product.purchasePrice = it.unitCost;
        await product.save({ session: mongoSession });
      }
      if (body.supplierId && dueAmount > 0) {
        await Contact.updateOne(
          { _id: body.supplierId },
          { $inc: { balance: dueAmount } },
          { session: mongoSession },
        );
      }
    }

    await mongoSession.commitTransaction();
    const created = purchase[0]?.toObject?.() ?? purchase[0];
    return NextResponse.json(
      { data: redactCostPrice(created as Record<string, unknown>, session.role) },
      { status: 201 },
    );
  } catch (e) {
    await mongoSession.abortTransaction();
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  } finally {
    mongoSession.endSession();
  }
}
