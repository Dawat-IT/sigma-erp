"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES, slaState } from "@/lib/technical-checklists";
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
  priority?: string;
  issueDescription?: string;
  reportedAt?: string;
  createdAt?: string;
  scheduledDate?: string;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
  technicianIds?: { name?: string }[];
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

type Scope = "all" | "pending" | "reported" | "unassigned" | "urgent" | "sla";

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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "PD";
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

function isUnassigned(job: JobRow) {
  return !techName(job);
}

function jobSla(job: JobRow) {
  return slaState({
    status: job.status,
    jobKind: job.jobKind,
    priority: job.priority,
    reportedAt: job.reportedAt,
    createdAt: job.createdAt,
  });
}

function cardTone(job: JobRow) {
  const sla = jobSla(job);
  if (job.jobKind === "emergency" || job.priority === "urgent" || sla.key === "overdue") return "is-danger";
  if (isUnassigned(job) || sla.key === "due") return "is-warn";
  return "is-info";
}

export default function PendingJobsPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    reported: 0,
    unassigned: 0,
    slaOverdue: 0,
    byKind: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
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
    const qs = new URLSearchParams({ status: "pending,reported", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=pending"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          pending: Number(sum.pending) || 0,
          reported: Number(sum.reported) || 0,
          unassigned: Number(sum.unassigned) || 0,
          slaOverdue: Number(sum.slaOverdue) || 0,
          byKind: sum.byKind || {},
          byPriority: sum.byPriority || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "পেন্ডিং জব লোড হয়নি।" : "Could not load pending jobs.");
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
      if (scope === "pending") return status === "pending";
      if (scope === "reported") return status === "reported";
      if (scope === "unassigned") return isUnassigned(job);
      if (scope === "urgent") return job.priority === "urgent" || job.priority === "high" || job.jobKind === "emergency";
      if (scope === "sla") return jobSla(job).key === "overdue";
      return true;
    });
  }, [jobs, kind, scope]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "Waiting", bn: "অপেক্ষমাণ", n: summary.total },
    { id: "pending", en: "Pending", bn: "পেন্ডিং", n: summary.pending },
    { id: "reported", en: "Reported", bn: "রিপোর্টেড", n: summary.reported },
    { id: "unassigned", en: "Unassigned", bn: "আনঅ্যাসাইনড", n: summary.unassigned },
    { id: "sla", en: "SLA overdue", bn: "SLA বকেয়া", n: summary.slaOverdue },
    { id: "urgent", en: "Urgent / high", bn: "জরুরি", n: (summary.byPriority.urgent || 0) + (summary.byPriority.high || 0) },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "পেন্ডিং ওয়ার্ক অর্ডার" : "Pending work orders"}
        subtitle={bn
          ? "শুরু হয়নি এমন জব — অ্যাসাইন ও ডিসপ্যাচ এক স্ক্রিনে।"
          : "Jobs waiting to start — assign and dispatch on one screen."}
        stats={[
          { value: summary.total, label: bn ? "অপেক্ষা" : "waiting" },
          { value: summary.unassigned, label: bn ? "আনঅ্যাসাইনড" : "unassigned" },
          { value: summary.slaOverdue, label: "SLA" },
          { value: summary.reported, label: bn ? "রিপোর্টেড" : "reported" },
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
        <Link href="/services/jobs" className="gp-btn gp-btn-ghost">{bn ? "সব জব" : "All jobs"}</Link>
        <Link href="/services/jobs/in-progress" className="gp-btn gp-btn-ghost">{bn ? "চলছে" : "In progress"}</Link>
        <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
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
              title={bn ? "পেন্ডিং জব নেই" : "No pending jobs"}
              message={
                summary.total === 0
                  ? (bn ? "নতুন জব খুলুন, অথবা ডেমো ডেটা লোড করুন।" : "Open a job, or load demo data.")
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
                <Link href="/services/new" className="gp-btn">{bn ? "নতুন ওয়ার্ক অর্ডার" : "New work order"}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const sla = jobSla(job);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const tech = techName(job);
            const href = jobHref(job);
            return (
              <article key={job._id} className={`fu-card ${cardTone(job)}`}>
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
                  <span className={`fu-chip ${sla.key === "overdue" ? "is-danger" : sla.key === "due" ? "is-warn" : "is-info"}`}>
                    {sla.key === "overdue" ? (bn ? `SLA ${Math.round(sla.hours)}ঘ` : sla.label) : sla.label}
                  </span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {statusLabel(job.status, bn)}
                    {` · ${kindLabel(job.jobKind, bn)}`}
                    {tech ? ` · ${tech}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
                    {` · ${safeDate(job.scheduledDate || job.reportedAt || job.createdAt, locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {job.customerId?.mobile ? ` · ${job.customerId.mobile}` : ""}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                  <Link className="fld-act" href="/services/dispatch">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
