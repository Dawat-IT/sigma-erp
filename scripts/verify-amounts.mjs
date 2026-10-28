const base = "http://localhost:3000";

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  // Node fetch may not expose set-cookie the same way — use jar from raw headers
  const raw = res.headers.raw?.()?.["set-cookie"] || setCookie;
  const cookieHeader = (Array.isArray(raw) ? raw : [])
    .map((c) => String(c).split(";")[0])
    .join("; ");
  const json = await res.json();
  return { cookie: cookieHeader || cookie, json };
}

async function api(path, cookie) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return res.json();
}

function nearly(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function main() {
  // Use undici/cookie via manual login with credentials include won't work cross...
  // Prefer calling through next with cookie from login response in Node 20+
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });

  const cookies = [];
  const getSetCookie = loginRes.headers.getSetCookie?.() || [];
  for (const c of getSetCookie) cookies.push(c.split(";")[0]);
  // Fallback: try raw
  if (!cookies.length) {
    const sc = loginRes.headers.get("set-cookie");
    if (sc) cookies.push(sc.split(";")[0]);
  }
  const cookie = cookies.join("; ");
  const headers = { Cookie: cookie };

  const get = async (path) => {
    const r = await fetch(`${base}${path}`, { headers });
    return r.json();
  };

  const products = await get("/api/products?limit=100");
  const list = products.data || [];
  const withAlamin = list.filter((p) =>
    (p.supplierOffers || []).some((o) => /Alamin/i.test(o.name || "")),
  );
  const without = list.filter(
    (p) => !(p.supplierOffers || []).some((o) => /Alamin/i.test(o.name || "")),
  );

  const purchases = await get("/api/purchases?limit=100");
  const purchaseLineErrors = [];
  const purchaseTotalErrors = [];
  for (const po of purchases.data || []) {
    let sum = 0;
    for (const it of po.items || []) {
      const exp = Number(it.qty) * Number(it.unitCost);
      sum += exp;
      if (!nearly(exp, it.lineTotal)) {
        purchaseLineErrors.push({
          ref: po.referenceNo,
          name: it.name,
          qty: it.qty,
          unitCost: it.unitCost,
          lineTotal: it.lineTotal,
          expected: exp,
        });
      }
    }
    const disc = Number(po.discount || 0);
    const tax = Number(po.tax || 0);
    const expGrand = sum - disc + tax;
    if (!nearly(sum, po.subtotal)) {
      purchaseTotalErrors.push({
        ref: po.referenceNo,
        type: "subtotal",
        sum,
        subtotal: po.subtotal,
      });
    }
    if (!nearly(expGrand, po.grandTotal)) {
      purchaseTotalErrors.push({
        ref: po.referenceNo,
        type: "grand",
        expected: expGrand,
        grandTotal: po.grandTotal,
      });
    }
    if (po.status !== "draft") {
      const paidDue = Number(po.paidAmount || 0) + Number(po.dueAmount || 0);
      if (!nearly(paidDue, po.grandTotal)) {
        purchaseTotalErrors.push({
          ref: po.referenceNo,
          type: "paid+due",
          paidDue,
          grandTotal: po.grandTotal,
          status: po.status,
        });
      }
    }
  }

  const sales = await get("/api/sales?limit=100");
  const saleErrors = [];
  for (const sale of sales.data || []) {
    let itemSum = 0;
    for (const it of sale.items || []) {
      const disc = Number(it.discount || 0);
      const taxP = Number(it.taxPercent || 0);
      const base = Number(it.qty) * Number(it.unitPrice) - disc;
      const expLine = base + (base * taxP) / 100;
      itemSum += Number(it.lineTotal || 0);
      // Seeded sales often set lineTotal = qty*unitPrice with 0 tax/discount
      const simple = Number(it.qty) * Number(it.unitPrice);
      if (!nearly(expLine, it.lineTotal) && !nearly(simple, it.lineTotal)) {
        saleErrors.push({
          type: "line",
          invoice: sale.invoiceNo,
          name: it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          expected: expLine,
        });
      }
    }
    if (!nearly(itemSum, sale.subtotal)) {
      saleErrors.push({
        type: "subtotal",
        invoice: sale.invoiceNo,
        itemSum,
        subtotal: sale.subtotal,
      });
    }
    const expG =
      Number(sale.subtotal || 0) -
      Number(sale.discount || 0) +
      Number(sale.tax || 0) +
      Number(sale.shipping || 0);
    if (!nearly(expG, sale.grandTotal)) {
      saleErrors.push({
        type: "grand",
        invoice: sale.invoiceNo,
        expected: expG,
        grandTotal: sale.grandTotal,
      });
    }
  }

  const suppliers = await get("/api/contacts?type=supplier&limit=50");
  const alamin = (suppliers.data || []).find((s) => /Alamin/i.test(s.name));
  const hist = await get(`/api/contacts/${alamin._id}/history`);
  let histMismatch = 0;
  let histQty = 0;
  let histAmt = 0;
  for (const line of hist.data?.lines || []) {
    histQty += Number(line.qty || 0);
    histAmt += Number(line.lineTotal || 0);
    const exp = Number(line.qty) * Number(line.unitCost);
    if (!nearly(exp, line.lineTotal)) histMismatch += 1;
  }

  const samples = list.slice(0, 6).map((p) => {
    const a = (p.supplierOffers || []).find((o) => /Alamin/i.test(o.name || ""));
    return {
      sku: p.sku,
      name: p.name,
      alaminPrice: a?.price,
      purchasePrice: p.purchasePrice,
    };
  });

  console.log(
    JSON.stringify(
      {
        alaminOnProducts: {
          total: list.length,
          withAlamin: withAlamin.length,
          withoutAlamin: without.map((p) => p.sku),
          ok: without.length === 0 && withAlamin.length === list.length,
        },
        purchases: {
          count: (purchases.data || []).length,
          lineErrors: purchaseLineErrors.length,
          totalErrors: purchaseTotalErrors.length,
          sampleLineErrors: purchaseLineErrors.slice(0, 5),
          sampleTotalErrors: purchaseTotalErrors.slice(0, 5),
          summary: purchases.summary,
        },
        sales: {
          count: (sales.data || []).length,
          errors: saleErrors.length,
          sampleErrors: saleErrors.slice(0, 8),
          summary: sales.summary,
        },
        alaminHistory: {
          linkedProducts: hist.data?.summary?.productCount,
          lines: hist.data?.lines?.length,
          qtySum: histQty,
          summaryQty: hist.data?.summary?.totalQty,
          amtSum: histAmt,
          summaryAmt: hist.data?.summary?.totalAmount,
          qtyMatch: nearly(histQty, hist.data?.summary?.totalQty),
          amtMatch: nearly(histAmt, hist.data?.summary?.totalAmount),
          lineQtyCostMismatches: histMismatch,
        },
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
