import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireDelete, requireWrite } from "@/lib/rbac";
import { Technician, ServiceJob } from "@/models";
import mongoose from "mongoose";
import { assignedTechMatch } from "@/lib/job-crew";

const CLOSED = ["resolved", "closed", "completed", "delivered", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const item = await Technician.findById(id).lean();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const withJobs = new URL(req.url).searchParams.get("withJobs");
  if (withJobs === "1" || withJobs === "true") {
    const jobs = await ServiceJob.find(assignedTechMatch(id))
      .populate("customerId", "name nameBn mobile location city")
      .populate("machineId", "brand model serialNo machineType")
      .populate("technicianId", "name mobile")
      .populate("technicianIds", "name")
      .sort({ reportedAt: -1, receivedDate: -1 })
      .limit(200)
      .lean();
    const open = jobs.filter((job) => !CLOSED.includes(String(job.status))).length;
    const billed = jobs.reduce((sum, job) => sum + Number(job.grandTotal || 0), 0);
    return NextResponse.json({
      data: item,
      jobs,
      summary: {
        total: jobs.length,
        open,
        completed: jobs.length - open,
        billed,
      },
    });
  }

  return NextResponse.json({ data: item });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();

  try {
    const updated = await Technician.findByIdAndUpdate(
      id,
      {
        name: body.name,
        mobile: body.mobile,
        speciality: body.speciality,
      },
      { new: true, runValidators: true },
    );
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;

  await connectDB();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const jobCount = await ServiceJob.countDocuments(assignedTechMatch(id));
  if (jobCount > 0) {
    return NextResponse.json({ error: "has_jobs", jobCount }, { status: 409 });
  }
  await Technician.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
