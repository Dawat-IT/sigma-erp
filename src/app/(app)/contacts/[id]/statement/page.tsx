"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { EmptyState, Field, FilterBar, PageHeader, TableSkeleton } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";

type ContactInfo = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  address?: string;
  type: string;
  balance?: number;
  openingBalance?: number;
};

type Entry = {
  date: string;
  type: string;
  ref: string;
  referenceNo?: string;
  description: string;
  debit: number;
  credit: number;
  paidAmount?: number;
  dueAmount?: number;
  balance: number;
  link?: string;
};

export default function ContactStatementPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const locale = useLocale();
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    entryCount: 0,
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/contacts/${id}/statement?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setContact(json.data.contact);
      setEntries(json.data.entries || []);
      setSummary(json.data.summary);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, from, to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const title =
    locale === "bn"
      ? `${contact ? (contact.nameBn || contact.name) : "…"} — গ্রাহক লেজার`
      : `${contact ? contact.name : "…"} — Customer Ledger`;

  const backHref =
    contact?.type === "employee"
      ? "/contacts/employees"
      : contact?.type === "supplier"
        ? "/contacts/suppliers"
        : contact?.type === "both"
          ? "/contacts/suppliers"
          : "/contacts/customers";

  return (
    <div className="gp-desk">
      <PageHeader
        title={title}
        subtitle={
          contact
            ? `${contact.mobile || ""} · ${contact.type}`
            : locale === "bn"
              ? "গ্রাহক লেজার / লেনদেন ইতিহাস"
              : "Customer ledger / transaction history"
        }
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Link href={backHref} className="gp-btn gp-btn-ghost">
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Link>
            {contact?.type === "supplier" || contact?.type === "both" ? (
              <Link href={`/contacts/suppliers/${id}`} className="gp-btn gp-btn-ghost">
                {locale === "bn" ? "বিস্তারিত" : "Details"}
              </Link>
            ) : null}
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t("common.print")}
            </button>
          </div>
        }
      />

      <FilterBar>
        <Field label={t("dashboard.fromDate")}>
          <input type="date" className="gp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("dashboard.toDate")}>
          <input type="date" className="gp-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <button type="button" className="gp-btn gp-btn-primary w-full" onClick={load}>
            {t("dashboard.apply")}
          </button>
        </div>
      </FilterBar>

      {error ? <EmptyState message={error} /> : null}

      {loading && !contact ? (
        <TableSkeleton rows={8} cols={6} />
      ) : contact ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="gp-card p-4">
              <p className="text-xs font-semibold uppercase text-muted">
                {locale === "bn" ? "প্রারম্ভিক" : "Opening"}
              </p>
              <p className="gp-money mt-1 text-xl font-bold">
                {formatBDT(summary.openingBalance, locale)}
              </p>
            </div>
            <div className="gp-card p-4">
              <p className="text-xs font-semibold uppercase text-muted">
                {locale === "bn" ? "ডেবিট" : "Debit"}
              </p>
              <p className="gp-money mt-1 text-xl font-bold">
                {formatBDT(summary.totalDebit, locale)}
              </p>
            </div>
            <div className="gp-card p-4">
              <p className="text-xs font-semibold uppercase text-muted">
                {locale === "bn" ? "ক্রেডিট" : "Credit"}
              </p>
              <p className="gp-money mt-1 text-xl font-bold">
                {formatBDT(summary.totalCredit, locale)}
              </p>
            </div>
            <div className="gp-card p-4 border-[color-mix(in_oklab,var(--gp-primary)_25%,white)]">
              <p className="text-xs font-semibold uppercase text-muted">
                {locale === "bn" ? "ক্লোজিং ব্যালেন্স" : "Closing balance"}
              </p>
              <p className="gp-money mt-1 text-xl font-bold text-primary">
                {formatBDT(summary.closingBalance, locale)}
              </p>
            </div>
          </div>

          <div className="gp-card mb-4 p-4 text-sm">
            <p className="font-bold text-[var(--gp-ink)]">
              {locale === "bn" && contact.nameBn ? contact.nameBn : contact.name}
            </p>
            {contact.mobile ? <p className="text-muted">{contact.mobile}</p> : null}
            {contact.address ? <p className="text-muted">{contact.address}</p> : null}
          </div>

          {entries.length === 0 ? (
            <EmptyState message={t("common.noData")} />
          ) : (
            <div className="gp-table-wrap overflow-x-auto">
              <table className="gp-table">
                <thead>
                  <tr>
                    <th>{t("common.date")}</th>
                    <th>{t("contacts.txnType")}</th>
                    <th>{locale === "bn" ? "ডকুমেন্ট নং" : "Document No"}</th>
                    <th>{t("sales.referenceNo")}</th>
                    <th>{locale === "bn" ? "বিবরণ" : "Description"}</th>
                    <th>{locale === "bn" ? "ডেবিট" : "Debit"}</th>
                    <th>{locale === "bn" ? "ক্রেডিট" : "Credit"}</th>
                    <th>{t("common.paid")}</th>
                    <th>{t("common.due")}</th>
                    <th>{locale === "bn" ? "ব্যালেন্স" : "Balance"}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={`${e.type}-${e.ref}-${i}`}>
                      <td className="whitespace-nowrap">{formatDateBD(e.date, locale)}</td>
                      <td className="capitalize">{ledgerTypeLabel(e.type, locale)}</td>
                      <td>
                        {e.link && e.ref !== "—" ? (
                          <Link href={e.link} className="font-semibold text-primary hover:underline">
                            {e.ref}
                          </Link>
                        ) : (
                          <span className="font-mono text-sm">{e.ref}</span>
                        )}
                      </td>
                      <td className="font-mono text-sm">{e.referenceNo || "—"}</td>
                      <td>{e.description}</td>
                      <td className="gp-money">
                        {e.debit ? formatBDT(e.debit, locale) : "—"}
                      </td>
                      <td className="gp-money">
                        {e.credit ? formatBDT(e.credit, locale) : "—"}
                      </td>
                      <td className="gp-money">
                        {e.paidAmount ? formatBDT(e.paidAmount, locale) : "—"}
                      </td>
                      <td className="gp-money">
                        {e.dueAmount ? formatBDT(e.dueAmount, locale) : "—"}
                      </td>
                      <td className="gp-money font-bold">{formatBDT(e.balance, locale)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="font-bold">
                      {locale === "bn" ? "মোট" : "Total"}
                    </td>
                    <td className="gp-money font-bold">{formatBDT(summary.totalDebit, locale)}</td>
                    <td className="gp-money font-bold">{formatBDT(summary.totalCredit, locale)}</td>
                    <td className="gp-money">—</td>
                    <td className="gp-money">—</td>
                    <td className="gp-money font-bold text-primary">
                      {formatBDT(summary.closingBalance, locale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function ledgerTypeLabel(type: string, locale: string) {
  const bn: Record<string, string> = {
    opening: "প্রারম্ভিক",
    quotation: "কোটেশন",
    sales_order: "সেলস অর্ডার",
    invoice: "ইনভয়েস",
    payment: "পেমেন্ট",
    sale: "বিক্রি",
    service: "সার্ভিস",
    purchase: "ক্রয়",
  };
  const en: Record<string, string> = {
    opening: "Opening",
    quotation: "Quotation",
    sales_order: "Sales Order",
    invoice: "Invoice",
    payment: "Payment",
    sale: "Sale",
    service: "Service",
    purchase: "Purchase",
  };
  return (locale === "bn" ? bn : en)[type] || type;
}
