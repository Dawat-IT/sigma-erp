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
  status?: string;
  priority?: string;
  issueDescription?: string;
  reportedAt?: string;
  createdAt?: string;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
  technicianIds?: { name?: string }[];
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

type Scope = "open" | "sla" | "unassigned" | "urgent" | "closed";

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const STATUS: Record<string, [string, string]> = {
  pending: ["Pending", "পেন্ডিং"],
  reported: ["Reported", "রিপোর্টেড"],
  assigned: ["Assigned", "অ্যাসাইনড"],
  in_progress: ["In progress", "চলছে"],
  waiting_parts: ["Parts", "পার্টস"],
  on_site: ["On site", "অন সাইট"],
  resolved: ["Resolved", "সমাধান"],
  completed: ["Done", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  cancelled: ["Cancelled", "বাতিল"],
};

const PRIORITY: Record<string, [string, string]> = {
  urgent: ["Urgent", "জরুরি"],
  high: ["High", "উচ্চ"],
  medium: ["Medium", "মাঝারি"],
  low: ["Low", "কম"],
};

const CLOSED = new Set(["completed", "closed", "delivered", "cancelled", "resolved"]);

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "CP";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function statusLabel(status: string | undefined, bn: boolean) {
  const row = STATUS[String(status || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : status || "—";
}

function priorityLabel(priority: string | undefined, bn: boolean) {
  const row = PRIORITY[String(priority || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : priority || "—";
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

function safeDate(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function isOpen(job: JobRow) {
  return !CLOSED.has(String(job.status || "").toLowerCase());
}

function techName(job: JobRow) {
  return job.technicianId?.name || job.technicianIds?.[0]?.name || "";
}

function isUnassigned(job: JobRow) {
  return isOpen(job) && !techName(job);
}

function slaChip(job: JobRow, bn: boolean) {
  const state = slaState({ status: job.status, jobKind: "complaint", priority: job.priority, reportedAt: job.reportedAt, createdAt: job.createdAt });
  if (state.key === "done") return { label: bn ? "বন্ধ" : "Closed", tone: "is-ok" };
  if (state.key === "overdue") return { label: bn ? `SLA ${Math.round(state.hours)}ঘ` : state.label, tone: "is-danger" };
  if (state.key === "due") return { label: state.label, tone: "is-warn" };
  return { label: state.label, tone: "is-info" };
}

function cardTone(job: JobRow) {
  if (!isOpen(job)) return "is-ok";
  const sla = slaState({ status: job.status, jobKind: "complaint", priority: job.priority, reportedAt: job.reportedAt, createdAt: job.createdAt });
  if (sla.key === "overdue" || job.priority === "urgent") return "is-danger";
  if (job.priority === "high" || sla.key === "due") return "is-warn";
  return "is-info";
}

export default function ComplaintListPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    unassigned: 0,
    inProgress: 0,
    closed: 0,
    slaOverdue: 0,
    byLine: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("open");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ jobKind: "complaint", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=complaints"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          open: Number(sum.open) || 0,
          unassigned: Number(sum.unassigned) || 0,
          inProgress: Number(sum.inProgress) || 0,
          closed: Number(sum.closed) || 0,
          slaOverdue: Number(sum.slaOverdue) || 0,
          byLine: sum.byLine || {},
          byPriority: sum.byPriority || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "কমপ্লেইন লোড হয়নি।" : "Could not load complaints.");
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
      if (type && job.equipmentType !== type) return false;
      if (scope === "open") return isOpen(job);
      if (scope === "sla") return isOpen(job) && slaState({ status: job.status, jobKind: "complaint", priority: job.priority, reportedAt: job.reportedAt, createdAt: job.createdAt }).key === "overdue";
      if (scope === "unassigned") return isUnassigned(job);
      if (scope === "urgent") return isOpen(job) && (job.priority === "urgent" || job.priority === "high");
      if (scope === "closed") return !isOpen(job);
      return true;
    });
  }, [jobs, scope, type]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "open", en: "Open", bn: "ওপেন", n: summary.open },
    { id: "sla", en: "SLA overdue", bn: "SLA বকেয়া", n: summary.slaOverdue },
    { id: "unassigned", en: "Unassigned", bn: "আনঅ্যাসাইনড", n: summary.unassigned },
    { id: "urgent", en: "Urgent / high", bn: "জরুরি", n: (summary.byPriority.urgent || 0) + (summary.byPriority.high || 0) },
    { id: "closed", en: "Closed", bn: "বন্ধ", n: summary.closed },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "কমপ্লেইন তালিকা" : "Complaint list"}
        subtitle={bn
          ? "ব্রেকডাউন টিকিট, SLA ও অ্যাসাইনমেন্ট — এক স্ক্রিনে।"
          : "Breakdown tickets, SLA and assignment — one screen."}
        stats={[
          { value: summary.open, label: bn ? "ওপেন" : "open" },
          { value: summary.slaOverdue, label: "SLA" },
          { value: summary.unassigned, label: bn ? "আনঅ্যাসাইনড" : "unassigned" },
          { value: summary.inProgress, label: bn ? "চলছে" : "in progress" },
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
            <Link href="/services/complaints/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন কমপ্লেইন" : "New complaint"}
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
        <Link href="/services/complaints/history" className="gp-btn gp-btn-ghost">{bn ? "হিস্ট্রি" : "History"}</Link>
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
        <button type="button" className={type === "" ? "on" : ""} onClick={() => setType("")}>
          {bn ? "সব লাইন" : "All lines"}
        </button>
        {EQUIPMENT_LINES.map((line) => (
          <button
            key={line.value}
            type="button"
            className={type === line.value ? "on" : ""}
            onClick={() => setType(line.value)}
          >
            {typeLabel(line.value, bn)}
            {summary.byLine[line.value] ? <em>{summary.byLine[line.value]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "কমপ্লেইন নেই" : "No complaints"}
              message={
                summary.total === 0
                  ? (bn ? "ডেমো ডেটা লোড করুন, অথবা নতুন টিকিট খুলুন।" : "Load demo data, or open a new ticket.")
                  : (bn ? "এই ফিল্টারে টিকিট নেই — ফিল্টার সরান।" : "Nothing in this filter — clear it.")
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
                <Link href="/services/complaints/new" className="gp-btn">{bn ? "নতুন কমপ্লেইন" : "New complaint"}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const sla = slaChip(job, bn);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            return (
              <article key={job._id} className={`fu-card ${cardTone(job)}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(customerName(job.customerId, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={`/services/complaints/${job._id}`}>{job.jobNo || "—"}</Link>
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
                  <span className={`fu-chip ${sla.tone}`}>{sla.label}</span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {statusLabel(job.status, bn)}
                    {` · ${priorityLabel(job.priority, bn)}`}
                    {techName(job) ? ` · ${techName(job)}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {` · ${safeDate(job.reportedAt || job.createdAt, locale)}`}
                    {job.customerId?.mobile ? ` · ${job.customerId.mobile}` : ""}
                  </p>
                  <Link className="fld-act" href={`/services/complaints/${job._id}`}>{bn ? "খুলুন" : "Open"}</Link>
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
