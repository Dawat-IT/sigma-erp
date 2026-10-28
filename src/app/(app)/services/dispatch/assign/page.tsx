"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES, slaState } from "@/lib/technical-checklists";
import { formatDateBD } from "@/lib/utils";
import { todayKey } from "@/lib/service-visit";

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

type Tech = { _id: string; name?: string; mobile?: string; speciality?: string };

type Board = { technician?: { _id?: string }; houseCount?: number };

type Scope = "all" | "sla" | "urgent";

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
};

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const CLOSED = new Set(["completed", "closed", "delivered", "cancelled", "resolved"]);
const CAP = 4;

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AS";
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
  if (sla.key === "due") return "is-warn";
  return "is-info";
}

export default function AssignTechnicianPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loadMap, setLoadMap] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ unassigned: "1", limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [j, t, d] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/technicians"),
        fetch(`/api/services/dispatch?date=${todayKey()}`),
      ]);
      const jobsJson = await j.json();
      const techJson = await t.json();
      const deskJson = await d.json();
      if (!j.ok) throw new Error(jobsJson.error || "load");
      const rows = (Array.isArray(jobsJson.data) ? jobsJson.data : jobsJson.items || []) as JobRow[];
      setJobs(rows.filter((job) => !CLOSED.has(String(job.status || "").toLowerCase())));
      setTechs(techJson.data || []);
      const nextLoad: Record<string, number> = {};
      for (const board of (deskJson.boards || []) as Board[]) {
        const id = String(board.technician?._id || "");
        if (id) nextLoad[id] = Number(board.houseCount || 0);
      }
      setLoadMap(nextLoad);
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "আনঅ্যাসাইনড জব লোড হয়নি।" : "Could not load unassigned jobs.");
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
      if (scope === "sla") return jobSla(job).key === "overdue";
      if (scope === "urgent") return job.priority === "urgent" || job.priority === "high" || job.jobKind === "emergency";
      return true;
    });
  }, [jobs, kind, scope]);

  const slaOverdue = jobs.filter((job) => jobSla(job).key === "overdue").length;
  const urgentN = jobs.filter((job) => job.priority === "urgent" || job.priority === "high" || job.jobKind === "emergency").length;
  const byKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const job of jobs) {
      const id = String(job.jobKind || "other");
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [jobs]);
  const lightest = [...techs].sort((a, b) => (loadMap[a._id] || 0) - (loadMap[b._id] || 0))[0];
  const overload = techs.filter((t) => (loadMap[t._id] || 0) >= CAP).length;

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "Unassigned", bn: "আনঅ্যাসাইনড", n: jobs.length },
    { id: "sla", en: "SLA overdue", bn: "SLA বকেয়া", n: slaOverdue },
    { id: "urgent", en: "Urgent / high", bn: "জরুরি", n: urgentN },
  ];

  function fillRoster() {
    const next = { ...pick };
    const counts = { ...loadMap };
    const roster = [...techs].sort((a, b) => (counts[a._id] || 0) - (counts[b._id] || 0));
    for (const job of filtered) {
      if (next[job._id]) {
        counts[next[job._id]] = (counts[next[job._id]] || 0) + 1;
        continue;
      }
      roster.sort((a, b) => (counts[a._id] || 0) - (counts[b._id] || 0));
      const tech = roster.find((row) => (counts[row._id] || 0) < CAP) || roster[0];
      if (!tech) continue;
      next[job._id] = tech._id;
      counts[tech._id] = (counts[tech._id] || 0) + 1;
    }
    setPick(next);
  }

  function stampTech(id: string) {
    setPick((prev) => {
      const next = { ...prev };
      for (const job of filtered) {
        if (!next[job._id]) next[job._id] = id;
      }
      return next;
    });
  }

  async function assign(jobId: string) {
    const technicianId = pick[jobId];
    if (!technicianId) return;
    setBusy(jobId);
    setError("");
    const res = await fetch(`/api/services/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId, status: "assigned", fieldStatus: "assigned" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(bn ? "অ্যাসাইন হয়নি।" : json.error || "Could not assign.");
      return;
    }
    setPick((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    await load();
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "টেকনিশিয়ান অ্যাসাইন" : "Assign technician"}
        subtitle={bn
          ? "আনঅ্যাসাইনড জব ক্রুতে দিন — লোড ও SLA এক স্ক্রিনে।"
          : "Put unassigned jobs on a crew — load and SLA on one screen."}
        stats={[
          { value: jobs.length, label: bn ? "আনঅ্যাসাইনড" : "unassigned" },
          { value: techs.length, label: bn ? "টেক" : "techs" },
          { value: slaOverdue, label: "SLA" },
          { value: lightest?.name || "—", label: bn ? "হালকা" : "lightest" },
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
            <Link href="/services/dispatch" className="gp-btn gp-btn-primary">{bn ? "আজকের বোর্ড" : "Today board"}</Link>
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
        <button type="button" className="gp-btn gp-btn-ghost" onClick={fillRoster} disabled={!techs.length || !filtered.length}>
          {bn ? "রোস্টার ভরুন" : "Fill roster"}
        </button>
        <Link href="/services/dispatch/live" className="gp-btn gp-btn-ghost">{bn ? "লাইভ" : "Live"}</Link>
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
            {byKind[id] ? <em>{byKind[id]}</em> : null}
          </button>
        ))}
      </div>

      {techs.length ? (
        <div className="fu-views">
          {techs.map((tech) => {
            const n = loadMap[tech._id] || 0;
            return (
              <button
                key={tech._id}
                type="button"
                className={n >= CAP ? "on" : ""}
                onClick={() => stampTech(tech._id)}
                title={bn ? "খালি জবে এই টেক বসান" : "Put this tech on empty jobs"}
              >
                {tech.name}
                <em>{n}/{CAP}</em>
              </button>
            );
          })}
        </div>
      ) : null}

      {overload ? (
        <p className="fu-filter-note">
          {bn ? `${overload} জনের আজ ${CAP} বা তার বেশি কাস্টমার।` : `${overload} tech(s) already at ${CAP}+ customers today.`}
        </p>
      ) : null}
      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "আনঅ্যাসাইনড জব নেই" : "No unassigned jobs"}
            message={bn ? "পেন্ডিং তালিকা বা আজকের বোর্ড খুলুন।" : "Open the pending list or today’s board."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const sla = jobSla(job);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const href = jobHref(job);
            const chosen = pick[job._id] || "";
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
                <div className="fu-card-foot asg-foot">
                  <p className="fu-meta">
                    {statusLabel(job.status, bn)}
                    {` · ${kindLabel(job.jobKind, bn)}`}
                    {` · ${safeDate(job.scheduledDate || job.reportedAt || job.createdAt, locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {job.customerId?.mobile ? ` · ${job.customerId.mobile}` : ""}
                  </p>
                  <select
                    className="gp-input"
                    aria-label={bn ? "টেকনিশিয়ান" : "Technician"}
                    value={chosen}
                    onChange={(e) => setPick((prev) => ({ ...prev, [job._id]: e.target.value }))}
                  >
                    <option value="">{bn ? "টেক" : "Tech"}</option>
                    {techs.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name} · {loadMap[tech._id] || 0}/{CAP}
                      </option>
                    ))}
                  </select>
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                  <button
                    type="button"
                    className="gp-btn gp-btn-primary"
                    disabled={busy === job._id || !chosen}
                    onClick={() => void assign(job._id)}
                  >
                    {busy === job._id ? "..." : bn ? "অ্যাসাইন" : "Assign"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
