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
  phone?: string;
  whatsapp?: string;
  location?: string;
  city?: string;
};

type LastService = {
  jobNo?: string;
  completedAt?: string;
  reportedAt?: string;
  technician?: { name?: string; mobile?: string } | null;
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
  siteAddress?: string;
  customerId?: Customer;
  lastService?: LastService | null;
};

type Band = "all" | "week" | "urgent" | "critical";

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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "DU";
}

function machineLabel(row: Row) {
  return [row.brand, row.model, row.serialNo].filter(Boolean).join(" · ") || "—";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
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

function overdueDays(iso?: string) {
  const d = daysFromToday(iso);
  if (d == null || d > 0) return 0;
  return Math.abs(d);
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "—";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function bandTone(days: number) {
  if (days >= 14) return "is-danger";
  if (days >= 7) return "is-warn";
  return "is-warn";
}

function groupKey(days: number) {
  if (days >= 30) return "30";
  if (days >= 14) return "14";
  if (days >= 7) return "7";
  return "now";
}

export default function DueServicePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ due: 0, upcoming: 0, byType: {} as Record<string, number> });
  const [q, setQ] = useState("");
  const [band, setBand] = useState<Band>("all");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q) => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "200", due: "1" });
    if (search.trim()) qs.set("q", search.trim());
    try {
      const res = await fetch(`/api/machines?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      const data = (Array.isArray(json.data) ? json.data : json.items || []) as Row[];
      data.sort((a, b) => overdueDays(b.nextServiceDue) - overdueDays(a.nextServiceDue));
      setRows(data);
      setSummary({
        due: Number(json.summary?.due) || data.length,
        upcoming: Number(json.summary?.upcoming) || 0,
        byType: json.summary?.byType || {},
      });
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "ডিউ লোড হয়নি।" : "Could not load due units.");
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

  const overdueList = rows.map((row) => overdueDays(row.nextServiceDue));
  const avg = overdueList.length ? Math.round(overdueList.reduce((a, b) => a + b, 0) / overdueList.length) : 0;
  const weekN = rows.filter((r) => overdueDays(r.nextServiceDue) >= 7).length;
  const urgentN = rows.filter((r) => overdueDays(r.nextServiceDue) >= 14).length;
  const criticalN = rows.filter((r) => overdueDays(r.nextServiceDue) >= 30).length;

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (type && row.machineType !== type) return false;
      const days = overdueDays(row.nextServiceDue);
      if (band === "week") return days >= 7;
      if (band === "urgent") return days >= 14;
      if (band === "critical") return days >= 30;
      return true;
    });
  }, [band, rows, type]);

  const groups = useMemo(() => {
    const order = ["30", "14", "7", "now"] as const;
    const titles: Record<string, [string, string]> = {
      "30": ["30+ days overdue", "৩০+ দিন বকেয়া"],
      "14": ["14–29 days", "১৪–২৯ দিন"],
      "7": ["7–13 days", "৭–১৩ দিন"],
      now: ["Due today / this week", "আজ / এই সপ্তাহ"],
    };
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      const key = groupKey(overdueDays(row.nextServiceDue));
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return order.filter((key) => map.has(key)).map((key) => ({
      key,
      title: bn ? titles[key][1] : titles[key][0],
      rows: map.get(key) || [],
    }));
  }, [bn, filtered]);

  const pills: { id: Band; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All due", bn: "সব ডিউ", n: rows.length },
    { id: "week", en: "7+ days", bn: "৭+ দিন", n: weekN },
    { id: "urgent", en: "14+ days", bn: "১৪+ দিন", n: urgentN },
    { id: "critical", en: "30+ days", bn: "৩০+ দিন", n: criticalN },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "ডিউ সার্ভিস" : "Due service"}
        subtitle={bn
          ? "এএমসি তারিখ পেরোনো ইউনিট — কত দিন বকেয়া, কোথায়, কার মোবাইল।"
          : "Units past their next service date — how overdue, where, and who to call."}
        stats={[
          { value: summary.due || rows.length, label: bn ? "ডিউ" : "overdue" },
          { value: avg, label: bn ? "গড় দিন" : "avg days" },
          { value: urgentN, label: bn ? "১৪+ দিন" : "14+ days" },
          { value: summary.upcoming, label: bn ? "আপকামিং" : "upcoming" },
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
              placeholder={bn ? "কাস্টমার / সিরিয়াল" : "Customer / serial"}
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
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={band === pill.id ? "on" : ""}
              onClick={() => setBand(pill.id)}
            >
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/services/schedule" className="gp-btn gp-btn-ghost">{bn ? "শিডিউল" : "Schedule"}</Link>
        <Link href="/services/upcoming" className="gp-btn gp-btn-ghost">{bn ? "আপকামিং" : "Upcoming"}</Link>
        <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
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
            title={bn ? "ডিউ মেইনটেনেন্স নেই" : "No units currently due"}
            message={bn ? "এএমসি তারিখ পেরোলে ইউনিট এখানে জমবে।" : "When an AMC date passes, the unit lands here."}
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.key} className="sch-day">
            <header>
              <b>{group.title}</b>
              <span>{bn ? `${group.rows.length} ইউনিট` : `${group.rows.length} units`}</span>
            </header>
            <div className="fu-list">
              {group.rows.map((row) => {
                const days = overdueDays(row.nextServiceDue);
                const cust = row.customerId;
                const tel = telOf(cust);
                const wa = waLink(cust?.whatsapp || tel);
                const site = [row.siteName, row.siteLocation || cust?.location || cust?.city].filter(Boolean).join(" · ");
                const last = row.lastService;
                const lastWhen = last?.completedAt || last?.reportedAt;
                return (
                  <article key={row._id} className={`fu-card ${bandTone(days)}`}>
                    <div className="fu-card-top">
                      <span className="fu-avatar">{initials(customerName(cust, bn))}</span>
                      <div className="min-w-0 flex-1">
                        <strong>
                          <Link href={`/services/machines/${row._id}`}>{machineLabel(row)}</Link>
                        </strong>
                        <p>
                          {cust?._id ? (
                            <Link href={`/contacts/${cust._id}/statement`}>{customerName(cust, bn)}</Link>
                          ) : (
                            customerName(cust, bn)
                          )}
                          {site ? ` · ${site}` : ""}
                        </p>
                      </div>
                      <span className={`fu-chip ${days >= 14 ? "is-danger" : "is-warn"}`}>
                        {days === 0 ? (bn ? "আজ" : "Today") : bn ? `${days} দিন বকেয়া` : `${days}d overdue`}
                      </span>
                    </div>
                    <p className="fu-note">
                      {typeLabel(row.machineType, bn)}
                      {tel ? ` · ${tel}` : ""}
                      {last ? ` · ${last.jobNo || (bn ? "শেষ" : "last")}${lastWhen ? ` ${safeDate(lastWhen, locale)}` : ""}` : bn ? " · হিস্ট্রি নেই" : " · no history"}
                    </p>
                    <div className="fu-card-foot">
                      <p className="fu-meta">
                        {bn ? "ডিউ " : "Due "}
                        {safeDate(row.nextServiceDue, locale)}
                        {last?.technician?.name ? ` · ${last.technician.name}` : ""}
                      </p>
                      {tel ? <a className="fld-act" href={`tel:${tel}`}>{bn ? "কল" : "Call"}</a> : null}
                      {wa ? <a className="fld-act" href={wa} target="_blank" rel="noreferrer">WA</a> : null}
                      <Link className="fld-act" href={`/services/new${cust?._id ? `?customerId=${cust._id}` : ""}`}>
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
