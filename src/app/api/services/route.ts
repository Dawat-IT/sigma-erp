import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { ServiceJob, Product, Contact, Machine, AmcContract, Technician, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import mongoose from "mongoose";
import { checklistForEquipment, blankReadings, slaHoursFor } from "@/lib/technical-checklists";
import { computeServiceTotals, completionGaps } from "@/lib/service-totals";
import { defaultServiceLines, defaultVisitCharge } from "@/lib/service-catalog";
import { dayBounds, parseDayStart } from "@/lib/service-visit";
import { houseSiteFromIds } from "@/lib/service-house";
import { normalizeCrew, assignedTechMatch } from "@/lib/job-crew";
import { complimentaryForJob, markComplimentaryUsed } from "@/lib/complimentary-service";

const TECHNICAL_KINDS = ["complaint", "scheduled", "emergency"];

function technicalFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const jobKind = searchParams.get("jobKind") || searchParams.get("type");
  const equipmentType = searchParams.get("equipmentType");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const customerId = searchParams.get("customerId");
  const technicianId = searchParams.get("technicianId");
  const q = searchParams.get("q")?.trim();
  const unassigned = searchParams.get("unassigned");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const scope = searchParams.get("scope");

  if (jobKind) {
    const kinds = jobKind.split(",").map((v) => v.trim()).filter(Boolean);
    if (kinds.length === 1) filter.jobKind = kinds[0];
    else if (kinds.length > 1) filter.jobKind = { $in: kinds };
  }
  if (equipmentType) filter.equipmentType = equipmentType;
  if (status) {
    const statuses = status.split(",").map((v) => v.trim()).filter(Boolean);
    if (statuses.length === 1) filter.status = statuses[0];
    else if (statuses.length > 1) filter.status = { $in: statuses };
  }
  if (priority) filter.priority = priority;
  if (customerId) filter.customerId = customerId;
  if (technicianId) Object.assign(filter, assignedTechMatch(technicianId));
  const extras: Record<string, unknown>[] = [];
  if (unassigned === "1" || unassigned === "true") {
    extras.push({
      $and: [
        { $or: [{ technicianId: { $exists: false } }, { technicianId: null }] },
        { $or: [{ technicianIds: { $exists: false } }, { technicianIds: { $size: 0 } }] },
      ],
    });
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    if (scope === "history") {
      extras.push({ $or: [{ completedAt: range }, { reportedAt: range }, { receivedDate: range }] });
    } else if (scope === "upcoming") {
      extras.push({ $or: [{ scheduledDate: range }, { expectedDeliveryDate: range }] });
    } else {
      extras.push({ reportedAt: range });
    }
  }
  const date = searchParams.get("date");
  if (scope === "history") {
    filter.status = { $in: ["completed", "closed", "delivered", "resolved"] };
  }
  if (scope === "upcoming") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    filter.status = { $nin: ["completed", "closed", "delivered", "cancelled", "resolved"] };
    extras.push({
      $or: [
        { scheduledDate: { $gte: start } },
        { expectedDeliveryDate: { $gte: start } },
      ],
    });
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { from: start, to: end } = dayBounds(date);
    extras.push({
      $or: [
        { scheduledDate: { $gte: start, $lte: end } },
        { checkedInAt: { $gte: start, $lte: end } },
      ],
    });
  }
  if (q) {
    extras.push({
      $or: [
        { jobNo: new RegExp(q, "i") },
        { issueDescription: new RegExp(q, "i") },
        { diagnosis: new RegExp(q, "i") },
        { reportedBy: new RegExp(q, "i") },
      ],
    });
  }
  if (extras.length === 1) Object.assign(filter, extras[0]);
  else if (extras.length > 1) filter.$and = extras;
  return filter;
}

async function technicalSummary() {
  const match = { jobKind: { $in: TECHNICAL_KINDS } };
  const open = { ...match, status: { $nin: ["resolved", "closed", "completed", "delivered", "cancelled"] } };
  const [openCount, emergencyCount, unassignedCount, inProgressCount, byLine, dueUnits] = await Promise.all([
    ServiceJob.countDocuments(open),
    ServiceJob.countDocuments({ ...open, jobKind: "emergency" }),
    ServiceJob.countDocuments({
      ...open,
      $or: [{ technicianId: { $exists: false } }, { technicianId: null }],
    }),
    ServiceJob.countDocuments({ ...match, status: "in_progress" }),
    ServiceJob.aggregate([
      { $match: open },
      { $group: { _id: "$equipmentType", open: { $sum: 1 } } },
    ]),
    Machine.countDocuments({ nextServiceDue: { $lte: new Date() } }),
  ]);

  const openJobs = await ServiceJob.find(open).select("reportedAt createdAt jobKind priority status").lean();
  const overdueCount = openJobs.filter((job) => {
    const start = new Date(job.reportedAt || job.createdAt || Date.now()).getTime();
    const hours = (Date.now() - start) / 36e5;
    return hours > slaHoursFor(job.jobKind, job.priority);
  }).length;

  const dueList = await Machine.find({ nextServiceDue: { $lte: new Date() } })
    .populate("customerId", "name")
    .sort({ nextServiceDue: 1 })
    .limit(8)
    .lean();

  return {
    openCount,
    emergencyCount,
    unassignedCount,
    inProgressCount,
    overdueCount,
    dueUnits,
    dueList,
    byLine,
  };
}

const DESK_JOB_SELECT =
  "jobNo jobKind status priority issueDescription siteName siteLocation siteAddress reportedAt createdAt scheduledDate checkedInAt completedAt customerId technicianId machineId";

function personName(ref: unknown) {
  if (!ref || typeof ref !== "object") return "";
  const row = ref as { name?: string; nameBn?: string };
  return String(row.name || row.nameBn || "");
}

function personId(ref: unknown) {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "_id" in ref) return String((ref as { _id: unknown })._id || "");
  return String(ref);
}

function machineLabel(ref: unknown) {
  if (!ref || typeof ref !== "object") return "";
  const row = ref as { brand?: string; model?: string; serialNo?: string; machineType?: string };
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ");
}

function daysOverdue(iso?: Date | string | null) {
  if (!iso) return 0;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 0;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86400000));
}

function serializeDeskJob(job: Record<string, unknown>) {
  const reported = new Date(String(job.reportedAt || job.createdAt || Date.now())).getTime();
  const hours = (Date.now() - reported) / 36e5;
  const slaLimit = slaHoursFor(String(job.jobKind || ""), String(job.priority || ""));
  const customer = job.customerId && typeof job.customerId === "object" ? (job.customerId as { mobile?: string; location?: string; city?: string }) : null;
  return {
    _id: String(job._id || ""),
    jobNo: String(job.jobNo || ""),
    jobKind: String(job.jobKind || ""),
    status: String(job.status || ""),
    priority: String(job.priority || ""),
    issueDescription: String(job.issueDescription || ""),
    siteName: String(job.siteName || ""),
    siteLocation: String(job.siteLocation || job.siteAddress || customer?.location || customer?.city || ""),
    reportedAt: job.reportedAt || job.createdAt || null,
    scheduledDate: job.scheduledDate || null,
    checkedInAt: job.checkedInAt || null,
    completedAt: job.completedAt || null,
    slaOverdue: hours > slaLimit,
    slaHours: Math.max(0, Math.round(hours)),
    customerId: personId(job.customerId),
    customerName: personName(job.customerId),
    customerMobile: String(customer?.mobile || ""),
    technicianName: personName(job.technicianId),
    machineLabel: machineLabel(job.machineId),
  };
}

async function deskSummary() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const window = new Date(start);
  window.setDate(window.getDate() + 30);
  const closed = { $nin: ["completed", "closed", "delivered", "cancelled", "resolved"] };
  const unassignedFilter = {
    status: closed,
    $and: [
      { $or: [{ technicianId: { $exists: false } }, { technicianId: null }] },
      { $or: [{ technicianIds: { $exists: false } }, { technicianIds: { $size: 0 } }] },
    ],
  };
  const populateJob = (q: ReturnType<typeof ServiceJob.find>) =>
    q
      .select(DESK_JOB_SELECT)
      .populate("customerId", "name nameBn mobile location city")
      .populate("technicianId", "name")
      .populate("machineId", "brand model serialNo machineType");

  const [
    openJobs,
    dueUnits,
    upcomingUnits,
    complaints,
    slaJobs,
    onSite,
    completedToday,
    amcActive,
    technicians,
    unassigned,
    emergencies,
    inProgress,
    openRows,
    dueRows,
    todayRows,
    complaintRows,
    doneRows,
    byKindRows,
  ] = await Promise.all([
    ServiceJob.countDocuments({ status: closed }),
    Machine.countDocuments({ nextServiceDue: { $lte: now } }),
    Machine.countDocuments({ nextServiceDue: { $gt: now, $lte: window } }),
    ServiceJob.countDocuments({ jobKind: "complaint", status: closed }),
    ServiceJob.find({ jobKind: { $in: ["complaint", "scheduled", "emergency"] }, status: closed })
      .select("reportedAt createdAt jobKind priority")
      .lean(),
    ServiceJob.countDocuments({
      checkedInAt: { $exists: true, $ne: null },
      $or: [{ checkedOutAt: { $exists: false } }, { checkedOutAt: null }],
    }),
    ServiceJob.countDocuments({
      status: { $in: ["completed", "closed", "delivered", "resolved"] },
      completedAt: { $gte: start, $lt: end },
    }),
    AmcContract.countDocuments({ status: "active" }),
    Technician.countDocuments({ isActive: true }),
    ServiceJob.countDocuments(unassignedFilter),
    ServiceJob.countDocuments({ status: closed, jobKind: "emergency" }),
    ServiceJob.countDocuments({ status: "in_progress" }),
    populateJob(ServiceJob.find({ status: closed })).sort({ reportedAt: -1 }).limit(10).lean(),
    Machine.find({ nextServiceDue: { $lte: now } })
      .populate("customerId", "name nameBn mobile location")
      .sort({ nextServiceDue: 1 })
      .limit(8)
      .lean(),
    populateJob(
      ServiceJob.find({
        $or: [{ scheduledDate: { $gte: start, $lt: end } }, { checkedInAt: { $gte: start, $lt: end } }],
      }),
    )
      .sort({ scheduledDate: 1, checkedInAt: 1 })
      .limit(8)
      .lean(),
    populateJob(ServiceJob.find({ jobKind: "complaint", status: closed })).sort({ reportedAt: -1 }).limit(6).lean(),
    populateJob(
      ServiceJob.find({
        status: { $in: ["completed", "closed", "delivered", "resolved"] },
        completedAt: { $gte: start, $lt: end },
      }),
    )
      .sort({ completedAt: -1 })
      .limit(6)
      .lean(),
    ServiceJob.aggregate([{ $match: { status: closed } }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
  ]);
  const slaOverdue = slaJobs.filter((job) => {
    const hours = (Date.now() - new Date(job.reportedAt || job.createdAt || Date.now()).getTime()) / 36e5;
    return hours > slaHoursFor(job.jobKind, job.priority);
  }).length;
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) {
    byKind[String(row._id || "other")] = Number(row.n || 0);
  }
  const dueList = (dueRows as Record<string, unknown>[]).map((row) => {
    const customer = row.customerId && typeof row.customerId === "object" ? (row.customerId as { mobile?: string; location?: string }) : null;
    return {
      _id: String(row._id || ""),
      brand: String(row.brand || ""),
      model: String(row.model || ""),
      serialNo: String(row.serialNo || ""),
      machineType: String(row.machineType || ""),
      siteName: String(row.siteName || ""),
      siteLocation: String(row.siteLocation || row.siteAddress || customer?.location || ""),
      nextServiceDue: row.nextServiceDue || null,
      daysOverdue: daysOverdue(row.nextServiceDue as Date | string | null),
      customerId: personId(row.customerId),
      customerName: personName(row.customerId),
      customerMobile: String(customer?.mobile || ""),
      label: machineLabel(row),
    };
  });
  return {
    openJobs,
    dueUnits,
    upcomingUnits,
    complaints,
    slaOverdue,
    onSite,
    completedToday,
    amcActive,
    technicians,
    unassigned,
    emergencies,
    inProgress,
    byKind,
    empty: openJobs + dueUnits + amcActive + technicians + completedToday === 0,
    openList: (openRows as Record<string, unknown>[]).map(serializeDeskJob),
    dueList,
    todayList: (todayRows as Record<string, unknown>[]).map(serializeDeskJob),
    complaintList: (complaintRows as Record<string, unknown>[]).map(serializeDeskJob),
    completedList: (doneRows as Record<string, unknown>[]).map(serializeDeskJob),
  };
}

async function installationSummary() {
  const match = { jobKind: "installation" };
  const open = { ...match, status: { $nin: ["completed", "closed", "delivered", "cancelled", "resolved"] } };
  const [
    total,
    openCount,
    installing,
    commissioned,
    handed,
    byStatusRows,
    byLineRows,
  ] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments(open),
    ServiceJob.countDocuments({ ...match, status: "in_progress" }),
    ServiceJob.countDocuments({ ...match, status: { $in: ["resolved", "completed"] } }),
    ServiceJob.countDocuments({ ...match, status: { $in: ["closed", "delivered"] } }),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$equipmentType", n: { $sum: 1 } } }]),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows as { _id?: string; n?: number }[]) {
    byStatus[String(row._id || "other")] = Number(row.n || 0);
  }
  const byLine: Record<string, number> = {};
  for (const row of byLineRows as { _id?: string; n?: number }[]) {
    byLine[String(row._id || "other")] = Number(row.n || 0);
  }
  return { total, open: openCount, installing, commissioned, handed, byStatus, byLine };
}

async function historySummary() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const match = {
    status: { $in: ["completed", "closed", "delivered", "resolved"] },
    jobKind: { $nin: ["installation"] },
  };
  const [total, today, money, byKindRows, byLineRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ ...match, completedAt: { $gte: start, $lt: end } }),
    ServiceJob.aggregate([
      { $match: match },
      { $group: { _id: null, billed: { $sum: { $ifNull: ["$grandTotal", 0] } }, due: { $sum: { $ifNull: ["$dueAmount", 0] } } } },
    ]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$equipmentType", n: { $sum: 1 } } }]),
  ]);
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) {
    byKind[String(row._id || "other")] = Number(row.n || 0);
  }
  const byLine: Record<string, number> = {};
  for (const row of byLineRows as { _id?: string; n?: number }[]) {
    byLine[String(row._id || "other")] = Number(row.n || 0);
  }
  const totals = (money[0] as { billed?: number; due?: number } | undefined) || {};
  return {
    total,
    today,
    billed: Number(totals.billed || 0),
    due: Number(totals.due || 0),
    byKind,
    byLine,
  };
}

async function complaintSummary() {
  const match = { jobKind: "complaint" };
  const closed = { $in: ["completed", "closed", "delivered", "cancelled", "resolved"] };
  const open = { ...match, status: { $nin: ["completed", "closed", "delivered", "cancelled", "resolved"] } };
  const unassignedFilter = {
    ...open,
    $and: [
      { $or: [{ technicianId: { $exists: false } }, { technicianId: null }] },
      { $or: [{ technicianIds: { $exists: false } }, { technicianIds: { $size: 0 } }] },
    ],
  };
  const [total, openCount, unassigned, inProgress, closedCount, slaJobs, byStatusRows, byLineRows, byPriorityRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments(open),
    ServiceJob.countDocuments(unassignedFilter),
    ServiceJob.countDocuments({ ...match, status: "in_progress" }),
    ServiceJob.countDocuments({ ...match, status: closed }),
    ServiceJob.find(open).select("reportedAt createdAt jobKind priority").lean(),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: open }, { $group: { _id: "$equipmentType", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: open }, { $group: { _id: "$priority", n: { $sum: 1 } } }]),
  ]);
  const slaOverdue = slaJobs.filter((job) => {
    const hours = (Date.now() - new Date(job.reportedAt || job.createdAt || Date.now()).getTime()) / 36e5;
    return hours > slaHoursFor(job.jobKind, job.priority);
  }).length;
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows as { _id?: string; n?: number }[]) byStatus[String(row._id || "other")] = Number(row.n || 0);
  const byLine: Record<string, number> = {};
  for (const row of byLineRows as { _id?: string; n?: number }[]) byLine[String(row._id || "other")] = Number(row.n || 0);
  const byPriority: Record<string, number> = {};
  for (const row of byPriorityRows as { _id?: string; n?: number }[]) byPriority[String(row._id || "medium")] = Number(row.n || 0);
  return { total, open: openCount, unassigned, inProgress, closed: closedCount, slaOverdue, byStatus, byLine, byPriority };
}

async function complaintHistorySummary() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const match = {
    jobKind: "complaint",
    status: { $in: ["completed", "closed", "delivered", "resolved"] },
  };
  const [total, today, money, byStatusRows, byLineRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ ...match, completedAt: { $gte: start, $lt: end } }),
    ServiceJob.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
          due: { $sum: { $ifNull: ["$dueAmount", 0] } },
          unpaid: { $sum: { $cond: [{ $gt: ["$dueAmount", 0] }, 1, 0] } },
        },
      },
    ]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$equipmentType", n: { $sum: 1 } } }]),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows as { _id?: string; n?: number }[]) byStatus[String(row._id || "other")] = Number(row.n || 0);
  const byLine: Record<string, number> = {};
  for (const row of byLineRows as { _id?: string; n?: number }[]) byLine[String(row._id || "other")] = Number(row.n || 0);
  const totals = (money[0] as { billed?: number; due?: number; unpaid?: number } | undefined) || {};
  return {
    total,
    today,
    billed: Number(totals.billed || 0),
    due: Number(totals.due || 0),
    unpaid: Number(totals.unpaid || 0),
    byStatus,
    byLine,
  };
}

async function workOrderSummary() {
  const open = { $nin: ["completed", "closed", "delivered", "cancelled", "resolved"] };
  const pending = { $in: ["pending", "reported"] };
  const progress = { $in: ["in_progress", "assigned", "on_site", "waiting_parts"] };
  const done = { $in: ["completed", "closed", "delivered", "resolved"] };
  const unassignedFilter = {
    status: open,
    $and: [
      { $or: [{ technicianId: { $exists: false } }, { technicianId: null }] },
      { $or: [{ technicianIds: { $exists: false } }, { technicianIds: { $size: 0 } }] },
    ],
  };
  const [total, pendingCount, progressCount, doneCount, cancelled, unassigned, money, byKindRows, byStatusRows] = await Promise.all([
    ServiceJob.countDocuments({}),
    ServiceJob.countDocuments({ status: pending }),
    ServiceJob.countDocuments({ status: progress }),
    ServiceJob.countDocuments({ status: done }),
    ServiceJob.countDocuments({ status: "cancelled" }),
    ServiceJob.countDocuments(unassignedFilter),
    ServiceJob.aggregate([
      { $group: { _id: null, billed: { $sum: { $ifNull: ["$grandTotal", 0] } }, due: { $sum: { $ifNull: ["$dueAmount", 0] } } } },
    ]),
    ServiceJob.aggregate([{ $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) byKind[String(row._id || "other")] = Number(row.n || 0);
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows as { _id?: string; n?: number }[]) byStatus[String(row._id || "other")] = Number(row.n || 0);
  const totals = (money[0] as { billed?: number; due?: number } | undefined) || {};
  return {
    total,
    pending: pendingCount,
    progress: progressCount,
    done: doneCount,
    cancelled,
    unassigned,
    billed: Number(totals.billed || 0),
    due: Number(totals.due || 0),
    byKind,
    byStatus,
  };
}

async function pendingWorkOrderSummary() {
  const match = { status: { $in: ["pending", "reported"] } };
  const unassignedFilter = {
    ...match,
    $and: [
      { $or: [{ technicianId: { $exists: false } }, { technicianId: null }] },
      { $or: [{ technicianIds: { $exists: false } }, { technicianIds: { $size: 0 } }] },
    ],
  };
  const [total, pending, reported, unassigned, slaJobs, byKindRows, byPriorityRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ status: "pending" }),
    ServiceJob.countDocuments({ status: "reported" }),
    ServiceJob.countDocuments(unassignedFilter),
    ServiceJob.find(match).select("reportedAt createdAt jobKind priority").lean(),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$priority", n: { $sum: 1 } } }]),
  ]);
  const slaOverdue = slaJobs.filter((job) => {
    const hours = (Date.now() - new Date(job.reportedAt || job.createdAt || Date.now()).getTime()) / 36e5;
    return hours > slaHoursFor(job.jobKind, job.priority);
  }).length;
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) byKind[String(row._id || "other")] = Number(row.n || 0);
  const byPriority: Record<string, number> = {};
  for (const row of byPriorityRows as { _id?: string; n?: number }[]) byPriority[String(row._id || "medium")] = Number(row.n || 0);
  return { total, pending, reported, unassigned, slaOverdue, byKind, byPriority };
}

async function progressWorkOrderSummary() {
  const match = { status: { $in: ["in_progress", "assigned", "on_site", "waiting_parts"] } };
  const [total, assigned, inProgress, onSite, waitingParts, slaJobs, byKindRows, byPriorityRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ status: "assigned" }),
    ServiceJob.countDocuments({ status: "in_progress" }),
    ServiceJob.countDocuments({ status: "on_site" }),
    ServiceJob.countDocuments({ status: "waiting_parts" }),
    ServiceJob.find(match).select("reportedAt createdAt jobKind priority").lean(),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$priority", n: { $sum: 1 } } }]),
  ]);
  const slaOverdue = slaJobs.filter((job) => {
    const hours = (Date.now() - new Date(job.reportedAt || job.createdAt || Date.now()).getTime()) / 36e5;
    return hours > slaHoursFor(job.jobKind, job.priority);
  }).length;
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) byKind[String(row._id || "other")] = Number(row.n || 0);
  const byPriority: Record<string, number> = {};
  for (const row of byPriorityRows as { _id?: string; n?: number }[]) byPriority[String(row._id || "medium")] = Number(row.n || 0);
  return { total, assigned, inProgress, onSite, waitingParts, slaOverdue, byKind, byPriority };
}

async function completedWorkOrderSummary() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const match = { status: { $in: ["completed", "closed", "delivered", "resolved"] } };
  const [total, today, money, byStatusRows, byKindRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ ...match, completedAt: { $gte: start, $lt: end } }),
    ServiceJob.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
          due: { $sum: { $ifNull: ["$dueAmount", 0] } },
          unpaid: { $sum: { $cond: [{ $gt: ["$dueAmount", 0] }, 1, 0] } },
        },
      },
    ]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows as { _id?: string; n?: number }[]) byStatus[String(row._id || "other")] = Number(row.n || 0);
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) byKind[String(row._id || "other")] = Number(row.n || 0);
  const totals = (money[0] as { billed?: number; due?: number; unpaid?: number } | undefined) || {};
  return {
    total,
    today,
    billed: Number(totals.billed || 0),
    due: Number(totals.due || 0),
    unpaid: Number(totals.unpaid || 0),
    byStatus,
    byKind,
  };
}

async function cancelledWorkOrderSummary() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const week = new Date(start);
  week.setDate(week.getDate() - 7);
  const match = { status: "cancelled" };
  const [total, today, weekCount, byKindRows] = await Promise.all([
    ServiceJob.countDocuments(match),
    ServiceJob.countDocuments({ ...match, updatedAt: { $gte: start, $lt: end } }),
    ServiceJob.countDocuments({ ...match, updatedAt: { $gte: week } }),
    ServiceJob.aggregate([{ $match: match }, { $group: { _id: "$jobKind", n: { $sum: 1 } } }]),
  ]);
  const byKind: Record<string, number> = {};
  for (const row of byKindRows as { _id?: string; n?: number }[]) byKind[String(row._id || "other")] = Number(row.n || 0);
  return { total, today, week: weekCount, byKind };
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  if (searchParams.get("summary") === "technical") {
    return NextResponse.json(await technicalSummary());
  }
  if (searchParams.get("summary") === "desk") {
    return NextResponse.json(await deskSummary());
  }
  if (searchParams.get("summary") === "install") {
    return NextResponse.json(await installationSummary());
  }
  if (searchParams.get("summary") === "history") {
    return NextResponse.json(await historySummary());
  }
  if (searchParams.get("summary") === "complaints") {
    return NextResponse.json(await complaintSummary());
  }
  if (searchParams.get("summary") === "complaint-history") {
    return NextResponse.json(await complaintHistorySummary());
  }
  if (searchParams.get("summary") === "jobs") {
    return NextResponse.json(await workOrderSummary());
  }
  if (searchParams.get("summary") === "pending") {
    return NextResponse.json(await pendingWorkOrderSummary());
  }
  if (searchParams.get("summary") === "progress") {
    return NextResponse.json(await progressWorkOrderSummary());
  }
  if (searchParams.get("summary") === "completed") {
    return NextResponse.json(await completedWorkOrderSummary());
  }
  if (searchParams.get("summary") === "cancelled") {
    return NextResponse.json(await cancelledWorkOrderSummary());
  }

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));
  const overdue = searchParams.get("overdue");
  const scope = searchParams.get("scope");
  const filter = technicalFilter(searchParams);

  let data = await ServiceJob.find(filter)
      .populate("customerId", "name nameBn mobile address location city")
    .populate("machineId", "brand model serialNo machineType nextServiceDue siteName siteLocation siteAddress")
    .populate("technicianId", "name mobile speciality")
    .populate("technicianIds", "name mobile speciality")
    .sort(scope === "history" ? { completedAt: -1, reportedAt: -1 } : { reportedAt: -1, receivedDate: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  if (overdue === "1" || overdue === "true") {
    data = data.filter((job) => {
      if (["resolved", "closed", "completed", "delivered", "cancelled"].includes(String(job.status))) return false;
      const start = new Date(job.reportedAt || job.createdAt || Date.now()).getTime();
      const hours = (Date.now() - start) / 36e5;
      return hours > slaHoursFor(job.jobKind, job.priority);
    });
  }

  const total = overdue ? data.length : await ServiceJob.countDocuments(filter);

  return NextResponse.json({
    data,
    items: data,
    total,
    page,
    limit,
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
  if (!String(body.issueDescription || body.complaintDescription || "").trim()) {
    return NextResponse.json({ error: "missing_issue" }, { status: 400 });
  }

  const seq = await nextSeq("service_job");
  const jobNo = generateDocNo("JOB", seq);
  const site = await houseSiteFromIds(body);

  const crew = normalizeCrew(body.technicianId, body.technicianIds);
  const parts = body.parts || [];
  const serviceLines = Array.isArray(body.serviceLines)
    ? body.serviceLines
    : defaultServiceLines(body.jobKind || body.type);
  let visitCharge = body.visitCharge != null
    ? body.visitCharge
    : body.serviceCharges != null
      ? body.serviceCharges
      : defaultVisitCharge(body.jobKind || body.type);
  const free = await complimentaryForJob({
    machineId: body.machineId,
    jobKind: body.jobKind || body.type,
  });
  if (free.complimentary) visitCharge = 0;
  const payments = body.payments || [];
  const totals = computeServiceTotals({
    serviceLines,
    parts,
    visitCharge,
    discount: body.discount,
    tax: body.tax,
    payments,
    paidAmount: body.paidAmount,
  });

  const nextStatus = body.status || (body.jobKind || body.type ? "reported" : "pending");
  if (["completed", "delivered", "closed"].includes(String(nextStatus))) {
    const gaps = completionGaps({
      technicianId: crew.technicianId,
      technicianIds: crew.technicianIds,
      serviceLines: totals.serviceLines,
      parts: totals.parts,
      visitCharge: totals.visitCharge,
      resolution: body.resolution,
      customerConfirmation: body.customerConfirmation,
      checkedInAt: body.checkedInAt,
    });
    if (gaps.length) {
      return NextResponse.json({ error: "incomplete", gaps }, { status: 400 });
    }
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  try {
    const job = await ServiceJob.create(
      [
        {
          jobNo,
          customerId: body.customerId,
          machineId: body.machineId || undefined,
          technicianId: crew.technicianId,
          technicianIds: crew.technicianIds,
          complimentary: Boolean(free.complimentary),
          jobKind: body.jobKind || body.type || "general",
          equipmentType: body.equipmentType || undefined,
          status: nextStatus,
          fieldStatus: body.fieldStatus || undefined,
          priority: body.priority || "medium",
          issueDescription: body.issueDescription || body.complaintDescription || "Service job",
          reportedBy: body.reportedBy,
          reportedAt: body.reportedAt ? new Date(body.reportedAt) : new Date(),
          scheduledDate: parseDayStart(body.scheduledDate),
          siteName: site.siteName,
          siteLocation: site.siteLocation,
          siteAddress: site.siteAddress,
          lat: "lat" in site ? site.lat : undefined,
          lng: "lng" in site ? site.lng : undefined,
          symptom: body.symptom,
          diagnosis: body.diagnosis,
          resolution: body.resolution,
          customerConfirmation: body.customerConfirmation,
          checklist: body.checklist?.length
            ? body.checklist
            : checklistForEquipment(body.equipmentType, body.jobKind || body.type),
          readings: body.readings?.length ? body.readings : blankReadings(body.equipmentType),
          billable: Boolean(body.billable),
          visitCharge: totals.visitCharge,
          serviceLines: totals.serviceLines,
          serviceLinesTotal: totals.serviceLinesTotal,
          serviceCharges: totals.serviceCharges,
          parts: totals.parts,
          partsTotal: totals.partsTotal,
          discount: totals.discount,
          tax: totals.tax,
          grandTotal: totals.grandTotal,
          paidAmount: totals.paidAmount,
          dueAmount: totals.dueAmount,
          payments,
          notes: body.notes,
          receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
          expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
          warrantyDays: Number(body.warrantyDays || 0),
          labourHours: Number(body.labourHours || 0),
          checkedInAt: body.checkedInAt ? new Date(body.checkedInAt) : undefined,
          checkedOutAt: body.checkedOutAt ? new Date(body.checkedOutAt) : undefined,
          durationMinutes: Number(body.durationMinutes || 0),
          completedAt: ["completed", "delivered", "closed"].includes(String(body.status || "")) ? new Date() : undefined,
          createdBy: session.id,
        },
      ],
      { session: mongoSession },
    );

    // If job is created and it consumes parts, we should probably deduct stock.
    // However, usually parts are consumed when job is "completed" or explicitly issued.
    // For simplicity, if status is "completed" or "delivered", deduct stock.
    if ((body.status === "completed" || body.status === "delivered") && body.locationId) {
      for (const it of totals.parts) {
        if (!it.productId) continue;
        await Product.updateOne(
          { _id: it.productId, "stocks.locationId": body.locationId },
          { $inc: { "stocks.$.qty": -it.qty } },
          { session: mongoSession },
        );
      }
      
      // Update customer balance if there's due amount
      if (body.customerId && totals.dueAmount > 0) {
        await Contact.updateOne(
          { _id: body.customerId },
          { $inc: { balance: totals.dueAmount } },
          { session: mongoSession },
        );
      }
    }

    const created = job[0];
    if (free.complimentary && body.machineId) {
      await markComplimentaryUsed(body.machineId, created._id);
    }
    await mongoSession.commitTransaction();
    await ServiceJob.collection.updateOne(
      { _id: created._id },
      { $set: { siteName: site.siteName, siteLocation: site.siteLocation, siteAddress: site.siteAddress } },
    );
    return NextResponse.json({ data: { ...created.toObject(), ...site } }, { status: 201 });
  } catch (e) {
    await mongoSession.abortTransaction();
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  } finally {
    mongoSession.endSession();
  }
}
