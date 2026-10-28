import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Contact, Product, ProductSupplier, Purchase } from "@/models";
import {
  ensureSupplierFullData,
  isGenericSupplierLabel,
  propagateSupplierIdentity,
  refreshProductEmbeddedOffers,
} from "@/lib/product-suppliers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await connectDB();

  // Make sure this supplier has product links + purchase rows in DB
  await ensureSupplierFullData(id);

  const supplier = await Contact.findById(id).lean();
  if (!supplier || (supplier.type !== "supplier" && supplier.type !== "both")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const links = await ProductSupplier.find({ supplierId: id, isActive: true })
    .sort({ updatedAt: -1 })
    .lean();

  const productIds = links.map((l) => l.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const offeredProducts = links
    .map((link) => {
      const p = productMap.get(String(link.productId));
      if (!p) return null;
      return {
        linkId: String(link._id),
        productId: String(p._id),
        name: p.name,
        nameBn: p.nameBn,
        sku: p.sku,
        offerPrice: Number(link.price || 0),
      };
    })
    .filter(Boolean);

  const purchases = await Purchase.find({ supplierId: id })
    .sort({ purchaseDate: -1 })
    .limit(200)
    .lean();

  const lines = purchases.flatMap((purchase) =>
    (purchase.items || []).map(
      (item: {
        productId?: unknown;
        name?: string;
        sku?: string;
        qty?: number;
        unitCost?: number;
        lineTotal?: number;
      }) => ({
      purchaseId: String(purchase._id),
      referenceNo: purchase.referenceNo,
      purchaseDate: purchase.purchaseDate,
      status: purchase.status,
      productId: item.productId ? String(item.productId) : "",
      productName: item.name || "",
      sku: item.sku || "",
      qty: item.qty || 0,
      unitCost: item.unitCost || 0,
      lineTotal: item.lineTotal || (item.qty || 0) * (item.unitCost || 0),
    })),
  );

  const totalQty = lines.reduce((a, l) => a + l.qty, 0);
  const totalAmount = lines.reduce((a, l) => a + l.lineTotal, 0);

  return NextResponse.json({
    data: {
      supplier,
      lines,
      offeredProducts,
      summary: {
        purchaseCount: purchases.length,
        lineCount: lines.length,
        totalQty,
        totalAmount,
        dueAmount: purchases.reduce((a, p) => a + (p.dueAmount || 0), 0),
        productCount: offeredProducts.length,
        balance: Number(supplier.balance || 0),
      },
    },
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await connectDB();

  const body = await req.json();

  if (body.supplier) {
    const s = body.supplier;
    const name = String(s.supplierName || s.name || "").trim();
    const mobile = String(s.supplierContact || s.mobile || "").trim();
    const email = String(s.supplierEmail || s.email || "").trim();
    if (!name || !mobile) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    const openingBalance =
      s.openingBalance != null ? Number(s.openingBalance) : undefined;
    const $set: Record<string, unknown> = {
      name,
      mobile,
      email,
      supplierName: name,
      supplierContact: mobile,
      supplierEmail: email,
    };
    if (s.nameBn !== undefined) {
      let nameBn = String(s.nameBn || "").trim();
      if (!nameBn || isGenericSupplierLabel(nameBn)) {
        nameBn = name;
      }
      $set.nameBn = nameBn;
    }
    if (s.address !== undefined) $set.address = String(s.address || "").trim();
    if (s.location !== undefined) $set.location = String(s.location || "").trim();
    if (s.supplierWhatsApp !== undefined) $set.supplierWhatsApp = String(s.supplierWhatsApp || "").trim();
    if (s.supplierWeChat !== undefined) $set.supplierWeChat = String(s.supplierWeChat || "").trim();
    if (s.supplierCurrencyName !== undefined) {
      $set.supplierCurrencyName = String(s.supplierCurrencyName || "").trim();
    }
    if (openingBalance != null && Number.isFinite(openingBalance)) {
      const existing = await Contact.findById(id).lean();
      if (existing) {
        const oldOpening = Number(existing.openingBalance || 0);
        const oldBalance = Number(existing.balance || 0);
        $set.openingBalance = openingBalance;
        $set.balance = oldBalance - oldOpening + openingBalance;
      }
    }
    await Contact.findByIdAndUpdate(id, { $set });
    await propagateSupplierIdentity(id);
  }

  if (Array.isArray(body.offerUpdates)) {
    for (const row of body.offerUpdates as {
      linkId?: string;
      productId?: string;
      price?: number;
    }[]) {
      const price = Number(row.price || 0);
      if (row.linkId) {
        const link = await ProductSupplier.findOneAndUpdate(
          { _id: row.linkId, supplierId: id },
          { $set: { price, isActive: true } },
          { new: true },
        );
        if (link) await refreshProductEmbeddedOffers(link.productId);
      } else if (row.productId) {
        await ProductSupplier.findOneAndUpdate(
          { productId: row.productId, supplierId: id },
          { $set: { price, isActive: true } },
          { upsert: true },
        );
        await refreshProductEmbeddedOffers(row.productId);
      }
    }
  }

  if (body.addOffer?.productId) {
    await ProductSupplier.findOneAndUpdate(
      { productId: body.addOffer.productId, supplierId: id },
      {
        $set: {
          price: Number(body.addOffer.price || 0),
          isActive: true,
        },
      },
      { upsert: true },
    );
    await refreshProductEmbeddedOffers(body.addOffer.productId);
  }

  if (body.removeLinkId) {
    const link = await ProductSupplier.findOneAndUpdate(
      { _id: body.removeLinkId, supplierId: id },
      { $set: { isActive: false } },
      { new: true },
    );
    if (link) await refreshProductEmbeddedOffers(link.productId);
  }

  return NextResponse.json({ ok: true });
}
