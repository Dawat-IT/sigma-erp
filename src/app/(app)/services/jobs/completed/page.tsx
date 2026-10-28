"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES } from "@/lib/technical-checklists";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { formatDuration } from "@/lib/service-visit";

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
  grandTotal?: number;
  dueAmount?: number;
  completedAt?: string;
  reportedAt?: string;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
  technicianIds?: { name?: string }[];
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

type Scope = "all" | "resolved" | "completed" | "closed" | "delivered" | "due";

const KINDS = ["complaint", "scheduled", "emergency", "installation", "general"] as const;

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["PM visit", "পিএম ভিজিট"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  installation: ["Install", "ইনস্টল"],
  general: ["General", "জেনারেল"],
};

const STATUS: Record<string, [string, string]> = {
  resolved: ["Resolved", "সমাধান"],
  completed: ["Completed", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  delivered: ["Delivered", "ডেলিভার"],
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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "DN";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function kindLabel(kind: string | undefined, bn: boolean) {
  const row = KIND[String(kind || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : kind || "—";
}

function statusLabel(status: string | undefined, bn: boolean) {
  const row = STATUS[String(status || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : status || "—";
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

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

export default function CompletedJobsPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    billed: 0,
    due: 0,
    unpaid: 0,
    byStatus: {} as Record<string, number>,
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
    const qs = new URLSearchParams({ scope: "history", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=completed"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          today: Number(sum.today) || 0,
          billed: Number(sum.billed) || 0,
          due: Number(sum.due) || 0,
          unpaid: Number(sum.unpaid) || 0,
          byStatus: sum.byStatus || {},
          byKind: sum.byKind || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "সম্পন্ন জব লোড হয়নি।" : "Could not load completed jobs.");
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
    return jobs.filter((job) => {
      if (kind && String(job.jobKind || "") !== kind) return false;
      const status = String(job.status || "").toLowerCase();
      if (scope === "resolved") return status === "resolved";
      if (scope === "completed") return status === "completed";
      if (scope === "closed") return status === "closed";
      if (scope === "delivered") return status === "delivered";
      if (scope === "due") return Number(job.dueAmount || 0) > 0;
      return true;
    });
  }, [jobs, kind, scope]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All closed", bn: "সব বন্ধ", n: summary.total },
    { id: "resolved", en: "Resolved", bn: "সমাধান", n: summary.byStatus.resolved || 0 },
    { id: "completed", en: "Completed", bn: "সম্পন্ন", n: summary.byStatus.completed || 0 },
    { id: "closed", en: "Closed", bn: "বন্ধ", n: summary.byStatus.closed || 0 },
    { id: "delivered", en: "Delivered", bn: "ডেলিভার", n: summary.byStatus.delivered || 0 },
    { id: "due", en: "Unpaid", bn: "বাকি", n: summary.unpaid },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "সম্পন্ন ওয়ার্ক অর্ডার" : "Completed work orders"}
        subtitle={bn
          ? "ক্লোজড ও ডেলিভারি জব, বিল ও কাস্টমার — এক স্ক্রিনে।"
          : "Closed and delivered jobs, bills and customers — one screen."}
        stats={[
          { value: summary.total, label: bn ? "বন্ধ" : "closed" },
          { value: summary.today, label: bn ? "আজ" : "today" },
          { value: moneyShort(summary.billed, locale), label: bn ? "বিল" : "billed" },
          { value: moneyShort(summary.due, locale), label: bn ? "বাকি" : "due" },
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
        <Link href="/services/jobs/in-progress" className="gp-btn gp-btn-ghost">{bn ? "চলছে" : "In progress"}</Link>
        <Link href="/services/jobs/cancelled" className="gp-btn gp-btn-ghost">{bn ? "বাতিল" : "Cancelled"}</Link>
        <Link href="/services/history" className="gp-btn gp-btn-ghost">{bn ? "হিস্ট্রি" : "History"}</Link>
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
              title={bn ? "সম্পন্ন জব নেই" : "No completed jobs"}
              message={
                summary.total === 0
                  ? (bn ? "জব ক্লোজ হলে এখানে আসবে, অথবা ডেমো ডেটা লোড করুন।" : "Closed jobs land here, or load demo data.")
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
                <Link href="/services/jobs/in-progress" className="gp-btn">{bn ? "চলছে" : "In progress"}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const due = Number(job.dueAmount || 0);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const tech = techName(job);
            const href = jobHref(job);
            return (
              <article key={job._id} className={`fu-card ${due > 0 ? "is-warn" : "is-ok"}`}>
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
                  <b className="qt-amt">{moneyShort(Number(job.grandTotal || 0), locale)}</b>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {statusLabel(job.status, bn)}
                    {` · ${kindLabel(job.jobKind, bn)}`}
                    {tech ? ` · ${tech}` : ""}
                    {job.durationMinutes ? ` · ${formatDuration(job.durationMinutes, bn ? "bn" : "en")}` : ""}
                    {` · ${safeDate(job.completedAt || job.reportedAt, locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {due > 0 ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(due, locale)}` : ""}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                  <Link className="fld-act" href={`/services/${job._id}/invoice`}>{bn ? "ইনভয়েস" : "Invoice"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
