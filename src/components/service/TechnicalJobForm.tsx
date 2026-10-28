"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EQUIPMENT_LINES,
  TECHNICAL_JOB_TYPES,
  TECHNICAL_PRIORITIES,
  JOB_TYPE_HELP,
  knowledgeFor,
  checklistItemsFor,
} from "@/lib/technical-checklists";
import { defaultServiceLines, defaultVisitCharge } from "@/lib/service-catalog";

type Option = { _id: string; name?: string; brand?: string; model?: string; serialNo?: string; machineType?: string; customerId?: string };

export function TechnicalJobForm({
  jobKind = "complaint",
  title,
}: {
  jobKind?: "complaint" | "scheduled" | "emergency" | "installation";
  title: string;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<Option[]>([]);
  const [machines, setMachines] = useState<Option[]>([]);
  const [technicians, setTechnicians] = useState<Option[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: jobKind,
    customerId: "",
    machineId: "",
    equipmentType: "Lift",
    technicianId: "",
    priority: jobKind === "emergency" ? "urgent" : "medium",
    complaintDescription: "",
    reportedBy: "",
    scheduledDate: "",
  });

  useEffect(() => {
    void Promise.all([
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
    ]).then(([c, m, t]) => {
      setClients(c.data || []);
      setMachines(m.data || m.items || []);
      setTechnicians(t.data || []);
    });
  }, []);

  const unitMachines = useMemo(
    () =>
      machines.filter((row) => {
        if (!form.customerId) return true;
        const cid = row.customerId;
        const id = cid && typeof cid === "object" && "_id" in (cid as object)
          ? String((cid as { _id: string })._id)
          : String(cid || "");
        return id === form.customerId;
      }),
    [machines, form.customerId],
  );

  const help = JOB_TYPE_HELP[form.type as keyof typeof JOB_TYPE_HELP];
  const knowledge = knowledgeFor(form.equipmentType);
  const checks = checklistItemsFor(form.equipmentType, form.type);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          machineId: form.machineId || undefined,
          technicianId: form.technicianId || undefined,
          jobKind: form.type,
          type: form.type,
          equipmentType: form.equipmentType,
          priority: form.priority,
          issueDescription: form.complaintDescription,
          complaintDescription: form.complaintDescription,
          reportedBy: form.reportedBy,
          scheduledDate: form.scheduledDate || undefined,
          status: form.technicianId ? "assigned" : "reported",
          visitCharge: defaultVisitCharge(form.type),
          serviceLines: defaultServiceLines(form.type),
          billable: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      const id = json.data?._id;
      router.push(form.type === "installation" ? `/services/projects/${id}` : `/services/technical/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="gp-card space-y-4 p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Job type</span>
            <select
              className="gp-input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              {(jobKind === "installation" ? [{ value: "installation", label: "Installation" }] : TECHNICAL_JOB_TYPES).map((row) => (
                <option key={row.value} value={row.value}>{row.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Priority</span>
            <select className="gp-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {TECHNICAL_PRIORITIES.map((row) => (
                <option key={row.value} value={row.value}>{row.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Client</span>
            <select className="gp-input" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, machineId: "" })}>
              <option value="">Select client</option>
              {clients.map((row) => (
                <option key={row._id} value={row._id}>{row.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Equipment line</span>
            <select className="gp-input" value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}>
              {EQUIPMENT_LINES.map((row) => (
                <option key={row.value} value={row.value}>{row.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Installed unit</span>
            <select className="gp-input" value={form.machineId} onChange={(e) => {
              const machine = machines.find((m) => m._id === e.target.value);
              setForm({ ...form, machineId: e.target.value, equipmentType: machine?.machineType || form.equipmentType });
            }}>
              <option value="">No unit linked</option>
              {unitMachines.map((row) => (
                <option key={row._id} value={row._id}>
                  {[row.brand, row.model, row.serialNo].filter(Boolean).join(" · ") || row._id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Technician</span>
            <select className="gp-input" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
              <option value="">Assign later</option>
              {technicians.map((row) => (
                <option key={row._id} value={row._id}>{row.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Reported by / site contact</span>
            <input className="gp-input" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} />
          </label>
          {form.type === "scheduled" || form.type === "installation" ? (
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">Scheduled date</span>
              <input type="date" className="gp-input" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
            </label>
          ) : null}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">{form.type === "installation" ? "Scope / site notes" : "Fault / complaint"}</span>
            <textarea className="gp-input min-h-28" required value={form.complaintDescription} onChange={(e) => setForm({ ...form, complaintDescription: e.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
          {pending ? "Saving..." : "Create job"}
        </button>
      </div>
      <aside className="space-y-4">
        <div className="gp-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{help?.label || "Playbook"}</p>
          <p className="mt-2 text-sm">{help?.intent}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-muted">
            {(help?.steps || []).map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
        {knowledge ? (
          <div className="gp-card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{knowledge.label}</p>
            <p className="mt-2 text-sm">{knowledge.workflow}</p>
            <p className="mt-3 text-xs font-bold uppercase text-muted">Checklist that will load</p>
            <ul className="mt-2 space-y-1 text-sm">
              {checks.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
      </aside>
    </form>
  );
}
