"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Package, Plus, Save, Trash2 } from "lucide-react";
import { AlertBanner } from "@/components/ui";
import { FieldJobNav } from "@/components/service/FieldJobNav";
import { fetchJson } from "@/lib/fetch-json";
import { writeStoredJob } from "@/lib/field-job";
import { formatBDT } from "@/lib/utils";

type Part = { name: string; qty: number; unitPrice: number; productId?: string; code?: string; lineTotal?: number };
type Product = { _id: string; name?: string; sku?: string; sellPrice?: number };
type Ref = { _id?: string; name?: string };
type Job = {
  _id: string;
  jobNo?: string;
  status?: string;
  house?: string;
  siteName?: string;
  lift?: string;
  parts?: Part[];
  partsTotal?: number;
  customerId?: string | Ref;
  technicianId?: string | Ref;
};

function nameOf(value?: string | Ref) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || "";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "P";
}

function lineTotal(row: Part) {
  return Math.max(0, Number(row.qty || 0) * Number(row.unitPrice || 0));
}

export default function FieldPartsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [job, setJob] = useState<Job | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState({ name: "", qty: "1", price: "0" });

  async function load() {
    const res = await fetchJson<{ data?: Job }>(`/api/services/${id}`);
    if (!res.ok || !res.data?.data) {
      setError(t("common.error"));
      return;
    }
    const next = res.data.data;
    setJob(next);
    setParts(Array.isArray(next.parts) ? next.parts : []);
    setError("");
  }

  useEffect(() => {
    writeStoredJob(id);
    void load();
    void fetchJson<{ data?: Product[] }>("/api/products?limit=80").then((res) => {
      if (res.ok) setProducts(res.data?.data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function addProduct(productId: string) {
    const product = products.find((row) => row._id === productId);
    if (!product) return;
    setParts((old) => {
      const index = old.findIndex((row) => row.productId === product._id);
      if (index >= 0) {
        return old.map((row, i) => (i === index ? { ...row, qty: Number(row.qty || 0) + 1 } : row));
      }
      return [
        ...old,
        {
          productId: product._id,
          name: product.name || "Part",
          code: product.sku,
          qty: 1,
          unitPrice: Number(product.sellPrice || 0),
        },
      ];
    });
  }

  function addCustom() {
    const name = custom.name.trim();
    if (!name) return;
    setParts((old) => [
      ...old,
      { name, qty: Math.max(1, Number(custom.qty) || 1), unitPrice: Math.max(0, Number(custom.price) || 0) },
    ]);
    setCustom({ name: "", qty: "1", price: "0" });
  }

  function updateRow(index: number, patch: Partial<Part>) {
    setParts((old) => old.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    setPending(true);
    setError("");
    setMsg("");
    const payload = parts
      .filter((row) => row.name && Number(row.qty) > 0)
      .map((row) => ({
        productId: row.productId,
        name: row.name,
        code: row.code,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
      }));
    const res = await fetchJson<{ data?: Job }>(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: payload }),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setMsg(bn ? "পার্টস সেভ হয়েছে" : "Parts saved");
    await load();
  }

  const total = parts.reduce((sum, row) => sum + lineTotal(row), 0);
  const qtySum = parts.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const stockLines = parts.filter((row) => row.productId).length;
  const customer = job?.house || job?.siteName || nameOf(job?.customerId) || (bn ? "কাস্টমার" : "Customer");
  const stock = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((row) =>
      [row.name, row.sku].some((value) => String(value || "").toLowerCase().includes(q)),
    );
  }, [products, query]);

  if (error && !job) return <AlertBanner tone="error" message={error} />;
  if (!job) return <p className="text-muted">{t("common.loading")}</p>;

  return (
    <div className="gp-desk fld-day fld-sitepage fld-partspage">
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {msg ? <AlertBanner tone="success" message={msg} onClose={() => setMsg("")} /> : null}

      <section className="fld-hero">
        <div className="fld-ident">
          <span className="fld-ident-avatar">{initials(customer)}</span>
          <div>
            <p className="fld-hero-kicker">{job.jobNo || t("field.parts")}</p>
            <h1>{customer}</h1>
            <p className="fld-lead">{job.lift || (bn ? "জব পার্টস" : "Job parts")}</p>
          </div>
        </div>
        <div className="fld-hero-stats">
          <b>
            {parts.length} {bn ? "লাইন" : "lines"}
          </b>
          <b>{formatBDT(total, locale)}</b>
          <b>{String(job.status || "—").replace(/_/g, " ")}</b>
        </div>
      </section>

      <section className="fld-panel">
        <div className="fld-sitebody">
          <div className="fld-sitecol">
            <div className="fld-composer">
              <label className="fld-field">
                <span>{bn ? "কাস্টম পার্ট" : "Custom part"}</span>
                <input
                  className="gp-input"
                  placeholder={bn ? "পার্টের নাম" : "Part name"}
                  value={custom.name}
                  onChange={(e) => setCustom((old) => ({ ...old, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustom();
                  }}
                />
              </label>
              <label className="fld-field">
                <span>{bn ? "পরিমাণ" : "Qty"}</span>
                <input
                  className="gp-input"
                  type="number"
                  min={1}
                  value={custom.qty}
                  onChange={(e) => setCustom((old) => ({ ...old, qty: e.target.value }))}
                />
              </label>
              <label className="fld-field">
                <span>{bn ? "দাম" : "Price"}</span>
                <input
                  className="gp-input"
                  type="number"
                  min={0}
                  value={custom.price}
                  onChange={(e) => setCustom((old) => ({ ...old, price: e.target.value }))}
                />
              </label>
              <button type="button" className="fld-act" onClick={addCustom}>
                <Plus className="h-4 w-4" />
                {bn ? "যোগ" : "Add"}
              </button>
              <button type="button" className="fld-cta" disabled={pending} onClick={() => void save()}>
                <Save className="h-4 w-4" />
                {t("common.save")}
              </button>
            </div>

            <div className="fld-partlist">
              {parts.length ? (
                parts.map((row, index) => (
                  <article key={`${row.productId || row.name}-${index}`} className="fld-partrow">
                    <label className="fld-field">
                      <span>{row.code || (row.productId ? "SKU" : bn ? "কাস্টম" : "Custom")}</span>
                      <input className="gp-input" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} />
                    </label>
                    <div className="fld-qty">
                      <button
                        type="button"
                        className="fld-ico"
                        disabled={Number(row.qty) <= 1}
                        onClick={() => updateRow(index, { qty: Math.max(1, Number(row.qty) - 1) })}
                        aria-label={bn ? "কমাও" : "Decrease"}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        className="gp-input"
                        value={row.qty}
                        onChange={(e) => updateRow(index, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      <button
                        type="button"
                        className="fld-ico"
                        onClick={() => updateRow(index, { qty: Number(row.qty || 0) + 1 })}
                        aria-label={bn ? "বাড়াও" : "Increase"}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <label className="fld-field">
                      <span>{bn ? "দাম" : "Price"}</span>
                      <input
                        type="number"
                        min={0}
                        className="gp-input"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    <p className="fld-linetotal">{formatBDT(lineTotal(row), locale)}</p>
                    <button
                      type="button"
                      className="fld-ico"
                      title={bn ? "মুছুন" : "Remove"}
                      onClick={() => setParts((old) => old.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))
              ) : (
                <div className="fld-partempty">
                  <Package className="h-8 w-8" />
                  <p>{bn ? "এখনো কোনো পার্ট নেই" : "No parts on this job yet"}</p>
                  <small>{bn ? "ডান পাশের স্টক থেকে যোগ করুন, অথবা কাস্টম নাম লিখুন" : "Add from stock on the right, or type a custom part"}</small>
                </div>
              )}
            </div>
          </div>

          <aside className="fld-mapcard">
            <section className="fld-clockface" data-state={parts.length ? "done" : "wait"}>
              <p>{bn ? "পার্টস মোট" : "Parts total"}</p>
              <strong>{formatBDT(total, locale)}</strong>
              <small>
                {qtySum} {bn ? "পিস" : "pcs"} · {stockLines} {bn ? "স্টক" : "stock"} · {parts.length - stockLines}{" "}
                {bn ? "কাস্টম" : "custom"}
              </small>
            </section>
            <div className="fld-maphead">
              <Package className="h-4 w-4" />
              <div>
                <strong>{bn ? "স্টক ক্যাটালগ" : "Stock catalog"}</strong>
                <small>
                  {stock.length} {bn ? "আইটেম — স্ক্রল করুন" : "items — scroll"}
                </small>
              </div>
              <input
                className="gp-input fld-stocksearch"
                placeholder={bn ? "খুঁজুন" : "Search"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="fld-stockpane">
              {stock.length ? (
                stock.map((product) => (
                  <button key={product._id} type="button" className="fld-stock" onClick={() => addProduct(product._id)}>
                    <span>
                      <strong>{product.name || "Part"}</strong>
                      <em>{product.sku || "SKU"}</em>
                    </span>
                    <b>{formatBDT(Number(product.sellPrice || 0), locale)}</b>
                  </button>
                ))
              ) : (
                <p className="fld-gps mute">{bn ? "স্টকে মিল নেই" : "No stock matches"}</p>
              )}
            </div>
          </aside>
        </div>
        <FieldJobNav id={id} />
      </section>
    </div>
  );
}
