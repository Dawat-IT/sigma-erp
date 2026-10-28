const base = "http://localhost:3000";

function fail(msg) {
  console.log("FAIL", msg);
  process.exitCode = 1;
}

function pass(msg) {
  console.log("PASS", msg);
}

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json, status: res.status };
}

const pages = [
  "/login",
  "/dashboard",
  "/contacts/customers",
  "/crm/leads",
  "/services",
  "/services/technical",
  "/services/technical/new",
  "/services/projects",
  "/services/projects/new",
  "/hr/business-dev",
  "/hr/accounts",
  "/hr/arm",
  "/contacts/employees",
  "/contacts/payslips",
];

(async () => {
  const loginPage = await req("/login");
  if (loginPage.status !== 200) fail(`/login ${loginPage.status}`);
  else if (!/Sigma Elevator/i.test(loginPage.text)) fail("/login missing Sigma Elevator brand");
  else pass("login page branded Sigma Elevator");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });
  if (login.status !== 200 || !login.json?.ok) {
    fail(`login API ${login.status} ${JSON.stringify(login.json)}`);
    return;
  }
  const cookie = (login.res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) {
    fail("no session cookie");
    return;
  }
  pass("demo admin login");

  const auth = { headers: { Cookie: cookie } };

  const seed = await req("/api/seed", {
    method: "POST",
    body: "{}",
    headers: auth.headers,
  });
  if (seed.status !== 200 || !seed.json?.ok) fail(`seed ${seed.status} ${JSON.stringify(seed.json)}`);
  else pass(`seed ${seed.json.message || seed.json.seeded}`);

  const summary = await req("/api/services?summary=technical", auth);
  if (summary.status !== 200) fail(`technical summary ${summary.status}`);
  else pass(`technical summary open=${summary.json.openCount} dueUnits=${summary.json.dueUnits}`);

  const techList = await req("/api/services?jobKind=complaint,scheduled,emergency&limit=5", auth);
  if (techList.status !== 200) fail(`technical list ${techList.status}`);
  else pass(`technical list ${techList.json.total} jobs`);

  const installList = await req("/api/services?jobKind=installation&limit=5", auth);
  if (installList.status !== 200) fail(`install list ${installList.status}`);
  else pass(`install list ${installList.json.total} jobs`);

  const due = await req("/api/machines?due=1&limit=20", auth);
  if (due.status !== 200) fail(`machines due ${due.status}`);
  else pass(`machines due ${due.json.total}`);

  const contacts = await req("/api/contacts?type=customer&limit=5", auth);
  if (contacts.status !== 200 || !(contacts.json.data || []).length) fail("customers empty");
  else pass(`customers ${contacts.json.total || contacts.json.data.length}`);

  const customerId = contacts.json.data[0]._id;
  const created = await req("/api/services", {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify({
      customerId,
      jobKind: "complaint",
      equipmentType: "Lift",
      issueDescription: "Door not closing on landing 3",
      priority: "high",
      status: "reported",
    }),
  });
  if (created.status !== 201 || !created.json?.data?._id) fail(`create job ${created.status} ${JSON.stringify(created.json)}`);
  else pass(`created job ${created.json.data.jobNo}`);

  const jobId = created.json?.data?._id;
  if (jobId) {
    const updated = await req(`/api/services/${jobId}`, {
      method: "PUT",
      headers: auth.headers,
      body: JSON.stringify({
        status: "in_progress",
        fieldStatus: "on_site",
        diagnosis: "Door lock contact dirty",
        checklist: [{ item: "Door system inspection", done: true }],
      }),
    });
    if (updated.status !== 200) fail(`update job ${updated.status} ${JSON.stringify(updated.json)}`);
    else pass("updated technical job status + checklist");
  }

  const leads = await req("/api/crm/leads?limit=5", auth);
  if (leads.status !== 200) fail(`leads ${leads.status}`);
  else pass(`leads ${leads.json.total ?? (leads.json.data || []).length}`);

  const crm = await req("/api/crm/summary", auth);
  if (crm.status !== 200) fail(`crm summary ${crm.status}`);
  else pass("crm summary");

  const sales = await req("/api/sales?limit=5", auth);
  if (sales.status !== 200) fail(`sales ${sales.status}`);
  else pass("sales list");

  for (const path of pages) {
    const page = await req(path, auth);
    if (page.status >= 500) fail(`page ${path} ${page.status}`);
    else if (page.status === 404) fail(`page ${path} 404`);
    else pass(`page ${path} ${page.status}`);
  }

  if (process.exitCode) console.log("\nSome checks failed");
  else console.log("\nAll API/page checks passed");
})().catch((err) => {
  console.error("CRASH", err);
  process.exit(1);
});
