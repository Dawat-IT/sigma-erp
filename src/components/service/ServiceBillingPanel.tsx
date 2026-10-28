"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SERVICE_CATALOG, SERVICE_UNITS } from "@/lib/service-catalog";
import { computeServiceTotals, type ServiceMoneyLine } from "@/lib/service-totals";
import { formatBDT } from "@/lib/utils";

export type BillingLine = {
  name: string;
  code?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  productId?: string;
};

export type ServiceBillingValue = {
  visitCharge: number;
  serviceLines: BillingLine[];
  parts: BillingLine[];
  discount: number;
  tax: number;
  paidAmount: number;
  locationId: string;
};

type ProductOpt = { _id: string; name?: string; sku?: string; sellPrice?: number };
type LocationOpt = { _id: string; name: string };

const emptyLine = (): BillingLine => ({ name: "", qty: 1, unit: "job", unitPrice: 0 });

export function billingFromJob(job: {
  visitCharge?: number;
  serviceCharges?: number;
  serviceLines?: BillingLine[];
  parts?: BillingLine[];
  discount?: number;
  tax?: number;
  paidAmount?: number;
  locationId?: string;
}): ServiceBillingValue {
  const lines = Array.isArray(job.serviceLines) ? job.serviceLines : [];
  return {
    visitCharge: Number(job.visitCharge || (!lines.length ? job.serviceCharges : 0) || 0),
    serviceLines: lines.length ? lines.map((row) => ({ ...row, qty: Number(row.qty || 1), unitPrice: Number(row.unitPrice || 0) })) : [emptyLine()],
    parts: Array.isArray(job.parts) && job.parts.length
      ? job.parts.map((row) => ({ ...row, qty: Number(row.qty || 1), unitPrice: Number(row.unitPrice || 0) }))
      : [],
    discount: Number(job.discount || 0),
    tax: Number(job.tax || 0),
    paidAmount: Number(job.paidAmount || 0),
    locationId: String(job.locationId || ""),
  };
}

export function ServiceBillingPanel({
  value,
  onChange,
  products = [],
  locations = [],
  locale = "en",
  compact,
}: {
  value: ServiceBillingValue;
  onChange: (next: ServiceBillingValue) => void;
  products?: ProductOpt[];
  locations?: LocationOpt[];
  locale?: string;
  compact?: boolean;
}) {
  const bn = locale === "bn";
  const totals = useMemo(
    () =>
      computeServiceTotals({
        serviceLines: value.serviceLines,
        parts: value.parts,
        visitCharge: value.visitCharge,
        discount: value.discount,
        tax: value.tax,
        paidAmount: value.paidAmount,
      }),
    [value],
  );

  function setLine(kind: "serviceLines" | "parts", index: number, patch: Partial<BillingLine>) {
    const rows = [...value[kind]];
    const next = { ...rows[index], ...patch };
    rows[index] = next;
    onChange({ ...value, [kind]: rows });
  }

  function addCatalog(code: string) {
    const item = SERVICE_CATALOG.find((row) => row.code === code);
    if (!item) return;
    onChange({
      ...value,
      serviceLines: [
        ...value.serviceLines.filter((row) => row.name.trim() || row.qty > 0),
        {
          name: bn ? item.nameBn : item.name,
          code: item.code,
          qty: 1,
          unit: item.unit,
          unitPrice: item.unitPrice,
        },
      ],
    });
  }

  function addPart(productId: string) {
    const product = products.find((row) => row._id === productId);
    if (!product) return;
    onChange({
      ...value,
      parts: [
        ...value.parts,
        {
          productId: product._id,
          name: product.name || "Part",
          qty: 1,
          unit: "pcs",
          unitPrice: Number(product.sellPrice || 0),
        },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ভিজিট / সার্ভিস চার্জ" : "Visit / service charge"}</span>
          <input
            type="number"
            min={0}
            className="gp-input"
            value={value.visitCharge}
            onChange={(e) => onChange({ ...value, visitCharge: Math.max(0, Number(e.target.value)) })}
          />
        </label>
        {locations.length ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted">{bn ? "স্টক লোকেশন (পার্টস)" : "Stock location (parts)"}</span>
            <select className="gp-input" value={value.locationId} onChange={(e) => onChange({ ...value, locationId: e.target.value })}>
              <option value="">{bn ? "বেছে নিন" : "Select"}</option>
              {locations.map((row) => (
                <option key={row._id} value={row._id}>{row.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ক্যাটালগ থেকে সার্ভিস যোগ" : "Add service from catalog"}</span>
          <select className="gp-input" defaultValue="" onChange={(e) => { if (e.target.value) { addCatalog(e.target.value); e.target.value = ""; } }}>
            <option value="">{bn ? "সার্ভিস বেছে নিন" : "Choose a service"}</option>
            {SERVICE_CATALOG.map((row) => (
              <option key={row.code} value={row.code}>
                {bn ? row.nameBn : row.name} · {row.unitPrice}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{bn ? "এই জবের সার্ভিসসমূহ" : "Services on this job"}</h3>
          <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs" onClick={() => onChange({ ...value, serviceLines: [...value.serviceLines, emptyLine()] })}>
            <Plus className="h-3.5 w-3.5" /> {bn ? "লাইন" : "Line"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "সার্ভিস" : "Service"}</th>
                <th className="w-20">{bn ? "পরিমাণ" : "Qty"}</th>
                <th className="w-24">{bn ? "ইউনিট" : "Unit"}</th>
                <th className="w-28">{bn ? "রেট" : "Rate"}</th>
                <th className="w-28 text-right">{bn ? "মোট" : "Amount"}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {value.serviceLines.map((row, i) => (
                <tr key={`svc-${i}`}>
                  <td>
                    <input className="gp-input" value={row.name} placeholder={bn ? "সার্ভিসের নাম" : "Service name"} onChange={(e) => setLine("serviceLines", i, { name: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" min={0} step="0.5" className="gp-input" value={row.qty} onChange={(e) => setLine("serviceLines", i, { qty: Math.max(0, Number(e.target.value)) })} />
                  </td>
                  <td>
                    <select className="gp-input" value={row.unit || "job"} onChange={(e) => setLine("serviceLines", i, { unit: e.target.value })}>
                      {SERVICE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{bn ? u.labelBn : u.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" min={0} className="gp-input" value={row.unitPrice} onChange={(e) => setLine("serviceLines", i, { unitPrice: Math.max(0, Number(e.target.value)) })} />
                  </td>
                  <td className="text-right font-semibold">{formatBDT(Number(row.qty || 0) * Number(row.unitPrice || 0), locale)}</td>
                  <td>
                    <button type="button" className="gp-btn gp-btn-ghost px-2" onClick={() => onChange({ ...value, serviceLines: value.serviceLines.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{bn ? "ব্যবহৃত পার্টস" : "Parts used"}</h3>
          <select className="gp-input max-w-xs" defaultValue="" onChange={(e) => { if (e.target.value) { addPart(e.target.value); e.target.value = ""; } }}>
            <option value="">{bn ? "পণ্য যোগ করুন" : "Add product"}</option>
            {products.map((row) => (
              <option key={row._id} value={row._id}>{row.name}{row.sku ? ` · ${row.sku}` : ""}</option>
            ))}
          </select>
        </div>
        {value.parts.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>{bn ? "পার্টস" : "Part"}</th>
                  <th className="w-20">{bn ? "পরিমাণ" : "Qty"}</th>
                  <th className="w-28">{bn ? "রেট" : "Rate"}</th>
                  <th className="w-28 text-right">{bn ? "মোট" : "Amount"}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {value.parts.map((row, i) => (
                  <tr key={`part-${i}`}>
                    <td className="font-medium">{row.name}</td>
                    <td>
                      <input type="number" min={0} className="gp-input" value={row.qty} onChange={(e) => setLine("parts", i, { qty: Math.max(0, Number(e.target.value)) })} />
                    </td>
                    <td>
                      <input type="number" min={0} className="gp-input" value={row.unitPrice} onChange={(e) => setLine("parts", i, { unitPrice: Math.max(0, Number(e.target.value)) })} />
                    </td>
                    <td className="text-right font-semibold">{formatBDT(Number(row.qty || 0) * Number(row.unitPrice || 0), locale)}</td>
                    <td>
                      <button type="button" className="gp-btn gp-btn-ghost px-2" onClick={() => onChange({ ...value, parts: value.parts.filter((_, idx) => idx !== i) })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">{bn ? "এই জবে এখনো কোনো পার্টস নেই।" : "No parts on this job yet."}</p>
        )}
      </div>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ডিসকাউন্ট" : "Discount"}</span>
          <input type="number" min={0} className="gp-input" value={value.discount} onChange={(e) => onChange({ ...value, discount: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ট্যাক্স" : "Tax"}</span>
          <input type="number" min={0} className="gp-input" value={value.tax} onChange={(e) => onChange({ ...value, tax: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "পেইড" : "Paid"}</span>
          <input type="number" min={0} className="gp-input" value={value.paidAmount} onChange={(e) => onChange({ ...value, paidAmount: Math.max(0, Number(e.target.value)) })} />
        </label>
      </div>

      <div className="rounded-xl border border-line bg-[var(--gp-bg)] p-4 text-sm">
        <Row label={bn ? "ভিজিট চার্জ" : "Visit charge"} value={formatBDT(totals.visitCharge, locale)} />
        <Row label={bn ? "সার্ভিস লাইন" : "Service lines"} value={formatBDT(totals.serviceLinesTotal, locale)} />
        <Row label={bn ? "সার্ভিস চার্জ (মোট)" : "Service charges"} value={formatBDT(totals.serviceCharges, locale)} />
        <Row label={bn ? "পার্টস" : "Parts"} value={formatBDT(totals.partsTotal, locale)} />
        <Row label={bn ? "গ্র্যান্ড টোটাল" : "Grand total"} value={formatBDT(totals.grandTotal, locale)} strong />
        <Row label={bn ? "বাকি" : "Due"} value={formatBDT(totals.dueAmount, locale)} warn={totals.dueAmount > 0} />
      </div>
    </div>
  );
}

function Row({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-b border-line/70 py-1.5 last:border-0 ${strong ? "font-bold" : ""} ${warn ? "text-[var(--gp-warn)]" : ""}`}>
      <span>{label}</span>
      <span className={strong ? "text-base" : "font-semibold"}>{value}</span>
    </div>
  );
}

export function toBillingPayload(value: ServiceBillingValue) {
  const totals = computeServiceTotals({
    serviceLines: value.serviceLines,
    parts: value.parts,
    visitCharge: value.visitCharge,
    discount: value.discount,
    tax: value.tax,
    paidAmount: value.paidAmount,
  });
  return {
    visitCharge: totals.visitCharge,
    serviceLines: totals.serviceLines,
    parts: totals.parts as ServiceMoneyLine[],
    discount: totals.discount,
    tax: totals.tax,
    paidAmount: totals.paidAmount,
    locationId: value.locationId || undefined,
  };
}
