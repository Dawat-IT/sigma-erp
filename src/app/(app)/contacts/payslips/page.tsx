"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Printer, Trash2 } from "lucide-react";
import { EmptyState, Field, FilterBar, Modal, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import {
  computePayrollTotals,
  currentPeriodKey,
  PAYROLL_PAYMENT_METHODS,
  periodLabelFromKey,
  snapshotFromEmployee,
} from "@/lib/payroll";

type Employee = {
  _id: string;
  name: string;
  nameBn?: string;
  basicSalary?: number;
  houseRent?: number;
  medical?: number;
  conveyance?: number;
};

type Slip = {
  _id: string;
  slipNo: string;
  employeeId?: string;
  employeeName?: string;
  periodKey?: string;
  periodLabel?: string;
  basicSalary: number;
  netPay: number;
  status: string;
};

export default function PayslipsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Slip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [periodKey, setPeriodKey] = useState(currentPeriodKey());
  const [status, setStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [payMethod, setPayMethod] = useState("bank");
  const [form, setForm] = useState({
    employeeId: "",
    periodKey: currentPeriodKey(),
    overtime: "0",
    bonus: "0",
    otherAllowance: "0",
    advanceDeduction: "0",
    tax: "0",
    otherDeduction: "0",
    note: "",
    paid: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "200", periodKey });
      if (status) qs.set("status", status);
      if (employeeId) qs.set("employeeId", employeeId);
      const [p, e] = await Promise.all([
        fetch(`/api/payslips?${qs}`).then((r) => r.json()),
        fetch("/api/contacts?type=employee&limit=200").then((r) => r.json()),
      ]);
      setRows(p.data || []);
      setCanManage(Boolean(p.access?.canManage));
      setEmployees(e.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [periodKey, status, employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const picked = employees.find((x) => x._id === form.employeeId);
  const preview = computePayrollTotals({
    ...snapshotFromEmployee(picked),
    overtime: Number(form.overtime || 0),
    bonus: Number(form.bonus || 0),
    otherAllowance: Number(form.otherAllowance || 0),
    advanceDeduction: Number(form.advanceDeduction || 0),
    tax: Number(form.tax || 0),
    otherDeduction: Number(form.otherDeduction || 0),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          periodKey: form.periodKey,
          periodLabel: periodLabelFromKey(form.periodKey, bn ? "bn" : "en"),
          overtime: Number(form.overtime || 0),
          bonus: Number(form.bonus || 0),
          otherAllowance: Number(form.otherAllowance || 0),
          advanceDeduction: Number(form.advanceDeduction || 0),
          tax: Number(form.tax || 0),
          otherDeduction: Number(form.otherDeduction || 0),
          note: form.note,
          paid: form.paid,
          paymentMethod: payMethod,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) throw new Error(bn ? "এই মাসের পেস্লিপ আগেই আছে" : "Payslip already exists for this month");
      if (!res.ok) throw new Error(json.error || "fail");
      setOpen(false);
      await load();
      setMsg(bn ? "পেস্লিপ তৈরি হয়েছে" : "Payslip created");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function pay(id: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payslips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paymentMethod: payMethod }),
      });
      if (!res.ok) throw new Error("fail");
      await load();
      setMsg(bn ? "পেইড — খরচ পোস্ট হয়েছে" : "Paid — expense posted");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(bn ? "পেস্লিপ মুছবেন?" : "Delete this payslip?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payslips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("fail");
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={bn ? "পেস্লিপ রেজিস্টার" : "Payslip register"}
        subtitle={bn ? "মাস অনুযায়ী পেস্লিপ · প্রিন্ট · পে" : "Monthly payslips · print · pay"}
        actions={
          canManage ? (
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("common.add")}
            </button>
          ) : null
        }
      />
      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}

      <FilterBar>
        <Field label={bn ? "মাস" : "Month"}>
          <input type="month" className="gp-input" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
        </Field>
        <Field label={bn ? "কর্মচারী" : "Employee"}>
          <select className="gp-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{bn ? "সব" : "All"}</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {bn && e.nameBn ? e.nameBn : e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "স্ট্যাটাস" : "Status"}>
          <select className="gp-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{bn ? "সব" : "All"}</option>
            <option value="draft">{bn ? "ড্রাফট" : "Draft"}</option>
            <option value="paid">{bn ? "পেইড" : "Paid"}</option>
          </select>
        </Field>
        <Field label={bn ? "পেমেন্ট" : "Pay method"}>
          <select className="gp-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            {PAYROLL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "নং" : "No"}</th>
                <th>{bn ? "কর্মচারী" : "Employee"}</th>
                <th>{bn ? "পিরিয়ড" : "Period"}</th>
                <th>{bn ? "নেট" : "Net"}</th>
                <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className="font-semibold">
                    <Link href={`/contacts/payslips/${r._id}`} className="text-primary hover:underline">
                      {r.slipNo}
                    </Link>
                  </td>
                  <td>
                    {r.employeeId ? (
                      <Link href={`/contacts/employees/${r.employeeId}`} className="hover:underline">
                        {r.employeeName}
                      </Link>
                    ) : (
                      r.employeeName
                    )}
                  </td>
                  <td>{r.periodLabel || r.periodKey || "—"}</td>
                  <td className="gp-money font-semibold">{formatBDT(r.netPay, locale)}</td>
                  <td>{r.status === "paid" ? (bn ? "পেইড" : "Paid") : bn ? "ড্রাফট" : "Draft"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Link href={`/contacts/payslips/${r._id}`} className="gp-btn gp-btn-ghost min-h-9 px-2.5" title="Print">
                        <Printer className="h-4 w-4" />
                      </Link>
                      {canManage && r.status === "draft" ? (
                        <button type="button" className="gp-btn gp-btn-primary min-h-9 px-2.5" disabled={busy} onClick={() => void pay(r._id)}>
                          {bn ? "পে" : "Pay"}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button type="button" className="gp-btn gp-btn-ghost min-h-9 px-2.5 text-danger" disabled={busy} onClick={() => void remove(r._id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title={bn ? "নতুন পেস্লিপ" : "New payslip"} onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field label={bn ? "কর্মচারী" : "Employee"}>
            <select
              className="gp-input"
              required
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {bn && e.nameBn ? e.nameBn : e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={bn ? "মাস" : "Month"}>
            <input
              type="month"
              className="gp-input"
              required
              value={form.periodKey}
              onChange={(e) => setForm((f) => ({ ...f, periodKey: e.target.value }))}
            />
          </Field>
          <Field label={bn ? "ওভারটাইম" : "Overtime"}>
            <input type="number" min={0} className="gp-input" value={form.overtime} onChange={(e) => setForm((f) => ({ ...f, overtime: e.target.value }))} />
          </Field>
          <Field label={bn ? "বোনাস" : "Bonus"}>
            <input type="number" min={0} className="gp-input" value={form.bonus} onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))} />
          </Field>
          <Field label={bn ? "অ্যাডভান্স কর্তন" : "Advance deduction"}>
            <input type="number" min={0} className="gp-input" value={form.advanceDeduction} onChange={(e) => setForm((f) => ({ ...f, advanceDeduction: e.target.value }))} />
          </Field>
          <Field label={bn ? "ট্যাক্স" : "Tax"}>
            <input type="number" min={0} className="gp-input" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} />
          </Field>
          <p className="sm:col-span-2 text-sm font-semibold">
            {bn ? "নেট" : "Net"}: {formatBDT(preview.netPay, locale)}
          </p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))} />
            {bn ? "সঙ্গে সঙ্গে পেইড (খরচ পোস্ট)" : "Mark paid now (post expense)"}
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
