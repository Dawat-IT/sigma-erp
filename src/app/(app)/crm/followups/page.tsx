"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { AlertBanner, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateTimeDhaka } from "@/lib/utils";

type FollowUp = {
  _id: string;
  leadId?: string | { _id: string; name?: string };
  leadName?: string;
  clientId?: string | { _id: string; name?: string };
  clientName?: string;
  houseId?: string | { _id: string; name?: string };
  kind?: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  conversations?: { at: string; text: string; userName?: string }[];
};

function refId(value?: string | { _id: string } | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || "";
}

type Opt = { _id: string; name: string; mobile?: string };

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

const ACTIONS = [
  { id: "completed", en: "Done", bn: "সম্পন্ন" },
  { id: "ongoing", en: "Ongoing", bn: "চলমান" },
  { id: "on_hold", en: "Hold", bn: "হোল্ড" },
  { id: "unreachable", en: "Unreachable", bn: "ধরা যায়নি" },
  { id: "missed", en: "Missed", bn: "মিস" },
  { id: "scheduled", en: "Scheduled", bn: "শিডিউল" },
] as const;

function viewLabel(id: string, bn: boolean) {
  const row = VIEWS.find((v) => v.id === id);
  return row ? (bn ? row.bn : row.en) : id.replace(/_/g, " ");
}

function partyName(row: FollowUp) {
  return row.clientName || row.leadName || "Follow-up";
}

function partyKind(row: FollowUp, bn: boolean) {
  const client = Boolean(row.kind === "client" || row.clientId || row.houseId);
  return client ? (bn ? "ক্লায়েন্ট" : "Client") : bn ? "লিড" : "Lead";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "F";
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

function localDateTime(value?: string) {
  if (!value) return calendarDateTimeDhaka();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return calendarDateTimeDhaka();
  return calendarDateTimeDhaka(d);
}

function FollowupsInner() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const presetLeadId = searchParams.get("leadId") || "";
  const presetClientId = searchParams.get("clientId") || "";
  const wantAdd = searchParams.get("add") === "1";
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState<Opt[]>([]);
  const [clients, setClients] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [party, setParty] = useState(presetClientId ? "client" : presetLeadId ? "lead" : "all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [talk, setTalk] = useState<FollowUp | null>(null);
  const [talkText, setTalkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKind, setFormKind] = useState<"lead" | "client">(presetClientId ? "client" : "lead");
  const [form, setForm] = useState({
    leadId: presetLeadId,
    clientId: presetClientId,
    scheduledAt: localDateTime(),
    status: "scheduled",
    notes: "",
  });

  const loadCounts = useCallback(async () => {
    const next: Record<string, number> = {};
    await Promise.all(
      VIEWS.map(async (v) => {
        const params = new URLSearchParams({ view: v.id, limit: "1" });
        if (presetLeadId) params.set("leadId", presetLeadId);
        if (presetClientId) params.set("clientId", presetClientId);
        if (party === "lead" || party === "client") params.set("party", party);
        const res = await fetch(`/api/crm/followups?${params}`);
        const json = await res.json();
        next[v.id] = json.total || 0;
      }),
    );
    setCounts(next);
  }, [presetLeadId, presetClientId, party]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ limit: "300", view });
      if (q) params.set("q", q);
      if (presetLeadId) params.set("leadId", presetLeadId);
      if (presetClientId) params.set("clientId", presetClientId);
      if (party === "lead" || party === "client") params.set("party", party);
      const [f, l, c] = await Promise.all([
        fetch(`/api/crm/followups?${params}`).then((r) => r.json()),
        fetch("/api/crm/leads?limit=300").then((r) => r.json()),
        fetch("/api/crm/clients?limit=300").then((r) => r.json()),
      ]);
      setRows(f.data || []);
      setLeads(l.data || []);
      setClients(c.data || []);
      await loadCounts();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [view, q, t, loadCounts, presetLeadId, presetClientId, party]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd(kind: "lead" | "client" = formKind) {
    setEditing(null);
    setFormKind(kind);
    setForm({
      leadId: presetLeadId,
      clientId: presetClientId,
      scheduledAt: localDateTime(),
      status: "scheduled",
      notes: "",
    });
    setOpen(true);
  }

  useEffect(() => {
    if (wantAdd) openAdd(presetClientId ? "client" : "lead");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAdd, presetLeadId, presetClientId]);

  function openEdit(row: FollowUp) {
    setEditing(row);
    setFormKind(row.clientId || row.houseId || row.kind === "client" ? "client" : "lead");
    setForm({
      leadId: refId(row.leadId),
      clientId: refId(row.clientId),
      scheduledAt: localDateTime(row.scheduledAt),
      status: row.status || "scheduled",
      notes: row.notes || "",
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.scheduledAt) {
      setMsg("Date and time are required.");
      return;
    }
    if (formKind === "lead" && !form.leadId) {
      setMsg("Select a lead.");
      return;
    }
    if (formKind === "client" && !form.clientId) {
      setMsg("Select a client.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        leadId: formKind === "lead" ? form.leadId : form.leadId || undefined,
        clientId: formKind === "client" ? form.clientId : form.clientId || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        status: form.status,
        notes: form.notes,
      };
      const res = await fetch(editing ? `/api/crm/followups/${editing._id}` : "/api/crm/followups", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "error");
      setOpen(false);
      await load();
    } catch {
      setMsg(t("common.error"));
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
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  async function addConversation(e: FormEvent) {
    e.preventDefault();
    if (!talk || !talkText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/followups/${talk._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: talkText.trim() }),
      });
      if (!res.ok) throw new Error("error");
      setTalkText("");
      setTalk(null);
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this follow-up?")) return;
    const res = await fetch(`/api/crm/followups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  const filteredTitle = presetClientId
    ? clients.find((c) => c._id === presetClientId)?.name
    : presetLeadId
      ? leads.find((l) => l._id === presetLeadId)?.name
      : "";

  return (
    <div className="gp-desk fu-desk">
      <PageHeader
        kicker="CRM"
        title={t("crm.followups")}
        subtitle={
          bn
            ? "লিড ও ক্লায়েন্ট কলব্যাক, সাইট ভিজিট ও কথোপকথন।"
            : "Lead and client call-backs, site visits and conversation notes."
        }
        stats={[
          { value: counts.all ?? rows.length, label: bn ? "সব" : "all" },
          { value: counts.overdue ?? 0, label: bn ? "ওভারডিউ" : "overdue" },
          { value: counts.today ?? 0, label: bn ? "আজ" : "today" },
          { value: counts.upcoming ?? 0, label: bn ? "আসন্ন" : "upcoming" },
        ]}
        actions={
          <>
            <Link href="/crm/client-followups" className="gp-btn gp-btn-ghost">
              {t("nav.clientFollowups")}
            </Link>
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => openAdd("lead")}>
              {bn ? "+ লিড" : "+ Lead"}
            </button>
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => openAdd("client")}>
              {bn ? "+ ক্লায়েন্ট" : "+ Client"}
            </button>
          </>
        }
      />

      {msg ? <AlertBanner tone="error" message={msg} onClose={() => setMsg("")} /> : null}
      {filteredTitle ? (
        <p className="fu-filter-note">
          {bn ? "ফিল্টার:" : "Showing:"} <b>{filteredTitle}</b>
          <Link href="/crm/followups">{bn ? "মুছুন" : "Clear"}</Link>
        </p>
      ) : null}

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {[
            { id: "all", en: "All", bn: "সব" },
            { id: "lead", en: "Leads", bn: "লিড" },
            { id: "client", en: "Clients", bn: "ক্লায়েন্ট" },
          ].map((p) => (
            <button key={p.id} type="button" className={party === p.id ? "on" : ""} onClick={() => setParty(p.id)}>
              {bn ? p.bn : p.en}
            </button>
          ))}
        </div>
        <input
          className="gp-input fu-search"
          placeholder={bn ? "নাম বা ফোন খুঁজুন" : "Search name or phone"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="fu-views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={view === v.id ? "on" : ""} onClick={() => setView(v.id)}>
            {bn ? v.bn : v.en} <em>({counts[v.id] ?? 0})</em>
          </button>
        ))}
      </div>

      <div className="fu-board">
        {loading ? <p className="text-muted">{t("common.loading")}</p> : null}
        {!loading && rows.length === 0 ? <EmptyState message={t("common.noData")} /> : null}

        <div className="fu-list">
        {rows.map((row) => {
          const name = partyName(row);
          const tone = statusTone(row.status);
          const lastTalk = (row.conversations || []).slice(-1)[0];
          return (
            <article key={row._id} className={`fu-card ${tone ? `is-${tone}` : ""}`}>
              <div className="fu-card-top">
                <span className="fu-avatar">{initials(name)}</span>
                <div className="min-w-0 flex-1">
                  <strong>{name}</strong>
                  <p>
                    {partyKind(row, bn)} · {whenLabel(row.scheduledAt, bn)}
                  </p>
                </div>
                <span className={`fu-chip ${tone ? `is-${tone}` : ""}`}>{viewLabel(row.status, bn)}</span>
              </div>
              {row.clientId && row.leadName && row.leadName !== row.clientName ? (
                <p className="fu-meta">{bn ? "লিড:" : "From lead:"} {row.leadName}</p>
              ) : null}
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
                  value={row.status}
                  onChange={(e) => void setStatus(row, e.target.value)}
                  aria-label={bn ? "স্ট্যাটাস" : "Status"}
                >
                  {ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {bn ? a.bn : a.en}
                    </option>
                  ))}
                </select>
                <button type="button" className="fld-act" onClick={() => setTalk(row)}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  {bn ? "নোট" : "Note"}
                </button>
                <button type="button" className="fld-act" onClick={() => openEdit(row)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {bn ? "এডিট" : "Edit"}
                </button>
                <button type="button" className="fld-act fu-del" onClick={() => void onDelete(row._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      </div>

      <Modal open={open} title={editing ? (bn ? "ফলো-আপ সম্পাদনা" : "Edit follow-up") : formKind === "client" ? (bn ? "ক্লায়েন্ট ফলো-আপ" : "Client follow-up") : bn ? "লিড ফলো-আপ" : "Lead follow-up"} onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Field label={bn ? "কার সাথে" : "Follow up with"}>
            <select
              className="gp-input"
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as "lead" | "client")}
            >
              <option value="lead">{bn ? "লিড" : "Lead"}</option>
              <option value="client">{bn ? "ক্লায়েন্ট" : "Client"}</option>
            </select>
          </Field>
          {formKind === "lead" ? (
            <Field label={bn ? "লিড" : "Lead"}>
              <select
                className="gp-input"
                value={form.leadId}
                onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                required
              >
                <option value="">{bn ? "লিড বাছুন" : "Select lead"}</option>
                {leads.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                    {l.mobile ? ` · ${l.mobile}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={bn ? "ক্লায়েন্ট" : "Client"}>
              <select
                className="gp-input"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                required
              >
                <option value="">{bn ? "ক্লায়েন্ট বাছুন" : "Select client"}</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.mobile ? ` · ${c.mobile}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={bn ? "তারিখ ও সময়" : "Date & time"}>
            <input
              className="gp-input"
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </Field>
          <Field label={bn ? "স্ট্যাটাস" : "Status"}>
            <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {VIEWS.filter((v) => !["all", "overdue", "today", "upcoming"].includes(v.id)).map((v) => (
                <option key={v.id} value={v.id}>
                  {bn ? v.bn : v.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={bn ? "নোট" : "Notes"}>
            <textarea className="gp-input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!talk} title={bn ? "কথোপকথন যোগ" : "Add conversation"} onClose={() => setTalk(null)}>
        <form className="grid gap-3" onSubmit={addConversation}>
          <textarea className="gp-input min-h-24" value={talkText} onChange={(e) => setTalkText(e.target.value)} placeholder={bn ? "কী বললেন? পরবর্তী ধাপ?" : "What did they say? Next step?"} />
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setTalk(null)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function CrmFollowupsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">Loading...</p>}>
      <FollowupsInner />
    </Suspense>
  );
}
