import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ServiceJob, Technician } from "@/models";
import { jobCrewIds } from "@/lib/job-crew";
import { decorateDayJob } from "@/lib/service-day";
import { dayBounds, todayKey } from "@/lib/service-visit";

const DONE = new Set(["completed", "delivered", "closed", "cancelled"]);

type JobLean = {
  _id: unknown;
  technicianId?: { _id?: unknown } | unknown;
  customerId?: { name?: string; address?: string; location?: string; city?: string; mobile?: string } | unknown;
  machineId?: {
    brand?: string;
    model?: string;
    serialNo?: string;
    machineType?: string;
    siteName?: string;
    siteLocation?: string;
    siteAddress?: string;
  } | unknown;
  equipmentType?: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  durationMinutes?: number;
  status?: string;
  fieldStatus?: string;
  parts?: { qty?: number; lineTotal?: number }[];
  partsTotal?: number;
};

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const date = req.nextUrl.searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const { from, to } = dayBounds(date);

  const [technicians, jobs] = await Promise.all([
    Technician.find({ isActive: true }).sort({ name: 1 }).lean(),
    ServiceJob.find({
      $or: [
        { scheduledDate: { $gte: from, $lte: to } },
        { checkedInAt: { $gte: from, $lte: to } },
        { reportedAt: { $gte: from, $lte: to } },
      ],
      status: { $ne: "cancelled" },
    })
      .populate("customerId", "name mobile phone whatsapp address location city lat lng")
      .populate("machineId", "brand model serialNo machineType siteName siteLocation siteAddress lat lng")
      .populate("technicianId", "name mobile speciality")
      .populate("technicianIds", "name mobile speciality")
      .sort({ scheduledDate: 1, checkedInAt: 1, reportedAt: 1 })
      .limit(500)
      .lean(),
  ]);

  type Board = {
    technician: (typeof technicians)[number];
    jobs: unknown[];
    houseCount: number;
    onSite: number;
    done: number;
    minutes: number;
    partsQty: number;
    partsTotal: number;
  };

  const boards = new Map<string, Board>();
  for (const tech of technicians) {
    boards.set(String(tech._id), {
      technician: tech,
      jobs: [],
      houseCount: 0,
      onSite: 0,
      done: 0,
      minutes: 0,
      partsQty: 0,
      partsTotal: 0,
    });
  }

  const unassigned: unknown[] = [];
  const houses = new Set<string>();
  let onSite = 0;
  let completed = 0;
  let minutes = 0;
  let partsQty = 0;
  let partsTotal = 0;

  for (const raw of jobs as JobLean[]) {
    const row = decorateDayJob(raw as unknown as Record<string, unknown>);
    const duration = Number(row.durationMinutes || 0);
    const qty = (raw.parts || []).reduce((sum, part) => sum + Number(part.qty || 0), 0);
    const sold = Number(raw.partsTotal || 0);
    const houseKey =
      raw.customerId && typeof raw.customerId === "object" && "_id" in (raw.customerId as object)
        ? String((raw.customerId as { _id: unknown })._id)
        : String(raw._id);
    houses.add(houseKey);
    if (raw.checkedInAt && !raw.checkedOutAt) onSite += 1;
    if (DONE.has(String(raw.status))) completed += 1;
    minutes += duration;
    partsQty += qty;
    partsTotal += sold;
    const crew = jobCrewIds(raw as { technicianId?: unknown; technicianIds?: unknown });
    if (!crew.length) {
      unassigned.push(row);
      continue;
    }
    for (const techId of crew) {
      const bucket = boards.get(techId);
      if (!bucket) continue;
      bucket.jobs.push(row);
      bucket.houseCount += 1;
      if (raw.checkedInAt && !raw.checkedOutAt) bucket.onSite += 1;
      if (DONE.has(String(raw.status))) bucket.done += 1;
      bucket.minutes += duration;
      bucket.partsQty += qty;
      bucket.partsTotal += sold;
    }
  }

  const list = [...boards.values()];
  const overload = list.filter((row) => row.houseCount > 4).length;
  const workingTechs = list.filter((row) => row.houseCount > 0).length;

  return NextResponse.json({
    date,
    summary: {
      technicians: technicians.length,
      workingTechs,
      housesToday: jobs.length,
      uniqueHouses: houses.size,
      onSite,
      completed,
      avgMinutes: jobs.length ? Math.round(minutes / jobs.length) : 0,
      partsQty,
      partsTotal,
      overload,
    },
    boards: list,
    unassigned,
  });
}
