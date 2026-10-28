"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES } from "@/lib/technical-checklists";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { formatDuration, todayKey } from "@/lib/service-visit";

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
  scheduledDate?: string;
  checkedInAt?: string;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

type Tech = {
  _id: string;
  name: string;
  mobile?: string;
  speciality?: string;
};

type Summary = { total: number; open: number; completed: number; billed: number };
type Scope = "all" | "open" | "done" | "today";

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
  waiting_parts: ["Parts", "পার্টস"],
  on_site: ["On site", "অন সাইট"],
  resolved: ["Resolved", "সমাধান"],
  completed: ["Completed", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  delivered: ["Delivered", "ডেলিভার"],
  cancelled: ["Cancelled", "বাতিল"],
};

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const CLOSED = new Set(["resolved", "closed", "completed", "delivered", "cancelled"]);

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "TK";
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

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function isOpen(job: JobRow) {
  return !CLOSED.has(String(job.status || "").toLowerCase());
}

function dayKey(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cardTone(job: JobRow) {
  const status = String(job.status || "").toLowerCase();
  if (status === "cancelled") return "is-info";
  if (!isOpen(job)) return Number(job.dueAmount || 0) > 0 ? "is-warn" : "is-ok";
  if (job.jobKind === "emergency") return "is-danger";
  return "is-warn";
}

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const bn = locale === "bn";
  const [tech, setTech] = useState<Tech | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, open: 0, completed: 0, billed: 0 });
  const [todayLoad, setTodayLoad] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState("");
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", mobile: "", speciality: "" });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, deskRes] = await Promise.all([
        fetch(`/api/technicians/${id}?withJobs=1`),
        fetch(`/api/services/dispatch?date=${todayKey()}`),
      ]);
      const json = await res.json();
      const desk = await deskRes.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "load");
      setTech(json.data);
      setForm({
        name: json.data?.name || "",
        mobile: json.data?.mobile || "",
        speciality: json.data?.speciality || "",
      });
      setJobs(json.jobs || []);
      setSummary(json.summary || { total: 0, open: 0, completed: 0, billed: 0 });
      const board = (desk.boards || []).find((row: { technician?: { _id?: string } }) => String(row.technician?._id || "") === String(id));
      setTodayLoad(Number(board?.houseCount || 0));
      setError("");
    } catch {
      setTech(null);
      setJobs([]);
      setError(bn ? "প্রোফাইল লোড হয়নি।" : "Could not load the profile.");
    } finally {
      setLoading(false);
    }
  }, [bn, id]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const today = todayKey();
    return jobs.filter((job) => {
      if (kind && String(job.jobKind || "") !== kind) return false;
      if (scope === "open" && !isOpen(job)) return false;
      if (scope === "done" && isOpen(job)) return false;
      if (scope === "today") {
        const keys = [job.scheduledDate, job.reportedAt, job.checkedInAt, job.completedAt].map(dayKey);
        if (!keys.includes(today)) return false;
      }
      if (date) {
        const keys = [job.scheduledDate, job.reportedAt, job.checkedInAt, job.completedAt].map(dayKey);
        if (!keys.includes(date)) return false;
      }
      if (!needle) return true;
      return [job.jobNo, customerName(job.customerId, bn), job.issueDescription, job.siteName]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [bn, date, jobs, kind, scope, search]);

  const byKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const job of jobs) {
      const idk = String(job.jobKind || "other");
      map[idk] = (map[idk] || 0) + 1;
    }
    return map;
  }, [jobs]);

  const todayN = useMemo(() => {
    const today = todayKey();
    return jobs.filter((job) => [job.scheduledDate, job.reportedAt, job.checkedInAt, job.completedAt].map(dayKey).includes(today)).length;
  }, [jobs]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All jobs", bn: "সব জব", n: summary.total },
    { id: "open", en: "Open", bn: "ওপেন", n: summary.open },
    { id: "done", en: "Done", bn: "সম্পন্ন", n: summary.completed },
    { id: "today", en: "Today", bn: "আজ", n: todayN },
  ];

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/technicians/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setTech(json.data);
      setEdit(false);
    } catch {
      setError(bn ? "প্রোফাইল সেভ হয়নি।" : "Could not save the profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !tech) {
    return <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p>;
  }
  if (!tech) {
    return <EmptyState title={bn ? "টেকনিশিয়ান নেই" : "Technician not found"} message={error || ""} />;
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={tech.name}
        subtitle={bn
          ? `${tech.speciality || "দক্ষতা নেই"} — জব ও প্রোফাইল এক স্ক্রিনে।`
          : `${tech.speciality || "No speciality"} — jobs and profile on one screen.`}
        stats={[
          { value: summary.total, label: bn ? "জব" : "jobs" },
          { value: summary.open, label: bn ? "ওপেন" : "open" },
          { value: todayLoad, label: bn ? "আজ" : "today" },
          { value: moneyShort(summary.billed, locale), label: bn ? "বিল" : "billed" },
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
              placeholder={bn ? "জব / কাস্টমার" : "Job / customer"}
            />
            <Link href={`/services/new?technicianId=${id}`} className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন জব" : "New job"}
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
        <Link href="/services/technicians" className="gp-btn gp-btn-ghost">{bn ? "রোস্টার" : "Roster"}</Link>
        <Link href="/services/dispatch/assign" className="gp-btn gp-btn-ghost">{bn ? "অ্যাসাইন" : "Assign"}</Link>
        <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "বোর্ড" : "Board"}</Link>
        <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setEdit((v) => !v)}>
          {bn ? (edit ? "বন্ধ" : "এডিট") : edit ? "Close" : "Edit"}
        </button>
        <input
          type="date"
          aria-label={bn ? "তারিখ" : "Date"}
          className="gp-input fu-search"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={kind === "" ? "on" : ""} onClick={() => setKind("")}>
          {bn ? "সব ধরন" : "All kinds"}
        </button>
        {KINDS.map((idk) => (
          <button key={idk} type="button" className={kind === idk ? "on" : ""} onClick={() => setKind(idk)}>
            {kindLabel(idk, bn)}
            {byKind[idk] ? <em>{byKind[idk]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {edit ? (
          <form onSubmit={saveProfile} className="eq-add-panel amc-new">
            <b>{bn ? "প্রোফাইল" : "Profile"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "নাম" : "Name"}>
                <input required className="gp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={bn ? "মোবাইল" : "Mobile"}>
                <input className="gp-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </Field>
              <Field label={bn ? "দক্ষতা" : "Speciality"} className="span-2">
                <input className="gp-input" value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} />
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={() => setEdit(false)}>{bn ? "বাতিল" : "Cancel"}</button>
              <button type="submit" disabled={saving} className="gp-btn gp-btn-primary">
                {saving ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "জব নেই" : "No jobs"}
            message={bn ? "নতুন জব খুলুন, অথবা ফিল্টার সরান।" : "Open a job, or clear the filters."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const due = Number(job.dueAmount || 0);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const href = jobHref(job);
            const when = job.completedAt || job.scheduledDate || job.reportedAt;
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
                  <span className={`fu-chip ${cardTone(job)}`}>{statusLabel(job.status, bn)}</span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {kindLabel(job.jobKind, bn)}
                    {job.durationMinutes ? ` · ${formatDuration(job.durationMinutes, bn ? "bn" : "en")}` : ""}
                    {` · ${safeDate(when, locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {Number(job.grandTotal || 0) > 0 ? ` · ${moneyShort(Number(job.grandTotal || 0), locale)}` : ""}
                    {due > 0 ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(due, locale)}` : ""}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                  <Link className="fld-act" href={`/m/${job._id}`}>{bn ? "ফিল্ড" : "Field"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
