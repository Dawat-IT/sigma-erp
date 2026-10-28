/**
 * Verify service-maintenance Mongo collections + HTTP APIs.
 * Run: node scripts/verify-service-api-db.mjs
 * Does not force-seed.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const BASE = "http://localhost:3000";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim().replace(/^\uFEFF/, "");
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sigmaelevator.bd", password: "admin123" }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !cookie) throw new Error(`login failed ${res.status} ${JSON.stringify(body).slice(0, 180)}`);
  return cookie;
}

async function api(cookie, pathName, opts = {}) {
  const started = Date.now();
  const res = await fetch(`${BASE}${pathName}`, {
    ...opts,
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      ...(opts.body != null ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body, ms: Date.now() - started };
}

function firstRow(body) {
  const rows = body?.data || body?.items || [];
  return Array.isArray(rows) ? rows[0] : null;
}

async function inspectDb() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri === "memory") {
    return { skipped: true, reason: uri === "memory" ? "memory" : "missing" };
  }
  await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 12_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("no db");
  const listed = await db.listCollections().toArray();
  const names = listed.map((c) => c.name).sort();
  const want = ["machines", "amccontracts", "servicejobs", "technicians", "counters", "contacts"];
  const tables = {};
  for (const name of want) {
    if (!names.includes(name)) {
      tables[name] = { exists: false, count: 0, indexes: [] };
      continue;
    }
    const col = db.collection(name);
    const [count, indexes] = await Promise.all([col.estimatedDocumentCount(), col.indexes()]);
    tables[name] = { exists: true, count, indexes: indexes.map((idx) => idx.name) };
  }
  const dbName = db.databaseName;
  await mongoose.disconnect();
  return { dbName, collections: names.length, service: tables };
}

async function main() {
  loadEnv();
  const failures = [];
  const report = { db: null, apis: [], crud: {}, ok: true };

  report.db = await inspectDb();
  if (report.db.skipped) {
    console.log("Direct Mongo inspect skipped:", report.db.reason, "(using live API tables instead)");
  } else {
    console.log(`DB ${report.db.dbName} collections=${report.db.collections}`);
    for (const [name, info] of Object.entries(report.db.service)) {
      console.log(`  ${info.exists ? "OK" : "MISSING"} ${name} count=${info.count} indexes=${(info.indexes || []).join(",") || "—"}`);
    }
  }

  const cookie = await login();
  const gets = [
    "/api/seed",
    "/api/machines?limit=20",
    "/api/machines?due=1",
    "/api/machines?upcoming=1&days=30",
    "/api/amc",
    "/api/technicians",
    "/api/services?limit=20",
    "/api/services?summary=desk",
    "/api/services?summary=technical",
    "/api/services?jobKind=complaint&limit=20",
    "/api/services?status=pending,reported&limit=20",
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
  ];

  for (const pathName of gets) {
    const row = await api(cookie, pathName);
    report.apis.push({ path: pathName, status: row.status, ok: row.ok, ms: row.ms, error: row.body?.error });
    if (!row.ok) failures.push(`GET ${pathName} -> ${row.status} ${row.body?.error || ""}`);
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.status} ${String(row.ms).padStart(5)}ms  GET ${pathName}`);
  }

  const customers = await api(cookie, "/api/contacts?type=customer&limit=5");
  let customer = firstRow(customers.body);
  if (!customer?._id) {
    const made = await api(cookie, "/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        type: "customer",
        name: "Verify Customer",
        mobile: `017${String(Date.now()).slice(-8)}`,
      }),
    });
    customer = made.body?.data;
    report.crud.customerCreate = { ok: made.ok, status: made.status, error: made.body?.error };
    if (!made.ok) failures.push(`POST customer -> ${made.status} ${made.body?.error || ""}`);
  }

  let machine = firstRow((await api(cookie, "/api/machines?limit=5")).body);
  let createdMachineId = "";
  if (!machine?._id && customer?._id) {
    const made = await api(cookie, "/api/machines", {
      method: "POST",
      body: JSON.stringify({
        customerId: customer._id,
        brand: "Sigma",
        model: "Verify Lift",
        serialNo: `VERIFY-${Date.now()}`,
        machineType: "Lift",
        nextServiceDue: "2026-10-15",
        commissionedAt: "2026-01-01",
        siteName: "Verify site",
        siteLocation: "Dhaka",
      }),
    });
    machine = made.body?.data;
    createdMachineId = machine?._id || "";
    report.crud.machineCreate = { ok: made.ok, status: made.status, error: made.body?.error, id: createdMachineId };
    if (!made.ok) failures.push(`POST /api/machines -> ${made.status} ${made.body?.error || ""}`);
    else console.log("PASS POST /api/machines", createdMachineId);
  }

  if (machine?._id) {
    const detail = await api(cookie, `/api/machines/${machine._id}`);
    report.crud.machineDetail = {
      ok: detail.ok,
      hasJobsArray: Array.isArray(detail.body?.jobs),
      commissionedAt: Boolean(detail.body?.data?.commissionedAt),
    };
    if (!detail.ok) failures.push("GET /api/machines/:id failed");
    if (!Array.isArray(detail.body?.jobs)) failures.push("machine detail missing jobs[]");
    console.log(`${detail.ok ? "PASS" : "FAIL"} machine detail jobs=${detail.body?.jobs?.length ?? "n/a"} commissioned=${Boolean(detail.body?.data?.commissionedAt)}`);
  } else {
    failures.push("no machines in DB");
  }

  let job = firstRow((await api(cookie, "/api/services?limit=5")).body);
  let createdJobId = "";
  if (!job?._id && customer?._id) {
    const made = await api(cookie, "/api/services", {
      method: "POST",
      body: JSON.stringify({
        customerId: customer._id,
        machineId: machine?._id,
        jobKind: "complaint",
        equipmentType: "Lift",
        issueDescription: "Verify API checklist",
      }),
    });
    job = made.body?.data;
    createdJobId = job?._id || "";
    report.crud.jobCreate = { ok: made.ok, status: made.status, error: made.body?.error, id: createdJobId };
    if (!made.ok) failures.push(`POST /api/services -> ${made.status} ${made.body?.error || ""}`);
    else console.log("PASS POST /api/services", job?.jobNo || createdJobId);
  }

  if (job?._id) {
    const detail = await api(cookie, `/api/services/${job._id}`);
    const data = detail.body?.data || {};
    report.crud.jobDetail = {
      ok: detail.ok,
      jobKind: data.jobKind,
      hasChecklist: Array.isArray(data.checklist),
      hasPhotos: Array.isArray(data.photos),
    };
    if (!detail.ok) failures.push("GET /api/services/:id failed");
    console.log(`${detail.ok ? "PASS" : "FAIL"} job ${data.jobNo} kind=${data.jobKind} checklist=${(data.checklist || []).length}`);
  }

  if (customer?._id && machine?._id) {
    const created = await api(cookie, "/api/amc", {
      method: "POST",
      body: JSON.stringify({
        customerId: customer._id,
        machineId: machine._id,
        startDate: new Date().toISOString().slice(0, 10),
        cycleDays: 90,
        amount: 1200,
        visitsIncluded: 4,
        notes: "verify-script",
      }),
    });
    report.crud.amcCreate = { ok: created.ok, status: created.status, error: created.body?.error, id: created.body?.data?._id };
    if (!created.ok) failures.push(`POST /api/amc -> ${created.status} ${created.body?.error || ""}`);
    else {
      const id = created.body.data._id;
      const got = await api(cookie, `/api/amc/${id}`);
      const put = await api(cookie, `/api/amc/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: 1500,
          visitsIncluded: 4,
          status: "active",
          customerId: customer._id,
          machineId: machine._id,
        }),
      });
      const del = await api(cookie, `/api/amc/${id}`, { method: "DELETE" });
      report.crud.amcRoundTrip = { get: got.ok, put: put.ok, del: del.ok, afterPutAmount: put.body?.data?.amount };
      if (!got.ok || !put.ok || !del.ok) failures.push("AMC GET/PUT/DELETE round-trip failed");
      console.log(`${got.ok && put.ok && del.ok ? "PASS" : "FAIL"} AMC round-trip`);
    }
  }

  if (createdJobId) {
    const delJob = await api(cookie, `/api/services/${createdJobId}`, { method: "DELETE" });
    report.crud.jobDelete = { ok: delJob.ok, status: delJob.status };
    if (!delJob.ok) failures.push("DELETE verify job failed");
  }
  if (createdMachineId) {
    const delMachine = await api(cookie, `/api/machines/${createdMachineId}`, { method: "DELETE" });
    report.crud.machineDelete = { ok: delMachine.ok, status: delMachine.status };
    if (!delMachine.ok) failures.push("DELETE verify machine failed");
  }

  const health = await api(cookie, "/api/seed");
  report.seedCounts = health.body?.counts || null;
  report.tables = health.body?.tables || null;
  if (!health.ok) failures.push("GET /api/seed tables failed");
  else {
    for (const name of ["machines", "amccontracts", "servicejobs", "technicians", "contacts"]) {
      const table = report.tables?.[name];
      if (!table?.exists) failures.push(`live collection ${name} missing`);
      else console.log(`TABLE OK ${name} count=${table.count} indexes=${(table.indexes || []).join(",")}`);
    }
  }

  report.ok = failures.length === 0;
  report.failures = failures;
  console.log("\nseed counts", report.seedCounts);
  console.log(failures.length ? `\nFAIL ${failures.length}\n- ${failures.join("\n- ")}` : "\nALL SERVICE API + DB CHECKS PASSED");
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
