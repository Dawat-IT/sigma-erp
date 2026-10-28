import { NextRequest, NextResponse } from "next/server";
import { connectDB, runInTransaction } from "@/lib/db";
import { readSession, hashPassword } from "@/lib/auth";
import { MODULE_MODEL_MAP } from "@/lib/module-models";
import { nextSeq, Product } from "@/models";
import { generateDocNo } from "@/lib/utils";
import { canWrite, hasPermission, roleRank } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const AUTO_DOC_NO: Record<string, { seqKey: string; prefix: string; field: string }> = {
  "purchase-requisitions": { seqKey: "purchase_req", prefix: "REQ", field: "reqNo" },
  "stock-transfers": { seqKey: "stock_transfer", prefix: "TRF", field: "transferNo" },
  "stock-adjustments": { seqKey: "stock_adjustment", prefix: "ADJ", field: "adjustmentNo" },
  "sell-returns": { seqKey: "sell_return", prefix: "SR", field: "returnNo" },
  "purchase-returns": { seqKey: "purchase_return", prefix: "PR", field: "returnNo" },
  shipments: { seqKey: "shipment", prefix: "SHP", field: "shipmentNo" },
  productions: { seqKey: "production", prefix: "PRD", field: "productionNo" },
};

function moduleNeedsUserManage(module: string) {
  return module === "users" || module === "roles";
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ module: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { module } = await ctx.params;
  if (moduleNeedsUserManage(module) && !hasPermission(session.role, "manage_users")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const handler = MODULE_MODEL_MAP[module];
  if (!handler) return NextResponse.json({ data: [], total: 0 });

  await connectDB();
  const { searchParams } = new URL(_req.url);
  const q = searchParams.get("q")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));
  const page = Math.max(1, Number(searchParams.get("page") || 1));

  const filter: Record<string, unknown> = { ...(handler.filter ?? {}) };
  if (handler.softDelete) filter.isActive = true;
  if (q && handler.search) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = handler.search.map((f) => ({ [f]: new RegExp(safe, "i") }));
  }

  const dateFields: Record<string, string> = {
    expenses: "expenseDate",
    purchases: "purchaseDate",
    sales: "saleDate",
    "sell-returns": "returnDate",
    "purchase-returns": "returnDate",
    "stock-transfers": "transferDate",
    "stock-adjustments": "adjustmentDate",
    productions: "productionDate",
  };
  const dateField = dateFields[module];
  if (dateField && (from || to)) {
    filter[dateField] = {};
    if (from) (filter[dateField] as Record<string, Date>).$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      (filter[dateField] as Record<string, Date>).$lte = end;
    }
  }

  const [data, total] = await Promise.all([
    handler.model
      .find(filter)
      .sort(handler.sort || "-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    handler.model.countDocuments(filter),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ module: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { module } = await ctx.params;
  if (moduleNeedsUserManage(module) && !hasPermission(session.role, "manage_users")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const handler = MODULE_MODEL_MAP[module];
  if (!handler) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await connectDB();
  const body = await req.json();

  try {
    if (module === "users" && body.password) {
      body.passwordHash = await hashPassword(String(body.password));
      delete body.password;
    }

    if (module === "accounts" && body.openingBalance != null && body.balance == null) {
      body.balance = Number(body.openingBalance);
    }

    if (module === "expense-categories") {
      body.kind = "expense";
    }
    if (module === "categories") {
      body.kind = body.kind ?? "product";
    }

    if (module === "stock-adjustments" && roleRank(session.role) < roleRank("manager")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const auto = AUTO_DOC_NO[module];
    if (auto && !body[auto.field]) {
      const seq = await nextSeq(auto.seqKey);
      body[auto.field] = generateDocNo(auto.prefix, seq);
    }

    if (module === "sell-returns" || module === "purchase-returns" || module === "shipments") {
      body.grandTotal = Number(body.grandTotal || 0);
    }

    if (module === "sell-returns") {
      body.status = body.status || "Returned";
      const challanNo = String(body.challanNo || "").trim();
      if (challanNo) {
        body.challanNo = challanNo;
        const existing = await handler.model.findOne({ challanNo });
        if (existing) {
          delete body.returnNo;
          const updated = await handler.model.findByIdAndUpdate(existing._id, body, {
            new: true,
            runValidators: true,
          });
          return NextResponse.json({ data: updated });
        }
      }
    }

    if (module === "stock-adjustments") {
      body.createdBy = session.id;
      const created = await runInTransaction(async (mongoSession) => {
        const doc = mongoSession
          ? (await handler.model.create([body], { session: mongoSession }))[0]
          : await handler.model.create(body);
        const locationId = doc.locationId || body.locationId;
        const items = Array.isArray(doc.items) ? doc.items : body.items || [];
        for (const item of items as { productId?: unknown; qtyChange?: number }[]) {
          const change = Number(item.qtyChange || 0);
          if (!item.productId || !change) continue;
          if (locationId) {
            const hit = await Product.updateOne(
              { _id: item.productId, "stocks.locationId": locationId },
              { $inc: { "stocks.$.qty": change, quantity: change } },
              mongoSession ? { session: mongoSession } : {},
            );
            if (!Number(hit.matchedCount || 0)) {
              await Product.updateOne(
                { _id: item.productId },
                { $push: { stocks: { locationId, qty: change } }, $inc: { quantity: change } },
                mongoSession ? { session: mongoSession } : {},
              );
            }
          } else {
            await Product.updateOne(
              { _id: item.productId },
              { $inc: { quantity: change } },
              mongoSession ? { session: mongoSession } : {},
            );
          }
        }
        return doc;
      });
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "stock_adjust",
        entityType: "StockAdjustment",
        entityId: String(created._id),
        details: String(created.adjustmentNo || ""),
      });
      return NextResponse.json({ data: created }, { status: 201 });
    }

    const created = await handler.model.create(body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/modules/${module}`, err);
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
