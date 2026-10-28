import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Purchase } from "@/models";
import { isSuperAdmin, requireDelete, requireWrite } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

function moneyCurrency(value: unknown) {
  const c = String(value || "");
  return ["BDT", "USD", "RMB"].includes(c) ? c : null;
}

function redactCostPrice<T extends Record<string, unknown>>(doc: T, role: string): T {
  if (isSuperAdmin(role)) return doc;
  const next = { ...doc };
  delete next.costPrice;
  return next;
}

function paymentStatusOf(grandTotal: number, paidAmount: number) {
  const due = Math.max(0, grandTotal - paidAmount);
  if (due <= 0) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Due";
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await connectDB();
  const doc = await Purchase.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    data: redactCostPrice(doc as Record<string, unknown>, session.role),
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const body = await req.json();
  const existing = await Purchase.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const set: Record<string, unknown> = {};
  const textFields = [
    "referenceNo",
    "supplierName",
    "supplierWhatsapp",
    "supplierWechat",
    "supplierAddress",
    "supplierMobile",
    "supplierLocation",
    "productName",
    "productDescription",
    "brand",
    "note",
    "purchaseType",
    "documentName",
    "documentUrl",
    "status",
    "paymentMethod",
  ];
  for (const key of textFields) {
    if (body[key] !== undefined) set[key] = body[key];
  }
  if (body.categoryId !== undefined) set.categoryId = body.categoryId || undefined;
  const currency = moneyCurrency(body.currency);
  if (currency) set.currency = currency;
  const shippingCurrency = moneyCurrency(body.shippingCurrency);
  if (shippingCurrency) set.shippingCurrency = shippingCurrency;

  const numberFields = ["discount", "tax", "shippingCost", "otherCost", "quantity", "buyingPrice"];
  for (const key of numberFields) {
    if (body[key] !== undefined) set[key] = Number(body[key] || 0);
  }
  if (isSuperAdmin(session.role) && body.costPrice !== undefined) {
    set.costPrice = Number(body.costPrice || 0);
  }
  if (body.purchaseDate !== undefined) {
    set.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : undefined;
  }
  if (body.receivingDate !== undefined) {
    set.receivingDate = body.receivingDate ? new Date(body.receivingDate) : undefined;
  }

  const qty = Number(set.quantity ?? existing.quantity ?? existing.items?.[0]?.qty ?? 0);
  const unitCost = Number(set.buyingPrice ?? existing.buyingPrice ?? existing.items?.[0]?.unitCost ?? 0);
  const subtotal = qty * unitCost;
  const shippingCost = Number(set.shippingCost ?? existing.shippingCost ?? 0);
  const otherCost = Number(set.otherCost ?? existing.otherCost ?? 0);
  const discount = Number(set.discount ?? existing.discount ?? 0);
  const tax = Number(existing.tax || 0);
  const grandTotal = subtotal + shippingCost + otherCost - discount + tax;
  const paidAmount =
    body.paidAmount !== undefined ? Number(body.paidAmount || 0) : Number(existing.paidAmount || 0);
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const method = String(set.paymentMethod ?? existing.paymentMethod ?? "cash");
  set.subtotal = subtotal;
  set.grandTotal = grandTotal;
  set.paidAmount = paidAmount;
  set.dueAmount = dueAmount;
  set.paymentStatus = paymentStatusOf(grandTotal, paidAmount);
  set.payments = paidAmount > 0 ? [{ method, amount: paidAmount }] : [];
  if (body.productName !== undefined || body.quantity !== undefined || body.buyingPrice !== undefined) {
    const first = existing.items?.[0] || {};
    set.items = [
      {
        productId: first.productId,
        name: String(set.productName ?? existing.productName ?? first.name ?? "Item"),
        sku: first.sku,
        qty,
        unitCost,
        lineTotal: subtotal,
      },
    ];
  }

  const updated = await Purchase.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    data: redactCostPrice(updated as Record<string, unknown>, session.role),
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const deleted = await Purchase.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
