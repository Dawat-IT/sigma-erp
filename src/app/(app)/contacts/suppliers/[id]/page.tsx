"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { displaySupplierLabel } from "@/lib/supplier-label";

type HistoryLine = {
  purchaseId: string;
  referenceNo: string;
  purchaseDate: string;
  status: string;
  productName: string;
  sku: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

type OfferedProduct = {
  linkId: string;
  productId: string;
  name: string;
  nameBn?: string;
  sku: string;
  offerPrice: number;
};

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
};

type HistoryPayload = {
  supplier: Supplier;
  lines: HistoryLine[];
  offeredProducts: OfferedProduct[];
  summary: {
    purchaseCount: number;
    lineCount: number;
    totalQty: number;
    totalAmount: number;
    dueAmount: number;
    productCount: number;
    balance?: number;
  };
};

type ProductOption = { _id: string; name: string; nameBn?: string; sku: string };

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    supplierName: "",
    supplierContact: "",
    supplierEmail: "",
    location: "",
    supplierWhatsApp: "",
    supplierWeChat: "",
    supplierCurrencyName: "",
    openingBalance: "0",
  });

  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addPrice, setAddPrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${id}/history`);
      if (!res.ok) throw new Error("fail");
      const json = await res.json();
      setData(json.data);
      const drafts: Record<string, string> = {};
      for (const p of json.data?.offeredProducts || []) {
        drafts[p.linkId] = String(p.offerPrice ?? 0);
      }
      setPriceDrafts(drafts);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  function openEditSupplier() {
    if (!data) return;
    const s = data.supplier;
    setSupplierForm({
      supplierName: s.supplierName || s.name || "",
      supplierContact: s.supplierContact || s.mobile || "",
      supplierEmail: s.supplierEmail || s.email || "",
      location: s.location || "",
      supplierWhatsApp: s.supplierWhatsApp || "",
      supplierWeChat: s.supplierWeChat || "",
      supplierCurrencyName: s.supplierCurrencyName || "",
      openingBalance: String(s.openingBalance ?? s.balance ?? 0),
    });
    setEditOpen(true);
  }

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/contacts/${id}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: {
            supplierName: supplierForm.supplierName,
            supplierContact: supplierForm.supplierContact,
            supplierEmail: supplierForm.supplierEmail,
            location: supplierForm.location,
            supplierWhatsApp: supplierForm.supplierWhatsApp,
            supplierWeChat: supplierForm.supplierWeChat,
            supplierCurrencyName: supplierForm.supplierCurrencyName,
            openingBalance: Number(supplierForm.openingBalance || 0),
          },
        }),
      });
      if (!res.ok) throw new Error("fail");
      setEditOpen(false);
      await load();
      setMsg(locale === "bn" ? "সরবরাহকারী আপডেট হয়েছে" : "Supplier updated");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function savePrices() {
    if (!data) return;
    setBusy(true);
    setMsg("");
    try {
      const offerUpdates = data.offeredProducts.map((p) => ({
        linkId: p.linkId,
        price: Number(priceDrafts[p.linkId] ?? p.offerPrice),
      }));
      const res = await fetch(`/api/contacts/${id}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerUpdates }),
      });
      if (!res.ok) throw new Error("fail");
      await load();
      setMsg(locale === "bn" ? "মূল্য আপডেট হয়েছে" : "Prices updated");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function removeOffer(linkId: string) {
    if (!confirm(locale === "bn" ? "পণ্য লিংক মুছবেন?" : "Remove product link?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${id}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeLinkId: linkId }),
      });
      if (!res.ok) throw new Error("fail");
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function openAddProduct() {
    setAddOpen(true);
    const res = await fetch("/api/products?limit=100");
    const json = await res.json();
    setAllProducts(json.data || []);
  }

  async function addProductOffer(e: FormEvent) {
    e.preventDefault();
    if (!addProductId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${id}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addOffer: { productId: addProductId, price: Number(addPrice || 0) },
        }),
      });
      if (!res.ok) throw new Error("fail");
      setAddOpen(false);
      setAddProductId("");
      setAddPrice("");
      await load();
      setMsg(locale === "bn" ? "পণ্য যোগ হয়েছে" : "Product linked");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <EmptyState message={t("app.loading")} />;
  if (error || !data) return <EmptyState message={error || t("common.noData")} />;

  const { supplier, lines, offeredProducts, summary } = data;
  const name = displaySupplierLabel(supplier, locale);

  return (
    <div className="gp-desk">
      <Link href="/contacts/suppliers" className="gp-btn gp-btn-ghost min-h-9 w-fit px-3">
        <ArrowLeft className="h-4 w-4" />
        {locale === "bn" ? "সরবরাহকারী তালিকা" : "Back to suppliers"}
      </Link>
      <PageHeader
          title={name}
          subtitle={
            locale === "bn"
              ? "পণ্য লিংক, মূল্য ও ক্রয় ইতিহাস — সব এডিটযোগ্য"
              : "Linked products, prices and purchase history — all editable"
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/contacts/${id}/statement`} className="gp-btn gp-btn-ghost">
                <FileText className="h-4 w-4" />
                {locale === "bn" ? "স্টেটমেন্ট" : "Statement"}
              </Link>
              <button type="button" className="gp-btn gp-btn-primary" onClick={openEditSupplier}>
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </button>
            </div>
          }
        />

      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="gp-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {locale === "bn" ? "মোবাইল" : "Mobile"}
          </p>
          <p className="mt-1 font-semibold">{supplier.mobile || "—"}</p>
        </div>
        <div className="gp-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {locale === "bn" ? "প্রদেয় (Payable)" : "Payable"}
          </p>
          <p className="gp-money mt-1 text-xl text-primary">
            {formatBDT(summary.balance ?? supplier.balance ?? 0, locale)}
          </p>
        </div>
        <div className="gp-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {locale === "bn" ? "লিংকড পণ্য" : "Linked products"}
          </p>
          <p className="gp-money mt-1 text-xl">{summary.productCount}</p>
        </div>
        <div className="gp-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {locale === "bn" ? "মোট পণ্য পরিমাণ" : "Total qty"}
          </p>
          <p className="gp-money mt-1 text-xl">{summary.totalQty}</p>
        </div>
        <div className="gp-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {locale === "bn" ? "মোট ক্রয় মূল্য" : "Total purchase"}
          </p>
          <p className="gp-money mt-1 text-xl text-primary">
            {formatBDT(summary.totalAmount, locale)}
          </p>
        </div>
      </div>

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            {locale === "bn" ? "লিংকড পণ্য ও মূল্য" : "Linked products & prices"}
          </h2>
          <div className="flex gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={openAddProduct}>
              <Plus className="h-4 w-4" />
              {locale === "bn" ? "পণ্য যোগ" : "Add product"}
            </button>
            <button
              type="button"
              className="gp-btn gp-btn-primary"
              disabled={busy || !offeredProducts.length}
              onClick={savePrices}
            >
              {locale === "bn" ? "মূল্য সেভ" : "Save prices"}
            </button>
          </div>
        </div>

        {offeredProducts.length === 0 ? (
          <EmptyState
            message={
              locale === "bn"
                ? "এখনো কোনো পণ্য লিংক নেই — পণ্য যোগ করুন"
                : "No linked products yet — add a product"
            }
          />
        ) : (
          <div className="gp-table-wrap">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>{locale === "bn" ? "পণ্য" : "Product"}</th>
                  <th>SKU</th>
                  <th>{locale === "bn" ? "মূল্য" : "Price"}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {offeredProducts.map((p) => (
                  <tr key={p.linkId}>
                    <td className="font-semibold">
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </td>
                    <td>{p.sku}</td>
                    <td>
                      <input
                        type="number"
                        className="gp-input max-w-[140px]"
                        value={priceDrafts[p.linkId] ?? ""}
                        onChange={(e) =>
                          setPriceDrafts((d) => ({ ...d, [p.linkId]: e.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="gp-btn gp-btn-ghost min-h-9 px-2.5 text-danger"
                        onClick={() => removeOffer(p.linkId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          {locale === "bn" ? "ক্রয় ইতিহাস" : "Purchase history"}
        </h2>
        {lines.length === 0 ? (
          <EmptyState
            message={locale === "bn" ? "এখনো কোনো ক্রয় নেই" : "No purchases recorded yet"}
          />
        ) : (
          <div className="gp-table-wrap">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>{locale === "bn" ? "তারিখ" : "Date"}</th>
                  <th>{locale === "bn" ? "রেফারেন্স" : "Reference"}</th>
                  <th>{locale === "bn" ? "পণ্য" : "Product"}</th>
                  <th>{locale === "bn" ? "পরিমাণ" : "Qty"}</th>
                  <th>{locale === "bn" ? "একক মূল্য" : "Unit price"}</th>
                  <th>{locale === "bn" ? "মোট" : "Line total"}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={`${line.purchaseId}-${idx}`}>
                    <td>{formatDateBD(line.purchaseDate, locale)}</td>
                    <td className="font-medium">{line.referenceNo}</td>
                    <td>
                      <p className="font-semibold">{line.productName}</p>
                      <p className="text-xs text-muted">{line.sku}</p>
                    </td>
                    <td className="gp-money">{line.qty}</td>
                    <td className="gp-money">{formatBDT(line.unitCost, locale)}</td>
                    <td className="gp-money font-semibold text-primary">
                      {formatBDT(line.lineTotal, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={editOpen}
        title={t("common.edit")}
        fit
        onClose={() => setEditOpen(false)}
      >
        <form onSubmit={saveSupplier} className="grid gap-2.5 sm:grid-cols-2">
          <Field label={locale === "bn" ? "সরবরাহকারীর নাম" : "Supplier Name"}>
            <input
              className="gp-input"
              required
              value={supplierForm.supplierName}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierName: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর যোগাযোগ" : "Supplier Contact"}>
            <input
              className="gp-input"
              required
              value={supplierForm.supplierContact}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierContact: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর ইমেইল" : "Supplier Email"}>
            <input
              className="gp-input"
              type="email"
              value={supplierForm.supplierEmail}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierEmail: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "লোকেশন" : "Location"}>
            <input
              className="gp-input"
              value={supplierForm.location}
              onChange={(e) => setSupplierForm((f) => ({ ...f, location: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর হোয়াটসঅ্যাপ" : "Supplier WhatsApp"}>
            <input
              className="gp-input"
              value={supplierForm.supplierWhatsApp}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierWhatsApp: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর উইচ্যাট" : "Supplier WeChat"}>
            <input
              className="gp-input"
              value={supplierForm.supplierWeChat}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierWeChat: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "সরবরাহকারীর মুদ্রার নাম" : "Supplier Currency Name"}>
            <input
              className="gp-input"
              value={supplierForm.supplierCurrencyName}
              onChange={(e) => setSupplierForm((f) => ({ ...f, supplierCurrencyName: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "প্রারম্ভিক ব্যালেন্স" : "Opening Balance"}>
            <input
              type="number"
              className="gp-input"
              value={supplierForm.openingBalance}
              onChange={(e) =>
                setSupplierForm((f) => ({ ...f, openingBalance: e.target.value }))
              }
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addOpen}
        title={locale === "bn" ? "পণ্য যোগ" : "Add product"}
        compact
        onClose={() => setAddOpen(false)}
      >
        <form onSubmit={addProductOffer} className="space-y-3">
          <Field label={locale === "bn" ? "পণ্য" : "Product"}>
            <select
              className="gp-input"
              required
              value={addProductId}
              onChange={(e) => setAddProductId(e.target.value)}
            >
              <option value="">—</option>
              {allProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {(locale === "bn" && p.nameBn ? p.nameBn : p.name) + ` (${p.sku})`}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "bn" ? "মূল্য" : "Price"}>
            <input
              type="number"
              className="gp-input"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setAddOpen(false)}>
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
