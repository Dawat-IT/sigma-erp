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

type JobRow = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  issueDescription?: string;
  notes?: string;
  reportedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
  technicianIds?: { name?: string }[];
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

type Scope = "all" | "today" | "week";

const KINDS = ["complaint", "scheduled", "emergency", "installation", "general"] as const;

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["PM visit", "পিএম ভিজিট"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  installation: ["Install", "ইনস্টল"],
  general: ["General", "জেনারেল"],
};

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "CX";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function kindLabel(kind: string | undefined, bn: boolean) {
  const row = KIND[String(kind || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : kind || "—";
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function machineLabel(row?: JobRow["machineId"]) {
  if (!row) return "";
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ");
}

function techName(job: JobRow) {
  return job.technicianId?.name || job.technicianIds?.[0]?.name || "";
}

function jobHref(job: JobRow) {
  if (job.jobKind === "complaint") return `/services/complaints/${job._id}`;
  if (job.jobKind === "installation") return `/services/projects/${job._id}`;
  return `/services/${job._id}`;
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

function whenCancelled(job: JobRow) {
  return job.updatedAt || job.completedAt || job.reportedAt;
}

export default function CancelledJobsPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    week: 0,
    byKind: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ status: "cancelled", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=cancelled"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          today: Number(sum.today) || 0,
          week: Number(sum.week) || 0,
          byKind: sum.byKind || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "বাতিল জব লোড হয়নি।" : "Could not load cancelled jobs.");
    } finally {
      setLoading(false);
    }
  }, [bn, from, q, to]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const today = startOfDay().getTime();
    const week = today - 6 * 86400000;
    return jobs.filter((job) => {
      if (kind && String(job.jobKind || "") !== kind) return false;
      if (scope === "today" || scope === "week") {
        const t = new Date(whenCancelled(job) || 0).getTime();
        if (Number.isNaN(t)) return false;
        if (scope === "today") return t >= today;
        return t >= week;
      }
      return true;
    });
  }, [jobs, kind, scope]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All cancelled", bn: "সব বাতিল", n: summary.total },
    { id: "today", en: "Today", bn: "আজ", n: summary.today },
    { id: "week", en: "This week", bn: "এই সপ্তাহ", n: summary.week },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "বাতিল ওয়ার্ক অর্ডার" : "Cancelled work orders"}
        subtitle={bn
          ? "ক্যান্সেল করা জব ও কাস্টমার — এক স্ক্রিনে।"
          : "Cancelled jobs and customers — one screen."}
        stats={[
          { value: summary.total, label: bn ? "বাতিল" : "cancelled" },
          { value: summary.today, label: bn ? "আজ" : "today" },
          { value: summary.week, label: bn ? "সপ্তাহ" : "this week" },
          { value: Object.keys(summary.byKind).length, label: bn ? "ধরন" : "kinds" },
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
              placeholder={bn ? "জব / সমস্যা" : "Job / issue"}
            />
            <Link href="/services/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন ওয়ার্ক অর্ডার" : "New work order"}
            </Link>
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
        <Link href="/services/jobs/completed" className="gp-btn gp-btn-ghost">{bn ? "সম্পন্ন" : "Completed"}</Link>
        <Link href="/services/jobs" className="gp-btn gp-btn-ghost">{bn ? "সব জব" : "All jobs"}</Link>
        <Link href="/services/jobs/pending" className="gp-btn gp-btn-ghost">{bn ? "পেন্ডিং" : "Pending"}</Link>
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            setFrom(value);
            void load(q, { from: value, to });
          }}
        />
        <input
          type="date"
          aria-label={bn ? "শেষ তারিখ" : "To date"}
          className="gp-input fu-search"
          value={to}
          onChange={(e) => {
            const value = e.target.value;
            setTo(value);
            void load(q, { from, to: value });
          }}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={kind === "" ? "on" : ""} onClick={() => setKind("")}>
          {bn ? "সব ধরন" : "All kinds"}
        </button>
        {KINDS.map((id) => (
          <button key={id} type="button" className={kind === id ? "on" : ""} onClick={() => setKind(id)}>
            {kindLabel(id, bn)}
            {summary.byKind[id] ? <em>{summary.byKind[id]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "বাতিল জব নেই" : "No cancelled jobs"}
              message={
                summary.total === 0
                  ? (bn ? "ক্যান্সেল হলে এখানে আসবে, অথবা ডেমো ডেটা লোড করুন।" : "Cancelled jobs land here, or load demo data.")
                  : (bn ? "এই ফিল্টারে জব নেই — ফিল্টার সরান।" : "Nothing in this filter — clear it.")
              }
            />
            {summary.total === 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="gp-btn gp-btn-primary"
                  disabled={seeding}
                  onClick={() => {
                    setSeeding(true);
                    void fetch("/api/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                      .then((res) => {
                        if (!res.ok) throw new Error("seed");
                        return load();
                      })
                      .catch(() => setError(bn ? "ডেমো ডেটা লোড হয়নি।" : "Could not load demo data."))
                      .finally(() => setSeeding(false));
                  }}
                >
                  {seeding ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? "ডেমো ডেটা লোড করুন" : "Load demo data"}
                </button>
                <Link href="/services/jobs" className="gp-btn">{bn ? "সব জব" : "All jobs"}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const tech = techName(job);
            const href = jobHref(job);
            const note = job.notes || job.issueDescription;
            return (
              <article key={job._id} className="fu-card is-info">
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(customerName(job.customerId, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{job.jobNo || "—"}</Link>
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
                  <span className="fu-chip is-info">{bn ? "বাতিল" : "Cancelled"}</span>
                </div>
                {note ? <p className="fu-note">{note}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {kindLabel(job.jobKind, bn)}
                    {tech ? ` · ${tech}` : ""}
                    {` · ${safeDate(whenCancelled(job), locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {job.customerId?.mobile ? ` · ${job.customerId.mobile}` : ""}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                  <Link className="fld-act" href={`/services/new${job.customerId?._id ? `?customerId=${job.customerId._id}` : ""}`}>
                    {bn ? "নতুন জব" : "New job"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
