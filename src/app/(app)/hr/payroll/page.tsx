"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Banknote,
  CheckCircle2,
  Pencil,
  Search,
  Settings2,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { EmptyState, Field, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  currentPeriodKey,
  formatTk,
  formatTkDeduction,
  PAYROLL_MONTHS,
  periodLabelFromKey,
} from "@/lib/payroll";

type Row = {
  employee: {
    _id: string;
    name: string;
    nameBn?: string;
    mobile?: string;
    designation?: string;
    department?: string;
  };
  basic: number;
  incentive: number;
  campaign: number;
  yearlyCollection: number;
  houseRent: number;
  medical: number;
  conveyance: number;
  gross: number;
  deductions: number;
  net: number;
  paid: number;
  due: number;
  status: "paid" | "pending";
  slip: { _id: string; slipNo: string; status: string; netPay: number } | null;
};

type Summary = {
  employees: number;
  generated: number;
  paid: number;
  pending: number;
  totalNet: number;
  paidAmount: number;
  dueAmount: number;
};

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

function splitPeriod(periodKey: string) {
  const [year, month] = periodKey.split("-");
  return { year: year || String(new Date().getFullYear()), month: month || "01" };
}

export default function PayrollDeskPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [periodKey, setPeriodKey] = useState(currentPeriodKey());
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({
    employees: 0,
    generated: 0,
    paid: 0,
    pending: 0,
    totalNet: 0,
    paidAmount: 0,
    dueAmount: 0,
  });
  const [deductionPercent, setDeductionPercent] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesPercent, setRulesPercent] = useState("0");
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({
    basicSalary: "0",
    incentive: "0",
    campaign: "0",
    yearlyCollection: "0",
    houseRent: "0",
    medical: "0",
    conveyance: "0",
    tax: "0",
  });

  const { year, month } = splitPeriod(periodKey);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ periodKey });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/payroll?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setRows(json.rows || []);
      setSummary(json.summary || summary);
      setDeductionPercent(Number(json.deductionPercent || 0));
      setCanManage(Boolean(json.access?.canManage));
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, q, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), q ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [load, q]);

  const periodTitle = useMemo(
    () => periodLabelFromKey(periodKey, bn ? "bn" : "en"),
    [periodKey, bn],
  );

  function setMonthYear(nextMonth: string, nextYear: string) {
    setPeriodKey(`${nextYear}-${nextMonth}`);
  }

  async function postPayroll(payload: Record<string, unknown>, success: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, periodKey, paymentMethod: "bank" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      await load();
      setMsg(success);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: Row) {
    setEditRow(row);
    setEditForm({
      basicSalary: String(row.basic || 0),
      incentive: String(row.incentive || 0),
      campaign: String(row.campaign || 0),
      yearlyCollection: String(row.yearlyCollection || 0),
      houseRent: String(row.houseRent || 0),
      medical: String(row.medical || 0),
      conveyance: String(row.conveyance || 0),
      tax: String(row.deductions || 0),
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    await postPayroll(
      {
        action: "upsert_row",
        employeeId: editRow.employee._id,
        basicSalary: Number(editForm.basicSalary || 0),
        incentive: Number(editForm.incentive || 0),
        campaign: Number(editForm.campaign || 0),
        yearlyCollection: Number(editForm.yearlyCollection || 0),
        houseRent: Number(editForm.houseRent || 0),
        medical: Number(editForm.medical || 0),
        conveyance: Number(editForm.conveyance || 0),
        tax: Number(editForm.tax || 0),
      },
      bn ? "স্যালারি আপডেট হয়েছে" : "Salary row updated",
    );
    setEditRow(null);
  }

  async function saveRules(e: FormEvent) {
    e.preventDefault();
    await postPayroll(
      { action: "rules", deductionPercent: Number(rulesPercent || 0) },
      bn ? "পে-রোল রুল সেভ হয়েছে" : "Payroll rules saved",
    );
    setRulesOpen(false);
  }

  const kpis = [
    {
      label: bn ? "মোট নেট স্যালারি" : "Total Net Salary",
      value: formatTk(summary.totalNet),
      icon: Wallet,
      wrap: "bg-blue-50 text-blue-600",
      valueClass: "text-blue-600",
    },
    {
      label: bn ? "মোট পেইড" : "Total Paid",
      value: formatTk(summary.paidAmount),
      icon: CheckCircle2,
      wrap: "bg-emerald-50 text-emerald-600",
      valueClass: "text-emerald-600",
    },
    {
      label: bn ? "মোট বাকি" : "Total Due",
      value: formatTk(summary.dueAmount),
      icon: Banknote,
      wrap: "bg-rose-50 text-rose-600",
      valueClass: "text-rose-600",
    },
    {
      label: bn ? "পেইড / মোট" : "Paid / Total",
      value: `${summary.paid} / ${summary.employees}`,
      icon: Users,
      wrap: "bg-violet-50 text-violet-600",
      valueClass: "text-violet-600",
    },
  ];

  return (
    <div className="gp-desk">
      <div className="gp-page-header">
        <div className="gp-page-header__copy">
          <h1 className="gp-display">
            {bn ? "পে-রোল" : "Payroll"}
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-muted">
            {bn ? `${periodTitle} স্যালারি ম্যানেজমেন্ট` : `${periodTitle} salary management`}
          </p>
        </div>
        <div className="gp-page-header__actions">
          <Link href="/contacts/employees" className="gp-btn gp-btn-ghost">
            {bn ? "কর্মচারী" : "Employees"}
          </Link>
          <Link href="/hr/leaves" className="gp-btn gp-btn-ghost">
            {bn ? "ছুটি" : "Leaves"}
          </Link>
          <Link href="/hr/attendance" className="gp-btn gp-btn-ghost">
            {bn ? "হাজিরা" : "Attendance"}
          </Link>
          {canManage ? (
            <>
              <button
                type="button"
                className="gp-btn gp-btn-ghost min-h-10"
                disabled={busy}
                onClick={() =>
                  void postPayroll(
                    { action: "pay_all" },
                    bn ? "সব বাকি স্যালারি পেইড" : "All due salaries marked paid",
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                {bn ? "সব পেইড করুন" : "Mark All Paid"}
              </button>
              <button
                type="button"
                className="gp-btn gp-btn-ghost min-h-10"
                disabled={busy}
                onClick={() => {
                  setRulesPercent(String(deductionPercent || 0));
                  setRulesOpen(true);
                }}
              >
                <Settings2 className="h-4 w-4" />
                {bn ? "রুলস" : "Rules"}
              </button>
              <button
                type="button"
                className="gp-btn gp-btn-primary min-h-10"
                disabled={busy}
                onClick={() =>
                  void postPayroll(
                    { action: "run" },
                    bn ? "মাসের পেস্লিপ জেনারেট হয়েছে" : "Month generated",
                  )
                }
              >
                <Sparkles className="h-4 w-4" />
                {bn ? "জেনারেট" : "Generate"}
              </button>
            </>
          ) : null}
          <label className="relative min-w-[180px] flex-1 xl:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="gp-input pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={bn ? "খুঁজুন..." : "Search..."}
            />
          </label>
        </div>
      </div>

      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="gp-input !w-[10.5rem] shrink-0"
          value={month}
          onChange={(e) => setMonthYear(e.target.value, year)}
        >
          {PAYROLL_MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {bn ? m.bn : m.en}
            </option>
          ))}
        </select>
        <select
          className="gp-input !w-[6.5rem] shrink-0"
          value={year}
          onChange={(e) => setMonthYear(month, e.target.value)}
        >
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-sm font-medium text-muted">
          {summary.employees} {bn ? "কর্মচারী" : "employees"}
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5 shadow-sm">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", kpi.wrap)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.75rem] font-semibold text-[var(--gp-text-2)]">{kpi.label}</p>
                <p className={cn("gp-money truncate text-xl font-bold leading-tight", kpi.valueClass)}>{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            bn ? "কোনো কর্মচারী নেই — স্যালারি মাস্টারে যোগ করুন" : "No employees yet — add them on the salary master"
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="gp-table gp-table-compact min-w-[1100px]">
              <thead>
                <tr>
                  <th>{bn ? "কর্মচারী" : "Employee"}</th>
                  <th>{bn ? "ডিপ্ট" : "Dept"}</th>
                  <th className="text-right">{bn ? "বেসিক" : "Basic"}</th>
                  <th className="text-right">{bn ? "ইনসেন্টিভ" : "Incentive"}</th>
                  <th className="text-right">{bn ? "ক্যাম্পেইন" : "Campaign"}</th>
                  <th className="text-right">{bn ? "ইয়ারলি কালেকশন" : "Yearly Collection"}</th>
                  <th className="text-right">{bn ? "গ্রস" : "Gross"}</th>
                  <th className="text-right">{bn ? "কর্তন" : "Deductions"}</th>
                  <th className="text-right">{bn ? "নেট স্যালারি" : "Net Salary"}</th>
                  <th className="text-right">{bn ? "পেইড" : "Paid"}</th>
                  <th className="text-right">{bn ? "বাকি" : "Due"}</th>
                  <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
                  <th className="text-right">{bn ? "অ্যাকশন" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = bn && row.employee.nameBn ? row.employee.nameBn : row.employee.name;
                  const paid = row.status === "paid";
                  return (
                    <tr key={row.employee._id}>
                      <td>
                        <Link
                          href={`/contacts/employees/${row.employee._id}`}
                          className="block font-bold uppercase tracking-wide text-[var(--gp-ink)] hover:text-primary"
                        >
                          {name}
                        </Link>
                        <div className="text-[0.8125rem] font-semibold text-[var(--gp-text-muted)]">
                          {row.employee.designation || "—"}
                        </div>
                      </td>
                      <td className="text-xs font-semibold uppercase text-muted">
                        {row.employee.department || "—"}
                      </td>
                      <td className="gp-money text-right">{formatTk(row.basic)}</td>
                      <td className="gp-money text-right text-muted">{formatTk(row.incentive, true)}</td>
                      <td className="gp-money text-right text-muted">{formatTk(row.campaign, true)}</td>
                      <td className="gp-money text-right text-muted">{formatTk(row.yearlyCollection, true)}</td>
                      <td className="gp-money text-right">{formatTk(row.gross)}</td>
                      <td className="gp-money text-right text-rose-600">{formatTkDeduction(row.deductions)}</td>
                      <td className="gp-money text-right font-bold">{formatTk(row.net)}</td>
                      <td className="gp-money text-right text-emerald-600">{formatTk(row.paid)}</td>
                      <td className="gp-money text-right text-rose-600">{formatTk(row.due)}</td>
                      <td>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            paid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {paid ? (bn ? "পেইড" : "Paid") : bn ? "পেন্ডিং" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-slate-50 hover:text-[var(--gp-ink)]"
                            title={bn ? "এডিট" : "Edit"}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {row.slip ? (
                            <Link
                              href={`/contacts/payslips/${row.slip._id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-slate-50"
                              title={bn ? "পেস্লিপ" : "Payslip"}
                            >
                              <Banknote className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                          {canManage && !paid ? (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                              disabled={busy || row.net <= 0}
                              title={bn ? "পে" : "Pay"}
                              onClick={() =>
                                void postPayroll(
                                  { action: "pay_one", employeeId: row.employee._id },
                                  bn ? "স্যালারি পেইড — খরচ পোস্ট হয়েছে" : "Salary paid — expense posted",
                                )
                              }
                            >
                              <Wallet className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={rulesOpen}
        title={bn ? "পে-রোল রুলস" : "Payroll rules"}
        onClose={() => setRulesOpen(false)}
      >
        <form onSubmit={saveRules} className="grid gap-3">
          <p className="text-sm text-muted">
            {bn
              ? "গ্রস = বেসিক + বাড়ি ভাড়া + মেডিকেল + যাতায়াত + ইনসেন্টিভ + ক্যাম্পেইন + ইয়ারলি কালেকশন। নেট = গ্রস − কর্তন।"
              : "Gross = Basic + house rent + medical + conveyance + incentive + campaign + yearly collection. Net = Gross − deductions."}
          </p>
          <Field label={bn ? "ডিফল্ট কর্তন % (গ্রসের উপর)" : "Default deduction % of gross"}>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="gp-input"
              value={rulesPercent}
              onChange={(e) => setRulesPercent(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted">
            {bn
              ? "জেনারেটের সময় যদি কর্মচারীর আলাদা কর্তন না থাকে, এই শতাংশ ট্যাক্স হিসেবে বসবে।"
              : "Applied as tax on Generate when the employee has no other deductions."}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setRulesOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editRow)}
        title={bn ? "স্যালারি এডিট" : "Edit salary"}
        onClose={() => setEditRow(null)}
      >
        {editRow ? (
          <form onSubmit={saveEdit} className="grid gap-2.5 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-semibold">{editRow.employee.name}</p>
            {(
              [
                ["basicSalary", bn ? "বেসিক" : "Basic"],
                ["incentive", bn ? "ইনসেন্টিভ" : "Incentive"],
                ["campaign", bn ? "ক্যাম্পেইন" : "Campaign"],
                ["yearlyCollection", bn ? "ইয়ারলি কালেকশন" : "Yearly collection"],
                ["houseRent", bn ? "বাড়ি ভাড়া" : "House rent"],
                ["medical", bn ? "মেডিকেল" : "Medical"],
                ["conveyance", bn ? "যাতায়াত" : "Conveyance"],
                ["tax", bn ? "কর্তন" : "Deductions"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  min={0}
                  className="gp-input"
                  value={editForm[key]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </Field>
            ))}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setEditRow(null)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
                {t("common.save")}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
