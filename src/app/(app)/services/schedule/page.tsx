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

type LastService = {
  jobNo?: string;
  completedAt?: string;
  reportedAt?: string;
  technician?: { name?: string } | null;
};

type Row = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  nextServiceDue?: string;
  warrantyExpiryDate?: string;
  siteName?: string;
  siteLocation?: string;
  customerId?: Customer;
  lastService?: LastService | null;
};

type WindowId = "queue" | "due" | "today" | "week" | "month" | "all";

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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "PM";
}

function machineLabel(row: Row) {
  return [row.brand, row.model, row.serialNo].filter(Boolean).join(" · ") || "—";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
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

function daysFromToday(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((startOfDay(d).getTime() - startOfDay().getTime()) / 86400000);
}

function dueTone(row: Row) {
  const days = daysFromToday(row.nextServiceDue);
  if (days != null && days < 0) return "is-danger";
  if (days != null && days <= 7) return "is-warn";
  if (days != null && days <= 30) return "is-info";
  return "is-ok";
}

function dueChip(row: Row, bn: boolean) {
  const days = daysFromToday(row.nextServiceDue);
  if (days == null) return { label: bn ? "ডিউ নেই" : "No due", tone: "is-info" };
  if (days < 0) return { label: bn ? `${Math.abs(days)} দিন বকেয়া` : `${Math.abs(days)}d overdue`, tone: "is-danger" };
  if (days === 0) return { label: bn ? "আজ" : "Today", tone: "is-warn" };
  if (days <= 7) return { label: bn ? `${days} দিন` : `${days}d`, tone: "is-warn" };
  return { label: safeDate(row.nextServiceDue, bn ? "bn" : "en"), tone: "is-info" };
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "—";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function inRange(iso: string | undefined, from: string, to: string) {
  if (!iso) return false;
  const key = new Date(iso);
  if (Number.isNaN(key.getTime())) return false;
  const day = startOfDay(key).getTime();
  if (from && day < startOfDay(new Date(`${from}T00:00:00`)).getTime()) return false;
  if (to && day > startOfDay(new Date(`${to}T00:00:00`)).getTime()) return false;
  return true;
}

function weekday(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long" }).format(d);
}

function localDayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "none";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function groupKey(row: Row) {
  const days = daysFromToday(row.nextServiceDue);
  if (days == null) return "none";
  if (days < 0) return "overdue";
  return localDayKey(row.nextServiceDue as string);
}

export default function MaintenanceSchedulePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    due: 0,
    upcoming: 0,
    today: 0,
    thisWeek: 0,
    byType: {} as Record<string, number>,
  });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [win, setWin] = useState<WindowId>("queue");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q) => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "200", schedule: "1" });
    if (search.trim()) qs.set("q", search.trim());
    try {
      const res = await fetch(`/api/machines?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      const data = (Array.isArray(json.data) ? json.data : json.items || []) as Row[];
      data.sort((a, b) => String(a.nextServiceDue || "9").localeCompare(String(b.nextServiceDue || "9")));
      setRows(data);
      setSummary({
        total: Number(json.summary?.total) || data.length,
        due: Number(json.summary?.due) || 0,
        upcoming: Number(json.summary?.upcoming) || 0,
        today: Number(json.summary?.today) || 0,
        thisWeek: Number(json.summary?.thisWeek) || 0,
        byType: json.summary?.byType || {},
      });
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "শিডিউল লোড হয়নি।" : "Could not load the schedule.");
    } finally {
      setLoading(false);
    }
  }, [bn, q]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (type && row.machineType !== type) return false;
      if (from || to) return inRange(row.nextServiceDue, from, to);
      const days = daysFromToday(row.nextServiceDue);
      if (win === "due") return days != null && days < 0;
      if (win === "today") return days === 0;
      if (win === "week") return days != null && days >= 0 && days <= 7;
      if (win === "month") return days != null && days > 0 && days <= 30;
      if (win === "queue") return days != null && days <= 30;
      return true;
    });
  }, [from, rows, to, type, win]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      const key = groupKey(row);
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "overdue") return -1;
      if (b === "overdue") return 1;
      if (a === "none") return 1;
      if (b === "none") return -1;
      return a.localeCompare(b);
    });
    return keys.map((key) => ({ key, rows: map.get(key) || [] }));
  }, [filtered]);

  const windows: { id: WindowId; en: string; bn: string; n: number }[] = [
    { id: "queue", en: "Queue", bn: "কিউ", n: rows.filter((r) => { const d = daysFromToday(r.nextServiceDue); return d != null && d <= 30; }).length },
    { id: "due", en: "Overdue", bn: "ডিউ", n: summary.due },
    { id: "today", en: "Today", bn: "আজ", n: summary.today },
    { id: "week", en: "This week", bn: "এই সপ্তাহ", n: summary.thisWeek },
    { id: "month", en: "Next 30 days", bn: "আগামী ৩০ দিন", n: summary.upcoming },
    { id: "all", en: "All dates", bn: "সব তারিখ", n: summary.total || rows.length },
  ];

  function groupTitle(key: string) {
    if (key === "overdue") return bn ? "বকেয়া" : "Overdue";
    if (key === "none") return bn ? "ডিউ তারিখ নেই" : "No due date";
    return safeDate(key, locale);
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "মেইনটেন্যান্স শিডিউল" : "Maintenance schedule"}
        subtitle={bn
          ? "পরবর্তী সার্ভিস তারিখ অনুযায়ী ইউনিট — বকেয়া থেকে আগামী মাস।"
          : "Units by next service date — overdue through the coming month."}
        stats={[
          { value: summary.due, label: bn ? "ডিউ" : "overdue" },
          { value: summary.today, label: bn ? "আজ" : "today" },
          { value: summary.thisWeek, label: bn ? "সপ্তাহ" : "this week" },
          { value: summary.upcoming, label: bn ? "৩০ দিন" : "30 days" },
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
              placeholder={bn ? "কাস্টমার / সিরিয়াল / সাইট" : "Customer / serial / site"}
            />
            <Link href="/services/amc/dispatch" className="gp-btn gp-btn-primary">
              {bn ? "অটো ডিসপ্যাচ" : "Auto dispatch"}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {windows.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={win === pill.id && !from && !to ? "on" : ""}
              onClick={() => {
                setWin(pill.id);
                setFrom("");
                setTo("");
              }}
            >
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/services/due" className="gp-btn gp-btn-ghost">{bn ? "ডিউ বোর্ড" : "Due board"}</Link>
        <Link href="/services/upcoming" className="gp-btn gp-btn-ghost">{bn ? "আপকামিং" : "Upcoming"}</Link>
        <input
          type="date"
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
          className="gp-input fu-search"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label={bn ? "শেষ তারিখ" : "To date"}
          className="gp-input fu-search"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={type === "" ? "on" : ""} onClick={() => setType("")}>
          {bn ? "সব ধরন" : "All types"}
        </button>
        {EQUIPMENT_LINES.map((line) => (
          <button
            key={line.value}
            type="button"
            className={type === line.value ? "on" : ""}
            onClick={() => setType(line.value)}
          >
            {typeLabel(line.value, bn)}
            {summary.byType[line.value] ? <em>{summary.byType[line.value]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "এই উইন্ডোতে সার্ভিস নেই" : "Nothing in this window"}
            message={bn ? "ফিল্টার সরান, অথবা ইউনিটে পরবর্তী সার্ভিস তারিখ দিন।" : "Clear the filters, or set a next-service date on a unit."}
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.key} className="sch-day">
            <header>
              <b>{groupTitle(group.key)}</b>
              <span>
                {group.key !== "overdue" && group.key !== "none" ? `${weekday(group.key, locale)} · ` : ""}
                {bn ? `${group.rows.length} ইউনিট` : `${group.rows.length} units`}
              </span>
            </header>
            <div className="fu-list">
              {group.rows.map((row) => {
                const chip = dueChip(row, bn);
                const site = [row.siteName, row.siteLocation || row.customerId?.location || row.customerId?.city].filter(Boolean).join(" · ");
                const last = row.lastService;
                const lastWhen = last?.completedAt || last?.reportedAt;
                return (
                  <article key={row._id} className={`fu-card ${dueTone(row)}`}>
                    <div className="fu-card-top">
                      <span className="fu-avatar">{initials(customerName(row.customerId, bn))}</span>
                      <div className="min-w-0 flex-1">
                        <strong>
                          <Link href={`/services/machines/${row._id}`}>{machineLabel(row)}</Link>
                        </strong>
                        <p>
                          {row.customerId?._id ? (
                            <Link href={`/contacts/${row.customerId._id}/statement`}>{customerName(row.customerId, bn)}</Link>
                          ) : (
                            customerName(row.customerId, bn)
                          )}
                          {site ? ` · ${site}` : ""}
                        </p>
                      </div>
                      <span className={`fu-chip ${chip.tone}`}>{chip.label}</span>
                    </div>
                    <p className="fu-note">
                      {typeLabel(row.machineType, bn)}
                      {row.customerId?.mobile ? ` · ${row.customerId.mobile}` : ""}
                    </p>
                    <div className="fu-card-foot eq-foot">
                      <p className="fu-meta">
                        {bn ? "ডিউ " : "Due "}
                        {safeDate(row.nextServiceDue, locale)}
                        {last
                          ? ` · ${last.jobNo || (bn ? "শেষ" : "last")}${lastWhen ? ` ${safeDate(lastWhen, locale)}` : ""}${last.technician?.name ? ` · ${last.technician.name}` : ""}`
                          : bn ? " · হিস্ট্রি নেই" : " · no history"}
                      </p>
                      <Link className="fld-act" href={`/services/machines/${row._id}`}>{bn ? "খুলুন" : "Open"}</Link>
                      <Link className="fld-act" href={`/services/new${row.customerId?._id ? `?customerId=${row.customerId._id}` : ""}`}>
                        <Plus className="h-3.5 w-3.5" />
                        {bn ? "ভিজিট" : "Visit"}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
