import type { ClientSession } from "mongoose";
import { Shipment } from "@/models";
import { nextChallanNo } from "@/lib/doc-numbers";

export type SaleLike = {
  _id: unknown;
  invoiceNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  challanNo?: string;
  customerName?: string;
  customerAddress?: string;
  saleDate?: Date | string;
  items?: Array<{
    productId?: unknown;
    name?: string;
    sku?: string;
    description?: string;
    imageUrl?: string;
    qty?: number;
    unit?: string;
  }>;
};

export function challanItemsFromSale(sale: SaleLike) {
  return (sale.items || []).map((it) => ({
    productId: it.productId,
    name: it.name || "",
    sku: it.sku || "",
    description: it.description || "",
    imageUrl: it.imageUrl || "",
    qty: Number(it.qty || 0),
    unit: it.unit || "Pcs",
  }));
}

function asPlainSale(sale: SaleLike): SaleLike {
  if (sale && typeof sale === "object" && "toJSON" in sale && typeof sale.toJSON === "function") {
    return sale.toJSON() as SaleLike;
  }
  return sale;
}

/** Reuse Shipment as the delivery challan linked to a Sale (sales order). */
export async function ensureDeliveryChallan(sale: SaleLike, mongoSession?: ClientSession) {
  const plain = asPlainSale(sale);
  const items = challanItemsFromSale(plain);
  const query = Shipment.findOne({ saleId: plain._id }).lean();
  if (mongoSession) query.session(mongoSession);
  const existing = await query;

  const extra = {
    invoiceNo: plain.invoiceNo,
    referenceNo: plain.referenceNo,
  };

  if (existing) {
    const $set: Record<string, unknown> = {};
    const existingItems = Array.isArray(existing.items) ? existing.items : [];
    const needsItems =
      existingItems.length === 0 ||
      existingItems.some(
        (it: { description?: string; imageUrl?: string }, i: number) =>
          (!it.description && !!items[i]?.description) || (!it.imageUrl && !!items[i]?.imageUrl),
      );
    if (needsItems && items.length) $set.items = items;
    if (!existing.invoiceNo && extra.invoiceNo) $set.invoiceNo = extra.invoiceNo;
    if (!existing.referenceNo && extra.referenceNo) $set.referenceNo = extra.referenceNo;
    if (Object.keys($set).length) {
      await Shipment.collection.updateOne({ _id: existing._id }, { $set });
      return { ...existing, ...$set };
    }
    return existing;
  }

  const payload = {
    shipmentNo: String(plain.challanNo || "").trim() || (await nextChallanNo()),
    saleId: plain._id,
    customerName: plain.customerName || "",
    status: "pending" as const,
    shippingAddress: plain.customerAddress || "",
    shippedDate: plain.saleDate ? new Date(plain.saleDate) : new Date(),
    invoiceNo: extra.invoiceNo,
    referenceNo: extra.referenceNo,
    items,
  };

  if (mongoSession) {
    const created = await Shipment.create([payload], { session: mongoSession });
    if (items.length) {
      await Shipment.collection.updateOne(
        { _id: created[0]._id },
        { $set: { items, invoiceNo: extra.invoiceNo, referenceNo: extra.referenceNo } },
      );
    }
    return { ...created[0].toObject(), items, ...extra };
  }

  const created = await Shipment.create(payload);
  if (items.length) {
    await Shipment.collection.updateOne(
      { _id: created._id },
      { $set: { items, invoiceNo: extra.invoiceNo, referenceNo: extra.referenceNo } },
    );
  }
  return { ...created.toObject(), items, ...extra };
}
