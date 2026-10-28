# Sigma Elevator ERP — full report

**One document.** Merges UI/UX SQA (21 Sep), anti-faki / CEO control v2, and company-fit v2 (23 Sep). This is the only plan to follow.

**Product:** Sigma Elevator ERP (`sigma-erp`)  
**Company:** ~400 houses, ~30 staff, 3–4 lift visits per technician per day, parts on the job, new lifts as proposal → quotation → confirm, then follow-up  
**Date:** 23 Sep 2026  
**Method:** Live UI walkthrough (566×692) + Nielsen/WCAG; all 53 API routes; nav (92 hrefs), seed catalog, models, RBAC vs real checks  

**Older files are pointers only:** `docs/ui-ux-sqa-report.md` · `docs/ceo-ops-control-report.md` · `docs/company-fit-report.md`  
**API implementation:** [docs/api-build-plan.md](./api-build-plan.md) — sprints A0–A5, route map, error codes, tests T1–T14.

---

## Contents

1. [Verdict and scores](#1-verdict-and-scores)  
2. [How this company works](#2-how-this-company-works)  
3. [What the software is](#3-what-the-software-is)  
4. [Keep / cut / add](#4-keep--cut--add)  
5. [UI / UX](#5-ui--ux)  
6. [Employee faki and money holes](#6-employee-faki-and-money-holes)  
7. [CEO and company ease](#7-ceo-and-company-ease)  
8. [Twelve work packages (the solution)](#8-twelve-work-packages-the-solution)  
9. [Every defect → package](#9-every-defect--package)  
10. [Done when](#10-done-when)  

---

## 1. Verdict and scores

This is a **retail POS / electronics-lab ERP**, rebranded Sigma Elevator, with real elevator desks **bolted on**. Useful pieces exist (dispatch, PRP→SIG→order, service catalog, payroll sheet). The shell, catalog, and 92-link sidebar still belong to the previous company. Check-in is an honour system. **Any logged-in user can write jobs and delete sales.**

Do **not** hand 30 logins and believe 400-house service happened. Do **not** pay salary from this clock yet.

| Gate | Score | After WP1–5 | After all 12 |
| --- | --- | --- | --- |
| Fit for *this* company | **46 / 100** | ~72 | ~88 |
| UI / UX (production sign-off) | **54 / 100 Fail** | ~75 | ~85 |
| Field proof (was the tech at the house?) | **31 / 100** | ~48 | ~82 |
| Stop employee faki | **31 / 100** | ~55 | ~80 |
| CEO / company ease | **38 / 100** | ~60 | ~85 |
| Office documents (PRP / SIG / payroll) | **70 / 100** | ~78 | ~85 |
| **30 staff × 400 houses go-live** | **No** | Office only | **Yes** |

**~58 unique problems** (23 UX + 28 control + 18 fork/IA + 6 data-dup, deduped). **12 work packages** close all of them. **WP1–WP5 first** close ~35 without GPS.

Internal **desktop sales demo** is usable. Client UAT, Bangla field use, and production UX are **not**.

---

## 2. How this company works

Four loops. Software that does not serve these is waste.

| Loop | Who | Perfect | Today |
| --- | --- | --- | --- |
| **A. Daily service** | ~20 techs + dispatcher | Morning 3–4 houses each with address. Check-in, service + parts, check-out, sometimes cash. Evening: skipped / too-fast. | Dispatch exists. 92-link desktop. No GPS. Phone UI fails SQA. |
| **B. 400-house AMC** | Service manager | Calendar fills tomorrow’s board. | `nextServiceDue` only. ARM buried under HR. |
| **C. New lift** | BD / sales | Lead → follow-up → **proposal** → **quotation** → **confirm** → install → AMC. | Pipeline works. Catalog is Arduino. |
| **D. People & money** | Admin / accountant | 30 salaries match visits. Van stock matches ERP. CEO: one screen. | Payroll sheet. Visits ignored. Stock ADJ is paper. Dashboard is shop KPIs. |

**Planning math (not a live KPI):** 20 field techs × 3.5 ≈ **70 visits/day**. Monthly AMC on 400 houses ≈ 18/day; quarterly ≈ 6/day. Rest = breakdowns + parts + snagging.

| Reality | Software | Gap |
| --- | --- | --- |
| 400 houses | Customer + machine + job snapshot. No lat/lng. | Cannot geofence. |
| 30 people | User + Employee + Technician = three lists. `userId` unused on clock. | Office punches for the tech. |
| 3–4 houses/day | Dispatch hint only. | No payroll consequence. |
| Time on site | Clock exists; client may send `checkedInAt`. | Fake hours. |
| Parts on the job | SKU deducts (can go negative). Free-text deducts nothing. ADJ does not change qty. | Steal + cover. |
| New lift | Finalize blocks skip-quotation. PUT can still set `status=final`. | Skip stock / pipeline. |

---

## 3. What the software is

| Layer | Reality |
| --- | --- |
| Engine | Next.js 16, MongoDB, JWT httpOnly cookie (7d), bn/en |
| Design | One token set — **keep** |
| Sales | `/pos` is “make a document” (proposal/quotation/invoice) — **keep, rename** |
| Elevator add-ons | Dispatch, visit clock, house address, service catalog (PM, door, VVVF, ARD), checklists, technician file, payroll desk, CRM follow-up — **keep, finish** |
| Fork leftover | Arduino catalog, Cylinders, Manufacturing stub, 13 product-admin links, 17 Sales links, 19 retail reports, Nur/DIT demo logins, Roles page that does nothing |
| Surface | **70 pages · 53 APIs · 92 sidebar hrefs.** 13 APIs import `canWrite`. |

---

## 4. Keep / cut / add

| Keep | Cut from daily UI (hide first) | Add (via §8 packages) |
| --- | --- | --- |
| Tokens, login, bn/en | Cylinders, manufacturing stub | Technician 4-screen (WP3) |
| Dispatch, clock, house address | Arduino / DIT Lab / MakerEEE catalog | House master (WP4) |
| Elevator **service** catalog + checklists | Customers **and** Clients (merge) | AMC auto-dispatch (WP7) |
| Technician file (profile + all jobs) | Deals, campaigns | Company today home (WP8) |
| PRP → SIG → confirm (`need_quotation`) | HR Business Dev / Account / ARM | GPS + photo + OTP (WP6) |
| Leads + follow-up + convert history | Roles theatre, unused commission | Write locks, void not delete (WP5) |
| Payroll month grid (POST already gated) | Labels, barcodes, printers, subscription | Pay vs visits (WP9) |
| Purchases, expenses, journals | 10+ empty generic reports | Real stock ADJ (WP10) |
| Machines + install projects | Demo `ditpharma` / `nureng` logins | Bangla field UI (WP11) |
| Cost price hidden from non-admin | 92-link sidebar for field staff | Live audit log (WP12) |

**Nav diet:** 92 hrefs → **~22 admin**, **4 technician**, **8 CEO**. Hide routes first; delete cylinders/manufacturing after one release.

**Target admin nav:** Today · Houses · Dispatch · Jobs · Technicians · Leads · Follow-up · Proposals · Quotations · Orders · Parts · Purchases · Stock · Employees · Payroll · Users · Dues · Expenses · P&L · Settings.

**Technician:** Today · This house · Clock · Parts — no sidebar.

---

## 5. UI / UX

**Production UX sign-off: Fail. Overall 54/100.** 23 defects (1 P0 · 3 P1 · 10 P2 · 9 P3). Viewport 566×692 walkthrough + source.

### Score by quality area

Pass ≥ 70 · Conditional 50–69 · Fail &lt; 50.

| Area | Score | Gate | Evidence |
| --- | --- | --- | --- |
| Visual design system | 72 | Pass | Shared tokens, cards, tables, navy sidebar |
| Information architecture | 48 | Fail | 17-item Sales; HR holds BD / Accounts / ARM |
| Interaction & forms | 58 | Conditional | POS powerful but dense; dead KPI affordances |
| Accessibility (WCAG 2.2) | 42 | Fail | Hydration, fake buttons, modal no trap/Escape |
| i18n (bn / en) | 55 | Conditional | Login bn then dashboard en; new desks EN-only |
| Responsive / mobile | 50 | Fail | 566px title clip, KPI height, sidebar overflow |
| Feedback & empty states | 52 | Conditional | Skeletons exist; fetch errors look like empty |
| Brand / domain fit | 46 | Fail | Electronics catalog, Cylinders, Nur CSS comment |

**What works.** `gp-card` / `gp-table` / `gp-btn`, `PageHeader`, `FilterBar`. Login split-panel is the strongest branded screen. Desktop POS packs customer, lines, terms, payment. Technical playbooks/SLA/checklists are good (not translated). Demo login is one tap.

### UX defect log

P0 blocks release. P1 before client UAT. P2 before go-live. P3 polish.

| ID | Sev | Title | Evidence | Where | WP |
| --- | --- | --- | --- | --- | --- |
| UX-01 | P0 | Hydration mismatch Login/POS | `payRow()` uses `Date.now()`+`Math.random()` in initial state | `pos/page.tsx`, `SellReturnForm.tsx` | WP2 |
| UX-02 | P1 | KPI always clickable | `KpiCard` is always a button with View → | `ui.tsx` | WP2 |
| UX-03 | P1 | POS header clips on mobile | 566px title “Quotatio” | `pos/page.tsx` | WP2 |
| UX-04 | P1 | Language jumps after login | Auth writes `NEXT_LOCALE` from `user.locale` | `api/auth/login` | WP2 |
| UX-05 | P2 | Sales & CRM = 17 destinations | Customers beside Clients; POS labeled Quotation | `navigation.ts` | WP1+8 |
| UX-06 | P2 | HR holds non-HR | BD, Account, ARM under payroll | `navigation.ts` | WP1+4 |
| UX-07 | P2 | New desks English-only | Technical, Projects, ARM, Payroll copy | `services/`, `hr/` | WP11 |
| UX-08 | P2 | Chrome mixes bn/en | সিস্টেম অ্যাডমিন over English shell | `AppShell.tsx` | WP11 |
| UX-09 | P2 | Mobile sidebar hides Logout | Brand truncates; Sales list pushes Logout down | `AppShell.tsx` | WP3 |
| UX-10 | P2 | KPI min-height 148px | Table below fold on phone | `ui.tsx` | WP2 |
| UX-11 | P2 | Failed fetch = empty data | `.then()` no catch; zeros while seed runs | HR, technical | WP8 |
| UX-12 | P2 | Catalog is electronics | Arduino, DIT Lab, MakerEEE | `seed-data.ts` | WP1 |
| UX-13 | P2 | Modal incomplete | No Escape, no trap, ✕ unnamed | `ui.tsx` Modal | WP2 |
| UX-14 | P2 | Info tone is green | `#22c55e` on overdue/PM due | `ui.tsx` | WP2 |
| UX-15 | P3 | Cylinders in stock | Gas/pharma ledger | `stock/cylinders` | WP1 |
| UX-16 | P3 | Show password English-only | Bangla login | `login/page.tsx` | WP11 |
| UX-17 | P3 | Native date US format | 09/21/2026 | POS | WP11 |
| UX-18 | P3 | English headings Georgia | `--font-display` | `globals.css` | polish |
| UX-19 | P3 | EmptyState inside table cells | Double chrome | HR/Technical | polish |
| UX-20 | P3 | No skip-to-content | Few aria-labels | app/components | polish |
| UX-21 | P3 | PDF forces English | `pdfHref` `locale=en` | `InvoiceActions.tsx` | WP11 |
| UX-22 | P3 | Theme comment Nur Engineering | `globals.css` | WP1 |
| UX-23 | P3 | Add Quotation = POS | Both `/pos` | `[...slug]/page.tsx` | WP1 |

### Nielsen heuristics

| Heuristic | Result | Note |
| --- | --- | --- |
| Visibility of status | Fail | Hydration overlay; silent fetch; seed 0 then 27 |
| Match real world | Fail | Cylinders, Arduino, Customers vs Clients |
| User control | Conditional | Filters exist; modal no Escape |
| Consistency | Fail | Dedicated vs ModulePage; mixed i18n |
| Error prevention | Conditional | Login required fields; POS save until cart |
| Recognition vs recall | Fail | ARM acronym; 18 reports no search |
| Flexibility | Pass | bn/en; POS as quotation/bill/challan |
| Minimalist design | Fail | 17 Sales links; fake KPI View |
| Error recovery | Conditional | `error.tsx` English-only |
| Help | Conditional | Playbooks good; not translated |

**Live notes.** Login overlay “1 Issue”. After demo login `html lang` → en. KPI announces as button. Technical KPIs 0→27 after fetch, View still dead. POS catalog lab electronics.

**UAT sign-off:** re-test after UX-01–04. No Bangla client UAT until Service/HR strings are in `messages/*.json`. Replace demo catalog before any sales demo.

**Why UX is company-fit, not polish:** if a technician cannot finish a house in 15 seconds in Bangla, they WhatsApp the office; office types ghost jobs; GPS and AMC never get used.

---

## 6. Employee faki and money holes

Check-in is a **claim**, not a witness. Permissions are a **sticker**. Stock can **lie**.

### Presence and identity

| ID | Sev | Cheat | Evidence | Fix | WP |
| --- | --- | --- | --- | --- | --- |
| F-01 | P0 | Ghost check-in | No lat/lng. Map = Google search URL. | Geofence 150–300 m | WP6 |
| F-02 | P0 | Fake clock time | PUT accepts `body.checkedInAt` | Server `new Date()` only | WP5 |
| F-03 | P0 | Edit clock later | PUT sets in/out without `check_in` | Immutable; admin + log | WP5 |
| F-04 | P0 | Fake customer OK | Text “OK” unlocks Complete | SMS OTP / signed photo | WP6 |
| F-05 | P0 | No photo | No job upload | Site photo at check-in | WP6 |
| F-06 | P0 | Anyone clocks anyone | No `canWrite`; `technician.userId` unused | Own-job + canWrite | WP5 |
| F-07 | P1 | Inflate previous job | Auto-checkout = travel billed as labour | Split travel; flag &lt;15m / &gt;4h | WP6 |

### Permission (biggest drop in control score)

| ID | Sev | Cheat | Evidence | Fix | WP |
| --- | --- | --- | --- | --- | --- |
| F-21 | P0 | Viewer runs the company | Services/sales/expenses: `readSession` only | `canWrite` on mutate | WP5 |
| F-22 | P0 | Delete the invoice | `DELETE /api/sales/[id]` no `canDelete` | Void only, admin | WP5 |
| F-13 | P1 | Everyone sees every menu | Full `NAV_TREE`; proxy = cookie only | Role shells | WP3+8 |
| F-23 | P1 | Fired staff still in | JWT role 7 days; DB demote ignored | Re-read User each request | WP5 |
| F-24 | P1 | Roles theatre | `Role.permissions[]` never read | Hide or wire | WP12 |
| F-25 | P1 | Payroll leak | GET returns every net pay | `canManagePayroll` on GET | WP5 |
| F-14 | P2 | Expense faki | Expenses POST: login only | canWrite + cap | WP5 |
| F-15 | P2 | Demo admin forever | Seed resets hash to `admin123` | Production: no reset | WP1 |
| F-16 | P2 | Open seed | `proxy.ts` allows anonymous POST `/api/seed` | Admin/secret | WP5 |

### Money, parts, salary

| ID | Sev | Cheat | Evidence | Fix | WP |
| --- | --- | --- | --- | --- | --- |
| F-08 | P1 | Ghost parts | Free-text part: bill yes, stock no | SKU mandatory | WP10 |
| F-26 | P1 | Negative stock | `$inc` with no floor | Reject if qty short | WP10 |
| F-27 | P0 | Paper stock ADJ | Adjustment row; Product.qty unchanged | `$inc` in same txn | WP10 |
| F-09 | P1 | Discount / cash | No second approver; PUT can rewrite totals | Discount → manager | WP10 |
| F-28 | P1 | Credit limit unused | Saved on Contact; never read on sales | Block finalize | WP10 |
| F-29 | P2 | Commission unused | Seed/UI only | Hide | WP12 |
| F-10 | P1 | Salary without work | `pay_all` ignores visits | Expected 22×3.5; block | WP9 |
| F-11 | P1 | No office attendance | Field clock ≠ day punch | Simple punch later | WP9 |
| F-12 | P1 | Invisible cheating | ActivityLog only in seed | Live append | WP12 |
| F-30 | P1 | Skip quotation via PUT | PUT can set `status=final` | Finalize only | WP5 |
| F-17 | P2 | Service report wrong date | Filters `receivedDate` | `checkedInAt` / `completedAt` | WP12 |

### Skip-the-app / houses

| ID | Sev | Cheat | Evidence | WP |
| --- | --- | --- | --- | --- |
| F-18 | P1 | Skip the app → ghost jobs | UX fail on phone | WP3 |
| F-19 | P3 | Dual house records | Contact vs Client vs Lead vs Machine | WP4 |
| F-31 | P2 | Fake follow-up | Note + datetime only | later |
| F-20 | P3 | Checklist honour | `done: true` checkbox | WP12 |
| F-32 | P2 | AMC not dispatched | ARM lists due; no jobs created | WP7 |

**Keep (do not throw away):** dispatch board, complete gate, one open site per tech, technician file, PRP→SIG→finalize `need_quotation`, CRM history, payroll POST gate, httpOnly cookie, SKU deduct when `productId` set.

**Company rules to encode:** No GPS = no visit (max 2 overrides/week). No OTP/photo = cannot complete. 0 houses = unpaid day unless leave. Parts from stock only. Cash in by 8 pm. Below 70% visits blocks `pay_all`. One login one technician. Admin void only — never delete.

---

## 7. CEO and company ease

Home dashboard is **shop KPIs** (sales, purchase due, low stock). CEO needs:

| Question | Needed | Exists |
| --- | --- | --- |
| Koto house ajke? Skip? | Planned / on-site / done / skipped | Dispatch only, not home |
| Ke faki dicche? | Too-fast, off-map, 0-visit, deleted invoices | No |
| Taka? | Service + parts + undeposited cash | Shop sales |
| New lifts? | PRP / SIG / INV | Three buried lists |
| Pay korte pari? | Visits vs expected % | Payroll ignores visits |
| 400 house AMC? | Calendar + auto jobs | ARM under HR |

**Decoys:** HR Account (last 8 invoices), HR ARM, HR Business Dev, Roles, Activity log (seed), Cylinders, Manufacturing stub, generic `/api/reports/[type]` label/value tiles.

**Target home — Company today (WP8):** 52/70 houses · faki flags · money · pipeline · overdue follow-ups · payroll risk.

**Three apps, one database.** Technician phone (15s/house). Supervisor dispatch + overrides. CEO Company today only.

---

## 8. Twelve work packages (the solution)

Do in order. Hide before delete. Do not add printers/reports before WP8.

### WP1 — Look like Sigma (~2 days)

Hide from `NAV_TREE`: cylinders, manufacturing, deals, campaigns, business-dev, hr/accounts, hr/arm, commission-agents, roles, discounts, import sales, variations, labels, price-groups, barcodes, printers, subscription, 10 retail reports. Keep P&L, stock, service, dues, expense.

Replace `src/lib/seed-data.ts` catalog: door operator, VVVF, COP/LOP, rope, oil, rollers, PCB, ARD battery, buttons.

Production: only `admin@sigmaelevator.bd`; **do not** reset password. Rename POS label to New quotation / New order. Sales home = Proposals, Quotations, Orders.

**Kills:** UX-12, 15, 22, 23, F-15, fork leftover.

### WP2 — UI blockers (~1–2 days)

| Defect | Exact fix |
| --- | --- |
| UX-01 | `payRow` id `"pay-0"` counter; never `Date.now()` in `useState` initial (`pos/page.tsx`, `SellReturnForm.tsx`) |
| UX-02 | `KpiCard` = `<div>` unless `onClick`; hide View → |
| UX-03/10 | Wrap header actions; drop min-h 148px on small screens |
| UX-04 | Do not overwrite locale cookie if user already chose bn |
| UX-13 | Escape, `role="dialog"`, named close |
| UX-14 | info tone = blue |

**Kills:** UX-01–04, 10, 13, 14.

### WP3 — Technician 4-screen (~1 week)

Layout without sidebar (`/m` or `/services/today`). Today = dispatch filtered to me. House = job + call + maps. Clock = existing VisitClock. Parts = existing lines.

**Kills:** UX-09, F-18.

### WP4 — One house master (~1 week)

Contact = House (address, lat/lng, AMC). Machines under it. Lead convert updates that Contact. `/crm/clients` → `?stage=amc`. `/hr/arm` → Houses `due=1`.

**Kills:** F-19, UX-05/06 (part).

### WP5 — Locks (~3 days)

`canWrite` on services/sales/expenses/contacts/machines/technicians mutate. Sales: **void**, never DELETE. PUT cannot set `status=final`. Ignore client clock times. Own-job clock. `readSession` reloads `isActive`+role from DB. Payroll GET gated. Gate `/api/seed`. Filter nav by role.

**Kills:** F-02, 03, 06, 14, 16, 21, 22, 23, 25, 30. Maximum faki close **without GPS**.

### WP6 — Prove the visit (~2–3 weeks)

lat/lng on house. Check-in coords; reject &gt;300 m. Photo. SMS OTP. Duration flags. Travel ≠ labour.

**Kills:** F-01, 04, 05, 07.

### WP7 — AMC fills dispatch (~1 week)

`nextServiceDue` → create scheduled jobs, round-robin 3–4 per tech. Dispatcher edits exceptions.

**Kills:** F-32.

### WP8 — Company today + nav (~1 week)

Admin `/` = Company today (five numbers in §7). Nav ~22 links. Fetch error banners (UX-11).

**Kills:** UX-05/06, shop dashboard.

### WP9 — Pay vs visits (~3 days)

Expected = working days × 3.5. Payroll column %. `pay_all` 409 if anyone &lt;70% without tick. Attendance later.

**Kills:** F-10, F-11 (partial).

### WP10 — True stock (~1 week)

SKU required on complete; reject negative. Adjustment `$inc` qty, manager. Credit limit on finalize. Discount &gt;0 → manager.

**Kills:** F-08, 09, 26, 27, 28.

### WP11 — Bangla + PDFs (~3 days)

Dispatch/jobs/payroll/tech shell in `messages/bn.json`. DD/MM/YYYY. PDF locale from session. Show-password translated.

**Kills:** UX-07, 08, 16, 17, 21.

### WP12 — Audit + leftovers (~1 week)

Live ActivityLog on clock, complete, void, pay, stock, discount. Hide Roles/commission. Service report dates. Checklist photos on brake/door after WP6.

**Kills:** F-12, 17, 20, 24, 29, SQA P3 remainder.

---

## 9. Every defect → package

UX-01→WP2 · UX-02→WP2 · UX-03→WP2 · UX-04→WP2 · UX-05→WP1+8 · UX-06→WP1+4 · UX-07→WP11 · UX-08→WP11 · UX-09→WP3 · UX-10→WP2 · UX-11→WP8 · UX-12→WP1 · UX-13→WP2 · UX-14→WP2 · UX-15→WP1 · UX-16→WP11 · UX-17→WP11 · UX-18 polish · UX-19 polish · UX-20 polish · UX-21→WP11 · UX-22→WP1 · UX-23→WP1  

F-01→WP6 · F-02→WP5 · F-03→WP5 · F-04→WP6 · F-05→WP6 · F-06→WP5 · F-07→WP6 · F-08→WP10 · F-09→WP10 · F-10→WP9 · F-11→WP9 · F-12→WP12 · F-13→WP3+8 · F-14→WP5 · F-15→WP1 · F-16→WP5 · F-17→WP12 · F-18→WP3 · F-19→WP4 · F-20→WP12 · F-21→WP5 · F-22→WP5 · F-23→WP5 · F-24→WP12 · F-25→WP5 · F-26→WP10 · F-27→WP10 · F-28→WP10 · F-29→WP12 · F-30→WP5 · F-31 later · F-32→WP7  

---

## 10. Done when

1. Technician: **four Bangla screens**, no 92-link sidebar.  
2. Arduino, cylinders, manufacturing, Nur/DIT logins **not visible**.  
3. Viewer **cannot** complete a job or delete a sale.  
4. Check-in time is **server**; off-map **rejected**.  
5. One building = **one House** with lifts under it.  
6. Tomorrow’s dispatch **mostly generated** from AMC.  
7. Quotation looks like a **lift**; PDF locale follows UI.  
8. CEO login = **Company today**.  
9. `pay_all` refuses 0-visit staff.  
10. Stock ADJ **changes qty**. Activity log has **real** rows.  
11. Hydration overlay **gone**. KPIs not fake buttons.  
12. Phone walkthrough passes Bangla UAT.

Until 1–4: office prototype. Until 5–10: not Sigma’s OS. Until 11–12: first-click UAT fail.

**Do not:** add more ERP pages before WP8; let office complete jobs at 11 pm; keep Customers and Clients both in nav after WP4; rebuild POS (rename it).

---

*Sources: 70 pages, 53 APIs, `navigation.ts`, `seed-data.ts`, `service-catalog.ts`, `rbac.ts`, `auth.ts`, `proxy.ts`, `services/[id]/route.ts`, `sales/[id]/route.ts` PUT/DELETE, `modules/[module]/route.ts`, `pos/page.tsx` payRow, `ui.tsx` KpiCard, `reports/[type]/route.ts`, live SQA 21 Sep 2026, API/RBAC pass 23 Sep 2026.*
