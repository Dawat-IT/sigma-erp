/**
 * Crawl app pages after seed. Run: node scripts/verify-pages.mjs
 */
const BASE = "http://localhost:3000";

const PAGES = [
  "/",
  "/login",
  "/dashboard",
  "/m",
  "/pos",
  "/pos?mode=quotation",
  "/pos?mode=proposal",
  "/products",
  "/products/import",
  "/products/price",
  "/products/labels",
  "/products/opening-stock",
  "/products/warranties",
  "/contacts",
  "/contacts/customers",
  "/contacts/suppliers",
  "/contacts/employees",
  "/contacts/import",
  "/contacts/payslips",
  "/sales",
  "/sales/proposals",
  "/sales/quotations",
  "/sales/proposals/add",
  "/sales/quotations/add",
  "/sales/challans",
  "/sales/import",
  "/sales/returns/add",
  "/purchases",
  "/expenses",
  "/stock",
  "/stock/cylinders",
  "/stock/adjustments",
  "/services",
  "/services/new",
  "/services/dispatch",
  "/services/machines",
  "/services/technicians",
  "/services/projects",
  "/services/projects/new",
  "/services/technical",
  "/services/technical/new",
  "/hr/payroll",
  "/hr/leaves",
  "/hr/attendance",
  "/hr/arm",
  "/hr/accounts",
  "/hr/business-dev",
  "/crm",
  "/crm/leads",
  "/crm/followups",
  "/crm/client-followups",
  "/crm/clients",
  "/crm/deals",
  "/crm/campaigns",
  "/reports",
  "/reports/profit-loss",
  "/reports/stock",
  "/reports/service",
  "/reports/stock-ledger",
  "/reports/activity-log",
  "/accounts/chart",
  "/accounts/journals",
  "/accounts/journals/customer-payment",
  "/accounts/journals/supplier-payment",
  "/manufacturing",
  "/settings",
  "/users",
  "/roles",
  "/profile",
  "/calendar",
  "/commission-agents",
];

async function login() {
  await fetch(`${BASE}/login`).catch(() => {});
  await fetch(`${BASE}/api/auth/login`, { headers: { Accept: "application/json" } }).catch(() => {});
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
    });
    const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    const body = await res.json().catch(() => ({}));
    if (res.ok && cookie) return cookie;
    await new Promise((r) => setTimeout(r, 700));
    if (i === 7) throw new Error(`login ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
  }
  throw new Error("login failed");
}

async function main() {
  let cookie = await login();
  console.log("login ok, seeding…");
  const seed = await fetch(`${BASE}/api/seed`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ force: true }),
  });
  const seedJson = await seed.json().catch(() => ({}));
  if (!seed.ok) throw new Error(`seed ${seed.status} ${JSON.stringify(seedJson).slice(0, 200)}`);
  cookie = await login();
  console.log("seed", seedJson.counts);

  const idGets = [
    ["/api/products?limit=1", (d) => d.data?.[0]?._id, (id) => `/products`],
    ["/api/sales?limit=1", (d) => d.data?.[0]?._id, (id) => `/sales/${id}/invoice`],
    ["/api/sales?limit=1", (d) => d.data?.[0]?._id, (id) => `/sales/${id}/quotation`],
    ["/api/sales?limit=1", (d) => d.data?.[0]?._id, (id) => `/sales/${id}/challan`],
    ["/api/sales?limit=1", (d) => d.data?.[0]?._id, (id) => `/sales/${id}/proposal`],
    ["/api/contacts?type=supplier&limit=1", (d) => d.data?.[0]?._id, (id) => `/contacts/suppliers/${id}`],
    ["/api/contacts?type=employee&limit=1", (d) => d.data?.[0]?._id, (id) => `/contacts/employees/${id}`],
    ["/api/contacts?type=customer&limit=1", (d) => d.data?.[0]?._id, (id) => `/contacts/${id}/statement`],
    ["/api/services?limit=1", (d) => d.data?.[0]?._id, (id) => `/services/${id}`],
    ["/api/services?limit=1", (d) => d.data?.[0]?._id, (id) => `/services/${id}/invoice`],
    ["/api/technicians", (d) => (d.data || [])[0]?._id, (id) => `/services/technicians/${id}`],
    ["/api/payslips", (d) => (d.data || [])[0]?._id, (id) => `/contacts/payslips/${id}`],
  ];

  const extra = [];
  for (const [api, pick, toPath] of idGets) {
    const res = await fetch(`${BASE}${api}`, { headers: { Cookie: cookie, Accept: "application/json" } });
    const json = await res.json().catch(() => ({}));
    const id = pick(json);
    if (id) extra.push(toPath(id));
  }

  const all = [...PAGES, ...extra];
  const rows = [];
  for (const path of all) {
    const started = Date.now();
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie, Accept: "text/html" },
      redirect: "manual",
    });
    const loc = res.headers.get("location") || "";
    rows.push({
      path,
      status: res.status,
      ms: Date.now() - started,
      loc,
      fail: res.status >= 400 && res.status !== 304,
    });
  }

  for (const row of rows) {
    const mark = row.fail ? "FAIL" : resOk(row) ? "PASS" : "WARN";
    console.log(`${mark} ${String(row.status).padStart(3)} ${String(row.ms).padStart(5)}ms  ${row.path}${row.loc ? " -> " + row.loc : ""}`);
  }
  const fail = rows.filter((r) => r.fail);
  console.log(`\n${rows.length - fail.length}/${rows.length} pages ok  fail=${fail.length}`);
  if (fail.length) process.exit(1);
}

function resOk(row) {
  return row.status >= 200 && row.status < 400;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
