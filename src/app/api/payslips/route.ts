import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Payslip } from "@/models";
import { canDelete, canManagePayroll, requirePayroll } from "@/lib/rbac";
import { isDuplicateKeyError, createPayslipDoc, findEmployee } from "@/lib/payroll-server";
import { normalizePeriodKey } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const periodKey = searchParams.get("periodKey");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(500, Number(searchParams.get("limit") || 100));

  const filter: Record<string, unknown> = {};
  if (employeeId) filter.employeeId = employeeId;
  if (periodKey) filter.periodKey = normalizePeriodKey(periodKey);
  if (status === "draft" || status === "paid") filter.status = status;
  if (q) {
    filter.$or = [
      { slipNo: new RegExp(q, "i") },
      { employeeName: new RegExp(q, "i") },
      { periodLabel: new RegExp(q, "i") },
    ];
  }

  const data = await Payslip.find(filter).sort({ periodKey: -1, createdAt: -1 }).limit(limit).lean();
  const summary = data.reduce(
    (acc, row) => {
      const net = Number(row.netPay || 0);
      acc.count += 1;
      acc.net += net;
      if (row.status === "paid") {
        acc.paid += 1;
        acc.paidAmount += net;
      } else {
        acc.draft += 1;
        acc.unpaidAmount += net;
      }
      return acc;
    },
    { count: 0, draft: 0, paid: 0, net: 0, paidAmount: 0, unpaidAmount: 0 },
  );

  return NextResponse.json({
    data,
    summary,
    access: {
      canManage: canManagePayroll(session.role),
      canDelete: canDelete(session.role),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const employee = await findEmployee(String(body.employeeId || ""));
  if (!employee) {
    return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
  }

  try {
    const result = await createPayslipDoc(employee, body, session.id);
    if (result.error === "duplicate_period") {
      return NextResponse.json(
        { error: "duplicate_period", data: result.slip },
        { status: 409 },
      );
    }
    return NextResponse.json({ data: result.slip }, { status: 201 });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: "duplicate_period" }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "create_failed";
    console.error("POST /api/payslips", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
