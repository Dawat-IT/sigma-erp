"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES } from "@/lib/technical-checklists";
import { formatDateBD } from "@/lib/utils";

type Customer = {
  _id?: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  location?: string;
  city?: string;
};

type LastService = {
  jobNo?: string;
  completedAt?: string;
  reportedAt?: string;
  technician?: { name?: string } | null;
};

type Row = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  nextServiceDue?: string;
  siteName?: string;
  siteLocation?: string;
  customerId?: Customer;
  lastService?: LastService | null;
};

type JobRow = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  issueDescription?: string;
  scheduledDate?: string;
  expectedDeliveryDate?: string;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
};

const WINDOWS = [7, 14, 30, 60] as const;

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["PM visit", "পিএম ভিজিট"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  general: ["General", "জেনারেল"],
  installation: ["Install", "ইনস্টল"],
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "UP";
}

function machineLabel(row: Row) {
  return [row.brand, row.model, row.serialNo].filter(Boolean).join(" · ") || "—";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function safeDate(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysFromToday(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((startOfDay(d).getTime() - startOfDay().getTime()) / 86400000);
}

function inWindow(iso: string | undefined, days: number, from: string, to: string) {
  if (from || to) {
    if (!iso) return false;
    const day = startOfDay(new Date(iso)).getTime();
    if (from && day < startOfDay(new Date(`${from}T00:00:00`)).getTime()) return false;
    if (to && day > startOfDay(new Date(`${to}T00:00:00`)).getTime()) return false;
    return true;
  }
  const d = daysFromToday(iso);
  return d != null && d >= 0 && d <= days;
}

function dueTone(iso?: string) {
  const days = daysFromToday(iso);
  if (days != null && days <= 7) return "is-warn";
  if (days != null && days <= 14) return "is-info";
  return "is-ok";
}

function dueChip(iso: string | undefined, bn: boolean) {
  const days = daysFromToday(iso);
  if (days == null) return { label: "—", tone: "is-info" };
  if (days === 0) return { label: bn ? "আজ" : "Today", tone: "is-warn" };
  if (days === 1) return { label: bn ? "কাল" : "Tomorrow", tone: "is-warn" };
  if (days <= 7) return { label: bn ? `${days} দিন` : `${days}d`, tone: "is-warn" };
  return { label: bn ? `${days} দিন` : `${days}d`, tone: "is-info" };
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "—";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function kindLabel(kind: string | undefined, bn: boolean) {
  const row = KIND[String(kind || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : kind || "—";
}

function weekday(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long" }).format(d);
}

function localDayKey(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function UpcomingServicePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    due: 0,
    upcoming: 0,
    today: 0,
    thisWeek: 0,
    byType: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [days, setDays] = useState<number>(30);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q) => {
    setLoading(true);
    const machineQs = new URLSearchParams({ limit: "200", upcoming: "1", days: "60" });
    const jobQs = new URLSearchParams({ limit: "100", scope: "upcoming" });
    if (search.trim()) {
      machineQs.set("q", search.trim());
      jobQs.set("q", search.trim());
    }
    try {
      const [mRes, jRes] = await Promise.all([
        fetch(`/api/machines?${machineQs}`),
        fetch(`/api/services?${jobQs}`),
      ]);
      const mJson = await mRes.json();
      const jJson = await jRes.json();
      if (!mRes.ok) throw new Error(mJson.error || "load");
      const data = (Array.isArray(mJson.data) ? mJson.data : mJson.items || []) as Row[];
      data.sort((a, b) => String(a.nextServiceDue || "9").localeCompare(String(b.nextServiceDue || "9")));
      setRows(data);
      setJobs(Array.isArray(jJson.data) ? jJson.data : jJson.items || []);
      setSummary({
        due: Number(mJson.summary?.due) || 0,
        upcoming: Number(mJson.summary?.upcoming) || 0,
        today: Number(mJson.summary?.today) || 0,
        thisWeek: Number(mJson.summary?.thisWeek) || 0,
        byType: mJson.summary?.byType || {},
      });
      setError("");
    } catch {
      setRows([]);
      setJobs([]);
      setError(bn ? "আপকামিং লোড হয়নি।" : "Could not load upcoming service.");
    } finally {
      setLoading(false);
    }
  }, [bn, q]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = useMemo(
    () => rows.filter((row) => {
      if (type && row.machineType !== type) return false;
      return inWindow(row.nextServiceDue, days, from, to);
    }),
    [days, from, rows, to, type],
  );

  const visits = useMemo(
    () => jobs.filter((job) => {
      if (type && job.equipmentType && job.equipmentType !== type) return false;
      return inWindow(job.scheduledDate || job.expectedDeliveryDate, days, from, to);
    }),
    [days, from, jobs, to, type],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { units: Row[]; visits: JobRow[] }>();
    function bucket(key: string) {
      if (!key) return null;
      if (!map.has(key)) map.set(key, { units: [], visits: [] });
      return map.get(key)!;
    }
    for (const row of units) {
      const b = bucket(localDayKey(row.nextServiceDue));
      if (b) b.units.push(row);
    }
    for (const job of visits) {
      const b = bucket(localDayKey(job.scheduledDate || job.expectedDeliveryDate));
      if (b) b.visits.push(job);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, ...value }));
  }, [units, visits]);

  const windowCounts = WINDOWS.map((n) => ({
    n,
    units: rows.filter((r) => inWindow(r.nextServiceDue, n, "", "")).length,
  }));

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "আপকামিং সার্ভিস" : "Upcoming service"}
        subtitle={bn
          ? "আগামী এএমসি তারিখ ও শিডিউল জব — আগে থেকে ক্রু প্ল্যান করুন।"
          : "Upcoming AMC dates and scheduled jobs — plan the crew before the visit."}
        stats={[
          { value: units.length, label: bn ? "ইউনিট" : "units" },
          { value: visits.length, label: bn ? "জব" : "jobs" },
          { value: summary.thisWeek, label: bn ? "সপ্তাহ" : "this week" },
          { value: summary.due, label: bn ? "ডিউ" : "already due" },
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
                searchTimer.current = setTimeout(() => void load(value), 250);
              }}
              placeholder={bn ? "কাস্টমার / সিরিয়াল" : "Customer / serial"}
            />
            <Link href="/services/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন জব" : "New job"}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {windowCounts.map((pill) => (
            <button
              key={pill.n}
              type="button"
              className={days === pill.n && !from && !to ? "on" : ""}
              onClick={() => {
                setDays(pill.n);
                setFrom("");
                setTo("");
              }}
            >
              {bn ? `${pill.n === 7 ? "৭" : pill.n === 14 ? "১৪" : pill.n === 30 ? "৩০" : "৬০"} দিন` : `${pill.n} days`}
              <em>{pill.units}</em>
            </button>
          ))}
        </div>
        <Link href="/services/schedule" className="gp-btn gp-btn-ghost">{bn ? "শিডিউল" : "Schedule"}</Link>
        <Link href="/services/due" className="gp-btn gp-btn-ghost">{bn ? "ডিউ" : "Due"}</Link>
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label={bn ? "শেষ তারিখ" : "To date"}
          className="gp-input fu-search"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={type === "" ? "on" : ""} onClick={() => setType("")}>
          {bn ? "সব ধরন" : "All types"}
        </button>
        {EQUIPMENT_LINES.map((line) => (
          <button
            key={line.value}
            type="button"
            className={type === line.value ? "on" : ""}
            onClick={() => setType(line.value)}
          >
            {typeLabel(line.value, bn)}
            {summary.byType[line.value] ? <em>{summary.byType[line.value]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && groups.length === 0 ? (
          <EmptyState
            title={bn ? "এই উইন্ডোতে সার্ভিস নেই" : "Nothing in this window"}
            message={bn ? "মেশিনে পরবর্তী সার্ভিস তারিখ দিন, অথবা উইন্ডো বাড়ান।" : "Set a next-service date on a unit, or widen the window."}
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.key} className="sch-day">
            <header>
              <b>{safeDate(group.key, locale)}</b>
              <span>
                {weekday(group.key, locale)} · {bn ? `${group.units.length} ইউনিট` : `${group.units.length} units`}
                {group.visits.length ? ` · ${bn ? `${group.visits.length} জব` : `${group.visits.length} jobs`}` : ""}
              </span>
            </header>
            <div className="fu-list">
              {group.units.map((row) => {
                const chip = dueChip(row.nextServiceDue, bn);
                const site = [row.siteName, row.siteLocation || row.customerId?.location || row.customerId?.city].filter(Boolean).join(" · ");
                const last = row.lastService;
                const lastWhen = last?.completedAt || last?.reportedAt;
                return (
                  <article key={row._id} className={`fu-card ${dueTone(row.nextServiceDue)}`}>
                    <div className="fu-card-top">
                      <span className="fu-avatar">{initials(customerName(row.customerId, bn))}</span>
                      <div className="min-w-0 flex-1">
                        <strong>
                          <Link href={`/services/machines/${row._id}`}>{machineLabel(row)}</Link>
                        </strong>
                        <p>
                          {row.customerId?._id ? (
                            <Link href={`/contacts/${row.customerId._id}/statement`}>{customerName(row.customerId, bn)}</Link>
                          ) : (
                            customerName(row.customerId, bn)
                          )}
                          {site ? ` · ${site}` : ""}
                        </p>
                      </div>
                      <span className={`fu-chip ${chip.tone}`}>{chip.label}</span>
                    </div>
                    <p className="fu-note">
                      {typeLabel(row.machineType, bn)}
                      {row.customerId?.mobile ? ` · ${row.customerId.mobile}` : ""}
                      {last ? ` · ${last.jobNo || (bn ? "শেষ" : "last")}${lastWhen ? ` ${safeDate(lastWhen, locale)}` : ""}` : ""}
                    </p>
                    <div className="fu-card-foot eq-foot">
                      <p className="fu-meta">
                        {bn ? "ডিউ " : "Due "}
                        {safeDate(row.nextServiceDue, locale)}
                        {last?.technician?.name ? ` · ${last.technician.name}` : ""}
                      </p>
                      <Link className="fld-act" href={`/services/machines/${row._id}`}>{bn ? "খুলুন" : "Open"}</Link>
                      <Link className="fld-act" href={`/services/new${row.customerId?._id ? `?customerId=${row.customerId._id}` : ""}`}>
                        {bn ? "ভিজিট" : "Visit"}
                      </Link>
                    </div>
                  </article>
                );
              })}
              {group.visits.map((job) => {
                const when = job.scheduledDate || job.expectedDeliveryDate;
                const chip = dueChip(when, bn);
                const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
                return (
                  <article key={job._id} className={`fu-card ${dueTone(when)}`}>
                    <div className="fu-card-top">
                      <span className="fu-avatar">{initials(customerName(job.customerId, bn))}</span>
                      <div className="min-w-0 flex-1">
                        <strong>
                          <Link href={`/services/${job._id}`}>{job.jobNo || "—"}</Link>
                        </strong>
                        <p>
                          {job.customerId?._id ? (
                            <Link href={`/contacts/${job.customerId._id}/statement`}>{customerName(job.customerId, bn)}</Link>
                          ) : (
                            customerName(job.customerId, bn)
                          )}
                          {site ? ` · ${site}` : ""}
                        </p>
                      </div>
                      <span className={`fu-chip ${chip.tone}`}>{chip.label}</span>
                    </div>
                    {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                    <div className="fu-card-foot eq-foot">
                      <p className="fu-meta">
                        {kindLabel(job.jobKind, bn)}
                        {job.technicianId?.name ? ` · ${job.technicianId.name}` : bn ? " · ক্রু নেই" : " · no crew"}
                        {` · ${safeDate(when, locale)}`}
                      </p>
                      <Link className="fld-act" href={`/services/${job._id}`}>{bn ? "খুলুন" : "Open"}</Link>
                      <Link className="fld-act" href="/services/dispatch">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
