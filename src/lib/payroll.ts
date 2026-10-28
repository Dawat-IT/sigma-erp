/** Payroll math and period helpers — safe to import from client or server. */

export const PAYROLL_PAYMENT_METHODS = [
  "cash",
  "bank",
  "bkash",
  "nagad",
  "rocket",
  "cheque",
  "card",
] as const;

export type PayrollPaymentMethod = (typeof PAYROLL_PAYMENT_METHODS)[number];

export type SalaryComponents = {
  basicSalary: number;
  houseRent: number;
  medical: number;
  conveyance: number;
  overtime: number;
  bonus: number;
  incentive: number;
  campaign: number;
  yearlyCollection: number;
  otherAllowance: number;
  advanceDeduction: number;
  tax: number;
  otherDeduction: number;
};

export const EMPTY_COMPONENTS: SalaryComponents = {
  basicSalary: 0,
  houseRent: 0,
  medical: 0,
  conveyance: 0,
  overtime: 0,
  bonus: 0,
  incentive: 0,
  campaign: 0,
  yearlyCollection: 0,
  otherAllowance: 0,
  advanceDeduction: 0,
  tax: 0,
  otherDeduction: 0,
};

export const PAYROLL_MONTHS = [
  { value: "01", en: "January", bn: "জানুয়ারি" },
  { value: "02", en: "February", bn: "ফেব্রুয়ারি" },
  { value: "03", en: "March", bn: "মার্চ" },
  { value: "04", en: "April", bn: "এপ্রিল" },
  { value: "05", en: "May", bn: "মে" },
  { value: "06", en: "June", bn: "জুন" },
  { value: "07", en: "July", bn: "জুলাই" },
  { value: "08", en: "August", bn: "আগস্ট" },
  { value: "09", en: "September", bn: "সেপ্টেম্বর" },
  { value: "10", en: "October", bn: "অক্টোবর" },
  { value: "11", en: "November", bn: "নভেম্বর" },
  { value: "12", en: "December", bn: "ডিসেম্বর" },
] as const;

export function moneyNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pickMoney(value: unknown, fallback: number): number {
  if (value == null || value === "") return fallback;
  return moneyNum(value);
}

export function snapshotFromEmployee(emp: Partial<SalaryComponents> | null | undefined): SalaryComponents {
  return {
    basicSalary: moneyNum(emp?.basicSalary),
    houseRent: moneyNum(emp?.houseRent),
    medical: moneyNum(emp?.medical),
    conveyance: moneyNum(emp?.conveyance),
    overtime: moneyNum(emp?.overtime),
    bonus: moneyNum(emp?.bonus),
    incentive: moneyNum(emp?.incentive),
    campaign: moneyNum(emp?.campaign),
    yearlyCollection: moneyNum(emp?.yearlyCollection),
    otherAllowance: moneyNum(emp?.otherAllowance),
    advanceDeduction: moneyNum(emp?.advanceDeduction),
    tax: moneyNum(emp?.tax),
    otherDeduction: moneyNum(emp?.otherDeduction),
  };
}

export function componentsFromBody(
  body: Partial<SalaryComponents> & Record<string, unknown>,
  fallback: SalaryComponents,
): SalaryComponents {
  return {
    basicSalary: pickMoney(body.basicSalary, fallback.basicSalary),
    houseRent: pickMoney(body.houseRent, fallback.houseRent),
    medical: pickMoney(body.medical, fallback.medical),
    conveyance: pickMoney(body.conveyance, fallback.conveyance),
    overtime: pickMoney(body.overtime, fallback.overtime),
    bonus: pickMoney(body.bonus, fallback.bonus),
    incentive: pickMoney(body.incentive, fallback.incentive),
    campaign: pickMoney(body.campaign, fallback.campaign),
    yearlyCollection: pickMoney(body.yearlyCollection, fallback.yearlyCollection),
    otherAllowance: pickMoney(body.otherAllowance, fallback.otherAllowance),
    advanceDeduction: pickMoney(body.advanceDeduction, fallback.advanceDeduction),
    tax: pickMoney(body.tax, fallback.tax),
    otherDeduction: pickMoney(body.otherDeduction, fallback.otherDeduction),
  };
}

export function sumAllowances(c: SalaryComponents): number {
  return (
    moneyNum(c.houseRent) +
    moneyNum(c.medical) +
    moneyNum(c.conveyance) +
    moneyNum(c.overtime) +
    moneyNum(c.bonus) +
    moneyNum(c.incentive) +
    moneyNum(c.campaign) +
    moneyNum(c.yearlyCollection) +
    moneyNum(c.otherAllowance)
  );
}

export function sumDeductions(c: SalaryComponents): number {
  return moneyNum(c.advanceDeduction) + moneyNum(c.tax) + moneyNum(c.otherDeduction);
}

export function computePayrollTotals(c: SalaryComponents) {
  const allowances = sumAllowances(c);
  const deductions = sumDeductions(c);
  const grossPay = moneyNum(c.basicSalary) + allowances;
  const netPay = grossPay - deductions;
  return { allowances, deductions, grossPay, netPay };
}

export function currentPeriodKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isPeriodKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function normalizePeriodKey(input?: string | null, from?: Date | string | null): string {
  if (isPeriodKey(input)) return input;
  if (from) {
    const d = from instanceof Date ? from : new Date(from);
    if (!Number.isNaN(d.getTime())) return currentPeriodKey(d);
  }
  return currentPeriodKey();
}

export function periodBounds(periodKey: string): { from: Date; to: Date } {
  const [ys, ms] = periodKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  return {
    from: new Date(y, m - 1, 1, 0, 0, 0, 0),
    to: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

export function periodLabelFromKey(periodKey: string, locale: "bn" | "en" = "en"): string {
  const [ys, ms] = periodKey.split("-");
  const d = new Date(Number(ys), Number(ms) - 1, 1);
  return d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    numberingSystem: "latn",
    month: "long",
    year: "numeric",
  });
}

/** Admin, manager, and accountant run payroll. Admin always has full access. */
export function canManagePayroll(role: string) {
  return role === "admin" || role === "accountant";
}

export function hasSalarySetup(c: Partial<SalaryComponents>): boolean {
  return computePayrollTotals(snapshotFromEmployee(c)).grossPay > 0;
}

export function applyDeductionPercent(c: SalaryComponents, percent: number): SalaryComponents {
  const p = moneyNum(percent);
  if (p <= 0) return c;
  const totals = computePayrollTotals(c);
  if (totals.deductions > 0 || totals.grossPay <= 0) return c;
  return { ...c, tax: Math.round((totals.grossPay * p) / 100) };
}

function groupInt(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** Screenshot-style ৳36,812 with no decimals. Zero incentive columns use an em dash. */
export function formatTk(amount: number, emptyDash = false) {
  const n = Math.round(moneyNum(amount));
  if (emptyDash && n === 0) return "—";
  return `৳${groupInt(n)}`;
}

export function formatTkDeduction(amount: number) {
  const n = Math.round(moneyNum(amount));
  if (n === 0) return "-৳0";
  return `-৳${groupInt(n)}`;
}
