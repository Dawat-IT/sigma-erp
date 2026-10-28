"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  EQUIPMENT_LINES,
  PROJECT_STATUSES,
  checklistProgress,
  projectStatusLabel,
} from "@/lib/technical-checklists";
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
  equipmentType?: string;
  status?: string;
  issueDescription?: string;
  siteName?: string;
  siteLocation?: string;
  reportedAt?: string;
  scheduledDate?: string;
  completedAt?: string;
  checklist?: { item: string; done?: boolean }[];
  customerId?: Customer;
  technicianId?: { name?: string };
  machineId?: { brand?: string; model?: string; serialNo?: string };
};

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const STATUS_BN: Record<string, string> = {
  reported: "পরিকল্পিত",
  assigned: "সাইট অ্যাসাইনড",
  in_progress: "ইনস্টল চলছে",
  resolved: "কমিশনড",
  completed: "সম্পন্ন",
  closed: "হ্যান্ডওভার",
  delivered: "ডেলিভার",
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "IN";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "—";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function statusLabel(status?: string, bn?: boolean) {
  const key = String(status || "");
  if (bn && STATUS_BN[key]) return STATUS_BN[key];
  return projectStatusLabel(key);
}

function statusTone(status?: string) {
  const key = String(status || "").toLowerCase();
  if (key === "cancelled") return "is-danger";
  if (key === "in_progress") return "is-info";
  if (key === "reported") return "is-warn";
  if (key === "resolved" || key === "completed" || key === "closed" || key === "delivered") return "is-ok";
  return "is-info";
}

function safeDate(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function machineLabel(row: JobRow) {
  const m = row.machineId;
  if (!m) return "";
  return [m.brand, m.model, m.serialNo].filter(Boolean).join(" · ");
}

export default function ProjectInstallPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    installing: 0,
    commissioned: 0,
    handed: 0,
    byStatus: {} as Record<string, number>,
    byLine: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, nextStatus = status, nextType = equipmentType, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ jobKind: "installation", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (nextType) qs.set("equipmentType", nextType);
    if (nextStatus) qs.set("status", nextStatus);
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=install"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      setTotal(Number(json.total) || 0);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          open: Number(sum.open) || 0,
          installing: Number(sum.installing) || 0,
          commissioned: Number(sum.commissioned) || 0,
          handed: Number(sum.handed) || 0,
          byStatus: sum.byStatus || {},
          byLine: sum.byLine || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "ইনস্টলেশন লোড হয়নি।" : "Could not load installations.");
    } finally {
      setLoading(false);
    }
  }, [bn, equipmentType, from, q, status, to]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusPills = [
    { id: "", en: "All", bn: "সব", n: summary.total },
    ...PROJECT_STATUSES.map((row) => ({
      id: row.value,
      en: row.label,
      bn: STATUS_BN[row.value] || row.label,
      n: summary.byStatus[row.value] || 0,
    })),
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "ইনস্টলেশন হিস্ট্রি" : "Installation history"}
        subtitle={bn
          ? "সাইট ইনস্টল, চেকলিস্ট, কমিশন ও হ্যান্ডওভার — এক স্ক্রিনে।"
          : "Site install, checklist, commissioning and handover — one screen."}
        stats={[
          { value: summary.total || total, label: bn ? "প্রজেক্ট" : "projects" },
          { value: summary.open, label: bn ? "চলমান" : "open" },
          { value: summary.installing, label: bn ? "ইনস্টল" : "installing" },
          { value: summary.commissioned + summary.handed, label: bn ? "হ্যান্ডওভার" : "handed" },
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
              placeholder={bn ? "জব / কাস্টমার / সাইট" : "Job / customer / site"}
            />
            <Link href="/services/projects/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন প্রজেক্ট" : "New project"}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {statusPills.map((pill) => (
            <button
              key={pill.id || "all"}
              type="button"
              className={status === pill.id ? "on" : ""}
              onClick={() => {
                setStatus(pill.id);
                void load(q, pill.id, equipmentType, { from, to });
              }}
            >
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            setFrom(value);
            void load(q, status, equipmentType, { from: value, to });
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
            void load(q, status, equipmentType, { from, to: value });
          }}
        />
      </div>

      <div className="fu-views">
        <button
          type="button"
          className={equipmentType === "" ? "on" : ""}
          onClick={() => {
            setEquipmentType("");
            void load(q, status, "", { from, to });
          }}
        >
          {bn ? "সব লাইন" : "All lines"}
        </button>
        {EQUIPMENT_LINES.map((line) => (
          <button
            key={line.value}
            type="button"
            className={equipmentType === line.value ? "on" : ""}
            onClick={() => {
              setEquipmentType(line.value);
              void load(q, status, line.value, { from, to });
            }}
          >
            {typeLabel(line.value, bn)}
            {summary.byLine[line.value] ? <em>{summary.byLine[line.value]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && jobs.length === 0 ? (
          <EmptyState
            title={bn ? "ইনস্টলেশন নেই" : "No installations"}
            message={bn ? "নতুন প্রজেক্ট খুলুন, অথবা ফিল্টার সরান।" : "Start a project, or clear the filters."}
          />
        ) : null}

        <div className="fu-list">
          {jobs.map((job) => {
            const progress = checklistProgress(job.checklist);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job);
            const when = job.completedAt || job.scheduledDate || job.reportedAt;
            return (
              <article key={job._id} className={`fu-card ${statusTone(job.status)}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(customerName(job.customerId, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={`/services/projects/${job._id}`}>{job.jobNo || "—"}</Link>
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
                  <span className={`fu-chip ${statusTone(job.status)}`}>{statusLabel(job.status, bn)}</span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="inst-progress">
                  <span className="inst-bar" style={{ ["--pct" as string]: `${progress.percent}%` }}>
                    <i />
                  </span>
                  <em>{progress.total ? `${progress.label} · ${progress.percent}%` : bn ? "চেকলিস্ট নেই" : "No checklist"}</em>
                </div>
                <div className="fu-card-foot eq-foot">
                  <p className="fu-meta">
                    {typeLabel(job.equipmentType, bn)}
                    {unit ? ` · ${unit}` : ""}
                    {job.technicianId?.name ? ` · ${job.technicianId.name}` : bn ? " · ক্রু নেই" : " · no crew"}
                    {` · ${safeDate(when, locale)}`}
                  </p>
                  <Link className="fld-act" href={`/services/projects/${job._id}`}>
                    {bn ? "খুলুন" : "Open"}
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
