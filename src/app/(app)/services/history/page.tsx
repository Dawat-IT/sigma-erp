"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  scheduledDate?: string;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  equipmentType?: string;
  customerId?: Customer;
  technicianId?: { name?: string };
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

const SERVICE_KINDS = ["complaint", "scheduled", "emergency", "general"] as const;

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["PM visit", "পিএম ভিজিট"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  general: ["General", "জেনারেল"],
  installation: ["Install", "ইনস্টল"],
};

const STATUS: Record<string, [string, string]> = {
  completed: ["Completed", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  delivered: ["Delivered", "ডেলিভার"],
  resolved: ["Resolved", "সমাধান"],
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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "SV";
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

function safeDate(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

export default function ServiceHistoryPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    billed: 0,
    due: 0,
    byKind: {} as Record<string, number>,
    byLine: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, nextKind = kind, nextType = equipmentType, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ scope: "history", limit: "200" });
    qs.set("jobKind", nextKind || SERVICE_KINDS.join(","));
    if (search.trim()) qs.set("q", search.trim());
    if (nextType) qs.set("equipmentType", nextType);
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/services?${qs}`),
        fetch("/api/services?summary=history"),
      ]);
      const json = await listRes.json();
      const sum = await sumRes.json();
      if (!listRes.ok) throw new Error(json.error || "load");
      setJobs(Array.isArray(json.data) ? json.data : json.items || []);
      setTotal(Number(json.total) || 0);
      if (sumRes.ok && !sum.error) {
        setSummary({
          total: Number(sum.total) || 0,
          today: Number(sum.today) || 0,
          billed: Number(sum.billed) || 0,
          due: Number(sum.due) || 0,
          byKind: sum.byKind || {},
          byLine: sum.byLine || {},
        });
      }
      setError("");
    } catch {
      setJobs([]);
      setError(bn ? "হিস্ট্রি লোড হয়নি।" : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, [bn, equipmentType, from, kind, q, to]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kindPills = [
    { id: "", en: "All visits", bn: "সব ভিজিট", n: summary.total },
    ...SERVICE_KINDS.map((id) => ({
      id,
      en: KIND[id][0],
      bn: KIND[id][1],
      n: summary.byKind[id] || 0,
    })),
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "সার্ভিস হিস্ট্রি" : "Service history"}
        subtitle={bn
          ? "সম্পন্ন ভিজিট, চার্জ, সময় ও কাস্টমার — এক স্ক্রিনে।"
          : "Completed visits, charges, time on site and customers — one screen."}
        stats={[
          { value: summary.total || total, label: bn ? "সম্পন্ন" : "closed" },
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
              placeholder={bn ? "জব / কাস্টমার / সমস্যা" : "Job / customer / issue"}
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
          {kindPills.map((pill) => (
            <button
              key={pill.id || "all"}
              type="button"
              className={kind === pill.id ? "on" : ""}
              onClick={() => {
                setKind(pill.id);
                void load(q, pill.id, equipmentType, { from, to });
              }}
            >
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/services/upcoming" className="gp-btn gp-btn-ghost">{bn ? "আপকামিং" : "Upcoming"}</Link>
        <Link href="/services/due" className="gp-btn gp-btn-ghost">{bn ? "ডিউ" : "Due"}</Link>
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            setFrom(value);
            void load(q, kind, equipmentType, { from: value, to });
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
            void load(q, kind, equipmentType, { from, to: value });
          }}
        />
      </div>

      <div className="fu-views">
        <button
          type="button"
          className={equipmentType === "" ? "on" : ""}
          onClick={() => {
            setEquipmentType("");
            void load(q, kind, "", { from, to });
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
              void load(q, kind, line.value, { from, to });
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
            title={bn ? "সম্পন্ন সার্ভিস নেই" : "No completed services"}
            message={bn ? "জব ক্লোজ হলে ভিজিট, চার্জ ও ইনভয়েস এখানে আসবে।" : "When a job closes, the visit, charges and invoice land here."}
          />
        ) : null}

        <div className="fu-list">
          {jobs.map((job) => {
            const due = Number(job.dueAmount || 0);
            const site = [job.siteName, job.siteLocation || job.customerId?.location || job.customerId?.city].filter(Boolean).join(" · ");
            const unit = machineLabel(job.machineId);
            const when = job.completedAt || job.scheduledDate || job.reportedAt;
            return (
              <article key={job._id} className={`fu-card ${due > 0 ? "is-warn" : "is-ok"}`}>
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
                  <b className="qt-amt">{moneyShort(Number(job.grandTotal || 0), locale)}</b>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {kindLabel(job.jobKind, bn)}
                    {` · ${statusLabel(job.status, bn)}`}
                    {job.technicianId?.name ? ` · ${job.technicianId.name}` : ""}
                    {job.durationMinutes ? ` · ${formatDuration(job.durationMinutes, bn ? "bn" : "en")}` : ""}
                    {` · ${safeDate(when, locale)}`}
                    {unit ? ` · ${unit}` : typeLabel(job.equipmentType, bn) ? ` · ${typeLabel(job.equipmentType, bn)}` : ""}
                    {due > 0 ? ` · ${bn ? "বাকি" : "due"} ${moneyShort(due, locale)}` : ""}
                  </p>
                  <Link className="fld-act" href={`/services/${job._id}`}>{bn ? "খুলুন" : "Open"}</Link>
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
