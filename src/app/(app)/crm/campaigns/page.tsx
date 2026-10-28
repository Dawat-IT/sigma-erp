"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatDateBD } from "@/lib/utils";

type Campaign = {
  _id: string;
  name: string;
  source?: string;
  status?: string;
  startsAt?: string;
  endsAt?: string;
  notes?: string;
};

const empty = { name: "", source: "", status: "draft", startsAt: "", endsAt: "", notes: "" };

export default function CrmCampaignsPage() {
  const t = useTranslations();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [view, setView] = useState<Campaign | null>(null);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/crm/campaigns?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(row: Campaign) {
    setEditing(row);
    setForm({
      name: row.name || "",
      source: row.source || "",
      status: row.status || "draft",
      startsAt: row.startsAt ? row.startsAt.slice(0, 10) : "",
      endsAt: row.endsAt ? row.endsAt.slice(0, 10) : "",
      notes: row.notes || "",
    });
    setOpen(true);
    setView(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setMsg("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      };
      const res = await fetch(editing ? `/api/crm/campaigns/${editing._id}` : "/api/crm/campaigns", {
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

  async function onDelete(id: string) {
    if (!window.confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/crm/campaigns/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={t("crm.campaigns")}
        actions={
          <button type="button" className="gp-btn gp-btn-primary" onClick={openAdd}>
            + Add Campaign
          </button>
        }
      />
      {msg ? <p className="mb-3 text-sm text-red-600">{msg}</p> : null}
      <input className="gp-input mb-4 max-w-sm" placeholder="Search campaigns..." value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <p className="text-muted">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState message={t("common.noData")} /> : null}
      {!loading && rows.length > 0 ? (
        <div className="gp-card overflow-x-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Source</th>
                <th>Status</th>
                <th>Dates</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    <button type="button" className="font-medium text-[var(--gp-primary)]" onClick={() => setView(row)}>
                      {row.name}
                    </button>
                  </td>
                  <td>{row.source}</td>
                  <td>{row.status}</td>
                  <td className="text-sm">
                    {row.startsAt ? formatDateBD(row.startsAt) : "—"} → {row.endsAt ? formatDateBD(row.endsAt) : "—"}
                  </td>
                  <td>
                    <button type="button" className="gp-btn gp-btn-ghost px-2 py-1 text-xs" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="gp-btn gp-btn-ghost px-2 py-1 text-xs" onClick={() => void onDelete(row._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={open} title={editing ? "Edit Campaign" : "Add Campaign"} onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Field label="Name">
            <input className="gp-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Source">
            <input className="gp-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          </Field>
          <Field label="Start">
            <input className="gp-input" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </Field>
          <Field label="End">
            <input className="gp-input" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
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

      <Modal open={!!view} title="Campaign details" onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-2 text-sm">
            <p><b>{view.name}</b></p>
            <p>{view.source}</p>
            <p>{view.status}</p>
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
