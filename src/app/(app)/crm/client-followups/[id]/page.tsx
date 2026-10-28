"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { MapPin, MessageSquare, Phone } from "lucide-react";
import { AlertBanner, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { followUpStatusLabel } from "@/lib/crm-follow-status";
import { mapsSearchUrl } from "@/lib/service-visit";
import { calendarDateTimeDhaka, formatDateBD, formatDateTimeBD } from "@/lib/utils";

type House = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  email?: string;
  location?: string;
  address?: string;
};

type FollowUp = {
  _id: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  createdAt?: string;
  conversations?: { at: string; text: string; userName?: string }[];
};

const STATUSES = [
  { id: "scheduled", en: "Scheduled", bn: "শিডিউল" },
  { id: "ongoing", en: "Ongoing", bn: "চলমান" },
  { id: "completed", en: "Done", bn: "সম্পন্ন" },
  { id: "missed", en: "Missed", bn: "মিস" },
  { id: "on_hold", en: "On hold", bn: "হোল্ড" },
  { id: "unreachable", en: "Unreachable", bn: "ধরা যায়নি" },
];

function statusTone(status?: string) {
  const key = String(status || "").toLowerCase();
  if (key === "overdue" || key === "missed") return "danger";
  if (key === "today" || key === "ongoing") return "info";
  if (key === "on_hold" || key === "unreachable") return "warn";
  if (key === "completed") return "ok";
  return "";
}

export default function ClientFollowUpHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const bn = locale === "bn";
  const [house, setHouse] = useState<House | null>(null);
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [talkId, setTalkId] = useState("");
  const [talkText, setTalkText] = useState("");
  const [form, setForm] = useState({
    scheduledAt: calendarDateTimeDhaka(),
    status: "scheduled",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, f] = await Promise.all([
        fetch(`/api/contacts/${id}`).then((r) => r.json()),
        fetch(`/api/crm/followups?houseId=${id}&limit=500&sort=desc`).then((r) => r.json()),
      ]);
      if (!h.data) throw new Error("missing");
      setHouse(h.data as House);
      setRows((f.data || []) as FollowUp[]);
    } catch {
      setError(bn ? "ক্লায়েন্ট লোড হয়নি" : "Could not load this client");
    } finally {
      setLoading(false);
    }
  }, [id, bn]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let completed = 0;
    let missed = 0;
    let overdue = 0;
    let next: string | null = null;
    let last: string | null = null;
    for (const row of rows) {
      const at = new Date(row.scheduledAt).getTime();
      if (row.status === "completed") completed += 1;
      if (row.status === "missed") missed += 1;
      if (row.status !== "completed" && at < start.getTime()) overdue += 1;
      if (row.status !== "completed" && at >= now && (!next || at < new Date(next).getTime())) next = row.scheduledAt;
      if (at <= now && (!last || at > new Date(last).getTime())) last = row.scheduledAt;
    }
    return { total: rows.length, completed, missed, overdue, next, last };
  }, [rows]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/crm/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId: id,
          kind: "client",
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          status: form.status,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error("save");
      setOpen(false);
      setForm({ scheduledAt: calendarDateTimeDhaka(), status: "scheduled", notes: "" });
      await load();
    } catch {
      setError(bn ? "সেভ হয়নি" : "Could not save");
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

  async function addTalk(e: FormEvent) {
    e.preventDefault();
    if (!talkId || !talkText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/followups/${talkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: talkText.trim() }),
      });
      if (!res.ok) throw new Error("talk");
      setTalkId("");
      setTalkText("");
      await load();
    } catch {
      setError(bn ? "নোট সেভ হয়নি" : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p>;
  if (error && !house) return <AlertBanner tone="error" message={error} />;
  if (!house) return <EmptyState message={bn ? "ক্লায়েন্ট পাওয়া যায়নি" : "Client not found"} />;

  const name = bn && house.nameBn ? house.nameBn : house.name;
  const maps = mapsSearchUrl(house.address, house.location);

  return (
    <div className="gp-desk fu-desk">
      <PageHeader
        kicker="CRM"
        title={name}
        subtitle={bn ? "এই ক্লায়েন্টের সব ফলো-আপ — কতবার, কবে, কী কথা হয়েছে।" : "Every follow-up for this client — how many, when, and what was said."}
        stats={[
          { value: stats.total, label: bn ? "সব" : "all" },
          { value: stats.overdue, label: bn ? "ওভারডিউ" : "overdue" },
          { value: stats.completed, label: bn ? "সম্পন্ন" : "done" },
          { value: stats.next ? formatDateBD(stats.next, locale) : "—", label: bn ? "পরবর্তী" : "next" },
        ]}
        actions={
          <>
            <Link href="/crm/client-followups" className="gp-btn gp-btn-ghost">
              {bn ? "সব ফলো-আপ" : "All follow-ups"}
            </Link>
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen(true)}>
              {bn ? "+ ফলো-আপ" : "+ Follow-up"}
            </button>
          </>
        }
      />

      {error ? <AlertBanner tone="error" message={error} onClose={() => setError("")} /> : null}

      <div className="dash-panel fu-toolbar">
        <div className="min-w-0 flex-1">
          {house.location ? <p className="fu-meta">{house.location}</p> : null}
          {house.address ? <p className="fu-note">{house.address}</p> : null}
          {house.email ? <p className="fu-meta">{house.email}</p> : null}
          {stats.last ? (
            <p className="fu-meta">
              {bn ? "শেষ" : "Last"}: {formatDateBD(stats.last, locale)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {house.mobile ? (
            <a className="fld-act" href={`tel:${house.mobile}`}>
              <Phone className="h-3.5 w-3.5" />
              {house.mobile}
            </a>
          ) : null}
          {maps ? (
            <a className="fld-act" href={maps} target="_blank" rel="noreferrer">
              <MapPin className="h-3.5 w-3.5" />
              {bn ? "ম্যাপ" : "Map"}
            </a>
          ) : null}
        </div>
      </div>

      <div className="fu-board">
      {!rows.length ? (
        <EmptyState
          title={bn ? "এখনও ফলো-আপ নেই" : "No follow-ups yet"}
          message={bn ? "এই ক্লায়েন্টের জন্য প্রথম ফলো-আপ যোগ করুন।" : "Add the first follow-up for this client."}
        />
      ) : (
        <div className="fu-list fu-history">
          {rows.map((row, index) => {
            const tone = statusTone(row.status);
            return (
              <article key={row._id} className={`fu-card ${tone ? `is-${tone}` : ""}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{stats.total - index}</span>
                  <div className="min-w-0 flex-1">
                    <strong>{formatDateTimeBD(row.scheduledAt, locale)}</strong>
                    <p>{bn ? `${stats.total - index} নং ফলো-আপ` : `Follow-up ${stats.total - index} of ${stats.total}`}</p>
                  </div>
                  <span className={`fu-chip ${tone ? `is-${tone}` : ""}`}>{followUpStatusLabel(row.status, bn)}</span>
                </div>
                {row.notes ? <p className="fu-note">{row.notes}</p> : null}
                {(row.conversations || []).map((c, i) => (
                  <p key={`${row._id}-c-${i}`} className="fu-talk">
                    {c.userName ? `${c.userName}: ` : ""}
                    {c.text}
                    <span> · {formatDateTimeBD(c.at, locale)}</span>
                  </p>
                ))}
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
                  <button type="button" className="fld-act" onClick={() => { setTalkId(row._id); setTalkText(""); }}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    {bn ? "নোট" : "Note"}
                  </button>
                </div>
                {talkId === row._id ? (
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => void addTalk(e)}>
                    <input
                      className="gp-input flex-1"
                      autoFocus
                      placeholder={bn ? "কী কথা হলো..." : "What was discussed..."}
                      value={talkText}
                      onChange={(e) => setTalkText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="gp-btn gp-btn-primary min-h-9 px-3 text-xs" disabled={busy}>
                        {bn ? "সেভ" : "Save"}
                      </button>
                      <button type="button" className="gp-btn gp-btn-ghost min-h-9 px-3 text-xs" onClick={() => setTalkId("")}>
                        {bn ? "বাতিল" : "Cancel"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      </div>

      <Modal open={open} title={bn ? "নতুন ফলো-আপ" : "New follow-up"} onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(e) => void onSubmit(e)}>
          <p className="text-sm text-muted">{name}</p>
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
