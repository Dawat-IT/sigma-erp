import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireDelete, requireWrite } from "@/lib/rbac";
import { AmcContract } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  const { id } = await ctx.params;
  const data = await AmcContract.findById(id)
    .populate("customerId", "name nameBn mobile location city address")
    .populate("machineId", "brand model serialNo machineType nextServiceDue siteName siteAddress")
    .populate("assignedTechnicianId", "name mobile speciality")
    .lean();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.customerId) updateData.customerId = body.customerId;
  if ("machineId" in body) updateData.machineId = body.machineId || undefined;
  if ("assignedTechnicianId" in body) updateData.assignedTechnicianId = body.assignedTechnicianId || undefined;
  if (body.startDate) updateData.startDate = new Date(body.startDate);
  if ("endDate" in body) updateData.endDate = body.endDate ? new Date(body.endDate) : undefined;
  if (body.cycleDays != null) updateData.cycleDays = Number(body.cycleDays);
  if (body.amount != null) updateData.amount = Number(body.amount);
  if (body.advanceAmount != null) updateData.advanceAmount = Number(body.advanceAmount);
  if (body.dueAmount != null) updateData.dueAmount = Number(body.dueAmount);
  else if (body.amount != null && body.advanceAmount != null) {
    updateData.dueAmount = Math.max(0, Number(body.amount) - Number(body.advanceAmount));
  }
  if (body.visitsIncluded != null) updateData.visitsIncluded = Number(body.visitsIncluded);
  if (body.visitsUsed != null) updateData.visitsUsed = Number(body.visitsUsed);
  if (body.status != null) updateData.status = body.status;
  if (body.contractType != null) updateData.contractType = body.contractType;
  if (body.billingFrequency != null) updateData.billingFrequency = body.billingFrequency;
  if ("siteAddress" in body) updateData.siteAddress = body.siteAddress;
  if (body.buildingType != null) updateData.buildingType = body.buildingType;
  if ("contactPerson" in body) updateData.contactPerson = body.contactPerson;
  if ("contactPhone" in body) updateData.contactPhone = body.contactPhone;
  if (body.emergencyResponseHours != null) updateData.emergencyResponseHours = Number(body.emergencyResponseHours);
  if (body.resolutionTargetHours != null) updateData.resolutionTargetHours = Number(body.resolutionTargetHours);
  if (body.serviceWindow != null) updateData.serviceWindow = body.serviceWindow;
  if (body.partsIncluded != null) updateData.partsIncluded = body.partsIncluded;
  if (body.consumablesIncluded != null) updateData.consumablesIncluded = body.consumablesIncluded;
  if (body.breakdownVisitsIncluded != null) updateData.breakdownVisitsIncluded = body.breakdownVisitsIncluded;
  if ("paymentTerms" in body) updateData.paymentTerms = body.paymentTerms;
  if ("nextVisitDate" in body) updateData.nextVisitDate = body.nextVisitDate ? new Date(body.nextVisitDate) : undefined;
  if ("visitTime" in body) updateData.visitTime = body.visitTime;
  if (body.autoRenew != null) updateData.autoRenew = Boolean(body.autoRenew);
  if ("exclusions" in body) updateData.exclusions = body.exclusions;
  if ("terminationTerms" in body) updateData.terminationTerms = body.terminationTerms;
  if ("notes" in body) updateData.notes = body.notes;

  const updated = await AmcContract.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true },
  );
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;
  await connectDB();
  const { id } = await ctx.params;
  const deleted = await AmcContract.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
