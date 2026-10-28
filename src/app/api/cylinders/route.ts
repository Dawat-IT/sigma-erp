import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Contact, CylinderMovement, Location, Product } from "@/models";
import { canWrite, canDelete } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const partyType = searchParams.get("partyType");
  const partyId = searchParams.get("partyId");
  const productId = searchParams.get("productId");
  const limit = Math.min(500, Number(searchParams.get("limit") || 100));

  const filter: Record<string, unknown> = {};
  if (partyType) filter.partyType = partyType;
  if (partyId) filter.partyId = partyId;
  if (productId) filter.productId = productId;

  const data = await CylinderMovement.find(filter)
    .sort({ movementDate: -1, createdAt: -1 })
    .limit(limit)
    .lean();
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
  const productId = String(body.productId || "");
  const partyType = String(body.partyType || "") as "customer" | "supplier" | "warehouse";
  const delivered = Math.max(0, Number(body.delivered || 0));
  const received = Math.max(0, Number(body.received || 0));

  if (!productId || !["customer", "supplier", "warehouse"].includes(partyType)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (delivered === 0 && received === 0) {
    return NextResponse.json({ error: "zero_qty" }, { status: 400 });
  }

  const product = await Product.findById(productId).lean();
  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  let partyId = body.partyId ? String(body.partyId) : undefined;
  let partyName = String(body.partyName || "").trim();

  if (partyType === "warehouse") {
    if (partyId) {
      const loc = await Location.findById(partyId).lean();
      if (!loc) return NextResponse.json({ error: "party_not_found" }, { status: 404 });
      partyName = partyName || loc.name;
    } else {
      partyName = partyName || "Warehouse";
    }
  } else {
    if (!partyId) return NextResponse.json({ error: "missing_party" }, { status: 400 });
    const contact = await Contact.findById(partyId).lean();
    if (!contact) return NextResponse.json({ error: "party_not_found" }, { status: 404 });
    partyName = partyName || contact.nameBn || contact.name;
  }

  const prev = await CylinderMovement.findOne({
    productId,
    partyType,
    ...(partyId ? { partyId } : { partyName }),
  })
    .sort({ movementDate: -1, createdAt: -1 })
    .lean();

  const prevBal = Number(prev?.balance || 0);
  const balance = prevBal + delivered - received;

  const doc = await CylinderMovement.create({
    movementDate: body.movementDate ? new Date(body.movementDate) : new Date(),
    productId,
    productName: product.nameBn || product.name,
    partyType,
    partyId: partyId || undefined,
    partyName,
    delivered,
    received,
    balance,
    note: String(body.note || "").trim(),
    createdBy: session.id,
  });

  return NextResponse.json({ data: doc }, { status: 201 });
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
  await CylinderMovement.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
