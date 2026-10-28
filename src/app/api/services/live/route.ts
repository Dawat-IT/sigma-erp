import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ServiceJob } from "@/models";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  const jobs = await ServiceJob.find({
    checkedInAt: { $exists: true, $ne: null },
    $or: [{ checkedOutAt: { $exists: false } }, { checkedOutAt: null }],
  })
    .populate("technicianId", "name mobile speciality")
    .populate("technicianIds", "name mobile speciality")
    .populate("customerId", "name nameBn mobile address location city")
    .populate("machineId", "brand model serialNo machineType siteName siteLocation siteAddress")
    .sort({ checkedInAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json({ data: jobs, total: jobs.length });
}
