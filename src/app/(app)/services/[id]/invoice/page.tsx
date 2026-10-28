"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Wrench } from "lucide-react";
import { EmptyState, Field } from "@/components/ui";
import { amountInWords, formatBDT, formatDateBD } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type ServiceItem = {
  name: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  lineTotal: number;
};

type ServiceDoc = {
  _id: string;
  jobNo: string;
  status: string;
  customerId?: { name: string; mobile: string; address?: string; location?: string };
  machineId?: { brand: string; model: string; serialNo?: string };
  technicianId?: { name: string };
  technicianIds?: { name: string }[];
  complimentary?: boolean;
  issueDescription: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  visitCharge?: number;
  serviceLines?: ServiceItem[];
  serviceLinesTotal?: number;
  serviceCharges: number;
  parts: ServiceItem[];
  partsTotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  payments?: { method: string; amount: number }[];
  notes?: string;
  receivedDate: string;
  deliveredDate?: string;
  warrantyDays?: number;
  resolution?: string;
};

type BusinessDoc = {
  name?: string;
  nameBn?: string;
  address?: string;
  addressBn?: string;
  phone?: string;
  email?: string;
};

export default function ServiceInvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const locale = useLocale();
  const [job, setJob] = useState<ServiceDoc | null>(null);
  const [business, setBusiness] = useState<BusinessDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/services/${id}`);
      if (!res.ok) {
        setError(t("common.noData"));
        return;
      }
      const json = await res.json();
      setJob(json.data);

      const bizRes = await fetch("/api/meta?type=business");
      if (bizRes.ok) {
        const bizJson = await bizRes.json();
        const bizObj: Record<string, string> = {};
        bizJson.data?.forEach((m: { key: string; value: string }) => {
          bizObj[m.key] = m.value;
        });
        setBusiness({
          name: bizObj.name,
          nameBn: bizObj.nameBn,
          address: bizObj.address,
          addressBn: bizObj.addressBn,
          phone: bizObj.phone,
          email: bizObj.email,
        });
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t]);

  async function recordPayment() {
    if (!job) return;
    const amount = Number(payAmount || 0);
    if (amount <= 0) return;
    setPayBusy(true);
    setPayMessage("");
    try {
      const res = await fetch(`/api/services/${job._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: payMethod, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setPayMessage(t("sales.paymentRecorded"));
      setPayAmount("");
      await load();
    } catch {
      setPayMessage(t("common.error"));
    } finally {
      setPayBusy(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-muted">{t("common.loading")}</p>;
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Link href="/services" className="gp-btn gp-btn-ghost inline-flex">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
        <EmptyState message={error || t("common.noData")} />
      </div>
    );
  }

  const bizName = locale === "bn" && business?.nameBn ? business.nameBn : business?.name || BRAND.appName;
  const bizAddress = locale === "bn" && business?.addressBn ? business.addressBn : business?.address || "";

  return (
    <div className="gp-desk">
      <div className="gp-page-header no-print">
        <div className="flex items-center gap-3">
          <Link href="/services" className="gp-btn gp-btn-ghost min-h-10 px-3">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <div>
            <h1 className="gp-display text-2xl font-bold">{locale === 'bn' ? 'সার্ভিস ইনভয়েস' : 'Service Invoice'}</h1>
            <p className="text-sm text-muted">{job.jobNo}</p>
          </div>
        </div>
        <button className="gp-btn gp-btn-primary" onClick={() => window.print()}>
          {t("common.print")}
        </button>
      </div>

      <article className="invoice-sheet mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line bg-white shadow-md print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="bg-slate-800 px-6 py-5 text-white md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <p className="gp-display text-2xl font-bold leading-tight md:text-3xl">{bizName}</p>
                <p className="mt-1 text-sm text-white/85">{bizAddress}</p>
                <p className="mt-1 text-sm text-white/75">
                  {business?.phone ? `${business.phone}` : ""}
                  {business?.email ? ` · ${business.email}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
                {locale === 'bn' ? 'সার্ভিস ইনভয়েস' : 'Service Invoice'}
              </p>
              <p className="mt-1 text-xl font-bold">{job.jobNo}</p>
              <p className="mt-1 text-sm text-white/85">{formatDateBD(job.receivedDate, locale)}</p>
              <span className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold capitalize">
                {job.status}
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 border-b border-line bg-[var(--gp-bg)] px-6 py-5 md:grid-cols-2 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              {t("invoice.billTo")}
            </p>
            <p className="mt-1 text-lg font-bold">{job.siteName || job.customerId?.name || "—"}</p>
            {job.customerId?.mobile ? (
              <p className="text-sm text-muted">
                {t("invoice.mobile")}: {job.customerId.mobile}
              </p>
            ) : null}
            {job.siteLocation || job.customerId?.location ? (
              <p className="text-sm font-medium">{job.siteLocation || job.customerId?.location}</p>
            ) : null}
            {job.siteAddress || job.customerId?.address ? (
              <p className="text-sm text-muted">{job.siteAddress || job.customerId?.address}</p>
            ) : null}
          </div>
          <div className="md:text-right">
            <div className="inline-grid gap-1 text-sm md:justify-items-end">
              {job.machineId ? (
                <>
                  <p>
                    <span className="text-muted">{locale === 'bn' ? 'মেশিন: ' : 'Machine: '}</span>
                    <span className="font-semibold">{job.machineId.brand} {job.machineId.model}</span>
                  </p>
                  <p>
                    <span className="text-muted">{locale === 'bn' ? 'সিরিয়াল নং: ' : 'Serial No: '}</span>
                    <span className="font-semibold">{job.machineId.serialNo || "—"}</span>
                  </p>
                </>
              ) : null}
              {job.technicianId ? (
                <p>
                  <span className="text-muted">{locale === 'bn' ? 'টেকনিশিয়ান: ' : 'Technician: '}</span>
                  <span className="font-semibold">
                    {[job.technicianId.name, ...(job.technicianIds || []).map((row) => row.name)]
                      .filter(Boolean)
                      .filter((name, i, arr) => arr.indexOf(name) === i)
                      .join(" · ")}
                  </span>
                </p>
              ) : null}
              {job.complimentary ? (
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {locale === "bn" ? "নতুন লিফট — এই মাসের প্রথম সার্ভিস ফ্রি" : "New lift — first service this month is complimentary"}
                </p>
              ) : null}
              {job.warrantyDays ? (
                <p>
                  <span className="text-muted">{locale === 'bn' ? 'ওয়ারেন্টি: ' : 'Warranty: '}</span>
                  <span className="font-semibold">{job.warrantyDays} Days</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 md:px-8">
          <p className="text-sm text-muted mb-2 font-semibold">{locale === 'bn' ? 'সমস্যার বিবরণ:' : 'Issue Description:'}</p>
          <p className="text-sm font-medium">{job.issueDescription}</p>
        </div>

        <div className="overflow-x-auto px-2 py-4 md:px-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {locale === "bn" ? "সার্ভিস লাইন" : "Service lines"}
          </p>
          <table className="gp-table">
            <thead>
              <tr>
                <th className="w-14">{t("invoice.sl")}</th>
                <th>{locale === "bn" ? "সার্ভিস" : "Service"}</th>
                <th>{t("invoice.qty")}</th>
                <th>{t("invoice.rate")}</th>
                <th className="text-right">{t("invoice.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {(job.serviceLines || []).map((item, idx) => (
                <tr key={`svc-${idx}`}>
                  <td>{idx + 1}</td>
                  <td className="font-semibold">{item.name}{item.unit ? ` (${item.unit})` : ""}</td>
                  <td>{item.qty}</td>
                  <td>{formatBDT(item.unitPrice, locale)}</td>
                  <td className="text-right font-bold">{formatBDT(item.lineTotal, locale)}</td>
                </tr>
              ))}
              {(job.serviceLines || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted italic">
                    {locale === "bn" ? "আলাদা সার্ভিস লাইন নেই — ভিজিট চার্জ প্রযোজ্য" : "No extra service lines — visit charge applies"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto px-2 py-4 md:px-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {locale === "bn" ? "পার্টস" : "Parts"}
          </p>
          <table className="gp-table">
            <thead>
              <tr>
                <th className="w-14">{t("invoice.sl")}</th>
                <th>{locale === 'bn' ? 'পার্টস এর নাম' : 'Parts Description'}</th>
                <th>{t("invoice.qty")}</th>
                <th>{t("invoice.rate")}</th>
                <th className="text-right">{t("invoice.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {job.parts.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td className="font-semibold">{item.name}</td>
                  <td>{item.qty}</td>
                  <td>{formatBDT(item.unitPrice, locale)}</td>
                  <td className="text-right font-bold">{formatBDT(item.lineTotal, locale)}</td>
                </tr>
              ))}
              {job.parts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted italic">
                    {locale === 'bn' ? 'কোনো পার্টস ব্যবহৃত হয়নি' : 'No parts consumed'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 border-t border-line px-6 py-6 md:grid-cols-2 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              {t("invoice.inWords")}
            </p>
            <p className="mt-2 rounded-xl border border-line bg-[#fbfcfb] px-4 py-3 text-sm font-semibold leading-relaxed">
              {amountInWords(job.grandTotal, locale === "en" ? "en" : "bn")}
            </p>
            {job.resolution ? (
              <p className="mt-4 text-sm text-muted">
                <span className="font-semibold">{locale === "bn" ? "সমাধান" : "Resolution"}: </span>
                {job.resolution}
              </p>
            ) : null}
            {job.notes ? (
              <p className="mt-4 text-sm text-muted">
                <span className="font-semibold">{t("common.note")}: </span>
                {job.notes}
              </p>
            ) : null}
            {job.payments?.length ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {t("sales.paymentMethod")}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {job.payments.map((p, i) => (
                    <li key={i} className="flex justify-between gap-4 border-b border-line py-1.5">
                      <span className="capitalize">{p.method}</span>
                      <span className="font-semibold">{formatBDT(p.amount, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-line bg-[var(--gp-bg)] p-4">
            <SummaryRow label={locale === 'bn' ? 'পার্টস খরচ' : 'Parts Cost'} value={formatBDT(job.partsTotal, locale)} />
            <SummaryRow label={locale === 'bn' ? 'ভিজিট চার্জ' : 'Visit charge'} value={formatBDT(job.visitCharge || 0, locale)} />
            <SummaryRow label={locale === 'bn' ? 'সার্ভিস লাইন' : 'Service lines'} value={formatBDT(job.serviceLinesTotal || 0, locale)} />
            <SummaryRow label={locale === 'bn' ? 'সার্ভিস চার্জ (মোট)' : 'Service Charges'} value={formatBDT(job.serviceCharges, locale)} />
            <SummaryRow label={t("common.discount")} value={formatBDT(job.discount, locale)} />
            <SummaryRow label={t("common.tax")} value={formatBDT(job.tax, locale)} />
            <SummaryRow
              label={t("common.grandTotal")}
              value={formatBDT(job.grandTotal, locale)}
              strong
            />
            <SummaryRow label={t("common.paid")} value={formatBDT(job.paidAmount, locale)} />
            <SummaryRow label={t("common.due")} value={formatBDT(job.dueAmount, locale)} highlight />
          </div>
        </div>

        <div className="grid gap-10 border-t border-line px-6 py-10 md:grid-cols-2 md:px-8">
          <div>
            <div className="mb-10 border-b border-line" />
            <p className="text-sm font-semibold text-muted">{t("invoice.received")}</p>
          </div>
          <div>
            <div className="mb-10 border-b border-line" />
            <p className="text-sm font-semibold text-muted">{t("invoice.authorized")}</p>
          </div>
        </div>

        <footer className="border-t border-line bg-[var(--gp-bg)] px-6 py-4 text-center text-sm text-muted md:px-8">
          {t("invoice.thanks")} · {t("invoice.computerGenerated")}
        </footer>
      </article>

      {job.dueAmount > 0 ? (
        <div className="no-print mx-auto mt-6 max-w-4xl rounded-2xl border border-line bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold">{t("sales.recordPayment")}</h2>
          <p className="mt-1 text-sm text-muted">
            {locale === "bn" ? "বাকি" : "Due"}: {formatBDT(job.dueAmount, locale)}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={t("sales.paymentMethod")}>
              <select className="gp-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">{t("sales.cash")}</option>
                <option value="bkash">{t("sales.bkash")}</option>
                <option value="nagad">{t("sales.nagad")}</option>
                <option value="rocket">{t("sales.rocket")}</option>
                <option value="card">{t("sales.card")}</option>
                <option value="cheque">{t("sales.cheque")}</option>
                <option value="bank">{t("sales.bank")}</option>
              </select>
            </Field>
            <Field label={t("common.amount")}>
              <input
                type="number"
                min={0.01}
                max={job.dueAmount}
                step="0.01"
                className="gp-input"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className="gp-btn gp-btn-primary w-full"
                disabled={payBusy || Number(payAmount || 0) <= 0}
                onClick={() => void recordPayment()}
              >
                {payBusy ? "..." : t("sales.recordPayment")}
              </button>
            </div>
          </div>
          {payMessage ? <p className="mt-2 text-sm font-semibold text-primary">{payMessage}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-line/80 py-2 text-sm last:border-0 ${
        strong ? "font-bold text-[var(--gp-ink)]" : ""
      } ${highlight ? "text-[var(--gp-warn)]" : ""}`}
    >
      <span>{label}</span>
      <span className={strong ? "text-lg" : "font-semibold"}>{value}</span>
    </div>
  );
}
