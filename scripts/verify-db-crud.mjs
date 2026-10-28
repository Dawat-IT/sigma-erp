/**
 * Full DB + relation + CRUD verification for Sigma Elevator ERP
 * Run: node scripts/verify-db-crud.mjs
 */
const base = "http://localhost:3000";

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return { cookie, user: await res.json() };
}

function headers(cookie, json = true) {
  const h = { Cookie: cookie };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function api(cookie, path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { ...headers(cookie, opts.body != null), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function nearly(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function main() {
  const report = {
    login: null,
    seedStatus: null,
    relations: {},
    crud: {},
    frontendFetch: {},
    ok: true,
    failures: [],
  };

  const fail = (msg) => {
    report.ok = false;
    report.failures.push(msg);
  };

  const { cookie, user } = await login();
  report.login = { ok: true, email: user?.user?.email };

  // ── Seed / relation health ─────────────────────────────────────
  const status = await api(cookie, "/api/seed");
  report.seedStatus = status.body;
  if (!status.ok) fail("GET /api/seed status failed");

  const counts = status.body?.counts || {};
  const rel = status.body?.relations || {};
  if (!counts.products) fail("no products in DB");
  if (!counts.suppliers) fail("no suppliers in DB");
  if (!counts.productSupplierLinks) fail("no ProductSupplier links");
  if (rel.orphanProductSupplierLinks > 0) {
    fail(`orphan ProductSupplier links: ${rel.orphanProductSupplierLinks}`);
  }
  if (!rel.allProductsHaveLinks) fail("some products missing supplier links");

  // ── Frontend list fetches ──────────────────────────────────────
  const products = await api(cookie, "/api/products?limit=100");
  const suppliers = await api(cookie, "/api/contacts?type=supplier&limit=100");
  const customers = await api(cookie, "/api/contacts?type=customer&limit=100");
  const purchases = await api(cookie, "/api/purchases?limit=50");
  const sales = await api(cookie, "/api/sales?limit=50");
  const dashboard = await api(cookie, "/api/dashboard");

  report.frontendFetch = {
    products: { ok: products.ok, count: products.body?.data?.length },
    suppliers: { ok: suppliers.ok, count: suppliers.body?.data?.length },
    customers: { ok: customers.ok, count: customers.body?.data?.length },
    purchases: { ok: purchases.ok, count: purchases.body?.data?.length },
    sales: { ok: sales.ok, count: sales.body?.data?.length },
    dashboard: { ok: dashboard.ok, hasKpis: Boolean(dashboard.body?.kpis) },
  };

  for (const [k, v] of Object.entries(report.frontendFetch)) {
    if (!v.ok) fail(`${k} fetch failed`);
  }

  const productList = products.body?.data || [];
  const withOffers = productList.filter((p) => (p.supplierOffers || []).length > 0);
  const withAlamin = productList.filter((p) =>
    (p.supplierOffers || []).some((o) => /Alamin/i.test(o.name || "")),
  );
  report.relations.productsWithOffers = withOffers.length;
  report.relations.productsWithAlamin = withAlamin.length;
  report.relations.totalProductsFetched = productList.length;
  if (withOffers.length !== productList.length) {
    fail(`${productList.length - withOffers.length} products missing offers on fetch`);
  }
  if (withAlamin.length !== productList.length) {
    fail(`${productList.length - withAlamin.length} products missing Alamin`);
  }

  // Every offer must have live supplierId pointing to a known supplier
  const supplierIds = new Set((suppliers.body?.data || []).map((s) => String(s._id)));
  let badOfferIds = 0;
  for (const p of productList) {
    for (const o of p.supplierOffers || []) {
      if (!o.supplierId || !supplierIds.has(String(o.supplierId))) badOfferIds += 1;
    }
  }
  report.relations.offerSupplierIdOk = badOfferIds === 0;
  if (badOfferIds) fail(`${badOfferIds} offers have invalid supplierId`);

  // Purchase lines: qty * unitCost
  let purchaseMathBad = 0;
  for (const po of purchases.body?.data || []) {
    for (const it of po.items || []) {
      if (!nearly(Number(it.qty) * Number(it.unitCost), it.lineTotal)) purchaseMathBad += 1;
    }
  }
  report.relations.purchaseLineMathErrors = purchaseMathBad;
  if (purchaseMathBad) fail(`purchase line math errors: ${purchaseMathBad}`);

  // Sale lines: qty * unitPrice ≈ lineTotal (seed has no tax)
  let saleMathBad = 0;
  for (const sale of sales.body?.data || []) {
    for (const it of sale.items || []) {
      const simple = Number(it.qty) * Number(it.unitPrice);
      if (!nearly(simple, it.lineTotal) && !nearly(it.lineTotal, simple)) saleMathBad += 1;
    }
  }
  report.relations.saleLineMathErrors = saleMathBad;
  if (saleMathBad) fail(`sale line math errors: ${saleMathBad}`);

  // ── CRUD: Product update ───────────────────────────────────────
  const target = productList.find((p) => p.sku === "105") || productList[0];
  if (!target) fail("no product for CRUD test");
  else {
    const alaminOffer = (target.supplierOffers || []).find((o) => /Alamin/i.test(o.name));
    const otherOffers = (target.supplierOffers || []).filter(
      (o) => String(o.supplierId) !== String(alaminOffer?.supplierId),
    );
    const newPrice = Number(alaminOffer?.price || target.purchasePrice || 100) + 7;

    const updatePayload = {
      name: target.name,
      nameBn: target.nameBn,
      sku: target.sku,
      brand: target.brand,
      purchasePrice: target.purchasePrice,
      sellPrice: target.sellPrice,
      alertQty: target.alertQty,
      supplierOffers: [
        {
          supplierId: alaminOffer?.supplierId,
          price: newPrice,
        },
        ...otherOffers.slice(0, 2).map((o) => ({
          supplierId: o.supplierId,
          price: o.price,
        })),
      ],
    };

    const upd = await api(cookie, `/api/products/${target._id}`, {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    });
    report.crud.productUpdate = { ok: upd.ok, status: upd.status };
    if (!upd.ok) fail("product update failed");

    const afterUpd = await api(cookie, `/api/products/${target._id}`);
    const offersAfter = afterUpd.body?.data?.supplierOffers || [];
    const alaminAfter = offersAfter.find((o) => /Alamin/i.test(o.name));
    report.crud.productUpdateVerified =
      nearly(alaminAfter?.price, newPrice) && Boolean(alaminAfter?.supplierId);
    if (!report.crud.productUpdateVerified) {
      fail(
        `product update not persisted (expected Alamin price ${newPrice}, got ${alaminAfter?.price})`,
      );
    }

    // Restore original price
    await api(cookie, `/api/products/${target._id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...updatePayload,
        supplierOffers: (target.supplierOffers || []).map((o) => ({
          supplierId: o.supplierId,
          price: o.price,
        })),
      }),
    });
  }

  // ── CRUD: create + delete product ──────────────────────────────
  const createSku = `TEST-${Date.now().toString().slice(-6)}`;
  const alamin = (suppliers.body?.data || []).find((s) => /Alamin/i.test(s.name));
  const volt = (suppliers.body?.data || []).find((s) => /VoltLab/i.test(s.name));
  const created = await api(cookie, "/api/products", {
    method: "POST",
    body: JSON.stringify({
      name: "CRUD Test Product",
      nameBn: "CRUD টেস্ট পণ্য",
      sku: createSku,
      brand: "DIT Lab",
      purchasePrice: 100,
      sellPrice: 150,
      alertQty: 5,
      supplierOffers: [
        { supplierId: alamin?._id, price: 95 },
        { supplierId: volt?._id, price: 100 },
      ],
    }),
  });
  report.crud.productCreate = {
    ok: created.ok,
    id: created.body?.data?._id,
    offers: (created.body?.data?.supplierOffers || []).map((o) => o.name),
  };
  if (!created.ok || !created.body?.data?._id) fail("product create failed");

  const createdId = created.body?.data?._id;
  if (createdId) {
    const fetchCreated = await api(cookie, `/api/products/${createdId}`);
    const offers = fetchCreated.body?.data?.supplierOffers || [];
    report.crud.productCreateHasAlamin = offers.some((o) => /Alamin/i.test(o.name));
    if (!report.crud.productCreateHasAlamin) fail("created product missing Alamin link");

    const del = await api(cookie, `/api/products/${createdId}`, { method: "DELETE" });
    report.crud.productDelete = { ok: del.ok, status: del.status };
    if (!del.ok) fail("product delete failed");

    const listAfter = await api(cookie, "/api/products?limit=200");
    const stillThere = (listAfter.body?.data || []).some((p) => String(p._id) === String(createdId));
    report.crud.productDeleteGoneFromList = !stillThere;
    if (stillThere) fail("deleted product still appears in list");
  }

  // ── CRUD: Supplier update + history + offer price ──────────────
  if (alamin?._id) {
    const histBefore = await api(cookie, `/api/contacts/${alamin._id}/history`);
    report.crud.supplierHistoryFetch = {
      ok: histBefore.ok,
      products: histBefore.body?.data?.summary?.productCount,
      lines: histBefore.body?.data?.lines?.length,
    };
    if (!histBefore.ok) fail("supplier history fetch failed");

    const originalName = histBefore.body?.data?.supplier?.name || alamin.name;
    const originalBn = histBefore.body?.data?.supplier?.nameBn || "";
    const originalMobile = histBefore.body?.data?.supplier?.mobile || alamin.mobile;

    const rename = await api(cookie, `/api/contacts/${alamin._id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: "Alamin Electronics",
        nameBn: "আলামিন ইলেকট্রনিক্স",
        mobile: originalMobile,
        address: histBefore.body?.data?.supplier?.address || "",
        openingBalance: histBefore.body?.data?.supplier?.openingBalance ?? 0,
      }),
    });
    report.crud.supplierUpdate = { ok: rename.ok };
    if (!rename.ok) fail("supplier update failed");

    // Verify name propagated to a product card offer
    const productsAfterRename = await api(cookie, "/api/products?limit=5");
    const offerName = (productsAfterRename.body?.data?.[0]?.supplierOffers || []).find((o) =>
      String(o.supplierId) === String(alamin._id),
    )?.name;
    report.crud.supplierNameOnProductCard = offerName;
    if (offerName && !/Alamin/i.test(offerName)) {
      fail(`supplier rename not on product card (got ${offerName})`);
    }

    // Update one offer price via history API
    const offered = histBefore.body?.data?.offeredProducts || [];
    if (offered[0]) {
      const linkId = offered[0].linkId;
      const oldPrice = Number(offered[0].offerPrice);
      const newOfferPrice = oldPrice + 3;
      const priceUpd = await api(cookie, `/api/contacts/${alamin._id}/history`, {
        method: "PUT",
        body: JSON.stringify({
          offerUpdates: [{ linkId, price: newOfferPrice }],
        }),
      });
      report.crud.supplierOfferPriceUpdate = { ok: priceUpd.ok };
      if (!priceUpd.ok) fail("supplier offer price update failed");

      const histAfter = await api(cookie, `/api/contacts/${alamin._id}/history`);
      const row = (histAfter.body?.data?.offeredProducts || []).find((p) => p.linkId === linkId);
      report.crud.supplierOfferPriceVerified = nearly(row?.offerPrice, newOfferPrice);
      if (!report.crud.supplierOfferPriceVerified) {
        fail(`offer price not saved (expected ${newOfferPrice}, got ${row?.offerPrice})`);
      }

      // restore
      await api(cookie, `/api/contacts/${alamin._id}/history`, {
        method: "PUT",
        body: JSON.stringify({
          offerUpdates: [{ linkId, price: oldPrice }],
        }),
      });
    }

    // Soft-delete a temp supplier
    const tempSup = await api(cookie, "/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        type: "supplier",
        name: "Temp CRUD Supplier",
        nameBn: "টেম্প সাপ্লায়ার",
        mobile: `0189${String(Date.now()).slice(-7)}`,
        openingBalance: 0,
      }),
    });
    report.crud.supplierCreate = { ok: tempSup.ok, id: tempSup.body?.data?._id };
    if (tempSup.body?.data?._id) {
      const delSup = await api(cookie, `/api/contacts/${tempSup.body.data._id}`, {
        method: "DELETE",
      });
      report.crud.supplierDelete = { ok: delSup.ok };
      if (!delSup.ok) fail("supplier delete failed");

      const listSup = await api(cookie, "/api/contacts?type=supplier&limit=100");
      const still = (listSup.body?.data || []).some(
        (s) => String(s._id) === String(tempSup.body.data._id),
      );
      report.crud.supplierDeleteGoneFromList = !still;
      if (still) fail("deleted supplier still in list");
    }

    // restore alamin name explicitly
    await api(cookie, `/api/contacts/${alamin._id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: originalName,
        nameBn: originalBn || "আলামিন ইলেকট্রনিক্স",
        mobile: originalMobile,
      }),
    });
  } else {
    fail("Alamin supplier not found");
  }

  // Final status snapshot
  const finalStatus = await api(cookie, "/api/seed");
  report.finalCounts = finalStatus.body?.counts;
  report.finalRelations = finalStatus.body?.relations;

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
