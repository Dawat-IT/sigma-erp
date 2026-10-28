# Sigma Elevator ERP — API build plan

**Status:** ready to implement. Follow this order. Do not add new ERP modules before Sprint A1–A2.

**Parent:** [docs/sigma-elevator-full-report.md](./sigma-elevator-full-report.md) (WP1–WP12)  
**Date:** 23 Sep 2026  
**Constraint:** keep existing URL shapes where the UI already calls them; harden first, then add new routes.

---

## 0. Goal

Make APIs match the company: technician can only clock own jobs, viewer cannot write, invoices cannot be hard-deleted, clock time is server-side, stock is real, payroll can see visits, AMC can fill dispatch, CEO has one today payload.

| Sprint | Maps to WP | Outcome | Est. |
| --- | --- | --- | --- |
| **A0** | — | Shared auth/audit helpers | 0.5 day |
| **A1** | WP5 + F-16 + F-25 | Every mutate gated; seed locked; payroll GET gated | 1–2 days |
| **A2** | WP5 clock + F-22 + F-30 | Server clock, own-job, void sale, no PUT status=final | 1–2 days |
| **A3** | WP4 + WP6 | House lat/lng, geofence, OTP, photo | 1 week |
| **A4** | WP3 + WP7 + WP8 | `GET /api/me/today`, AMC generate, `GET /api/today` | 1 week |
| **A5** | WP9 + WP10 + WP12 | Payroll visits, real stock ADJ, live ActivityLog, service report dates | 1 week |

UI catalog/nav hide (WP1) and hydration (WP2) are **not** API sprints. Do them in parallel on the client.

---

## 1. Shared library (Sprint A0) — build first

New/extend files. Every later sprint imports these. Do not copy-paste `canWrite` into 20 routes by hand without this.

### 1.1 `src/lib/auth.ts`

Add **`readLiveUser()`**:

1. Verify JWT (existing).
2. `User.findById(payload.id).select("isActive role name email locale")`.
3. If missing or `isActive === false` → treat as no session.
4. Return session with **DB `role`**, not JWT role (fixes F-23).

`readSession()` should call this (or be replaced). Cookie still 7d; role/active always fresh.

### 1.2 `src/lib/rbac.ts`

Keep existing `canWrite` / `canDelete` / `canManagePayroll` / `requirePermission`.

Add:

```ts
requireWrite()      // 401 / 403 need_write
requireDelete()
requirePayroll()    // GET+POST payroll
requireAdmin()
```

### 1.3 `src/lib/audit.ts` (new)

```ts
writeAudit({ userId, action, entityType, entityId, details })
```

`ActivityLog.create` — never throw to caller (log and swallow). Actions: `check_in`, `check_out`, `complete_job`, `void_sale`, `pay_slip`, `pay_all`, `stock_adjust`, `discount`, `otp_send`, `otp_verify`, `override_geofence`.

### 1.4 `src/lib/service-clock.ts` (new)

- `serverNow()` — ignore client timestamps.
- `assertCanClock(session, job)` — admin/manager may clock any; else `Technician.findOne({ userId: session.id })` must equal `job.technicianId`.
- `geofenceOk(job, lat, lng)` — haversine vs house/machine pin; default 300 m.
- Error codes below.

### 1.5 Standard JSON errors

| HTTP | `error` code | When |
| --- | --- | --- |
| 401 | `unauthorized` | No/invalid session |
| 403 | `forbidden` / `need_write` / `need_delete` / `inactive` | Role or disabled user |
| 400 | `need_technician` | Clock without tech |
| 400 | `already_on_site` | Double check-in |
| 400 | `need_checkin` | Check-out without in |
| 400 | `clock_locked` | Client tried to patch times |
| 400 | `not_own_job` | Tech clocking someone else’s job |
| 400 | `too_far` | GPS outside geofence (after A3) |
| 400 | `need_otp` / `bad_otp` | Complete without OTP (after A3) |
| 400 | `need_photo` | Check-in/complete without photo (after A3) |
| 400 | `incomplete` + `gaps` | Existing complete gate |
| 400 | `insufficient_stock` | Part qty > stock (A5) |
| 400 | `credit_limit` | Finalize over limit (A5) |
| 400 | `need_quotation` | Existing finalize |
| 409 | `pay_blocked` | `pay_all` with visit flags (A5) |
| 403 | `void_only` | Attempted hard DELETE sale |

Keep existing codes (`need_technician`, `incomplete`, `need_quotation`) so current UI does not break.

---

## 2. Sprint A1 — lock what already exists

No new URLs. Same methods. Add `requireWrite` / `requireDelete` / `requirePayroll`.

### 2.1 Must gate (viewer can write today)

| File | Methods | Gate |
| --- | --- | --- |
| `api/services/route.ts` | POST | `requireWrite` |
| `api/services/[id]/route.ts` | PUT, DELETE | write; delete → manager+ |
| `api/sales/route.ts` | POST | `requireWrite` |
| `api/sales/[id]/route.ts` | PUT | `requireWrite` |
| `api/sales/[id]/route.ts` | DELETE | **remove hard delete** in A2; until then `requireDelete` + 403 `void_only` preferred |
| `api/expenses/route.ts` | POST | `requireWrite` |
| `api/expenses/[id]/route.ts` | PUT, DELETE | write / delete |
| `api/contacts/route.ts` | POST | `requireWrite` |
| `api/contacts/[id]/route.ts` | PUT, DELETE | write / delete |
| `api/machines/route.ts` | POST | `requireWrite` |
| `api/machines/[id]/route.ts` | PUT, DELETE | write / delete |
| `api/technicians/route.ts` | POST | `requireWrite` |
| `api/technicians/[id]/route.ts` | PUT, DELETE | write / delete |
| `api/products/route.ts` | POST | `requireWrite` (GET already redacts cost) |
| `api/purchases/route.ts` | POST | `requireWrite` |
| `api/purchases/[id]/route.ts` | PUT, DELETE | write / delete |
| `api/meta/route.ts` | PUT | `manage_settings` |

Already gated (do not regress): CRM mutate, sales finalize / issue-quotation / payments, `modules/*`, journals, ledger, import, products `[id]`, cylinders, payroll POST.

### 2.2 Seed + payroll GET

| File | Change |
| --- | --- |
| `src/proxy.ts` | **Remove** anonymous `POST /api/seed` bypass. Empty-DB bootstrap: require `SEED_BOOTSTRAP_SECRET` header **or** admin session. |
| `api/seed/route.ts` | Production: never `ensureDemoAdminUser` password reset. `force` stays admin-only. |
| `api/payroll/route.ts` GET | `requirePayroll()` |
| `api/payslips/route.ts` GET | `requirePayroll()` |
| `api/payslips/[id]/route.ts` GET | `requirePayroll()` |

### 2.3 A1 done when

- Viewer POST `/api/services` → 403.  
- Viewer POST `/api/sales` → 403.  
- Cashier GET `/api/payroll` → 403.  
- Unauthenticated POST `/api/seed` → 401 (unless bootstrap secret on empty DB).  
- Cashier POST `/api/services` still 201 (write role).

---

## 3. Sprint A2 — clock honesty + invoice integrity

Still mostly existing `PUT /api/services/[id]`.

### 3.1 `PUT /api/services/[id]`

| Input | Rule |
| --- | --- |
| `action: "check_in"` | `requireWrite` + `assertCanClock`. **Ignore** `body.checkedInAt`. Set server now. |
| `action: "check_out"` | Same. Ignore `body.checkedOutAt`. |
| `checkedInAt` / `checkedOutAt` without action | 400 `clock_locked` |
| Complete statuses | Existing `completionGaps`; clock must already exist (server). `writeAudit('complete_job')` |
| Auto-close other open jobs | Keep, but store `durationMinutes` as **travel** later (A3); for A2 keep behavior + audit |

Response: unchanged `{ data }` plus `checkedInAt`, `checkedOutAt` from server.

### 3.2 Sales status and void

**`PUT /api/sales/[id]`**

- Strip `status` from `$set` unless admin and existing is not `final`.
- Never allow `proposal`/`quotation` → `final` here (F-30). Only `POST .../finalize`.

**Replace DELETE with void**

- `DELETE /api/sales/[id]` → 403 `{ error: "void_only" }`.
- **New:** `POST /api/sales/[id]/void`  
  - `requireDelete` (manager/admin).  
  - Body: `{ reason: string }` required.  
  - Set `status: "voided"` (add to Sale enum + hot-patch). Reverse stock if final (same `$inc` opposite).  
  - `writeAudit('void_sale')`.  
  - GET lists exclude `voided` by default; `?includeVoided=1` for admin.

### 3.3 A2 done when

- POST check-in with `"checkedInAt": "2020-01-01"` still stores **now**.  
- Technician user A cannot check-in job assigned to technician B (`not_own_job`).  
- PUT sale `{ status: "final" }` leaves status unchanged.  
- DELETE sale → 403; POST void with reason → 200, row not in default list.

---

## 4. Sprint A3 — house pin, GPS, OTP, photo

### 4.1 Schema (hot-patch like existing clock fields)

**Contact / Machine / ServiceJob**

- `lat: Number`, `lng: Number`  
- Job: `checkInLat`, `checkInLng`, `checkInAccuracyM`, `otpHash`, `otpExpiresAt`, `otpVerifiedAt`, `photos: [{ url, kind, at, by }]`

Geocode: optional later. A3 allows **manual** lat/lng on PUT machine/contact (`requireWrite`).

### 4.2 Check-in body (same PUT, extra fields)

```json
{ "action": "check_in", "lat": 23.78, "lng": 90.41, "accuracy": 12 }
```

- If job/house has pin: distance > 300 m → 400 `too_far` unless `override: true` **and** `session.role` manager/admin **and** `reason` (max 2 overrides/tech/week — count in ActivityLog).  
- If no pin yet: allow check-in, audit `check_in_no_pin` (so AMC houses can be pinned over time).

### 4.3 New routes

| Method | Path | Auth | Body / result |
| --- | --- | --- | --- |
| POST | `/api/services/[id]/otp/send` | write + own-job or office | Sends 6-digit to `Contact.mobile` (SMS provider stub: log + return `{ sent: true, mock?: "123456" }` in non-prod). Store hash, TTL 10 min. |
| POST | `/api/services/[id]/otp/verify` | same | `{ code }` → `otpVerifiedAt` or `bad_otp` |
| POST | `/api/services/[id]/photos` | same | `{ kind: "site"\|"selfie"\|"checklist", dataUrl or url }` — persist URL (start: store data URL or `/uploads` later) |

**Complete gate add:** `gaps` += `otp` if not verified; += `photo` if no site photo. Feature flags: `REQUIRE_GPS`, `REQUIRE_OTP` in Business (default off until houses pinned; **on for production field go-live**).

### 4.4 A3 done when

- Job with pin: check-in 1 km away → `too_far`.  
- OTP send + wrong code → `bad_otp`; right code → complete allowed.  
- Photo attached appears on GET job.

---

## 5. Sprint A4 — technician today, AMC generate, company today

### 5.1 `GET /api/me/today?date=YYYY-MM-DD`

- Session → Technician by `userId`. 404 `not_a_technician` if none.  
- Reuse dispatch query filtered to that tech.  
- Payload: `{ technician, date, jobs: [...], counts: { planned, onSite, done } }`.  
- Technician 4-screen uses **only** this + job GET/PUT.

### 5.2 `POST /api/services/amc/generate`

- `requireMinRole("manager")`.  
- Body: `{ date: "YYYY-MM-DD" }` (default tomorrow).  
- Machines with `nextServiceDue` on that calendar day, no existing scheduled job that day.  
- Assign round-robin to active technicians, **max 4 jobs/tech**; remainder `unassigned`.  
- Returns `{ created, skipped, unassigned, overload }`.  
- Audit `amc_generate`.

### 5.3 `GET /api/today?date=`

CEO/admin home. `requireSession` (all logged-in can read; payroll slice only if `canManagePayroll`).

```json
{
  "date": "2026-09-23",
  "houses": { "planned": 70, "onSite": 8, "done": 52, "skipped": 10 },
  "flags": [{ "type": "too_fast"|"zero_visits"|"too_far"|"void", "label": "...", "id": "..." }],
  "money": { "service": 0, "parts": 0, "undepositedCash": 0 },
  "pipeline": { "proposal": 0, "quotation": 0, "final": 0 },
  "followupsOverdue": 0,
  "payrollRisk": [{ "employeeId": "", "visits": 0, "expected": 0, "pct": 0 }]
}
```

`payrollRisk` omitted or empty for cashier. Reuse dispatch aggregates + sales counts + CRM overdue + optional visit tally (full tally in A5).

### 5.4 Convert lead → same house (WP4 API)

`POST /api/crm/leads/[id]/convert` already creates CrmClient. **Change:** upsert `Contact` type customer (match mobile); set lead `customerId`; keep CrmClient as view alias **or** stop creating parallel client (prefer: set `client.contactId`). Do not break existing convert 200 contract: still return `{ client }`.

### 5.5 A4 done when

- Tech token GET `/api/me/today` returns only their jobs.  
- Manager generate AMC creates ≤4 jobs per tech.  
- GET `/api/today` returns the five CEO blocks.

---

## 6. Sprint A5 — payroll visits, stock truth, audit, reports

### 6.1 Payroll

`GET /api/payroll?periodKey=` add per row:

```json
"visits": 12, "expected": 77, "visitPct": 16, "flag": true
```

Expected = working days in period × `Business.expectedVisitsPerDay` (default 3.5). Count `ServiceJob` with that `technicianId` linked to employee (Technician.userId → User, or Technician.mobile = Contact.mobile until linked).

`POST` `action: "pay_all"`: if any `flag` and `body.confirmFlags !== true` → 409 `pay_blocked` + list. Audit.

### 6.2 Stock

**Complete job** (`PUT` complete): every part with qty>0 **must** have `productId`. Else `gaps: ["sku"]`. Before `$inc`, read qty; if short → `insufficient_stock` `{ sku, have, need }`.

**`POST /api/modules/stock-adjustments`:** after `create`, in the same request (transaction if replica):

```
for item in items: Product.updateOne stocks.$.qty += qtyChange
```

Require `canWrite` **and** `roleRank >= manager` for ADJ. Audit `stock_adjust`.

**`POST /api/sales/[id]/finalize`:** if `Contact.creditLimit > 0` and `dueAmount` would exceed limit → 400 `credit_limit`.

Discount on service PUT: if `discount > 0` and role is cashier → 403 unless manager.

### 6.3 Reports

`GET /api/reports/service`: filter `checkedInAt` or `completedAt` or `scheduledDate`, **not** `receivedDate`.

`GET /api/reports/activity-log`: already reads collection; after A0 it will have real rows.

### 6.4 A5 done when

- Complete with `{ name: "motor" }` no productId → 400.  
- ADJ −1 motor actually decreases product stock.  
- `pay_all` with 0-visit tech → 409 unless confirm.  
- Activity log shows last check-in without seed.

---

## 7. Route map (target)

### Keep and harden

`/api/auth/login|logout` · `/api/services` · `/api/services/[id]` · `/api/services/dispatch` · `/api/sales` · `/api/sales/[id]` · `/api/sales/[id]/finalize|issue-quotation|proposal|quotation|payments` · `/api/crm/*` · `/api/payroll` · `/api/payslips` · `/api/contacts` · `/api/machines` · `/api/technicians` · `/api/products` · `/api/purchases` · `/api/expenses` · `/api/modules/*` · `/api/dashboard` (legacy shop; UI will prefer `/api/today`)

### Add

| Route | Sprint |
| --- | --- |
| `POST /api/sales/[id]/void` | A2 |
| `POST /api/services/[id]/otp/send` | A3 |
| `POST /api/services/[id]/otp/verify` | A3 |
| `POST /api/services/[id]/photos` | A3 |
| `GET /api/me/today` | A4 |
| `POST /api/services/amc/generate` | A4 |
| `GET /api/today` | A4 |

### Do not build / do not extend

- `/api/cylinders` — leave frozen; hide UI.  
- New manufacturing APIs.  
- Wiring `Role.permissions` until WP12 (hide UI).  
- Commission calculate on sales until product asks.

---

## 8. Auth matrix (after A1)

| Role | Field clock | Create job | Void sale | Payroll GET | Seed force | Stock ADJ apply |
| --- | --- | --- | --- | --- | --- | --- |
| viewer | no | no | no | no | no | no |
| cashier | own job if linked tech | yes | no | no | no | no |
| accountant | no* | no* | no | yes | no | no |
| manager | any + GPS override | yes | yes | yes | no | yes |
| admin | any | yes | yes | yes | yes | yes |

\*Keep write permission as today’s `canWrite` includes accountant; if you want accountant read-only on jobs, add `requireMinRole` on services in A1 — **default: accountant keeps write** to avoid blocking month-end billing. Product call: accountant = money only → then services POST `requireMinRole('cashier')` and exclude accountant in a `canFieldWrite()` helper.

**Recommendation:** `canFieldWrite` = cashier | manager | admin (not viewer, not accountant). Payroll = accountant | manager | admin.

---

## 9. Implementation order (files)

```
A0  lib/auth.ts (live user)
    lib/rbac.ts (requireWrite/Payroll)
    lib/audit.ts
    lib/service-clock.ts
A1  proxy.ts
    api/seed/route.ts
    api/services/route.ts + [id]/route.ts
    api/sales/route.ts + [id]/route.ts
    api/expenses/route.ts + [id]/route.ts
    api/contacts/**  api/machines/**  api/technicians/**
    api/products/route.ts  api/purchases/**
    api/payroll/route.ts  api/payslips/**
A2  api/services/[id]/route.ts (clock rules)
    api/sales/[id]/route.ts (strip status)
    api/sales/[id]/void/route.ts (new)
    models Sale status enum +voided
A3  models Contact/Machine/ServiceJob pins + otp + photos
    api/services/[id]/otp/send/route.ts
    api/services/[id]/otp/verify/route.ts
    api/services/[id]/photos/route.ts
    api/services/[id]/route.ts geofence
A4  api/me/today/route.ts
    api/services/amc/generate/route.ts
    api/today/route.ts
    api/crm/.../convert/route.ts (contact upsert)
A5  api/payroll/route.ts visits
    api/modules/[module]/route.ts ADJ apply
    api/services/[id] stock floor
    api/sales/[id]/finalize creditLimit
    api/reports/service/route.ts dates
```

---

## 10. Test plan (API)

Run against local with two cookies: `viewer` and `admin` (and a technician user linked to `Technician.userId`).

| # | Call | Expect |
| --- | --- | --- |
| T1 | viewer POST `/api/services` | 403 |
| T2 | admin POST job + PUT check_in with old date | 200, `checkedInAt` ≈ now |
| T3 | other tech PUT check_in | 400 `not_own_job` |
| T4 | PUT sale `{status:final}` on quotation | status still quotation |
| T5 | DELETE `/api/sales/:id` | 403 `void_only` |
| T6 | POST void `{reason}` as manager | 200, GET list omits it |
| T7 | anonymous POST `/api/seed` | 401 |
| T8 | cashier GET `/api/payroll` | 403 |
| T9 | check_in 1km from pin | 400 `too_far` (A3) |
| T10 | complete without SKU part | 400 `incomplete` gaps sku (A5) |
| T11 | pay_all with 0 visits | 409 `pay_blocked` (A5) |
| T12 | GET `/api/me/today` as tech | only own jobs (A4) |
| T13 | GET `/api/today` | houses + flags + pipeline (A4) |
| T14 | ActivityLog after T2 | row `check_in` (A0/A2) |

---

## 11. Out of API scope (client still required)

WP1 nav hide + elevator seed catalog · WP2 hydration/`KpiCard` · WP3 four-screen layout · WP11 messages/bn.json · WP8 dashboard page consuming `GET /api/today`.

APIs in this plan do not depend on those UI tasks except A4 `GET /api/me/today` is useless until the technician shell exists.

---

## 12. Start tomorrow

1. A0 helpers.  
2. A1 gates on services + sales + expenses + payroll GET + proxy seed.  
3. A2 clock ignore + void route.  
4. Then A3–A5.

Do not start A3 GPS until A1+A2 are green on T1–T8.

---

*Maps to full report WP5–WP12. Existing 53 routes stay unless listed under Add/Do-not-build.*
