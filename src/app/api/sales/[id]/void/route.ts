import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB, runInTransaction } from "@/lib/db";
import { requireDelete } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { Sale, Product, Contact } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

function ensureVoidFields() {
  if (!Sale.schema.path("voidReason")) {
    Sale.schema.add({
      voidReason: String,
      voidedAt: Date,
      voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    });
  }
  const statusPath = Sale.schema.path("status") as { enumValues?: string[] };
  if (statusPath?.enumValues && !statusPath.enumValues.includes("voided")) {
    statusPath.enumValues.push("voided");
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (!reason) {
    return NextResponse.json({ error: "need_reason" }, { status: 400 });
  }

  await connectDB();
  ensureVoidFields();

  const existing = await Sale.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "voided") {
    return NextResponse.json({ error: "already_voided" }, { status: 400 });
  }

  try {
    const sale = await runInTransaction(async (mongoSession) => {
      const doc = mongoSession ? await Sale.findById(id).session(mongoSession) : await Sale.findById(id);
      if (!doc) throw new Error("not_found");
      const wasFinal = doc.status === "final";

      if (wasFinal && doc.locationId) {
        for (const it of doc.items || []) {
          const restore = Number(it.qty || 0) + Number(it.bonusQty || 0);
          if (!it.productId || restore <= 0) continue;
          await Product.updateOne(
            { _id: it.productId, "stocks.locationId": doc.locationId },
            { $inc: { "stocks.$.qty": restore } },
            mongoSession ? { session: mongoSession } : {},
          );
        }
      }
      if (wasFinal && doc.customerId && Number(doc.dueAmount || 0) > 0) {
        await Contact.updateOne(
          { _id: doc.customerId },
          { $inc: { balance: -Number(doc.dueAmount || 0) } },
          mongoSession ? { session: mongoSession } : {},
        );
      }

      doc.status = "voided";
      doc.voidReason = reason;
      doc.voidedAt = new Date();
      doc.voidedBy = session.id as never;
      await doc.save(mongoSession ? { session: mongoSession } : undefined);
      return doc;
    });

    await writeAudit({
      userId: session.id,
      userName: session.name,
      action: "void_sale",
      entityType: "Sale",
      entityId: String(sale._id),
      details: reason,
    });

    return NextResponse.json({ data: sale.toObject?.() || sale });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
