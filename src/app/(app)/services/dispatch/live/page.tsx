"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES, slaState } from "@/lib/technical-checklists";
import { formatClock, formatDuration, mapsSearchUrl } from "@/lib/service-visit";

type Customer = {
  _id?: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  location?: string;
  city?: string;
  address?: string;
};

type Tech = { _id?: string; name?: string; mobile?: string; speciality?: string };

type LiveJob = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  priority?: string;
  issueDescription?: string;
  reportedAt?: string;
  createdAt?: string;
  checkedInAt?: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: Tech;
  technicianIds?: Tech[];
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string; siteName?: string; siteLocation?: string };
};

type Scope = "all" | "long" | "sla" | "urgent";

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

const LONG_MS = 3 * 36e5;

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "LV";
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

function machineLabel(row?: LiveJob["machineId"]) {
  if (!row) return "";
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ");
}

function techOf(job: LiveJob) {
  return job.technicianId?.name ? job.technicianId : job.technicianIds?.[0];
}

function jobHref(job: LiveJob) {
  if (job.jobKind === "complaint") return `/services/complaints/${job._id}`;
  if (job.jobKind === "installation") return `/services/projects/${job._id}`;
  return `/services/${job._id}`;
}

function minutesOnSite(iso?: string) {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.round((Date.now() - start) / 60000));
}

function isLong(job: LiveJob) {
  const start = new Date(job.checkedInAt || 0).getTime();
  return Number.isFinite(start) && Date.now() - start >= LONG_MS;
}

function jobSla(job: LiveJob) {
  return slaState({
    status: job.status,
    jobKind: job.jobKind,
    priority: job.priority,
    reportedAt: job.reportedAt,
    createdAt: job.createdAt,
  });
}

function cardTone(job: LiveJob) {
  const sla = jobSla(job);
  if (job.jobKind === "emergency" || job.priority === "urgent" || sla.key === "overdue") return "is-danger";
  if (isLong(job) || sla.key === "due") return "is-warn";
  return "is-ok";
}

export default function LiveDispatchPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<LiveJob[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState("");
  const [techId, setTechId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/services/live");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setRows(Array.isArray(json.data) ? json.data : []);
      setUpdatedAt(Date.now());
      setError("");
    } catch {
      if (!silent) setRows([]);
      setError(bn ? "লাইভ স্ট্যাটাস লোড হয়নি।" : "Could not load live status.");
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(true), 20000);
    return () => {
      window.clearInterval(t);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [load]);

  const techs = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of rows) {
      const tech = techOf(job);
      if (tech?._id) map.set(String(tech._id), tech.name || "—");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((job) => {
      if (kind && String(job.jobKind || "") !== kind) return false;
      const tech = techOf(job);
      if (techId && String(tech?._id || "") !== techId) return false;
      if (scope === "long" && !isLong(job)) return false;
      if (scope === "sla" && jobSla(job).key !== "overdue") return false;
      if (scope === "urgent" && !(job.priority === "urgent" || job.priority === "high" || job.jobKind === "emergency")) return false;
      if (!needle) return true;
      return [
        job.jobNo,
        customerName(job.customerId, bn),
        job.siteLocation,
        job.siteAddress,
        job.issueDescription,
        tech?.name,
      ].some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [bn, kind, rows, scope, search, techId]);

  const uniqueTechs = techs.length;
  const longN = rows.filter(isLong).length;
  const slaN = rows.filter((job) => jobSla(job).key === "overdue").length;
  const urgentN = rows.filter((job) => job.priority === "urgent" || job.priority === "high" || job.jobKind === "emergency").length;
  const byKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const job of rows) {
      const id = String(job.jobKind || "other");
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [rows]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "On site", bn: "অন সাইট", n: rows.length },
    { id: "long", en: "3h+", bn: "৩ঘ+", n: longN },
    { id: "sla", en: "SLA overdue", bn: "SLA বকেয়া", n: slaN },
    { id: "urgent", en: "Urgent / high", bn: "জরুরি", n: urgentN },
  ];

  async function checkOut(jobId: string) {
    setBusyId(jobId);
    setError("");
    try {
      const res = await fetch(`/api/services/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_out" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          need_checkin: bn ? "আগে চেক-ইন করুন।" : "Check in first.",
        };
        throw new Error(map[String(json.error)] || json.error || "failed");
      }
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "লাইভ টেকনিশিয়ান" : "Live technicians"}
        subtitle={bn
          ? "যারা এখন চেক-ইন করে সাইটে আছেন — ২০ সেকেন্ডে রিফ্রেশ।"
          : "Crew currently checked in on site — refreshes every 20 seconds."}
        stats={[
          { value: rows.length, label: bn ? "অন সাইট" : "on site" },
          { value: uniqueTechs, label: bn ? "টেক" : "techs" },
          { value: longN, label: bn ? "৩ঘ+" : "3h+" },
          { value: slaN, label: "SLA" },
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
              placeholder={bn ? "টেক / কাস্টমার" : "Tech / customer"}
            />
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => void load()}>
              {bn ? "রিফ্রেশ" : "Refresh"}
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
        <Link href="/m" className="gp-btn gp-btn-ghost">{bn ? "ফিল্ড" : "Field"}</Link>
        {updatedAt ? (
          <span className="fu-filter-note" style={{ margin: 0 }}>
            {bn ? "আপডেট" : "Updated"} {formatClock(new Date(updatedAt).toISOString(), bn ? "bn" : "en")}
          </span>
        ) : null}
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
          <button type="button" className={techId === "" ? "on" : ""} onClick={() => setTechId("")}>
            {bn ? "সব টেক" : "All techs"}
          </button>
          {techs.map((tech) => (
            <button key={tech.id} type="button" className={techId === tech.id ? "on" : ""} onClick={() => setTechId(tech.id)}>
              {tech.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "এখন কেউ অন সাইট নেই" : "Nobody is on site"}
            message={bn ? "চেক-ইন হলে এখানে আসবে। আজকের বোর্ড থেকে ভিজিট খুলুন।" : "Check-ins land here. Open today’s board to start a visit."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const tech = techOf(job);
            const sla = jobSla(job);
            const mins = minutesOnSite(job.checkedInAt);
            const site = [job.siteName, job.siteLocation || job.siteAddress || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const href = jobHref(job);
            const map = mapsSearchUrl(job.siteAddress || job.customerId?.address, job.siteLocation || job.customerId?.location);
            const tone = cardTone(job);
            return (
              <article key={job._id} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(tech?.name || customerName(job.customerId, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      {tech?._id ? (
                        <Link href={`/services/technicians/${tech._id}`}>{tech.name || "—"}</Link>
                      ) : (
                        job.jobNo || "—"
                      )}
                    </strong>
                    <p>
                      <Link href={href}>{job.jobNo || "—"}</Link>
                      {` · ${customerName(job.customerId, bn)}`}
                      {site ? ` · ${site}` : ""}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>
                    {formatDuration(mins, bn ? "bn" : "en")}
                  </span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {bn ? "ইন" : "In"} {formatClock(job.checkedInAt, bn ? "bn" : "en")}
                    {` · ${kindLabel(job.jobKind, bn)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {tech?.mobile ? ` · ${tech.mobile}` : ""}
                    {job.customerId?.mobile ? ` · ${job.customerId.mobile}` : ""}
                    {sla.key === "overdue" ? ` · ${sla.label}` : ""}
                    {isLong(job) ? (bn ? " · লম্বা ভিজিট" : " · long visit") : ""}
                  </p>
                  <button
                    type="button"
                    className="fld-act"
                    disabled={busyId === job._id}
                    onClick={() => void checkOut(job._id)}
                  >
                    {bn ? "চেক-আউট" : "Check out"}
                  </button>
                  {map ? (
                    <a className="fld-act" href={map} target="_blank" rel="noreferrer">{bn ? "ম্যাপ" : "Map"}</a>
                  ) : (
                    <Link className="fld-act" href={`/m/${job._id}`}>{bn ? "ফিল্ড" : "Field"}</Link>
                  )}
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
