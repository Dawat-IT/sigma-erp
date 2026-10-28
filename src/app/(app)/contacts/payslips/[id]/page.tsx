"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { EmptyState, Field } from "@/components/ui";
import { amountInWords, formatBDT, formatDateBD } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import {
  componentsFromBody,
  computePayrollTotals,
  EMPTY_COMPONENTS,
  PAYROLL_PAYMENT_METHODS,
  snapshotFromEmployee,
} from "@/lib/payroll";

type Slip = {
  _id: string;
  slipNo: string;
  employeeName?: string;
  periodKey?: string;
  periodLabel?: string;
  periodFrom?: string;
  periodTo?: string;
  basicSalary: number;
  houseRent?: number;
  medical?: number;
  conveyance?: number;
  overtime?: number;
  bonus?: number;
  incentive?: number;
  campaign?: number;
  yearlyCollection?: number;
  otherAllowance?: number;
  advanceDeduction?: number;
  tax?: number;
  otherDeduction?: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: string;
  paymentMethod?: string;
  note?: string;
  paidAt?: string;
};

type Employee = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  designation?: string;
  department?: string;
};

export default function PayslipPrintPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [slip, setSlip] = useState<Slip | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(EMPTY_COMPONENTS);
  const [payMethod, setPayMethod] = useState("bank");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payslips/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setSlip(json.data);
      setEmployee(json.employee);
      setCanManage(Boolean(json.access?.canManage));
      setEdit(snapshotFromEmployee(json.data));
      setEdit({
        ...snapshotFromEmployee(json.data),
        overtime: Number(json.data?.overtime || 0),
        bonus: Number(json.data?.bonus || 0),
        otherAllowance: Number(json.data?.otherAllowance || 0),
        advanceDeduction: Number(json.data?.advanceDeduction || 0),
        tax: Number(json.data?.tax || 0),
        otherDeduction: Number(json.data?.otherDeduction || 0),
      });
      setPayMethod(json.data?.paymentMethod || "bank");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useMemo(() => computePayrollTotals(edit), [edit]);

  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!slip || slip.status === "paid") return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payslips/${slip._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setSlip(json.data);
      setMsg(bn ? "ড্রাফট আপডেট হয়েছে" : "Draft updated");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!slip) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/payslips/${slip._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paymentMethod: payMethod }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setSlip(json.data);
      setMsg(bn ? "পেইড — স্যালারি খরচ পোস্ট হয়েছে" : "Paid — salary expense posted");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <EmptyState message={t("app.loading")} />;
  if (!slip) return <EmptyState message={t("common.noData")} />;

  const earnings = [
    { label: bn ? "বেসিক" : "Basic", value: edit.basicSalary },
    { label: bn ? "বাড়ি ভাড়া" : "House rent", value: edit.houseRent },
    { label: bn ? "মেডিকেল" : "Medical", value: edit.medical },
    { label: bn ? "যাতায়াত" : "Conveyance", value: edit.conveyance },
    { label: bn ? "ইনসেন্টিভ" : "Incentive", value: edit.incentive },
    { label: bn ? "ক্যাম্পেইন" : "Campaign", value: edit.campaign },
    { label: bn ? "ইয়ারলি কালেকশন" : "Yearly collection", value: edit.yearlyCollection },
    { label: bn ? "ওভারটাইম" : "Overtime", value: edit.overtime },
    { label: bn ? "বোনাস" : "Bonus", value: edit.bonus },
    { label: bn ? "অন্যান্য" : "Other allowance", value: edit.otherAllowance },
  ].filter((r) => r.value > 0 || ["Basic", "বেসিক"].includes(r.label));

  const deductions = [
    { label: bn ? "অ্যাডভান্স" : "Advance", value: edit.advanceDeduction },
    { label: bn ? "ট্যাক্স" : "Tax", value: edit.tax },
    { label: bn ? "অন্যান্য কর্তন" : "Other deduction", value: edit.otherDeduction },
  ].filter((r) => r.value > 0);

  return (
    <div className="gp-desk">
      <div className="gp-page-header print:hidden">
        <Link href="/hr/payroll" className="gp-btn gp-btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          {bn ? "পে-রোল" : "Payroll"}
        </Link>
        <div className="flex flex-wrap gap-2">
          {employee?._id ? (
            <Link href={`/contacts/employees/${employee._id}`} className="gp-btn gp-btn-ghost">
              {bn ? "কর্মচারী" : "Employee"}
            </Link>
          ) : null}
          {canManage && slip.status === "draft" ? (
            <>
              <select className="gp-input w-32" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYROLL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button type="button" className="gp-btn gp-btn-primary" disabled={busy} onClick={() => void pay()}>
                {bn ? "পে করুন" : "Mark paid"}
              </button>
            </>
          ) : null}
          <button type="button" className="gp-btn gp-btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {bn ? "প্রিন্ট" : "Print"}
          </button>
        </div>
      </div>

      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary print:hidden">
          {msg}
        </p>
      ) : null}

      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{BRAND.company}</p>
            <h1 className="text-2xl font-bold">{bn ? "স্যালারি পেস্লিপ" : "Salary payslip"}</h1>
            <p className="text-sm text-muted">{slip.periodLabel || slip.periodKey}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">{slip.slipNo}</p>
            <p className="capitalize">{slip.status === "paid" ? (bn ? "পেইড" : "Paid") : bn ? "ড্রাফট" : "Draft"}</p>
            {slip.paidAt ? <p>{formatDateBD(slip.paidAt, locale)}</p> : null}
          </div>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 text-sm">
          <p>
            <span className="text-muted">{bn ? "কর্মচারী" : "Employee"}: </span>
            <strong>{employee ? (bn && employee.nameBn ? employee.nameBn : employee.name) : slip.employeeName}</strong>
          </p>
          <p>
            <span className="text-muted">{bn ? "মোবাইল" : "Mobile"}: </span>
            {employee?.mobile || "—"}
          </p>
          <p>
            <span className="text-muted">{bn ? "পদবি" : "Designation"}: </span>
            {employee?.designation || "—"}
          </p>
          <p>
            <span className="text-muted">{bn ? "বিভাগ" : "Department"}: </span>
            {employee?.department || "—"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "আয়" : "Earnings"}</th>
                <th className="text-right">{bn ? "টাকা" : "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="gp-money">{formatBDT(r.value, locale)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">{bn ? "মোট আয়" : "Gross"}</td>
                <td className="gp-money font-semibold">{formatBDT(live.grossPay, locale)}</td>
              </tr>
            </tbody>
          </table>
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "কর্তন" : "Deductions"}</th>
                <th className="text-right">{bn ? "টাকা" : "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {deductions.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-muted">
                    —
                  </td>
                </tr>
              ) : (
                deductions.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="gp-money">{formatBDT(r.value, locale)}</td>
                  </tr>
                ))
              )}
              <tr>
                <td className="font-semibold">{bn ? "মোট কর্তন" : "Total deductions"}</td>
                <td className="gp-money font-semibold">{formatBDT(live.deductions, locale)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-5 rounded-xl bg-[var(--gp-primary-soft)] px-4 py-3 text-lg font-bold">
          {bn ? "নেট পে" : "Net pay"}: {formatBDT(live.netPay, locale)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {amountInWords(live.netPay, bn ? "bn" : "en")}
        </p>
        {slip.note ? <p className="mt-3 text-sm">{slip.note}</p> : null}
      </article>

      {canManage && slip.status === "draft" ? (
        <form onSubmit={saveDraft} className="mt-6 grid grid-cols-2 gap-2.5 print:hidden sm:grid-cols-4">
          {(
            [
              ["basicSalary", bn ? "বেসিক" : "Basic"],
              ["houseRent", bn ? "বাড়ি ভাড়া" : "House rent"],
              ["medical", bn ? "মেডিকেল" : "Medical"],
              ["conveyance", bn ? "যাতায়াত" : "Conveyance"],
              ["incentive", bn ? "ইনসেন্টিভ" : "Incentive"],
              ["campaign", bn ? "ক্যাম্পেইন" : "Campaign"],
              ["yearlyCollection", bn ? "ইয়ারলি কালেকশন" : "Yearly collection"],
              ["overtime", bn ? "ওভারটাইম" : "Overtime"],
              ["bonus", bn ? "বোনাস" : "Bonus"],
              ["otherAllowance", bn ? "অন্যান্য আয়" : "Other allowance"],
              ["advanceDeduction", bn ? "অ্যাডভান্স" : "Advance"],
              ["tax", bn ? "ট্যাক্স" : "Tax"],
              ["otherDeduction", bn ? "অন্যান্য কর্তন" : "Other deduction"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                min={0}
                className="gp-input"
                value={edit[key]}
                onChange={(e) => setEdit((f) => componentsFromBody({ ...f, [key]: e.target.value }, f))}
              />
            </Field>
          ))}
          <div className="col-span-2 flex items-end sm:col-span-4">
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
