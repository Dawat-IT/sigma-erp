import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://127.0.0.1:3201";
const server = spawn(process.execPath, ["release/app/server.js"], {
  env: {
    ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3201",
    MONGODB_URI: "", USE_MEMORY_MONGO: "", AUTH_SECRET: randomBytes(32).toString("hex"),
  },
  stdio: "inherit",
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${base}/api/health/live`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        assert.equal((await response.json()).databaseConfigured, false);
        ready = true;
        break;
      }
    } catch { /* Wait for startup. */ }
    await delay(1000);
  }
  assert(ready, "Server must start without MongoDB");
  assert.equal((await fetch(`${base}/login`)).status, 200);
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@royalgroup.bd", password: "admin123" }),
  });
  assert.equal(login.status, 503);
  console.log("Database-free deployment: page and liveness work; database operations remain unavailable");
} finally {
  server.kill("SIGTERM");
}
