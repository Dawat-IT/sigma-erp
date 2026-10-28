"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Field, PageHeader } from "@/components/ui";
import {
  EQUIPMENT_LINES,
  TECHNICAL_PRIORITIES,
  slaHoursFor,
} from "@/lib/technical-checklists";
import { defaultVisitCharge, starterServiceLines } from "@/lib/service-catalog";
import { computeServiceTotals } from "@/lib/service-totals";
import { formatBDT } from "@/lib/utils";
import { todayKey } from "@/lib/service-visit";

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
  siteAddress?: string;
  customerId?: string | { _id?: string };
};

type Tech = { _id: string; name?: string; speciality?: string };

const JOB_KINDS = [
  { value: "scheduled", en: "PM visit", bn: "পিএম ভিজিট" },
  { value: "complaint", en: "Complaint", bn: "কমপ্লেইন" },
  { value: "emergency", en: "Emergency", bn: "ইমার্জেন্সি" },
  { value: "installation", en: "Install", bn: "ইনস্টল" },
  { value: "general", en: "General", bn: "জেনারেল" },
] as const;

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

function kindLabel(value: string, bn: boolean) {
  const row = JOB_KINDS.find((k) => k.value === value);
  return row ? (bn ? row.bn : row.en) : value;
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

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function slaTone(hours: number) {
  if (hours <= 4) return "is-danger";
  if (hours <= 24) return "is-warn";
  return "is-info";
}

function jobHref(kind: string, id: string) {
  if (kind === "complaint") return `/services/complaints/${id}`;
  if (kind === "installation") return `/services/projects/${id}`;
  return `/services/${id}`;
}

function createStatus(kind: string, technicianId: string) {
  if (technicianId) return "assigned";
  if (kind === "complaint" || kind === "emergency") return "reported";
  return "pending";
}

export default function NewWorkOrderPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <NewWorkOrderInner />
    </Suspense>
  );
}

function NewWorkOrderInner() {
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
    jobKind: "scheduled",
    customerId: "",
    machineId: "",
    equipmentType: "Lift",
    technicianId: "",
    priority: "medium",
    reportedBy: "",
    issueDescription: "",
    scheduledDate: todayKey(),
    siteName: "",
    siteLocation: "",
    visitCharge: String(defaultVisitCharge("scheduled")),
  });

  useEffect(() => {
    const presetCustomer = searchParams.get("customerId") || "";
    const presetMachine = searchParams.get("machineId") || "";
    const presetTech = searchParams.get("technicianId") || "";
    const presetKind = searchParams.get("jobKind") || "";
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
        const customer = list.find((row) => row._id === customerId);
        const jobKind = JOB_KINDS.some((k) => k.value === presetKind) ? presetKind : f.jobKind;
        return {
          ...f,
          jobKind,
          visitCharge: JOB_KINDS.some((k) => k.value === presetKind) ? String(defaultVisitCharge(jobKind)) : f.visitCharge,
          customerId: customer ? customer._id : f.customerId,
          machineId: machine ? machine._id : f.machineId,
          equipmentType: machine?.machineType || f.equipmentType,
          technicianId: presetTech && techs.some((row) => row._id === presetTech) ? presetTech : f.technicianId,
          siteName: machine?.siteName || customer?.name || f.siteName,
          siteLocation: machine?.siteLocation || customer?.location || customer?.city || f.siteLocation,
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
  const slaHours = slaHoursFor(form.jobKind, form.priority);
  const visitCharge = Math.max(0, Number(form.visitCharge) || 0);
  const serviceLines = starterServiceLines(form.jobKind);
  const totals = computeServiceTotals({ serviceLines, visitCharge, parts: [], discount: 0, tax: 0, paidAmount: 0 });
  const site = [form.siteName, form.siteLocation].filter(Boolean).join(" · ");
  const lineHint = serviceLines[0]?.name
    ? `${bn && serviceLines[0].code ? serviceLines[0].name : serviceLines[0].name} · ${moneyShort(Number(serviceLines[0].lineTotal || 0), locale)}`
    : "";

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
  }

  function pickKind(jobKind: string) {
    patch({
      jobKind,
      visitCharge: String(defaultVisitCharge(jobKind)),
      priority: jobKind === "emergency" ? "urgent" : form.priority === "urgent" && jobKind !== "emergency" ? "medium" : form.priority,
    });
  }

  function pickCustomer(id: string) {
    const customer = customers.find((c) => c._id === id);
    const current = machines.find((m) => m._id === form.machineId);
    const keepMachine = current && machineOwnerId(current) === id;
    patch({
      customerId: id,
      machineId: keepMachine ? form.machineId : "",
      siteName: customer?.name || form.siteName,
      siteLocation: customer?.location || customer?.city || form.siteLocation,
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
      siteName: machine?.siteName || form.siteName,
      siteLocation: machine?.siteLocation || form.siteLocation,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError(bn ? "কাস্টমার বাছুন।" : "Pick a customer.");
      return;
    }
    if (!form.issueDescription.trim()) {
      setError(bn ? "কাজের বিবরণ লিখুন।" : "Describe the work.");
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
        jobKind: form.jobKind,
        type: form.jobKind,
        equipmentType: form.equipmentType,
        priority: form.priority,
        issueDescription: form.issueDescription.trim(),
        reportedBy: form.reportedBy.trim() || undefined,
        scheduledDate: form.scheduledDate || undefined,
        siteName: form.siteName.trim() || undefined,
        siteLocation: form.siteLocation.trim() || undefined,
        status: createStatus(form.jobKind, form.technicianId),
        visitCharge,
        serviceLines,
        billable: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(bn ? "ওয়ার্ক অর্ডার সেভ হয়নি।" : "Could not save the work order.");
      return;
    }
    router.push(jobHref(form.jobKind, String(json.data?._id || "")));
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "নতুন ওয়ার্ক অর্ডার" : "New work order"}
        subtitle={bn
          ? "ধরন, কাস্টমার, ভিজিট চার্জ ও কাজ এক স্ক্রিনে — সেভ করলে জব খুলবে।"
          : "Kind, customer, visit charge and work on one screen — save opens the job."}
        stats={[
          { value: kindLabel(form.jobKind, bn), label: bn ? "ধরন" : "kind" },
          { value: `${slaHours}h`, label: "SLA" },
          { value: moneyShort(totals.grandTotal, locale), label: bn ? "মোট" : "total" },
        ]}
        actions={
          <>
            <Link href="/services/jobs" className="gp-btn">{bn ? "তালিকা" : "List"}</Link>
            <button type="submit" form="wo-add-form" disabled={pending} className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </>
        }
      />

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <form id="wo-add-form" onSubmit={onSubmit} className="quote-board eq-add">
        <div className="eq-add-grid">
          <section className="eq-add-panel">
            <b>{bn ? "কাস্টমার ও কাজ" : "Customer & work"}</b>
            <div className="eq-add-fields">
              <div className="span-2 fu-views eq-add-types">
                {JOB_KINDS.map((row) => (
                  <button
                    key={row.value}
                    type="button"
                    className={form.jobKind === row.value ? "on" : ""}
                    onClick={() => pickKind(row.value)}
                  >
                    {bn ? row.bn : row.en}
                  </button>
                ))}
              </div>
              <Field label={bn ? "কাস্টমার খুঁজুন" : "Find customer"} className="span-2">
                <input
                  className="gp-input"
                  value={custQ}
                  onChange={(e) => setCustQ(e.target.value)}
                  placeholder={bn ? "নাম / মোবাইল / লোকেশন" : "Name / mobile / location"}
                />
              </Field>
              <Field label={bn ? "কাস্টমার" : "Customer"} className="span-2">
                <select required className="gp-input" value={form.customerId} onChange={(e) => pickCustomer(e.target.value)}>
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
              <Field label={bn ? "কাজ / সমস্যা" : "Work / issue"} className="span-2">
                <textarea
                  required
                  className="gp-input eq-add-notes"
                  rows={3}
                  value={form.issueDescription}
                  onChange={(e) => patch({ issueDescription: e.target.value })}
                  placeholder={bn ? "কী করতে হবে, সাইটে কী আছে" : "What to do, what is on site"}
                />
              </Field>
            </div>
          </section>

          <section className="eq-add-panel">
            <b>{bn ? "ডিসপ্যাচ ও চার্জ" : "Dispatch & charge"}</b>
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
                    <em>{slaHoursFor(form.jobKind, row.value)}h</em>
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
              <Field label={bn ? "ভিজিট তারিখ" : "Visit date"}>
                <input type="date" className="gp-input" value={form.scheduledDate} onChange={(e) => patch({ scheduledDate: e.target.value })} />
              </Field>
              <Field label={bn ? "সাইট" : "Site"}>
                <input className="gp-input" value={form.siteName} onChange={(e) => patch({ siteName: e.target.value })} />
              </Field>
              <Field label={bn ? "লোকেশন" : "Location"}>
                <input className="gp-input" value={form.siteLocation} onChange={(e) => patch({ siteLocation: e.target.value })} />
              </Field>
              <Field label={bn ? "ভিজিট চার্জ" : "Visit charge"}>
                <input
                  className="gp-input"
                  type="number"
                  min={0}
                  value={form.visitCharge}
                  onChange={(e) => patch({ visitCharge: e.target.value })}
                />
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
                  ? `${slaHours} ঘণ্টার SLA · ${createStatus(form.jobKind, form.technicianId) === "assigned" ? "অ্যাসাইনড" : createStatus(form.jobKind, form.technicianId) === "reported" ? "রিপোর্টেড" : "পেন্ডিং"} হিসেবে সেভ`
                  : `${slaHours}h SLA · save as ${createStatus(form.jobKind, form.technicianId)}`}
                {lineHint ? ` · ${lineHint}` : ""}
              </p>
            </div>
          </section>
        </div>

        <article className={`fu-card eq-add-preview ${slaTone(slaHours)}`}>
          <div className="fu-card-top">
            <span className="fu-avatar">WO</span>
            <div className="min-w-0 flex-1">
              <strong>{bn ? "নতুন ওয়ার্ক অর্ডার" : "New work order"}</strong>
              <p>
                {selected ? customerLabel(selected, bn) : bn ? "কাস্টমার বাছুন" : "Pick a customer"}
                {site ? ` · ${site}` : ""}
                {unit ? ` · ${machineLabel(unit)}` : ""}
              </p>
            </div>
            <b className="qt-amt">{moneyShort(totals.grandTotal, locale)}</b>
          </div>
          {form.issueDescription.trim() ? <p className="fu-note">{form.issueDescription.trim()}</p> : null}
          <div className="fu-card-foot eq-foot">
            <p className="fu-meta">
              {kindLabel(form.jobKind, bn)}
              {` · ${typeLabel(form.equipmentType, bn)}`}
              {` · ${priorityLabel(form.priority, bn)}`}
              {` · ${slaHours}h SLA`}
              {tech?.name ? ` · ${tech.name}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
              {form.scheduledDate ? ` · ${form.scheduledDate}` : ""}
            </p>
            <Link href="/services/jobs" className="fld-act">{bn ? "তালিকা" : "List"}</Link>
            <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </div>
        </article>
      </form>
    </div>
  );
}
