"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AlertBanner, EmptyState, Field, Modal, PageHeader, TableSkeleton } from "@/components/ui";
import { DateRangeExcelBar, downloadExcelResponse } from "@/components/DateRangeExcelBar";
import { formatMoney } from "@/lib/utils";
import { displaySupplierLabel } from "@/lib/supplier-label";
import { useDebouncedValue } from "@/lib/hooks";

type SupplierOffer = {
  supplierId?: string;
  name: string;
  nameBn?: string;
  price: number;
  linkId?: string;
};

type CatalogSupplier = {
  _id: string;
  name: string;
  nameBn?: string;
};

type Product = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  brand?: string;
  categoryId?: string;
  purchasePrice?: number;
  sellPrice: number;
  currency?: string;
  alertQty?: number;
  locationQty?: number;
  imageUrl?: string;
  description?: string;
  shippingCost?: number;
  shippingCurrency?: string;
  quantity?: number;
  costPrice?: number;
  buyingDate?: string;
  receivingDate?: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierMobile?: string;
  supplierWeChat?: string;
  supplierWhatsApp?: string;
  supplierLocation?: string;
  supplierOffers?: SupplierOffer[];
};

type CatalogCategory = { _id: string; name: string; nameBn?: string };

type OfferSlot = {
  supplierId: string;
  price: string;
};

const emptyForm = {
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  purchasePrice: "",
  currency: "BDT",
  shippingCost: "",
  shippingCurrency: "BDT",
  quantity: "0",
  costPrice: "",
  buyingDate: "",
  receivingDate: "",
  supplierName: "",
  supplierAddress: "",
  supplierMobile: "",
  supplierWeChat: "",
  supplierWhatsApp: "",
  supplierLocation: "",
  imageUrl: "",
};

function toDateInput(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function InlineField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 grid-cols-[5.4rem_minmax(0,1fr)] items-center gap-1.5">
      <span className="text-[0.8125rem] font-semibold leading-tight text-[var(--gp-text-2)]">{label}</span>
      {children}
    </label>
  );
}

function relationOffers(p: Product): SupplierOffer[] {
  return (p.supplierOffers || []).filter((o) => o?.supplierId);
}

function apiErrorMessage(
  code: string | undefined,
  locale: string,
): string {
  if (code === "duplicate_sku") {
    return locale === "bn"
      ? "এই SKU ইতিমধ্যে ব্যবহার হচ্ছে — অন্য SKU দিন"
      : "This SKU already exists — use a different code";
  }
  if (code === "missing_name") {
    return locale === "bn" ? "পণ্যের নাম লিখুন" : "Product name is required";
  }
  return locale === "bn" ? "সংরক্ষণ ব্যর্থ হয়েছে" : "Could not save — please try again";
}

export default function ProductsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [catalog, setCatalog] = useState<CatalogSupplier[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slots, setSlots] = useState<OfferSlot[]>([{ supplierId: "", price: "" }]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    fetch("/api/contacts?type=supplier&limit=200")
      .then((r) => r.json())
      .then((d) => setCatalog(d.data || []))
      .catch(() => setCatalog([]));
    fetch("/api/modules/categories?limit=200")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => setCategories([]));
    fetch("/api/meta?type=profile")
      .then((r) => r.json())
      .then((d) => {
        const role = (d.data || []).find((row: { label?: string }) => row.label === "Role")?.value;
        setIsSuper(role === "admin");
      })
      .catch(() => setIsSuper(false));
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: String(pageSize), page: String(page) });
    if (debouncedQ) qs.set("q", debouncedQ);
    try {
      const res = await fetch(`/api/products?${qs}`);
      const json = await res.json();
      setProducts(json.data || []);
      setProductTotal(Number(json.total || 0));
    } catch {
      setProducts([]);
      setProductTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function fillForm(p: Product) {
    const offers = relationOffers(p);
    setEditing(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      categoryId: p.categoryId ? String(p.categoryId) : "",
      brand: p.brand || "",
      purchasePrice: String(p.purchasePrice ?? ""),
      currency: p.currency || "BDT",
      shippingCost: String(p.shippingCost ?? ""),
      shippingCurrency: p.shippingCurrency || "BDT",
      quantity: String(p.locationQty ?? p.quantity ?? 0),
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      buyingDate: toDateInput(p.buyingDate),
      receivingDate: toDateInput(p.receivingDate),
      supplierName: p.supplierName || "",
      supplierAddress: p.supplierAddress || "",
      supplierMobile: p.supplierMobile || "",
      supplierWeChat: p.supplierWeChat || "",
      supplierWhatsApp: p.supplierWhatsApp || "",
      supplierLocation: p.supplierLocation || "",
      imageUrl: p.imageUrl || "",
    });
    setSlots(
      offers.length
        ? offers.map((o) => ({
            supplierId: o.supplierId || "",
            price: String(o.price ?? ""),
          }))
        : [{ supplierId: "", price: "" }],
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setSlots([{ supplierId: "", price: "" }]);
    setModalOpen(true);
  }

  async function openEdit(p: Product) {
    fillForm(p);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/products/${p._id}`);
      const json = await res.json();
      if (res.ok && json.data) fillForm(json.data);
    } catch {
      /* keep list values */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBanner(null);

    const seen = new Set<string>();
    const supplierOffers = slots
      .filter((s) => s.supplierId)
      .map((s) => ({
        supplierId: s.supplierId,
        price: Number(s.price || 0),
      }))
      .filter((s) => {
        if (seen.has(s.supplierId)) return false;
        seen.add(s.supplierId);
        return true;
      });

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      brand: form.brand.trim(),
      purchasePrice: Number(form.purchasePrice || 0),
      currency: form.currency || "BDT",
      shippingCost: Number(form.shippingCost || 0),
      shippingCurrency: form.shippingCurrency || "BDT",
      quantity: Number(form.quantity || 0),
      buyingDate: form.buyingDate || null,
      receivingDate: form.receivingDate || null,
      supplierName: form.supplierName.trim(),
      supplierAddress: form.supplierAddress.trim(),
      supplierMobile: form.supplierMobile.trim(),
      supplierWeChat: form.supplierWeChat.trim(),
      supplierWhatsApp: form.supplierWhatsApp.trim(),
      supplierLocation: form.supplierLocation.trim(),
      imageUrl: form.imageUrl || "",
      supplierOffers,
    };

    if (isSuper) {
      payload.costPrice = Number(form.costPrice || 0);
    }

    if (!editing) {
      payload.openingQty = Number(form.quantity || 0);
    }

    try {
      const res = await fetch(
        editing ? `/api/products/${editing._id}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          tone: "error",
          message: apiErrorMessage(json.error, locale),
        });
        return;
      }
      setModalOpen(false);
      setBanner({
        tone: "success",
        message:
          locale === "bn"
            ? editing
              ? "পণ্য আপডেট হয়েছে"
              : `পণ্য যোগ হয়েছে (${json.data?.sku || ""})`
            : editing
              ? "Product updated"
              : `Product added (${json.data?.sku || ""})`,
      });
      await loadProducts();
    } catch {
      setBanner({ tone: "error", message: t("common.error") });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(locale === "bn" ? "পণ্য মুছবেন?" : "Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBanner({ tone: "error", message: t("common.error") });
      return;
    }
    setBanner({
      tone: "success",
      message: locale === "bn" ? "পণ্য মুছে ফেলা হয়েছে" : "Product deleted",
    });
    await loadProducts();
  }

  function updateSlot(index: number, patch: Partial<OfferSlot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    setSlots((prev) => [...prev, { supplierId: "", price: "" }]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      if (prev.length <= 1) return [{ supplierId: "", price: "" }];
      return prev.filter((_, i) => i !== index);
    });
  }

  function onImagePick(file: File | undefined) {
    if (!file) return;
    if (file.size > 800_000) {
      setBanner({
        tone: "error",
        message:
          locale === "bn" ? "ছবি ৮০০KB এর কম হতে হবে" : "Image must be under 800KB",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="gp-desk">
      <PageHeader
        kicker={locale === "en" ? "Stock" : "স্টক"}
        title={t("products.title")}
        subtitle={
          locale === "en"
            ? "Product list with linked supplier prices"
            : "পণ্য তালিকা — লিংকড সরবরাহকারী মূল্যসহ"
        }
        stats={[
          { value: products.length, label: locale === "bn" ? "পণ্য" : "items" },
          {
            value: products.filter((p) => Number(p.alertQty) > 0 && Number(p.locationQty ?? p.quantity ?? 0) <= Number(p.alertQty)).length,
            label: locale === "bn" ? "কম স্টক" : "low stock",
          },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeExcelBar
              onExport={async (from, to) => {
                const res = await fetch(`/api/exports/products?from=${from}&to=${to}`);
                await downloadExcelResponse(res, `products_${from}_to_${to}.xlsx`);
              }}
            />
            <Link href="/products/categories" className="gp-btn gp-btn-ghost">
              {t("nav.categories")}
            </Link>
            <button type="button" className="gp-btn gp-btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("products.add")}
            </button>
          </div>
        }
      />

      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}

      <div className="gp-card flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          className="gp-input min-h-8 border-0 bg-transparent py-1 shadow-none focus:shadow-none"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("products.searchWide")}
          aria-label={t("common.search")}
        />
        {loading && q ? (
          <span className="shrink-0 text-xs text-muted">{t("common.loading")}</span>
        ) : null}
      </div>

      {loading && !products.length ? (
        <TableSkeleton rows={8} cols={10} />
      ) : products.length === 0 ? (
        <EmptyState message={debouncedQ ? (locale === "bn" ? "কোনো পণ্য পাওয়া যায়নি" : "No products match your search") : t("common.noData")} />
      ) : (
        <div className="gp-table-wrap overflow-x-auto">
          <table className="gp-table gp-product-list min-w-[980px] lg:w-full lg:min-w-0 lg:table-fixed">
            <colgroup>
              <col className="lg:w-10" />
              <col className="lg:w-12" />
              <col className="lg:w-[11.25rem]" />
              <col className="lg:w-[8.4375rem]" />
              <col className="lg:w-[4.375rem]" />
              <col className="lg:w-[5.625rem]" />
              <col className="lg:w-[5.9375rem]" />
              <col className="lg:w-[9.0625rem]" />
              <col className="lg:w-[5.625rem]" />
              <col className="lg:w-[4.75rem]" />
            </colgroup>
            <thead>
              <tr>
                <th className="w-10">SL</th>
                <th className="w-12">Image</th>
                <th>{t("products.name")}</th>
                <th>{t("products.brand")}</th>
                <th>{locale === "bn" ? "স্টক" : "STOCK"}</th>
                <th>{locale === "bn" ? "খরচ মূল্য" : "Cost"}</th>
                <th>{locale === "bn" ? "বিক্রয় মূল্য" : "Sales price"}</th>
                <th>{t("products.supplierPrices")}</th>
                <th>{locale === "bn" ? "বিবরণ" : "Description"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60" : undefined}>
              {products.map((p, index) => {
                const title = locale === "bn" && p.nameBn ? p.nameBn : p.name;
                const offers = relationOffers(p);
                return (
                  <tr key={p._id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-7 w-7 rounded-md border border-line object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-[var(--gp-bg)]">
                          <ImageIcon className="h-3.5 w-3.5 text-muted" />
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="max-w-[13rem] truncate font-semibold text-[var(--gp-ink)]" title={title}>{title}</div>
                      {locale === "bn" && p.name && p.nameBn ? (
                        <div className="max-w-[13rem] truncate text-xs text-muted">{p.name}</div>
                      ) : null}
                    </td>
                    <td><span className="block max-w-[10rem] truncate" title={p.brand || ""}>{p.brand || "—"}</span></td>
                    <td className="gp-money whitespace-nowrap">{p.locationQty ?? 0}</td>
                    <td className="gp-money whitespace-nowrap">
                      {formatMoney(p.purchasePrice || 0, p.currency || "BDT", locale)}
                    </td>
                    <td className="gp-money whitespace-nowrap">
                      {formatMoney(p.sellPrice || 0, p.currency || "BDT", locale)}
                    </td>
                    <td>
                      {offers.length === 0 ? (
                        <span className="text-sm text-muted">{t("products.noSuppliers")}</span>
                      ) : (
                        <details>
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 whitespace-nowrap text-sm font-medium text-primary">
                            {offers.length} {locale === "bn" ? "লিংকড সরবরাহকারী" : "Linked Suppliers"}
                            <ChevronDown className="h-3.5 w-3.5" />
                          </summary>
                          <div className="mt-1 space-y-1">
                            {offers.map((offer, idx) => (
                              <Link key={offer.linkId || `${p._id}-${offer.supplierId}-${idx}`} href={`/contacts/suppliers/${offer.supplierId}`} className="flex max-w-[13rem] items-center justify-between gap-2 text-xs text-primary hover:underline">
                                <span className="truncate">{displaySupplierLabel(offer, locale)}</span>
                                <span className="gp-money shrink-0">{formatMoney(offer.price, p.currency || "BDT", locale)}</span>
                              </Link>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td><span className="block max-w-[12rem] truncate text-muted" title={p.description || ""}>{p.description || "—"}</span></td>
                    <td>
                      <div className="flex flex-nowrap gap-1">
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5 lg:min-h-7 lg:min-w-7 lg:px-1.5"
                          onClick={() => openEdit(p)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                        </button>
                        <button
                          type="button"
                          className="gp-btn gp-btn-ghost min-h-9 px-2.5 text-[var(--gp-danger)] lg:min-h-7 lg:min-w-7 lg:px-1.5"
                          onClick={() => onDelete(p._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
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

      {productTotal > pageSize ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="gp-btn gp-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((x) => Math.max(1, x - 1))}
          >
            {locale === "bn" ? "আগে" : "Previous"}
          </button>
          <span className="text-sm text-muted">
            {locale === "bn" ? "পৃষ্ঠা" : "Page"} {page} / {Math.max(1, Math.ceil(productTotal / pageSize))}
            {` · ${productTotal}`}
          </span>
          <button
            type="button"
            className="gp-btn gp-btn-ghost"
            disabled={page >= Math.ceil(productTotal / pageSize)}
            onClick={() => setPage((x) => x + 1)}
          >
            {t("pos.next")}
          </button>
        </div>
      ) : null}

      <Modal
        open={modalOpen}
        title={editing ? t("common.edit") : t("products.add")}
        onClose={() => setModalOpen(false)}
        wide
        compact
        scrollBody
      >
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-x-2 gap-y-1 md:grid-cols-2 lg:grid-cols-3 [&_.gp-input]:min-h-7 [&_.gp-input]:py-0.5"
        >
          <InlineField label={locale === "bn" ? "পণ্যের নাম" : "Product Name"}>
            <input
              className="gp-input"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "পণ্য বিবরণ" : "Product Description"}>
            <textarea
              className="gp-input min-h-7 max-h-7 resize-none py-0.5 leading-tight"
              rows={1}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "ক্যাটাগরি" : "Category"}>
            <select
              className="gp-input"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {locale === "bn" && c.nameBn ? c.nameBn : c.name}
                </option>
              ))}
            </select>
          </InlineField>
          <InlineField label={locale === "bn" ? "ব্র্যান্ড" : "Brand"}>
            <input
              className="gp-input"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "ক্রয় মূল্য" : "Buying Price"}>
            <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-1">
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.purchasePrice}
                onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
              />
              <select
                className="gp-input px-1"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="RMB">RMD</option>
              </select>
            </div>
          </InlineField>
          <InlineField label={locale === "bn" ? "শিপিং খরচ" : "Shipping Cost"}>
            <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-1">
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.shippingCost}
                onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))}
              />
              <select
                className="gp-input px-1"
                value={form.shippingCurrency}
                onChange={(e) => setForm((f) => ({ ...f, shippingCurrency: e.target.value }))}
              >
                <option value="RMB">RMD</option>
                <option value="USD">USD</option>
                <option value="BDT">BDT</option>
              </select>
            </div>
          </InlineField>
          <InlineField label={locale === "bn" ? "পরিমাণ" : "Quantity"}>
            <input
              type="number"
              min={0}
              className="gp-input"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </InlineField>
          {isSuper ? (
            <InlineField label={locale === "bn" ? "খরচ মূল্য" : "Cost Price"}>
              <input
                type="number"
                min={0}
                step="0.01"
                className="gp-input"
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              />
            </InlineField>
          ) : (
            <div className="hidden lg:block" />
          )}
          <InlineField label={locale === "bn" ? "ক্রয় তারিখ" : "Buying Date"}>
            <input
              type="date"
              className="gp-input"
              value={form.buyingDate}
              onChange={(e) => setForm((f) => ({ ...f, buyingDate: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "গ্রহণ তারিখ" : "Receiving Date"}>
            <input
              type="date"
              className="gp-input"
              value={form.receivingDate}
              onChange={(e) => setForm((f) => ({ ...f, receivingDate: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "সরবরাহকারী নাম" : "Supplier Name"}>
            <input
              className="gp-input"
              value={form.supplierName}
              onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "সরবরাহকারী ঠিকানা" : "Supplier Address"}>
            <input
              className="gp-input"
              value={form.supplierAddress}
              onChange={(e) => setForm((f) => ({ ...f, supplierAddress: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "মোবাইল" : "Supplier Mobile"}>
            <input
              className="gp-input"
              value={form.supplierMobile}
              onChange={(e) => setForm((f) => ({ ...f, supplierMobile: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "WeChat" : "Supplier WeChat"}>
            <input
              className="gp-input"
              value={form.supplierWeChat}
              onChange={(e) => setForm((f) => ({ ...f, supplierWeChat: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "WhatsApp" : "Supplier WhatsApp"}>
            <input
              className="gp-input"
              value={form.supplierWhatsApp}
              onChange={(e) => setForm((f) => ({ ...f, supplierWhatsApp: e.target.value }))}
            />
          </InlineField>
          <InlineField label={locale === "bn" ? "লোকেশন" : "Supplier Location"}>
            <input
              className="gp-input"
              value={form.supplierLocation}
              onChange={(e) => setForm((f) => ({ ...f, supplierLocation: e.target.value }))}
            />
          </InlineField>

          <div className="md:col-span-2 lg:col-span-3">
            <div className="grid min-w-0 grid-cols-[5.4rem_minmax(0,1fr)] items-center gap-1.5">
              <span className="text-[0.8125rem] font-semibold leading-tight text-[var(--gp-text-2)]">
                {locale === "bn" ? "পণ্য ছবি" : "Product image"}
              </span>
              <div className="flex items-center gap-2">
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-[var(--gp-bg)] text-[0.75rem] text-[var(--gp-text-muted)]">
                    {locale === "bn" ? "নেই" : "None"}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="gp-input min-w-0 flex-1"
                  onChange={(e) => {
                    onImagePick(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {form.imageUrl ? (
                  <button
                    type="button"
                    className="gp-btn gp-btn-ghost min-h-7 px-2 text-xs text-danger"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  >
                    {locale === "bn" ? "সরান" : "Remove"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.8125rem] font-semibold text-[var(--gp-text-2)]">{t("products.supplierPrices")}</p>
              <button
                type="button"
                className="gp-btn gp-btn-primary min-h-7 px-2.5 text-xs"
                onClick={addSlot}
              >
                <Plus className="h-3.5 w-3.5" />
                {locale === "bn" ? "সরবরাহকারী রেট" : "Supplier rate"}
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {slots.map((slot, n) => (
                <div
                  key={n}
                  className="rounded-lg border border-line bg-[var(--gp-bg)] px-2 py-1.5"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[0.8125rem] font-semibold text-[var(--gp-text-2)]">
                      {locale === "bn" ? `সরবরাহকারী ${n + 1}` : `Supplier ${n + 1}`}
                    </span>
                    <button
                      type="button"
                      className="gp-btn gp-btn-ghost min-h-7 px-1.5 text-danger"
                      title={t("common.delete")}
                      onClick={() => removeSlot(n)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label={t("contacts.suppliers")} className="space-y-0.5">
                      <select
                        className="gp-input"
                        value={slot.supplierId}
                        onChange={(e) => updateSlot(n, { supplierId: e.target.value })}
                      >
                        <option value="">{t("products.selectSupplier")}</option>
                        {catalog.map((s) => (
                          <option key={s._id} value={s._id}>
                            {displaySupplierLabel(s, locale)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={`${t("products.price")} (${form.currency || "BDT"})`}
                      className="space-y-0.5"
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="gp-input"
                        value={slot.price}
                        onChange={(e) => updateSlot(n, { price: e.target.value })}
                        disabled={!slot.supplierId}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 md:col-span-2 lg:col-span-3">
            <button
              type="button"
              className="gp-btn gp-btn-ghost min-h-8 px-3"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary min-h-8 px-3" disabled={busy}>
              {busy ? t("app.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
