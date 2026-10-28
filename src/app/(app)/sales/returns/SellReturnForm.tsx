"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  CalendarDays, FileText, Grid2X2, ImageIcon, MapPin, PackagePlus, Plus,
  Search, Trash2, UserPlus, X,
} from "lucide-react";
import { Field, Modal } from "@/components/ui";
import { calendarDateDhaka, formatBDT } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";
import { DEFAULT_DOCUMENT_BODY } from "@/lib/default-document-body";

type Product = {
  _id: string; name: string; nameBn?: string; sku: string; sellPrice: number;
  unit?: string; locationQty?: number; imageUrl?: string; description?: string;
  brand?: string; categoryId?: string;
};
type Customer = { _id: string; name: string; nameBn?: string; mobile?: string; address?: string; email?: string };
type Named = { _id: string; name: string; nameBn?: string };
type CartItem = Product & { qty: number; saleDescription: string; lineDiscount: number };
type PayRow = { id: string; method: string; amount: number };
type ChallanHit = {
  _id: string; shipmentNo?: string; saleId?: string; customerName?: string;
  invoiceNo?: string; referenceNo?: string; items?: { name?: string; sku?: string; qty?: number; description?: string }[];
};

const METHODS = ["cash", "card", "bank", "bkash", "nagad", "rocket", "cheque", "credit"] as const;
const today = () => calendarDateDhaka();
function nextPayId(rows: { id: string }[]) {
  const max = rows.reduce((m, r) => {
    const n = Number(String(r.id).replace(/^pay-/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, -1);
  return `pay-${max + 1}`;
}
function payRow(id = "pay-0"): PayRow {
  return { id, method: "cash", amount: 0 };
}

export function SellReturnForm({ editId }: { editId?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [locationId, setLocationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [attention, setAttention] = useState("");
  const [attentionMenu, setAttentionMenu] = useState(false);
  const [returnDate, setReturnDate] = useState(today);
  const [challanNo, setChallanNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [sourceSaleId, setSourceSaleId] = useState("");
  const [challanQuery, setChallanQuery] = useState("");
  const [challanMenu, setChallanMenu] = useState(false);
  const [challanHits, setChallanHits] = useState<ChallanHit[]>([]);
  const [brandName, setBrandName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [productResultsOpen, setProductResultsOpen] = useState(false);
  const query = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [documentBody, setDocumentBody] = useState(DEFAULT_DOCUMENT_BODY);
  const [savedTerms, setSavedTerms] = useState<string[]>([]);
  const [savedTermQuery, setSavedTermQuery] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [payRows, setPayRows] = useState<PayRow[]>([payRow()]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [customerMenu, setCustomerMenu] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", mobile: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/meta").then((r) => r.json()),
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/modules/categories?limit=200").then((r) => r.json()),
      fetch("/api/modules/brands?limit=200").then((r) => r.json()),
      fetch("/api/sales?status=quotation&limit=100").then((r) => r.json()),
    ]).then(([m, c, cat, b, quotations]) => {
      setLocationId(String(m.locations?.[0]?._id || ""));
      setCustomers(c.data || []); setCategories(cat.data || []); setBrands(b.data || []);
      setSavedTerms(
        [...new Set<string>(
          (quotations.data || []).flatMap((quotation: { terms?: string }) =>
            String(quotation.terms || "").split("\n").map((line) => line.replace(/^[-•◆]\s*/, "").trim()).filter(Boolean),
          ),
        )],
      );
    }).catch(() => setMessage("Failed to load catalogs"));
  }, []);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/modules/sell-returns/${editId}`)
      .then((r) => r.json())
      .then((json) => {
        const row = json.data;
        if (!row) return;
        setSourceSaleId(String(row.saleId || ""));
        setCustomerId(String(row.customerId || ""));
        setCustomerName(row.customerName || "");
        setCustomerQuery(row.customerName || "");
        setCustomerMobile(row.customerMobile || "");
        setCustomerAddress(row.customerAddress || "");
        setCustomerEmail(row.customerEmail || "");
        setAttention(row.attention || "");
        setReturnDate(String(row.returnDate || "").slice(0, 10) || today());
        setChallanNo(row.challanNo || "");
        setChallanQuery(row.challanNo || "");
        setReferenceNo(row.referenceNo || "");
        setInvoiceNo(row.invoiceNo || "");
        setNote(row.terms || row.note || "");
        setDocumentBody(row.documentBody != null ? String(row.documentBody) : DEFAULT_DOCUMENT_BODY);
        setCart((row.items || []).map((i: Record<string, unknown>, idx: number) => ({
          _id: String(i.productId || `ret-${idx}`),
          name: String(i.name || ""),
          sku: String(i.sku || ""),
          sellPrice: Number(i.unitPrice || 0),
          unit: "Pcs",
          qty: Number(i.qty || 1),
          saleDescription: String(i.description || ""),
          lineDiscount: Number(i.discount || 0),
        })));
        setDiscountValue(Number(row.discount || 0));
        setDiscountType("fixed");
        const pays = Array.isArray(row.payments) ? row.payments : [];
        setPayRows(pays.length
          ? pays.map((p: Record<string, unknown>, i: number) => ({
              id: `pay-${i}`,
              method: String(p.method || "cash"),
              amount: Number(p.amount || 0),
            }))
          : Number(row.paidAmount || 0) > 0
            ? [{ ...payRow("pay-0"), amount: Number(row.paidAmount) }]
            : [payRow()]);
      })
      .catch(() => setMessage("Failed to load sell return"));
  }, [editId]);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ limit: "200" });
    if (query) qs.set("q", query);
    if (locationId) qs.set("locationId", locationId);
    if (categoryId) qs.set("categoryId", categoryId);
    fetch(`/api/products?${qs}`).then((r) => r.json()).then((json) => {
      if (active) setProducts(json.data || []);
    }).catch(() => { if (active) setProducts([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, locationId, categoryId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((p) => {
      if (brandName && p.brand !== brandName) return false;
      if (!needle) return true;
      return [p.name, p.nameBn, p.sku, p.brand].some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [products, search, brandName]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const visible = filtered.slice((page - 1) * 20, page * 20);

  const customerMatches = customers.filter((c) =>
    [c.name, c.nameBn, c.mobile].some((v) => (v || "").toLowerCase().includes(customerQuery.toLowerCase())),
  ).slice(0, 8);
  const attentionMatches = customers.filter((c) =>
    [c.name, c.nameBn, c.mobile].some((v) => (v || "").toLowerCase().includes(attention.toLowerCase())),
  ).slice(0, 8);

  const subtotal = cart.reduce((sum, i) => sum + i.qty * i.sellPrice, 0);
  const lineDiscount = cart.reduce((sum, i) => sum + Math.min(i.lineDiscount, i.qty * i.sellPrice), 0);
  const discountBase = Math.max(0, subtotal - lineDiscount);
  const orderDiscount = Math.min(
    discountBase,
    discountType === "percentage" ? discountBase * Math.min(100, discountValue) / 100 : discountValue,
  );
  const totalDiscount = lineDiscount + orderDiscount;
  const grandTotal = Math.max(0, subtotal - totalDiscount);
  const paid = payRows.reduce((sum, p) => p.method === "credit" ? sum : sum + Math.max(0, p.amount), 0);
  const due = Math.max(0, grandTotal - paid);

  function chooseCustomer(c: Customer) {
    const displayName = locale === "bn" && c.nameBn ? c.nameBn : c.name;
    setCustomerId(c._id); setCustomerName(displayName); setCustomerQuery(displayName);
    setCustomerMobile(c.mobile || ""); setCustomerAddress(c.address || "");
    setCustomerEmail(c.email || ""); setCustomerMenu(false);
  }
  function addProduct(p: Product) {
    setCart((old) => {
      const found = old.find((x) => x._id === p._id);
      return found
        ? old.map((x) => x._id === p._id ? { ...x, qty: x.qty + 1 } : x)
        : [...old, { ...p, qty: 1, saleDescription: p.description || "", lineDiscount: 0 }];
    });
    setProductResultsOpen(false);
  }
  function updateItem(id: string, patch: Partial<CartItem>) {
    setCart((old) => old.map((x) => x._id === id ? { ...x, ...patch } : x));
  }

  function applySale(sale: Record<string, unknown>, shipmentNo?: string) {
    setSourceSaleId(String(sale._id || ""));
    setCustomerId(String(sale.customerId || ""));
    setCustomerName(String(sale.customerName || ""));
    setCustomerQuery(String(sale.customerName || ""));
    setCustomerMobile(String(sale.customerMobile || ""));
    setCustomerAddress(String(sale.customerAddress || ""));
    setCustomerEmail(String(sale.customerEmail || ""));
    setAttention(String(sale.attention || ""));
    setReturnDate(String(sale.saleDate || "").slice(0, 10) || today());
    setChallanNo(String(shipmentNo || sale.challanNo || ""));
    setReferenceNo(String(sale.referenceNo || ""));
    setInvoiceNo(String(sale.invoiceNo || ""));
    setNote(String(sale.terms || sale.note || ""));
    setDocumentBody(sale.documentBody != null ? String(sale.documentBody) : DEFAULT_DOCUMENT_BODY);
    setCart((Array.isArray(sale.items) ? sale.items : []).map((i: Record<string, unknown>, idx: number) => ({
      _id: String(i.productId || `${sale._id}-${idx}`),
      name: String(i.name || ""),
      sku: String(i.sku || ""),
      sellPrice: Number(i.unitPrice || 0),
      unit: String(i.unit || "Pcs"),
      imageUrl: String(i.imageUrl || ""),
      qty: Number(i.qty || 1),
      saleDescription: String(i.description || ""),
      lineDiscount: Number(i.discount || 0),
    })));
    setDiscountValue(Number(sale.discount || 0));
    setDiscountType("fixed");
    const pays = Array.isArray(sale.payments) ? sale.payments : [];
    setPayRows(pays.length
      ? pays.map((p: Record<string, unknown>, i: number) => ({ id: `pay-${i}`, method: String(p.method || "cash"), amount: Number(p.amount || 0) }))
      : [payRow()]);
  }

  async function searchChallans(needle: string) {
    const q = needle.trim();
    if (!q) { setChallanHits([]); return; }
    try {
      const json = await fetch(`/api/modules/shipments?limit=50&q=${encodeURIComponent(q)}`).then((r) => r.json());
      const rows = Array.isArray(json.data) ? json.data as ChallanHit[] : [];
      setChallanHits(rows.filter((row) => String(row.shipmentNo || "").toLowerCase().includes(q.toLowerCase())).slice(0, 8));
      setChallanMenu(true);
    } catch { setChallanHits([]); }
  }

  async function chooseChallan(hit: ChallanHit) {
    setChallanQuery(hit.shipmentNo || "");
    setChallanNo(hit.shipmentNo || "");
    setChallanMenu(false);
    try {
      if (hit.saleId) {
        const json = await fetch(`/api/sales/${hit.saleId}`).then((r) => r.json());
        if (json.data) {
          applySale(json.data, hit.shipmentNo);
          setMessage(`Loaded challan ${hit.shipmentNo}`);
          return;
        }
      }
      setCustomerName(hit.customerName || "");
      setCustomerQuery(hit.customerName || "");
      setReferenceNo(hit.referenceNo || "");
      setInvoiceNo(hit.invoiceNo || "");
      setCart((hit.items || []).map((i, idx) => ({
        _id: `ship-${hit._id}-${idx}`,
        name: i.name || "",
        sku: i.sku || "",
        sellPrice: 0,
        unit: "Pcs",
        qty: Number(i.qty || 1),
        saleDescription: i.description || "",
        lineDiscount: 0,
      })));
      setMessage(`Loaded challan ${hit.shipmentNo}`);
    } catch { setMessage("Failed to load challan"); }
  }

  async function save() {
    if (!cart.length) return setMessage("Order items are required");
    setBusy(true); setMessage("");
    const payload = {
      saleId: sourceSaleId || undefined,
      locationId: locationId || undefined,
      customerId: customerId || undefined,
      customerName: customerName.trim() || "Walk-in Customer",
      customerMobile, customerAddress, customerEmail, attention,
      challanNo, referenceNo, invoiceNo, terms: note, documentBody, note,
      returnDate, discount: totalDiscount, grandTotal, paidAmount: paid, dueAmount: due,
      status: "Returned",
      payments: payRows.filter((p) => p.amount > 0).map(({ method, amount }) => ({ method, amount })),
      items: cart.map((i) => ({
        productId: i._id.startsWith("ship-") || i._id.startsWith("ret-") ? undefined : i._id,
        name: i.name, sku: i.sku, description: i.saleDescription, qty: i.qty,
        unitPrice: i.sellPrice, discount: Math.min(i.lineDiscount, i.qty * i.sellPrice),
        lineTotal: Math.max(0, i.qty * i.sellPrice - i.lineDiscount),
      })),
    };
    try {
      const res = await fetch(editId ? `/api/modules/sell-returns/${editId}` : "/api/modules/sell-returns", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      router.push("/sales/returns");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  }

  async function addCustomer() {
    if (!newCust.name.trim() || !newCust.mobile.trim()) return;
    try {
      const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "customer", ...newCust }) });
      const json = await res.json(); if (!res.ok) throw new Error();
      setCustomers((old) => [json.data, ...old]); chooseCustomer(json.data);
      setCustOpen(false); setNewCust({ name: "", mobile: "" });
    } catch { setMessage("Failed to save customer"); }
  }

  return (
    <div className="pos-page pos-quote gp-desk">
      <section className="gp-card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xl font-bold text-[var(--gp-ink)]">
            <span className="rounded-lg bg-[var(--gp-primary)] p-1.5 text-white"><FileText className="h-5 w-5" /></span>
            Challan
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="gp-input gp-input-icon-left h-9 text-sm font-normal"
                value={challanQuery}
                placeholder="Search by challan number"
                onFocus={() => { if (challanHits.length) setChallanMenu(true); }}
                onChange={(e) => { const value = e.target.value; setChallanQuery(value); void searchChallans(value); }}
                onKeyDown={(e) => { if (e.key === "Enter" && challanHits[0]) { e.preventDefault(); void chooseChallan(challanHits[0]); } }}
              />
              {challanMenu && challanHits.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white p-1 text-left text-sm font-normal shadow-xl">
                  {challanHits.map((hit) => (
                    <button key={hit._id} type="button" onClick={() => void chooseChallan(hit)} className="block w-full rounded-md px-3 py-2 text-left hover:bg-[var(--gp-primary-soft)]">
                      {hit.shipmentNo}<span className="ml-2 text-muted">{hit.customerName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button className="gp-btn gp-btn-primary" type="button" onClick={() => {
            if (editId) { router.push("/sales/returns/add"); return; }
            setCart([]); setCustomerId(""); setCustomerQuery(""); setCustomerName("");
            setCustomerMobile(""); setCustomerAddress(""); setCustomerEmail(""); setAttention("");
            setChallanNo(""); setChallanQuery(""); setChallanHits([]); setChallanMenu(false);
            setReferenceNo(""); setInvoiceNo(""); setSourceSaleId(""); setReturnDate(today());
            setNote(""); setDocumentBody(DEFAULT_DOCUMENT_BODY); setDiscountValue(0); setPayRows([payRow()]);
            setMessage(""); setSearch(""); setBrandName(""); setCategoryId(""); setProductResultsOpen(false);
          }}><Plus className="h-4 w-4" />New Order</button>
        </header>

        <div className="space-y-1.5 p-1.5">
          <div className="rounded-xl border border-line bg-[#fbfdff] p-1">
            <div className="grid grid-cols-1 items-center gap-x-2 gap-y-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(11.5rem,0.7fr)_minmax(12.5rem,0.85fr)_minmax(10rem,0.7fr)]">
              <Field label="Customer Name" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                <div className="relative min-w-0 flex-1">
                  <div className="flex gap-1"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="gp-input gp-input-icon-left" value={customerQuery} placeholder="Search by name, code or mobile..."
                    onFocus={() => setCustomerMenu(true)}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerName(e.target.value); setCustomerId(""); setCustomerMenu(true); }} /></div><button type="button" className="gp-btn gp-btn-primary shrink-0 px-2" onClick={() => setCustOpen(true)} aria-label="Add customer"><UserPlus className="h-4 w-4" /></button></div>
                  {customerMenu && customerQuery && customerMatches.length > 0 && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white p-1 shadow-xl">
                      {customerMatches.map((c) => <button key={c._id} type="button" onClick={() => chooseCustomer(c)} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--gp-primary-soft)]">{c.name}<span className="ml-2 text-muted">{c.mobile}</span></button>)}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Date" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><div className="relative min-w-0 flex-1"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input type="date" className="gp-input gp-input-icon-left" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div></Field>
              <Field label="Challan No" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1" value={challanNo} onChange={(e) => setChallanNo(e.target.value.toUpperCase())} placeholder="From selected challan" /></Field>
              <Field label="REF No" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value.toUpperCase())} placeholder="From selected challan" /></Field>
            </div>
            <div className="mt-0.5 grid grid-cols-1 items-center gap-x-2 gap-y-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(11.5rem,0.72fr)]">
              <Field label="Address" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><div className="relative min-w-0 flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="gp-input gp-input-icon-left" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address" /></div></Field>
              <Field label="Attention" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="gp-input gp-input-icon-left" value={attention} placeholder="Search / select name" onFocus={() => setAttentionMenu(true)} onChange={(e) => { setAttention(e.target.value); setAttentionMenu(true); }} />
                  {attentionMenu && attentionMatches.length > 0 && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white p-1 shadow-xl">
                      {attentionMatches.map((c) => (
                        <button key={`att-${c._id}`} type="button" onClick={() => { setAttention(locale === "bn" && c.nameBn ? c.nameBn : c.name); setAttentionMenu(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--gp-primary-soft)]">
                          {c.name}<span className="ml-2 text-muted">{c.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Contact No" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Contact No" /></Field>
            </div>
          </div>

          <section className="rounded-xl border border-line p-1.5">
            <div className="mb-1 grid grid-cols-1 items-center gap-1.5 md:grid-cols-2 lg:grid-cols-[auto_minmax(0,1fr)_minmax(9.5rem,0.38fr)_minmax(10rem,0.38fr)]">
              <h2 className="m-0 flex shrink-0 items-center gap-2 text-sm font-bold"><PackagePlus className="h-4 w-4 text-primary" />Order Items</h2>
              <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="gp-input gp-input-icon-left" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setProductResultsOpen(Boolean(e.target.value.trim() || brandName || categoryId)); }} placeholder="Search product by name, SKU, category or brand..." /></div>
              <select aria-label="Brand filter" className="gp-input min-w-0" value={brandName} onChange={(e) => { setBrandName(e.target.value); setPage(1); setProductResultsOpen(Boolean(e.target.value || search.trim() || categoryId)); }}><option value="">All Brands</option>{brands.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</select>
              <select aria-label="Category filter" className="gp-input min-w-0" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); setProductResultsOpen(Boolean(e.target.value || search.trim() || brandName)); }}><option value="">All Categories</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
            </div>
            {productResultsOpen && (loading && !visible.length ? <p className="py-6 text-center text-muted">Loading products...</p> : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {visible.map((p) => (
                  <button key={p._id} type="button" onClick={() => addProduct(p)} className="group rounded-xl border border-line bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--gp-primary)] hover:shadow-md">
                    <div className="flex min-h-28 items-stretch gap-2">
                      <div className="flex w-1/2 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.name} className="aspect-square h-full max-h-32 w-full object-contain" />
                        ) : <ImageIcon className="h-8 w-8 text-slate-300" />}
                      </div>
                      <div className="flex min-w-0 w-1/2 flex-col justify-center py-1">
                        <p className="line-clamp-2 font-semibold leading-snug">{locale === "bn" && p.nameBn ? p.nameBn : p.name}</p>
                        <p className="gp-money mt-1.5 font-bold text-primary">{formatBDT(p.sellPrice, locale)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {productResultsOpen && pages > 1 && <div className="mt-2 flex items-center justify-center gap-2"><button type="button" className="gp-btn gp-btn-ghost" disabled={page === 1} onClick={() => setPage((x) => x - 1)}>Previous</button><span className="text-sm text-muted">Page {page} of {pages}</span><button type="button" className="gp-btn gp-btn-ghost" disabled={page === pages} onClick={() => setPage((x) => x + 1)}>Next</button></div>}
          </section>

          {cart.length > 0 && <div className="overflow-x-auto rounded-xl border border-line">
            <table className="gp-table pos-quote-items">
              <thead><tr><th>SL</th><th>SKU</th><th>Name</th><th>Description</th><th>QTY</th><th>Price</th><th>Discount</th><th>Total</th><th /></tr></thead>
              <tbody>{cart.map((i, index) => {
                const lineTotal = Math.max(0, i.qty * i.sellPrice - i.lineDiscount);
                return (
                  <tr key={`${i._id}-${index}`}>
                    <td>{index + 1}</td>
                    <td className="min-w-0"><input className="gp-input w-full min-w-0" value={i.sku} onChange={(e) => updateItem(i._id, { sku: e.target.value })} /></td>
                    <td className="min-w-0"><input className="gp-input w-full min-w-0" value={i.name} onChange={(e) => updateItem(i._id, { name: e.target.value })} /></td>
                    <td className="min-w-0"><textarea className="gp-input pos-quote-desc w-full min-w-0" rows={1} value={i.saleDescription} onChange={(e) => updateItem(i._id, { saleDescription: e.target.value })} /></td>
                    <td><input type="number" min={1} className="gp-input w-full min-w-0" value={i.qty} onChange={(e) => updateItem(i._id, { qty: Math.max(1, Number(e.target.value) || 1) })} /></td>
                    <td><input type="number" min={0} className="gp-input w-full min-w-0" value={i.sellPrice} onChange={(e) => updateItem(i._id, { sellPrice: Math.max(0, Number(e.target.value)) })} /></td>
                    <td><input type="number" min={0} className="gp-input w-full min-w-0" value={i.lineDiscount} onChange={(e) => updateItem(i._id, { lineDiscount: Math.max(0, Number(e.target.value)) })} /></td>
                    <td className="gp-money font-bold">{formatBDT(lineTotal, locale)}</td>
                    <td><button type="button" className="p-1 text-red-500" onClick={() => setCart((old) => old.filter((x) => x._id !== i._id))}><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>}

          <div className="grid grid-cols-1 items-stretch gap-1.5 lg:grid-cols-2">
            <section className="rounded-xl border border-line p-1.5">
              <div className="mb-1 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <h2 className="m-0 flex shrink-0 items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />Terms and Condition</h2>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="gp-input gp-input-icon-left" list="sr-saved-terms" value={savedTermQuery} onChange={(e) => {
                    const value = e.target.value; setSavedTermQuery(value);
                    const selected = savedTerms.find((term) => term === value); if (!selected) return;
                    setNote((current) => current.includes(selected) ? current : (current.trim() ? `${current}\n${selected}` : selected));
                    setSavedTermQuery("");
                  }} placeholder="Search saved terms or write directly below..." />
                  <datalist id="sr-saved-terms">{savedTerms.map((term) => <option key={term} value={term} />)}</datalist>
                </div>
              </div>
              <textarea className="gp-input min-h-14 resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter notes, delivery instructions, or terms and conditions..." />
            </section>
            <section className="rounded-xl border border-line p-1.5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />Sell Return Description</h2>
              <textarea className="gp-input min-h-14 resize-y" value={documentBody} onChange={(e) => setDocumentBody(e.target.value)} />
            </section>
          </div>

          <div className="grid items-stretch gap-1.5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(10.75rem,0.38fr)]">
            <section className="rounded-xl border border-line p-1.5">
              <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setPayRows((old) => [...old, payRow(nextPayId(old))])}><Plus className="h-4 w-4" />Add Payment</button>
              <div className="mt-1.5 space-y-1.5">{payRows.map((p) => <div key={p.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><select className="gp-input" value={p.method} onChange={(e) => setPayRows((old) => old.map((x) => x.id === p.id ? { ...x, method: e.target.value } : x))}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select><input type="number" min={0} className="gp-input" value={p.amount || ""} placeholder="Amount" onChange={(e) => setPayRows((old) => old.map((x) => x.id === p.id ? { ...x, amount: Math.max(0, Number(e.target.value)) } : x))} /><button type="button" className="p-2 text-red-500" disabled={payRows.length === 1} onClick={() => setPayRows((old) => old.filter((x) => x.id !== p.id))}><X className="h-4 w-4" /></button></div>)}</div>
            </section>
            <section className="rounded-xl border border-line bg-[#fbfdff] p-1.5">
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-bold"><Grid2X2 className="h-4 w-4 text-primary" />Sell Return Summary</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><b className="gp-money">{formatBDT(subtotal, locale)}</b></div>
                <div className="grid grid-cols-[1fr_150px] items-center gap-2"><span>Total Discount</span><div className="flex"><input type="number" min={0} className="gp-input rounded-r-none" value={discountValue} onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))} /><select className="gp-input w-16 rounded-l-none px-1" value={discountType} onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}><option value="percentage">%</option><option value="fixed">৳</option></select></div></div>
                <div className="flex justify-between text-xs text-muted"><span>Including line discounts</span><span>{formatBDT(totalDiscount, locale)}</span></div>
                <div className="flex justify-between rounded-lg border border-line bg-white p-1.5 text-lg"><b>Grand Total</b><b className="gp-money text-primary">{formatBDT(grandTotal, locale)}</b></div>
                <div className="flex justify-between px-2 text-base"><b>Due Amount</b><b className="gp-money text-red-500">{formatBDT(due, locale)}</b></div>
              </div>
            </section>
            <div className="flex flex-col justify-center gap-2 md:col-span-2 lg:col-span-1">
              <button type="button" className="gp-btn gp-btn-primary w-full" disabled={busy || !cart.length} onClick={() => void save()}>{busy ? "Saving..." : "Save Sell Return"}</button>
            </div>
          </div>
        </div>
      </section>
      {message && <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-primary">{message}</p>}
      <Modal open={custOpen} title="Import Customer" onClose={() => setCustOpen(false)}>
        <div className="grid gap-3"><Field label="Customer Name"><input className="gp-input" value={newCust.name} onChange={(e) => setNewCust((x) => ({ ...x, name: e.target.value }))} /></Field><Field label="Contact No"><input className="gp-input" value={newCust.mobile} onChange={(e) => setNewCust((x) => ({ ...x, mobile: e.target.value }))} /></Field><div className="flex justify-end gap-2"><button type="button" className="gp-btn gp-btn-ghost" onClick={() => setCustOpen(false)}>Cancel</button><button type="button" className="gp-btn gp-btn-primary" onClick={() => void addCustomer()}><UserPlus className="h-4 w-4" />Save Customer</button></div></div>
      </Modal>
    </div>
  );
}
