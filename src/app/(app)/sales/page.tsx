"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye, Plus, Search } from "lucide-react";
import { EmptyState, Modal, PageHeader } from "@/components/ui";
import { InvoiceActions, PaymentStatusBadge } from "@/components/InvoiceActions";
import { CrudForm } from "@/components/CrudForm";
import { getCrudConfig } from "@/lib/crud-config";
import { formatBDT, formatDateBD } from "@/lib/utils";

type Sale = {
  _id: string;
  invoiceNo?: string;
  proposalNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  customerName: string;
  customerId?: string;
  customerMobile?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  saleDate: string;
  status: string;
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "O";
}

function docNo(s: Sale) {
  return s.invoiceNo || s.salesOrderNo || s.quotationNo || s.proposalNo || "—";
}

function docHref(s: Sale) {
  if (s.status === "proposal") return `/sales/${s._id}/proposal`;
  if (s.status === "quotation") return `/sales/${s._id}/quotation`;
  return `/sales/${s._id}/invoice`;
}

export default function SalesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [data, setData] = useState<Sale[]>([]);
  const [summary, setSummary] = useState({ grandTotal: 0, dueAmount: 0, count: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const salesCrud = getCrudConfig("sales");

  async function load(search = q) {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100", status: "final" });
    if (search) qs.set("q", search);
    try {
      const res = await fetch(`/api/sales?${qs}`);
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) {
        setLoadError(true);
        setData([]);
        setSummary({ grandTotal: 0, dueAmount: 0, count: 0 });
        return;
      }
      setLoadError(false);
      setData(json.data);
      setSummary(json.summary || { grandTotal: 0, dueAmount: 0, count: 0 });
    } catch {
      setLoadError(true);
      setData([]);
      setSummary({ grandTotal: 0, dueAmount: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveEdit(formData: Record<string, unknown>) {
    if (!editing || !salesCrud) return;
    await fetch(`/api/sales/${editing._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setFormOpen(false);
    setEditing(null);
    await load();
  }

  async function removeSale(id: string) {
    if (!confirm(bn ? "মুছে ফেলবেন?" : "Delete?")) return;
    await fetch(`/api/sales/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সেলস ও সিআরএম" : "Sales & CRM"}
        title={t("nav.allSales")}
        subtitle={bn ? "ইনভয়েস নম্বরে ক্লিক করে অর্ডার খুলুন।" : "Click an invoice number to open the order."}
        stats={[
          { value: summary.count, label: bn ? "অর্ডার" : "orders" },
          { value: formatBDT(summary.grandTotal, locale).replace(/\.00$/, ""), label: t("common.total") },
          { value: formatBDT(summary.dueAmount, locale).replace(/\.00$/, ""), label: t("common.due") },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                void load(value);
              }}
              placeholder={t("common.search")}
            />
            <Link href="/pos" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {t("nav.newOrder")}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <span className="fu-chip is-ok">{bn ? "কনফার্মড অর্ডার" : "Confirmed orders"}</span>
        <Link href="/sales/quotations" className="gp-btn gp-btn-ghost">
          {t("nav.listQuotations")}
        </Link>
        <Link href="/sales/proposals" className="gp-btn gp-btn-ghost">
          {t("nav.listProposals")}
        </Link>
      </div>

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && data.length === 0 ? (
          <EmptyState message={loadError ? t("common.error") : t("common.noData")} />
        ) : null}

        <div className="fu-list">
          {data.map((s) => {
            const no = docNo(s);
            const href = docHref(s);
            return (
              <article key={s._id} className={`fu-card ${s.dueAmount > 0 ? "is-warn" : "is-ok"}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(s.customerName)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{no}</Link>
                    </strong>
                    <p>
                      {s.customerId ? (
                        <Link href={`/contacts/${s.customerId}/statement`}>{s.customerName}</Link>
                      ) : (
                        s.customerName
                      )}
                      {" · "}
                      {formatDateBD(s.saleDate, locale)}
                    </p>
                  </div>
                  <b className="qt-amt">{formatBDT(s.grandTotal, locale)}</b>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {s.referenceNo ? `REF ${s.referenceNo}` : "—"}
                    {s.dueAmount > 0 ? ` · ${t("common.due")} ${formatBDT(s.dueAmount, locale)}` : ""}
                  </p>
                  <PaymentStatusBadge grandTotal={s.grandTotal} paidAmount={s.paidAmount} />
                  <Link className="fld-act" href={href}>
                    <Eye className="h-3.5 w-3.5" />
                    {bn ? "দেখুন" : "View"}
                  </Link>
                  <InvoiceActions
                    saleId={s._id}
                    saleStatus={s.status}
                    asMenu
                    onEdit={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                    onDelete={() => void removeSale(s._id)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Modal
        open={formOpen && !!salesCrud}
        title={t("common.edit")}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      >
        {salesCrud && editing ? (
          <CrudForm
            config={salesCrud}
            initial={editing}
            isEdit
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={saveEdit}
          />
        ) : null}
      </Modal>
    </div>
  );
}
