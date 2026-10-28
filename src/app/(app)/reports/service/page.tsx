"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { formatDuration } from "@/lib/service-visit";

type Scope = "snapshot" | "technician" | "equipment" | "parts" | "amc" | "complaints" | "sla";
type RangeView = "all" | "today" | "7d" | "30d" | "month";

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

type Totals = { jobs: number; charges: number; parts: number; billed: number; paid: number; due: number };
type KindRow = { id: string; n: number; billed: number; due: number };
type AmcSum = { total: number; active: number; expired: number; cancelled: number; amount: number };

const KINDS = ["complaint", "scheduled", "emergency", "installation", "general"] as const;

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
  return bn && row.customerBn ? row.customerBn : row.customer || "—";
}

function jobHref(row: Row) {
  if (!row._id) return "";
  if (row.jobKind === "complaint") return `/services/complaints/${row._id}`;
  if (row.jobKind === "installation") return `/services/projects/${row._id}`;
  return `/services/${row._id}`;
}

export default function ServiceReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [totals, setTotals] = useState<Totals>({ jobs: 0, charges: 0, parts: 0, billed: 0, paid: 0, due: 0 });
  const [byKind, setByKind] = useState<KindRow[]>([]);
  const [slaOverdue, setSlaOverdue] = useState(0);
  const [amc, setAmc] = useState<AmcSum>({ total: 0, active: 0, expired: 0, cancelled: 0, amount: 0 });
  const [technicians, setTechnicians] = useState<Row[]>([]);
  const [equipment, setEquipment] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [complaints, setComplaints] = useState<Row[]>([]);
  const [sla, setSla] = useState<Row[]>([]);
  const [amcRows, setAmcRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<RangeView | "">("all");
  const [scope, setScope] = useState<Scope>("snapshot");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (rangeNext = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ kind: "desk" });
    if (rangeNext.from) qs.set("from", rangeNext.from);
    if (rangeNext.to) qs.set("to", rangeNext.to);
    try {
      const res = await fetch(`/api/reports/service?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setTotals(json.totals || { jobs: 0, charges: 0, parts: 0, billed: 0, paid: 0, due: 0 });
      setByKind(json.byKind || []);
      setSlaOverdue(Number(json.slaOverdue) || 0);
      setAmc(json.amc || { total: 0, active: 0, expired: 0, cancelled: 0, amount: 0 });
      setTechnicians(json.technicians || []);
      setEquipment(json.equipment || []);
      setParts(json.parts || []);
      setComplaints(json.complaints || []);
      setSla(json.sla || []);
      setAmcRows(json.amcRows || []);
      setError("");
    } catch {
      setTotals({ jobs: 0, charges: 0, parts: 0, billed: 0, paid: 0, due: 0 });
      setTechnicians([]);
      setEquipment([]);
      setParts([]);
      setComplaints([]);
      setSla([]);
      setAmcRows([]);
      setError(bn ? "রিপোর্ট লোড হয়নি।" : "Could not load the report.");
    } finally {
      setLoading(false);
    }
  }, [bn, from, to]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRange(view: RangeView) {
    const next = rangeFor(view);
    setRange(view);
    setFrom(next.from);
    setTo(next.to);
    void load(next);
  }

  const source = useMemo(() => {
    if (scope === "technician") return technicians;
    if (scope === "equipment") return equipment;
    if (scope === "parts") return parts;
    if (scope === "amc") return amcRows;
    if (scope === "complaints") return complaints;
    if (scope === "sla") return sla;
    return sla.length ? sla : technicians.slice(0, 8);
  }, [amcRows, complaints, equipment, parts, scope, sla, technicians]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return source.filter((row) => {
      if (kind && String(row.jobKind || "") !== kind) return false;
      if (!needle) return true;
      return [row.label, row.customer, row.customerBn, row.mobile, row.issue, row.speciality, row.unit, row.status]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [kind, search, source]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "snapshot", en: "Snapshot", bn: "সারাংশ", n: totals.jobs },
    { id: "technician", en: "Technicians", bn: "টেকনিশিয়ান", n: technicians.length },
    { id: "equipment", en: "Equipment", bn: "ইকুইপমেন্ট", n: equipment.length },
    { id: "parts", en: "Parts", bn: "পার্টস", n: parts.length },
    { id: "amc", en: "AMC", bn: "এএমসি", n: amc.total },
    { id: "complaints", en: "Complaints", bn: "কমপ্লেইন", n: complaints.length },
    { id: "sla", en: "SLA", bn: "এসএলএ", n: slaOverdue },
  ];

  const views: { id: RangeView; en: string; bn: string }[] = [
    { id: "all", en: "All time", bn: "সব সময়" },
    { id: "today", en: "Today", bn: "আজ" },
    { id: "7d", en: "7 days", bn: "৭ দিন" },
    { id: "30d", en: "30 days", bn: "৩০ দিন" },
    { id: "month", en: "This month", bn: "এই মাস" },
  ];

  function cardTone(row: Row, mode: Scope) {
    if (mode === "sla" || row.overdue) return "is-danger";
    if (mode === "amc") {
      if (row.status === "expired") return "is-danger";
      if (row.status === "cancelled") return "is-info";
      return "is-ok";
    }
    if (Number(row.due || 0) > 0) return "is-warn";
    if (mode === "parts") return "is-info";
    return "is-ok";
  }

  function kindCount(id: string) {
    return byKind.find((row) => row.id === id)?.n || 0;
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "সার্ভিস রিপোর্ট" : "Service reports"}
        subtitle={bn
          ? "জব, বিল, এএমসি, পার্টস ও SLA — এক স্ক্রিনে।"
          : "Jobs, billing, AMC, parts and SLA — one screen."}
        stats={[
          { value: totals.jobs, label: bn ? "জব" : "jobs" },
          { value: moneyShort(totals.billed, locale), label: bn ? "বিল" : "billed" },
          { value: moneyShort(totals.due, locale), label: bn ? "বাকি" : "due" },
          { value: slaOverdue, label: "SLA" },
        ]}
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

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {pills.map((pill) => (
            <button key={pill.id} type="button" className={scope === pill.id ? "on" : ""} onClick={() => setScope(pill.id)}>
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/services" className="gp-btn gp-btn-ghost">{bn ? "ডেস্ক" : "Desk"}</Link>
        <Link href="/services/technicians" className="gp-btn gp-btn-ghost">{bn ? "রোস্টার" : "Roster"}</Link>
        <Link href="/services/amc" className="gp-btn gp-btn-ghost">AMC</Link>
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

      <div className="fu-views">
        {views.map((view) => (
          <button key={view.id} type="button" className={range === view.id ? "on" : ""} onClick={() => applyRange(view.id)}>
            {bn ? view.bn : view.en}
          </button>
        ))}
        <button type="button" className={kind === "" ? "on" : ""} onClick={() => setKind("")}>
          {bn ? "সব ধরন" : "All kinds"}
        </button>
        {KINDS.map((idk) => (
          <button key={idk} type="button" className={kind === idk ? "on" : ""} onClick={() => setKind(idk)}>
            {kindLabel(idk, bn)}
            {kindCount(idk) ? <em>{kindCount(idk)}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}

        {!loading && scope === "snapshot" ? (
          <div className="fu-list">
            {byKind.filter((row) => !kind || row.id === kind).map((row) => (
              <article key={row.id} className={`fu-card ${row.due > 0 ? "is-warn" : "is-info"}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(kindLabel(row.id, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>{kindLabel(row.id, bn)}</strong>
                    <p>{bn ? `${row.n} জব` : `${row.n} jobs`}{row.due > 0 ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(row.due, locale)}` : ""}</p>
                  </div>
                  <span className="fu-chip is-info">{moneyShort(row.billed, locale)}</span>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">{bn ? "জব ধরন অনুযায়ী বিল।" : "Billed by job kind."}</p>
                  <button type="button" className="fld-act" onClick={() => { setKind(row.id); setScope(row.id === "complaint" ? "complaints" : "snapshot"); }}>
                    {bn ? "দেখুন" : "View"}
                  </button>
                </div>
              </article>
            ))}
            <article className={`fu-card ${amc.expired ? "is-warn" : "is-ok"}`}>
              <div className="fu-card-top">
                <span className="fu-avatar">AM</span>
                <div className="min-w-0 flex-1">
                  <strong>AMC</strong>
                  <p>{bn ? `${amc.active} সক্রিয় · ${amc.expired} মেয়াদোত্তীর্ণ` : `${amc.active} active · ${amc.expired} expired`}</p>
                </div>
                <span className={`fu-chip ${amc.expired ? "is-warn" : "is-ok"}`}>{moneyShort(amc.amount, locale)}</span>
              </div>
              <div className="fu-card-foot">
                <p className="fu-meta">{bn ? "কন্ট্রাক্ট ভিজিট ও বিল।" : "Contract visits and billing."}</p>
                <button type="button" className="fld-act" onClick={() => setScope("amc")}>{bn ? "লিস্ট" : "List"}</button>
                <Link className="fld-act" href="/services/amc">{bn ? "এএমসি" : "AMC"}</Link>
              </div>
            </article>
            <article className={`fu-card ${totals.parts > 0 ? "is-info" : "is-ok"}`}>
              <div className="fu-card-top">
                <span className="fu-avatar">PT</span>
                <div className="min-w-0 flex-1">
                  <strong>{bn ? "পার্টস" : "Parts"}</strong>
                  <p>{bn ? `${parts.length} আইটেম` : `${parts.length} items`}</p>
                </div>
                <span className="fu-chip is-info">{moneyShort(totals.parts, locale)}</span>
              </div>
              <div className="fu-card-foot">
                <p className="fu-meta">{bn ? "জবে ব্যবহৃত স্পেয়ার।" : "Spares used on jobs."}</p>
                <button type="button" className="fld-act" onClick={() => setScope("parts")}>{bn ? "লিস্ট" : "List"}</button>
              </div>
            </article>
          </div>
        ) : null}

        {!loading && filtered.length === 0 && (scope !== "snapshot" || (!byKind.length && !amc.total && !parts.length)) ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "রিপোর্ট খালি" : "No report rows"}
              message={
                totals.jobs === 0
                  ? (bn ? "ডেমো ডেটা লোড করুন, অথবা তারিখ সরান।" : "Load demo data, or clear the dates.")
                  : (bn ? "এই ফিল্টারে ডেটা নেই।" : "Nothing in this filter.")
              }
            />
            {totals.jobs === 0 ? (
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

        {!loading && scope !== "snapshot" ? (
          <div className="fu-list">
            {filtered.map((row, i) => {
              const tone = cardTone(row, scope);
              const name = customerName(row, bn);
              const href = scope === "technician" && row._id
                ? `/services/technicians/${row._id}`
                : scope === "equipment" && row._id
                  ? `/services/machines/${row._id}`
                  : scope === "amc"
                    ? "/services/amc"
                    : jobHref(row);
              const title = row.label || "—";
              const chip = scope === "sla"
                ? (bn ? `ওভারডিউ ${row.hours}ঘ` : `Overdue ${row.hours}h`)
                : scope === "parts"
                  ? `${row.qty || 0} ${bn ? "পিস" : "pcs"}`
                  : scope === "amc"
                    ? statusLabel(row.status, bn)
                    : statusLabel(row.status, bn) || String(row.jobs || "");
              return (
                <article key={`${title}-${row._id || i}`} className={`fu-card ${tone}`}>
                  <div className="fu-card-top">
                    <span className="fu-avatar">{initials(scope === "parts" || scope === "technician" ? title : name)}</span>
                    <div className="min-w-0 flex-1">
                      <strong>{href ? <Link href={href}>{title}</Link> : title}</strong>
                      <p>
                        {row.customerId ? (
                          <Link href={`/contacts/${row.customerId}/statement`}>{name}</Link>
                        ) : scope === "technician" ? (
                          [row.speciality, row.mobile].filter(Boolean).join(" · ") || (bn ? "দক্ষতা নেই" : "No speciality")
                        ) : (
                          name
                        )}
                        {row.unit ? ` · ${row.unit}` : ""}
                      </p>
                    </div>
                    <span className={`fu-chip ${tone}`}>{chip || "—"}</span>
                  </div>
                  {row.issue ? <p className="fu-note">{row.issue}</p> : null}
                  <div className="fu-card-foot">
                    <p className="fu-meta">
                      {scope === "technician"
                        ? `${row.jobs || 0} ${bn ? "জব" : "jobs"}${row.minutes ? ` · ${formatDuration(Number(row.minutes), bn ? "bn" : "en")}` : ""}${Number(row.billed || 0) ? ` · ${moneyShort(Number(row.billed || 0), locale)}` : ""}${Number(row.due || 0) ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(Number(row.due || 0), locale)}` : ""}`
                        : scope === "equipment"
                          ? `${row.jobs || 0} ${bn ? "জব" : "jobs"}${Number(row.billed || 0) ? ` · ${moneyShort(Number(row.billed || 0), locale)}` : ""}${Number(row.due || 0) ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(Number(row.due || 0), locale)}` : ""}`
                          : scope === "parts"
                            ? moneyShort(Number(row.amount || 0), locale)
                            : scope === "amc"
                              ? `${row.visits || ""}${Number(row.amount || 0) ? ` · ${moneyShort(Number(row.amount || 0), locale)}` : ""}`
                              : scope === "sla"
                                ? `${kindLabel(row.jobKind, bn)} · ${statusLabel(row.status, bn)} · ${row.hours}h / ${row.limit}h`
                                : `${statusLabel(row.status, bn)}${Number(row.due || 0) ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(Number(row.due || 0), locale)}` : Number(row.billed || 0) ? ` · ${moneyShort(Number(row.billed || 0), locale)}` : ""}`}
                    </p>
                    {href ? <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link> : null}
                    {scope === "technician" ? <Link className="fld-act" href="/services/dispatch/assign">{bn ? "অ্যাসাইন" : "Assign"}</Link> : null}
                    {scope === "sla" || scope === "complaints" ? <Link className="fld-act" href={`/m/${row._id}`}>{bn ? "ফিল্ড" : "Field"}</Link> : null}
                    {scope === "amc" ? <Link className="fld-act" href="/reports/service/amc">{bn ? "রিপোর্ট" : "Report"}</Link> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && scope === "snapshot" && sla.length > 0 ? (
          <div className="fu-list" style={{ marginTop: "0.75rem" }}>
            {sla.filter((row) => !kind || row.jobKind === kind).slice(0, 12).map((row) => {
              const href = jobHref(row);
              return (
                <article key={row._id} className="fu-card is-danger">
                  <div className="fu-card-top">
                    <span className="fu-avatar">{initials(customerName(row, bn))}</span>
                    <div className="min-w-0 flex-1">
                      <strong>{href ? <Link href={href}>{row.label || "—"}</Link> : row.label || "—"}</strong>
                      <p>
                        {row.customerId ? <Link href={`/contacts/${row.customerId}/statement`}>{customerName(row, bn)}</Link> : customerName(row, bn)}
                      </p>
                    </div>
                    <span className="fu-chip is-danger">{bn ? `SLA ${row.hours}ঘ` : `SLA ${row.hours}h`}</span>
                  </div>
                  {row.issue ? <p className="fu-note">{row.issue}</p> : null}
                  <div className="fu-card-foot">
                    <p className="fu-meta">{kindLabel(row.jobKind, bn)} · {statusLabel(row.status, bn)} · {row.hours}h / {row.limit}h</p>
                    {href ? <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link> : null}
                    <Link className="fld-act" href={`/m/${row._id}`}>{bn ? "ফিল্ড" : "Field"}</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
