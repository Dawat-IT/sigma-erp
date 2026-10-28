"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  status?: string;
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

type Scope = "all" | "due" | "upcoming" | "warranty";

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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "EQ";
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
  const warrantyDays = daysFromToday(row.warrantyExpiryDate);
  if (days != null && days < 0) return "is-danger";
  if (days != null && days <= 7) return "is-warn";
  if (warrantyDays != null && warrantyDays < 0) return "is-warn";
  if (days != null && days <= 30) return "is-info";
  return "is-ok";
}

function dueChip(row: Row, bn: boolean) {
  const days = daysFromToday(row.nextServiceDue);
  if (days == null) return { label: bn ? "ডিউ নেই" : "No due", tone: "is-info" };
  if (days < 0) return { label: bn ? `${Math.abs(days)} দিন বকেয়া` : `${Math.abs(days)}d overdue`, tone: "is-danger" };
  if (days === 0) return { label: bn ? "আজ" : "Due today", tone: "is-warn" };
  if (days <= 7) return { label: bn ? `${days} দিন` : `${days}d`, tone: "is-warn" };
  if (days <= 30) return { label: bn ? `${days} দিন` : `${days}d`, tone: "is-info" };
  return { label: safeDate(row.nextServiceDue, bn ? "bn" : "en"), tone: "is-ok" };
}

function typeLabel(value?: string, bn?: boolean) {
  if (!value) return "—";
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

export default function EquipmentListPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, due: 0, upcoming: 0, warrantyExpired: 0, byType: {} as Record<string, number> });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q, nextScope = scope, nextType = type, range = { from, to }) => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    if (nextType) qs.set("type", nextType);
    if (nextScope === "due") qs.set("due", "1");
    if (nextScope === "upcoming") qs.set("upcoming", "1");
    if (nextScope === "warranty") qs.set("warranty", "1");
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    try {
      const res = await fetch(`/api/machines?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setRows(Array.isArray(json.data) ? json.data : json.items || []);
      setTotal(Number(json.total) || 0);
      setSummary(json.summary || { total: 0, due: 0, upcoming: 0, warrantyExpired: 0, byType: {} });
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "ইকুইপমেন্ট লোড হয়নি।" : "Could not load equipment.");
    } finally {
      setLoading(false);
    }
  }, [bn, from, q, scope, to, type]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scopes: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All units", bn: "সব ইউনিট", n: summary.total },
    { id: "due", en: "Overdue", bn: "ডিউ", n: summary.due },
    { id: "upcoming", en: "Next 30 days", bn: "আগামী ৩০ দিন", n: summary.upcoming },
    { id: "warranty", en: "Warranty out", bn: "ওয়ারেন্টি শেষ", n: summary.warrantyExpired },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "ইকুইপমেন্ট তালিকা" : "Equipment list"}
        subtitle={bn
          ? "ইউনিটে ক্লিক করলে ডিটেইলস, ইনস্টল ও সার্ভিস হিস্ট্রি।"
          : "Open a unit for details, installation and service history."}
        stats={[
          { value: summary.total || total, label: bn ? "ইউনিট" : "units" },
          { value: summary.due, label: bn ? "ডিউ" : "overdue" },
          { value: summary.upcoming, label: bn ? "আপকামিং" : "upcoming" },
          { value: summary.warrantyExpired, label: bn ? "ওয়ারেন্টি" : "warranty" },
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
            <Link href="/services/machines/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "যোগ" : "Add"}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {scopes.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={scope === pill.id ? "on" : ""}
              onClick={() => {
                setScope(pill.id);
                void load(q, pill.id, type, { from, to });
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
            void load(q, scope, type, { from: value, to });
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
            void load(q, scope, type, { from, to: value });
          }}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={type === "" ? "on" : ""} onClick={() => { setType(""); void load(q, scope, "", { from, to }); }}>
          {bn ? "সব ধরন" : "All types"}
        </button>
        {EQUIPMENT_LINES.map((line) => (
          <button
            key={line.value}
            type="button"
            className={type === line.value ? "on" : ""}
            onClick={() => {
              setType(line.value);
              void load(q, scope, line.value, { from, to });
            }}
          >
            {typeLabel(line.value, bn)}
            {summary.byType[line.value] ? <em>{summary.byType[line.value]}</em> : null}
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState
            title={bn ? "ইকুইপমেন্ট নেই" : "No equipment"}
            message={bn ? "নতুন ইউনিট যোগ করুন, অথবা ফিল্টার সরান।" : "Add a unit, or clear the filters."}
          />
        ) : null}

        <div className="fu-list">
          {rows.map((row) => {
            const chip = dueChip(row, bn);
            const site = [row.siteName, row.siteLocation || row.customerId?.location || row.customerId?.city].filter(Boolean).join(" · ");
            const last = row.lastService;
            const lastWhen = last?.completedAt || last?.reportedAt;
            const warrantyDays = daysFromToday(row.warrantyExpiryDate);
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
                  {warrantyDays != null && warrantyDays < 0
                    ? bn ? " · ওয়ারেন্টি শেষ" : " · warranty expired"
                    : row.warrantyExpiryDate
                      ? ` · ${bn ? "ওয়ারেন্টি" : "warranty"} ${safeDate(row.warrantyExpiryDate, locale)}`
                      : ""}
                </p>
                <div className="fu-card-foot eq-foot">
                  <p className="fu-meta">
                    {bn ? "ডিউ " : "Due "}
                    {safeDate(row.nextServiceDue, locale)}
                    {last
                      ? ` · ${last.jobNo || (bn ? "শেষ সার্ভিস" : "last")}${lastWhen ? ` ${safeDate(lastWhen, locale)}` : ""}${last.technician?.name ? ` · ${last.technician.name}` : ""}`
                      : bn ? " · সার্ভিস হিস্ট্রি নেই" : " · no service yet"}
                  </p>
                  <Link className="fld-act" href={`/services/machines/${row._id}`}>
                    {bn ? "খুলুন" : "Open"}
                  </Link>
                  <Link className="fld-act" href={`/services/new${row.customerId?._id ? `?customerId=${row.customerId._id}` : ""}`}>
                    {bn ? "ভিজিট" : "Visit"}
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
