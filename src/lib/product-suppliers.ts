import { Contact, Product, ProductSupplier, Purchase } from "@/models";
import { isGenericSupplierLabel } from "@/lib/supplier-label";

export { isGenericSupplierLabel, displaySupplierLabel } from "@/lib/supplier-label";

/** Sync embedded product.supplierOffers → ProductSupplier (migration / backfill) */
export async function syncProductSupplierLinks() {
  const products = await Product.find({ isActive: true })
    .select("_id purchasePrice supplierOffers")
    .lean();

  const suppliers = await Contact.find({
    type: { $in: ["supplier", "both"] },
    isActive: true,
  })
    .select("_id name nameBn")
    .lean();
  const byName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s]));
  const byNameBn = new Map(
    suppliers.filter((s) => s.nameBn).map((s) => [String(s.nameBn).toLowerCase(), s]),
  );

  let created = 0;
  for (const p of products) {
    for (const offer of p.supplierOffers || []) {
      let supplierId = offer.supplierId ? String(offer.supplierId) : "";
      if (!supplierId && offer.name) {
        const hit =
          byName.get(String(offer.name).toLowerCase()) ||
          byNameBn.get(String(offer.nameBn || offer.name).toLowerCase());
        if (hit) supplierId = String(hit._id);
      }
      if (!supplierId) continue;

      const price = Number(offer.price || p.purchasePrice || 0);
      const res = await ProductSupplier.updateOne(
        { productId: p._id, supplierId },
        {
          $set: { price, isActive: true },
          $setOnInsert: { productId: p._id, supplierId },
        },
        { upsert: true },
      );
      if (res.upsertedCount) created += 1;
    }
  }
  return { created };
}

/** Heal placeholder Bangla names after rename (e.g. Supplier 1 → alamin) */
export async function healSupplierLabels() {
  const rows = await Contact.find({
    type: { $in: ["supplier", "both"] },
    isActive: true,
  })
    .select("_id name nameBn")
    .lean();

  let fixed = 0;
  for (const s of rows) {
    if (s.name && !isGenericSupplierLabel(s.name) && isGenericSupplierLabel(s.nameBn)) {
      await Contact.findByIdAndUpdate(s._id, { $set: { nameBn: s.name } });
      fixed += 1;
    }
  }
  return { fixed };
}

/** Rewrite product.supplierOffers cache from ProductSupplier + Contact */
export async function refreshProductEmbeddedOffers(productId: unknown) {
  const links = await ProductSupplier.find({ productId, isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  const supplierIds = links.map((l) => l.supplierId);
  const suppliers = await Contact.find({ _id: { $in: supplierIds } })
    .select("name nameBn")
    .lean();
  const map = new Map(suppliers.map((s) => [String(s._id), s]));

  const supplierOffers = links.map((link) => {
    const s = map.get(String(link.supplierId));
    return {
      supplierId: link.supplierId,
      name: s?.name || "Supplier",
      nameBn: s?.nameBn || s?.name,
      price: Number(link.price || 0),
    };
  });

  await Product.findByIdAndUpdate(productId, { $set: { supplierOffers } });
  return supplierOffers;
}

/** Push renamed supplier into product cache + purchases */
export async function propagateSupplierIdentity(supplierId: string) {
  const supplier = await Contact.findById(supplierId).lean();
  if (!supplier) return { products: 0, purchases: 0 };

  const links = await ProductSupplier.find({ supplierId, isActive: true })
    .select("productId")
    .lean();

  const productIds = [...new Set(links.map((l) => String(l.productId)))];
  for (const productId of productIds) {
    await refreshProductEmbeddedOffers(productId);
  }

  // Refresh products that still embed this supplierId (edge cases)
  const embedded = await Product.find({ "supplierOffers.supplierId": supplierId })
    .select("_id")
    .lean();
  for (const p of embedded) {
    if (!productIds.includes(String(p._id))) {
      await refreshProductEmbeddedOffers(p._id);
    }
  }

  const purchases = (
    await Purchase.updateMany(
      { supplierId },
      { $set: { supplierName: supplier.name } },
    )
  ).modifiedCount;

  return { products: productIds.length, purchases };
}

/** Soft-deactivate all product↔supplier links for a product */
export async function deactivateProductLinks(productId: string) {
  return ProductSupplier.updateMany(
    { productId, isActive: true },
    { $set: { isActive: false } },
  );
}

/** Soft-deactivate all product↔supplier links for a supplier */
export async function deactivateSupplierLinks(supplierId: string) {
  const res = await ProductSupplier.updateMany(
    { supplierId, isActive: true },
    { $set: { isActive: false } },
  );

  // Clear embed cache on affected products
  const products = await Product.find({
    "supplierOffers.supplierId": supplierId,
  }).select("_id");
  for (const p of products) {
    await refreshProductEmbeddedOffers(p._id);
  }

  return res;
}

/**
 * Lightweight: only migrate sibling links by same mobile.
 * Does NOT invent fake products or purchases.
 */
export async function ensureSupplierFullData(supplierId: string) {
  const supplier = await Contact.findById(supplierId);
  if (!supplier) return { linked: 0, purchases: 0 };

  await syncProductSupplierLinks();

  let linked = await ProductSupplier.countDocuments({
    supplierId,
    isActive: true,
  });

  if (linked === 0) {
    const siblings = await Contact.find({
      _id: { $ne: supplierId },
      mobile: supplier.mobile,
      type: { $in: ["supplier", "both"] },
    }).select("_id");

    for (const sib of siblings) {
      const sibLinks = await ProductSupplier.find({
        supplierId: sib._id,
        isActive: true,
      }).lean();
      for (const link of sibLinks) {
        await ProductSupplier.updateOne(
          { productId: link.productId, supplierId },
          {
            $set: { price: link.price, isActive: true },
            $setOnInsert: { productId: link.productId, supplierId },
          },
          { upsert: true },
        );
      }
    }

    linked = await ProductSupplier.countDocuments({
      supplierId,
      isActive: true,
    });
  }

  const siblings = await Contact.find({
    _id: { $ne: supplierId },
    mobile: supplier.mobile,
    type: { $in: ["supplier", "both"] },
  }).select("_id");
  if (siblings.length) {
    await Purchase.updateMany(
      { supplierId: { $in: siblings.map((s) => s._id) } },
      { $set: { supplierId: supplier._id, supplierName: supplier.name } },
    );
  }

  const purchases = await Purchase.countDocuments({ supplierId });
  return { linked, purchases };
}

export async function ensureSupplierPurchaseHistory(supplierId: string) {
  return ensureSupplierFullData(supplierId);
}

/**
 * Attach supplier offers from ProductSupplier join table + live Contact.
 * Same supplier can appear on many products — that's expected.
 */
export async function attachOffersToProducts<
  T extends { _id: unknown; purchasePrice?: number; sellPrice?: number; supplierOffers?: unknown[] },
>(products: T[]) {
  if (!products.length) return products;

  const ids = products.map((p) => p._id);
  const links = await ProductSupplier.find({
    productId: { $in: ids },
    isActive: true,
  })
    .sort({ createdAt: 1 })
    .lean();

  const supplierIds = [...new Set(links.map((l) => String(l.supplierId)))];
  const suppliers = await Contact.find({ _id: { $in: supplierIds } })
    .select("name nameBn mobile isActive")
    .lean();
  const supplierMap = new Map(
    suppliers.filter((s) => s.isActive !== false).map((s) => [String(s._id), s]),
  );

  const byProduct = new Map<string, typeof links>();
  for (const link of links) {
    if (!supplierMap.has(String(link.supplierId))) continue;
    const key = String(link.productId);
    const arr = byProduct.get(key) || [];
    arr.push(link);
    byProduct.set(key, arr);
  }

  return products.map((p) => {
    const rows = byProduct.get(String(p._id)) || [];
    const supplierOffers = rows.map((link) => {
      const s = supplierMap.get(String(link.supplierId))!;
      return {
        supplierId: String(link.supplierId),
        name: s.name,
        nameBn: s.nameBn || s.name,
        price: Number(link.price || 0),
        linkId: String(link._id),
      };
    });
    return { ...p, supplierOffers };
  });
}

/**
 * Replace product's supplier set in ProductSupplier relation table.
 * Multiple products may share the same supplierId.
 */
export async function saveProductOffers(
  productId: string,
  offers: { supplierId?: string; name?: string; nameBn?: string; price?: number }[],
) {
  const product = await Product.findById(productId);
  if (!product) return null;

  const keptIds: string[] = [];
  const cleaned: {
    supplierId: string;
    name: string;
    nameBn?: string;
    price: number;
  }[] = [];

  for (const offer of offers) {
    let supplierId = offer.supplierId ? String(offer.supplierId) : "";
    if (!supplierId && offer.name) {
      const found = await Contact.findOne({
        type: { $in: ["supplier", "both"] },
        isActive: true,
        $or: [{ name: offer.name }, { nameBn: offer.name }],
      });
      if (found) supplierId = String(found._id);
    }
    if (!supplierId) continue;
    if (keptIds.includes(supplierId)) continue;

    const contact = await Contact.findOne({
      _id: supplierId,
      type: { $in: ["supplier", "both"] },
      isActive: true,
    }).lean();
    if (!contact) continue;

    const price = Number(offer.price || 0);
    await ProductSupplier.findOneAndUpdate(
      { productId, supplierId },
      { $set: { price, isActive: true } },
      { upsert: true, new: true },
    );

    keptIds.push(supplierId);
    cleaned.push({
      supplierId,
      name: contact.name,
      nameBn: contact.nameBn || contact.name,
      price,
    });
  }

  // Soft-remove links not in the submitted set
  if (keptIds.length) {
    await ProductSupplier.updateMany(
      { productId, isActive: true, supplierId: { $nin: keptIds } },
      { $set: { isActive: false } },
    );
  } else {
    await ProductSupplier.updateMany(
      { productId, isActive: true },
      { $set: { isActive: false } },
    );
  }

  product.supplierOffers = cleaned;
  await product.save();
  return cleaned;
}
