import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { AmcContract, Contact, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  await AmcContract.createIndexes().catch(() => undefined);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const ending = searchParams.get("ending");
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (ending === "1" || ending === "true") {
    filter.status = "active";
    filter.endDate = { $gte: now, $lte: soon };
  }
  if (q) {
    const people = await Contact.find({
      type: { $in: ["customer", "both"] },
      $or: [{ name: new RegExp(q, "i") }, { nameBn: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }],
    })
      .select("_id")
      .limit(50)
      .lean();
    filter.$or = [
      { contractNo: new RegExp(q, "i") },
      { notes: new RegExp(q, "i") },
      { customerId: { $in: people.map((p) => p._id) } },
    ];
  }

  const [data, total, active, expired, cancelled, endingSoon, money] = await Promise.all([
    AmcContract.find(filter)
      .populate("customerId", "name nameBn mobile location city address")
      .populate("machineId", "brand model serialNo machineType nextServiceDue siteName siteAddress")
      .populate("assignedTechnicianId", "name mobile speciality")
      .sort({ endDate: 1, createdAt: -1 })
      .limit(200)
      .lean(),
    AmcContract.countDocuments(filter),
    AmcContract.countDocuments({ status: "active" }),
    AmcContract.countDocuments({ status: "expired" }),
    AmcContract.countDocuments({ status: "cancelled" }),
    AmcContract.countDocuments({ status: "active", endDate: { $gte: now, $lte: soon } }),
    AmcContract.aggregate([{ $group: { _id: null, billed: { $sum: { $ifNull: ["$amount", 0] } } } }]),
  ]);
  return NextResponse.json({
    data,
    items: data,
    total,
    summary: {
      total: active + expired + cancelled,
      active,
      expired,
      cancelled,
      endingSoon,
      billed: Number((money[0] as { billed?: number } | undefined)?.billed || 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  await connectDB();
  const body = await req.json();
  if (!body.customerId) return NextResponse.json({ error: "missing_customer" }, { status: 400 });
  try {
    const seq = await nextSeq("amc_contract");
    const amount = Number(body.amount || 0);
    const advanceAmount = Number(body.advanceAmount || 0);
    const dueAmount = body.dueAmount != null ? Number(body.dueAmount) : Math.max(0, amount - advanceAmount);

    const row = await AmcContract.create({
      contractNo: generateDocNo("AMC", seq),
      customerId: body.customerId,
      machineId: body.machineId || undefined,
      assignedTechnicianId: body.assignedTechnicianId || undefined,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      cycleDays: Number(body.cycleDays || 90),
      amount,
      advanceAmount,
      dueAmount,
      visitsIncluded: Number(body.visitsIncluded || 4),
      visitsUsed: Number(body.visitsUsed || 0),
      status: body.status || "active",
      contractType: body.contractType || "non_comprehensive",
      billingFrequency: body.billingFrequency || "quarterly",
      siteAddress: body.siteAddress || undefined,
      buildingType: body.buildingType || "residential",
      contactPerson: body.contactPerson || undefined,
      contactPhone: body.contactPhone || undefined,
      emergencyResponseHours: Number(body.emergencyResponseHours || 2),
      resolutionTargetHours: Number(body.resolutionTargetHours || 6),
      serviceWindow: body.serviceWindow || "24/7",
      partsIncluded: body.partsIncluded || (body.contractType === "comprehensive" ? "included" : "excluded"),
      consumablesIncluded: body.consumablesIncluded || "included",
      breakdownVisitsIncluded: body.breakdownVisitsIncluded || "unlimited",
      paymentTerms: body.paymentTerms || undefined,
      nextVisitDate: body.nextVisitDate ? new Date(body.nextVisitDate) : undefined,
      visitTime: body.visitTime || undefined,
      autoRenew: Boolean(body.autoRenew),
      exclusions: body.exclusions || undefined,
      terminationTerms: body.terminationTerms || undefined,
      notes: body.notes,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
