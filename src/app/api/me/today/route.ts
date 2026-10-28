import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { Technician } from "@/models";
import { assignedTechMatch } from "@/lib/job-crew";
import { houseCounts, loadDayJobs, parseDateKey } from "@/lib/service-day";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;

  const date = parseDateKey(req.nextUrl.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  await connectDB();
  const technician = await Technician.findOne({ userId: session.id, isActive: true }).lean();
  if (!technician) {
    return NextResponse.json({ error: "not_a_technician" }, { status: 404 });
  }

  const { jobs } = await loadDayJobs(date, { ...assignedTechMatch(technician._id), status: { $ne: "cancelled" } });
  const counts = houseCounts(jobs);

  return NextResponse.json({
    technician,
    date,
    jobs,
    counts: { planned: counts.planned, onSite: counts.onSite, done: counts.done },
  });
}
