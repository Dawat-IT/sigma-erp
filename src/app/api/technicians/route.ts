import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { Technician, ServiceJob } from "@/models";
import { dayBounds } from "@/lib/service-visit";

const CLOSED = ["resolved", "closed", "completed", "delivered", "cancelled"];

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const date = req.nextUrl.searchParams.get("date");
  let data = await Technician.find({ isActive: true }).sort({ name: 1 }).lean();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { from, to } = dayBounds(date);
    const jobs = await ServiceJob.find({
      $or: [
        { scheduledDate: { $gte: from, $lte: to } },
        { checkedInAt: { $gte: from, $lte: to } },
        { reportedAt: { $gte: from, $lte: to } },
      ],
    })
      .select("technicianId technicianIds")
      .lean();
    const crew = new Set<string>();
    for (const job of jobs) {
      if (job.technicianId) crew.add(String(job.technicianId));
      for (const id of job.technicianIds || []) crew.add(String(id));
    }
    data = data.filter((row) => crew.has(String(row._id)));
  }
  const ids = data.map((row) => row._id);
  const stats = ids.length
    ? await ServiceJob.aggregate([
        { $match: { $or: [{ technicianId: { $in: ids } }, { technicianIds: { $in: ids } }] } },
        {
          $addFields: {
            crew: {
              $setUnion: [
                { $cond: [{ $ifNull: ["$technicianId", false] }, ["$technicianId"], []] },
                { $ifNull: ["$technicianIds", []] },
              ],
            },
          },
        },
        { $unwind: "$crew" },
        { $match: { crew: { $in: ids } } },
        {
          $group: {
            _id: "$crew",
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $in: ["$status", CLOSED] }, 0, 1] } },
            billed: { $sum: { $ifNull: ["$grandTotal", 0] } },
          },
        },
      ])
    : [];
  const byId = new Map(stats.map((row) => [String(row._id), row]));
  return NextResponse.json({
    data: data.map((row) => {
      const s = byId.get(String(row._id));
      return {
        ...row,
        jobCount: s?.total || 0,
        openCount: s?.open || 0,
        billedTotal: s?.billed || 0,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const body = await req.json();

  try {
    const tech = await Technician.create({
      userId: body.userId || undefined,
      name: body.name,
      mobile: body.mobile,
      speciality: body.speciality,
    });
    return NextResponse.json({ data: tech }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
