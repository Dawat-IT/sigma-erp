/**
 * Smoke-test every list/read API after seed.
 * Run: node scripts/verify-all-apis.mjs
 */
const BASE = "http://localhost:3000";
const TODAY = new Date().toISOString().slice(0, 10);

function firstId(body) {
  const rows = Array.isArray(body)
    ? body
    : body?.data || body?.items || body?.rows || body?.jobs || [];
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?._id ? String(row._id) : null;
}

function summarize(body) {
  if (body == null) return { kind: "empty", n: 0 };
  if (typeof body === "string") {
    return { kind: "text", n: body.length, sample: body.slice(0, 60) };
  }
  if (Array.isArray(body)) return { kind: "array", n: body.length };
  if (typeof body !== "object") return { kind: typeof body, n: body ? 1 : 0 };

  const named = [
    "data",
    "items",
    "rows",
    "jobs",
    "employees",
    "technicians",
    "machines",
    "products",
    "houses",
    "flags",
    "accounts",
    "leaves",
  ];
  for (const k of named) {
    if (Array.isArray(body[k])) {
      return { kind: k, n: body[k].length, total: body.total };
    }
  }
  if (body.counts && typeof body.counts === "object") {
    return { kind: "counts", n: Object.keys(body.counts).length, extra: body.counts };
  }
  if (typeof body.total === "number") return { kind: "total", n: body.total };
  if (body.ok === true) return { kind: "ok", n: 1, keys: Object.keys(body).slice(0, 10) };
  return { kind: "object", n: Object.keys(body).length, keys: Object.keys(body).slice(0, 12) };
}

async function login() {
  await fetch(`${BASE}/login`).catch(() => {});
  let last = "";
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
    });
    const cookies = res.headers.getSetCookie?.() || [];
    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    const body = await res.json().catch(() => ({}));
    if (res.ok && cookie) return cookie;
    last = `${res.status} ${JSON.stringify(body).slice(0, 180)}`;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`login failed ${last}`);
}

async function api(cookie, path, opts = {}) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.body != null ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const ct = res.headers.get("content-type") || "";
  const ms = Date.now() - started;
  let body;
  if (ct.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    body = buf.length > 200 ? `[${ct || "bin"} ${buf.length}b]` : buf.toString("utf8");
  }
  return { status: res.status, ok: res.ok, body, ms, ct };
}

function expectOk(row) {
  if (row.expect === "401") return row.status === 401;
  if (row.expect === "404") return row.status === 404;
  return row.status >= 200 && row.status < 300;
}

function hasPayload(row) {
  if (!row.ok) return false;
  const s = row.summary;
  if (s.kind === "text") return s.n > 0;
  if (s.kind === "ok" || s.kind === "object" || s.kind === "counts") return s.n > 0;
  return s.n > 0 || (typeof s.total === "number" && s.total > 0);
}

async function main() {
  process.stdout.write("login… ");
  let cookie = await login();
  console.log("ok");

  process.stdout.write("seed force… ");
  const seeded = await api(cookie, "/api/seed", {
    method: "POST",
    body: JSON.stringify({ force: true }),
  });
  if (!seeded.ok) throw new Error(`seed failed ${seeded.status} ${JSON.stringify(seeded.body)}`);
  cookie = await login();
  const counts = seeded.body?.counts || {};
  console.log(
    `ok products=${counts.products} jobs=${counts.serviceJobs} sales=${counts.sales} (${seeded.ms}ms)`,
  );

  const listPaths = [
    "/api/seed",
    "/api/dashboard",
    "/api/products?limit=50",
    "/api/products?q=IC0001",
    "/api/products?q=IC0384",
    "/api/sales?limit=20",
    "/api/purchases?limit=20",
    "/api/expenses?limit=20",
    "/api/contacts?type=customer&limit=20",
    "/api/contacts?type=supplier&limit=20",
    "/api/contacts?type=employee&limit=20",
    "/api/technicians",
    "/api/machines",
    "/api/machines?due=1",
    "/api/machines?upcoming=1&days=30",
    "/api/amc",
    "/api/services?limit=20",
    "/api/services?summary=desk",
    "/api/services?summary=technical",
    "/api/services?jobKind=complaint&limit=20",
    "/api/services?unassigned=1&limit=20",
    "/api/services/dispatch",
    "/api/services/live",
    "/api/reports/service",
    "/api/reports/service?kind=technician",
    "/api/reports/service?kind=equipment",
    "/api/reports/service?kind=parts",
    "/api/reports/service?kind=amc",
    "/api/reports/service?kind=complaints",
    "/api/reports/service?kind=sla",
    `/api/today?date=${TODAY}`,
    "/api/payslips",
    "/api/payroll",
    "/api/hr/leaves",
    "/api/hr/attendance",
    "/api/crm/leads",
    "/api/crm/clients",
    "/api/crm/followups",
    "/api/crm/deals",
    "/api/crm/campaigns",
    "/api/crm/summary",
    "/api/meta?type=locations",
    "/api/meta?type=business",
    "/api/ledger-accounts",
    "/api/journals",
    "/api/cylinders",
    "/api/sales/numbers",
    "/api/reports/profit-loss",
    "/api/reports/stock",
    "/api/reports/items",
    "/api/reports/customer-supplier",
    "/api/reports/expense",
    "/api/reports/sell-payment",
    "/api/reports/purchase-payment",
    "/api/reports/balance-sheet",
    "/api/reports/service",
    "/api/reports/stock-ledger",
    "/api/reports/activity-log",
    "/api/exports/products",
    "/api/exports/quotations",
    "/api/favicon",
    "/api/modules/users",
    "/api/modules/roles",
    "/api/modules/brands",
    "/api/modules/units",
    "/api/modules/categories",
    "/api/modules/accounts",
    "/api/modules/expense-categories",
    "/api/modules/customer-groups",
    "/api/modules/commission-agents",
    "/api/modules/projects",
    "/api/modules/productions",
    "/api/modules/recipes",
    "/api/modules/leads",
    "/api/modules/sell-returns",
    "/api/modules/purchase-returns",
    "/api/modules/shipments",
    "/api/modules/discounts",
    "/api/modules/purchase-requisitions",
    "/api/modules/notification-templates",
    "/api/modules/stock-transfers",
    "/api/modules/stock-adjustments",
    "/api/modules/products?limit=20",
    "/api/modules/customers?limit=20",
    "/api/modules/suppliers?limit=20",
    "/api/modules/expenses?limit=20",
    "/api/modules/purchases?limit=20",
    "/api/modules/sales?limit=20",
  ];

  const results = [];

  const unauth = await api("", "/api/products");
  results.push({
    path: "GET /api/products (no cookie)",
    status: unauth.status,
    ok: unauth.status === 401,
    expect: "401",
    summary: summarize(unauth.body),
    ms: unauth.ms,
  });

  for (const path of listPaths) {
    const r = await api(cookie, path);
    results.push({
      path: `GET ${path}`,
      status: r.status,
      ok: r.ok,
      summary: summarize(r.body),
      ms: r.ms,
      body: r.body,
    });
  }

  const meToday = await api(cookie, `/api/me/today?date=${TODAY}`);
  results.push({
    path: `GET /api/me/today?date=${TODAY}`,
    status: meToday.status,
    ok: meToday.status === 404,
    expect: "404",
    summary: summarize(meToday.body),
    ms: meToday.ms,
  });

  const pick = (path) => results.find((x) => x.path.startsWith(`GET ${path}`))?.body;

  const followOns = [];
  const productId = firstId(pick("/api/products?limit=50"));
  const saleId = firstId(pick("/api/sales?limit=20"));
  const purchaseId = firstId(pick("/api/purchases?limit=20"));
  const expenseId = firstId(pick("/api/expenses?limit=20"));
  const customerId = firstId(pick("/api/contacts?type=customer"));
  const employeeId = firstId(pick("/api/contacts?type=employee"));
  const techId = firstId(pick("/api/technicians"));
  const machineId = firstId(pick("/api/machines"));
  const jobId = firstId(pick("/api/services?limit=20"));
  const amcId = firstId(pick("/api/amc"));
  const payslipId = firstId(pick("/api/payslips"));
  const leadId = firstId(pick("/api/crm/leads"));
  const clientId = firstId(pick("/api/crm/clients"));
  const followId = firstId(pick("/api/crm/followups"));
  const dealId = firstId(pick("/api/crm/deals"));
  const roleId = firstId(pick("/api/modules/roles"));

  if (productId) followOns.push(`/api/products/${productId}`);
  if (saleId) {
    followOns.push(`/api/sales/${saleId}`);
    followOns.push(`/api/sales/${saleId}/invoice`);
    followOns.push(`/api/sales/${saleId}/quotation`);
    followOns.push(`/api/sales/${saleId}/challan`);
    followOns.push(`/api/sales/${saleId}/proposal`);
  }
  if (purchaseId) followOns.push(`/api/purchases/${purchaseId}`);
  if (customerId) {
    followOns.push(`/api/contacts/${customerId}`);
    followOns.push(`/api/contacts/${customerId}/history`);
    followOns.push(`/api/contacts/${customerId}/statement`);
  }
  if (employeeId) followOns.push(`/api/contacts/${employeeId}`);
  if (techId) followOns.push(`/api/technicians/${techId}`);
  if (machineId) followOns.push(`/api/machines/${machineId}`);
  if (amcId) followOns.push(`/api/amc/${amcId}`);
  if (jobId) followOns.push(`/api/services/${jobId}`);
  if (payslipId) followOns.push(`/api/payslips/${payslipId}`);
  if (leadId) followOns.push(`/api/crm/leads/${leadId}`);
  if (clientId) followOns.push(`/api/crm/clients/${clientId}`);
  if (followId) followOns.push(`/api/crm/followups/${followId}`);
  if (dealId) followOns.push(`/api/crm/deals/${dealId}`);
  if (roleId) followOns.push(`/api/modules/roles/${roleId}`);

  for (const path of followOns) {
    const r = await api(cookie, path);
    results.push({
      path: `GET ${path}`,
      status: r.status,
      ok: r.ok,
      summary: summarize(r.body),
      ms: r.ms,
    });
  }

  const mustHave = {
    "GET /api/products?limit=50": 50,
    "GET /api/products?q=IC0001": 1,
    "GET /api/products?q=IC0384": 1,
    "GET /api/contacts?type=employee&limit=20": 12,
    "GET /api/technicians": 6,
    "GET /api/machines": 5,
    "GET /api/services?limit=20": 20,
    "GET /api/sales?limit=20": 20,
    "GET /api/hr/leaves": 8,
    "GET /api/crm/followups": 1,
  };

  let fail = 0;
  let empty = 0;
  for (const row of results) {
    const goodStatus = expectOk(row);
    const payload = row.expect ? true : hasPayload(row);
    row.pass = goodStatus && payload;
    if (!goodStatus) fail += 1;
    else if (!payload) empty += 1;
  }

  const width = Math.max(...results.map((r) => r.path.length));
  console.log("");
  for (const row of results) {
    const mark = row.pass ? "PASS" : row.ok ? "EMPTY" : "FAIL";
    const s = row.summary;
    const extra =
      s.total != null
        ? `${s.kind}=${s.n} total=${s.total}`
        : s.extra
          ? `${s.kind} ${JSON.stringify(s.extra)}`
          : s.keys
            ? `${s.kind} keys=${s.keys.join(",")}`
            : `${s.kind}=${s.n}`;
    console.log(
      `${mark.padEnd(5)} ${String(row.status).padStart(3)} ${String(row.ms).padStart(5)}ms  ${row.path.padEnd(width)}  ${extra}`,
    );
  }

  console.log("\nseed counts", counts);
  console.log("ids", {
    productId,
    saleId,
    purchaseId,
    customerId,
    employeeId,
    techId,
    machineId,
    jobId,
    payslipId,
    leadId,
    clientId,
    followId,
  });

  for (const [path, min] of Object.entries(mustHave)) {
    const row = results.find((r) => r.path === path);
    const n = row?.summary?.total ?? row?.summary?.n ?? 0;
    if (!row?.ok || n < min) {
      fail += 1;
      console.log(`MUST  FAIL ${path} got ${n} want >= ${min}`);
    } else {
      console.log(`MUST  PASS ${path} n=${n}`);
    }
  }

  const pass = results.filter((r) => r.pass).length;
  console.log(
    `\n${pass}/${results.length} endpoints returned data  fail=${fail} empty=${empty}`,
  );
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
