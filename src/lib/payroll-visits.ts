import { Contact, ServiceJob, Technician } from "@/models";
import { periodBounds } from "@/lib/payroll";

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

/** Bangladesh field week: Friday off. */
export function workingDaysBetween(from: Date, to: Date) {
  let n = 0;
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur <= end) {
    if (cur.getDay() !== 5) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, n);
}

export type VisitStat = {
  employeeId: string;
  visits: number;
  expected: number;
  visitPct: number;
  flag: boolean;
};

export async function employeeVisitStats(
  employees: { _id?: unknown; mobile?: unknown; userId?: unknown }[],
  periodKey: string,
  expectedPerDay = 3.5,
): Promise<Map<string, VisitStat>> {
  const { from, to } = periodBounds(periodKey);
  const expected = Math.round(workingDaysBetween(from, to) * Number(expectedPerDay || 3.5) * 100) / 100;
  const techs = await Technician.find({ isActive: true }).select("name mobile userId employeeId").lean();
  const techIds = techs.map((row) => row._id);
  const counts = techIds.length
    ? await ServiceJob.aggregate([
        {
          $match: {
            $and: [
              {
                $or: [
                  { technicianId: { $in: techIds } },
                  { technicianIds: { $in: techIds } },
                ],
              },
              { status: { $ne: "cancelled" } },
              {
                $or: [
                  { checkedInAt: { $gte: from, $lte: to } },
                  { completedAt: { $gte: from, $lte: to } },
                ],
              },
            ],
          },
        },
        { $addFields: {
            crew: {
              $setUnion: [
                { $cond: [{ $ifNull: ["$technicianId", false] }, ["$technicianId"], []] },
                { $ifNull: ["$technicianIds", []] },
              ],
            },
        } },
        { $unwind: "$crew" },
        { $group: { _id: "$crew", visits: { $sum: 1 } } },
      ])
    : [];
  const byTech = new Map(counts.map((row) => [String(row._id), Number(row.visits || 0)]));

  function techFor(emp: { _id?: unknown; mobile?: unknown; userId?: unknown }) {
    const empId = emp._id ? String(emp._id) : "";
    if (empId) {
      const byEmp = techs.find((row) => row.employeeId && String(row.employeeId) === empId);
      if (byEmp) return byEmp;
    }
    const uid = emp.userId ? String(emp.userId) : "";
    if (uid) {
      const byUser = techs.find((row) => row.userId && String(row.userId) === uid);
      if (byUser) return byUser;
    }
    const mob = digits(emp.mobile);
    if (!mob) return null;
    return techs.find((row) => digits(row.mobile) === mob) || null;
  }

  const map = new Map<string, VisitStat>();
  for (const emp of employees) {
    const id = String(emp._id);
    const tech = techFor(emp);
    if (!tech) {
      map.set(id, { employeeId: id, visits: 0, expected, visitPct: 0, flag: false });
      continue;
    }
    const visits = byTech.get(String(tech._id)) || 0;
    const visitPct = expected ? Math.round((visits / expected) * 100) : 0;
    map.set(id, {
      employeeId: id,
      visits,
      expected,
      visitPct,
      flag: visits === 0,
    });
  }
  return map;
}

export async function flaggedPayrollEmployees(periodKey: string, expectedPerDay = 3.5) {
  const employees = await Contact.find({ type: "employee", isActive: true }).select("name mobile").lean();
  const stats = await employeeVisitStats(employees, periodKey, expectedPerDay);
  return employees
    .map((emp) => {
      const row = stats.get(String(emp._id));
      return row && row.flag
        ? { employeeId: String(emp._id), name: emp.name, visits: row.visits, expected: row.expected, visitPct: row.visitPct }
        : null;
    })
    .filter(Boolean) as { employeeId: string; name: string; visits: number; expected: number; visitPct: number }[];
}
