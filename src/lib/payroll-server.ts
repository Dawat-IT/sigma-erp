import mongoose from "mongoose";
import { Contact, Expense, Payslip, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import {
  applyDeductionPercent,
  componentsFromBody,
  computePayrollTotals,
  EMPTY_COMPONENTS,
  hasSalarySetup,
  normalizePeriodKey,
  periodBounds,
  periodLabelFromKey,
  snapshotFromEmployee,
  type SalaryComponents,
} from "@/lib/payroll";

export type PayslipInput = Partial<SalaryComponents> & {
  employeeId?: string;
  periodKey?: string;
  periodLabel?: string;
  periodFrom?: string;
  periodTo?: string;
  note?: string;
  paid?: boolean;
  status?: string;
  paymentMethod?: string;
  updateEmployeeSalary?: unknown;
};

export function isDuplicateKeyError(err: unknown) {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000);
}

export async function findEmployee(employeeId: string) {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) return null;
  const employee = await Contact.findById(employeeId).lean();
  if (!employee || employee.type !== "employee") return null;
  return employee;
}

export function buildSlipFields(
  employee: { name?: string; nameBn?: string },
  components: SalaryComponents,
  periodKey: string,
  extra?: { periodLabel?: string; note?: string },
) {
  const totals = computePayrollTotals(components);
  const { from, to } = periodBounds(periodKey);
  return {
    employeeName: employee.nameBn || employee.name,
    periodKey,
    periodLabel: String(extra?.periodLabel || "").trim() || periodLabelFromKey(periodKey, "en"),
    periodFrom: from,
    periodTo: to,
    ...components,
    allowances: totals.allowances,
    deductions: totals.deductions,
    netPay: totals.netPay,
    note: String(extra?.note || "").trim(),
  };
}

export async function createPayslipDoc(
  employee: { _id: unknown; name?: string; nameBn?: string } & Partial<SalaryComponents>,
  body: PayslipInput,
  createdBy: string,
) {
  const periodKey = normalizePeriodKey(body.periodKey, body.periodFrom);
  const existing = await Payslip.findOne({ employeeId: employee._id, periodKey }).lean();
  if (existing) {
    return { error: "duplicate_period" as const, slip: existing };
  }

  const fallback = snapshotFromEmployee(employee);
  const components = componentsFromBody(body, fallback);
  const seq = await nextSeq("payslip");
  const fields = buildSlipFields(employee, components, periodKey, {
    periodLabel: body.periodLabel,
    note: body.note,
  });

  const slip = await Payslip.create({
    slipNo: generateDocNo("PAY", seq),
    employeeId: employee._id,
    createdBy,
    status: "draft",
    paymentMethod: body.paymentMethod || "cash",
    ...fields,
  });

  if (body.updateEmployeeSalary) {
    await Contact.findByIdAndUpdate(employee._id, {
      $set: {
        basicSalary: components.basicSalary,
        houseRent: components.houseRent,
        medical: components.medical,
        conveyance: components.conveyance,
        incentive: components.incentive,
        campaign: components.campaign,
        yearlyCollection: components.yearlyCollection,
      },
    });
  }

  const markPaid = body.status === "paid" || body.paid === true;
  if (markPaid) {
    await payPayslip(slip, createdBy, body.paymentMethod || "cash");
  }

  return { error: null, slip };
}

export async function payPayslip(
  slip: InstanceType<typeof Payslip>,
  paidBy: string,
  paymentMethod = "cash",
) {
  if (slip.status === "paid" && slip.expenseId) return slip;
  const expense =
    slip.expenseId
      ? await Expense.findById(slip.expenseId)
      : await Expense.create({
          category: "Salary",
          title: `Salary ${slip.employeeName || ""} ${slip.periodLabel || slip.periodKey || ""}`.trim(),
          amount: Number(slip.netPay || 0),
          paymentMethod,
          note: `Payslip ${slip.slipNo}`,
          expenseDate: new Date(),
          createdBy: paidBy,
        });
  if (!expense) {
    throw new Error("salary_expense_failed");
  }
  const updated = await Payslip.findByIdAndUpdate(
    slip._id,
    {
      $set: {
        status: "paid",
        paidAt: new Date(),
        paidBy,
        paymentMethod,
        expenseId: expense._id,
      },
    },
    { new: true, runValidators: false },
  );
  if (!updated) throw new Error("payslip_pay_failed");
  return updated;
}

export async function generatePeriodSlips(periodKey: string, createdBy: string, deductionPercent = 0) {
  const employees = await Contact.find({ type: "employee", isActive: true }).lean();
  const existing = await Payslip.find({ periodKey }).select("employeeId").lean();
  const have = new Set(existing.map((s) => String(s.employeeId)));

  const created = [];
  const skipped = { already: 0, noSalary: 0 };
  for (const emp of employees) {
    if (have.has(String(emp._id))) {
      skipped.already += 1;
      continue;
    }
    if (!hasSalarySetup(emp)) {
      skipped.noSalary += 1;
      continue;
    }
    const withTax = applyDeductionPercent(snapshotFromEmployee(emp), deductionPercent);
    const result = await createPayslipDoc(emp, { periodKey, ...withTax }, createdBy);
    if (result.error) {
      skipped.already += 1;
      continue;
    }
    created.push(result.slip);
  }
  return { created: created.length, skipped, periodKey };
}

export { EMPTY_COMPONENTS };
