import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requirePayroll } from "@/lib/rbac";
import { Attendance } from "@/models";
import { attendanceMinutes } from "@/lib/hr-records";
import { findEmployee } from "@/lib/payroll-server";
import { todayKey } from "@/lib/service-visit";

export async function GET(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || "";
  const dateKey = searchParams.get("date") || "";
  const filter: Record<string, unknown> = {};
  if (employeeId) filter.employeeId = employeeId;
  if (dateKey) filter.dateKey = dateKey;
  const data = await Attendance.find(filter).sort({ dateKey: -1, employeeName: 1 }).limit(400).lean();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  await connectDB();
  const body = await req.json();
  const employee = await findEmployee(String(body.employeeId || ""));
  if (!employee) return NextResponse.json({ error: "missing_employee" }, { status: 400 });
  const dateKey = String(body.dateKey || todayKey());
  const punchIn = body.punchIn ? new Date(body.punchIn) : undefined;
  const punchOut = body.punchOut ? new Date(body.punchOut) : undefined;
  const minutes = attendanceMinutes(punchIn, punchOut);
  const row = await Attendance.findOneAndUpdate(
    { employeeId: employee._id, dateKey },
    {
      $set: {
        employeeName: employee.nameBn || employee.name,
        punchIn,
        punchOut,
        minutes,
        status: body.status || (punchIn ? "present" : "absent"),
        source: body.source || "office",
        note: body.note,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return NextResponse.json({ data: row }, { status: 201 });
}
