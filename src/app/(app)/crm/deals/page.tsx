"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

type Deal = {
  _id: string;
  title: string;
  value?: number;
  stage: string;
  clientId?: string;
  clientName?: string;
  leadId?: string;
  leadName?: string;
  notes?: string;
};

type Opt = { _id: string; name: string };

const STAGES = [
  { id: "prospect", label: "Prospect" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export default function CrmDealsPage() {
  const t = useTranslations();
  const [rows, setRows] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Opt[]>([]);
  const [leads, setLeads] = useState<Opt[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [view, setView] = useState<Deal | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    value: "",
    stage: "prospect",
    clientId: "",
    leadId: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ limit: "400" });
      if (q) params.set("q", q);
      const [d, c, l] = await Promise.all([
        fetch(`/api/crm/deals?${params}`).then((r) => r.json()),
        fetch("/api/crm/clients?limit=300").then((r) => r.json()),
        fetch("/api/crm/leads?limit=300").then((r) => r.json()),
      ]);
      setRows(d.data || []);
      setClients(c.data || []);
      setLeads(l.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of STAGES) map[s.id] = [];
    for (const row of rows) {
      const stage = STAGES.some((s) => s.id === row.stage) ? row.stage : "prospect";
      map[stage].push(row);
    }
    return map;
  }, [rows]);

  function openAdd() {
    setEditing(null);
    setForm({ title: "", value: "", stage: "prospect", clientId: "", leadId: "", notes: "" });
    setOpen(true);
  }

  function openEdit(row: Deal) {
    setEditing(row);
    setForm({
      title: row.title || "",
      value: String(row.value ?? ""),
      stage: row.stage || "prospect",
      clientId: row.clientId || "",
      leadId: row.leadId || "",
      notes: row.notes || "",
    });
    setOpen(true);
    setView(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setMsg("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const client = clients.find((x) => x._id === form.clientId);
      const lead = leads.find((x) => x._id === form.leadId);
      const payload = {
        title: form.title,
        value: Number(form.value || 0),
        stage: form.stage,
        clientId: form.clientId,
        clientName: client?.name || "",
        leadId: form.leadId,
        leadName: lead?.name || "",
        notes: form.notes,
      };
      const res = await fetch(editing ? `/api/crm/deals/${editing._id}` : "/api/crm/deals", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("error");
      setOpen(false);
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function moveStage(id: string, stage: string) {
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this deal?")) return;
    const res = await fetch(`/api/crm/deals/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={t("crm.deals")}
        actions={
          <button type="button" className="gp-btn gp-btn-primary" onClick={openAdd}>
            + Create Deal
          </button>
        }
      />
      {msg ? <p className="mb-3 text-sm text-red-600">{msg}</p> : null}
      <div className="gp-card flex items-center gap-3 px-4 py-3">
        <input className="gp-input min-h-10 border-0 bg-transparent py-1 shadow-none focus:shadow-none" placeholder="Search deals..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <p className="text-muted">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState message={t("common.noData")} /> : null}
      <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            className="min-h-40 rounded-xl border border-line bg-[var(--gp-card)] p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) void moveStage(id, stage.id);
            }}
          >
            <p className="mb-2 text-sm font-semibold">
              {stage.label} ({grouped[stage.id]?.length || 0})
            </p>
            <div className="space-y-2">
              {(grouped[stage.id] || []).map((deal) => (
                <div
                  key={deal._id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", deal._id)}
                  className="cursor-grab rounded-lg border border-line bg-white p-3 text-sm"
                >
                  <button type="button" className="font-medium" onClick={() => setView(deal)}>
                    {deal.title}
                  </button>
                  <p className="text-muted">{formatBDT(deal.value || 0)}</p>
                  <p className="text-xs text-muted">{deal.clientName || deal.leadName}</p>
                  <div className="mt-2 flex gap-1">
                    <button type="button" className="gp-btn gp-btn-ghost px-2 py-0.5 text-xs" onClick={() => openEdit(deal)}>
                      Edit
                    </button>
                    <button type="button" className="gp-btn gp-btn-ghost px-2 py-0.5 text-xs" onClick={() => void onDelete(deal._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title={editing ? "Edit Deal" : "Create Deal"} onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Field label="Title">
            <input className="gp-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Value">
            <input className="gp-input" type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </Field>
          <Field label="Stage">
            <select className="gp-input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Client">
            <select className="gp-input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead">
            <select className="gp-input" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
              <option value="">None</option>
              {leads.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="gp-input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!view} title="Deal details" onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-2 text-sm">
            <p><b>{view.title}</b></p>
            <p>{formatBDT(view.value || 0)}</p>
            <p>Stage: {view.stage}</p>
            <p>{view.clientName || view.leadName}</p>
            <p>{view.notes}</p>
            <button type="button" className="gp-btn gp-btn-primary" onClick={() => openEdit(view)}>
              Edit
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
