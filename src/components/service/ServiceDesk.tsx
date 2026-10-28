"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { AlertTriangle, CalendarClock, CalendarDays, History, MapPin, Phone, Plus } from "lucide-react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES } from "@/lib/technical-checklists";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { formatDuration, mapsSearchUrl } from "@/lib/service-visit";

export type ServiceDeskMode = "history" | "upcoming" | "due";

type Customer = {
  _id?: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  location?: string;
  city?: string;
  contactPerson?: string;
  notes?: string;
};

type LastService = {
  jobNo?: string;
  status?: string;
  completedAt?: string;
  reportedAt?: string;
  durationMinutes?: number;
  technician?: { name?: string; mobile?: string } | null;
};

type MachineRow = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  nextServiceDue?: string;
  commissionedAt?: string;
  warrantyExpiryDate?: string;
  purchaseDate?: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  customerId?: Customer;
  lastService?: LastService | null;
};

type JobRow = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  issueDescription?: string;
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  completedAt?: string;
  receivedDate?: string;
  reportedAt?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  customerId?: Customer;
  technicianId?: { _id?: string; name?: string };
  machineId?: { brand?: string; model?: string; serialNo?: string; machineType?: string };
};

const TABS: { id: ServiceDeskMode; href: string; en: string; bn: string; hintEn: string; hintBn: string }[] = [
  { id: "history", href: "/services/history", en: "History", bn: "হিস্ট্রি", hintEn: "Completed jobs", hintBn: "সম্পন্ন জব" },
  { id: "upcoming", href: "/services/upcoming", en: "Upcoming", bn: "আপকামিং", hintEn: "Next 30 days", hintBn: "আগামী ৩০ দিন" },
  { id: "due", href: "/services/due", en: "Due", bn: "ডিউ", hintEn: "Overdue AMC", hintBn: "বকেয়া এএমসি" },
];

const DAYS_BN: Record<string, string> = { "7": "৭", "14": "১৪", "30": "৩০", "60": "৬০" };

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

function machineLabel(row: { brand?: string; model?: string; serialNo?: string; machineType?: string }) {
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ") || "—";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function jobStatusLabel(status: string | undefined, bn: boolean) {
  const key = String(status || "").toLowerCase();
  const map: Record<string, [string, string]> = {
    completed: ["Completed", "সম্পন্ন"],
    closed: ["Closed", "বন্ধ"],
    delivered: ["Delivered", "ডেলিভার"],
    resolved: ["Resolved", "সমাধান"],
    scheduled: ["Scheduled", "শিডিউল"],
    reported: ["Reported", "রিপোর্ট"],
    in_progress: ["In progress", "চলছে"],
    pending: ["Pending", "পেন্ডিং"],
    assigned: ["Assigned", "অ্যাসাইন"],
  };
  const pair = map[key];
  if (!pair) return status || "—";
  return bn ? pair[1] : pair[0];
}

function telOf(c?: Customer) {
  return c?.mobile || c?.phone || c?.whatsapp || "";
}

function waLink(raw?: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${local}`;
}

function mapsUrl(row: MachineRow) {
  if (row.lat && row.lng) return `https://www.google.com/maps?q=${row.lat},${row.lng}`;
  return mapsSearchUrl(row.siteAddress || row.customerId?.address, row.siteLocation || row.customerId?.location || row.customerId?.city);
}

function dueChip(iso: string | undefined, bn: boolean) {
  const delta = daysFromToday(iso);
  if (delta == null) return { cls: "muted", text: "—" };
  if (delta < 0) return { cls: "danger", text: bn ? `${Math.abs(delta)} দিন বকেয়া` : `${Math.abs(delta)}d overdue` };
  if (delta === 0) return { cls: "warn", text: bn ? "আজ" : "Today" };
  if (delta <= 7) return { cls: "warn", text: bn ? `${delta} দিন পর` : `In ${delta}d` };
  return { cls: "info", text: bn ? `${delta} দিন পর` : `In ${delta}d` };
}

export function ServiceDesk({ mode }: { mode: ServiceDeskMode }) {
  const locale = useLocale();
  const bn = locale === "bn";
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState("");
  const [days, setDays] = useState("30");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [counts, setCounts] = useState({ due: 0, upcoming: 0, history: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const machineQs = new URLSearchParams({ limit: "200" });
      if (equipment) machineQs.set("type", equipment);
      if (q.trim() && mode !== "history") machineQs.set("q", q.trim());
      if (fromDate) machineQs.set("from", fromDate);
      if (toDate) machineQs.set("to", toDate);

      const jobQs = new URLSearchParams({ limit: "100" });
      if (q.trim()) jobQs.set("q", q.trim());
      if (equipment) jobQs.set("equipmentType", equipment);
      if (fromDate) jobQs.set("from", fromDate);
      if (toDate) jobQs.set("to", toDate);

      const dueQs = new URLSearchParams(machineQs);
      dueQs.set("due", "1");
      const upQs = new URLSearchParams(machineQs);
      upQs.set("upcoming", "1");
      upQs.set("days", days);
      const histQs = new URLSearchParams(jobQs);
      histQs.set("scope", "history");
      const upJobQs = new URLSearchParams(jobQs);
      upJobQs.set("scope", "upcoming");

      const [dueRes, upRes, histRes, extraRes] = await Promise.all([
        fetch(`/api/machines?${dueQs}`).then((r) => r.json()),
        fetch(`/api/machines?${upQs}`).then((r) => r.json()),
        fetch(`/api/services?${histQs}`).then((r) => r.json()),
        mode === "upcoming"
          ? fetch(`/api/services?${upJobQs}`).then((r) => r.json())
          : Promise.resolve({ data: [] }),
      ]);

      setCounts({
        due: Number(dueRes.total || dueRes.data?.length || 0),
        upcoming: Number(upRes.total || upRes.data?.length || 0),
        history: Number(histRes.total || histRes.data?.length || 0),
      });
      if (mode === "due") setMachines(dueRes.data || dueRes.items || []);
      else if (mode === "upcoming") setMachines(upRes.data || upRes.items || []);
      else setMachines([]);
      setJobs(mode === "history" ? histRes.data || histRes.items || [] : extraRes.data || extraRes.items || []);
    } catch {
      setError(bn ? "লোড হয়নি" : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [bn, days, equipment, fromDate, mode, q, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = useMemo(() => {
    if (mode === "history") {
      return {
        title: bn ? "সার্ভিস হিস্ট্রি" : "Service history",
        subtitle: bn
          ? "সম্পন্ন ভিজিট, চার্জ, সময় ও কাস্টমার — পুরনো কাজ এক জায়গায়।"
          : "Completed visits, charges, time on site and customers — past work in one place.",
        emptyTitle: bn ? "সম্পন্ন সার্ভিস নেই" : "No completed services yet",
        emptyBody: bn
          ? "টেকনিশিয়ান জব বন্ধ করলে এখানে কাস্টমার, চার্জ, সময় ও ইনভয়েস দেখাবে।"
          : "When a technician closes a job, customer, charges, duration and invoice land here.",
      };
    }
    if (mode === "upcoming") {
      return {
        title: bn ? "আপকামিং সার্ভিস" : "Upcoming service",
        subtitle: bn
          ? "আগামী দিনের এএমসি ও শিডিউল জব — আগে থেকে টেকনিশিয়ান প্ল্যান করুন।"
          : "Upcoming AMC dates and scheduled jobs — plan technicians before the visit.",
        emptyTitle: bn ? "এই উইন্ডোতে সার্ভিস নেই" : "Nothing in this window",
        emptyBody: bn
          ? "মেশিনে পরবর্তী সার্ভিস তারিখ দিলে আগামী ৭–৬০ দিনের ইউনিট এখানে আসবে।"
          : "Units with a next-service date in the selected 7–60 day window appear here.",
      };
    }
    return {
      title: bn ? "ডিউ সার্ভিস" : "Due service",
      subtitle: bn
        ? "পরবর্তী সার্ভিস তারিখ পেরিয়ে যাওয়া ইউনিট — কত দিন বকেয়া, কোথায়, কার মোবাইল।"
        : "Units past their next service date — how overdue, where, and who to call.",
      emptyTitle: bn ? "ডিউ মেইনটেনেন্স নেই" : "No units currently due",
      emptyBody: bn
        ? "এএমসি তারিখ পেরোলে ইউনিট, কাস্টমার মোবাইল ও বকেয়া দিন এখানে জমবে।"
        : "When an AMC date passes, the unit, customer mobile and overdue days collect here.",
    };
  }, [bn, mode]);

  const overdueDays = machines
    .map((row) => daysFromToday(row.nextServiceDue))
    .filter((n): n is number => n != null && n <= 0)
    .map((n) => Math.abs(n));
  const avgOverdue = overdueDays.length
    ? Math.round(overdueDays.reduce((a, b) => a + b, 0) / overdueDays.length)
    : 0;
  const critical = overdueDays.filter((n) => n >= 14).length;
  const soon = machines.filter((row) => {
    const d = daysFromToday(row.nextServiceDue);
    return d != null && d > 0 && d <= 7;
  }).length;

  return (
    <div className="gp-desk svc-desk">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "আজকের ভিজিট" : "Today's visits"}</Link>
            <Link href="/services/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন জব" : "New job"}
            </Link>
          </div>
        }
      />

      <nav className="svc-tabs" aria-label={bn ? "সার্ভিস বোর্ড" : "Service board"}>
        {TABS.map((tab) => (
          <Link key={tab.id} href={tab.href} className={`svc-tab${mode === tab.id ? " is-on" : ""}`}>
            <span>{bn ? tab.hintBn : tab.hintEn}</span>
            <strong>{bn ? tab.bn : tab.en}</strong>
          </Link>
        ))}
      </nav>

      {error ? <AlertBanner tone="error" message={error} /> : null}

      <div className="svc-kpis">
        {mode === "due" ? (
          <>
            <div className="svc-kpi danger"><p>{bn ? "ডিউ ইউনিট" : "Units due"}</p><b>{counts.due}</b><em>{bn ? "এএমসি পেরিয়েছে" : "AMC date passed"}</em></div>
            <div className="svc-kpi warn"><p>{bn ? "গড় বকেয়া" : "Avg overdue"}</p><b>{avgOverdue}</b><em>{bn ? "দিন" : "days"}</em></div>
            <div className="svc-kpi danger"><p>{bn ? "১৪+ দিন" : "14+ days"}</p><b>{critical}</b><em>{bn ? "জরুরি ফলো-আপ" : "Urgent follow-up"}</em></div>
            <div className="svc-kpi info"><p>{bn ? "আপকামিং" : "Upcoming"}</p><b>{counts.upcoming}</b><em>{bn ? "আগামী ৩০ দিন" : "Next 30 days"}</em></div>
          </>
        ) : mode === "upcoming" ? (
          <>
            <div className="svc-kpi info"><p>{bn ? "আসন্ন ইউনিট" : "Units coming"}</p><b>{counts.upcoming}</b><em>{bn ? `${DAYS_BN[days] || days} দিনের উইন্ডো` : `${days}-day window`}</em></div>
            <div className="svc-kpi warn"><p>{bn ? "৭ দিনের মধ্যে" : "Within 7 days"}</p><b>{soon}</b><em>{bn ? "এই সপ্তাহ" : "This week"}</em></div>
            <div className="svc-kpi"><p>{bn ? "শিডিউল জব" : "Scheduled jobs"}</p><b>{jobs.length}</b><em>{bn ? "ওপেন / প্ল্যানড" : "Open / planned"}</em></div>
            <div className="svc-kpi danger"><p>{bn ? "ইতিমধ্যে ডিউ" : "Already due"}</p><b>{counts.due}</b><em>{bn ? "ডিউ বোর্ড দেখুন" : "See due board"}</em></div>
          </>
        ) : (
          <>
            <div className="svc-kpi info"><p>{bn ? "সম্পন্ন জব" : "Completed jobs"}</p><b>{counts.history}</b><em>{bn ? "হিস্ট্রি রেকর্ড" : "History records"}</em></div>
            <div className="svc-kpi"><p>{bn ? "এই তালিকা" : "On this list"}</p><b>{jobs.length}</b><em>{bn ? "ফিল্টার অনুযায়ী" : "After filters"}</em></div>
            <div className="svc-kpi warn"><p>{bn ? "ডিউ ইউনিট" : "Due units"}</p><b>{counts.due}</b><em>{bn ? "এখনও বকেয়া" : "Still outstanding"}</em></div>
            <div className="svc-kpi"><p>{bn ? "আপকামিং" : "Upcoming"}</p><b>{counts.upcoming}</b><em>{bn ? "পরবর্তী ভিজিট" : "Next visits"}</em></div>
          </>
        )}
      </div>

      <form
        className="svc-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(qInput.trim());
        }}
      >
        <label>
          <span className="gp-field-label">{bn ? "খুঁজুন" : "Search"}</span>
          <input className="gp-input" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={bn ? "কাস্টমার, সিরিয়াল, জব নং" : "Customer, serial, job no"} />
        </label>
        <label>
          <span className="gp-field-label">{bn ? "ইকুইপমেন্ট" : "Equipment"}</span>
          <select className="gp-input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">{bn ? "সব ধরন" : "All types"}</option>
            {EQUIPMENT_LINES.map((line) => (
              <option key={line.value} value={line.value}>{line.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="gp-field-label inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {bn ? "তারিখ থেকে" : "From"}
          </span>
          <input type="date" className="gp-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          <span className="gp-field-label inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {bn ? "তারিখ পর্যন্ত" : "To"}
          </span>
          <input type="date" className="gp-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        {mode === "upcoming" ? (
          <label>
            <span className="gp-field-label">{bn ? "উইন্ডো" : "Window"}</span>
            <select className="gp-input" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">{bn ? "৭ দিন" : "7 days"}</option>
              <option value="14">{bn ? "১৪ দিন" : "14 days"}</option>
              <option value="30">{bn ? "৩০ দিন" : "30 days"}</option>
              <option value="60">{bn ? "৬০ দিন" : "60 days"}</option>
            </select>
          </label>
        ) : null}
        <div className="svc-filter-actions">
          <button type="submit" className="gp-btn gp-btn-primary">{bn ? "ফিল্টার" : "Filter"}</button>
          <Link href="/services/technical/new" className="gp-btn gp-btn-ghost">
            <CalendarClock className="h-4 w-4" />
            {bn ? "শিডিউল" : "Schedule"}
          </Link>
        </div>
      </form>

      {mode === "history" ? (
        <JobBoard
          rows={jobs}
          loading={loading}
          bn={bn}
          locale={locale}
          title={bn ? "সম্পন্ন ভিজিট" : "Completed visits"}
          emptyTitle={copy.emptyTitle}
          emptyBody={copy.emptyBody}
        />
      ) : (
        <>
          <MachineBoard
            rows={machines}
            loading={loading}
            bn={bn}
            locale={locale}
            mode={mode}
            title={mode === "due" ? (bn ? "বকেয়া ইউনিট" : "Overdue units") : (bn ? "আসন্ন ইউনিট" : "Upcoming units")}
            emptyTitle={copy.emptyTitle}
            emptyBody={copy.emptyBody}
          />
          {mode === "upcoming" && jobs.length ? (
            <JobBoard
              rows={jobs}
              loading={false}
              bn={bn}
              locale={locale}
              title={bn ? "শিডিউল জব" : "Scheduled jobs"}
              emptyTitle=""
              emptyBody=""
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyState({
  mode,
  title,
  body,
  bn,
}: {
  mode: ServiceDeskMode;
  title: string;
  body: string;
  bn: boolean;
}) {
  const Icon = mode === "due" ? AlertTriangle : mode === "upcoming" ? CalendarClock : History;
  return (
    <div className="svc-empty">
      <Icon className="h-8 w-8" />
      <b>{title}</b>
      <p>{body}</p>
      <Link href={mode === "history" ? "/services/new" : "/services/technical/new"} className="gp-btn gp-btn-primary">
        {mode === "history" ? (bn ? "নতুন জব" : "New job") : (bn ? "ভিজিট শিডিউল" : "Schedule visit")}
      </Link>
    </div>
  );
}

function MachineBoard({
  rows,
  loading,
  bn,
  locale,
  mode,
  title,
  emptyTitle,
  emptyBody,
}: {
  rows: MachineRow[];
  loading: boolean;
  bn: boolean;
  locale: string;
  mode: ServiceDeskMode;
  title: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const rich = mode === "due";
  return (
    <div className="svc-panel">
      <div className="svc-panel-head">
        <b>{title}</b>
        <span>{loading ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? `${rows.length} ইউনিট` : `${rows.length} units`}</span>
      </div>
      {loading ? <p className="svc-empty"><span>{bn ? "লোড হচ্ছে..." : "Loading..."}</span></p> : null}
      {!loading && !rows.length ? <EmptyState mode={mode} title={emptyTitle} body={emptyBody} bn={bn} /> : null}
      {!loading && rows.length ? (
        <>
          <div className="svc-cards">
            {rows.map((row) => (
              <MachineCard key={row._id} row={row} bn={bn} locale={locale} mode={mode} rich={rich} />
            ))}
          </div>
          <div className="svc-table-wrap overflow-x-auto">
            <table className="svc-table">
              <thead>
                <tr>
                  <th>{bn ? "কাস্টমার" : "Customer"}</th>
                  <th>{bn ? "যোগাযোগ" : "Contact"}</th>
                  <th>{bn ? "মেশিন / ইউনিট" : "Machine / unit"}</th>
                  <th>{bn ? "সাইট" : "Site"}</th>
                  <th>{mode === "due" ? (bn ? "ডিউ তারিখ" : "Due date") : (bn ? "পরবর্তী সার্ভিস" : "Next service")}</th>
                  {rich ? <th>{bn ? "শেষ সার্ভিস" : "Last service"}</th> : null}
                  {rich ? <th>{bn ? "ওয়ারেন্টি" : "Warranty"}</th> : null}
                  <th>{bn ? "অবস্থা" : "Status"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const chip = dueChip(row.nextServiceDue, bn);
                  const cust = row.customerId;
                  const tel = telOf(cust);
                  const map = mapsUrl(row);
                  const lastAt = row.lastService?.completedAt || row.lastService?.reportedAt;
                  return (
                    <tr key={row._id}>
                      <td>
                        <p className="svc-name">{customerName(cust, bn)}</p>
                        {cust?.contactPerson ? <p className="svc-sub">{bn ? "কন্টাক্ট" : "Contact"} {cust.contactPerson}</p> : null}
                      </td>
                      <td>
                        {tel ? (
                          <p className="svc-name">
                            <a className="inline-flex items-center gap-1 text-[var(--gp-primary)]" href={`tel:${tel}`}>
                              <Phone className="h-3 w-3" />
                              {tel}
                            </a>
                          </p>
                        ) : <p className="svc-sub">—</p>}
                        {cust?.whatsapp ? (
                          <p className="svc-sub">
                            <a className="text-[var(--gp-primary)]" href={waLink(cust.whatsapp)} target="_blank" rel="noreferrer">WhatsApp {cust.whatsapp}</a>
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <p className="svc-name">{machineLabel(row)}</p>
                        <p className="svc-sub">{[row.machineType, row.serialNo].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      <td>
                        <p className="svc-name">{row.siteLocation || cust?.location || cust?.city || row.siteName || "—"}</p>
                        <p className="svc-sub">{row.siteAddress || cust?.address || ""}</p>
                        {map ? (
                          <p className="svc-sub">
                            <a className="inline-flex items-center gap-1 text-[var(--gp-primary)]" href={map} target="_blank" rel="noreferrer">
                              <MapPin className="h-3 w-3" />
                              {bn ? "ম্যাপ" : "Map"}
                            </a>
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <p className="svc-name">{safeDate(row.nextServiceDue, locale)}</p>
                        {row.commissionedAt ? <p className="svc-sub">{bn ? "কমিশন" : "Commissioned"} {safeDate(row.commissionedAt, locale)}</p> : null}
                      </td>
                      {rich ? (
                        <td>
                          <p className="svc-name">{safeDate(lastAt, locale)}</p>
                          <p className="svc-sub">{row.lastService?.technician?.name || row.lastService?.jobNo || "—"}</p>
                        </td>
                      ) : null}
                      {rich ? (
                        <td>
                          <p className="svc-name">{safeDate(row.warrantyExpiryDate, locale)}</p>
                          {row.purchaseDate ? <p className="svc-sub">{bn ? "কেনা" : "Bought"} {safeDate(row.purchaseDate, locale)}</p> : null}
                        </td>
                      ) : null}
                      <td><span className={`svc-chip ${chip.cls}`}>{chip.text}</span></td>
                      <td className="whitespace-nowrap">
                        {cust?._id ? (
                          <Link href={`/crm/client-followups/${cust._id}`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "ফলো-আপ" : "Follow-up"}</Link>
                        ) : null}
                        <Link href={`/services/new${cust?._id ? `?customerId=${cust._id}` : ""}`} className="gp-btn gp-btn-primary min-h-8 px-2 text-xs">{bn ? "ভিজিট" : "Visit"}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MachineCard({
  row,
  bn,
  locale,
  mode,
  rich,
}: {
  row: MachineRow;
  bn: boolean;
  locale: string;
  mode: ServiceDeskMode;
  rich: boolean;
}) {
  const chip = dueChip(row.nextServiceDue, bn);
  const cust = row.customerId;
  const tel = telOf(cust);
  const map = mapsUrl(row);
  const lastAt = row.lastService?.completedAt || row.lastService?.reportedAt;
  return (
    <article className={`svc-card${rich ? " is-due" : ""}`}>
      <div className="svc-card-top">
        <div>
          <p className="svc-name">{customerName(cust, bn)}</p>
          {cust?.contactPerson ? <p className="svc-sub">{bn ? "কন্টাক্ট পার্সন" : "Contact person"} · {cust.contactPerson}</p> : null}
          {tel ? (
            <p className="svc-sub">
              <a className="inline-flex items-center gap-1 text-[var(--gp-primary)]" href={`tel:${tel}`}>
                <Phone className="h-3 w-3" />
                {tel}
              </a>
            </p>
          ) : null}
        </div>
        <span className={`svc-chip ${chip.cls}`}>{chip.text}</span>
      </div>
      <div className={rich ? "svc-meta-grid" : "svc-meta"}>
        <p><span>{bn ? "মেশিন" : "Machine"} · </span>{machineLabel(row)}</p>
        <p><span>{bn ? "ধরন" : "Type"} · </span>{row.machineType || "—"}</p>
        <p><span>{bn ? "সাইট" : "Site"} · </span>{row.siteLocation || cust?.location || cust?.city || row.siteName || "—"}</p>
        <p><span>{bn ? "ঠিকানা" : "Address"} · </span>{row.siteAddress || cust?.address || "—"}</p>
        <p><span>{mode === "due" ? (bn ? "ডিউ" : "Due") : (bn ? "পরবর্তী" : "Next")} · </span>{safeDate(row.nextServiceDue, locale)}</p>
        {rich ? <p><span>{bn ? "শেষ সার্ভিস" : "Last service"} · </span>{safeDate(lastAt, locale)}</p> : null}
        {rich && row.lastService?.technician?.name ? <p><span>{bn ? "শেষ টেকনিশিয়ান" : "Last tech"} · </span>{row.lastService.technician.name}</p> : null}
        {row.warrantyExpiryDate ? <p><span>{bn ? "ওয়ারেন্টি" : "Warranty"} · </span>{safeDate(row.warrantyExpiryDate, locale)}</p> : null}
        {rich && row.commissionedAt ? <p><span>{bn ? "কমিশন" : "Commissioned"} · </span>{safeDate(row.commissionedAt, locale)}</p> : null}
        {cust?.whatsapp ? (
          <p>
            <span>WhatsApp · </span>
            <a className="text-[var(--gp-primary)]" href={waLink(cust.whatsapp)} target="_blank" rel="noreferrer">{cust.whatsapp}</a>
          </p>
        ) : null}
      </div>
      {rich && (row.notes || cust?.notes) ? <p className="svc-sub">{row.notes || cust?.notes}</p> : null}
      <div className="svc-card-actions">
        {map ? (
          <a href={map} target="_blank" rel="noreferrer" className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">
            <MapPin className="h-3 w-3" />
            {bn ? "ম্যাপ" : "Map"}
          </a>
        ) : null}
        {cust?._id ? (
          <Link href={`/crm/client-followups/${cust._id}`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "ফলো-আপ" : "Follow-up"}</Link>
        ) : null}
        <Link href={`/services/new${cust?._id ? `?customerId=${cust._id}` : ""}`} className="gp-btn gp-btn-primary min-h-8 px-2 text-xs">{bn ? "ভিজিট" : "Visit"}</Link>
      </div>
    </article>
  );
}

function JobBoard({
  rows,
  loading,
  bn,
  locale,
  title,
  emptyTitle,
  emptyBody,
}: {
  rows: JobRow[];
  loading: boolean;
  bn: boolean;
  locale: string;
  title: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <div className="svc-panel">
      <div className="svc-panel-head">
        <b>{title}</b>
        <span>{loading ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? `${rows.length} জব` : `${rows.length} jobs`}</span>
      </div>
      {loading ? <p className="svc-empty"><span>{bn ? "লোড হচ্ছে..." : "Loading..."}</span></p> : null}
      {!loading && !rows.length && emptyTitle ? <EmptyState mode="history" title={emptyTitle} body={emptyBody} bn={bn} /> : null}
      {!loading && rows.length ? (
        <>
          <div className="svc-cards">
            {rows.map((job) => (
              <article key={job._id} className="svc-card">
                <div className="svc-card-top">
                  <div>
                    <Link href={`/services/${job._id}`} className="svc-name text-[var(--gp-primary)]">{job.jobNo || "—"}</Link>
                    <p className="svc-sub">{job.issueDescription || job.jobKind || ""}</p>
                  </div>
                  <span className={`svc-chip ${job.status === "completed" || job.status === "delivered" || job.status === "resolved" ? "ok" : "info"}`}>
                    {jobStatusLabel(job.status, bn)}
                  </span>
                </div>
                <div className="svc-meta">
                  <p><span>{bn ? "কাস্টমার" : "Customer"} · </span>{customerName(job.customerId, bn) || job.siteName || "—"}</p>
                  <p><span>{bn ? "মেশিন" : "Machine"} · </span>{job.machineId ? machineLabel(job.machineId) : "—"}</p>
                  <p><span>{bn ? "টেকনিশিয়ান" : "Technician"} · </span>{job.technicianId?.name || (bn ? "অ্যাসাইন হয়নি" : "Unassigned")}</p>
                  <p>
                    <span>{bn ? "তারিখ" : "Date"} · </span>
                    {safeDate(job.completedAt || job.scheduledDate || job.receivedDate || job.reportedAt, locale)}
                    {job.durationMinutes ? ` · ${formatDuration(job.durationMinutes, bn ? "bn" : "en")}` : ""}
                  </p>
                  <p>
                    <span>{bn ? "মোট" : "Total"} · </span>
                    {formatBDT(Number(job.grandTotal || 0), locale)}
                    {Number(job.dueAmount || 0) > 0 ? ` · ${bn ? "বাকি" : "Due"} ${formatBDT(Number(job.dueAmount || 0), locale)}` : ""}
                  </p>
                </div>
                <div className="svc-card-actions">
                  <Link href={`/services/${job._id}`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "বিস্তারিত" : "Details"}</Link>
                  <Link href={`/services/${job._id}/invoice`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "ইনভয়েস" : "Invoice"}</Link>
                </div>
              </article>
            ))}
          </div>
          <div className="svc-table-wrap overflow-x-auto">
            <table className="svc-table">
              <thead>
                <tr>
                  <th>{bn ? "জব" : "Job"}</th>
                  <th>{bn ? "কাস্টমার" : "Customer"}</th>
                  <th>{bn ? "মেশিন" : "Machine"}</th>
                  <th>{bn ? "টেকনিশিয়ান" : "Technician"}</th>
                  <th>{bn ? "তারিখ" : "Date"}</th>
                  <th>{bn ? "মোট" : "Total"}</th>
                  <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr key={job._id}>
                    <td>
                      <Link href={`/services/${job._id}`} className="svc-name text-[var(--gp-primary)]">{job.jobNo || "—"}</Link>
                      <p className="svc-sub">{job.issueDescription || job.jobKind || ""}</p>
                    </td>
                    <td>
                      <p className="svc-name">{customerName(job.customerId, bn) || job.siteName || "—"}</p>
                      <p className="svc-sub">{job.siteLocation || job.customerId?.location || job.customerId?.mobile || ""}</p>
                    </td>
                    <td>
                      <p className="svc-name">{job.machineId ? machineLabel(job.machineId) : "—"}</p>
                    </td>
                    <td>{job.technicianId?.name || <span className="text-muted">{bn ? "অ্যাসাইন হয়নি" : "Unassigned"}</span>}</td>
                    <td>
                      <p className="svc-name">{safeDate(job.completedAt || job.scheduledDate || job.receivedDate || job.reportedAt, locale)}</p>
                      {job.durationMinutes ? <p className="svc-sub">{formatDuration(job.durationMinutes, bn ? "bn" : "en")}</p> : null}
                    </td>
                    <td>
                      <p className="gp-money svc-name">{formatBDT(Number(job.grandTotal || 0), locale)}</p>
                      {Number(job.dueAmount || 0) > 0 ? <p className="svc-sub text-[var(--gp-danger)]">{bn ? "বাকি" : "Due"} {formatBDT(Number(job.dueAmount || 0), locale)}</p> : null}
                    </td>
                    <td>
                      <span className={`svc-chip ${job.status === "completed" || job.status === "delivered" || job.status === "resolved" ? "ok" : "info"}`}>
                        {jobStatusLabel(job.status, bn)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/services/${job._id}`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "বিস্তারিত" : "Details"}</Link>
                      <Link href={`/services/${job._id}/invoice`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "ইনভয়েস" : "Invoice"}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
