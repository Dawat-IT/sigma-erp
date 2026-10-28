"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Search } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { InvoiceActions } from "@/components/InvoiceActions";
import { OrderPipelineBar } from "@/components/OrderPipelineBar";
import { formatBDT, formatDateBD } from "@/lib/utils";

const PAGE_SIZE = 20;

type Proposal = {
  _id: string;
  proposalNo?: string;
  quotationNo?: string;
  referenceNo?: string;
  invoiceNo?: string;
  customerName: string;
  customerId?: string;
  customerMobile?: string;
  customerAddress?: string;
  customerEmail?: string;
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

export default function ProposalsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<Proposal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load(nextPage = 1, search = q) {
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(nextPage),
      status: "proposal",
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
    const res = await fetch(`/api/sales?${qs}`);
    const json = await res.json();
    setData(json.data || []);
    setTotal(Number(json.total) || 0);
    setPage(nextPage);
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

  function openEdit(row: Proposal) {
    setEditing(row);
    setEditForm({
      proposalNo: row.proposalNo || "",
      referenceNo: row.referenceNo || "",
      customerName: row.customerName || "",
      customerMobile: row.customerMobile || "",
      customerAddress: row.customerAddress || "",
      customerEmail: row.customerEmail || "",
      subject: row.subject || "",
      saleDate: row.saleDate ? row.saleDate.slice(0, 10) : "",
      subtotal: String(row.subtotal || 0),
      discount: String(row.discount || 0),
      tax: String(row.tax || 0),
      shipping: String(row.shipping || 0),
      grandTotal: String(row.grandTotal || 0),
      note: row.note || "",
      terms: row.terms || "",
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
          proposalNo: editForm.proposalNo,
          referenceNo: editForm.referenceNo,
          customerName: editForm.customerName,
          customerMobile: editForm.customerMobile,
          customerAddress: editForm.customerAddress,
          customerEmail: editForm.customerEmail,
          subject: editForm.subject,
          saleDate: editForm.saleDate,
          subtotal: Number(editForm.subtotal || 0),
          discount: Number(editForm.discount || 0),
          tax: Number(editForm.tax || 0),
          shipping: Number(editForm.shipping || 0),
          grandTotal: Number(editForm.grandTotal || 0),
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

  return (
    <div className="gp-desk">
      <PageHeader
        title={t("nav.listProposals")}
        subtitle={locale === "bn" ? "প্রস্তাবনা থেকে কোটেশন" : "Proposals before quotation"}
        actions={
          <Link href="/pos?mode=proposal" className="gp-btn gp-btn-primary">
            {t("nav.addProposal")}
          </Link>
        }
      />

      <div className="gp-card flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          className="gp-input min-h-10 border-0 bg-transparent py-1 shadow-none focus:shadow-none"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (searchTimer.current) clearTimeout(searchTimer.current);
            searchTimer.current = setTimeout(() => void load(1, value), 250);
          }}
          placeholder={t("common.search")}
        />
      </div>

      <OrderPipelineBar />

      <div className="gp-table-wrap overflow-x-auto">
        {data.length === 0 ? (
          <EmptyState message={t("common.noData")} />
        ) : (
          <table className="gp-table gp-table-compact w-full min-w-[720px] table-fixed [&_td]:py-2 [&_th]:py-2">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead>
              <tr>
                <th>SL No</th>
                <th>{t("common.date")}</th>
                <th>{t("sales.proposalNo")}</th>
                <th>{t("sales.referenceNo")}</th>
                <th>{t("sales.customer")}</th>
                <th>{t("common.grandTotal")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, index) => (
                <tr key={s._id}>
                  <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="whitespace-nowrap">{formatDateBD(s.saleDate, locale)}</td>
                  <td>
                    <Link href={`/sales/${s._id}/proposal`} className="font-semibold text-primary hover:underline">
                      {s.proposalNo || s.invoiceNo || "—"}
                    </Link>
                  </td>
                  <td className="font-mono text-sm">{s.referenceNo || "—"}</td>
                  <td>
                    {s.customerId ? (
                      <Link
                        href={`/contacts/${s.customerId}/statement`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {s.customerName}
                      </Link>
                    ) : (
                      s.customerName
                    )}
                  </td>
                  <td className="whitespace-nowrap font-bold">{formatBDT(s.grandTotal, locale)}</td>
                  <td>
                    <div className="flex flex-nowrap items-center gap-1">
                      <button type="button" className="gp-btn gp-btn-ghost min-h-8 shrink-0 px-2 text-xs" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("common.edit")}</span>
                      </button>
                      <InvoiceActions saleId={s._id} saleStatus={s.status} inline iconOnlyCore className="flex-nowrap [&>*]:shrink-0" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

      <Modal open={!!editing} title={t("common.edit")} onClose={() => setEditing(null)} wide>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["proposalNo", t("sales.proposalNo"), "text"],
            ["referenceNo", t("sales.referenceNo"), "text"],
            ["saleDate", t("common.date"), "date"],
            ["customerName", t("sales.customer"), "text"],
            ["customerMobile", t("contacts.mobile"), "text"],
            ["customerAddress", t("contacts.address"), "text"],
            ["customerEmail", t("contacts.email"), "email"],
            ["subject", "Subject", "text"],
            ["subtotal", "Subtotal", "number"],
            ["discount", t("common.discount"), "number"],
            ["tax", t("common.tax"), "number"],
            ["shipping", "Shipping", "number"],
            ["grandTotal", t("common.grandTotal"), "number"],
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
