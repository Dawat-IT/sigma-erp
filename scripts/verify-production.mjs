import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://127.0.0.1:3200";
const env = {
  ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3200",
  AUTH_SECRET: randomBytes(32).toString("hex"),
  ADMIN_EMAIL: "ci-admin@example.test", ADMIN_PASSWORD: randomBytes(24).toString("hex"),
};
const server = spawn(process.execPath, ["release/app/server.js"], { env, stdio: "inherit" });
async function login(email, password) {
  return fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}
try {
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) })).ok) {
        healthy = true;
        break;
      }
    } catch { /* wait for server */ }
    await delay(1000);
  }
  assert(healthy, "Production database health check failed");
  assert.equal((await fetch(`${base}/login`)).status, 200);
  assert.equal((await login("admin@royalgroup.bd", "admin123")).status, 401);
  const bootstrap = spawn(process.execPath, ["deploy/bootstrap-admin.cjs"], { env, stdio: "inherit" });
  const exitCode = await new Promise((resolve, reject) => {
    bootstrap.on("error", reject);
    bootstrap.on("exit", resolve);
  });
  assert.equal(exitCode, 0);
  const authenticated = await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  assert.equal(authenticated.status, 200);
  const cookie = authenticated.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert(cookie.includes("gp_erp_session="));
  assert(authenticated.headers.get("set-cookie").toLowerCase().includes("secure"));
  const seed = await fetch(`${base}/api/seed`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(seed.status, 403);
  console.log("Production health, login, secure cookies and demo protection passed");
} finally {
  server.kill("SIGTERM");
}
