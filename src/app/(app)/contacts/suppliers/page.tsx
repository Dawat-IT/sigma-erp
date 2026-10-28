"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { displaySupplierLabel } from "@/lib/supplier-label";

type Supplier = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  email?: string;
  address?: string;
  location?: string;
  supplierName?: string;
  supplierContact?: string;
  supplierEmail?: string;
  supplierWhatsApp?: string;
  supplierWeChat?: string;
  supplierCurrencyName?: string;
  balance?: number;
  openingBalance?: number;
  createdAt?: string;
};

type FormState = {
  supplierName: string;
  supplierContact: string;
  supplierEmail: string;
  location: string;
  supplierWhatsApp: string;
  supplierWeChat: string;
  supplierCurrencyName: string;
  openingBalance: string;
};

const emptyForm: FormState = {
  supplierName: "",
  supplierContact: "",
  supplierEmail: "",
  location: "",
  supplierWhatsApp: "",
  supplierWeChat: "",
  supplierCurrencyName: "",
  openingBalance: "0",
};

export default function SuppliersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ type: "supplier", limit: "100" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/contacts?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error("load_failed");
      setRows(json.data || []);
    } catch {
      setMessage(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [q, t]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  }

  async function openEdit(row: Supplier) {
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${row._id}`);
      const json = await res.json();
      const doc: Supplier = json.data || row;
      setEditing(doc);
      setForm({
        supplierName: doc.supplierName || doc.name || "",
        supplierContact: doc.supplierContact || doc.mobile || "",
        supplierEmail: doc.supplierEmail || doc.email || "",
        location: doc.location || "",
        supplierWhatsApp: doc.supplierWhatsApp || "",
        supplierWeChat: doc.supplierWeChat || "",
        supplierCurrencyName: doc.supplierCurrencyName || "",
        openingBalance: String(doc.openingBalance ?? doc.balance ?? 0),
      });
      setModalOpen(true);
    } catch {
      setMessage(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.supplierName.trim() || !form.supplierContact.trim()) {
      setMessage(
        locale === "bn" ? "সরবরাহকারীর নাম ও যোগাযোগ আবশ্যক" : "Supplier name and contact are required",
      );
      return;
    }

    setBusy(true);
    setMessage("");
    const payload: Record<string, unknown> = {
      type: "supplier",
      supplierName: form.supplierName.trim(),
      supplierContact: form.supplierContact.trim(),
      supplierEmail: form.supplierEmail.trim(),
      location: form.location.trim(),
      supplierWhatsApp: form.supplierWhatsApp.trim(),
      supplierWeChat: form.supplierWeChat.trim(),
      supplierCurrencyName: form.supplierCurrencyName.trim(),
      openingBalance: Number(form.openingBalance || 0),
    };
    if (!editing) {
      payload.balance = Number(form.openingBalance || 0);
    }

    try {
      const res = await fetch(
        editing ? `/api/contacts/${editing._id}` : "/api/contacts",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "fail");

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
      setMessage(
        locale === "bn"
          ? editing
            ? "সরবরাহকারী আপডেট হয়েছে"
            : "সরবরাহকারী যোগ হয়েছে"
          : editing
            ? "Supplier updated"
            : "Supplier created",
      );
    } catch {
      setMessage(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(locale === "bn" ? "সরবরাহকারী মুছবেন?" : "Delete this supplier?")) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("fail");
      // Optimistic remove, then refresh
      setRows((prev) => prev.filter((r) => r._id !== id));
      await load();
      setMessage(locale === "bn" ? "সরবরাহকারী মুছে ফেলা হয়েছে" : "Supplier deleted");
    } catch {
      setMessage(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        kicker={locale === "bn" ? "ক্রয়" : "Purchases"}
        title={locale === "bn" ? "সরবরাহকারী" : "Suppliers"}
        subtitle={locale === "bn" ? "স্পেয়ার পার্টস সরবরাহকারী" : "Spare parts suppliers"}
        stats={[{ value: rows.length, label: locale === "bn" ? "সরবরাহকারী" : "suppliers" }]}
        actions={
          <button type="button" className="gp-btn gp-btn-primary shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "নতুন সরবরাহকারী" : "Add New Supplier"}
          </button>
        }
      />

      <div className="gp-card flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          className="gp-input min-h-10 border-0 bg-transparent py-1 shadow-none focus:shadow-none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.search")}
        />
      </div>

      {message ? (
        <p className="mb-2 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {message}
        </p>
      ) : null}

      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap overflow-x-auto">
          <table className="gp-table w-full min-w-[800px] table-fixed [&_td]:py-2 [&_th]:py-2">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr>
                <th>SL</th>
                <th>{t("common.date")}</th>
                <th>{locale === "bn" ? "নাম" : "Name"}</th>
                <th>{locale === "bn" ? "লোকেশন" : "Location"}</th>
                <th>{locale === "bn" ? "মোবাইল" : "Mobile"}</th>
                <th>{locale === "bn" ? "প্রদেয় (Payable)" : "Payable"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, index) => {
                const name = displaySupplierLabel(s, locale);
                return (
                  <tr key={s._id}>
                    <td>{index + 1}</td>
                    <td className="whitespace-nowrap">
                      {s.createdAt ? formatDateBD(s.createdAt, locale) : "—"}
                    </td>
                    <td className="min-w-0">
                      <Link
                        href={`/contacts/${s._id}/statement`}
                        className="block truncate font-semibold text-primary hover:underline"
                        title={locale === "bn" ? "স্টেটমেন্ট দেখুন" : "View statement"}
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="min-w-0 truncate" title={s.location || s.address || ""}>
                      {s.location || s.address || "—"}
                    </td>
                    <td>{s.mobile || "—"}</td>
                    <td className="gp-money whitespace-nowrap">{formatBDT(s.balance || 0, locale)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/contacts/${s._id}/statement`}
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5"
                          title={locale === "bn" ? "স্টেটমেন্ট" : "Statement"}
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/contacts/suppliers/${s._id}`}
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5"
                          title={locale === "bn" ? "বিস্তারিত" : "Details"}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5"
                          disabled={busy}
                          onClick={() => openEdit(s)}
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5 text-danger"
                          disabled={busy}
                          onClick={() => onDelete(s._id)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? t("common.edit") : t("common.add")}
        fit
        onClose={() => {
          if (busy) return;
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label={locale === "bn" ? "সরবরাহকারীর নাম" : "Supplier Name"}>
            <input
              className="gp-input"
              required
              value={form.supplierName}
              onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর যোগাযোগ" : "Supplier Contact"}>
            <input
              className="gp-input"
              required
              value={form.supplierContact}
              onChange={(e) => setForm((f) => ({ ...f, supplierContact: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর ইমেইল" : "Supplier Email"}>
            <input
              className="gp-input"
              type="email"
              value={form.supplierEmail}
              onChange={(e) => setForm((f) => ({ ...f, supplierEmail: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "লোকেশন" : "Location"}>
            <input
              className="gp-input"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর হোয়াটসঅ্যাপ" : "Supplier WhatsApp"}>
            <input
              className="gp-input"
              value={form.supplierWhatsApp}
              onChange={(e) => setForm((f) => ({ ...f, supplierWhatsApp: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর উইচ্যাট" : "Supplier WeChat"}>
            <input
              className="gp-input"
              value={form.supplierWeChat}
              onChange={(e) => setForm((f) => ({ ...f, supplierWeChat: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর মুদ্রার নাম" : "Supplier Currency Name"}>
            <input
              className="gp-input"
              value={form.supplierCurrencyName}
              onChange={(e) => setForm((f) => ({ ...f, supplierCurrencyName: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "প্রারম্ভিক ব্যালেন্স" : "Opening Balance"}>
            <input
              type="number"
              className="gp-input"
              value={form.openingBalance}
              onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
            />
          </Field>
          <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              className="gp-btn gp-btn-ghost min-h-10 px-4"
              disabled={busy}
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary min-h-10 px-5" disabled={busy}>
              {busy ? "..." : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
