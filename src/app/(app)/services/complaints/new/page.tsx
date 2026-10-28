"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Field, PageHeader } from "@/components/ui";
import {
  EQUIPMENT_LINES,
  TECHNICAL_PRIORITIES,
  checklistItemsFor,
  slaHoursFor,
} from "@/lib/technical-checklists";
import { defaultServiceLines, defaultVisitCharge } from "@/lib/service-catalog";

type Customer = {
  _id: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  location?: string;
  city?: string;
  address?: string;
};

type Machine = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  siteName?: string;
  siteLocation?: string;
  customerId?: string | { _id?: string };
};

type Tech = { _id: string; name?: string; speciality?: string };

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const PRIORITY_BN: Record<string, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "উচ্চ",
  urgent: "জরুরি",
};

function typeLabel(value: string, bn: boolean) {
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function priorityLabel(value: string, bn: boolean) {
  if (bn && PRIORITY_BN[value]) return PRIORITY_BN[value];
  return TECHNICAL_PRIORITIES.find((p) => p.value === value)?.label || value;
}

function customerLabel(c: Customer, bn: boolean) {
  const name = bn && c.nameBn ? c.nameBn : c.name || "—";
  return c.mobile ? `${name} · ${c.mobile}` : name;
}

function machineOwnerId(row: Machine) {
  const cid = row.customerId;
  if (cid && typeof cid === "object" && "_id" in cid) return String(cid._id || "");
  return String(cid || "");
}

function machineLabel(row: Machine) {
  return [row.brand, row.model, row.serialNo || row.machineType].filter(Boolean).join(" · ") || row._id;
}

function slaTone(hours: number) {
  if (hours <= 4) return "is-danger";
  if (hours <= 24) return "is-warn";
  return "is-info";
}

export default function NewComplaintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const bn = locale === "bn";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [technicians, setTechnicians] = useState<Tech[]>([]);
  const [custQ, setCustQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    machineId: "",
    equipmentType: "Lift",
    technicianId: "",
    priority: "medium",
    reportedBy: "",
    issueDescription: "",
  });

  useEffect(() => {
    const presetCustomer = searchParams.get("customerId") || "";
    const presetMachine = searchParams.get("machineId") || "";
    const presetTech = searchParams.get("technicianId") || "";
    void Promise.all([
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/machines?limit=200").then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
    ]).then(([c, m, t]) => {
      const list = (c.data || []) as Customer[];
      const units = (m.data || m.items || []) as Machine[];
      const techs = (t.data || []) as Tech[];
      setCustomers(list);
      setMachines(units);
      setTechnicians(techs);
      setForm((f) => {
        const machine = units.find((row) => row._id === presetMachine);
        const customerId = presetCustomer || (machine ? machineOwnerId(machine) : f.customerId);
        return {
          ...f,
          customerId: customerId && list.some((row) => row._id === customerId) ? customerId : f.customerId,
          machineId: machine ? machine._id : f.machineId,
          equipmentType: machine?.machineType || f.equipmentType,
          technicianId: presetTech && techs.some((row) => row._id === presetTech) ? presetTech : f.technicianId,
        };
      });
    });
  }, [searchParams]);

  const filteredCustomers = useMemo(() => {
    const q = custQ.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.nameBn, c.mobile, c.location, c.city].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [customers, custQ]);

  const unitMachines = useMemo(() => {
    if (!form.customerId) return machines;
    return machines.filter((row) => machineOwnerId(row) === form.customerId);
  }, [machines, form.customerId]);

  const selected = customers.find((c) => c._id === form.customerId);
  const unit = machines.find((m) => m._id === form.machineId);
  const tech = technicians.find((t) => t._id === form.technicianId);
  const typeMeta = EQUIPMENT_LINES.find((l) => l.value === form.equipmentType);
  const slaHours = slaHoursFor("complaint", form.priority);
  const checks = checklistItemsFor(form.equipmentType, "complaint");
  const site = [unit?.siteName, unit?.siteLocation || selected?.location || selected?.city].filter(Boolean).join(" · ");

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
  }

  function pickCustomer(id: string) {
    const current = machines.find((m) => m._id === form.machineId);
    patch({
      customerId: id,
      machineId: current && machineOwnerId(current) === id ? form.machineId : "",
    });
  }

  function pickMachine(id: string) {
    if (!id) {
      patch({ machineId: "" });
      return;
    }
    const machine = machines.find((m) => m._id === id);
    patch({
      machineId: id,
      equipmentType: machine?.machineType || form.equipmentType,
      customerId: !form.customerId && machine ? machineOwnerId(machine) || form.customerId : form.customerId,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError(bn ? "কাস্টমার বাছুন।" : "Pick a customer.");
      return;
    }
    if (!form.issueDescription.trim()) {
      setError(bn ? "সমস্যা লিখুন।" : "Describe the fault.");
      return;
    }
    setPending(true);
    setError("");
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: form.customerId,
        machineId: form.machineId || undefined,
        technicianId: form.technicianId || undefined,
        jobKind: "complaint",
        type: "complaint",
        equipmentType: form.equipmentType,
        priority: form.priority,
        issueDescription: form.issueDescription.trim(),
        complaintDescription: form.issueDescription.trim(),
        reportedBy: form.reportedBy.trim() || undefined,
        status: form.technicianId ? "assigned" : "reported",
        visitCharge: defaultVisitCharge("complaint"),
        serviceLines: defaultServiceLines("complaint"),
        billable: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(bn ? "কমপ্লেইন সেভ হয়নি।" : "Could not save the complaint.");
      return;
    }
    router.push(`/services/complaints/${json.data?._id}`);
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "নতুন কমপ্লেইন" : "New complaint"}
        subtitle={bn
          ? "কাস্টমার, ইউনিট, ফল্ট ও SLA এক স্ক্রিনে — সেভ করলে টিকিট খুলবে।"
          : "Customer, unit, fault and SLA on one screen — save opens the ticket."}
        stats={[
          { value: `${slaHours}h`, label: "SLA" },
          { value: priorityLabel(form.priority, bn), label: bn ? "প্রাধান্য" : "priority" },
          { value: selected ? (bn && selected.nameBn ? selected.nameBn : selected.name || "—") : "—", label: bn ? "কাস্টমার" : "customer" },
        ]}
        actions={
          <>
            <Link href="/services/complaints" className="gp-btn">{bn ? "তালিকা" : "List"}</Link>
            <button type="submit" form="complaint-add-form" disabled={pending} className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </>
        }
      />

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <form id="complaint-add-form" onSubmit={onSubmit} className="quote-board eq-add">
        <div className="eq-add-grid">
          <section className="eq-add-panel">
            <b>{bn ? "কাস্টমার ও ইউনিট" : "Customer & unit"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "কাস্টমার খুঁজুন" : "Find customer"} className="span-2">
                <input
                  className="gp-input"
                  value={custQ}
                  onChange={(e) => setCustQ(e.target.value)}
                  placeholder={bn ? "নাম / মোবাইল / লোকেশন" : "Name / mobile / location"}
                />
              </Field>
              <Field label={bn ? "কাস্টমার" : "Customer"} className="span-2">
                <select
                  required
                  className="gp-input"
                  value={form.customerId}
                  onChange={(e) => pickCustomer(e.target.value)}
                >
                  <option value="">{bn ? "বাছুন" : "Select"}</option>
                  {filteredCustomers.map((c) => (
                    <option key={c._id} value={c._id}>{customerLabel(c, bn)}</option>
                  ))}
                </select>
              </Field>
              <div className="span-2 fu-views eq-add-types">
                {EQUIPMENT_LINES.map((line) => (
                  <button
                    key={line.value}
                    type="button"
                    className={form.equipmentType === line.value ? "on" : ""}
                    onClick={() => patch({ equipmentType: line.value })}
                  >
                    {typeLabel(line.value, bn)}
                  </button>
                ))}
              </div>
              {typeMeta ? <p className="eq-add-hint span-2">{typeMeta.summary}</p> : null}
              <Field label={bn ? "ইউনিট" : "Installed unit"} className="span-2">
                <select className="gp-input" value={form.machineId} onChange={(e) => pickMachine(e.target.value)}>
                  <option value="">{bn ? "লিংক নেই" : "No unit linked"}</option>
                  {unitMachines.map((row) => (
                    <option key={row._id} value={row._id}>{machineLabel(row)}</option>
                  ))}
                </select>
              </Field>
              <Field label={bn ? "সমস্যা / ফল্ট" : "Fault / complaint"} className="span-2">
                <textarea
                  required
                  className="gp-input eq-add-notes"
                  rows={4}
                  value={form.issueDescription}
                  onChange={(e) => patch({ issueDescription: e.target.value })}
                  placeholder={bn ? "কী হচ্ছে, কখন থেকে, সাইটে কে আছে" : "What failed, since when, who is on site"}
                />
              </Field>
            </div>
          </section>

          <section className="eq-add-panel">
            <b>{bn ? "ডিসপ্যাচ ও SLA" : "Dispatch & SLA"}</b>
            <div className="eq-add-fields">
              <div className="span-2 fu-views eq-add-types">
                {TECHNICAL_PRIORITIES.map((row) => (
                  <button
                    key={row.value}
                    type="button"
                    className={form.priority === row.value ? "on" : ""}
                    onClick={() => patch({ priority: row.value })}
                  >
                    {priorityLabel(row.value, bn)}
                    <em>{slaHoursFor("complaint", row.value)}h</em>
                  </button>
                ))}
              </div>
              <Field label={bn ? "টেকনিশিয়ান" : "Technician"}>
                <select className="gp-input" value={form.technicianId} onChange={(e) => patch({ technicianId: e.target.value })}>
                  <option value="">{bn ? "পরে অ্যাসাইন" : "Assign later"}</option>
                  {technicians.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.speciality ? `${row.name} · ${row.speciality}` : row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={bn ? "রিপোর্ট করেছেন" : "Reported by"}>
                <input
                  className="gp-input"
                  value={form.reportedBy}
                  onChange={(e) => patch({ reportedBy: e.target.value })}
                  placeholder={bn ? "সাইট কন্টাক্ট" : "Site contact"}
                />
              </Field>
              <p className="eq-add-hint span-2">
                {bn
                  ? `${slaHours} ঘণ্টার SLA · ${form.technicianId ? "অ্যাসাইনড হিসেবে সেভ" : "রিপোর্টেড হিসেবে সেভ"} · চেকলিস্ট ${checks.length} আইটেম`
                  : `${slaHours}h SLA · save as ${form.technicianId ? "assigned" : "reported"} · ${checks.length} checklist items`}
              </p>
              <ul className="eq-add-checks span-2">
                {checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <article className={`fu-card eq-add-preview ${slaTone(slaHours)}`}>
          <div className="fu-card-top">
            <span className="fu-avatar">CP</span>
            <div className="min-w-0 flex-1">
              <strong>{bn ? "নতুন কমপ্লেইন" : "New complaint"}</strong>
              <p>
                {selected ? customerLabel(selected, bn) : bn ? "কাস্টমার বাছুন" : "Pick a customer"}
                {site ? ` · ${site}` : ""}
                {unit ? ` · ${machineLabel(unit)}` : ""}
              </p>
            </div>
            <span className={`fu-chip ${slaTone(slaHours)}`}>{slaHours}h SLA</span>
          </div>
          {form.issueDescription.trim() ? <p className="fu-note">{form.issueDescription.trim()}</p> : null}
          <div className="fu-card-foot eq-foot">
            <p className="fu-meta">
              {typeLabel(form.equipmentType, bn)}
              {` · ${priorityLabel(form.priority, bn)}`}
              {tech?.name ? ` · ${tech.name}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
              {form.reportedBy.trim() ? ` · ${form.reportedBy.trim()}` : ""}
            </p>
            <Link href="/services/dispatch" className="fld-act">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
            <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </div>
        </article>
      </form>
    </div>
  );
}
