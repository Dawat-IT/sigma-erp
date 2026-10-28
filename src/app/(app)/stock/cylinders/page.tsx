"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatDateBD } from "@/lib/utils";

type Product = { _id: string; name: string; nameBn?: string };
type Party = { _id: string; name: string; nameBn?: string };
type Location = { _id: string; name: string };
type Row = {
  _id: string;
  movementDate: string;
  productName?: string;
  partyType: string;
  partyName: string;
  delivered: number;
  received: number;
  balance: number;
};

export default function CylindersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    movementDate: calendarDateDhaka(),
    productId: "",
    partyType: "customer",
    partyId: "",
    delivered: "",
    received: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, cu, su, loc] = await Promise.all([
        fetch("/api/cylinders?limit=200").then((r) => r.json()),
        fetch("/api/products?limit=200").then((r) => r.json()),
        fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
        fetch("/api/contacts?type=supplier&limit=200").then((r) => r.json()),
        fetch("/api/meta?type=locations").then((r) => r.json()),
      ]);
      setRows(c.data || []);
      setProducts(p.data || []);
      setCustomers(cu.data || []);
      setSuppliers(su.data || []);
      setLocations(loc.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const parties =
    form.partyType === "customer"
      ? customers
      : form.partyType === "supplier"
        ? suppliers
        : locations;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/cylinders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          delivered: Number(form.delivered || 0),
          received: Number(form.received || 0),
        }),
      });
      if (!res.ok) throw new Error("fail");
      setOpen(false);
      setForm((f) => ({ ...f, delivered: "", received: "", note: "" }));
      await load();
      setMsg(locale === "bn" ? "সিলিন্ডার মুভমেন্ট যোগ হয়েছে" : "Cylinder movement added");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "সিলিন্ডার ট্র্যাকিং" : "Cylinder tracking"}
        subtitle={
          locale === "bn"
            ? "সিগমা এলিভেটরে এই মডিউল ব্যবহার হয় না। স্পেয়ার পার্টস স্টক পেজ দেখুন।"
            : "Not used for Sigma Elevator. Use the spare-parts stock page instead."
        }
        actions={
          <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("common.add")}
          </button>
        }
      />
      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}
      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{locale === "bn" ? "তারিখ" : "Date"}</th>
                <th>{locale === "bn" ? "পণ্য" : "Product"}</th>
                <th>{locale === "bn" ? "পক্ষ" : "Party"}</th>
                <th>{locale === "bn" ? "ডেলিভার্ড" : "Delivered"}</th>
                <th>{locale === "bn" ? "রিসিভড" : "Received"}</th>
                <th>{locale === "bn" ? "ব্যালেন্স" : "Balance"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{formatDateBD(r.movementDate, locale)}</td>
                  <td>{r.productName}</td>
                  <td>
                    <span className="text-xs text-muted uppercase">{r.partyType}</span>
                    <div className="font-semibold">{r.partyName}</div>
                  </td>
                  <td className="gp-money">{r.delivered}</td>
                  <td className="gp-money">{r.received}</td>
                  <td className="gp-money font-semibold">{r.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={locale === "bn" ? "নতুন মুভমেন্ট" : "New movement"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field label={locale === "bn" ? "তারিখ" : "Date"}>
            <input
              type="date"
              className="gp-input"
              value={form.movementDate}
              onChange={(e) => setForm((f) => ({ ...f, movementDate: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "পণ্য" : "Product"}>
            <select
              className="gp-input"
              required
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            >
              <option value="">—</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "bn" ? "পক্ষের ধরন" : "Party type"}>
            <select
              className="gp-input"
              value={form.partyType}
              onChange={(e) => setForm((f) => ({ ...f, partyType: e.target.value, partyId: "" }))}
            >
              <option value="customer">{locale === "bn" ? "গ্রাহক" : "Customer"}</option>
              <option value="supplier">{locale === "bn" ? "সরবরাহকারী" : "Supplier"}</option>
              <option value="warehouse">{locale === "bn" ? "ওয়্যারহাউস" : "Warehouse"}</option>
            </select>
          </Field>
          <Field label={locale === "bn" ? "পক্ষ" : "Party"}>
            <select
              className="gp-input"
              required={form.partyType !== "warehouse"}
              value={form.partyId}
              onChange={(e) => setForm((f) => ({ ...f, partyId: e.target.value }))}
            >
              <option value="">—</option>
              {parties.map((p) => {
                const label =
                  locale === "bn" && "nameBn" in p && typeof p.nameBn === "string" && p.nameBn
                    ? p.nameBn
                    : p.name;
                return (
                  <option key={p._id} value={p._id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label={locale === "bn" ? "ডেলিভার্ড" : "Delivered"}>
            <input
              type="number"
              min={0}
              className="gp-input"
              value={form.delivered}
              onChange={(e) => setForm((f) => ({ ...f, delivered: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "রিসিভড" : "Received"}>
            <input
              type="number"
              min={0}
              className="gp-input"
              value={form.received}
              onChange={(e) => setForm((f) => ({ ...f, received: e.target.value }))}
            />
          </Field>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-[0.8rem] font-semibold text-muted">{locale === "bn" ? "নোট" : "Note"}</span>
            <input
              className="gp-input"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
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
