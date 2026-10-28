"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays, FileCheck, FileText, Grid2X2, ImageIcon, MapPin, PackagePlus, Plus,
  Search, ScrollText, Trash2, Upload, UserPlus, X,
} from "lucide-react";
import { Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatBDT } from "@/lib/utils";
import { roundMoney } from "@/lib/sale-finance";
import { useDebouncedValue } from "@/lib/hooks";
import { DEFAULT_DOCUMENT_BODY, DEFAULT_PROPOSAL_BODY, withQuotationCompanyName } from "@/lib/default-document-body";
import { OrderPipelineBar } from "@/components/OrderPipelineBar";
import { extractImageUrls } from "@/components/NesTradeDocument";

type Product = {
  _id: string; name: string; nameBn?: string; sku: string; sellPrice: number;
  unit?: string; locationQty?: number; imageUrl?: string; description?: string;
  brand?: string; categoryId?: string;
};
type Customer = {
  _id: string; name: string; nameBn?: string; mobile?: string; address?: string;
  email?: string; bin?: string;
};
type Named = { _id: string; name: string; nameBn?: string };
type CartItem = Product & {
  qty: number; bonusQty: number; saleDescription: string; lineDiscount: number;
};
type PayRow = { id: string; method: string; amount: number };

const PAGE_SIZE = 20;
const METHODS = ["cash", "card", "bank", "bkash", "nagad", "rocket", "cheque", "credit"] as const;
const today = () => calendarDateDhaka();
function nextPayId(rows: PayRow[]) {
  const max = rows.reduce((m, r) => {
    const n = Number(String(r.id).replace(/^pay-/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, -1);
  return `pay-${max + 1}`;
}
function payRow(id = "pay-0"): PayRow {
  return { id, method: "cash", amount: 0 };
}

function money(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return 0;
  const v = Number(cleaned);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function isMongoId(id: string) {
  return /^[a-f0-9]{24}$/i.test(id);
}

function AmountInput({
  value,
  onValue,
  className,
  min,
  max,
  placeholder = "0.00",
}: {
  value: number;
  onValue: (n: number) => void;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => {
    if (focused) return;
    setText(value ? String(value) : "");
  }, [value, focused]);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={focused ? text : (value ? String(value) : "")}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setText(value ? String(value) : "");
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        let n = parseAmount(raw);
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        onValue(n);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

function PosPageInner() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const entryMode = searchParams.get("mode");
  const isChallanEntry = entryMode === "challan";
  const isBillEntry = entryMode === "bill";
  const isReturnEntry = entryMode === "return";
  const isProposalEntry = entryMode === "proposal";
  const isQuotationEntry = entryMode === "quotation";
  const isNewOrderFlow = !isChallanEntry && !isBillEntry && !isReturnEntry;
  const isOrderEntry = isNewOrderFlow && !isQuotationEntry && !isProposalEntry;
  const useDesk = isQuotationEntry || isOrderEntry;
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
  const [saleDate, setSaleDate] = useState(today);
  const [quotationNo, setQuotationNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [sourceQuotationId, setSourceQuotationId] = useState("");
  const [sourceSaleId, setSourceSaleId] = useState("");
  const [challanQuery, setChallanQuery] = useState("");
  const [challanMenu, setChallanMenu] = useState(false);
  type ChallanHit = { _id: string; shipmentNo?: string; saleId?: string; customerName?: string; invoiceNo?: string; referenceNo?: string };
  const [challanHits, setChallanHits] = useState<ChallanHit[]>([]);
  const [brandName, setBrandName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [productResultsOpen, setProductResultsOpen] = useState(false);
  const query = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [documentBody, setDocumentBody] = useState(
    isProposalEntry ? DEFAULT_PROPOSAL_BODY : DEFAULT_DOCUMENT_BODY,
  );
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
  const [newCust, setNewCust] = useState({
    name: "",
    nameBn: "",
    contactPerson: "",
    mobile: "",
    phone: "",
    whatsapp: "",
    email: "",
    location: "",
    city: "",
    address: "",
    notes: "",
  });
  const productsRef = useRef<Product[]>([]);
  const quotationNumberPending = useRef(false);
  const referenceNumberPending = useRef(false);
  const reservedQuotationNo = useRef("");
  const [currency, setCurrency] = useState<"USD" | "BDT">("USD");
  const [subject, setSubject] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlTargetId, setUrlTargetId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => {
    Promise.all([
      fetch("/api/meta").then((r) => r.json()),
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/modules/categories?limit=200").then((r) => r.json()),
      fetch("/api/modules/brands?limit=200").then((r) => r.json()),
      fetch("/api/sales?status=quotation&limit=200").then((r) => r.json()),
    ]).then(([m, c, cat, b, quotations]) => {
      setLocationId(String(m.locations?.[0]?._id || ""));
      setCustomers(c.data || []); setCategories(cat.data || []); setBrands(b.data || []);
      setSavedTerms(
        [...new Set<string>(
          (quotations.data || []).flatMap((quotation: { terms?: string }) =>
            String(quotation.terms || "")
              .split("\n")
              .map((line) => line.replace(/^[-•◆]\s*/, "").trim())
              .filter(Boolean),
          ),
        )],
      );
    }).catch(() => setMessage(t("common.error")));
  }, [t]);

  const loadProducts = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: "500" });
      if (query) qs.set("q", query);
      if (locationId) qs.set("locationId", locationId);
      if (categoryId) qs.set("categoryId", categoryId);
      const json = await fetch(`/api/products?${qs}`).then((r) => r.json());
      setProducts(json.data || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  }, [query, locationId, categoryId]);
  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ limit: "500" });
    if (query) qs.set("q", query);
    if (locationId) qs.set("locationId", locationId);
    if (categoryId) qs.set("categoryId", categoryId);
    fetch(`/api/products?${qs}`).then((r) => r.json()).then((json) => {
      if (active) setProducts(json.data || []);
    }).catch(() => {
      if (active) setProducts([]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [query, locationId, categoryId]);

  const filtered = useMemo(() => products.filter((p) => {
    const needle = query.trim().toLowerCase();
    const category = categories.find((c) => c._id === p.categoryId)?.name || "";
    const matchesText = !needle || [p.name, p.nameBn, p.sku, p.brand, category]
      .some((v) => (v || "").toLowerCase().includes(needle));
    return matchesText && (!brandName || p.brand === brandName);
  }), [products, query, brandName, categories]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const customerMatches = customers.filter((c) =>
    [c.name, c.nameBn, c.mobile, c.bin].some((v) => (v || "").toLowerCase().includes(customerQuery.toLowerCase())),
  ).slice(0, 8);
  const attentionMatches = customers.filter((c) =>
    [c.name, c.nameBn, c.mobile].some((v) => (v || "").toLowerCase().includes(attention.toLowerCase())),
  ).slice(0, 8);

  const subtotal = roundMoney(cart.reduce((sum, i) => sum + money(i.qty) * money(i.sellPrice), 0));
  const lineDiscount = roundMoney(
    cart.reduce((sum, i) => sum + Math.min(money(i.lineDiscount), money(i.qty) * money(i.sellPrice)), 0),
  );
  const discountBase = Math.max(0, subtotal - lineDiscount);
  const orderDiscount = roundMoney(Math.min(
    discountBase,
    discountType === "percentage"
      ? discountBase * Math.min(100, money(discountValue)) / 100
      : money(discountValue),
  ));
  const totalDiscount = roundMoney(lineDiscount + orderDiscount);
  const grandTotal = roundMoney(Math.max(0, subtotal - totalDiscount));
  const paid = roundMoney(
    payRows.reduce((sum, p) => (p.method === "credit" ? sum : sum + Math.max(0, money(p.amount))), 0),
  );
  const due = roundMoney(Math.max(0, grandTotal - paid));
  const enforceStock = isBillEntry;

  function chooseCustomer(c: Customer) {
    const displayName = locale === "bn" && c.nameBn ? c.nameBn : c.name;
    setCustomerId(c._id); setCustomerName(displayName);
    setCustomerQuery(displayName);
    setCustomerMobile(c.mobile || ""); setCustomerAddress(c.address || "");
    setCustomerEmail(c.email || ""); setCustomerMenu(false);
    setDocumentBody((current) => withQuotationCompanyName(current, displayName));
  }
  function addProduct(p: Product) {
    const stock = money(p.locationQty);
    const sellPrice = money(p.sellPrice);
    setCart((old) => {
      const found = old.find((x) => x._id === p._id);
      if (enforceStock && stock <= 0) {
        setMessage(`Out of stock — ${p.name}`);
        return old;
      }
      if (found && enforceStock && stock > 0 && found.qty >= stock) {
        setMessage(`Insufficient stock — available ${stock}`);
        return old;
      }
      if (found && !enforceStock && stock > 0 && found.qty >= stock) {
        setMessage(`Stock ${stock}. Qty increased anyway.`);
      }
      return found
        ? old.map((x) => x._id === p._id ? { ...x, qty: x.qty + 1 } : x)
        : [...old, {
            ...p,
            sellPrice,
            qty: 1,
            bonusQty: 0,
            saleDescription: p.description || "",
            lineDiscount: 0,
            locationQty: stock,
          }];
    });
    setProductResultsOpen(false);
    setSearch("");
  }
  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    if (file.size > 800_000) {
      setMessage(locale === "bn" ? "ছবি ৮০০KB এর কম হতে হবে" : "Image must be under 800KB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setCart((old) =>
        old.map((x) => {
          if (x._id !== uploadTargetId) return x;
          const current = x.imageUrl ? `${x.imageUrl}\n${dataUrl}` : dataUrl;
          return { ...x, imageUrl: current };
        }),
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function addImageUrl() {
    if (!urlInput.trim() || !urlTargetId) return;
    const url = urlInput.trim();
    setCart((old) =>
      old.map((x) => {
        if (x._id !== urlTargetId) return x;
        const current = x.imageUrl ? `${x.imageUrl}\n${url}` : url;
        return { ...x, imageUrl: current };
      }),
    );
    setUrlInput("");
    setUrlModalOpen(false);
    setUrlTargetId(null);
  }

  function removeImage(itemId: string, indexToRemove: number) {
    setCart((old) =>
      old.map((x) => {
        if (x._id !== itemId) return x;
        const urls = extractImageUrls(x.imageUrl);
        const filtered = urls.filter((_, idx) => idx !== indexToRemove);
        return { ...x, imageUrl: filtered.join("\n") };
      }),
    );
  }

  function displayMoney(n: number) {
    if (isQuotationEntry && currency === "USD") {
      return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return formatBDT(n, locale);
  }

  function addBlankLine() {
    const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCart((old) => [
      ...old,
      {
        _id: id,
        name: "",
        sku: isQuotationEntry ? "N/A" : "",
        unit: isQuotationEntry ? "Set" : "Pcs",
        sellPrice: 0,
        qty: 1,
        bonusQty: 0,
        saleDescription: "",
        lineDiscount: 0,
        locationQty: 99999,
        imageUrl: "",
      },
    ]);
  }
  function updateItem(id: string, patch: Partial<CartItem>) {
    setCart((old) => old.map((x) => x._id === id ? { ...x, ...patch } : x));
  }
  function updateQuantity(item: CartItem, quantity: number) {
    const next = Math.max(1, money(quantity) || 1);
    const stock = money(item.locationQty);
    if (enforceStock && stock > 0 && next > stock) {
      setMessage(`Insufficient stock — available ${stock}`);
      return;
    }
    if (!enforceStock && stock > 0 && next > stock) {
      setMessage(`Stock ${stock}. Qty set anyway.`);
    }
    updateItem(item._id, { qty: next });
  }
  function reset() {
    setCart([]); setCustomerId(""); setCustomerQuery(""); setCustomerName("");
    setCustomerMobile(""); setCustomerAddress(""); setCustomerEmail(""); setAttention("");
    setQuotationNo(""); setReferenceNo(""); setSourceQuotationId(""); setSourceSaleId(""); setSaleDate(today());
    setChallanQuery(""); setChallanHits([]); setChallanMenu(false);
    setNote(""); setDocumentBody(isProposalEntry ? DEFAULT_PROPOSAL_BODY : DEFAULT_DOCUMENT_BODY); setSavedTermQuery(""); setDiscountValue(0); setPayRows([payRow()]); setMessage("");
    setSearch(""); setBrandName(""); setCategoryId(""); setProductResultsOpen(false);
    setSubject(""); setCurrency("USD");
    quotationNumberPending.current = false; referenceNumberPending.current = false; reservedQuotationNo.current = "";
  }
  async function ensureDocumentNumber(kind: "quotation" | "reference" | "challan" | "proposal") {
    if (isReturnEntry) return;
    const fieldKind = kind === "challan" || kind === "proposal" ? "quotation" : kind;
    const hasValue = fieldKind === "quotation" ? quotationNo.trim() : referenceNo.trim();
    const pending = fieldKind === "quotation" ? quotationNumberPending : referenceNumberPending;
    if (hasValue || pending.current) return;
    pending.current = true;
    try {
      const res = await fetch(`/api/sales/numbers?kind=${kind}`);
      const json = await res.json();
      if (!res.ok || !json.value) return;
      if (fieldKind === "quotation") {
        reservedQuotationNo.current = String(json.value);
        setQuotationNo((current) => current || String(json.value));
      } else {
        setReferenceNo((current) => current || String(json.value));
      }
    } finally {
      pending.current = false;
    }
  }
  async function loadQuotation() {
    if (!quotationNo.trim()) return;
    try {
      const json = await fetch(`/api/sales?quotationNo=${encodeURIComponent(quotationNo.trim())}&status=quotation&limit=1`).then((r) => r.json());
      const quote = json.data?.[0];
      if (!quote) return setMessage("Quotation not found");
      setSourceQuotationId(String(quote._id)); setQuotationNo(quote.quotationNo || "");
      setReferenceNo(quote.referenceNo || ""); setCustomerId(String(quote.customerId || ""));
      setCustomerName(quote.customerName || ""); setCustomerQuery(quote.customerName || "");
      setCustomerMobile(quote.customerMobile || ""); setCustomerAddress(quote.customerAddress || "");
      setCustomerEmail(quote.customerEmail || ""); setAttention(quote.attention || ""); setSaleDate(String(quote.saleDate || "").slice(0, 10) || today());
      setNote(quote.terms || quote.note || ""); setDocumentBody(quote.documentBody != null ? String(quote.documentBody) : DEFAULT_DOCUMENT_BODY); setSavedTermQuery("");
      if (quote.currency) setCurrency((quote.currency as "USD" | "BDT") || "USD");
      if (quote.subject) setSubject(quote.subject || "");
      const loaded = (quote.items || []).map((i: Record<string, unknown>) => ({
        _id: String(i.productId || `${quote._id}-${i.sku}`), name: String(i.name || ""),
        sku: String(i.sku || ""), sellPrice: Number(i.unitPrice || 0), unit: String(i.unit || "Pcs"),
        imageUrl: String(i.imageUrl || ""), qty: Number(i.qty || 1), bonusQty: Number(i.bonusQty || 0),
        saleDescription: String(i.description || ""), lineDiscount: Number(i.discount || 0),
      }));
      setCart(loaded); setDiscountValue(Math.max(0, Number(quote.discount || 0) - loaded.reduce((s: number, i: CartItem) => s + i.lineDiscount, 0)));
      setDiscountType("fixed"); setMessage(`Loaded quotation: ${quote.quotationNo}`);
    } catch { setMessage(t("common.error")); }
  }

  function applySaleToReturnForm(sale: Record<string, unknown>, challanNo?: string) {
    setSourceSaleId(String(sale._id || ""));
    setCustomerId(String(sale.customerId || ""));
    setCustomerName(String(sale.customerName || ""));
    setCustomerQuery(String(sale.customerName || ""));
    setCustomerMobile(String(sale.customerMobile || ""));
    setCustomerAddress(String(sale.customerAddress || ""));
    setCustomerEmail(String(sale.customerEmail || ""));
    setAttention(String(sale.attention || ""));
    setSaleDate(String(sale.saleDate || "").slice(0, 10) || today());
    setQuotationNo(String(challanNo || sale.challanNo || ""));
    setReferenceNo(String(sale.referenceNo || ""));
    setNote(String(sale.terms || sale.note || ""));
    setDocumentBody(sale.documentBody != null ? String(sale.documentBody) : DEFAULT_DOCUMENT_BODY);
    const loaded = (Array.isArray(sale.items) ? sale.items : []).map((i: Record<string, unknown>, idx: number) => ({
      _id: String(i.productId || `${sale._id}-${i.sku || idx}`),
      name: String(i.name || ""),
      sku: String(i.sku || ""),
      sellPrice: Number(i.unitPrice || 0),
      unit: String(i.unit || "Pcs"),
      imageUrl: String(i.imageUrl || ""),
      qty: Number(i.qty || 1),
      bonusQty: Number(i.bonusQty || 0),
      saleDescription: String(i.description || ""),
      lineDiscount: Number(i.discount || 0),
      locationQty: Number(i.qty || 0) + 99999,
    }));
    setCart(loaded);
    setDiscountValue(Math.max(0, Number(sale.discount || 0) - loaded.reduce((s, i) => s + i.lineDiscount, 0)));
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
      const json = await fetch(`/api/modules/shipments?limit=30&q=${encodeURIComponent(q)}`).then((r) => r.json());
      const rows = Array.isArray(json.data) ? json.data as ChallanHit[] : [];
      setChallanHits(rows.filter((row) => String(row.shipmentNo || "").toLowerCase().includes(q.toLowerCase())).slice(0, 8));
      setChallanMenu(true);
    } catch { setChallanHits([]); }
  }

  async function chooseChallan(hit: ChallanHit) {
    setChallanQuery(hit.shipmentNo || "");
    setChallanMenu(false);
    try {
      if (hit.saleId) {
        const json = await fetch(`/api/sales/${hit.saleId}`).then((r) => r.json());
        if (json.data) {
          applySaleToReturnForm(json.data, hit.shipmentNo);
          setMessage(`Loaded challan: ${hit.shipmentNo}`);
          return;
        }
      }
      setCustomerName(hit.customerName || "");
      setCustomerQuery(hit.customerName || "");
      setQuotationNo(hit.shipmentNo || "");
      setReferenceNo(hit.referenceNo || "");
      setMessage(`Loaded challan: ${hit.shipmentNo}`);
    } catch { setMessage(t("common.error")); }
  }

  async function saveSellReturn() {
    if (!cart.length) return setMessage("Order items are required");
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/modules/sell-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sourceSaleId || undefined,
          locationId: locationId || undefined,
          customerId: customerId || undefined,
          customerName: customerName.trim() || "Walk-in Customer",
          customerMobile,
          customerAddress,
          customerEmail,
          attention,
          challanNo: quotationNo,
          referenceNo,
          terms: note,
          documentBody,
          note,
          returnDate: saleDate,
          discount: totalDiscount,
          grandTotal,
          paidAmount: paid,
          dueAmount: due,
          items: cart.map((i) => ({
            productId: isMongoId(i._id) ? i._id : undefined,
            name: i.name,
            sku: i.sku,
            description: i.saleDescription,
            qty: money(i.qty),
            unitPrice: money(i.sellPrice),
            discount: Math.min(money(i.lineDiscount), money(i.qty) * money(i.sellPrice)),
            lineTotal: Math.max(0, money(i.qty) * money(i.sellPrice) - money(i.lineDiscount)),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      reset();
      setMessage(`Saved sell return: ${json.data?.returnNo || ""}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : t("common.error")); } finally { setBusy(false); }
  }

  async function save(status: "draft" | "proposal" | "quotation" | "final" | "suspended", usePayments = false) {
    if (!cart.length || !locationId) return setMessage("Location and order items are required");
    if (usePayments && paid > grandTotal + .009) return setMessage("Payment cannot exceed grand total");
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId, customerId: customerId || undefined,
          customerName: customerName.trim() || "Walk-in Customer", customerMobile,
          customerAddress, customerEmail, attention, saleDate, sourceQuotationId: status === "final" && !isChallanEntry ? sourceQuotationId || undefined : undefined,
          status: isChallanEntry && status === "quotation" ? "final" : status,
          quotationNo: isChallanEntry || status === "proposal" ? undefined : quotationNo,
          proposalNo: status === "proposal" ? quotationNo : undefined,
          challanNo: isChallanEntry ? quotationNo : undefined,
          referenceNo, note, terms: note, documentBody, discount: totalDiscount, tax: 0, shipping: 0,
          currency: isQuotationEntry ? currency : "BDT",
          subject: subject.trim() || undefined,
          items: cart.map((i) => ({
            productId: isMongoId(i._id) ? i._id : undefined,
            name: i.name.trim() || "Item",
            sku: i.sku,
            unit: i.unit || "Pcs",
            qty: money(i.qty) || 1,
            bonusQty: money(i.bonusQty),
            unitPrice: money(i.sellPrice),
            discount: Math.min(money(i.lineDiscount), money(i.qty) * money(i.sellPrice)),
            description: i.saleDescription,
            imageUrl: i.imageUrl || "",
          })),
          payments: (status === "final" || isChallanEntry) && usePayments
            ? payRows.filter((p) => p.amount > 0).map(({ method, amount }) => ({ method, amount }))
            : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      reset(); setMessage(`Saved: ${json.data.proposalNo || json.data.quotationNo || json.data.invoiceNo || json.data.referenceNo}`);
      await loadProducts();
      if (json.data?._id) {
        const id = json.data._id;
        const savedAsFinal = isChallanEntry || status === "final";
        window.open(
          isChallanEntry && savedAsFinal
            ? `/sales/${id}/challan`
            : status === "proposal"
              ? `/sales/${id}/proposal`
              : status === "quotation"
                ? `/sales/${id}/quotation`
                : `/sales/${id}/invoice`,
          "_blank",
        );
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : t("common.error")); } finally { setBusy(false); }
  }
  async function addCustomer() {
    if (!newCust.name.trim() || !newCust.mobile.trim()) return;
    try {
      const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "customer", ...newCust }) });
      const json = await res.json(); if (!res.ok) throw new Error();
      setCustomers((old) => [json.data, ...old]); chooseCustomer(json.data);
      setCustOpen(false);
      setNewCust({
        name: "",
        nameBn: "",
        contactPerson: "",
        mobile: "",
        phone: "",
        whatsapp: "",
        email: "",
        location: "",
        city: "",
        address: "",
        notes: "",
      });
    } catch { setMessage(t("common.error")); }
  }

  return (
    <div className={useDesk ? "gp-desk quote-desk pos-quote" : "pos-page pos-quote space-y-3"}>
      {isQuotationEntry ? (
        <PageHeader
          kicker={locale === "bn" ? "সেলস ও সিআরএম" : "Sales & CRM"}
          title={t("nav.addQuotation")}
          subtitle={
            locale === "bn"
              ? "কাস্টমার, আইটেম ও শর্ত দিয়ে কোটেশন তৈরি করুন।"
              : "Build a quotation with customer, items and terms."
          }
          stats={[
            { value: cart.length, label: locale === "bn" ? "আইটেম" : "items" },
            { value: formatBDT(grandTotal, locale).replace(/\.00$/, ""), label: locale === "bn" ? "মোট" : "total" },
            { value: quotationNo || "—", label: "PI" },
          ]}
          actions={
            <>
              <Link href="/sales/quotations" className="gp-btn gp-btn-ghost">
                {t("nav.listQuotations")}
              </Link>
              <button className="gp-btn gp-btn-ghost" type="button" onClick={reset}>
                <Plus className="h-4 w-4" />
                {locale === "bn" ? "নতুন" : "New"}
              </button>
              <button
                type="button"
                className="gp-btn gp-btn-primary"
                disabled={busy || !cart.length}
                onClick={() => void save("quotation")}
              >
                <FileText className="h-4 w-4" />
                {busy ? t("common.loading") : locale === "bn" ? "কোটেশন সেভ" : "Save quotation"}
              </button>
            </>
          }
        />
      ) : isOrderEntry ? (
        <PageHeader
          kicker={locale === "bn" ? "সেলস ও সিআরএম" : "Sales & CRM"}
          title={t("nav.newOrder")}
          subtitle={
            locale === "bn"
              ? "প্রস্তাব → কোটেশন → অর্ডার নিশ্চিত।"
              : "Proposal → quotation → confirm order."
          }
          stats={[
            { value: cart.length, label: locale === "bn" ? "আইটেম" : "items" },
            { value: formatBDT(grandTotal, locale).replace(/\.00$/, ""), label: locale === "bn" ? "মোট" : "total" },
            { value: formatBDT(due, locale).replace(/\.00$/, ""), label: t("common.due") },
          ]}
          actions={
            <>
              <Link href="/sales" className="gp-btn gp-btn-ghost">
                {t("nav.allSales")}
              </Link>
              <button className="gp-btn gp-btn-ghost" type="button" onClick={reset}>
                <Plus className="h-4 w-4" />
                {locale === "bn" ? "নতুন" : "New"}
              </button>
              <button
                type="button"
                className="gp-btn gp-btn-primary"
                disabled={busy || !cart.length || paid > grandTotal + 0.009}
                onClick={() => void save("final", true)}
              >
                <FileCheck className="h-4 w-4" />
                {busy ? t("common.loading") : locale === "bn" ? "অর্ডার নিশ্চিত" : "Confirm order"}
              </button>
            </>
          }
        />
      ) : null}
      <section className={useDesk ? "quote-board" : "gp-card overflow-hidden"}>
        {useDesk && message ? (
          <p className="mb-2 rounded-lg border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">{message}</p>
        ) : null}
        {useDesk ? null : (
        <header className="flex flex-col gap-2 border-b border-line px-3 py-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xl font-bold text-[var(--gp-ink)]">
            <span className="shrink-0 rounded-lg bg-[var(--gp-primary)] p-1.5 text-white"><FileText className="h-5 w-5" /></span>
            <span className="min-w-0 truncate">
            {isReturnEntry
              ? (locale === "bn" ? "বিক্রি ফেরত" : "Sell Return")
              : isChallanEntry
                ? (locale === "bn" ? "চালান" : "Challan")
                : isBillEntry
                  ? (locale === "bn" ? "বিল" : "Bill")
                  : isProposalEntry
                    ? (locale === "bn" ? "প্রস্তাব" : "Proposal")
                    : t("nav.newOrder")}
            </span>
            {isReturnEntry ? (
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
                      <button
                        key={hit._id}
                        type="button"
                        onClick={() => void chooseChallan(hit)}
                        className="block w-full rounded-md px-3 py-2 text-left hover:bg-[var(--gp-primary-soft)]"
                      >
                        {hit.shipmentNo}
                        <span className="ml-2 text-muted">{hit.customerName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
          <button className="gp-btn gp-btn-primary" type="button" onClick={reset}><Plus className="h-4 w-4" />New Order</button>
          <Link className="gp-btn gp-btn-ghost" href="/contacts/import"><Upload className="h-4 w-4" />Import Customer</Link>
          </div>
        </header>
        )}
        {isNewOrderFlow ? (
          <div className={useDesk ? "dash-panel quote-pipe" : "border-b border-line px-3 py-2"}>
            <OrderPipelineBar status={isProposalEntry ? "proposal" : isQuotationEntry ? "quotation" : isOrderEntry ? "final" : undefined} />
            {isQuotationEntry ? null : (
            <p className="mt-1 text-xs text-muted">
              {locale === "bn"
                ? "নতুন অর্ডার: আগে প্রস্তাবনা, তারপর কোটেশন, তারপর অর্ডার কনফার্ম।"
                : "New order: proposal first, then quotation, then confirm the order."}
            </p>
            )}
          </div>
        ) : null}

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
              <Field label="Date" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><div className="relative min-w-0 flex-1"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input type="date" className="gp-input gp-input-icon-left" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div></Field>
              <Field label={isReturnEntry || isChallanEntry ? "Challan No" : isProposalEntry ? "Proposal No" : "Quotation/PI No"} className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1" value={quotationNo} onFocus={() => { if (!isReturnEntry) void ensureDocumentNumber(isChallanEntry ? "challan" : isProposalEntry ? "proposal" : "quotation"); }} onChange={(e) => setQuotationNo(e.target.value.toUpperCase())} onKeyDown={(e) => { if (!isChallanEntry && !isReturnEntry && !isProposalEntry && e.key === "Enter" && quotationNo.trim() && quotationNo !== reservedQuotationNo.current) void loadQuotation(); }} placeholder={isReturnEntry ? "From selected challan" : "Auto-generated on focus"} /></Field>
              <Field label="REF No" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1 bg-slate-50" value={referenceNo} onFocus={() => { if (!isReturnEntry) void ensureDocumentNumber("reference"); }} readOnly={!isReturnEntry} placeholder={isReturnEntry ? "From selected challan" : "Auto-generated on focus"} /></Field>
            </div>
            <div className="mt-0.5 grid grid-cols-1 items-center gap-x-2 gap-y-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(11.5rem,0.72fr)]">
              <Field label="Address" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><div className="relative min-w-0 flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="gp-input gp-input-icon-left" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address" /></div></Field>
              <Field label="Attention" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="gp-input gp-input-icon-left"
                    value={attention}
                    placeholder="Search / select name"
                    onFocus={() => setAttentionMenu(true)}
                    onChange={(e) => { setAttention(e.target.value); setAttentionMenu(true); }}
                  />
                  {attentionMenu && attentionMatches.length > 0 && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white p-1 shadow-xl">
                      {attentionMatches.map((c) => (
                        <button
                          key={`att-${c._id}`}
                          type="button"
                          onClick={() => {
                            setAttention(locale === "bn" && c.nameBn ? c.nameBn : c.name);
                            setAttentionMenu(false);
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--gp-primary-soft)]"
                        >
                          {c.name}<span className="ml-2 text-muted">{c.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Contact No" className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap"><input className="gp-input min-w-0 flex-1" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Contact No" /></Field>
            </div>
            {isQuotationEntry ? (
              <div className="mt-1 grid grid-cols-1 items-center gap-x-2 gap-y-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(11.5rem,0.85fr)]">
                <Field label={locale === "bn" ? "প্রজেক্ট স্পেক্স ও নাম (ব্যানার)" : "Project Specs & Banner"} className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                  <input
                    className="gp-input min-w-0 flex-1 font-medium"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={locale === "bn" ? "যেমন: ALHERA TOWER - Load: 630kg, 10/10/10, 1.5m/s, 2:1; CO-800" : "e.g. ALHERA TOWER - Load: 630kg, 10/10/10, 1.5m/s, 2:1; CO-800"}
                  />
                </Field>
                <Field label={locale === "bn" ? "কারেন্সি (মুদ্রা)" : "Currency"} className="flex min-w-0 flex-row items-center gap-1.5 space-y-0 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                  <select
                    className="gp-input min-w-0 flex-1 font-semibold"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "USD" | "BDT")}
                  >
                    <option value="USD">USD ($) - Elevator Quotation</option>
                    <option value="BDT">BDT (৳) - Bangladeshi Taka</option>
                  </select>
                </Field>
              </div>
            ) : null}
          </div>

          <section className="rounded-xl border border-line p-1.5">
            <div className="mb-1 grid grid-cols-1 items-center gap-1.5 md:grid-cols-2 lg:grid-cols-[auto_minmax(0,1fr)_minmax(9.5rem,0.38fr)_minmax(10rem,0.38fr)]">
              <h2 className="m-0 flex shrink-0 items-center gap-2 text-sm font-bold"><PackagePlus className="h-4 w-4 text-primary" />Order Items</h2>
              <div className="relative min-w-0 md:col-span-1 lg:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="gp-input gp-input-icon-left" value={search} onFocus={() => setProductResultsOpen(true)} onChange={(e) => { const value = e.target.value; setSearch(value); setPage(1); setProductResultsOpen(true); }} placeholder="Search product by name, SKU, category or brand..." /></div>
              <select aria-label="Brand filter" className="gp-input min-w-0" value={brandName} onChange={(e) => { const value = e.target.value; setBrandName(value); setPage(1); setProductResultsOpen(true); }}><option value="">All Brands</option>{brands.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</select>
              <select aria-label="Category filter" className="gp-input min-w-0" value={categoryId} onChange={(e) => { const value = e.target.value; setCategoryId(value); setPage(1); setProductResultsOpen(true); }}><option value="">All Categories</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
            </div>
            {productResultsOpen && (loading && !visible.length ? <p className="py-6 text-center text-muted">Loading products...</p> : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {visible.map((p) => {
                  const stock = money(p.locationQty);
                  const blocked = enforceStock && stock <= 0;
                  return <button key={p._id} type="button" disabled={blocked} onClick={() => addProduct(p)} className="group rounded-xl border border-line bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--gp-primary)] hover:shadow-md disabled:opacity-50">
                    <div className="flex min-h-28 items-stretch gap-2">
                      <div className="flex w-1/2 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.name} className="aspect-square h-full max-h-32 w-full object-contain" />
                        ) : <ImageIcon className="h-8 w-8 text-slate-300" />}
                      </div>
                      <div className="flex min-w-0 w-1/2 flex-col justify-center py-1">
                        <p className="line-clamp-2 font-semibold leading-snug">{locale === "bn" && p.nameBn ? p.nameBn : p.name}</p>
                        <p className="gp-money mt-1.5 font-bold text-primary">{formatBDT(money(p.sellPrice), locale)}</p>
                        <p className="mt-1 text-xs text-muted">Stock: <span className={stock > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>{stock}</span></p>
                        <p className="mt-1 truncate text-xs text-muted" title={p.brand || ""}>Brand: {p.brand || "—"}</p>
                        <p className="mt-1 truncate text-[0.8125rem] text-[var(--gp-text-muted)]">SKU: {p.sku}</p>
                      </div>
                    </div>
                  </button>;
                })}
              </div>
            ))}
            {productResultsOpen && pages > 1 && <div className="mt-2 flex items-center justify-center gap-2"><button type="button" className="gp-btn gp-btn-ghost" disabled={page === 1} onClick={() => setPage((x) => x - 1)}>Previous</button><span className="text-sm text-muted">Page {page} of {pages}</span><button type="button" className="gp-btn gp-btn-ghost" disabled={page === pages} onClick={() => setPage((x) => x + 1)}>Next</button></div>}
          </section>

          <div className="overflow-x-auto rounded-xl border border-line">
            {isQuotationEntry ? (
              <table className="gp-table pos-quote-items">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="w-10 text-center text-white">SL</th>
                    <th className="w-28 text-white">GNL CODE</th>
                    <th className="w-36 text-center text-white">Photo</th>
                    <th className="text-white">DESCRIPTION & Elevator Specs</th>
                    <th className="w-20 text-center text-white">Quantity</th>
                    <th className="w-24 text-center text-white">Unit</th>
                    <th className="w-28 text-right text-white">Unit Price ({currency})</th>
                    <th className="w-24 text-right text-white">Discount</th>
                    <th className="w-32 text-right text-white">Total ({currency})</th>
                    <th className="w-10 text-white" />
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-sm text-muted">
                        {locale === "bn"
                          ? "লাইন যোগ করতে 'লাইন যোগ' বাটনে ক্লিক করুন অথবা প্রোডাক্ট সার্চ করুন।"
                          : "Click 'Add line' below or search a product to add elevator specifications."}
                      </td>
                    </tr>
                  ) : (
                    cart.map((i, index) => {
                      const lineTotal = roundMoney(Math.max(0, money(i.qty) * money(i.sellPrice) - money(i.lineDiscount)));
                      const photos = extractImageUrls(i.imageUrl);
                      return (
                        <tr key={i._id} className="align-top border-b border-slate-200 hover:bg-slate-50/60">
                          <td className="text-center font-bold text-slate-500 pt-3">{index + 1}</td>
                          <td>
                            <input
                              className="gp-input w-full font-mono font-bold uppercase text-xs tracking-wider"
                              value={i.sku || ""}
                              placeholder="GNL CODE"
                              onChange={(e) => updateItem(i._id, { sku: e.target.value.toUpperCase() })}
                            />
                          </td>
                          <td>
                            <div className="flex flex-col gap-1.5 items-center">
                              {photos.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center max-w-[140px]">
                                  {photos.map((url, imgIdx) => (
                                    <div key={imgIdx} className="relative group rounded border border-slate-200 overflow-hidden bg-slate-50 w-12 h-12 shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`img-${imgIdx}`} className="w-full h-full object-contain" />
                                      <button
                                        type="button"
                                        onClick={() => removeImage(i._id, imgIdx)}
                                        className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 opacity-90 hover:opacity-100"
                                        title="Remove photo"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadTargetId(i._id);
                                    if (fileInputRef.current) {
                                      fileInputRef.current.value = "";
                                      fileInputRef.current.click();
                                    }
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5"
                                  title="Upload image from device"
                                >
                                  <Upload className="h-3 w-3" /> Photo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUrlTargetId(i._id);
                                    setUrlInput("");
                                    setUrlModalOpen(true);
                                  }}
                                  className="inline-flex items-center text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5"
                                  title="Attach image by URL"
                                >
                                  URL
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="space-y-1">
                              <input
                                className="gp-input w-full font-bold text-sm text-slate-900"
                                value={i.name}
                                placeholder="Component / Spec Name (e.g. CABIN DESIGN, TRACTION MACHINE)"
                                onChange={(e) => updateItem(i._id, { name: e.target.value })}
                              />
                              <textarea
                                className="gp-input w-full font-mono text-xs leading-relaxed min-h-[64px] resize-y"
                                rows={3}
                                value={i.saleDescription || ""}
                                placeholder={"Specifications / Notes. Line breaks preserved. Examples:\nCar wall: Hairline stainless steel\nThickness=1.5mm\nNote: FUJI LOGO ON TOP"}
                                onChange={(e) => updateItem(i._id, { saleDescription: e.target.value })}
                              />
                            </div>
                          </td>
                          <td>
                            <AmountInput
                              min={1}
                              value={money(i.qty)}
                              onValue={(n) => updateQuantity(i, n)}
                              className="gp-input pos-amt w-full text-center font-semibold"
                              placeholder="1"
                            />
                          </td>
                          <td>
                            <input
                              list="quotation-unit-presets"
                              className="gp-input w-full text-center font-medium"
                              value={i.unit || "Set"}
                              onChange={(e) => updateItem(i._id, { unit: e.target.value })}
                              placeholder="Set"
                            />
                          </td>
                          <td>
                            <AmountInput
                              min={0}
                              value={money(i.sellPrice)}
                              onValue={(n) => updateItem(i._id, { sellPrice: n })}
                              className="gp-input pos-amt w-full text-right font-medium"
                            />
                          </td>
                          <td>
                            <AmountInput
                              min={0}
                              max={money(i.qty) * money(i.sellPrice)}
                              value={money(i.lineDiscount)}
                              onValue={(n) => updateItem(i._id, { lineDiscount: n })}
                              className="gp-input pos-amt w-full text-right"
                            />
                          </td>
                          <td className="gp-money font-bold text-right pt-3 whitespace-nowrap">
                            {displayMoney(lineTotal)}
                          </td>
                          <td className="text-center pt-2">
                            <button
                              type="button"
                              className="p-1 text-red-500 hover:text-red-700"
                              onClick={() => setCart((old) => old.filter((x) => x._id !== i._id))}
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="gp-table pos-quote-items">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>QTY</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-sm text-muted">
                        {locale === "bn"
                          ? "প্রোডাক্ট সার্চ করে যোগ করুন, অথবা লাইন যোগ করে পরিমাণ ও দাম লিখুন।"
                          : "Search a product to add, or add a line and type qty and amount."}
                      </td>
                    </tr>
                  ) : cart.map((i, index) => {
                  const lineTotal = roundMoney(Math.max(0, money(i.qty) * money(i.sellPrice) - money(i.lineDiscount)));
                  return (
                    <tr key={i._id}>
                      <td>{index + 1}</td>
                      <td className="min-w-0">
                        <input className="gp-input w-full min-w-0" value={i.name} onChange={(e) => updateItem(i._id, { name: e.target.value })} />
                      </td>
                      <td className="min-w-0">
                        <textarea
                          className="gp-input pos-quote-desc w-full min-w-0"
                          rows={1}
                          value={i.saleDescription}
                          onChange={(e) => updateItem(i._id, { saleDescription: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") e.stopPropagation(); }}
                        />
                      </td>
                      <td>
                        <AmountInput
                          min={1}
                          value={money(i.qty)}
                          onValue={(n) => updateQuantity(i, n)}
                          className="gp-input pos-amt w-full min-w-0"
                          placeholder="1"
                        />
                      </td>
                      <td>
                        <AmountInput
                          min={0}
                          value={money(i.sellPrice)}
                          onValue={(n) => updateItem(i._id, { sellPrice: n })}
                          className="gp-input pos-amt w-full min-w-0"
                        />
                      </td>
                      <td>
                        <AmountInput
                          min={0}
                          max={money(i.qty) * money(i.sellPrice)}
                          value={money(i.lineDiscount)}
                          onValue={(n) => updateItem(i._id, { lineDiscount: n })}
                          className="gp-input pos-amt w-full min-w-0"
                        />
                      </td>
                      <td className="gp-money font-bold">{formatBDT(lineTotal, locale)}</td>
                      <td>
                        <button type="button" className="p-1 text-red-500" onClick={() => setCart((old) => old.filter((x) => x._id !== i._id))}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={addBlankLine}>
              <Plus className="h-4 w-4" />
              {locale === "bn" ? "লাইন যোগ" : "Add line"}
            </button>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-1.5 lg:grid-cols-2">
            <section className="rounded-xl border border-line p-1.5">
              <div className="mb-1 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <h2 className="m-0 flex shrink-0 items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />Terms and Condition</h2>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="gp-input gp-input-icon-left"
                    list="quotation-saved-terms"
                    value={savedTermQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSavedTermQuery(value);
                      const selected = savedTerms.find((term) => term === value);
                      if (!selected) return;
                      setNote((current) => {
                        const existing = current
                          .split("\n")
                          .map((line) => line.replace(/^[-•◆]\s*/, "").trim())
                          .filter(Boolean);
                        if (existing.includes(selected)) return current;
                        return current.trim() ? `${current.replace(/\s+$/, "")}\n${selected}` : selected;
                      });
                      setSavedTermQuery("");
                    }}
                    placeholder="Search saved terms or write directly below..."
                  />
                  <datalist id="quotation-saved-terms">
                    {savedTerms.map((term) => <option key={term} value={term} />)}
                  </datalist>
                </div>
              </div>
              <textarea className="gp-input min-h-14 resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter notes, delivery instructions, or terms and conditions..." />
            </section>
            <section className="rounded-xl border border-line p-1.5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />{isReturnEntry ? "Sell Return Description" : isChallanEntry ? "Challan Description" : isProposalEntry ? "Proposal Description" : "Quotation Description"}</h2>
              <textarea className="gp-input min-h-14 resize-y" value={documentBody} onChange={(e) => setDocumentBody(e.target.value)} />
            </section>
          </div>

          <div className="grid items-stretch gap-1.5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(10.75rem,0.38fr)]">
            <section className="rounded-xl border border-line p-1.5">
              <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setPayRows((old) => [...old, payRow(nextPayId(old))])}><Plus className="h-4 w-4" />{t("pos.addPayment")}</button>
              <div className="mt-1.5 space-y-1.5">{payRows.map((p) => (
                <div key={p.id} className="grid grid-cols-[minmax(6.5rem,0.9fr)_minmax(8rem,1.2fr)_auto] items-center gap-2">
                  <select className="gp-input" value={p.method} onChange={(e) => setPayRows((old) => old.map((x) => x.id === p.id ? { ...x, method: e.target.value } : x))}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  <AmountInput
                    min={0}
                    value={money(p.amount)}
                    onValue={(n) => setPayRows((old) => old.map((x) => x.id === p.id ? { ...x, amount: n } : x))}
                    className="gp-input pos-amt"
                    placeholder="0.00"
                  />
                  <button type="button" className="p-2 text-red-500" disabled={payRows.length === 1} onClick={() => setPayRows((old) => old.filter((x) => x.id !== p.id))}><X className="h-4 w-4" /></button>
                </div>
              ))}</div>
            </section>
            <section className="rounded-xl border border-line bg-[#fbfdff] p-1.5">
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-bold"><Grid2X2 className="h-4 w-4 text-primary" />{isReturnEntry ? (locale === "bn" ? "ফেরত সামারি" : "Sell Return Summary") : isChallanEntry ? (locale === "bn" ? "চালান সামারি" : "Challan Summary") : isBillEntry ? (locale === "bn" ? "বিল সামারি" : "Bill Summary") : isProposalEntry ? (locale === "bn" ? "প্রস্তাব সামারি" : "Proposal Summary") : isOrderEntry ? (locale === "bn" ? "অর্ডার সামারি" : "Order Summary") : (locale === "bn" ? "কোটেশন সামারি" : "Quotation Summary")}</h2>
              <div className="space-y-1 text-sm"><div className="flex justify-between"><span>{t("common.subtotal")}</span><b className="gp-money">{displayMoney(subtotal)}</b></div><div className="grid grid-cols-[1fr_150px] items-center gap-2"><span>{t("common.discount")}</span><div className="flex min-w-0"><AmountInput min={0} value={money(discountValue)} onValue={setDiscountValue} className="gp-input pos-amt rounded-r-none" /><select className="gp-input w-[72px] rounded-l-none px-2 py-0 h-[32px]" style={{ paddingBlock: 0 }} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}><option value="percentage">%</option><option value="fixed">{currency === "USD" ? "$" : "Tk"}</option></select></div></div><div className="flex justify-between text-xs text-muted"><span>{locale === "bn" ? "লাইন ডিসকাউন্ট সহ" : "Including line discounts"}</span><span>{displayMoney(totalDiscount)}</span></div><div className="flex justify-between rounded-lg border border-line bg-white p-1.5 text-lg"><b>{t("common.grandTotal")}</b><b className="gp-money text-primary">{displayMoney(grandTotal)}</b></div><div className="flex justify-between px-2 text-base"><b>{t("common.due")}</b><b className="gp-money text-red-500">{displayMoney(due)}</b></div></div>
            </section>
            <div className="flex flex-col justify-between gap-2 md:col-span-2 lg:col-span-1">
              {isReturnEntry ? (
                <button type="button" className="gp-btn gp-btn-primary w-full" disabled={busy || !cart.length} onClick={() => void saveSellReturn()}>{busy ? t("common.loading") : (locale === "bn" ? "ফেরত সেভ" : "Save Sell Return")}</button>
              ) : isChallanEntry ? (
                <button type="button" className="gp-btn gp-btn-primary w-full" disabled={busy || !cart.length} onClick={() => void save("final", true)}>{locale === "bn" ? "চালান সেভ" : "Save Challan"}</button>
              ) : isBillEntry ? null : (
                <>
                  {isQuotationEntry ? null : (
                  <button type="button" className="gp-btn gp-btn-primary w-full" disabled={busy || !cart.length} onClick={() => void save("proposal")}>
                    <ScrollText className="h-4 w-4" />{busy ? t("common.loading") : (locale === "bn" ? "প্রস্তাব সেভ" : "Save Proposal")}
                  </button>
                  )}
                  <button type="button" className={isQuotationEntry ? "gp-btn gp-btn-primary w-full" : "gp-btn w-full"} disabled={busy || !cart.length} onClick={() => void save("quotation")}>
                    <FileText className="h-4 w-4" />{busy ? t("common.loading") : (locale === "bn" ? "কোটেশন সেভ" : "Save Quotation")}
                  </button>
                </>
              )}
              {isReturnEntry || isQuotationEntry ? null : (
              <button type="button" className="gp-btn gp-btn-primary w-full" disabled={busy || !cart.length || paid > grandTotal + .009} onClick={() => void save("final", true)}><FileCheck className="h-4 w-4" />{busy ? t("common.loading") : isBillEntry ? (locale === "bn" ? "বিক্রি সম্পন্ন" : "Complete Sale") : (locale === "bn" ? "অর্ডার নিশ্চিত" : "Confirm order")}</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {useDesk ? null : message ? (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-primary">{message}</p>
      ) : null}

      <Modal
        open={custOpen}
        wide
        noScroll
        title={locale === "bn" ? "নতুন কাস্টমার" : "New customer"}
        onClose={() => setCustOpen(false)}
      >
        <div className="erp-cust-form">
          <div className="erp-cust-grid">
            <section className="erp-cust-panel">
              <h3>{locale === "bn" ? "পরিচয়" : "Identity"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "কাস্টমারের নাম" : "Customer name"}</span>
                  <input className="gp-input" value={newCust.name} onChange={(e) => setNewCust((x) => ({ ...x, name: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}</span>
                  <input className="gp-input" value={newCust.nameBn} onChange={(e) => setNewCust((x) => ({ ...x, nameBn: e.target.value }))} />
                </label>
                <label className="span-2">
                  <span className="gp-field-label">{locale === "bn" ? "যোগাযোগ ব্যক্তি" : "Contact person"}</span>
                  <input className="gp-input" value={newCust.contactPerson} onChange={(e) => setNewCust((x) => ({ ...x, contactPerson: e.target.value }))} />
                </label>
              </div>
            </section>
            <section className="erp-cust-panel">
              <h3>{locale === "bn" ? "যোগাযোগ" : "Contact"}</h3>
              <div className="erp-cust-fields">
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "মোবাইল" : "Mobile"}</span>
                  <input className="gp-input" value={newCust.mobile} onChange={(e) => setNewCust((x) => ({ ...x, mobile: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "অন্যান্য ফোন" : "Other phone"}</span>
                  <input className="gp-input" value={newCust.phone} onChange={(e) => setNewCust((x) => ({ ...x, phone: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">WhatsApp</span>
                  <input className="gp-input" value={newCust.whatsapp} onChange={(e) => setNewCust((x) => ({ ...x, whatsapp: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">Email</span>
                  <input className="gp-input" type="email" value={newCust.email} onChange={(e) => setNewCust((x) => ({ ...x, email: e.target.value }))} />
                </label>
              </div>
            </section>
            <section className="erp-cust-panel span-2" style={{ gridColumn: "1 / -1" }}>
              <h3>{locale === "bn" ? "সাইট" : "Site"}</h3>
              <div className="erp-cust-fields" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "এলাকা" : "Area"}</span>
                  <input className="gp-input" value={newCust.location} onChange={(e) => setNewCust((x) => ({ ...x, location: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "শহর" : "City"}</span>
                  <input className="gp-input" value={newCust.city} onChange={(e) => setNewCust((x) => ({ ...x, city: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "ঠিকানা" : "Address"}</span>
                  <input className="gp-input" value={newCust.address} onChange={(e) => setNewCust((x) => ({ ...x, address: e.target.value }))} />
                </label>
                <label>
                  <span className="gp-field-label">{locale === "bn" ? "নোট" : "Notes"}</span>
                  <input className="gp-input" value={newCust.notes} onChange={(e) => setNewCust((x) => ({ ...x, notes: e.target.value }))} />
                </label>
              </div>
            </section>
          </div>
          <div className="erp-cust-actions">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setCustOpen(false)}>{t("common.cancel")}</button>
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => void addCustomer()}>
              <UserPlus className="h-4 w-4" />
              {t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePick}
      />

      <datalist id="quotation-unit-presets">
        <option value="Set" />
        <option value="Pcs" />
        <option value="Pc" />
        <option value="Meter" />
        <option value="Roll" />
        <option value="Lot" />
        <option value="Kg" />
        <option value="Box" />
      </datalist>

      <Modal
        open={urlModalOpen}
        title="Attach Image by URL"
        onClose={() => setUrlModalOpen(false)}
      >
        <div className="space-y-3 p-2">
          <Field label="Image URL (http://... or https://...)">
            <input
              className="gp-input w-full"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/elevator-part.png"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addImageUrl();
                }
              }}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="gp-btn gp-btn-ghost"
              onClick={() => setUrlModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gp-btn gp-btn-primary"
              onClick={addImageUrl}
              disabled={!urlInput.trim()}
            >
              Add Photo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">Loading...</p>}>
      <PosPageInner />
    </Suspense>
  );
}
