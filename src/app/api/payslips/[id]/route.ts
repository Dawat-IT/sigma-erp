import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Expense, Payslip } from "@/models";
import { canDelete, canManagePayroll, isSuperAdmin, requirePayroll } from "@/lib/rbac";
import {
  buildSlipFields,
  findEmployee,
  payPayslip,
} from "@/lib/payroll-server";
import { componentsFromBody, snapshotFromEmployee, normalizePeriodKey } from "@/lib/payroll";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await connectDB();
  const slip = await Payslip.findById(id).lean();
  if (!slip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const employee = await findEmployee(String(slip.employeeId));
  return NextResponse.json({
    data: slip,
    employee: employee
      ? {
          _id: employee._id,
          name: employee.name,
          nameBn: employee.nameBn,
          mobile: employee.mobile,
          designation: employee.designation,
          department: employee.department,
        }
      : null,
    access: { canManage: canManagePayroll(session.role), canDelete: canDelete(session.role) },
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await connectDB();
  const slip = await Payslip.findById(id);
  if (!slip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  if (body.action === "pay") {
    const paid = await payPayslip(slip, session.id, body.paymentMethod || slip.paymentMethod || "cash");
    return NextResponse.json({ data: paid });
  }

  if (slip.status === "paid" && !isSuperAdmin(session.role)) {
    return NextResponse.json({ error: "paid_locked" }, { status: 409 });
  }

  const employee = await findEmployee(String(slip.employeeId));
  const periodKey = String(slip.periodKey || "") || normalizePeriodKey();
  const fallback = snapshotFromEmployee({
    basicSalary: slip.basicSalary,
    houseRent: slip.houseRent,
    medical: slip.medical,
    conveyance: slip.conveyance,
    overtime: slip.overtime,
    bonus: slip.bonus,
    otherAllowance: slip.otherAllowance,
    advanceDeduction: slip.advanceDeduction,
    tax: slip.tax,
    otherDeduction: slip.otherDeduction,
  });
  const components = componentsFromBody(body, fallback);
  const fields = buildSlipFields(employee || { name: slip.employeeName }, components, periodKey, {
    periodLabel: body.periodLabel ?? slip.periodLabel,
    note: body.note ?? slip.note,
  });
  Object.assign(slip, fields);
  if (body.paymentMethod) slip.paymentMethod = body.paymentMethod;
  await slip.save();
  return NextResponse.json({ data: slip });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await connectDB();
  const slip = await Payslip.findById(id);
  if (!slip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (slip.status === "paid") {
    if (!isSuperAdmin(session.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (slip.expenseId) {
      await Expense.findByIdAndDelete(slip.expenseId);
    }
  } else if (!canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await slip.deleteOne();
  return NextResponse.json({ ok: true });
}
