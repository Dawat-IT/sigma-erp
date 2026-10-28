import { NextRequest, NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ServiceJob, Machine, AmcContract, Technician } from "@/models";
import { slaHoursFor } from "@/lib/technical-checklists";

const CLOSED = ["completed", "closed", "delivered", "cancelled", "resolved"];

function dateFilter(from: string | null, to: string | null) {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return {
    $or: [{ checkedInAt: range }, { completedAt: range }, { scheduledDate: range }, { reportedAt: range }],
  };
}

function customerOf(row: { customerId?: unknown }) {
  const c = row.customerId as { _id?: unknown; name?: string; nameBn?: string; mobile?: string } | null | undefined;
  return {
    customerId: c?._id ? String(c._id) : "",
    customer: c?.name || "",
    customerBn: c?.nameBn || "",
    mobile: c?.mobile || "",
  };
}

function techPipeline(filter: Record<string, unknown>): PipelineStage[] {
  return [
    { $match: filter },
    {
      $addFields: {
        techList: {
          $filter: {
            input: {
              $setUnion: [
                { $cond: [{ $ifNull: ["$technicianId", false] }, ["$technicianId"], []] },
                { $ifNull: ["$technicianIds", []] },
              ],
            },
            as: "t",
            cond: { $ne: ["$$t", null] },
          },
        },
      },
    },
    { $unwind: { path: "$techList", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$techList",
        jobs: { $sum: 1 },
        billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
        due: { $sum: { $ifNull: ["$dueAmount", 0] } },
        minutes: { $sum: { $ifNull: ["$durationMinutes", 0] } },
      },
    },
    { $sort: { jobs: -1 as const } },
    { $limit: 50 },
  ] as PipelineStage[];
}

async function technicianRows(filter: Record<string, unknown>) {
  const rows = await ServiceJob.aggregate(techPipeline(filter));
  const techs = await Technician.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } })
    .select("name mobile speciality")
    .lean();
  const map = new Map(techs.map((t) => [String(t._id), t]));
  return rows.map((r) => {
    const tech = map.get(String(r._id));
    return {
      _id: r._id ? String(r._id) : "",
      label: tech?.name || "Unassigned",
      mobile: tech?.mobile || "",
      speciality: tech?.speciality || "",
      jobs: r.jobs,
      billed: r.billed,
      due: r.due,
      minutes: r.minutes,
      value: r.jobs,
    };
  });
}

async function equipmentRows(filter: Record<string, unknown>) {
  const rows = await ServiceJob.aggregate([
    { $match: { ...filter, machineId: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$machineId",
        jobs: { $sum: 1 },
        billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
        due: { $sum: { $ifNull: ["$dueAmount", 0] } },
      },
    },
    { $sort: { jobs: -1 } },
    { $limit: 50 },
  ]);
  const machines = await Machine.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate("customerId", "name nameBn mobile")
    .lean();
  const map = new Map(machines.map((m) => [String(m._id), m]));
  return rows.map((r) => {
    const m = map.get(String(r._id)) as
      | {
          brand?: string;
          model?: string;
          serialNo?: string;
          machineType?: string;
          customerId?: { _id?: unknown; name?: string; nameBn?: string; mobile?: string };
        }
      | undefined;
    const cust = customerOf({ customerId: m?.customerId });
    return {
      _id: r._id ? String(r._id) : "",
      label: [m?.brand, m?.model, m?.serialNo || m?.machineType].filter(Boolean).join(" · ") || "Machine",
      ...cust,
      jobs: r.jobs,
      billed: r.billed,
      due: r.due,
      value: r.jobs,
    };
  });
}

async function partsRows(filter: Record<string, unknown>) {
  const rows = await ServiceJob.aggregate([
    { $match: filter },
    { $unwind: { path: "$parts", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: { $ifNull: ["$parts.name", "Part"] },
        qty: { $sum: { $ifNull: ["$parts.qty", 0] } },
        amount: { $sum: { $ifNull: ["$parts.lineTotal", 0] } },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: 80 },
  ]);
  return rows.map((r) => ({ label: r._id, qty: r.qty, amount: r.amount, value: r.qty }));
}

async function amcRows() {
  const data = await AmcContract.find()
    .populate("customerId", "name nameBn mobile")
    .populate("machineId", "brand model serialNo")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return data.map((row) => {
    const machine = row.machineId as { brand?: string; model?: string; serialNo?: string } | null;
    return {
      _id: String(row._id),
      label: row.contractNo,
      ...customerOf(row),
      status: row.status,
      amount: row.amount,
      visits: `${row.visitsUsed || 0}/${row.visitsIncluded || 0}`,
      unit: [machine?.brand, machine?.model, machine?.serialNo].filter(Boolean).join(" · "),
      value: row.amount || 0,
    };
  });
}

async function complaintRows(filter: Record<string, unknown>) {
  const match = { ...filter, jobKind: "complaint" };
  const data = await ServiceJob.find(match)
    .populate("customerId", "name nameBn mobile")
    .sort({ reportedAt: -1 })
    .limit(100)
    .lean();
  return data.map((row) => ({
    _id: String(row._id),
    label: row.jobNo,
    ...customerOf(row),
    status: row.status,
    issue: row.issueDescription,
    jobKind: row.jobKind,
    value: row.grandTotal || 0,
    billed: row.grandTotal || 0,
    due: row.dueAmount || 0,
  }));
}

async function slaRows(filter: Record<string, unknown>) {
  const open = await ServiceJob.find({
    ...filter,
    jobKind: { $in: ["complaint", "scheduled", "emergency"] },
    status: { $nin: CLOSED },
  })
    .populate("customerId", "name nameBn mobile")
    .lean();
  return open
    .map((job) => {
      const hours = (Date.now() - new Date(job.reportedAt || job.createdAt || Date.now()).getTime()) / 36e5;
      const limit = slaHoursFor(job.jobKind, job.priority);
      return {
        _id: String(job._id),
        label: job.jobNo,
        ...customerOf(job),
        status: job.status,
        jobKind: job.jobKind,
        overdue: hours > limit,
        hours: Math.round(hours),
        limit,
        issue: job.issueDescription,
        value: Math.max(0, hours - limit),
      };
    })
    .filter((row) => row.overdue)
    .sort((a, b) => b.value - a.value);
}

async function summaryBundle(filter: Record<string, unknown>) {
  const aggregates = await ServiceJob.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        totalServiceCharges: { $sum: { $ifNull: ["$serviceCharges", 0] } },
        totalPartsCost: { $sum: { $ifNull: ["$partsTotal", 0] } },
        grandTotal: { $sum: { $ifNull: ["$grandTotal", 0] } },
        totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
        totalDue: { $sum: { $ifNull: ["$dueAmount", 0] } },
      },
    },
  ]);
  const summary = aggregates[0] || {
    totalJobs: 0,
    totalServiceCharges: 0,
    totalPartsCost: 0,
    grandTotal: 0,
    totalPaid: 0,
    totalDue: 0,
  };
  return [
    { label: "Total Service Jobs", value: summary.totalJobs },
    { label: "Total Service Charges", value: summary.totalServiceCharges },
    { label: "Total Parts Cost", value: summary.totalPartsCost },
    { label: "Grand Total", value: summary.grandTotal },
    { label: "Total Paid", value: summary.totalPaid },
    { label: "Total Due", value: summary.totalDue },
  ];
}

async function deskPayload(filter: Record<string, unknown>) {
  const [totalsRows, byKind, byStatus, sla, technicians, equipment, parts, complaints, amc, amcStats] = await Promise.all([
    summaryBundle(filter),
    ServiceJob.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ["$jobKind", "other"] },
          n: { $sum: 1 },
          billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
          due: { $sum: { $ifNull: ["$dueAmount", 0] } },
        },
      },
      { $sort: { n: -1 } },
    ]),
    ServiceJob.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$status", "other"] }, n: { $sum: 1 } } },
    ]),
    slaRows(filter),
    technicianRows(filter),
    equipmentRows(filter),
    partsRows(filter),
    complaintRows(filter),
    amcRows(),
    AmcContract.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$status", "other"] },
          n: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
  ]);

  const totals = {
    jobs: Number(totalsRows[0]?.value || 0),
    charges: Number(totalsRows[1]?.value || 0),
    parts: Number(totalsRows[2]?.value || 0),
    billed: Number(totalsRows[3]?.value || 0),
    paid: Number(totalsRows[4]?.value || 0),
    due: Number(totalsRows[5]?.value || 0),
  };
  const amcCount: Record<string, number> = {};
  let amcAmount = 0;
  for (const row of amcStats) {
    amcCount[String(row._id)] = row.n;
    amcAmount += Number(row.amount || 0);
  }
  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[String(row._id)] = row.n;

  return {
    totals,
    byKind: byKind.map((row) => ({ id: String(row._id), n: row.n, billed: row.billed, due: row.due })),
    byStatus: statusMap,
    slaOverdue: sla.length,
    amc: {
      total: Object.values(amcCount).reduce((n, v) => n + v, 0),
      active: amcCount.active || 0,
      expired: amcCount.expired || 0,
      cancelled: amcCount.cancelled || 0,
      amount: amcAmount,
    },
    technicians,
    equipment,
    parts,
    complaints,
    sla,
    amcRows: amc,
    summary: totalsRows,
    data: totalsRows,
  };
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const kind = searchParams.get("kind") || "summary";
  const filter = dateFilter(from, to);

  if (kind === "desk") return NextResponse.json(await deskPayload(filter));
  if (kind === "technician") return NextResponse.json({ data: await technicianRows(filter) });
  if (kind === "equipment") return NextResponse.json({ data: await equipmentRows(filter) });
  if (kind === "parts") return NextResponse.json({ data: await partsRows(filter) });
  if (kind === "amc") return NextResponse.json({ data: await amcRows() });
  if (kind === "complaints") return NextResponse.json({ data: await complaintRows(filter) });
  if (kind === "sla") return NextResponse.json({ data: await slaRows(filter) });

  const data = await summaryBundle(filter);
  return NextResponse.json({ summary: data, data });
}
