import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { LedgerAccount } from "@/models";
import { canWrite, canDelete } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q")?.trim();

  const filter: Record<string, unknown> = { isActive: true };
  if (type) filter.type = type;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { nameBn: new RegExp(q, "i") },
      { code: new RegExp(q, "i") },
    ];
  }

  const data = await LedgerAccount.find(filter).sort({ code: 1 }).lean();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const type = String(body.type || "").trim();
  if (!code || !name || !type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const doc = await LedgerAccount.create({
      code,
      name,
      nameBn: body.nameBn,
      type,
      openingBalance: Number(body.openingBalance || 0),
      balance: Number(body.openingBalance || body.balance || 0),
      isActive: true,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return NextResponse.json({ error: "duplicate_code" }, { status: 409 });
    }
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectDB();
  const body = await req.json();
  const id = body._id || body.id;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const $set: Record<string, unknown> = {};
  if (body.code != null) $set.code = String(body.code).trim();
  if (body.name != null) $set.name = String(body.name).trim();
  if (body.nameBn != null) $set.nameBn = body.nameBn;
  if (body.type != null) $set.type = body.type;
  if (body.openingBalance != null) {
    const opening = Number(body.openingBalance);
    const existing = await LedgerAccount.findById(id).lean();
    if (existing) {
      const oldOpening = Number(existing.openingBalance || 0);
      const oldBal = Number(existing.balance || 0);
      $set.openingBalance = opening;
      $set.balance = oldBal - oldOpening + opening;
    }
  }

  const updated = await LedgerAccount.findByIdAndUpdate(id, { $set }, { new: true });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canDelete(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectDB();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const updated = await LedgerAccount.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, soft: true });
}
