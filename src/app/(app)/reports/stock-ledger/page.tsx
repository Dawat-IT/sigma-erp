"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, Field, FilterBar, PageHeader, TableSkeleton } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";

type Product = { _id: string; name: string; nameBn?: string };
type Movement = {
  date: string;
  productName: string;
  inQty: number;
  outQty: number;
  inHand: number;
  unitCost: number;
  valuation: number;
  ref: string;
  type: string;
};
type Summary = {
  productId: string;
  productName: string;
  inHand: number;
  unitCost: number;
  valuation: number;
};

export default function StockLedgerReportPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products?limit=200")
      .then((r) => r.json())
      .then((d) => setProducts(d.data || []))
      .catch(() => setProducts([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (productId) qs.set("productId", productId);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/reports/stock-ledger?${qs}`);
      const json = await res.json();
      setRows(json.data || []);
      setSummary(json.summary || []);
    } catch {
      setRows([]);
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, [productId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "স্টক রিপোর্ট (পণ্যভিত্তিক)" : "Stock report (product-wise)"}
        subtitle={
          locale === "bn"
            ? "তারিখ অনুযায়ী In / Out / In hand / Unit cost / Valuation"
            : "Date-wise In / Out / In hand / Unit cost / Valuation"
        }
      />

      <FilterBar>
        <Field label={locale === "bn" ? "পণ্য" : "Product"}>
          <select className="gp-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{locale === "bn" ? "সব পণ্য" : "All products"}</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {locale === "bn" && p.nameBn ? p.nameBn : p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={locale === "bn" ? "থেকে" : "From"}>
          <input type="date" className="gp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={locale === "bn" ? "পর্যন্ত" : "To"}>
          <input type="date" className="gp-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <button type="button" className="gp-btn gp-btn-primary w-full" onClick={load}>
            {t("common.apply")}
          </button>
        </div>
      </FilterBar>

      {summary.length > 0 ? (
        <div className="mb-5 gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{locale === "bn" ? "পণ্য" : "Product"}</th>
                <th>{locale === "bn" ? "হাতে" : "In hand"}</th>
                <th>{locale === "bn" ? "ইউনিট খরচ" : "Unit cost"}</th>
                <th>{locale === "bn" ? "মূল্যায়ন" : "Valuation"}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.productId}>
                  <td className="font-semibold">{s.productName}</td>
                  <td className="gp-money">{s.inHand}</td>
                  <td className="gp-money">{formatBDT(s.unitCost, locale)}</td>
                  <td className="gp-money">{formatBDT(s.valuation, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{locale === "bn" ? "তারিখ" : "Date"}</th>
                <th>{locale === "bn" ? "পণ্য" : "Product"}</th>
                <th>In</th>
                <th>Out</th>
                <th>{locale === "bn" ? "হাতে" : "In hand"}</th>
                <th>{locale === "bn" ? "ইউনিট খরচ" : "Unit cost"}</th>
                <th>{locale === "bn" ? "মূল্যায়ন" : "Valuation"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.ref}-${i}`}>
                  <td>{formatDateBD(r.date, locale)}</td>
                  <td>
                    <div className="font-semibold">{r.productName}</div>
                    <div className="text-xs text-muted">
                      {r.type} · {r.ref}
                    </div>
                  </td>
                  <td className="gp-money">{r.inQty || "—"}</td>
                  <td className="gp-money">{r.outQty || "—"}</td>
                  <td className="gp-money font-semibold">{r.inHand}</td>
                  <td className="gp-money">{formatBDT(r.unitCost, locale)}</td>
                  <td className="gp-money">{formatBDT(r.valuation, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
