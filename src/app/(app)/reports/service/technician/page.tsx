"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { formatDuration, todayKey } from "@/lib/service-visit";

type Scope = "all" | "working" | "idle" | "due" | "today";
type RangeView = "all" | "today" | "7d" | "30d" | "month";

type ReportRow = {
  _id?: string;
  label?: string;
  mobile?: string;
  speciality?: string;
  jobs?: number;
  billed?: number;
  due?: number;
  minutes?: number;
};

type TechRow = {
  _id: string;
  name: string;
  mobile?: string;
  speciality?: string;
};

type Board = { technician?: { _id?: string }; houseCount?: number };

type Row = {
  _id: string;
  name: string;
  mobile: string;
  speciality: string;
  jobs: number;
  billed: number;
  due: number;
  minutes: number;
  todayLoad: number;
};

const CAP = 4;

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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "TK";
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function cardTone(row: Row) {
  if (!row._id) return "is-warn";
  if (row.todayLoad >= CAP) return "is-danger";
  if (row.due > 0) return "is-warn";
  if (row.jobs > 0) return "is-ok";
  return "is-info";
}

export default function TechnicianPerformanceReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<RangeView | "">("all");
  const [scope, setScope] = useState<Scope>("all");
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (next = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ kind: "technician" });
    if (next.from) qs.set("from", next.from);
    if (next.to) qs.set("to", next.to);
    try {
      const [repRes, techRes, deskRes] = await Promise.all([
        fetch(`/api/reports/service?${qs}`),
        fetch("/api/technicians"),
        fetch(`/api/services/dispatch?date=${todayKey()}`),
      ]);
      const report = await repRes.json();
      const techs = await techRes.json();
      const desk = await deskRes.json().catch(() => ({}));
      if (!repRes.ok) throw new Error(report.error || "load");
      const stats = new Map<string, ReportRow>();
      for (const row of (report.data || []) as ReportRow[]) {
        stats.set(String(row._id || ""), row);
      }
      const loadMap: Record<string, number> = {};
      for (const board of (desk.boards || []) as Board[]) {
        const id = String(board.technician?._id || "");
        if (id) loadMap[id] = Number(board.houseCount || 0);
      }
      const roster = ((techs.data || []) as TechRow[]).map((tech) => {
        const stat = stats.get(tech._id);
        return {
          _id: tech._id,
          name: tech.name,
          mobile: tech.mobile || "",
          speciality: tech.speciality || "",
          jobs: Number(stat?.jobs || 0),
          billed: Number(stat?.billed || 0),
          due: Number(stat?.due || 0),
          minutes: Number(stat?.minutes || 0),
          todayLoad: loadMap[tech._id] || 0,
        };
      });
      const unassigned = stats.get("");
      if (unassigned && Number(unassigned.jobs || 0) > 0) {
        roster.push({
          _id: "",
          name: bn ? "আনঅ্যাসাইনড" : "Unassigned",
          mobile: "",
          speciality: "",
          jobs: Number(unassigned.jobs || 0),
          billed: Number(unassigned.billed || 0),
          due: Number(unassigned.due || 0),
          minutes: Number(unassigned.minutes || 0),
          todayLoad: 0,
        });
      }
      roster.sort((a, b) => b.jobs - a.jobs || b.billed - a.billed || a.name.localeCompare(b.name));
      setRows(roster);
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "পারফরম্যান্স লোড হয়নি।" : "Could not load performance.");
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

  const skills = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const s = String(row.speciality || "").trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (skill && row.speciality !== skill) return false;
      if (scope === "working" && row.jobs <= 0) return false;
      if (scope === "idle" && (row.jobs > 0 || !row._id)) return false;
      if (scope === "due" && row.due <= 0) return false;
      if (scope === "today" && row.todayLoad <= 0) return false;
      if (!needle) return true;
      return `${row.name} ${row.mobile} ${row.speciality}`.toLowerCase().includes(needle);
    });
  }, [rows, scope, search, skill]);

  const jobs = rows.reduce((n, r) => n + r.jobs, 0);
  const billed = rows.reduce((n, r) => n + r.billed, 0);
  const due = rows.reduce((n, r) => n + r.due, 0);
  const working = rows.filter((r) => r.jobs > 0 && r._id).length;
  const idle = rows.filter((r) => r.jobs <= 0 && r._id).length;
  const dueN = rows.filter((r) => r.due > 0).length;
  const todayN = rows.filter((r) => r.todayLoad > 0).length;

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All techs", bn: "সব টেক", n: rows.filter((r) => r._id).length },
    { id: "working", en: "With jobs", bn: "জব আছে", n: working },
    { id: "idle", en: "Idle", bn: "খালি", n: idle },
    { id: "due", en: "Due", bn: "বাকি", n: dueN },
    { id: "today", en: "Out today", bn: "আজ ফিল্ডে", n: todayN },
  ];

  const views: { id: RangeView; en: string; bn: string }[] = [
    { id: "all", en: "All time", bn: "সব সময়" },
    { id: "today", en: "Today", bn: "আজ" },
    { id: "7d", en: "7 days", bn: "৭ দিন" },
    { id: "30d", en: "30 days", bn: "৩০ দিন" },
    { id: "month", en: "This month", bn: "এই মাস" },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস রিপোর্ট" : "Service reports"}
        title={bn ? "টেকনিশিয়ান পারফরম্যান্স" : "Technician performance"}
        subtitle={bn
          ? "জব, বিল, সাইট সময় ও আজকের লোড — এক স্ক্রিনে।"
          : "Jobs, billed, site time and today's load — one screen."}
        stats={[
          { value: working, label: bn ? "কাজে" : "working" },
          { value: jobs, label: bn ? "জব" : "jobs" },
          { value: moneyShort(billed, locale), label: bn ? "বিল" : "billed" },
          { value: moneyShort(due, locale), label: bn ? "বাকি" : "due" },
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
            placeholder={bn ? "নাম / মোবাইল" : "Name / mobile"}
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
        <Link href="/reports/service" className="gp-btn gp-btn-ghost">{bn ? "রিপোর্ট" : "Reports"}</Link>
        <Link href="/services/technicians" className="gp-btn gp-btn-ghost">{bn ? "রোস্টার" : "Roster"}</Link>
        <Link href="/services/dispatch/assign" className="gp-btn gp-btn-ghost">{bn ? "অ্যাসাইন" : "Assign"}</Link>
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
        <button type="button" className={skill === "" ? "on" : ""} onClick={() => setSkill("")}>
          {bn ? "সব দক্ষতা" : "All skills"}
        </button>
        {skills.map((s) => (
          <button key={s} type="button" className={skill === s ? "on" : ""} onClick={() => setSkill(s)}>
            {s}
            <em>{rows.filter((r) => r.speciality === s).length}</em>
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "পারফরম্যান্স নেই" : "No performance rows"}
              message={
                jobs === 0
                  ? (bn ? "ডেমো ডেটা লোড করুন, অথবা তারিখ সরান।" : "Load demo data, or clear the dates.")
                  : (bn ? "এই ফিল্টারে কেউ নেই।" : "Nobody in this filter.")
              }
            />
            {jobs === 0 ? (
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
          {filtered.map((row) => {
            const tone = cardTone(row);
            const href = row._id ? `/services/technicians/${row._id}` : "/services/dispatch/assign";
            return (
              <article key={row._id || "unassigned"} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(row.name)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{row.name}</Link>
                    </strong>
                    <p>
                      {row.speciality || (row._id ? (bn ? "দক্ষতা নেই" : "No speciality") : (bn ? "অ্যাসাইন বাকি" : "Needs assign"))}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>{row.jobs} {bn ? "জব" : "jobs"}</span>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {row.minutes ? formatDuration(row.minutes, bn ? "bn" : "en") : bn ? "সাইট সময় নেই" : "No site time"}
                    {row.billed ? ` · ${moneyShort(row.billed, locale)}` : ""}
                    {row.due > 0 ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(row.due, locale)}` : ""}
                    {row._id ? ` · ${bn ? "আজ" : "today"} ${row.todayLoad}/${CAP}` : ""}
                  </p>
                  {row._id ? <Link className="fld-act" href={href}>{bn ? "প্রোফাইল" : "Profile"}</Link> : null}
                  <Link className="fld-act" href="/services/dispatch/assign">{bn ? "অ্যাসাইন" : "Assign"}</Link>
                  {row._id ? (
                    <Link className="fld-act" href={`/services/new?technicianId=${row._id}`}>{bn ? "জব" : "Job"}</Link>
                  ) : (
                    <Link className="fld-act" href="/services/jobs/pending">{bn ? "পেন্ডিং" : "Pending"}</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
