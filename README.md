# Sigma Elevator ERP

Bilingual (বাংলা + English) ERP & POS for elevator sales, spare parts, installation, and service — products, suppliers, purchases, quotations, and stock.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- MongoDB (Mongoose) — Product ↔ ProductSupplier ↔ Contact(supplier)
- next-intl (bn / en)
- jsPDF + ExcelJS invoices
- Recharts dashboard
- GSAP UI motion

## Quick start

```bash
npm install
cp .env.example .env.local
# set MONGODB_URI and AUTH_SECRET
npm run dev
```

Open http://localhost:3000

## Demo login

After first seed (or empty DB bootstrap):

- Email: `admin@sigmaelevator.bd`
- Password: `admin123`

Force reseed requires an **admin** session:

```bash
# POST /api/seed  body: { "force": true }  (must be logged in as admin)
```

## Scripts

```bash
npm run test:crud      # API CRUD smoke against localhost
npm run test:amounts   # financial amount checks
```

**Security:** Do not commit Mongo credentials. `/api/seed` force wipe is admin-only.

## Environment

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/sigma_elevator_erp
AUTH_SECRET=change-me-to-a-long-random-string
NEXT_PUBLIC_APP_NAME=Sigma Elevator ERP
NEXT_PUBLIC_DEFAULT_LOCALE=bn
```

For local demo without Docker you can use `MONGODB_URI=memory` (data resets when the process restarts).

## Deploy (Vercel)

1. Push this repo to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Set environment variables (`MONGODB_URI`, `AUTH_SECRET`, …)
4. Deploy

**Note:** Production needs a real MongoDB Atlas URI — in-memory Mongo does not work on Vercel serverless.

## Modules

- Dashboard KPIs + filters
- POS / quotations (cash / bKash / Nagad / Rocket / card / cheque / credit)
- Sales + invoice PDF / Excel
- Products (supplier price list), Contacts, Purchases, Stock, Expenses
- Reports, Settings
- CRM + Manufacturing helpers
