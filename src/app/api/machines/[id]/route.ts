import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireDelete, requireWrite } from "@/lib/rbac";
import { parseCoord } from "@/lib/service-field";
import { Machine, ServiceJob } from "@/models";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const item = await Machine.findById(id)
    .populate("customerId", "name nameBn mobile phone whatsapp address location city contactPerson")
    .lean();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const jobs = await ServiceJob.find({ machineId: id })
    .populate("technicianId", "name mobile")
    .sort({ reportedAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json({ data: item, jobs });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const coords = parseCoord(body.lat, body.lng);
  if (coords) {
    body.lat = coords.lat;
    body.lng = coords.lng;
  }

  try {
    const updated = await Machine.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;

  await connectDB();
  const { id } = await params;
  const deleted = await Machine.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
