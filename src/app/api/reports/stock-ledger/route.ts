import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Product, Purchase, Sale, StockAdjustment } from "@/models";

type Movement = {
  date: string;
  productId: string;
  productName: string;
  inQty: number;
  outQty: number;
  inHand: number;
  unitCost: number;
  valuation: number;
  ref: string;
  type: string;
};

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const productFilter: Record<string, unknown> = { isActive: true };
  if (productId) productFilter._id = productId;

  const products = await Product.find(productFilter).limit(productId ? 1 : 200).lean();
  if (!products.length) {
    return NextResponse.json({ data: [], summary: [] });
  }

  const ids = products.map((p) => p._id);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const purchaseFilter: Record<string, unknown> = {
    "items.productId": { $in: ids },
  };
  const saleFilter: Record<string, unknown> = {
    status: { $in: ["final", "returned"] },
    "items.productId": { $in: ids },
  };
  const adjFilter: Record<string, unknown> = {
    "items.productId": { $in: ids },
  };

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    purchaseFilter.purchaseDate = range;
    saleFilter.saleDate = range;
    adjFilter.adjustmentDate = range;
  }

  const [purchases, sales, adjustments] = await Promise.all([
    Purchase.find(purchaseFilter).sort({ purchaseDate: 1 }).lean(),
    Sale.find(saleFilter).sort({ saleDate: 1 }).lean(),
    StockAdjustment.find(adjFilter).sort({ adjustmentDate: 1 }).lean(),
  ]);

  type Raw = {
    date: Date;
    productId: string;
    inQty: number;
    outQty: number;
    unitCost: number;
    ref: string;
    type: string;
  };

  const raws: Raw[] = [];

  for (const p of purchases) {
    for (const item of p.items || []) {
      const pid = String(item.productId || "");
      if (!byId.has(pid)) continue;
      raws.push({
        date: new Date(p.purchaseDate || p.createdAt),
        productId: pid,
        inQty: Number(item.qty || 0),
        outQty: 0,
        unitCost: Number(item.unitCost || byId.get(pid)?.purchasePrice || 0),
        ref: p.referenceNo || String(p._id),
        type: "purchase",
      });
    }
  }

  for (const s of sales) {
    for (const item of s.items || []) {
      const pid = String(item.productId || "");
      if (!byId.has(pid)) continue;
      const qty = Number(item.qty || 0);
      raws.push({
        date: new Date(s.saleDate || s.createdAt),
        productId: pid,
        inQty: 0,
        outQty: qty,
        unitCost: Number(byId.get(pid)?.purchasePrice || 0),
        ref: s.invoiceNo || String(s._id),
        type: "sale",
      });
    }
  }

  for (const a of adjustments) {
    for (const item of a.items || []) {
      const pid = String(item.productId || "");
      if (!byId.has(pid)) continue;
      const change = Number(item.qtyChange || 0);
      raws.push({
        date: new Date(a.adjustmentDate || a.createdAt),
        productId: pid,
        inQty: change > 0 ? change : 0,
        outQty: change < 0 ? Math.abs(change) : 0,
        unitCost: Number(byId.get(pid)?.purchasePrice || 0),
        ref: a.adjustmentNo || String(a._id),
        type: "adjustment",
      });
    }
  }

  raws.sort((a, b) => a.date.getTime() - b.date.getTime());

  const running = new Map<string, number>();
  // seed running from opening: current stock minus all movements after (approx: start 0 then apply)
  // Better: start from 0 and show chronological; summary uses final in-hand from product stocks
  const movements: Movement[] = [];

  for (const r of raws) {
    const prev = running.get(r.productId) || 0;
    const inHand = prev + r.inQty - r.outQty;
    running.set(r.productId, inHand);
    const p = byId.get(r.productId)!;
    const unitCost = r.unitCost || Number(p.purchasePrice || 0);
    movements.push({
      date: r.date.toISOString(),
      productId: r.productId,
      productName: p.nameBn || p.name,
      inQty: r.inQty,
      outQty: r.outQty,
      inHand,
      unitCost,
      valuation: inHand * unitCost,
      ref: r.ref,
      type: r.type,
    });
  }

  const summary = products.map((p) => {
    const pid = String(p._id);
    const stockQty = (p.stocks || []).reduce(
      (a: number, s: { qty?: number }) => a + (s.qty || 0),
      0,
    );
    const unitCost = Number(p.purchasePrice || 0);
    const ledgerHand = running.get(pid);
    return {
      productId: pid,
      productName: p.nameBn || p.name,
      inHand: ledgerHand != null ? ledgerHand : stockQty,
      stockQty,
      unitCost,
      valuation: (ledgerHand != null ? ledgerHand : stockQty) * unitCost,
      stockMethod: p.stockMethod || "",
    };
  });

  return NextResponse.json({ data: movements, summary });
}
