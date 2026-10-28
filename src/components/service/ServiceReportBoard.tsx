"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { formatDuration } from "@/lib/service-visit";

type Row = {
  _id?: string;
  label?: string;
  customer?: string;
  customerBn?: string;
  customerId?: string;
  mobile?: string;
  speciality?: string;
  jobs?: number;
  billed?: number;
  due?: number;
  minutes?: number;
  qty?: number;
  amount?: number;
  status?: string;
  visits?: string;
  unit?: string;
  issue?: string;
  overdue?: boolean;
  hours?: number;
  limit?: number;
  jobKind?: string;
  value?: number;
};

type RangeView = "all" | "today" | "7d" | "30d" | "month";

type Props = {
  kind: string;
  title: string;
  subtitle: string;
  embedded?: boolean;
};

const CLOSED = new Set(["resolved", "closed", "completed", "delivered", "cancelled"]);

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["PM visit", "পিএম ভিজিট"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  installation: ["Install", "ইনস্টল"],
  general: ["General", "জেনারেল"],
};

const STATUS: Record<string, [string, string]> = {
  pending: ["Pending", "পেন্ডিং"],
  reported: ["Reported", "রিপোর্টেড"],
  assigned: ["Assigned", "অ্যাসাইনড"],
  in_progress: ["In progress", "চলছে"],
  waiting_parts: ["Parts", "পার্টস"],
  on_site: ["On site", "অন সাইট"],
  resolved: ["Resolved", "সমাধান"],
  completed: ["Completed", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  delivered: ["Delivered", "ডেলিভার"],
  cancelled: ["Cancelled", "বাতিল"],
  active: ["Active", "সক্রিয়"],
  expired: ["Expired", "মেয়াদোত্তীর্ণ"],
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function rangeFor(view: RangeView) {
  const now = new Date();
  const today = ymd(now);
  if (view === "today") return { from: today, to: today };
  if (view === "7d") return { from: ymd(addDays(now, -6)), to: today };
  if (view === "30d") return { from: ymd(addDays(now, -29)), to: today };
  if (view === "month") return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: today };
  return { from: "", to: "" };
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "RP";
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function kindLabel(kind: string | undefined, bn: boolean) {
  const row = KIND[String(kind || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : kind || "—";
}

function statusLabel(status: string | undefined, bn: boolean) {
  const row = STATUS[String(status || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : status || "—";
}

function customerName(row: Row, bn: boolean) {
  return bn && row.customerBn ? row.customerBn : row.customer || "";
}

function jobHref(row: Row) {
  if (!row._id) return "";
  if (row.jobKind === "complaint") return `/services/complaints/${row._id}`;
  if (row.jobKind === "installation") return `/services/projects/${row._id}`;
  return `/services/${row._id}`;
}

function rowHref(kind: string, row: Row) {
  if (kind === "technician" && row._id) return `/services/technicians/${row._id}`;
  if (kind === "equipment" && row._id) return `/services/machines/${row._id}`;
  if (kind === "amc") return "/services/amc";
  if (kind === "parts") return "";
  return jobHref(row);
}

export function ServiceReportBoard({ kind, title, subtitle, embedded }: Props) {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<RangeView | "">("all");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (next = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ kind });
    if (next.from) qs.set("from", next.from);
    if (next.to) qs.set("to", next.to);
    try {
      const res = await fetch(`/api/reports/service?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setRows(json.data || json.summary || []);
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "রিপোর্ট লোড হয়নি।" : "Could not load the report.");
    } finally {
      setLoading(false);
    }
  }, [bn, from, kind, to]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function applyRange(view: RangeView) {
    const next = rangeFor(view);
    setRange(view);
    setFrom(next.from);
    setTo(next.to);
    void load(next);
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      if (scope === "due" && !(Number(row.due || 0) > 0)) return false;
      if (scope === "active" && status !== "active") return false;
      if (scope === "expired" && status !== "expired") return false;
      if (scope === "cancelled" && status !== "cancelled") return false;
      if (scope === "open" && CLOSED.has(status)) return false;
      if (scope === "closed" && !CLOSED.has(status)) return false;
      if (!needle) return true;
      return [row.label, row.customer, row.customerBn, row.mobile, row.issue, row.speciality, row.unit, row.status]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [rows, scope, search]);

  const jobs = rows.reduce((n, r) => n + Number(r.jobs || 0), 0);
  const billed = rows.reduce((n, r) => n + Number(r.billed || r.amount || 0), 0);
  const due = rows.reduce((n, r) => n + Number(r.due || 0), 0);
  const qty = rows.reduce((n, r) => n + Number(r.qty || 0), 0);
  const active = rows.filter((r) => String(r.status || "").toLowerCase() === "active").length;
  const expired = rows.filter((r) => String(r.status || "").toLowerCase() === "expired").length;
  const openN = rows.filter((r) => !CLOSED.has(String(r.status || "").toLowerCase())).length;

  const pills = (() => {
    if (kind === "amc") {
      return [
        { id: "all", en: "All contracts", bn: "সব চুক্তি", n: rows.length },
        { id: "active", en: "Active", bn: "সক্রিয়", n: active },
        { id: "expired", en: "Expired", bn: "মেয়াদোত্তীর্ণ", n: expired },
        { id: "cancelled", en: "Cancelled", bn: "বাতিল", n: rows.filter((r) => String(r.status).toLowerCase() === "cancelled").length },
      ];
    }
    if (kind === "complaints") {
      return [
        { id: "all", en: "All", bn: "সব", n: rows.length },
        { id: "open", en: "Open", bn: "ওপেন", n: openN },
        { id: "closed", en: "Closed", bn: "বন্ধ", n: rows.length - openN },
      ];
    }
    if (kind === "equipment") {
      return [
        { id: "all", en: "All units", bn: "সব ইউনিট", n: rows.length },
        { id: "due", en: "Due", bn: "বাকি", n: rows.filter((r) => Number(r.due || 0) > 0).length },
      ];
    }
    if (kind === "sla") {
      return [{ id: "all", en: "Overdue", bn: "ওভারডিউ", n: rows.length }];
    }
    return [{ id: "all", en: "All rows", bn: "সব রো", n: rows.length }];
  })();

  const stats = (() => {
    if (kind === "parts") {
      return [
        { value: rows.length, label: bn ? "আইটেম" : "items" },
        { value: qty, label: bn ? "পিস" : "pcs" },
        { value: moneyShort(billed, locale), label: bn ? "মূল্য" : "amount" },
        { value: filtered.length, label: bn ? "দেখাচ্ছে" : "showing" },
      ];
    }
    if (kind === "amc") {
      return [
        { value: rows.length, label: bn ? "চুক্তি" : "contracts" },
        { value: active, label: bn ? "সক্রিয়" : "active" },
        { value: expired, label: bn ? "মেয়াদোত্তীর্ণ" : "expired" },
        { value: moneyShort(billed, locale), label: bn ? "বিল" : "billed" },
      ];
    }
    if (kind === "sla") {
      return [
        { value: rows.length, label: bn ? "ওভারডিউ" : "overdue" },
        { value: rows.filter((r) => Number(r.hours || 0) > Number(r.limit || 0) + 24).length, label: bn ? "২৪ঘ+" : "24h+" },
        { value: openN, label: bn ? "ওপেন" : "open" },
        { value: filtered.length, label: bn ? "দেখাচ্ছে" : "showing" },
      ];
    }
    return [
      { value: rows.length, label: bn ? "রো" : "rows" },
      { value: jobs || rows.length, label: bn ? "জব" : "jobs" },
      { value: moneyShort(billed, locale), label: bn ? "বিল" : "billed" },
      { value: moneyShort(due, locale), label: bn ? "বাকি" : "due" },
    ];
  })();

  const views: { id: RangeView; en: string; bn: string }[] = [
    { id: "all", en: "All time", bn: "সব সময়" },
    { id: "today", en: "Today", bn: "আজ" },
    { id: "7d", en: "7 days", bn: "৭ দিন" },
    { id: "30d", en: "30 days", bn: "৩০ দিন" },
    { id: "month", en: "This month", bn: "এই মাস" },
  ];

  function cardTone(row: Row) {
    if (kind === "sla" || row.overdue) return "is-danger";
    if (String(row.status || "").toLowerCase() === "expired") return "is-danger";
    if (String(row.status || "").toLowerCase() === "cancelled") return "is-info";
    if (Number(row.due || 0) > 0) return "is-warn";
    if (kind === "parts") return "is-info";
    return "is-ok";
  }

  function chip(row: Row) {
    if (kind === "parts") return `${row.qty || 0} ${bn ? "পিস" : "pcs"}`;
    if (kind === "sla") return bn ? `ওভারডিউ ${row.hours}ঘ` : `Overdue ${row.hours}h`;
    if (row.status) return statusLabel(row.status, bn);
    if (row.jobs != null) return `${row.jobs} ${bn ? "জব" : "jobs"}`;
    return moneyShort(Number(row.value || 0), locale);
  }

  function meta(row: Row) {
    if (kind === "technician") {
      return `${row.jobs || 0} ${bn ? "জব" : "jobs"}${row.minutes ? ` · ${formatDuration(Number(row.minutes), bn ? "bn" : "en")}` : ""}${row.billed ? ` · ${moneyShort(Number(row.billed), locale)}` : ""}`;
    }
    if (kind === "equipment") {
      return `${row.jobs || 0} ${bn ? "জব" : "jobs"}${row.billed ? ` · ${moneyShort(Number(row.billed), locale)}` : ""}${Number(row.due || 0) ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(Number(row.due), locale)}` : ""}`;
    }
    if (kind === "parts") return moneyShort(Number(row.amount || 0), locale);
    if (kind === "amc") return `${row.visits || ""}${row.unit ? ` · ${row.unit}` : ""}${row.amount ? ` · ${moneyShort(Number(row.amount), locale)}` : ""}`;
    if (kind === "sla") return `${kindLabel(row.jobKind, bn)} · ${statusLabel(row.status, bn)} · ${row.hours}h / ${row.limit}h`;
    return `${statusLabel(row.status, bn)}${Number(row.due || 0) ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(Number(row.due), locale)}` : Number(row.billed || 0) ? ` · ${moneyShort(Number(row.billed), locale)}` : ""}`;
  }

  const body = (
    <>
      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {pills.map((pill) => (
            <button key={pill.id} type="button" className={scope === pill.id ? "on" : ""} onClick={() => setScope(pill.id)}>
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        {!embedded ? <Link href="/reports/service" className="gp-btn gp-btn-ghost">{bn ? "রিপোর্ট" : "Reports"}</Link> : null}
        {kind === "amc" ? <Link href="/services/amc" className="gp-btn gp-btn-ghost">AMC</Link> : null}
        {kind === "complaints" || kind === "sla" ? <Link href="/services/complaints" className="gp-btn gp-btn-ghost">{bn ? "কমপ্লেইন" : "Complaints"}</Link> : null}
        {kind === "equipment" ? <Link href="/services/machines" className="gp-btn gp-btn-ghost">{bn ? "ইকুইপমেন্ট" : "Equipment"}</Link> : null}
        {kind === "parts" ? <Link href="/services/jobs" className="gp-btn gp-btn-ghost">{bn ? "জব" : "Jobs"}</Link> : null}
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            setFrom(value);
            setRange("");
            void load({ from: value, to });
          }}
        />
        <input
          type="date"
          aria-label={bn ? "শেষ তারিখ" : "To"}
          className="gp-input fu-search"
          value={to}
          onChange={(e) => {
            const value = e.target.value;
            setTo(value);
            setRange("");
            void load({ from, to: value });
          }}
        />
      </div>

      {kind !== "amc" ? (
        <div className="fu-views">
          {views.map((view) => (
            <button key={view.id} type="button" className={range === view.id ? "on" : ""} onClick={() => applyRange(view.id)}>
              {bn ? view.bn : view.en}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "রিপোর্ট খালি" : "No report rows"}
              message={
                rows.length === 0
                  ? (bn ? "ডেমো ডেটা লোড করুন, অথবা তারিখ সরান।" : "Load demo data, or clear the dates.")
                  : (bn ? "এই ফিল্টারে ডেটা নেই।" : "Nothing in this filter.")
              }
            />
            {rows.length === 0 ? (
              <button
                type="button"
                className="gp-btn gp-btn-primary"
                disabled={seeding}
                onClick={() => {
                  setSeeding(true);
                  void fetch("/api/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                    .then((res) => {
                      if (!res.ok) throw new Error("seed");
                      return load({ from, to });
                    })
                    .catch(() => setError(bn ? "ডেমো ডেটা লোড হয়নি।" : "Could not load demo data."))
                    .finally(() => setSeeding(false));
                }}
              >
                {seeding ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? "ডেমো ডেটা লোড করুন" : "Load demo data"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((row, i) => {
            const tone = cardTone(row);
            const href = rowHref(kind, row);
            const name = customerName(row, bn) || row.speciality || row.label || "—";
            const titleText = row.label || "—";
            return (
              <article key={`${titleText}-${row._id || i}`} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(kind === "parts" || kind === "technician" ? titleText : name)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>{href ? <Link href={href}>{titleText}</Link> : titleText}</strong>
                    <p>
                      {row.customerId ? (
                        <Link href={`/contacts/${row.customerId}/statement`}>{name}</Link>
                      ) : kind === "technician" ? (
                        [row.speciality, row.mobile].filter(Boolean).join(" · ") || (bn ? "দক্ষতা নেই" : "No speciality")
                      ) : (
                        name
                      )}
                      {row.unit && kind !== "amc" ? ` · ${row.unit}` : ""}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>{chip(row)}</span>
                </div>
                {row.issue ? <p className="fu-note">{row.issue}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">{meta(row)}</p>
                  {href ? <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link> : null}
                  {kind === "sla" || kind === "complaints" ? (
                    <Link className="fld-act" href={`/m/${row._id}`}>{bn ? "ফিল্ড" : "Field"}</Link>
                  ) : null}
                  {kind === "technician" && row._id ? (
                    <Link className="fld-act" href="/services/dispatch/assign">{bn ? "অ্যাসাইন" : "Assign"}</Link>
                  ) : null}
                  {kind === "amc" ? <Link className="fld-act" href="/services/amc">{bn ? "এএমসি" : "AMC"}</Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );

  if (embedded) return <div className="space-y-3">{body}</div>;

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস রিপোর্ট" : "Service reports"}
        title={title}
        subtitle={subtitle}
        stats={stats}
        actions={
          <input
            className="gp-input desk-hero-search"
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => setSearch(value), 200);
            }}
            placeholder={bn ? "নাম / জব / পার্টস" : "Name / job / parts"}
          />
        }
      />
      {body}
    </div>
  );
}
