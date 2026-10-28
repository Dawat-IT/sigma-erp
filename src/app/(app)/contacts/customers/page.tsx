"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, Modal, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";

type Customer = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  location?: string;
  contactPerson?: string;
  group?: string;
  nid?: string;
  bin?: string;
  tin?: string;
  creditLimit?: number;
  balance?: number;
  openingBalance?: number;
  email?: string;
  notes?: string;
  lat?: number;
  lng?: number;
};

type FormState = {
  name: string;
  nameBn: string;
  contactPerson: string;
  group: string;
  mobile: string;
  phone: string;
  whatsapp: string;
  email: string;
  location: string;
  city: string;
  address: string;
  nid: string;
  bin: string;
  tin: string;
  creditLimit: string;
  openingBalance: string;
  notes: string;
  lat: string;
  lng: string;
};

const emptyForm: FormState = {
  name: "",
  nameBn: "",
  contactPerson: "",
  group: "",
  mobile: "",
  phone: "",
  whatsapp: "",
  email: "",
  location: "",
  city: "",
  address: "",
  nid: "",
  bin: "",
  tin: "",
  creditLimit: "0",
  openingBalance: "0",
  notes: "",
  lat: "",
  lng: "",
};

const CUSTOMER_GROUPS = ["Residential", "Corporate", "AMC", "Dealer", "Wholesale", "Retail", "VIP"];

export default function CustomersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ type: "customer", limit: "100" });
      if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
      const res = await fetch(`/api/contacts?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error("load_failed");
      setRows(json.data || []);
    } catch {
      setMessage(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(row: Customer) {
    setEditing(row);
    setForm({
      name: row.name || "",
      nameBn: row.nameBn || "",
      contactPerson: row.contactPerson || "",
      group: row.group || "",
      mobile: row.mobile || "",
      phone: row.phone || "",
      whatsapp: row.whatsapp || "",
      email: row.email || "",
      location: row.location || "",
      city: row.city || "",
      address: row.address || "",
      nid: row.nid || "",
      bin: row.bin || "",
      tin: row.tin || "",
      creditLimit: String(row.creditLimit ?? 0),
      openingBalance: String(row.openingBalance ?? 0),
      notes: row.notes || "",
      lat: row.lat ? String(row.lat) : "",
      lng: row.lng ? String(row.lng) : "",
    });
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      setMessage(bn ? "নাম ও মোবাইল আবশ্যক" : "Name and mobile are required");
      return;
    }
    setBusy(true);
    setMessage("");
    const payload: Record<string, unknown> = {
      type: "customer",
      name: form.name.trim(),
      nameBn: form.nameBn.trim(),
      contactPerson: form.contactPerson.trim(),
      group: form.group.trim(),
      mobile: form.mobile.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      nid: form.nid.trim(),
      bin: form.bin.trim(),
      tin: form.tin.trim(),
      creditLimit: Number(form.creditLimit || 0),
      openingBalance: Number(form.openingBalance || 0),
      notes: form.notes.trim(),
      lat: form.lat.trim() || null,
      lng: form.lng.trim() || null,
    };
    if (!editing) {
      payload.balance = Number(form.openingBalance || 0);
    }
    try {
      const res = await fetch(editing ? `/api/contacts/${editing._id}` : "/api/contacts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("fail");
      setModalOpen(false);
      await load();
    } catch {
      setMessage(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(bn ? "কাস্টমার মুছবেন?" : "Delete customer?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="gp-desk cust-desk">
      <PageHeader
        kicker={bn ? "সেলস ও সিআরএম" : "Sales & CRM"}
        title={t("nav.customers")}
        subtitle={
          bn
            ? "সার্ভিস কাস্টমার — নামে ক্লিক করে লেজার দেখুন"
            : "Service customers — click a name to open the ledger"
        }
        stats={[
          { value: rows.length, label: bn ? "কাস্টমার" : "customers" },
          { value: rows.filter((c) => c.lat != null && c.lng != null).length, label: "lat/long" },
          { value: rows.filter((c) => Number(c.balance || 0) > 0).length, label: bn ? "প্রাপ্য" : "receivable" },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
            />
            <button type="button" className="gp-btn gp-btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("contacts.addCustomer")}
            </button>
          </>
        }
      />

      {message ? <p className="text-sm text-danger">{message}</p> : null}

      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap !overflow-x-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "নাম" : "Name"}</th>
                <th>{bn ? "যোগাযোগ ব্যক্তি" : "Contact person"}</th>
                <th>{bn ? "মোবাইল" : "Mobile"}</th>
                <th>{bn ? "এলাকা" : "Area"}</th>
                <th>{bn ? "গ্রুপ" : "Group"}</th>
                <th>{bn ? "প্রাপ্য (Receivable)" : "Receivable"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const name = bn && c.nameBn ? c.nameBn : c.name;
                return (
                  <tr key={c._id}>
                    <td>
                      <Link
                        href={`/contacts/${c._id}/statement`}
                        className="font-semibold text-primary hover:underline"
                        title={bn ? "লেজার দেখুন" : "View ledger"}
                      >
                        {name}
                      </Link>
                      {c.address ? (
                        <p className="mt-0.5 max-w-[16rem] truncate text-xs text-muted" title={c.address}>
                          {c.address}
                        </p>
                      ) : null}
                    </td>
                    <td>{c.contactPerson || "—"}</td>
                    <td>
                      {c.mobile || "—"}
                      {c.whatsapp ? <p className="text-xs text-muted">WA {c.whatsapp}</p> : null}
                    </td>
                    <td>{[c.location, c.city].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{c.group || "—"}</td>
                    <td className="gp-money">{formatBDT(c.balance || 0, locale)}</td>
                    <td>
                      <div className="flex flex-nowrap items-center gap-1">
                        <Link
                          href={`/contacts/${c._id}/statement`}
                          className="gp-btn gp-btn-primary whitespace-nowrap px-2"
                          title={t("contacts.ledger")}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{t("contacts.ledger")}</span>
                        </Link>
                        <Link
                          href={`/crm/client-followups/${c._id}`}
                          className="gp-btn gp-btn-ghost whitespace-nowrap px-2"
                        >
                          {bn ? "ফলো-আপ" : "Follow-up"}
                        </Link>
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost px-2"
                          onClick={() => openEdit(c)}
                          title={t("common.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost px-2 text-danger"
                          onClick={() => onDelete(c._id)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        wide
        noScroll
        title={editing ? (bn ? "কাস্টমার সম্পাদনা" : "Edit customer") : t("contacts.addCustomer")}
        onClose={() => {
          if (!busy) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
      >
        <form onSubmit={onSubmit} className="erp-cust-form">
          <div className="erp-cust-grid">
            <section className="erp-cust-panel">
              <h3>{bn ? "পরিচয়" : "Identity"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{bn ? "কাস্টমারের নাম" : "Customer name"}</span>
                  <input className="gp-input" required value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "নাম (বাংলা)" : "Name (Bangla)"}</span>
                  <input className="gp-input" value={form.nameBn} onChange={(e) => setField("nameBn", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "যোগাযোগ ব্যক্তি" : "Contact person"}</span>
                  <input className="gp-input" value={form.contactPerson} onChange={(e) => setField("contactPerson", e.target.value)} placeholder={bn ? "মালিক / ম্যানেজার" : "Owner / manager"} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "গ্রুপ" : "Group"}</span>
                  <select className="gp-input" value={form.group} onChange={(e) => setField("group", e.target.value)}>
                    <option value="">{bn ? "বেছে নিন" : "Select"}</option>
                    {CUSTOMER_GROUPS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="erp-cust-panel">
              <h3>{bn ? "যোগাযোগ" : "Contact"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{bn ? "মোবাইল" : "Mobile"}</span>
                  <input className="gp-input" required value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "অন্যান্য ফোন" : "Other phone"}</span>
                  <input className="gp-input" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">WhatsApp</span>
                  <input className="gp-input" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">Email</span>
                  <input className="gp-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </label>
              </div>
            </section>

            <section className="erp-cust-panel">
              <h3>{bn ? "সাইট / ঠিকানা" : "Site / address"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{bn ? "এলাকা" : "Area"}</span>
                  <input className="gp-input" value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder={bn ? "গুলশান" : "Gulshan"} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "শহর" : "City"}</span>
                  <input className="gp-input" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder={bn ? "ঢাকা" : "Dhaka"} />
                </label>
                <label>
                  <span className="gp-field-label">Lat</span>
                  <input className="gp-input" value={form.lat} onChange={(e) => setField("lat", e.target.value)} inputMode="decimal" placeholder="23.8103" />
                </label>
                <label>
                  <span className="gp-field-label">Long</span>
                  <input className="gp-input" value={form.lng} onChange={(e) => setField("lng", e.target.value)} inputMode="decimal" placeholder="90.4125" />
                </label>
                <label className="span-2">
                  <span className="gp-field-label">{bn ? "ঠিকানা" : "Address"}</span>
                  <input className="gp-input" value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder={bn ? "বাড়ি, রোড, এলাকা" : "Building, road, area"} />
                </label>
              </div>
            </section>

            <section className="erp-cust-panel">
              <h3>{bn ? "বিজনেস ও ক্রেডিট" : "Business & credit"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{bn ? "এনআইডি" : "NID"}</span>
                  <input className="gp-input" value={form.nid} onChange={(e) => setField("nid", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "বিআইএন" : "BIN"}</span>
                  <input className="gp-input" value={form.bin} onChange={(e) => setField("bin", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "টিআইএন" : "TIN"}</span>
                  <input className="gp-input" value={form.tin} onChange={(e) => setField("tin", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "ক্রেডিট সীমা" : "Credit limit"}</span>
                  <input type="number" min={0} className="gp-input" value={form.creditLimit} onChange={(e) => setField("creditLimit", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "ওপেনিং" : "Opening"}</span>
                  <input type="number" className="gp-input" value={form.openingBalance} onChange={(e) => setField("openingBalance", e.target.value)} />
                </label>
                <label>
                  <span className="gp-field-label">{bn ? "প্রাপ্য" : "Receivable"}</span>
                  <input className="gp-input" readOnly value={editing ? formatBDT(editing.balance || 0, locale) : formatBDT(Number(form.openingBalance || 0), locale)} />
                </label>
                <label className="span-2">
                  <span className="gp-field-label">{bn ? "নোট" : "Notes"}</span>
                  <input className="gp-input" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={bn ? "লিফট / চুক্তি / গেট পাস" : "Lift / contract / gate pass"} />
                </label>
              </div>
            </section>
          </div>

          <div className="erp-cust-actions">
            <button type="button" className="gp-btn gp-btn-ghost" disabled={busy} onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {busy ? "..." : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
