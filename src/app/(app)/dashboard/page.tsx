"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  List,
  Package,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { AlertBanner, EmptyState, Field, Modal } from "@/components/ui";
import { CompanyToday, type CompanyTodayData } from "@/components/CompanyToday";
import { formatBDT } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { todayKey } from "@/lib/service-visit";

type Dash = {
  kpis: {
    totalSales: number;
    net: number;
    invoiceDue: number;
    sellReturn: number;
    totalPurchase: number;
    purchaseDue: number;
    purchaseReturn: number;
    expenses: number;
    todaySales: number;
    lowStockCount: number;
  };
  trend: { _id: string; total: number }[];
  charts?: {
    salesByStatus?: { _id: string; total: number }[];
    expensesByCategory?: { _id: string; total: number }[];
  };
  recentSales: {
    _id: string;
    invoiceNo: string;
    customerName: string;
    grandTotal: number;
    saleDate: string;
  }[];
  lowStock: { name: string; nameBn?: string; sku: string; qty: number }[];
  locations: { _id: string; name: string }[];
  widgets: {
    salesPaymentDue: { invoiceNo?: string; customerName?: string; dueAmount?: number }[];
    purchasePaymentDue: { referenceNo?: string; supplierName?: string; dueAmount?: number }[];
    purchaseRequisitions: { reqNo?: string; locationName?: string; status?: string }[];
    pendingShipments: { shipmentNo?: string; customerName?: string; status?: string }[];
  };
};

function dashTk(amount: number, locale: string) {
  return formatBDT(Number(amount) || 0, locale).replace(/\.00$/, "");
}

function axisTk(n: number) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

const EXPENSE_COLORS = ["#1d4ed8", "#047857", "#c2410c", "#7c3aed", "#dc2626", "#0f766e", "#a16207", "#0369a1"];
const STATUS_COLORS = ["#1d4ed8", "#047857", "#c2410c", "#7c3aed", "#0f766e"];

export default function DashboardPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [data, setData] = useState<Dash | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locationId, setLocationId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<{ title: string; rows: Record<string, unknown>[] } | null>(null);
  const [company, setCompany] = useState<CompanyTodayData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [todayLabel, setTodayLabel] = useState("");

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (locationId) qs.set("locationId", locationId);
    setLoadError("");
    const [dash, today] = await Promise.all([
      fetchJson<Dash>(`/api/dashboard?${qs}`),
      fetchJson<CompanyTodayData>(`/api/today?date=${todayKey()}`),
    ]);
    if (dash.ok && dash.data) setData(dash.data);
    else setLoadError(t("common.error"));
    if (today.ok && today.data) setCompany(today.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", {
        timeZone: "Asia/Dhaka",
        numberingSystem: "latn",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
  }, [locale]);

  async function openBreakdown(type: string, title: string) {
    const qs = new URLSearchParams({ breakdown: type });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (locationId) qs.set("locationId", locationId);
    const res = await fetch(`/api/dashboard?${qs}`);
    const json = await res.json();
    setModal({ title, rows: json.rows || [] });
  }

  const chartData = useMemo(
    () => (data?.trend || []).map((d) => ({ date: d._id.slice(5), total: d.total })),
    [data],
  );

  const expenseRows = data?.charts?.expensesByCategory || [];
  const expenseTotal = expenseRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const statusRows = data?.charts?.salesByStatus || [];
  const kpis = data?.kpis;
  const widgets = data?.widgets;
  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid var(--gp-line)",
    fontSize: 12,
  };

  const finance = [
    { key: "sales", label: t("dashboard.totalSales"), value: kpis?.totalSales || 0, tone: "", breakdown: "sales" },
    { key: "net", label: t("dashboard.net"), value: kpis?.net || 0, tone: "info", breakdown: "sales" },
    { key: "purchase", label: t("dashboard.totalPurchase"), value: kpis?.totalPurchase || 0, tone: "", breakdown: "purchases" },
    { key: "expense", label: t("dashboard.expenses"), value: kpis?.expenses || 0, tone: "danger", breakdown: "expenses" },
    { key: "invDue", label: t("dashboard.invoiceDue"), value: kpis?.invoiceDue || 0, tone: "warn", breakdown: "due" },
    { key: "purDue", label: t("dashboard.purchaseDue"), value: kpis?.purchaseDue || 0, tone: "warn", breakdown: "purchase-due" },
    { key: "sellRet", label: t("dashboard.sellReturn"), value: kpis?.sellReturn || 0, tone: "danger", breakdown: "sell-returns" },
    { key: "purRet", label: t("dashboard.purchaseReturn"), value: kpis?.purchaseReturn || 0, tone: "danger", breakdown: "purchase-returns" },
  ];

  return (
    <div className="dash-premium">
      <div className="dash-hero">
        <div>
          <h1 className="gp-display">{t("dashboard.companyToday")}</h1>
          <p>{todayLabel || t("dashboard.clickBreakdown")}</p>
        </div>
        <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-3 text-sm" onClick={() => setShowFilters((v) => !v)}>
          {t("dashboard.filters")}
        </button>
      </div>

      {loadError ? <AlertBanner tone="error" message={loadError} /> : null}
      <CompanyToday data={company} locale={locale} />

      {showFilters ? (
        <div className="dash-filter">
          <Field label={t("dashboard.fromDate")}>
            <input type="date" className="gp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t("dashboard.toDate")}>
            <input type="date" className="gp-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={t("dashboard.location")}>
            <select className="gp-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{t("dashboard.allLocations")}</option>
              {(data?.locations || []).map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <button type="button" className="gp-btn gp-btn-primary flex-1" onClick={load}>
              {t("dashboard.apply")}
            </button>
            <button
              type="button"
              className="gp-btn gp-btn-ghost flex-1"
              onClick={() => {
                setFrom("");
                setTo("");
                setLocationId("");
                setTimeout(load, 0);
              }}
            >
              {t("dashboard.reset")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="dash-stat-grid">
        {finance.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dash-stat ${item.tone === "warn" ? "dash-stat-warn" : item.tone === "danger" ? "dash-stat-danger" : item.tone === "info" ? "dash-stat-info" : ""}`}
            onClick={() => openBreakdown(item.breakdown, item.label)}
          >
            <span>{item.label}</span>
            <b>{dashTk(item.value, locale)}</b>
          </button>
        ))}
      </div>

      <div className="dash-chart-grid">
        <div className="dash-panel dash-chart-wide">
          <div className="dash-panel-head">
            <h2>{t("dashboard.salesTrend")}</h2>
            <p>{dashTk(kpis?.totalSales || 0, locale)}</p>
          </div>
          <div className="dash-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="#e8eef4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} width={44} tickFormatter={axisTk} />
                <Tooltip formatter={(v) => dashTk(Number(v || 0), locale)} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="#1d4ed8" strokeWidth={2.5} fill="url(#salesTrendFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <h2>{t("dashboard.expenseBreakdown")}</h2>
            <p>{dashTk(expenseTotal, locale)}</p>
          </div>
          <div className="dash-split">
            <div className="dash-chart-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseRows}
                    dataKey="total"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={52}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {expenseRows.map((_, index) => (
                      <Cell key={`exp-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => dashTk(Number(v || 0), locale)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="dash-legend">
              {expenseRows.slice(0, 6).map((row, index) => {
                const pct = expenseTotal ? Math.round((Number(row.total) / expenseTotal) * 100) : 0;
                return (
                  <li key={row._id}>
                    <i style={{ background: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }} />
                    <span>{row._id || "—"}</span>
                    <b>{pct}%</b>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="dash-chart-grid">
        <div className="dash-panel dash-chart-wide">
          <div className="dash-panel-head">
            <h2>{t("dashboard.salesByStatus")}</h2>
          </div>
          <div className="dash-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#e8eef4" vertical={false} />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} width={44} tickFormatter={axisTk} />
                <Tooltip formatter={(v) => dashTk(Number(v || 0), locale)} cursor={{ fill: "#f8fafc" }} contentStyle={tooltipStyle} />
                <Bar dataKey="total" radius={[5, 5, 2, 2]} barSize={26}>
                  {statusRows.map((_, index) => (
                    <Cell key={`st-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <h2>{t("dashboard.stockAlerts")}</h2>
            <Link href="/reports/stock" className="dash-link">
              {t("common.view")}
            </Link>
          </div>
          <ul className="dash-stock">
            {(data?.lowStock || []).length === 0 ? (
              <li className="dash-stock-empty">{t("common.noData")}</li>
            ) : (
              (data?.lowStock || []).slice(0, 7).map((p) => (
                <li key={p.sku}>
                  <span>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</span>
                  <b>{p.qty}</b>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="dash-panel">
        <h2 className="mb-2">{bn ? "দ্রুত কাজ" : "Quick actions"}</h2>
        <div className="dash-qa-grid">
          <button type="button" className="dash-qa dash-qa-blue" onClick={() => openBreakdown("due", t("dashboard.salesPaymentDue"))}>
            <ShoppingCart className="h-4 w-4" />
            {t("dashboard.salesPaymentDue")}
          </button>
          <button type="button" className="dash-qa dash-qa-orange" onClick={() => openBreakdown("purchase-due", t("dashboard.purchasePaymentDue"))}>
            <Truck className="h-4 w-4" />
            {t("dashboard.purchasePaymentDue")}
          </button>
          <Link href="/sales" className="dash-qa dash-qa-purple">
            <List className="h-4 w-4" />
            {t("dashboard.recentSales")}
          </Link>
          <Link href="/purchases/requisition" className="dash-qa dash-qa-green">
            <Users className="h-4 w-4" />
            {t("dashboard.purchaseRequisition")}
          </Link>
          <Link href="/pos" className="dash-qa dash-qa-blue">
            <ShoppingCart className="h-4 w-4" />
            {t("nav.pos")}
          </Link>
          <Link href="/purchases/returns" className="dash-qa dash-qa-orange">
            <RotateCcw className="h-4 w-4" />
            {t("nav.purchaseReturns")}
          </Link>
          <Link href="/stock" className="dash-qa dash-qa-mint">
            <Package className="h-4 w-4" />
            {t("nav.stock")}
          </Link>
          <Link href="/reports" className="dash-qa dash-qa-amber">
            <BarChart3 className="h-4 w-4" />
            {t("nav.reports")}
          </Link>
        </div>
        {(widgets?.purchaseRequisitions || []).length > 0 ? (
          <button
            type="button"
            className="dash-qa-alert mt-2"
            onClick={() => openBreakdown("requisitions", t("dashboard.purchaseRequisition"))}
          >
            <AlertTriangle className="h-4 w-4" />
            {(widgets?.purchaseRequisitions || []).length} {t("dashboard.purchaseRequisition")}
          </button>
        ) : null}
      </div>

      <Modal open={!!modal} title={modal?.title || ""} onClose={() => setModal(null)} wide>
        {!modal?.rows?.length ? (
          <EmptyState message={t("common.noData")} />
        ) : (
          <div className="overflow-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  {Object.keys(modal.rows[0])
                    .filter((k) => !k.startsWith("_") && k !== "items" && k !== "payments" && k !== "stocks")
                    .slice(0, 6)
                    .map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {modal.rows.map((row, idx) => (
                  <tr key={idx}>
                    {Object.entries(row)
                      .filter(([k]) => !k.startsWith("_") && k !== "items" && k !== "payments" && k !== "stocks")
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <td key={k}>
                          {typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 40) : String(v ?? "")}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
