"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Search, Trash2 } from "lucide-react";
import { EmptyState, Modal, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatBDT, formatDateBD } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";

type PurchaseRow = {
  _id: string;
  referenceNo: string;
  supplierName: string;
  supplierId?: string;
  grandTotal: number;
  dueAmount: number;
  purchaseDate: string;
  note?: string;
  productName?: string;
  productDescription?: string;
  categoryId?: string;
  brand?: string;
  buyingPrice?: number;
  currency?: string;
  shippingCost?: number;
  shippingCurrency?: string;
  quantity?: number;
  costPrice?: number;
  receivingDate?: string;
  supplierAddress?: string;
  supplierMobile?: string;
  supplierWhatsapp?: string;
  supplierWechat?: string;
  supplierLocation?: string;
  otherCost?: number;
  discount?: number;
  subtotal?: number;
  paidAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  documentName?: string;
  documentUrl?: string;
  items?: { productId?: string; name?: string; qty?: number; unitCost?: number }[];
};

type CatalogCategory = { _id: string; name: string; nameBn?: string };
type CatalogProduct = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  brand?: string;
  categoryId?: string;
  purchasePrice: number;
  currency?: string;
  description?: string;
};
type CatalogSupplier = {
  _id: string;
  name: string;
  mobile?: string;
  phone?: string;
  address?: string;
  location?: string;
  supplierWhatsApp?: string;
  supplierWeChat?: string;
  notes?: string;
};

const emptyForm = {
  purchaseType: "local",
  locationId: "",
  productId: "",
  productName: "",
  productDescription: "",
  categoryId: "",
  brand: "",
  buyingPrice: "",
  currency: "BDT",
  shippingCost: "0",
  shippingCurrency: "BDT",
  quantity: "1",
  costPrice: "",
  buyingDate: calendarDateDhaka(),
  receivingDate: calendarDateDhaka(),
  supplierId: "",
  supplierName: "",
  supplierAddress: "",
  supplierMobile: "",
  supplierWechat: "",
  supplierWhatsapp: "",
  supplierLocation: "",
  otherCost: "0",
  discount: "0",
  paidAmount: "",
  paymentMethod: "cash",
  note: "",
  documentName: "",
  documentUrl: "",
};

function toDateInput(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function purchaseProductNames(p: PurchaseRow) {
  const names = (p.items || []).map((it) => String(it.name || "").trim()).filter(Boolean);
  if (names.length) return names;
  return p.productName?.trim() ? [p.productName.trim()] : [];
}

function purchaseQuantity(p: PurchaseRow) {
  const fromItems = (p.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
  if (fromItems) return fromItems;
  return Number(p.quantity || 0);
}

function InlineField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 grid-cols-[5.4rem_minmax(0,1fr)] items-center gap-1.5">
      <span className="text-[0.8125rem] font-semibold leading-tight text-[var(--gp-text-2)]">{label}</span>
      {children}
    </label>
  );
}

export default function PurchasesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<PurchaseRow[]>([]);
  const [summary, setSummary] = useState({ grandTotal: 0, dueAmount: 0, count: 0 });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogSupplier[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [editing, setEditing] = useState<PurchaseRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "100" });
    if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
    const res = await fetch(`/api/purchases?${qs}`);
    const json = await res.json();
    setData(json.data || []);
    setSummary(json.summary || { grandTotal: 0, dueAmount: 0, count: 0 });
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        setLocations(d.locations || []);
        if (d.locations?.[0]) setForm((f) => ({ ...f, locationId: f.locationId || d.locations[0]._id }));
      });
    fetch("/api/products?limit=100")
      .then((r) => r.json())
      .then((d) => setProducts(d.data || []));
    fetch("/api/contacts?type=supplier&limit=100")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.data || []));
    fetch("/api/modules/categories?limit=200")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []));
    fetch("/api/meta?type=profile")
      .then((r) => r.json())
      .then((d) => {
        const role = (d.data || []).find((row: { label?: string }) => row.label === "Role")?.value;
        setIsSuper(role === "admin");
      })
      .catch(() => setIsSuper(false));
  }, []);

  const subtotal = Number(form.quantity || 0) * Number(form.buyingPrice || 0);
  const grandTotal = Math.max(
    0,
    subtotal + Number(form.shippingCost || 0) + Number(form.otherCost || 0) - Number(form.discount || 0),
  );
  const paidAmount = form.paidAmount === "" ? grandTotal : Number(form.paidAmount || 0);
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const paymentStatus = dueAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Due";

  const defaultLocationId = useMemo(
    () => form.locationId || locations[0]?._id || "",
    [form.locationId, locations],
  );

  function openCreate(purchaseType: "local" | "import") {
    setEditing(null);
    setForm({
      ...emptyForm,
      purchaseType,
      currency: purchaseType === "import" ? "USD" : "BDT",
      locationId: defaultLocationId,
    });
    setFormOpen(true);
  }

  function fillFromPurchase(p: PurchaseRow) {
    const item = p.items?.[0];
    setForm({
      purchaseType: "local",
      locationId: defaultLocationId,
      productId: item?.productId ? String(item.productId) : "",
      productName: p.productName || item?.name || "",
      productDescription: p.productDescription || "",
      categoryId: p.categoryId ? String(p.categoryId) : "",
      brand: p.brand || "",
      buyingPrice: String(p.buyingPrice ?? item?.unitCost ?? ""),
      currency: p.currency || "BDT",
      shippingCost: String(p.shippingCost ?? 0),
      shippingCurrency: p.shippingCurrency || "BDT",
      quantity: String(p.quantity ?? item?.qty ?? 1),
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      buyingDate: toDateInput(p.purchaseDate),
      receivingDate: toDateInput(p.receivingDate),
      supplierId: p.supplierId ? String(p.supplierId) : "",
      supplierName: p.supplierName || "",
      supplierAddress: p.supplierAddress || "",
      supplierMobile: p.supplierMobile || "",
      supplierWechat: p.supplierWechat || "",
      supplierWhatsapp: p.supplierWhatsapp || "",
      supplierLocation: p.supplierLocation || "",
      otherCost: String(p.otherCost ?? 0),
      discount: String(p.discount ?? 0),
      paidAmount: p.paidAmount != null ? String(p.paidAmount) : "",
      paymentMethod: p.paymentMethod || "cash",
      note: p.note || "",
      documentName: p.documentName || "",
      documentUrl: p.documentUrl || "",
    });
  }

  async function openEdit(p: PurchaseRow) {
    setEditing(p);
    fillFromPurchase(p);
    setFormOpen(true);
    try {
      const res = await fetch(`/api/purchases/${p._id}`);
      const json = await res.json();
      if (res.ok && json.data) fillFromPurchase(json.data);
    } catch {
      /* keep list values */
    }
  }

  function applyProductName(name: string) {
    const match = products.find(
      (p) => p.name === name || p.nameBn === name || p._id === name,
    );
    setForm((current) => ({
      ...current,
      productName: name,
      productId: match?._id || "",
      productDescription: match?.description || current.productDescription,
      categoryId: match?.categoryId ? String(match.categoryId) : current.categoryId,
      brand: match?.brand || current.brand,
      buyingPrice: match ? String(match.purchasePrice ?? "") : current.buyingPrice,
      currency: match?.currency || current.currency,
    }));
  }

  function applySupplierName(name: string) {
    const match = suppliers.find((s) => s.name === name);
    setForm((current) => ({
      ...current,
      supplierName: name,
      supplierId: match?._id || "",
      supplierAddress: match?.address || current.supplierAddress,
      supplierMobile: match?.mobile || match?.phone || current.supplierMobile,
      supplierWhatsapp: match?.supplierWhatsApp || match?.mobile || current.supplierWhatsapp,
      supplierWechat: match?.supplierWeChat || current.supplierWechat,
      supplierLocation: match?.location || current.supplierLocation,
    }));
  }

  function onDocumentPick(file: File | undefined) {
    if (!file || file.size > 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () =>
      setForm((current) => ({
        ...current,
        documentName: file.name,
        documentUrl: String(reader.result || ""),
      }));
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.productName.trim()) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      locationId: defaultLocationId || undefined,
      purchaseType: form.purchaseType,
      supplierId: form.supplierId || undefined,
      supplierName: form.supplierName.trim() || "Supplier",
      supplierWhatsapp: form.supplierWhatsapp,
      supplierWechat: form.supplierWechat,
      supplierAddress: form.supplierAddress,
      supplierMobile: form.supplierMobile,
      supplierLocation: form.supplierLocation,
      productName: form.productName.trim(),
      productDescription: form.productDescription,
      categoryId: form.categoryId || null,
      brand: form.brand,
      buyingPrice: Number(form.buyingPrice || 0),
      quantity: Number(form.quantity || 0),
      status: "received",
      purchaseDate: form.buyingDate,
      receivingDate: form.receivingDate,
      shippingCost: Number(form.shippingCost || 0),
      shippingCurrency: form.shippingCurrency,
      otherCost: Number(form.otherCost || 0),
      discount: Number(form.discount || 0),
      currency: form.currency,
      note: form.note,
      documentName: form.documentName,
      documentUrl: form.documentUrl,
      paidAmount,
      paymentMethod: form.paymentMethod,
      items: [
        {
          productId: form.productId || undefined,
          name: form.productName.trim(),
          qty: Number(form.quantity || 0),
          unitCost: Number(form.buyingPrice || 0),
        },
      ],
      payments: [{ method: form.paymentMethod, amount: paidAmount }],
    };
    if (isSuper) payload.costPrice = Number(form.costPrice || 0);

    try {
      const res = await fetch(editing ? `/api/purchases/${editing._id}` : "/api/purchases", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormOpen(false);
        setEditing(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removePurchase(id: string) {
    if (!confirm(locale === "bn" ? "মুছে ফেলবেন?" : "Delete?")) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="gp-desk">
      <PageHeader
        kicker={locale === "bn" ? "ক্রয়" : "Purchases"}
        title={t("purchases.title")}
        subtitle={locale === "bn" ? "লোকাল ও ইমপোর্ট ক্রয়" : "Local and import purchases"}
        stats={[
          { value: formatBDT(summary.grandTotal, locale).replace(/\.00$/, ""), label: t("common.total") },
          { value: formatBDT(summary.dueAmount, locale).replace(/\.00$/, ""), label: t("common.due") },
          { value: summary.count, label: locale === "bn" ? "বিল" : "bills" },
        ]}
        actions={
          <>
            <button
              type="button"
              className={`gp-btn ${formOpen && !editing && form.purchaseType === "local" ? "gp-btn-primary" : "gp-btn-ghost"}`}
              onClick={() => openCreate("local")}
            >
              Local Purchase
            </button>
            <button
              type="button"
              className={`gp-btn ${formOpen && !editing && form.purchaseType === "import" ? "gp-btn-primary" : "gp-btn-ghost"}`}
              onClick={() => openCreate("import")}
            >
              Import Purchase
            </button>
          </>
        }
      />

      <div className="dash-panel flex items-center gap-3 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          className="gp-input min-h-10 border-0 bg-transparent py-1 shadow-none focus:shadow-none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={locale === "bn" ? "সরবরাহকারী বা পণ্যের নাম খুঁজুন" : "Search by supplier or product name"}
        />
      </div>

      <div className="dash-stat-grid">
        <article className="dash-stat">
          <span>{t("common.total")}</span>
          <b>{formatBDT(summary.grandTotal, locale).replace(/\.00$/, "")}</b>
        </article>
        <article className="dash-stat dash-stat-warn">
          <span>{t("common.due")}</span>
          <b>{formatBDT(summary.dueAmount, locale).replace(/\.00$/, "")}</b>
        </article>
        <article className="dash-stat dash-stat-info">
          <span>{locale === "bn" ? "বিল" : "Bills"}</span>
          <b>{summary.count}</b>
        </article>
      </div>

      <div className="gp-table-wrap overflow-auto">
        {data.length === 0 ? (
          <EmptyState message={t("common.noData")} />
        ) : (
          <table className="gp-table min-w-[980px] table-fixed lg:w-full [&_td]:align-top [&_td]:py-2 [&_th]:py-2">
            <colgroup>
              <col className="w-10" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[22%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr>
                <th>SL</th>
                <th>{t("purchases.reference")}</th>
                <th>{t("purchases.supplier")}</th>
                <th>{locale === "bn" ? "পণ্যের নাম" : "Product Name"}</th>
                <th>{t("common.date")}</th>
                <th>{locale === "bn" ? "পরিমাণ" : "Quantity"}</th>
                <th>{t("common.grandTotal")}</th>
                <th>{t("common.due")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, index) => {
                const names = purchaseProductNames(p);
                return (
                <tr key={p._id}>
                  <td className="whitespace-nowrap">{index + 1}</td>
                  <td className="min-w-0 font-semibold">
                    <span className="block truncate" title={p.referenceNo}>{p.referenceNo}</span>
                  </td>
                  <td className="min-w-0">
                    {p.supplierId ? (
                      <Link
                        href={`/contacts/${p.supplierId}/statement`}
                        className="block truncate font-semibold text-primary hover:underline"
                        title={p.supplierName}
                      >
                        {p.supplierName}
                      </Link>
                    ) : (
                      <span className="block truncate" title={p.supplierName}>{p.supplierName}</span>
                    )}
                  </td>
                  <td className="min-w-0">
                    {names.length ? (
                      <div className="space-y-0.5">
                        {names.map((name, i) => (
                          <div key={`${p._id}-n-${i}`} className="truncate" title={name}>{name}</div>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="min-w-0 whitespace-nowrap">
                    <span className="block truncate">{formatDateBD(p.purchaseDate, locale)}</span>
                  </td>
                  <td className="min-w-0 whitespace-nowrap">{purchaseQuantity(p)}</td>
                  <td className="min-w-0 font-bold">
                    <span className="gp-money block truncate">{formatBDT(p.grandTotal, locale)}</span>
                  </td>
                  <td className="min-w-0">
                    <span className="gp-money block truncate">{formatBDT(p.dueAmount, locale)}</span>
                  </td>
                  <td className="overflow-visible">
                    <div className="flex flex-nowrap gap-1">
                      <button
                        type="button"
                        className="gp-btn gp-btn-ghost min-h-8 min-w-8 shrink-0 px-1.5"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="gp-btn gp-btn-danger min-h-8 min-w-8 shrink-0 px-1.5"
                        onClick={() => removePurchase(p._id)}
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
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? t("common.edit") : form.purchaseType === "import" ? "Import Purchase" : "Local Purchase"}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        wide
        compact
        scrollBody
      >
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-x-2 gap-y-1 md:grid-cols-2 lg:grid-cols-3 [&_.gp-input]:min-h-7 [&_.gp-input]:py-0.5"
        >
          <InlineField label="Product Name">
            <input
              className="gp-input"
              required
              list="purchase-product-names"
              value={form.productName}
              onChange={(e) => applyProductName(e.target.value)}
            />
          </InlineField>
          <InlineField label="Product Description">
            <textarea
              className="gp-input min-h-7 max-h-7 resize-none py-0.5 leading-tight"
              rows={1}
              value={form.productDescription}
              onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
            />
          </InlineField>
          <InlineField label="Category">
            <select
              className="gp-input"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {locale === "bn" && c.nameBn ? c.nameBn : c.name}
                </option>
              ))}
            </select>
          </InlineField>
          <InlineField label="Brand">
            <input
              className="gp-input"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </InlineField>
          <InlineField label="Buying Price">
            <div className="grid grid-cols-[minmax(0,1fr)_4.6rem] gap-1">
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.buyingPrice}
                onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })}
              />
              <select
                className="gp-input px-1"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="RMB">RMD</option>
              </select>
            </div>
          </InlineField>
          <InlineField label="Shipping Cost">
            <div className="grid grid-cols-[minmax(0,1fr)_4.6rem] gap-1">
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.shippingCost}
                onChange={(e) => setForm({ ...form, shippingCost: e.target.value })}
              />
              <select
                className="gp-input px-1"
                value={form.shippingCurrency}
                onChange={(e) => setForm({ ...form, shippingCurrency: e.target.value })}
              >
                <option value="RMB">RMD</option>
                <option value="USD">USD</option>
                <option value="BDT">BDT</option>
              </select>
            </div>
          </InlineField>
          <InlineField label="Quantity">
            <input
              type="number"
              min={0}
              className="gp-input"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </InlineField>
          {isSuper ? (
            <InlineField label="Cost Price">
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </InlineField>
          ) : (
            <div className="hidden lg:block" />
          )}
          <InlineField label="Buying Date">
            <input
              type="date"
              className="gp-input"
              value={form.buyingDate}
              onChange={(e) => setForm({ ...form, buyingDate: e.target.value })}
            />
          </InlineField>
          <InlineField label="Receiving Date">
            <input
              type="date"
              className="gp-input"
              value={form.receivingDate}
              onChange={(e) => setForm({ ...form, receivingDate: e.target.value })}
            />
          </InlineField>
          <InlineField label="Supplier Name">
            <input
              className="gp-input"
              list="purchase-supplier-names"
              value={form.supplierName}
              onChange={(e) => applySupplierName(e.target.value)}
            />
          </InlineField>
          <InlineField label="Supplier Address">
            <input
              className="gp-input"
              value={form.supplierAddress}
              onChange={(e) => setForm({ ...form, supplierAddress: e.target.value })}
            />
          </InlineField>
          <InlineField label="Supplier Mobile">
            <input
              className="gp-input"
              value={form.supplierMobile}
              onChange={(e) => setForm({ ...form, supplierMobile: e.target.value })}
            />
          </InlineField>
          <InlineField label="Supplier WeChat">
            <input
              className="gp-input"
              value={form.supplierWechat}
              onChange={(e) => setForm({ ...form, supplierWechat: e.target.value })}
            />
          </InlineField>
          <InlineField label="Supplier WhatsApp">
            <input
              className="gp-input"
              value={form.supplierWhatsapp}
              onChange={(e) => setForm({ ...form, supplierWhatsapp: e.target.value })}
            />
          </InlineField>
          <InlineField label="Supplier Location">
            <input
              className="gp-input"
              value={form.supplierLocation}
              onChange={(e) => setForm({ ...form, supplierLocation: e.target.value })}
            />
          </InlineField>
          <InlineField label="Other Cost">
            <input
              type="number"
              min={0}
              step="0.01"
              className="gp-input"
              value={form.otherCost}
              onChange={(e) => setForm({ ...form, otherCost: e.target.value })}
            />
          </InlineField>
          <InlineField label="Discount">
            <input
              type="number"
              min={0}
              step="0.01"
              className="gp-input"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </InlineField>
          <InlineField label="Sub Total">
            <input className="gp-input" readOnly value={subtotal.toFixed(2)} />
          </InlineField>
          <InlineField label="Grand Total">
            <input className="gp-input" readOnly value={grandTotal.toFixed(2)} />
          </InlineField>
          <InlineField label="Paid Amount">
            <input
              type="number"
              min={0}
              step="0.01"
              className="gp-input"
              value={form.paidAmount}
              placeholder={grandTotal.toFixed(2)}
              onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
            />
          </InlineField>
          <InlineField label="Due Amount">
            <input className="gp-input" readOnly value={dueAmount.toFixed(2)} />
          </InlineField>
          <InlineField label="Payment Status">
            <input className="gp-input" readOnly value={paymentStatus} />
          </InlineField>
          <InlineField label="Payment Method">
            <select
              className="gp-input"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              {["cash", "card", "bkash", "nagad", "rocket", "cheque", "bank", "credit"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </InlineField>
          <InlineField label="Invoice / Document">
            <input
              className="gp-input"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                onDocumentPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </InlineField>
          <InlineField label="Notes">
            <textarea
              className="gp-input min-h-7 max-h-7 resize-none py-0.5 leading-tight"
              rows={1}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </InlineField>
          <datalist id="purchase-product-names">
            {products.map((p) => (
              <option key={p._id} value={p.name} />
            ))}
          </datalist>
          <datalist id="purchase-supplier-names">
            {suppliers.map((s) => (
              <option key={s._id} value={s.name} />
            ))}
          </datalist>
          <div className="flex justify-end gap-2 md:col-span-2 lg:col-span-3">
            <button
              type="button"
              className="gp-btn gp-btn-ghost min-h-8 px-3"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary min-h-8 px-3" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
