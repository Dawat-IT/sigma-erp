"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, Eye, Pencil, Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { InvoiceActions } from "@/components/InvoiceActions";
import { downloadExcelResponse } from "@/components/DateRangeExcelBar";
import { formatBDT, formatDateBD } from "@/lib/utils";

const PAGE_SIZE = 20;

type Quote = {
  _id: string;
  quotationNo?: string;
  referenceNo?: string;
  invoiceNo?: string;
  customerName: string;
  customerId?: string;
  customerMobile?: string;
  customerAddress?: string;
  customerEmail?: string;
  pfNo?: string;
  poNo?: string;
  challanNo?: string;
  binNo?: string;
  subject?: string;
  note?: string;
  terms?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  paidAmount?: number;
  dueAmount?: number;
  grandTotal: number;
  saleDate: string;
  status: string;
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "Q";
}

export default function QuotationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [data, setData] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ grandTotal: 0, dueAmount: 0, count: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load(nextPage = 1, search = q, range = { from, to }) {
    setLoading(true);
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(nextPage),
      status: "quotation",
    });
    const value = search.trim();
    const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      qs.set("from", date);
      qs.set("to", date);
    } else if (value) {
      qs.set("q", value);
    }
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const res = await fetch(`/api/sales?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error("load");
      setData(Array.isArray(json.data) ? json.data : []);
      setTotal(Number(json.total) || 0);
      setSummary(json.summary || { grandTotal: 0, dueAmount: 0, count: 0 });
      setPage(nextPage);
      setError("");
    } catch {
      setError(bn ? "লোড হয়নি" : "Could not load");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  function openEdit(quote: Quote) {
    setEditing(quote);
    setEditForm({
      quotationNo: quote.quotationNo || "",
      referenceNo: quote.referenceNo || "",
      customerName: quote.customerName || "",
      customerMobile: quote.customerMobile || "",
      customerAddress: quote.customerAddress || "",
      customerEmail: quote.customerEmail || "",
      pfNo: quote.pfNo || quote.poNo || "",
      challanNo: quote.challanNo || "",
      binNo: quote.binNo || "",
      subject: quote.subject || "",
      saleDate: quote.saleDate ? quote.saleDate.slice(0, 10) : "",
      subtotal: String(quote.subtotal || 0),
      discount: String(quote.discount || 0),
      tax: String(quote.tax || 0),
      shipping: String(quote.shipping || 0),
      grandTotal: String(quote.grandTotal || 0),
      paidAmount: String(quote.paidAmount || 0),
      dueAmount: String(quote.dueAmount || 0),
      note: quote.note || "",
      terms: quote.terms || "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationNo: editForm.quotationNo,
          referenceNo: editForm.referenceNo,
          customerName: editForm.customerName,
          customerMobile: editForm.customerMobile,
          customerAddress: editForm.customerAddress,
          customerEmail: editForm.customerEmail,
          pfNo: editForm.pfNo,
          challanNo: editForm.challanNo,
          binNo: editForm.binNo,
          subject: editForm.subject,
          saleDate: editForm.saleDate,
          subtotal: Number(editForm.subtotal || 0),
          discount: Number(editForm.discount || 0),
          tax: Number(editForm.tax || 0),
          shipping: Number(editForm.shipping || 0),
          grandTotal: Number(editForm.grandTotal || 0),
          paidAmount: Number(editForm.paidAmount || 0),
          dueAmount: Number(editForm.dueAmount || 0),
          note: editForm.note,
          terms: editForm.terms,
        }),
      });
      if (!res.ok) throw new Error("update_failed");
      setEditing(null);
      await load(page);
    } finally {
      setSaving(false);
    }
  }

  async function exportExcel() {
    if (!from || !to) {
      setError(bn ? "শুরু ও শেষ তারিখ নির্বাচন করুন" : "Select from and to dates");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/exports/quotations?from=${from}&to=${to}`);
      await downloadExcelResponse(res, `quotations_${from}_to_${to}.xlsx`);
    } catch {
      setError(bn ? "এক্সপোর্ট ব্যর্থ হয়েছে" : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সেলস ও সিআরএম" : "Sales & CRM"}
        title={t("nav.listQuotations")}
        subtitle={bn ? "PI নম্বরে ক্লিক করে কোটেশন খুলুন।" : "Click a PI number to open the quotation."}
        stats={[
          { value: summary.count || total, label: bn ? "কোটেশন" : "quotes" },
          { value: formatBDT(summary.grandTotal || 0, locale).replace(/\.00$/, ""), label: bn ? "মোট" : "value" },
          { value: formatBDT(summary.dueAmount || 0, locale).replace(/\.00$/, ""), label: t("common.due") },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => void load(1, value), 250);
              }}
              placeholder={bn ? "PI / কাস্টমার / ফোন" : "PI / customer / phone"}
            />
            <Link href="/pos?mode=quotation" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {t("nav.addQuotation")}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            setFrom(value);
            void load(1, q, { from: value, to });
          }}
        />
        <input
          type="date"
          aria-label={bn ? "শেষ তারিখ" : "To date"}
          className="gp-input fu-search"
          value={to}
          onChange={(e) => {
            const value = e.target.value;
            setTo(value);
            void load(1, q, { from, to: value });
          }}
        />
        <button type="button" className="gp-btn gp-btn-ghost" disabled={exporting} onClick={() => void exportExcel()}>
          <Download className="h-4 w-4" />
          {exporting ? "Excel..." : "Excel"}
        </button>
        <span className="fu-chip is-info">{bn ? "কোটেশন স্টেজ" : "Quotation stage"}</span>
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && data.length === 0 ? <EmptyState message={t("common.noData")} /> : null}

        <div className="fu-list">
          {data.map((s) => {
            const no = s.quotationNo || s.invoiceNo || "—";
            return (
              <article key={s._id} className="fu-card">
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(s.customerName)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={`/sales/${s._id}/quotation`}>{no}</Link>
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
                {s.subject ? <p className="fu-note">{s.subject}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {s.referenceNo ? `REF ${s.referenceNo}` : "—"}
                    {s.customerMobile ? ` · ${s.customerMobile}` : ""}
                  </p>
                  <Link className="fld-act" href={`/sales/${s._id}/quotation`}>
                    <Eye className="h-3.5 w-3.5" />
                    {bn ? "দেখুন" : "View"}
                  </Link>
                  <button type="button" className="fld-act" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                    {bn ? "এডিট" : "Edit"}
                  </button>
                  <InvoiceActions saleId={s._id} saleStatus={s.status} asMenu onEdit={() => openEdit(s)} />
                </div>
              </article>
            );
          })}
        </div>

        {total > PAGE_SIZE ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="gp-btn gp-btn-ghost min-h-8 min-w-8 px-2 text-sm"
              disabled={page <= 1}
              onClick={() => void load(page - 1)}
            >
              ‹
            </button>
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                className={`gp-btn min-h-8 min-w-8 px-2 text-sm ${
                  n === page ? "gp-btn-primary" : "gp-btn-ghost"
                }`}
                onClick={() => void load(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="gp-btn gp-btn-ghost min-h-8 min-w-8 px-2 text-sm"
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <Modal open={!!editing} title={t("common.edit")} onClose={() => setEditing(null)} wide>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["quotationNo", t("sales.quotationNo"), "text"],
            ["referenceNo", t("sales.referenceNo"), "text"],
            ["saleDate", t("common.date"), "date"],
            ["customerName", t("sales.customer"), "text"],
            ["customerMobile", t("contacts.mobile"), "text"],
            ["customerAddress", t("contacts.address"), "text"],
            ["customerEmail", t("contacts.email"), "email"],
            ["pfNo", "Quotation / PI No", "text"],
            ["challanNo", "Challan No", "text"],
            ["binNo", "BIN No", "text"],
            ["subject", "Subject", "text"],
            ["subtotal", "Subtotal", "number"],
            ["discount", t("common.discount"), "number"],
            ["tax", t("common.tax"), "number"],
            ["shipping", "Shipping", "number"],
            ["grandTotal", t("common.grandTotal"), "number"],
            ["paidAmount", "Paid Amount", "number"],
            ["dueAmount", t("common.due"), "number"],
          ].map(([key, label, type]) => (
            <Field key={key} label={label}>
              <input
                className="gp-input"
                type={type}
                step={type === "number" ? "0.01" : undefined}
                value={editForm[key] || ""}
                onChange={(e) => setEditForm((form) => ({ ...form, [key]: e.target.value }))}
              />
            </Field>
          ))}
          <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="text-[0.8rem] font-semibold text-muted">{t("common.note")}</span>
            <textarea className="gp-input min-h-20 resize-y" value={editForm.note || ""} onChange={(e) => setEditForm((form) => ({ ...form, note: e.target.value }))} />
          </label>
          <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="text-[0.8rem] font-semibold text-muted">Terms &amp; Conditions</span>
            <textarea className="gp-input min-h-20 resize-y" value={editForm.terms || ""} onChange={(e) => setEditForm((form) => ({ ...form, terms: e.target.value }))} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
            <button type="button" className="gp-btn gp-btn-primary" disabled={saving} onClick={() => void saveEdit()}>{saving ? "..." : t("common.save")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
