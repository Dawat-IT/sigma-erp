import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { canManagePayroll, requireSession } from "@/lib/rbac";
import { ActivityLog, CrmFollowUp, Sale, Technician } from "@/models";
import { DAY_DONE, houseCounts, loadDayJobs, parseDateKey, techIdOf } from "@/lib/service-day";
import { dayBounds } from "@/lib/service-visit";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;

  const date = parseDateKey(req.nextUrl.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  await connectDB();
  const { from, to, jobs } = await loadDayJobs(date);
  const houses = houseCounts(jobs);
  const techs = await Technician.find({ isActive: true }).select("name userId").lean();

  const visitsByTech = new Map<string, number>();
  for (const job of jobs) {
    const id = techIdOf(job);
    if (!id || String(job.status) === "cancelled") continue;
    visitsByTech.set(id, (visitsByTech.get(id) || 0) + 1);
  }

  const flags: { type: "too_fast" | "zero_visits" | "too_far" | "void"; label: string; id: string }[] = [];
  for (const job of jobs) {
    const minutes = Number(job.durationMinutes || 0);
    if (DAY_DONE.has(String(job.status)) && minutes > 0 && minutes < 15) {
      flags.push({
        type: "too_fast",
        label: `${job.jobNo || job._id} ${minutes}m`,
        id: String(job._id),
      });
    }
  }
  for (const tech of techs) {
    if ((visitsByTech.get(String(tech._id)) || 0) === 0) {
      flags.push({ type: "zero_visits", label: tech.name, id: String(tech._id) });
    }
  }

  const [geoLogs, voids] = await Promise.all([
    ActivityLog.find({
      action: "override_geofence",
      createdAt: { $gte: from, $lte: to },
    })
      .select("entityId details")
      .limit(20)
      .lean(),
    Sale.find({
      status: "voided",
      $or: [{ voidedAt: { $gte: from, $lte: to } }, { updatedAt: { $gte: from, $lte: to } }],
    })
      .select("invoiceNo quotationNo")
      .limit(20)
      .lean(),
  ]);
  for (const log of geoLogs) {
    flags.push({ type: "too_far", label: String(log.details || log.entityId || ""), id: String(log.entityId || log._id) });
  }
  for (const sale of voids) {
    flags.push({
      type: "void",
      label: String(sale.invoiceNo || sale.quotationNo || sale._id),
      id: String(sale._id),
    });
  }

  let service = 0;
  let parts = 0;
  let undepositedCash = 0;
  for (const job of jobs) {
    if (String(job.status) === "cancelled") continue;
    service += Number(job.serviceCharges || 0) || Number(job.visitCharge || 0) + Number(job.serviceLinesTotal || 0);
    parts += Number(job.partsTotal || 0);
    const payments = Array.isArray(job.payments) ? job.payments : [];
    for (const pay of payments as { method?: string; amount?: number }[]) {
      if (String(pay.method || "") === "cash") undepositedCash += Number(pay.amount || 0);
    }
  }

  const { from: dayFrom, to: dayTo } = dayBounds(date);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pipelineRows, cashSales, followupsOverdue] = await Promise.all([
    Sale.aggregate([
      { $match: { status: { $in: ["proposal", "quotation", "final"] } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      {
        $match: {
          status: "final",
          saleDate: { $gte: dayFrom, $lte: dayTo },
        },
      },
      { $unwind: { path: "$payments", preserveNullAndEmptyArrays: true } },
      { $match: { "payments.method": "cash" } },
      { $group: { _id: null, total: { $sum: "$payments.amount" } } },
    ]),
    CrmFollowUp.countDocuments({
      scheduledAt: { $lt: todayStart },
      status: { $nin: ["completed", "done", "cancelled"] },
    }),
  ]);

  undepositedCash += Number(cashSales[0]?.total || 0);
  const pipeline = { proposal: 0, quotation: 0, final: 0 };
  for (const row of pipelineRows) {
    const key = String(row._id);
    if (key === "proposal" || key === "quotation" || key === "final") {
      pipeline[key] = row.n;
    }
  }

  const payload: Record<string, unknown> = {
    date,
    houses,
    flags: flags.slice(0, 50),
    money: {
      service: Math.round(service * 100) / 100,
      parts: Math.round(parts * 100) / 100,
      undepositedCash: Math.round(undepositedCash * 100) / 100,
    },
    pipeline,
    followupsOverdue,
  };

  if (canManagePayroll(session.role)) {
    const expected = 3.5;
    payload.payrollRisk = techs.map((tech) => {
      const visits = visitsByTech.get(String(tech._id)) || 0;
      const pct = expected ? Math.round((visits / expected) * 100) : 0;
      return {
        employeeId: String(tech.userId || tech._id),
        visits,
        expected,
        pct,
        flag: visits === 0,
      };
    });
  }

  return NextResponse.json(payload);
}
