"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  OFFICE_STATUSES,
  FIELD_STATUSES,
  TECHNICAL_PRIORITIES,
  SERVICE_SOP,
  knowledgeFor,
  mergeReadings,
  checklistProgress,
  sopStepIndex,
  nextSopHint,
  slaState,
  type ChecklistRow,
  type TechnicalJobLike,
} from "@/lib/technical-checklists";
import { completionGaps, COMPLETION_GAP_LABELS } from "@/lib/service-totals";
import { defaultVisitCharge, starterServiceLines } from "@/lib/service-catalog";
import {
  ServiceBillingPanel,
  billingFromJob,
  toBillingPayload,
  type ServiceBillingValue,
} from "@/components/service/ServiceBillingPanel";
import { VisitClock, type VisitTimes } from "@/components/service/VisitClock";
import { mapsSearchUrl, resolveHouseSite } from "@/lib/service-visit";

type Job = TechnicalJobLike & {
  _id: string;
  jobNo?: string;
  equipmentType?: string;
  issueDescription?: string;
  notes?: string;
  technicianId?: { _id?: string; name?: string } | string;
  visitCharge?: number;
  serviceCharges?: number;
  serviceLines?: ServiceBillingValue["serviceLines"];
  parts?: ServiceBillingValue["parts"];
  discount?: number;
  tax?: number;
  paidAmount?: number;
  jobKind?: string;
  checkedInAt?: string | Date | null;
  checkedOutAt?: string | Date | null;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  customerId?: { _id?: string; name?: string; address?: string; location?: string; mobile?: string } | string;
};

export function TechnicalWorkPanel({ job, technicians = [] }: { job: Job; technicians?: { _id: string; name: string }[] }) {
  const router = useRouter();
  const locale = useLocale();
  const bn = locale === "bn";
  const knowledge = knowledgeFor(job.equipmentType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [products, setProducts] = useState<{ _id: string; name: string; sku?: string; sellPrice?: number }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    status: job.status || "reported",
    fieldStatus: job.fieldStatus || "",
    priority: job.priority || "medium",
    technicianId: typeof job.technicianId === "object" ? job.technicianId?._id || "" : String(job.technicianId || ""),
    diagnosis: job.diagnosis || "",
    resolution: job.resolution || "",
    labourHours: Number(job.labourHours || 0),
    travelNotes: "",
    customerConfirmation: job.customerConfirmation || "",
    supervisorNote: "",
    symptom: job.symptom || "",
    nextAction: job.nextAction || "",
    billable: Boolean(job.billable),
    siteName: job.siteName || "",
    siteLocation: job.siteLocation || "",
    siteAddress: job.siteAddress || "",
    checklist: (job.checklist || []) as ChecklistRow[],
    readings: mergeReadings(job.equipmentType, job.readings),
  });
  const [billing, setBilling] = useState<ServiceBillingValue>(() => {
    const fromJob = billingFromJob(job);
    if (!(job.serviceLines || []).length && !fromJob.visitCharge) {
      return {
        ...fromJob,
        visitCharge: defaultVisitCharge(job.jobKind || job.type),
        serviceLines: starterServiceLines(job.jobKind || job.type),
      };
    }
    return fromJob;
  });

  useEffect(() => {
    void Promise.all([
      fetch("/api/products?limit=200").then((r) => r.json()),
      fetch("/api/meta").then((r) => r.json()),
    ]).then(([p, meta]) => {
      setProducts(p.data || []);
      const locs = meta.locations || [];
      setLocations(locs);
      if (locs[0] && !billing.locationId) {
        setBilling((prev) => ({ ...prev, locationId: prev.locationId || locs[0]._id }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [apiGaps, setApiGaps] = useState<string[]>([]);
  const [visit, setVisit] = useState<VisitTimes>({
    checkedInAt: job.checkedInAt,
    checkedOutAt: job.checkedOutAt,
    durationMinutes: Number(job.durationMinutes || 0),
  });
  const house = resolveHouseSite({
    siteName: form.siteName || job.siteName,
    siteLocation: form.siteLocation || job.siteLocation,
    siteAddress: form.siteAddress || job.siteAddress,
    customerId: typeof job.customerId === "object" ? job.customerId : null,
    equipmentType: job.equipmentType,
  });
  const mapUrl = mapsSearchUrl(house.address, house.location);

  const progress = checklistProgress(form.checklist);
  const sla = slaState({ ...job, status: form.status, jobKind: job.jobKind || job.type });
  const step = sopStepIndex({ ...job, ...form });
  const liveGaps = completionGaps({
    technicianId: form.technicianId,
    serviceLines: billing.serviceLines,
    parts: billing.parts,
    visitCharge: billing.visitCharge,
    resolution: form.resolution,
    customerConfirmation: form.customerConfirmation,
    checkedInAt: visit.checkedInAt,
  });

  const readings = useMemo(
    () => mergeReadings(job.equipmentType, form.readings),
    [job.equipmentType, form.readings],
  );

  async function save(extra: Record<string, unknown> = {}) {
    setPending(true);
    setError("");
    setApiGaps([]);
    try {
      const res = await fetch(`/api/services/${job._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          readings,
          statusHistoryNote: note,
          ...toBillingPayload(billing),
          ...extra,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Array.isArray(json.gaps)) setApiGaps(json.gaps);
        const clockErrors: Record<string, string> = {
          incomplete: bn ? "সম্পন্ন করতে বাকি ধাপ পূরণ করুন।" : "Fill remaining steps before completing.",
          need_technician: bn ? "আগে টেকনিশিয়ান অ্যাসাইন করুন।" : "Assign a technician first.",
          already_on_site: bn ? "এই কাস্টমারে ইতিমধ্যে চেক-ইন আছে।" : "Already checked in at this customer.",
          need_checkin: bn ? "আগে কাস্টমারে চেক-ইন করুন।" : "Check in at the customer first.",
          checkout_before_checkin: bn ? "চেক-আউট চেক-ইনের আগে হতে পারে না।" : "Check-out cannot be before check-in.",
        };
        throw new Error(clockErrors[String(json.error)] || json.error || "failed");
      }
      setNote("");
      if (json.data) {
        setForm((prev) => ({
          ...prev,
          status: json.data.status || prev.status,
          fieldStatus: json.data.fieldStatus || prev.fieldStatus,
          labourHours: json.data.labourHours != null ? Number(json.data.labourHours) : prev.labourHours,
        }));
        setVisit({
          checkedInAt: json.data.checkedInAt,
          checkedOutAt: json.data.checkedOutAt,
          durationMinutes: Number(json.data.durationMinutes || 0),
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <div className="gp-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{job.jobNo}</p>
              <h2 className="mt-1 text-xl font-bold">{job.issueDescription}</h2>
              <p className="mt-1 text-sm text-muted">{nextSopHint({ ...job, ...form })}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${sla.key === "overdue" ? "bg-red-100 text-red-700" : sla.key === "due" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {sla.label}
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-line bg-[var(--gp-bg)] px-3 py-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{bn ? "কাস্টমার লোকেশন" : "Customer location"}</p>
            <p className="mt-1 font-semibold">{house.house}</p>
            {house.location ? <p className="text-[#2563eb]">{house.location}</p> : null}
            {house.address ? <p className="text-muted">{house.address}</p> : <p className="text-muted">{bn ? "ঠিকানা নেই — নিচে লিখুন" : "No address yet — add it below"}</p>}
            {house.mobile ? <p className="text-muted">{house.mobile}</p> : null}
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#2563eb]">
                {bn ? "ম্যাপে খুলুন" : "Open map"}
              </a>
            ) : null}
          </div>
          <ol className="mt-4 grid gap-1 sm:grid-cols-5">
            {SERVICE_SOP.map((row, i) => (
              <li key={row.key} className={`rounded-lg border px-2 py-2 text-[11px] ${i <= step ? "border-[#2563eb] bg-[#eff6ff]" : "border-line"}`}>
                <span className="font-bold">{i + 1}. {row.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

        <VisitClock
          visit={visit}
          pending={pending}
          canCheckIn={Boolean(form.technicianId)}
          locale={locale}
          onCheckIn={() => void save({ action: "check_in" })}
          onCheckOut={() => void save({ action: "check_out" })}
        />

        <div className="gp-card grid gap-3 p-5 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Office status</span>
            <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {OFFICE_STATUSES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Field status</span>
            <select className="gp-input" value={form.fieldStatus} onChange={(e) => setForm({ ...form, fieldStatus: e.target.value })}>
              <option value="">Not started</option>
              {FIELD_STATUSES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Priority</span>
            <select className="gp-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {TECHNICAL_PRIORITIES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Technician</span>
            <select className="gp-input" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
              <option value="">Unassigned</option>
              {technicians.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">{bn ? "কাস্টমার / বিল্ডিং" : "Customer / building"}</span>
            <input className="gp-input" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">{bn ? "লোকেশন / এলাকা" : "Location / area"}</span>
            <input className="gp-input" value={form.siteLocation} onChange={(e) => setForm({ ...form, siteLocation: e.target.value })} placeholder={bn ? "ধানমন্ডি, গুলশান..." : "Dhanmondi, Gulshan..."} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">{bn ? "কাস্টমারের ঠিকানা" : "Customer address"}</span>
            <textarea className="gp-input min-h-16" value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} placeholder={bn ? "বাড়ি, রোড, এলাকা" : "House, road, area"} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Symptom / error code</span>
            <input className="gp-input" value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Diagnosis</span>
            <textarea className="gp-input min-h-20" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Resolution</span>
            <textarea className="gp-input min-h-20" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Labour hours</span>
            <input type="number" min={0} step="0.5" className="gp-input" value={form.labourHours} onChange={(e) => setForm({ ...form, labourHours: Number(e.target.value) })} />
            <span className="text-xs text-muted">{bn ? "চেক-আউটে অটো হিসাব হয়" : "Filled automatically on check-out"}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
            Billable visit
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Customer confirmation</span>
            <input className="gp-input" value={form.customerConfirmation} onChange={(e) => setForm({ ...form, customerConfirmation: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Next action</span>
            <input className="gp-input" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Status note</span>
            <input className="gp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed on this save?" />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="button" disabled={pending} className="gp-btn gp-btn-primary" onClick={() => void save()}>
              {pending ? "Saving..." : "Save job"}
            </button>
            <button type="button" disabled={pending || Boolean(visit.checkedInAt && !visit.checkedOutAt)} className="gp-btn" onClick={() => void save({ action: "check_in" })}>
              {bn ? "কাস্টমারে চেক-ইন" : "Check in"}
            </button>
            <button type="button" disabled={pending} className="gp-btn" onClick={() => void save({ status: "in_progress", fieldStatus: "working" })}>
              Start work
            </button>
            <button type="button" disabled={pending} className="gp-btn" onClick={() => void save({ status: "resolved" })}>
              Mark resolved
            </button>
            <button
              type="button"
              disabled={pending || liveGaps.length > 0}
              className="gp-btn"
              onClick={() => void save({ status: "completed", fieldStatus: "completed", billable: true })}
            >
              Complete & bill
            </button>
          </div>
        </div>

        <div className="gp-card p-5">
          <h3 className="mb-3 font-bold">{bn ? "বিলিং — সার্ভিস চার্জ, লাইন ও পরিমাণ" : "Billing — charge, services & quantity"}</h3>
          <ServiceBillingPanel
            value={billing}
            onChange={setBilling}
            products={products}
            locations={locations}
            locale={locale}
            compact
          />
        </div>

        <div className="gp-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Digital checklist</h3>
            <span className="text-sm text-muted">{progress.label} ({progress.percent}%)</span>
          </div>
          <ul className="space-y-2">
            {form.checklist.map((row, i) => (
              <li key={`${row.item}-${i}`} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2">
                <input
                  type="checkbox"
                  checked={Boolean(row.done)}
                  onChange={(e) => {
                    const next = [...form.checklist];
                    next[i] = { ...row, done: e.target.checked };
                    setForm({ ...form, checklist: next });
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{row.item}</p>
                  <input
                    className="mt-1 w-full border-0 bg-transparent text-xs outline-none"
                    placeholder="Note"
                    value={row.note || ""}
                    onChange={(e) => {
                      const next = [...form.checklist];
                      next[i] = { ...row, note: e.target.value };
                      setForm({ ...form, checklist: next });
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="gp-card p-5">
          <h3 className="mb-3 font-bold">Site readings</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {readings.map((row, i) => (
              <label key={row.key} className="space-y-1 text-sm">
                <span className="text-muted">{row.label} {row.unit ? `(${row.unit})` : ""}</span>
                <input
                  className="gp-input"
                  value={row.value || ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[i] = { ...row, value: e.target.value };
                    setForm({ ...form, readings: next });
                  }}
                />
              </label>
            ))}
            {!readings.length ? <p className="text-sm text-muted">No reading template for this equipment line.</p> : null}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="gp-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{bn ? "কমপ্লিট চেকলিস্ট" : "Complete checklist"}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { key: "technician", ok: Boolean(form.technicianId) },
              { key: "checkin", ok: Boolean(visit.checkedInAt) },
              { key: "billing", ok: !liveGaps.includes("billing") },
              { key: "resolution", ok: Boolean(String(form.resolution || "").trim()) },
              { key: "confirm", ok: Boolean(String(form.customerConfirmation || "").trim()) },
            ].map((row) => (
              <li key={row.key} className={row.ok ? "text-emerald-700" : "text-amber-800"}>
                {row.ok ? "✓" : "○"} {COMPLETION_GAP_LABELS[row.key]?.[bn ? "bn" : "en"]}
              </li>
            ))}
          </ul>
          {apiGaps.map((g) => (
            <p key={g} className="mt-2 text-sm font-semibold text-danger">{COMPLETION_GAP_LABELS[g]?.[bn ? "bn" : "en"]}</p>
          ))}
          {liveGaps.length ? (
            <p className="mt-3 text-xs text-muted">{bn ? "Complete & bill চালু হবে সব ধাপ পূরণ হলে।" : "Complete & bill unlocks when every step is filled."}</p>
          ) : (
            <p className="mt-3 text-xs text-muted">{bn ? "ইনভয়েসে সার্ভিস লাইন ও পার্টস আলাদা দেখাবে।" : "Invoice will list service lines and parts separately."}</p>
          )}
        </div>
        {knowledge ? (
          <div className="gp-card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{knowledge.label} playbook</p>
            <p className="mt-2 text-sm">{knowledge.workflow}</p>
            <p className="mt-3 text-xs font-bold uppercase text-muted">Inspect</p>
            <ul className="mt-1 space-y-1 text-sm">{knowledge.inspect.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-3 text-xs font-bold uppercase text-muted">Common faults</p>
            <ul className="mt-1 space-y-1 text-sm">{knowledge.faults.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-3 text-xs font-bold uppercase text-muted">Safety</p>
            <ul className="mt-1 space-y-1 text-sm">{knowledge.safety.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-3 text-sm text-muted">{knowledge.closeout}</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
