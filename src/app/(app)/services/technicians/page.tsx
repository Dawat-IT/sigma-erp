"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { todayKey } from "@/lib/service-visit";

type TechRow = {
  _id: string;
  name: string;
  mobile?: string;
  speciality?: string;
  jobCount?: number;
  openCount?: number;
  billedTotal?: number;
};

type Board = { technician?: { _id?: string }; houseCount?: number };

type Scope = "all" | "open" | "idle" | "today" | "overload";

const CAP = 4;

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "TK";
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function cardTone(row: TechRow, todayLoad: number) {
  if (todayLoad >= CAP) return "is-danger";
  if (Number(row.openCount || 0) > 0) return "is-warn";
  if (todayLoad > 0) return "is-info";
  return "is-ok";
}

export default function TechniciansPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<TechRow[]>([]);
  const [loadMap, setLoadMap] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", mobile: "", speciality: "" });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (nextDate = date) => {
    setLoading(true);
    const qs = nextDate ? `?date=${encodeURIComponent(nextDate)}` : "";
    try {
      const [techRes, deskRes] = await Promise.all([
        fetch(`/api/technicians${qs}`),
        fetch(`/api/services/dispatch?date=${nextDate || todayKey()}`),
      ]);
      const json = await techRes.json();
      const desk = await deskRes.json();
      if (!techRes.ok) throw new Error(json.error || "load");
      setRows(json.data || []);
      const nextLoad: Record<string, number> = {};
      for (const board of (desk.boards || []) as Board[]) {
        const id = String(board.technician?._id || "");
        if (id) nextLoad[id] = Number(board.houseCount || 0);
      }
      setLoadMap(nextLoad);
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "টেকনিশিয়ান লোড হয়নি।" : "Could not load technicians.");
    } finally {
      setLoading(false);
    }
  }, [bn, date]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
      if (skill && String(row.speciality || "") !== skill) return false;
      const todayLoad = loadMap[row._id] || 0;
      if (scope === "open" && !(Number(row.openCount || 0) > 0)) return false;
      if (scope === "idle" && Number(row.openCount || 0) > 0) return false;
      if (scope === "today" && todayLoad <= 0) return false;
      if (scope === "overload" && todayLoad < CAP) return false;
      if (!needle) return true;
      return `${row.name} ${row.mobile || ""} ${row.speciality || ""}`.toLowerCase().includes(needle);
    });
  }, [loadMap, rows, scope, search, skill]);

  const openJobs = rows.reduce((n, r) => n + Number(r.openCount || 0), 0);
  const billed = rows.reduce((n, r) => n + Number(r.billedTotal || 0), 0);
  const idle = rows.filter((r) => Number(r.openCount || 0) === 0).length;
  const todayN = rows.filter((r) => (loadMap[r._id] || 0) > 0).length;
  const overloadN = rows.filter((r) => (loadMap[r._id] || 0) >= CAP).length;

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All", bn: "সব", n: rows.length },
    { id: "open", en: "With open jobs", bn: "ওপেন জব", n: rows.filter((r) => Number(r.openCount || 0) > 0).length },
    { id: "idle", en: "Idle", bn: "খালি", n: idle },
    { id: "today", en: "Out today", bn: "আজ ফিল্ডে", n: todayN },
    { id: "overload", en: "4+", bn: "৪+", n: overloadN },
  ];

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setOpen(false);
      setForm({ name: "", mobile: "", speciality: "" });
      await load();
    } catch {
      setError(bn ? "টেকনিশিয়ান সেভ হয়নি।" : "Could not save the technician.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "টেকনিশিয়ান" : "Technicians"}
        subtitle={bn
          ? "রোস্টার, ওপেন জব ও আজকের লোড — এক স্ক্রিনে।"
          : "Roster, open jobs and today's load — one screen."}
        stats={[
          { value: rows.length, label: bn ? "টেক" : "techs" },
          { value: openJobs, label: bn ? "ওপেন জব" : "open jobs" },
          { value: todayN, label: bn ? "আজ ফিল্ডে" : "out today" },
          { value: moneyShort(billed, locale), label: bn ? "বিল" : "billed" },
        ]}
        actions={
          <>
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
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen((v) => !v)}>
              <Plus className="h-4 w-4" />
              {bn ? (open ? "বন্ধ" : "নতুন টেক") : open ? "Close" : "New technician"}
            </button>
          </>
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
        <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "আজকের বোর্ড" : "Today board"}</Link>
        <Link href="/services/dispatch/assign" className="gp-btn gp-btn-ghost">{bn ? "অ্যাসাইন" : "Assign"}</Link>
        <Link href="/services/dispatch/live" className="gp-btn gp-btn-ghost">{bn ? "লাইভ" : "Live"}</Link>
        <input
          type="date"
          aria-label={bn ? "তারিখ" : "Date"}
          className="gp-input fu-search"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {skills.length ? (
        <div className="fu-views">
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
      ) : null}

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {open ? (
          <form onSubmit={onCreate} className="eq-add-panel amc-new">
            <b>{bn ? "নতুন টেকনিশিয়ান" : "New technician"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "নাম" : "Name"}>
                <input required className="gp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={bn ? "মোবাইল" : "Mobile"}>
                <input required className="gp-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </Field>
              <Field label={bn ? "দক্ষতা" : "Speciality"} className="span-2">
                <input className="gp-input" value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} placeholder={bn ? "লিফট, জেনারেটর..." : "Lift, generator..."} />
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={() => setOpen(false)}>{bn ? "বাতিল" : "Cancel"}</button>
              <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
                {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "টেকনিশিয়ান নেই" : "No technicians"}
            message={bn ? "নতুন টেক যোগ করুন, অথবা ফিল্টার সরান।" : "Add a technician, or clear the filters."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((row) => {
            const todayLoad = loadMap[row._id] || 0;
            const tone = cardTone(row, todayLoad);
            const href = `/services/technicians/${row._id}`;
            return (
              <article key={row._id} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(row.name)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{row.name}</Link>
                    </strong>
                    <p>
                      {row.speciality || (bn ? "দক্ষতা নেই" : "No speciality")}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                  </div>
                  <span className={`fu-chip ${todayLoad >= CAP ? "is-danger" : todayLoad > 0 ? "is-info" : "is-ok"}`}>
                    {todayLoad}/{CAP}
                  </span>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {bn ? "জব" : "jobs"} {row.jobCount || 0}
                    {` · ${bn ? "ওপেন" : "open"} ${row.openCount || 0}`}
                    {` · ${bn ? "বিল" : "billed"} ${moneyShort(Number(row.billedTotal || 0), locale)}`}
                    {todayLoad > 0 ? ` · ${bn ? "আজ" : "today"} ${todayLoad}` : ` · ${bn ? "আজ খালি" : "idle today"}`}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "প্রোফাইল" : "Profile"}</Link>
                  <Link className="fld-act" href={`/services/dispatch/assign`}>{bn ? "অ্যাসাইন" : "Assign"}</Link>
                  <Link className="fld-act" href="/services/dispatch">{bn ? "বোর্ড" : "Board"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
