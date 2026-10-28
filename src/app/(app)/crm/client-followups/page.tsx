"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Pencil, Phone } from "lucide-react";
import { AlertBanner, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateTimeDhaka } from "@/lib/utils";

type FollowUp = {
  _id: string;
  leadId?: string;
  leadName?: string;
  clientId?: string | { _id: string; name?: string; mobile?: string; contactId?: string };
  clientName?: string;
  houseId?: string | { _id: string; name?: string; mobile?: string; location?: string };
  kind?: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  conversations?: { at: string; text: string; userName?: string }[];
};

type House = { _id: string; name: string; mobile?: string; location?: string };

const VIEWS = [
  { id: "all", en: "All", bn: "সব" },
  { id: "overdue", en: "Overdue", bn: "ওভারডিউ" },
  { id: "today", en: "Today", bn: "আজ" },
  { id: "upcoming", en: "Upcoming", bn: "আসন্ন" },
  { id: "scheduled", en: "Scheduled", bn: "শিডিউল" },
  { id: "ongoing", en: "Ongoing", bn: "চলমান" },
  { id: "on_hold", en: "On hold", bn: "হোল্ড" },
  { id: "unreachable", en: "Unreachable", bn: "ধরা যায়নি" },
  { id: "completed", en: "Done", bn: "সম্পন্ন" },
  { id: "missed", en: "Missed", bn: "মিস" },
] as const;

const STATUSES = [
  { id: "scheduled", en: "Scheduled", bn: "শিডিউল" },
  { id: "ongoing", en: "Ongoing", bn: "চলমান" },
  { id: "completed", en: "Done", bn: "সম্পন্ন" },
  { id: "missed", en: "Missed", bn: "মিস" },
  { id: "on_hold", en: "On hold", bn: "হোল্ড" },
  { id: "unreachable", en: "Unreachable", bn: "ধরা যায়নি" },
] as const;

function houseName(row: FollowUp) {
  if (row.houseId && typeof row.houseId === "object" && row.houseId.name) return row.houseId.name;
  if (row.clientId && typeof row.clientId === "object" && row.clientId.name) return row.clientId.name;
  return row.clientName || row.leadName || "Follow-up";
}

function houseIdOf(row: FollowUp) {
  if (row.houseId && typeof row.houseId === "object") return row.houseId._id;
  if (typeof row.houseId === "string" && row.houseId) return row.houseId;
  if (row.clientId && typeof row.clientId === "object" && row.clientId.contactId) return row.clientId.contactId;
  return "";
}

function houseMobile(row: FollowUp) {
  if (row.houseId && typeof row.houseId === "object") return row.houseId.mobile || "";
  if (row.clientId && typeof row.clientId === "object") return row.clientId.mobile || "";
  return "";
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "C";
}

function whenLabel(value: string, bn: boolean) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusTone(status?: string) {
  const key = String(status || "").toLowerCase();
  if (key === "overdue" || key === "missed") return "danger";
  if (key === "today" || key === "ongoing") return "info";
  if (key === "on_hold" || key === "unreachable") return "warn";
  if (key === "completed") return "ok";
  return "";
}

function statusLabel(id: string, bn: boolean) {
  const row = [...VIEWS, ...STATUSES].find((v) => v.id === id);
  return row ? (bn ? row.bn : row.en) : id.replace(/_/g, " ");
}

function FollowupsInner() {
  const locale = useLocale();
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const presetHouse = searchParams.get("houseId") || "";
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    houseId: presetHouse,
    scheduledAt: calendarDateTimeDhaka(),
    status: "scheduled",
    notes: "",
  });

  const loadCounts = useCallback(async () => {
    const next: Record<string, number> = {};
    await Promise.all(
      VIEWS.map(async (v) => {
        const params = new URLSearchParams({ view: v.id, limit: "1", party: "client" });
        if (presetHouse) params.set("houseId", presetHouse);
        const res = await fetch(`/api/crm/followups?${params}`);
        const json = await res.json();
        next[v.id] = json.total || 0;
      }),
    );
    setCounts(next);
  }, [presetHouse]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", view, party: "client" });
      if (q) params.set("q", q);
      if (presetHouse) params.set("houseId", presetHouse);
      const [f, h] = await Promise.all([
        fetch(`/api/crm/followups?${params}`).then((r) => r.json()),
        fetch("/api/contacts?type=customer&limit=400").then((r) => r.json()),
      ]);
      setRows(Array.isArray(f.data) ? f.data : []);
      setHouses(Array.isArray(h.data) ? h.data : []);
      setMsg(f.error && f.error !== "unauthorized" ? (bn ? "লোড হয়নি" : "Could not load") : "");
      await loadCounts();
    } catch {
      setMsg(bn ? "লোড হয়নি" : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [view, q, presetHouse, bn, loadCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.houseId) {
      setMsg(bn ? "কাস্টমার বেছে নিন" : "Select a customer");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/crm/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId: form.houseId,
          kind: "client",
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          status: form.status,
          notes: form.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "error");
      setOpen(false);
      await load();
    } catch {
      setMsg(bn ? "সেভ হয়নি" : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(row: FollowUp, status: string) {
    const res = await fetch(`/api/crm/followups/${row._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  const presetName = presetHouse ? houses.find((h) => h._id === presetHouse)?.name : "";

  return (
    <div className="gp-desk fu-desk">
      <PageHeader
        kicker="CRM"
        title={bn ? "ক্লায়েন্ট ফলো-আপ" : "Client follow-ups"}
        subtitle={bn ? "নামে ক্লিক করলে সেই ক্লায়েন্টের সব ফলো-আপ খুলবে।" : "Click a name to open that client's full follow-up history."}
        stats={[
          { value: counts.all ?? rows.length, label: bn ? "সব" : "all" },
          { value: counts.overdue ?? 0, label: bn ? "ওভারডিউ" : "overdue" },
          { value: counts.today ?? 0, label: bn ? "আজ" : "today" },
          { value: counts.upcoming ?? 0, label: bn ? "আসন্ন" : "upcoming" },
        ]}
        actions={
          <>
            <Link href="/crm/followups" className="gp-btn gp-btn-ghost">
              {bn ? "লিড ফলো-আপ" : "Lead follow-ups"}
            </Link>
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen(true)}>
              {bn ? "+ ফলো-আপ" : "+ Follow-up"}
            </button>
          </>
        }
      />

      {msg ? <AlertBanner tone="error" message={msg} onClose={() => setMsg("")} /> : null}
      {presetName ? (
        <p className="fu-filter-note">
          {bn ? "ফিল্টার:" : "Showing:"} <b>{presetName}</b>
          <Link href="/crm/client-followups">{bn ? "মুছুন" : "Clear"}</Link>
        </p>
      ) : null}

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={view === v.id ? "on" : ""} onClick={() => setView(v.id)}>
              {bn ? v.bn : v.en} <em>({counts[v.id] ?? 0})</em>
            </button>
          ))}
        </div>
        <input
          className="gp-input fu-search"
          placeholder={bn ? "কাস্টমার / নোট খুঁজুন" : "Search customer or notes"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="fu-board">
      {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState message={bn ? "ফলো-আপ নেই" : "No follow-ups"} /> : null}

      <div className="fu-list">
        {rows.map((row) => {
          const house = typeof row.houseId === "object" ? row.houseId : null;
          const name = houseName(row);
          const hid = houseIdOf(row);
          const mobile = house?.mobile || houseMobile(row);
          const tone = statusTone(row.status);
          const lastTalk = (row.conversations || []).slice(-1)[0];
          return (
            <article key={row._id} className={`fu-card ${tone ? `is-${tone}` : ""}`}>
              <div className="fu-card-top">
                <span className="fu-avatar">{initials(name)}</span>
                <div className="min-w-0 flex-1">
                  <strong>
                    {hid ? <Link href={`/crm/client-followups/${hid}`}>{name}</Link> : name}
                  </strong>
                  <p>{whenLabel(row.scheduledAt, bn)}</p>
                </div>
                <span className={`fu-chip ${tone ? `is-${tone}` : ""}`}>{statusLabel(row.status, bn)}</span>
              </div>
              {house?.location ? <p className="fu-meta">{house.location}</p> : null}
              {row.notes ? <p className="fu-note">{row.notes}</p> : null}
              {lastTalk ? (
                <p className="fu-talk">
                  {lastTalk.userName ? `${lastTalk.userName}: ` : ""}
                  {lastTalk.text}
                </p>
              ) : null}
              <div className="fu-card-foot">
                <select
                  className="gp-input"
                  value={STATUSES.some((s) => s.id === row.status) ? row.status : "scheduled"}
                  onChange={(e) => void setStatus(row, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {bn ? s.bn : s.en}
                    </option>
                  ))}
                </select>
                {mobile ? (
                  <a className="fld-act" href={`tel:${mobile}`}>
                    <Phone className="h-3.5 w-3.5" />
                    {bn ? "কল" : "Call"}
                  </a>
                ) : (
                  <span />
                )}
                {hid ? (
                  <Link className="fld-act" href={`/crm/client-followups/${hid}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    {bn ? "হিস্ট্রি" : "History"}
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            </article>
          );
        })}
      </div>
      </div>

      <Modal open={open} title={bn ? "কাস্টমার ফলো-আপ" : "Customer follow-up"} onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Field label={bn ? "কাস্টমার / ক্লায়েন্ট" : "Customer / client"}>
            <select
              className="gp-input"
              required
              value={form.houseId}
              onChange={(e) => setForm({ ...form, houseId: e.target.value })}
            >
              <option value="">{bn ? "বেছে নিন" : "Select"}</option>
              {houses.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                  {h.mobile ? ` · ${h.mobile}` : ""}
                  {h.location ? ` · ${h.location}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={bn ? "তারিখ ও সময়" : "Date & time"}>
            <input
              type="datetime-local"
              required
              className="gp-input"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </Field>
          <Field label={bn ? "স্ট্যাটাস" : "Status"}>
            <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {bn ? s.bn : s.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={bn ? "নোট" : "Notes"}>
            <textarea className="gp-input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              {bn ? "বাতিল" : "Cancel"}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {bn ? "সেভ" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function ClientFollowupsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">Loading...</p>}>
      <FollowupsInner />
    </Suspense>
  );
}
