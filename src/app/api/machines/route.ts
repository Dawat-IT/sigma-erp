import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { parseCoord } from "@/lib/service-field";
import { Contact, Machine, ServiceJob, Technician } from "@/models";

function dayStart(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayEnd(iso: string) {
  const d = new Date(`${iso}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function withLastService(machines: Array<Record<string, unknown>>) {
  const ids = machines.map((row) => row._id).filter(Boolean);
  if (!ids.length) return machines;
  const last = await ServiceJob.aggregate([
    { $match: { machineId: { $in: ids } } },
    { $sort: { completedAt: -1, reportedAt: -1, createdAt: -1 } },
    {
      $group: {
        _id: "$machineId",
        jobNo: { $first: "$jobNo" },
        status: { $first: "$status" },
        completedAt: { $first: "$completedAt" },
        reportedAt: { $first: "$reportedAt" },
        technicianId: { $first: "$technicianId" },
        durationMinutes: { $first: "$durationMinutes" },
      },
    },
  ]);
  const techIds = last.map((row) => row.technicianId).filter(Boolean);
  const techs = techIds.length
    ? await Technician.find({ _id: { $in: techIds } }).select("name mobile").lean()
    : [];
  const techMap = new Map(techs.map((row) => [String(row._id), row]));
  const lastMap = new Map(
    last.map((row) => [
      String(row._id),
      {
        jobNo: row.jobNo,
        status: row.status,
        completedAt: row.completedAt,
        reportedAt: row.reportedAt,
        durationMinutes: row.durationMinutes,
        technician: row.technicianId ? techMap.get(String(row.technicianId)) || null : null,
      },
    ]),
  );
  return machines.map((row) => ({ ...row, lastService: lastMap.get(String(row._id)) || null }));
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const due = searchParams.get("due");
  const upcoming = searchParams.get("upcoming");
  const warranty = searchParams.get("warranty");
  const schedule = searchParams.get("schedule");
  const machineType = searchParams.get("type") || searchParams.get("equipmentType");
  const customerId = searchParams.get("customerId");
  const q = searchParams.get("q")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const pageParam = searchParams.get("page");
  const page = Math.max(1, Number(pageParam || 1));
  const limit = Math.min(500, Number(searchParams.get("limit") || (pageParam ? 50 : 500)));

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const filter: Record<string, unknown> = {};
  if (customerId) filter.customerId = customerId;
  if (machineType) filter.machineType = machineType;

  const dueConds: Record<string, unknown>[] = [];
  if (due === "1" || due === "true") {
    dueConds.push({ nextServiceDue: { $lte: now } });
  }
  if (upcoming === "1" || upcoming === "true") {
    const days = Math.min(180, Math.max(1, Number(searchParams.get("days") || 30)));
    const windowTo = new Date(startToday);
    windowTo.setDate(windowTo.getDate() + days);
    windowTo.setHours(23, 59, 59, 999);
    dueConds.push({ nextServiceDue: { $gt: now, $lte: windowTo } });
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    const start = from ? dayStart(from) : null;
    const end = to ? dayEnd(to) : null;
    if (start) range.$gte = start;
    if (end) range.$lte = end;
    if (Object.keys(range).length) dueConds.push({ nextServiceDue: range });
  }
  if (warranty === "1" || warranty === "true") {
    filter.warrantyExpiryDate = { $lte: now };
  }
  if (dueConds.length === 1) Object.assign(filter, dueConds[0]);
  else if (dueConds.length > 1) filter.$and = dueConds;

  if (q) {
    const people = await Contact.find({
      type: { $in: ["customer", "both"] },
      $or: [
        { name: new RegExp(q, "i") },
        { nameBn: new RegExp(q, "i") },
        { mobile: new RegExp(q, "i") },
        { contactPerson: new RegExp(q, "i") },
        { whatsapp: new RegExp(q, "i") },
      ],
    })
      .select("_id")
      .limit(50)
      .lean();
    filter.$or = [
      { brand: new RegExp(q, "i") },
      { model: new RegExp(q, "i") },
      { serialNo: new RegExp(q, "i") },
      { siteLocation: new RegExp(q, "i") },
      { siteName: new RegExp(q, "i") },
      { customerId: { $in: people.map((p) => p._id) } },
    ];
  }

  const window30 = new Date(startToday);
  window30.setDate(window30.getDate() + 30);
  window30.setHours(23, 59, 59, 999);
  const weekEnd = new Date(startToday);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);
  const tomorrow = new Date(startToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [found, total, fleetTotal, dueCount, upcomingCount, warrantyExpired, todayCount, weekCount, byType] = await Promise.all([
    Machine.find(filter)
      .populate("customerId", "name nameBn mobile phone whatsapp address location city contactPerson notes")
      .sort(due || upcoming || from || to || schedule ? { nextServiceDue: 1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Machine.countDocuments(filter),
    Machine.countDocuments(),
    Machine.countDocuments({ nextServiceDue: { $lte: now } }),
    Machine.countDocuments({ nextServiceDue: { $gt: now, $lte: window30 } }),
    Machine.countDocuments({ warrantyExpiryDate: { $lte: now } }),
    Machine.countDocuments({ nextServiceDue: { $gte: startToday, $lt: tomorrow } }),
    Machine.countDocuments({ nextServiceDue: { $gte: startToday, $lte: weekEnd } }),
    Machine.aggregate([{ $group: { _id: "$machineType", n: { $sum: 1 } } }]),
  ]);
  const data = await withLastService(found as Array<Record<string, unknown>>);
  const typeCounts: Record<string, number> = {};
  for (const row of byType as { _id?: string; n?: number }[]) {
    typeCounts[String(row._id || "other")] = Number(row.n || 0);
  }
  return NextResponse.json({
    data,
    items: data,
    total,
    page,
    limit,
    summary: {
      total: fleetTotal,
      due: dueCount,
      upcoming: upcomingCount,
      warrantyExpired,
      today: todayCount,
      thisWeek: weekCount,
      byType: typeCounts,
    },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const body = await req.json();

  if (!body.customerId) {
    return NextResponse.json({ error: "missing_customer" }, { status: 400 });
  }

  try {
    const coords = parseCoord(body.lat, body.lng);
    const machine = await Machine.create({
      customerId: body.customerId,
      brand: body.brand,
      model: body.model,
      serialNo: body.serialNo || undefined,
      machineType: body.machineType,
      siteName: body.siteName,
      siteLocation: body.siteLocation,
      siteAddress: body.siteAddress,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      warrantyExpiryDate: body.warrantyExpiryDate ? new Date(body.warrantyExpiryDate) : undefined,
      nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : undefined,
      commissionedAt: body.commissionedAt ? new Date(body.commissionedAt) : undefined,
      notes: body.notes,
      ...(coords || {}),
    });
    return NextResponse.json({ data: machine }, { status: 201 });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/E11000|duplicate key/i.test(msg)) {
      return NextResponse.json({ error: "duplicate_serial" }, { status: 409 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
