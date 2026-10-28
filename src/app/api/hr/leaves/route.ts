import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requirePayroll } from "@/lib/rbac";
import { Contact, EmployeeLeave } from "@/models";
import { leaveDays } from "@/lib/hr-records";
import { findEmployee } from "@/lib/payroll-server";

export async function GET(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || "";
  const status = searchParams.get("status") || "";
  const filter: Record<string, unknown> = {};
  if (employeeId) filter.employeeId = employeeId;
  if (status && status !== "all") filter.status = status;
  const data = await EmployeeLeave.find(filter).sort({ from: -1 }).limit(300).lean();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  await connectDB();
  const body = await req.json();
  const employee = await findEmployee(String(body.employeeId || ""));
  if (!employee) return NextResponse.json({ error: "missing_employee" }, { status: 400 });
  const from = new Date(body.from);
  const to = new Date(body.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
  }
  const days = Number(body.days || leaveDays(from, to));
  const row = await EmployeeLeave.create({
    employeeId: employee._id,
    employeeName: employee.nameBn || employee.name,
    leaveType: body.leaveType || "casual",
    from,
    to,
    days,
    reason: body.reason,
    status: body.status === "approved" ? "approved" : "pending",
    createdBy: session.id,
  });
  return NextResponse.json({ data: row }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  await connectDB();
  const body = await req.json();
  const id = String(body.id || body._id || "");
  const row = await EmployeeLeave.findById(id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (body.status === "approved" || body.status === "rejected") {
    row.status = body.status;
    row.approvedBy = session.id as never;
    row.decidedAt = new Date();
  }
  if (body.reason != null) row.reason = String(body.reason);
  await row.save();
  return NextResponse.json({ data: row });
}
