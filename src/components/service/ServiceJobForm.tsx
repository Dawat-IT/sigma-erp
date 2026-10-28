"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { EQUIPMENT_LINES, TECHNICAL_JOB_TYPES, TECHNICAL_PRIORITIES } from "@/lib/technical-checklists";
import { defaultVisitCharge, starterServiceLines } from "@/lib/service-catalog";
import { completionGaps, COMPLETION_GAP_LABELS, computeServiceTotals } from "@/lib/service-totals";
import { formatBDT } from "@/lib/utils";
import {
  ServiceBillingPanel,
  billingFromJob,
  toBillingPayload,
  type ServiceBillingValue,
} from "@/components/service/ServiceBillingPanel";
import { VisitClock, type VisitTimes } from "@/components/service/VisitClock";
import { dateKeyFrom, todayKey } from "@/lib/service-visit";

type Option = {
  _id: string;
  name?: string;
  mobile?: string;
  address?: string;
  location?: string;
  city?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  customerId?: string;
  sellPrice?: number;
  sku?: string;
};

const JOB_KINDS = [
  ...TECHNICAL_JOB_TYPES,
  { value: "installation", label: "Installation" },
  { value: "general", label: "General service" },
];

const STATUSES = [
  { value: "pending", label: "Pending", labelBn: "পেন্ডিং" },
  { value: "reported", label: "Reported", labelBn: "রিপোর্টেড" },
  { value: "assigned", label: "Assigned", labelBn: "অ্যাসাইন্ড" },
  { value: "in_progress", label: "In progress", labelBn: "চলমান" },
  { value: "resolved", label: "Resolved", labelBn: "সমাধান" },
  { value: "completed", label: "Completed", labelBn: "সম্পন্ন" },
  { value: "delivered", label: "Delivered", labelBn: "ডেলিভারড" },
  { value: "closed", label: "Closed", labelBn: "ক্লোজড" },
  { value: "cancelled", label: "Cancelled", labelBn: "বাতিল" },
];

type JobDoc = {
  _id?: string;
  jobNo?: string;
  customerId?: string | { _id: string; name?: string; address?: string; location?: string; mobile?: string };
  machineId?: string | { _id: string; siteName?: string; siteLocation?: string; siteAddress?: string };
  technicianId?: string | { _id: string };
  technicianIds?: (string | { _id: string })[];
  complimentary?: boolean;
  jobKind?: string;
  equipmentType?: string;
  status?: string;
  priority?: string;
  issueDescription?: string;
  reportedBy?: string;
  resolution?: string;
  customerConfirmation?: string;
  notes?: string;
  visitCharge?: number;
  serviceCharges?: number;
  serviceLines?: ServiceBillingValue["serviceLines"];
  parts?: ServiceBillingValue["parts"];
  discount?: number;
  tax?: number;
  paidAmount?: number;
  scheduledDate?: string | Date;
  checkedInAt?: string | Date | null;
  checkedOutAt?: string | Date | null;
  durationMinutes?: number;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
};

function idOf(v: unknown) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "_id" in v) return String((v as { _id: string })._id);
  return "";
}

export function ServiceJobForm({ job, prefill }: { job?: JobDoc; prefill?: { technicianId?: string } }) {
  const router = useRouter();
  const locale = useLocale();
  const bn = locale === "bn";
  const [customers, setCustomers] = useState<Option[]>([]);
  const [machines, setMachines] = useState<Option[]>([]);
  const [technicians, setTechnicians] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [form, setForm] = useState({
    customerId: idOf(job?.customerId),
    machineId: idOf(job?.machineId),
    technicianId: idOf(job?.technicianId) || prefill?.technicianId || "",
    technicianIds: Array.isArray(job?.technicianIds)
      ? job.technicianIds.map(idOf).filter((id) => id && id !== idOf(job?.technicianId))
      : [],
    jobKind: job?.jobKind || "general",
    equipmentType: job?.equipmentType || "Lift",
    status: job?.status || "pending",
    priority: job?.priority || "medium",
    issueDescription: job?.issueDescription || "",
    reportedBy: job?.reportedBy || "",
    resolution: job?.resolution || "",
    customerConfirmation: job?.customerConfirmation || "",
    notes: job?.notes || "",
    scheduledDate: dateKeyFrom(job?.scheduledDate) || todayKey(),
    siteName: job?.siteName || (typeof job?.customerId === "object" ? job.customerId?.name || "" : ""),
    siteLocation: job?.siteLocation || (typeof job?.customerId === "object" ? job.customerId?.location || "" : ""),
    siteAddress: job?.siteAddress || (typeof job?.customerId === "object" ? job.customerId?.address || "" : ""),
  });
  const [visit, setVisit] = useState<VisitTimes>({
    checkedInAt: job?.checkedInAt,
    checkedOutAt: job?.checkedOutAt,
    durationMinutes: Number(job?.durationMinutes || 0),
  });
  const [billing, setBilling] = useState<ServiceBillingValue>(() =>
    job
      ? billingFromJob(job)
      : {
          visitCharge: defaultVisitCharge("general"),
          serviceLines: starterServiceLines("general"),
          parts: [],
          discount: 0,
          tax: 0,
          paidAmount: 0,
          locationId: "",
        },
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
      fetch("/api/products?limit=200").then((r) => r.json()),
      fetch("/api/meta").then((r) => r.json()),
    ]).then(([c, m, t, p, meta]) => {
      setCustomers(c.data || []);
      setMachines(m.data || m.items || []);
      setTechnicians(t.data || []);
      setProducts(p.data || []);
      const locs = meta.locations || [];
      setLocations(locs);
      if (locs[0] && !billing.locationId) {
        setBilling((prev) => ({ ...prev, locationId: prev.locationId || locs[0]._id }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const liveGaps = completionGaps({
    technicianId: form.technicianId,
    technicianIds: [form.technicianId, ...form.technicianIds].filter(Boolean),
    serviceLines: billing.serviceLines,
    parts: billing.parts,
    visitCharge: billing.visitCharge,
    resolution: form.resolution,
    customerConfirmation: form.customerConfirmation,
    checkedInAt: visit.checkedInAt,
  });

  function applyCustomer(customerId: string) {
    const row = customers.find((c) => c._id === customerId);
    setForm((f) => ({
      ...f,
      customerId,
      machineId: "",
      siteName: row?.name || f.siteName,
      siteLocation: row?.location || row?.city || f.siteLocation,
      siteAddress: row?.address || f.siteAddress,
    }));
  }

  function applyMachine(machineId: string) {
    const row = machines.find((m) => m._id === machineId);
    setForm((f) => ({
      ...f,
      machineId,
      siteName: row?.siteName || f.siteName,
      siteLocation: row?.siteLocation || f.siteLocation,
      siteAddress: row?.siteAddress || f.siteAddress,
    }));
  }

  function applyJobKind(jobKind: string) {
    setForm((f) => ({ ...f, jobKind }));
    if (!job?._id) {
      setBilling((prev) => ({
        ...prev,
        visitCharge: defaultVisitCharge(jobKind),
        serviceLines: starterServiceLines(jobKind),
      }));
    }
  }

  async function submit(status?: string) {
    setPending(true);
    setError("");
    setGaps([]);
    const nextStatus = status || form.status;
    const payload = {
      ...form,
      technicianIds: [form.technicianId, ...form.technicianIds].filter(Boolean),
      status: nextStatus,
      ...toBillingPayload(billing),
      billable: true,
    };
    try {
      const res = await fetch(job?._id ? `/api/services/${job._id}` : "/api/services", {
        method: job?._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Array.isArray(json.gaps)) setGaps(json.gaps);
        throw new Error(json.error || "failed");
      }
      const id = json.data?._id || job?._id;
      router.push(id ? `/services/${id}` : "/services");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  async function clock(action: "check_in" | "check_out") {
    if (!job?._id) return;
    setPending(true);
    setError("");
    setGaps([]);
    try {
      const res = await fetch(`/api/services/${job._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, technicianId: form.technicianId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Array.isArray(json.gaps)) setGaps(json.gaps);
        throw new Error(json.error || "failed");
      }
      if (json.data) {
        setVisit({
          checkedInAt: json.data.checkedInAt,
          checkedOutAt: json.data.checkedOutAt,
          durationMinutes: Number(json.data.durationMinutes || 0),
        });
        if (json.data.status) setForm((f) => ({ ...f, status: json.data.status }));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submit();
  }

  const totals = computeServiceTotals({
    serviceLines: billing.serviceLines,
    parts: billing.parts,
    visitCharge: billing.visitCharge,
    discount: billing.discount,
    tax: billing.tax,
    paidAmount: billing.paidAmount,
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <div className="space-y-4">
        <div className="gp-card space-y-4 p-5">
          <h2 className="text-lg font-bold">{job?._id ? (bn ? "জব এডিট" : "Edit job") : (bn ? "নতুন সার্ভিস জব" : "New service job")}</h2>
          {error ? (
            <p className="text-sm font-semibold text-danger">
              {error === "incomplete"
                ? (bn ? "সম্পন্ন করতে নিচের ধাপগুলো পূরণ করুন।" : "Fill the remaining steps before completing.")
                : error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "জব টাইপ" : "Job type"}</span>
              <select className="gp-input" value={form.jobKind} onChange={(e) => applyJobKind(e.target.value)}>
                {JOB_KINDS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "স্ট্যাটাস" : "Status"}</span>
              <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((row) => <option key={row.value} value={row.value}>{bn ? row.labelBn : row.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "গ্রাহক" : "Customer"}</span>
              <select required className="gp-input" value={form.customerId} onChange={(e) => applyCustomer(e.target.value)}>
                <option value="">{bn ? "গ্রাহক বেছে নিন" : "Select customer"}</option>
                {customers.map((row) => <option key={row._id} value={row._id}>{row.name}{row.mobile ? ` · ${row.mobile}` : ""}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "লিড টেকনিশিয়ান" : "Lead technician"}</span>
              <select
                className="gp-input"
                value={form.technicianId}
                onChange={(e) => {
                  const technicianId = e.target.value;
                  setForm({
                    ...form,
                    technicianId,
                    technicianIds: form.technicianIds.filter((id) => id !== technicianId),
                  });
                }}
              >
                <option value="">{bn ? "পরে অ্যাসাইন" : "Assign later"}</option>
                {technicians.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
              </select>
            </label>
            <div className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">{bn ? "আরও টেকনিশিয়ান (এক জবে একাধিক)" : "More technicians (crew)"}</span>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {technicians
                  .filter((row) => row._id !== form.technicianId)
                  .map((row) => {
                    const checked = form.technicianIds.includes(row._id);
                    return (
                      <label key={row._id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm({
                              ...form,
                              technicianIds: checked
                                ? form.technicianIds.filter((id) => id !== row._id)
                                : [...form.technicianIds, row._id],
                            })
                          }
                        />
                        {row.name}
                      </label>
                    );
                  })}
              </div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "ইকুইপমেন্ট" : "Equipment"}</span>
              <select className="gp-input" value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}>
                {EQUIPMENT_LINES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "প্রায়োরিটি" : "Priority"}</span>
              <select className="gp-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {TECHNICAL_PRIORITIES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">{bn ? "মেশিন" : "Machine"}</span>
              <select className="gp-input" value={form.machineId} onChange={(e) => applyMachine(e.target.value)}>
                <option value="">{bn ? "লিংক নেই" : "No unit linked"}</option>
                {unitMachines.map((row) => (
                  <option key={row._id} value={row._id}>
                    {[row.brand, row.model, row.serialNo].filter(Boolean).join(" · ") || row._id}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "ভিজিট তারিখ" : "Visit date"}</span>
              <input type="date" className="gp-input" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "কাস্টমার / বিল্ডিং" : "Customer / building"}</span>
              <input className="gp-input" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} placeholder={bn ? "যেমন: গুলশান হাইটস" : "e.g. Gulshan Heights"} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "লোকেশন / এলাকা" : "Location / area"}</span>
              <input className="gp-input" value={form.siteLocation} onChange={(e) => setForm({ ...form, siteLocation: e.target.value })} placeholder={bn ? "ধানমন্ডি, গুলশান, উত্তরা..." : "Dhanmondi, Gulshan, Uttara..."} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">{bn ? "কাস্টমারের ঠিকানা" : "Customer address"}</span>
              <textarea className="gp-input min-h-16" value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} placeholder={bn ? "বাড়ি, রোড, এলাকা, শহর" : "House, road, area, city"} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">{bn ? "সমস্যা / কাজের বিবরণ" : "Issue / work description"}</span>
              <textarea required className="gp-input min-h-24" value={form.issueDescription} onChange={(e) => setForm({ ...form, issueDescription: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted">{bn ? "সমাধান (কমপ্লিটের আগে দরকার)" : "Resolution (required to complete)"}</span>
              <textarea className="gp-input min-h-20" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "রিপোর্ট করেছেন" : "Reported by"}</span>
              <input className="gp-input" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">{bn ? "গ্রাহক কনফার্মেশন" : "Customer confirmation"}</span>
              <input className="gp-input" value={form.customerConfirmation} onChange={(e) => setForm({ ...form, customerConfirmation: e.target.value })} placeholder={bn ? "নাম / সাইন / ওকে" : "Name / sign / OK"} />
            </label>
          </div>
        </div>

        <div className="gp-card p-5">
          <h2 className="mb-4 text-lg font-bold">{bn ? "বিলিং — চার্জ, সার্ভিস ও পরিমাণ" : "Billing — charge, services & quantity"}</h2>
          <ServiceBillingPanel
            value={billing}
            onChange={setBilling}
            products={products}
            locations={locations}
            locale={locale}
          />
        </div>

        {job?._id ? (
          <VisitClock
            visit={visit}
            pending={pending}
            canCheckIn={Boolean(form.technicianId || form.technicianIds.length)}
            locale={locale}
            onCheckIn={() => void clock("check_in")}
            onCheckOut={() => void clock("check_out")}
          />
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="gp-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{bn ? "কমপ্লিট চেকলিস্ট" : "Complete checklist"}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { key: "technician", ok: Boolean(form.technicianId || form.technicianIds.length) },
              { key: "checkin", ok: Boolean(visit.checkedInAt) },
              { key: "billing", ok: !liveGaps.includes("billing") },
              { key: "resolution", ok: Boolean(form.resolution.trim()) },
              { key: "confirm", ok: Boolean(form.customerConfirmation.trim()) },
            ].map((row) => (
              <li key={row.key} className={row.ok ? "text-emerald-700" : "text-amber-800"}>
                {row.ok ? "✓" : "○"} {COMPLETION_GAP_LABELS[row.key]?.[bn ? "bn" : "en"]}
              </li>
            ))}
          </ul>
          {(gaps.length ? gaps : []).map((g) => (
            <p key={g} className="mt-2 text-sm font-semibold text-danger">{COMPLETION_GAP_LABELS[g]?.[bn ? "bn" : "en"]}</p>
          ))}
          <p className="mt-4 text-sm text-muted">
            {bn ? "গ্র্যান্ড টোটাল" : "Grand total"}: <b>{formatBDT(totals.grandTotal, locale)}</b>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : job?._id ? (bn ? "সেভ" : "Save") : (bn ? "জব তৈরি" : "Create job")}
            </button>
            {job?._id ? (
              <button
                type="button"
                disabled={pending || liveGaps.length > 0}
                className="gp-btn"
                onClick={() => void submit("completed")}
              >
                {bn ? "সম্পন্ন ও বিল" : "Complete & bill"}
              </button>
            ) : null}
          </div>
          {job?._id && liveGaps.length ? (
            <p className="mt-2 text-xs text-muted">{bn ? "কমপ্লিট বাটন চালু হবে সব ধাপ পূরণ হলে।" : "Complete unlocks when every step above is filled."}</p>
          ) : null}
        </div>
        {job?.jobNo ? (
          <div className="gp-card p-5 text-sm">
            <p className="font-bold">{job.jobNo}</p>
            <p className="mt-1 text-muted">{bn ? "ইনভয়েসে সার্ভিস লাইন ও পার্টস আলাদা দেখাবে।" : "Invoice lists service lines and parts separately."}</p>
          </div>
        ) : null}
      </aside>
    </form>
  );
}
