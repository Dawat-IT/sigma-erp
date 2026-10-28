"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatDateBD } from "@/lib/utils";

type Lead = {
  _id: string;
  name: string;
  mobile?: string;
  email?: string;
  source?: string;
  company?: string;
  product?: string;
  ownerName?: string;
  rating?: string;
  status?: string;
  notes?: string;
  nextFollowUp?: string;
};

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  source: "",
  company: "",
  product: "",
  ownerName: "",
  rating: "warm",
  status: "open",
  notes: "",
};

export default function CrmLeadsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [source, setSource] = useState("all");
  const [product, setProduct] = useState("all");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Lead | null>(null);
  const [viewFollows, setViewFollows] = useState<{ _id: string; scheduledAt: string; status: string; notes?: string; clientName?: string }[]>([]);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ limit: "400" });
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      if (rating !== "all") params.set("rating", rating);
      if (source !== "all") params.set("source", source);
      if (product !== "all") params.set("product", product);
      const res = await fetch(`/api/crm/leads?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "error");
      setRows(json.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [q, status, rating, source, product, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[],
    [rows],
  );
  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.product).filter(Boolean))) as string[],
    [rows],
  );

  const counts = useMemo(() => {
    const all = rows;
    return {
      total: all.length,
      hot: all.filter((r) => r.rating === "hot").length,
      warm: all.filter((r) => r.rating === "warm").length,
      cold: all.filter((r) => r.rating === "cold").length,
      won: all.filter((r) => r.status === "won").length,
      lost: all.filter((r) => r.status === "lost").length,
    };
  }, [rows]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: Lead) {
    setEditing(row);
    setForm({
      name: row.name || "",
      mobile: row.mobile || "",
      email: row.email || "",
      source: row.source || "",
      company: row.company || "",
      product: row.product || "",
      ownerName: row.ownerName || "",
      rating: row.rating || "warm",
      status: row.status || "open",
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
    setMsg("");
    try {
      const res = await fetch(editing ? `/api/crm/leads/${editing._id}` : "/api/crm/leads", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  async function onDelete(id: string) {
    if (!window.confirm("Delete this lead?")) return;
    const res = await fetch(`/api/crm/leads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMsg(t("common.error"));
      return;
    }
    await load();
  }

  async function patchStatus(row: Lead, next: string) {
    await fetch(`/api/crm/leads/${row._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function patchRating(row: Lead, next: string) {
    await fetch(`/api/crm/leads/${row._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: next }),
    });
    await load();
  }

  async function openView(row: Lead) {
    setView(row);
    const json = await fetch(`/api/crm/followups?leadId=${row._id}&limit=50`).then((r) => r.json());
    setViewFollows(json.data || []);
  }

  async function convertToClient(row: Lead) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/crm/leads/${row._id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "error");
      await load();
      if (json.data?._id) router.push(`/crm/followups?clientId=${json.data._id}&add=1`);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ["Name", "Mobile", "Email", "Company", "Product", "Source", "Owner", "Rating", "Status"];
    const lines = rows.map((r) =>
      [r.name, r.mobile, r.email, r.company, r.product, r.source, r.ownerName, r.rating, r.status]
        .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="gp-desk">
      <PageHeader
        kicker="CRM"
        title={t("crm.leads")}
        subtitle="Capture customer / lift inquiries, follow up, then convert to a client."
        stats={[
          { value: rows.length, label: "leads" },
          { value: rows.filter((r) => String(r.status || "").toLowerCase() === "open").length, label: "open" },
          { value: rows.filter((r) => String(r.status || "").toLowerCase() === "won").length, label: "won" },
        ]}
        actions={
          <>
            <button type="button" className="gp-btn gp-btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="gp-btn gp-btn-primary" onClick={openAdd}>
              + Add Lead
            </button>
          </>
        }
      />
      {msg ? <p className="mb-3 text-sm text-red-600">{msg}</p> : null}
      <div className="dash-panel grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <input className="gp-input max-w-xs" placeholder="Search name, email, phone, company..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="gp-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select className="gp-input w-auto" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="all">All ratings</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select className="gp-input w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="gp-input w-auto" value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="all">All products</option>
          {products.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span>Total <b>{counts.total}</b></span>
        <span>Hot <b>{counts.hot}</b></span>
        <span>Warm <b>{counts.warm}</b></span>
        <span>Cold <b>{counts.cold}</b></span>
        <span>Won <b>{counts.won}</b></span>
        <span>Lost <b>{counts.lost}</b></span>
      </div>
      {loading ? <p className="text-muted">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState message={t("common.noData")} /> : null}
      {!loading && rows.length > 0 ? (
        <div className="gp-card overflow-x-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Product</th>
                <th>Source</th>
                <th>Owner</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Next follow-up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    <button type="button" className="font-medium text-[var(--gp-primary)]" onClick={() => void openView(row)}>
                      {row.name}
                    </button>
                    <div className="text-xs text-muted">{row.company}</div>
                  </td>
                  <td>
                    {row.mobile}
                    <div className="text-xs text-muted">{row.email}</div>
                  </td>
                  <td>{row.product}</td>
                  <td>{row.source}</td>
                  <td>{row.ownerName}</td>
                  <td>
                    <select className="gp-input w-auto py-1" value={row.rating || "warm"} onChange={(e) => void patchRating(row, e.target.value)}>
                      <option value="hot">Hot</option>
                      <option value="warm">Warm</option>
                      <option value="cold">Cold</option>
                    </select>
                  </td>
                  <td>
                    <select className="gp-input w-auto py-1" value={row.status || "open"} onChange={(e) => void patchStatus(row, e.target.value)}>
                      <option value="open">Open</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </td>
                  <td className="whitespace-nowrap text-sm">{row.nextFollowUp ? formatDateBD(row.nextFollowUp) : "—"}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/crm/followups?leadId=${row._id}&add=1`} className="gp-btn gp-btn-ghost px-2 py-1 text-xs">
                      Follow up
                    </Link>
                    {row.status !== "won" ? (
                      <button type="button" className="gp-btn gp-btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => void convertToClient(row)}>
                        To client
                      </button>
                    ) : (
                      <Link href={`/crm/followups?leadId=${row._id}`} className="gp-btn gp-btn-ghost px-2 py-1 text-xs">
                        History
                      </Link>
                    )}
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

      <Modal open={open} title={editing ? "Edit Lead" : "Add Lead"} onClose={() => setOpen(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Name">
            <input className="gp-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mobile">
            <input className="gp-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="gp-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Company">
            <input className="gp-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Product">
            <input className="gp-input" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </Field>
          <Field label="Source">
            <input className="gp-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </Field>
          <Field label="Owner">
            <input className="gp-input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </Field>
          <Field label="Rating">
            <select className="gp-input" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea className="gp-input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {busy ? t("common.loading") : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!view} title="Lead details" onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-2 text-sm">
            <p><b>{view.name}</b></p>
            <p>Mobile: {view.mobile || "—"}</p>
            <p>Email: {view.email || "—"}</p>
            <p>Company: {view.company || "—"}</p>
            <p>Product: {view.product || "—"}</p>
            <p>Source: {view.source || "—"}</p>
            <p>Owner: {view.ownerName || "—"}</p>
            <p>Rating: {view.rating || "—"}</p>
            <p>Status: {view.status || "—"}</p>
            <p>Next follow-up: {view.nextFollowUp ? formatDateBD(view.nextFollowUp) : "—"}</p>
            <p>{view.notes}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/crm/followups?leadId=${view._id}&add=1`} className="gp-btn gp-btn-primary">
                Follow up
              </Link>
              {view.status !== "won" ? (
                <button type="button" className="gp-btn" disabled={busy} onClick={() => void convertToClient(view)}>
                  Convert to client
                </button>
              ) : null}
              <button type="button" className="gp-btn gp-btn-ghost" onClick={() => openEdit(view)}>
                Edit
              </button>
            </div>
            <div className="border-t border-line pt-2">
              <p className="font-semibold">Follow-ups</p>
              {viewFollows.length === 0 ? (
                <p className="text-muted">No follow-ups yet.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {viewFollows.map((f) => (
                    <li key={f._id}>
                      {formatDateBD(f.scheduledAt)} · {f.status}
                      {f.notes ? ` — ${f.notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
