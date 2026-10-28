import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Business, Contact, Payslip } from "@/models";
import { canDelete, canManagePayroll, requirePayroll } from "@/lib/rbac";
import {
  createPayslipDoc,
  findEmployee,
  generatePeriodSlips,
  payPayslip,
  buildSlipFields,
} from "@/lib/payroll-server";
import {
  applyDeductionPercent,
  componentsFromBody,
  computePayrollTotals,
  currentPeriodKey,
  moneyNum,
  normalizePeriodKey,
  periodBounds,
  periodLabelFromKey,
  snapshotFromEmployee,
} from "@/lib/payroll";
import { employeeVisitStats, flaggedPayrollEmployees } from "@/lib/payroll-visits";
import { writeAudit } from "@/lib/audit";

function displayRow(
  emp: Record<string, unknown>,
  slip: Record<string, unknown> | null,
  deductionPercent: number,
) {
  const master = snapshotFromEmployee(emp);
  const source = slip ? snapshotFromEmployee(slip) : applyDeductionPercent(master, slip ? 0 : deductionPercent);
  const totals = computePayrollTotals(source);
  const paid = slip?.status === "paid";
  const net = slip ? moneyNum(slip.netPay) : totals.netPay;
  const gross = slip ? moneyNum(source.basicSalary) + moneyNum(totals.allowances) : totals.grossPay;
  const deductions = slip ? moneyNum(slip.deductions) : totals.deductions;
  return {
    employee: {
      _id: emp._id,
      name: emp.name,
      nameBn: emp.nameBn,
      mobile: emp.mobile,
      designation: emp.designation,
      department: emp.department,
    },
    basic: source.basicSalary,
    incentive: source.incentive,
    campaign: source.campaign,
    yearlyCollection: source.yearlyCollection,
    houseRent: source.houseRent,
    medical: source.medical,
    conveyance: source.conveyance,
    gross,
    deductions,
    net,
    paid: paid ? net : 0,
    due: paid ? 0 : net,
    status: paid ? "paid" : "pending",
    slip: slip
      ? {
          _id: slip._id,
          slipNo: slip.slipNo,
          status: slip.status,
          netPay: slip.netPay,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;

  await connectDB();
  const periodKey = normalizePeriodKey(new URL(req.url).searchParams.get("periodKey"));
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() || "";
  const { from, to } = periodBounds(periodKey);
  const business = await Business.findOne().lean();
  const deductionPercent = moneyNum((business as { payrollDeductionPercent?: number } | null)?.payrollDeductionPercent);

  const [employees, slips] = await Promise.all([
    Contact.find({ type: "employee", isActive: true }).sort({ name: 1 }).lean(),
    Payslip.find({ periodKey }).lean(),
  ]);
  const expectedPerDay = Number((business as { expectedVisitsPerDay?: number } | null)?.expectedVisitsPerDay || 3.5);
  const visits = await employeeVisitStats(employees, periodKey, expectedPerDay);

  const byEmployee = new Map(slips.map((s) => [String(s.employeeId), s]));
  let rows = employees.map((emp) => {
    const base = displayRow(emp as Record<string, unknown>, (byEmployee.get(String(emp._id)) || null) as Record<string, unknown> | null, deductionPercent);
    const stat = visits.get(String(emp._id));
    return {
      ...base,
      visits: stat?.visits || 0,
      expected: stat?.expected || 0,
      visitPct: stat?.visitPct || 0,
      flag: Boolean(stat?.flag),
    };
  });
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.employee.name} ${r.employee.nameBn || ""} ${r.employee.designation || ""} ${r.employee.department || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const paidRows = rows.filter((r) => r.status === "paid");
  const summary = {
    employees: rows.length,
    generated: rows.filter((r) => r.slip).length,
    paid: paidRows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    totalNet: rows.reduce((a, r) => a + r.net, 0),
    paidAmount: rows.reduce((a, r) => a + r.paid, 0),
    dueAmount: rows.reduce((a, r) => a + r.due, 0),
  };

  return NextResponse.json({
    periodKey,
    periodLabel: periodLabelFromKey(periodKey, "en"),
    periodFrom: from,
    periodTo: to,
    deductionPercent,
    summary,
    rows,
    access: {
      canManage: canManagePayroll(session.role),
      canDelete: canDelete(session.role),
      isAdmin: session.role === "admin",
    },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePayroll();
  if (error || !session) return error!;

  await connectDB();
  const body = await req.json();
  const periodKey = normalizePeriodKey(body.periodKey || currentPeriodKey());
  const action = String(body.action || "run");
  const business = await Business.findOne();
  const deductionPercent = moneyNum(body.deductionPercent ?? business?.payrollDeductionPercent);

  if (action === "rules") {
    const percent = Math.max(0, Math.min(100, moneyNum(body.deductionPercent)));
    if (business) {
      business.set("payrollDeductionPercent", percent);
      await business.save();
    } else {
      await Business.create({ name: "Royal Group", payrollDeductionPercent: percent });
    }
    return NextResponse.json({ ok: true, deductionPercent: percent });
  }

  if (action === "upsert_row") {
    const employee = await findEmployee(String(body.employeeId || ""));
    if (!employee) return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
    const fallback = snapshotFromEmployee(employee);
    const components = componentsFromBody(body, fallback);
    await Contact.findByIdAndUpdate(employee._id, {
      $set: {
        basicSalary: components.basicSalary,
        houseRent: components.houseRent,
        medical: components.medical,
        conveyance: components.conveyance,
        incentive: components.incentive,
        campaign: components.campaign,
        yearlyCollection: components.yearlyCollection,
        tax: components.tax,
        otherDeduction: components.otherDeduction,
        advanceDeduction: components.advanceDeduction,
      },
    });
    const existing = await Payslip.findOne({ employeeId: employee._id, periodKey });
    if (existing && existing.status !== "paid") {
      const fields = buildSlipFields(employee, components, periodKey, {
        periodLabel: existing.periodLabel || undefined,
        note: existing.note || undefined,
      });
      Object.assign(existing, fields);
      await existing.save();
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "pay_one") {
    const employee = await findEmployee(String(body.employeeId || ""));
    if (!employee) return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
    let slipDoc = await Payslip.findOne({ employeeId: employee._id, periodKey });
    if (!slipDoc) {
      const withTax = applyDeductionPercent(snapshotFromEmployee(employee), deductionPercent);
      const created = await createPayslipDoc(employee, { periodKey, ...withTax }, session.id);
      if (created.error === "duplicate_period") {
        slipDoc = await Payslip.findById(created.slip._id);
      } else {
        slipDoc = created.slip as typeof slipDoc;
      }
    }
    if (!slipDoc) return NextResponse.json({ error: "payslip_failed" }, { status: 500 });
    if (Number(slipDoc.netPay || 0) <= 0) {
      return NextResponse.json({ error: "zero_salary" }, { status: 400 });
    }
    const paid = await payPayslip(slipDoc, session.id, body.paymentMethod || "bank");
    await writeAudit({
      userId: session.id,
      userName: session.name,
      action: "pay_slip",
      entityType: "Payslip",
      entityId: String(paid._id),
      details: String(paid.slipNo || ""),
    });
    return NextResponse.json({ data: paid });
  }

  if (action === "pay_all") {
    const expectedPerDay = Number(business?.expectedVisitsPerDay || 3.5);
    const blocked = await flaggedPayrollEmployees(periodKey, expectedPerDay);
    if (blocked.length && body.confirmFlags !== true) {
      return NextResponse.json({ error: "pay_blocked", flags: blocked }, { status: 409 });
    }
    const generated = await generatePeriodSlips(periodKey, session.id, deductionPercent);
    const drafts = await Payslip.find({ periodKey, status: "draft", netPay: { $gt: 0 } });
    let paid = 0;
    for (const slip of drafts) {
      await payPayslip(slip, session.id, body.paymentMethod || "bank");
      paid += 1;
    }
    await writeAudit({
      userId: session.id,
      userName: session.name,
      action: "pay_all",
      entityType: "Payslip",
      details: `${periodKey} paid=${paid} confirm=${Boolean(body.confirmFlags)}`,
    });
    return NextResponse.json({ ok: true, paid, generated: generated.created, periodKey });
  }

  const result = await generatePeriodSlips(periodKey, session.id, deductionPercent);
  return NextResponse.json({ ok: true, ...result });
}

