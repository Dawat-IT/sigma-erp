const bases = ["http://localhost:3001", "http://localhost:3000"];

function nearly(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

function statusOf(grand, paid) {
  const due = Math.max(0, Math.round((grand - paid) * 100) / 100);
  const p = Math.round(paid * 100) / 100;
  if (due <= 0) return "paid";
  if (p > 0) return "partial";
  return "due";
}

async function login(base) {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });
  const cookies = [];
  const getSetCookie = loginRes.headers.getSetCookie?.() || [];
  for (const c of getSetCookie) cookies.push(c.split(";")[0]);
  if (!cookies.length) {
    const sc = loginRes.headers.get("set-cookie");
    if (sc) cookies.push(sc.split(";")[0]);
  }
  return { ok: loginRes.ok, cookie: cookies.join("; "), json: await loginRes.json().catch(() => ({})) };
}

async function main() {
  let base = "";
  let headers = {};
  for (const b of bases) {
    try {
      const { ok, cookie } = await login(b);
      if (ok && cookie) {
        base = b;
        headers = { Cookie: cookie, "Content-Type": "application/json" };
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!base) throw new Error("Could not login on 3000 or 3001");

  const get = async (path) => {
    const r = await fetch(`${base}${path}`, { headers });
    return r.json();
  };
  const post = async (path, body) => {
    const r = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await r.json();
    return { status: r.status, json };
  };

  await fetch(`${base}/api/seed`, { method: "POST", headers, body: JSON.stringify({}) });

  const meta = await get("/api/meta");
  const locationId = meta.locations?.[0]?._id;
  if (!locationId) throw new Error("no location");

  const products = await get(`/api/products?limit=20&locationId=${locationId}`);
  const product = (products.data || []).find((p) => Number(p.locationQty) >= 2);
  if (!product) throw new Error("no stocked product");
  const originalName = product.name;
  const originalPrice = Number(product.sellPrice);
  const stockBefore = Number(product.locationQty);

  const customers = await get("/api/contacts?type=customer&limit=20");
  const customer = (customers.data || [])[0];
  if (!customer) throw new Error("no customer");

  const editedName = "SALE-SPECIFIC MOTOR NAME";
  const editedPrice = 1234.5;
  const editedDesc = "Sale-only description for invoice/challan";

  const fail = [];
  const pass = [];

  const partialPay = 400;
  const created = await post("/api/sales", {
    locationId,
    customerId: customer._id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    customerAddress: customer.address,
    status: "final",
    discount: 0,
    items: [
      {
        productId: product._id,
        name: editedName,
        sku: product.sku,
        unit: product.unit || "Pcs",
        qty: 1,
        unitPrice: editedPrice,
        description: editedDesc,
      },
    ],
    payments: [{ method: "cash", amount: partialPay }],
  });
  if (created.status !== 201) fail.push(`create sale ${created.status} ${JSON.stringify(created.json)}`);
  const sale = created.json.data;
  if (!sale?._id) {
    console.error("create payload result", created.status, JSON.stringify(created.json, null, 2));
    throw new Error("sale not created");
  }

  const line = sale.items?.[0];
  if (line?.name === editedName) pass.push("sale stores edited name");
  else fail.push(`edited name not stored: ${line?.name}`);
  if (nearly(line?.unitPrice, editedPrice)) pass.push("sale stores edited price");
  else fail.push(`edited price not stored: ${line?.unitPrice}`);
  if (line?.description === editedDesc) pass.push("sale stores edited description");
  else fail.push(`edited description not stored: ${JSON.stringify(line?.description)}`);
  if (String(line?.productId) === String(product._id)) pass.push("original productId linked");
  else fail.push("productId not linked");
  if (line?.sku === product.sku) pass.push("original SKU preserved");
  else fail.push("sku missing");

  const due = Math.max(0, editedPrice - partialPay);
  if (nearly(sale.paidAmount, partialPay) && nearly(sale.dueAmount, due)) pass.push("due = total - paid");
  else fail.push(`amounts paid=${sale.paidAmount} due=${sale.dueAmount} expected paid=${partialPay} due=${due}`);
  if (statusOf(sale.grandTotal, sale.paidAmount) === "partial") pass.push("partial paid status");
  else fail.push(`expected partial, got ${statusOf(sale.grandTotal, sale.paidAmount)}`);

  const master = await get(`/api/products/${product._id}`);
  const masterDoc = master.data || master;
  if (masterDoc.name === originalName) pass.push("product master name unchanged");
  else fail.push(`master renamed to ${masterDoc.name}`);
  if (nearly(masterDoc.sellPrice, originalPrice)) pass.push("product master price unchanged");
  else fail.push("master price changed");

  const after = await get(`/api/products?limit=20&locationId=${locationId}`);
  const afterP = (after.data || []).find((p) => String(p._id) === String(product._id));
  if (nearly(Number(afterP?.locationQty), stockBefore - 1)) pass.push("stock deducted by original product id");
  else fail.push(`stock ${afterP?.locationQty} expected ${stockBefore - 1}`);

  const invoice = await get(`/api/sales/${sale._id}`);
  const invLine = invoice.data?.items?.[0];
  if (invLine?.name === editedName && invLine?.description === editedDesc) pass.push("invoice has sale-specific values");
  else fail.push("invoice missing sale-specific values");
  if (invoice.paymentStatus === "partial") pass.push("invoice paymentStatus partial");
  else fail.push(`invoice paymentStatus ${invoice.paymentStatus}`);

  const challan = await get(`/api/sales/${sale._id}/challan?format=json`);
  if (challan.data?.shipmentNo && String(challan.data.saleId) === String(sale._id)) {
    pass.push("delivery challan linked to sales order");
  } else fail.push(`challan missing ${JSON.stringify(challan.data)}`);
  const cItem = (challan.data?.items || [])[0];
  if (cItem?.name === editedName && cItem?.description === editedDesc) pass.push("challan has sale-specific name/description");
  else fail.push(`challan items ${JSON.stringify(cItem)}`);

  const credit = await post("/api/sales", {
    locationId,
    customerId: customer._id,
    customerName: customer.name,
    status: "final",
    items: [{ productId: product._id, name: "Credit line", sku: product.sku, qty: 1, unitPrice: 200, description: "unpaid" }],
    payments: [],
  });
  const creditSale = credit.json.data;
  if (statusOf(creditSale.grandTotal, creditSale.paidAmount) === "due" && nearly(creditSale.dueAmount, 200)) {
    pass.push("unpaid invoice is Due");
  } else fail.push(`credit status paid=${creditSale.paidAmount} due=${creditSale.dueAmount}`);

  const paid = await post("/api/sales", {
    locationId,
    customerId: customer._id,
    customerName: customer.name,
    status: "final",
    items: [{ productId: product._id, name: "Paid line", sku: product.sku, qty: 1, unitPrice: 150, description: "full" }],
    payments: [{ method: "cash", amount: 150 }],
  });
  const paidSale = paid.json.data;
  if (statusOf(paidSale.grandTotal, paidSale.paidAmount) === "paid" && nearly(paidSale.dueAmount, 0)) {
    pass.push("fully paid invoice is Paid");
  } else fail.push(`paid status paid=${paidSale.paidAmount} due=${paidSale.dueAmount}`);

  const payRest = await post(`/api/sales/${sale._id}/payments`, {
    method: "cash",
    amount: due,
  });
  if (payRest.status !== 200) fail.push(`record payment ${payRest.status} ${JSON.stringify(payRest.json)}`);
  else if (payRest.json.paymentStatus === "paid") pass.push("recording remainder marks Paid");
  else fail.push(`after payment status ${payRest.json.paymentStatus}`);

  const ledger = await get(`/api/contacts/${customer._id}/statement`);
  const entries = ledger.data?.entries || [];
  const hasInvoice = entries.some((e) => e.type === "invoice" && e.ref === sale.invoiceNo);
  const hasPayment = entries.some((e) => e.type === "payment" && e.ref === sale.invoiceNo);
  if (hasInvoice && hasPayment) pass.push("customer ledger has invoice + payment");
  else fail.push("ledger missing invoice/payment lines");
  const last = entries[entries.length - 1];
  if (last && Number.isFinite(last.balance)) pass.push("running balance present");
  else fail.push("running balance missing");

  const oldSales = await get("/api/sales?limit=5");
  if (Array.isArray(oldSales.data)) pass.push("existing sales list still works");
  else fail.push("sales list broken");

  const stockBeforeQuote = await get(`/api/products?limit=20&locationId=${locationId}`);
  const qtyBeforeQuote = Number(
    (stockBeforeQuote.data || []).find((p) => String(p._id) === String(product._id))?.locationQty,
  );

  const quote = await post("/api/sales", {
    locationId,
    customerId: customer._id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    customerAddress: customer.address,
    status: "quotation",
    items: [
      {
        productId: product._id,
        name: "QUOTE-ONLY NAME",
        sku: product.sku,
        qty: 1,
        unitPrice: 500,
        description: "Quoted description",
        imageUrl: product.imageUrl || "",
      },
    ],
    payments: [],
  });
  const qtn = quote.json.data;
  if (quote.status !== 201 || !qtn?._id) {
    console.error("quotation create", quote.status, JSON.stringify(quote.json, null, 2));
    throw new Error("quotation not created");
  }
  if (quote.status === 201 && qtn?.quotationNo && qtn?.referenceNo) {
    pass.push(`quotation auto numbers ${qtn.quotationNo} ${qtn.referenceNo}`);
  } else fail.push(`quotation numbers missing ${JSON.stringify(qtn)}`);
  if (!qtn?.invoiceNo) pass.push("quotation has no bill number");
  else fail.push(`quotation unexpectedly has invoiceNo ${qtn.invoiceNo}`);

  const stockMid = await get(`/api/products?limit=20&locationId=${locationId}`);
  const midP = (stockMid.data || []).find((p) => String(p._id) === String(product._id));
  if (nearly(Number(midP?.locationQty), qtyBeforeQuote)) pass.push("quotation does not deduct stock");
  else fail.push(`stock after quote ${midP?.locationQty} expected ${qtyBeforeQuote}`);

  const converted = await post(`/api/sales/${qtn._id}/finalize`, {});
  const so = converted.json.data;
  if (converted.status === 200 && so?.status === "final") pass.push("quotation converted to sales order");
  else fail.push(`finalize ${converted.status} ${JSON.stringify(converted.json)}`);
  if (so?.referenceNo === qtn.referenceNo) pass.push("reference no carried to sales order");
  else fail.push(`ref mismatch quote=${qtn.referenceNo} so=${so?.referenceNo}`);
  if (so?.quotationNo === qtn.quotationNo) pass.push("quotation no preserved after convert");
  else fail.push("quotation no lost");
  if (so?.salesOrderNo && so?.invoiceNo) pass.push("SO and invoice numbers assigned");
  else fail.push(`missing SO/INV ${so?.salesOrderNo} ${so?.invoiceNo}`);
  if (so?.items?.[0]?.name === "QUOTE-ONLY NAME") pass.push("sale-specific name carried to invoice");
  else fail.push("converted name lost");

  const stockAfterConvert = await get(`/api/products?limit=20&locationId=${locationId}`);
  const afterConvertP = (stockAfterConvert.data || []).find((p) => String(p._id) === String(product._id));
  if (nearly(Number(afterConvertP?.locationQty), qtyBeforeQuote - 1)) pass.push("convert deducts stock");
  else fail.push(`stock after convert ${afterConvertP?.locationQty} expected ${qtyBeforeQuote - 1}`);

  const convChallan = await get(`/api/sales/${qtn._id}/challan?format=json`);
  if (convChallan.data?.shipmentNo) pass.push("challan created after convert");
  else fail.push("challan missing after convert");
  if ((convChallan.sale?.referenceNo || convChallan.data?.referenceNo) === qtn.referenceNo) {
    pass.push("challan keeps master reference no");
  } else fail.push("challan ref mismatch");

  const ledger2 = await get(`/api/contacts/${customer._id}/statement`);
  const entries2 = ledger2.data?.entries || [];
  const hasQtn = entries2.some((e) => e.type === "quotation" && e.ref === qtn.quotationNo);
  const hasRef = entries2.some((e) => e.referenceNo === qtn.referenceNo);
  if (hasQtn) pass.push("ledger shows quotation");
  else fail.push("ledger missing quotation");
  if (hasRef) pass.push("ledger shows master reference no");
  else fail.push("ledger missing reference no");

  const pages = [
    [`/sales/${qtn._id}/quotation`, "quotation page"],
    [`/sales/${qtn._id}/invoice`, "invoice page"],
    [`/sales/${qtn._id}/challan`, "challan page"],
    ["/sales/quotations", "quotation list page"],
    ["/sales", "sales list page"],
    ["/pos", "POS page"],
    [`/contacts/${customer._id}/statement`, "customer ledger page"],
    [`/api/sales/${qtn._id}/quotation?format=pdf`, "quotation pdf"],
    [`/api/sales/${qtn._id}/invoice?format=pdf&locale=en`, "invoice pdf"],
    [`/api/sales/${qtn._id}/challan?format=pdf&locale=en`, "challan pdf"],
  ];
  for (const [path, label] of pages) {
    const r = await fetch(`${base}${path}`, { headers });
    if (r.ok) pass.push(`${label} accessible`);
    else fail.push(`${label} HTTP ${r.status}`);
  }

  console.log(`base=${base}`);
  console.log("PASS", pass.length);
  pass.forEach((p) => console.log("  ✓", p));
  console.log("FAIL", fail.length);
  fail.forEach((p) => console.log("  ✗", p));
  if (fail.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
