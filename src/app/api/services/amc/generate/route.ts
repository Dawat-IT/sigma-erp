import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireMinRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { Machine, ServiceJob, Technician, AmcContract, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import { checklistForEquipment, blankReadings } from "@/lib/technical-checklists";
import { computeServiceTotals } from "@/lib/service-totals";
import { defaultServiceLines, defaultVisitCharge } from "@/lib/service-catalog";
import { houseSiteFromIds } from "@/lib/service-house";
import { dayJobMatch, parseDateKey, tomorrowKey } from "@/lib/service-day";
import { dayBounds } from "@/lib/service-visit";

const MAX_JOBS = 4;

function personName(ref: unknown) {
  if (!ref || typeof ref !== "object") return "";
  const row = ref as { name?: string; nameBn?: string };
  return String(row.name || row.nameBn || "");
}

function machineLabel(row: { brand?: string; model?: string; serialNo?: string; machineType?: string }) {
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ");
}

async function loadPlan(date: string) {
  const { from, to } = dayBounds(date);
  const [machines, technicians, existing, contracts] = await Promise.all([
    Machine.find({ nextServiceDue: { $gte: from, $lte: to } })
      .populate("customerId", "name nameBn mobile location city")
      .lean(),
    Technician.find({ isActive: true }).sort({ name: 1 }).lean(),
    ServiceJob.find({
      ...dayJobMatch(from, to),
      status: { $ne: "cancelled" },
    })
      .select("machineId technicianId jobNo")
      .lean(),
    AmcContract.find({ status: "active" }).select("machineId cycleDays visitsUsed visitsIncluded").lean(),
  ]);
  const busyMachines = new Set(
    existing.map((row) => (row.machineId ? String(row.machineId) : "")).filter(Boolean),
  );
  const load = new Map(technicians.map((tech) => [String(tech._id), 0]));
  for (const row of existing) {
    if (!row.technicianId) continue;
    const id = String(row.technicianId);
    if (load.has(id)) load.set(id, (load.get(id) || 0) + 1);
  }
  const amcByMachine = new Map(
    contracts
      .filter((row) => row.machineId)
      .map((row) => [String(row.machineId), row]),
  );
  const units = (machines as Record<string, unknown>[]).map((row) => {
    const customer = row.customerId && typeof row.customerId === "object" ? (row.customerId as { _id?: unknown; mobile?: string; location?: string; city?: string }) : null;
    const amc = amcByMachine.get(String(row._id));
    const queued = busyMachines.has(String(row._id));
    return {
      _id: String(row._id),
      label: machineLabel(row as { brand?: string; model?: string; serialNo?: string; machineType?: string }),
      machineType: String(row.machineType || ""),
      siteName: String(row.siteName || ""),
      siteLocation: String(row.siteLocation || customer?.location || customer?.city || ""),
      customerId: customer?._id ? String(customer._id) : row.customerId ? String(row.customerId) : "",
      customerName: personName(row.customerId),
      customerMobile: String(customer?.mobile || ""),
      queued,
      amc: amc
        ? {
            cycleDays: Number(amc.cycleDays || 90),
            visitsUsed: Number(amc.visitsUsed || 0),
            visitsIncluded: Number(amc.visitsIncluded || 0),
          }
        : null,
    };
  });
  const roster = technicians.map((tech) => {
    const used = load.get(String(tech._id)) || 0;
    return {
      _id: String(tech._id),
      name: String(tech.name || ""),
      mobile: String(tech.mobile || ""),
      speciality: String(tech.speciality || ""),
      used,
      cap: MAX_JOBS,
      remaining: Math.max(0, MAX_JOBS - used),
    };
  });
  const ready = units.filter((row) => !row.queued).length;
  const queued = units.filter((row) => row.queued).length;
  const slots = roster.reduce((sum, row) => sum + row.remaining, 0);
  return { date, units, roster, ready, queued, slots, techs: roster.length, cap: MAX_JOBS, existing: existing.length };
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = parseDateKey(new URL(req.url).searchParams.get("date"), tomorrowKey());
  if (!date) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  await connectDB();
  return NextResponse.json(await loadPlan(date));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireMinRole("manager");
  if (error || !session) return error!;

  const body = await req.json().catch(() => ({}));
  const date = parseDateKey(body.date, tomorrowKey());
  if (!date) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  await connectDB();
  const { from, to } = dayBounds(date);

  const [machines, technicians, existing] = await Promise.all([
    Machine.find({ nextServiceDue: { $gte: from, $lte: to } }).lean(),
    Technician.find({ isActive: true }).sort({ name: 1 }).lean(),
    ServiceJob.find({
      ...dayJobMatch(from, to),
      status: { $ne: "cancelled" },
    })
      .select("machineId technicianId")
      .lean(),
  ]);

  const busyMachines = new Set(
    existing.map((row) => (row.machineId ? String(row.machineId) : "")).filter(Boolean),
  );
  const load = new Map(technicians.map((tech) => [String(tech._id), 0]));
  for (const row of existing) {
    if (!row.technicianId) continue;
    const id = String(row.technicianId);
    if (load.has(id)) load.set(id, (load.get(id) || 0) + 1);
  }

  let cursor = 0;
  function takeTech() {
    if (!technicians.length) return null;
    for (let i = 0; i < technicians.length; i++) {
      const tech = technicians[cursor % technicians.length];
      cursor += 1;
      const id = String(tech._id);
      if ((load.get(id) || 0) < MAX_JOBS) {
        load.set(id, (load.get(id) || 0) + 1);
        return tech;
      }
    }
    return null;
  }

  let skipped = 0;
  let created = 0;
  let unassigned = 0;
  let overload = 0;
  const createdJobs: { _id: string; jobNo: string; technicianName: string; machineLabel: string }[] = [];

  for (const machine of machines) {
    if (busyMachines.has(String(machine._id))) {
      skipped += 1;
      continue;
    }
    const tech = takeTech();
    if (!tech) overload += 1;

    const site = await houseSiteFromIds({
      customerId: machine.customerId,
      machineId: machine._id,
      siteName: machine.siteName,
      siteLocation: machine.siteLocation,
      siteAddress: machine.siteAddress,
      lat: machine.lat,
      lng: machine.lng,
    });
    const serviceLines = defaultServiceLines("scheduled");
    const visitCharge = defaultVisitCharge("scheduled");
    const totals = computeServiceTotals({ serviceLines, parts: [], visitCharge });
    const seq = await nextSeq("service_job");
    const jobNo = generateDocNo("JOB", seq);

    const job = await ServiceJob.create({
      jobNo,
      customerId: machine.customerId,
      machineId: machine._id,
      technicianId: tech?._id,
      jobKind: "scheduled",
      equipmentType: machine.machineType,
      status: tech ? "assigned" : "pending",
      fieldStatus: tech ? "assigned" : undefined,
      priority: "medium",
      issueDescription: "AMC / preventive maintenance",
      scheduledDate: from,
      siteName: site.siteName,
      siteLocation: site.siteLocation,
      siteAddress: site.siteAddress,
      lat: "lat" in site ? site.lat : machine.lat,
      lng: "lng" in site ? site.lng : machine.lng,
      checklist: checklistForEquipment(machine.machineType, "scheduled"),
      readings: blankReadings(machine.machineType),
      visitCharge: totals.visitCharge,
      serviceLines: totals.serviceLines,
      serviceLinesTotal: totals.serviceLinesTotal,
      serviceCharges: totals.serviceCharges,
      parts: [],
      partsTotal: 0,
      discount: totals.discount,
      tax: totals.tax,
      grandTotal: totals.grandTotal,
      paidAmount: 0,
      dueAmount: totals.dueAmount,
      createdBy: session.id,
    });
    created += 1;
    createdJobs.push({
      _id: String(job._id),
      jobNo,
      technicianName: tech ? String(tech.name || "") : "",
      machineLabel: machineLabel(machine),
    });
    if (!tech) unassigned += 1;
    const contract = await AmcContract.findOne({ machineId: machine._id, status: "active" }).lean();
    const cycle = Number(contract?.cycleDays || 90);
    const next = new Date(from);
    next.setDate(next.getDate() + cycle);
    await Machine.updateOne({ _id: machine._id }, { nextServiceDue: next });
    if (contract) await AmcContract.updateOne({ _id: contract._id }, { $inc: { visitsUsed: 1 } });
  }

  await writeAudit({
    userId: session.id,
    userName: session.name,
    action: "amc_generate",
    entityType: "ServiceJob",
    details: `${date} created=${created} skipped=${skipped} unassigned=${unassigned}`,
  });

  return NextResponse.json({ created, skipped, unassigned, overload, date, jobs: createdJobs });
}
