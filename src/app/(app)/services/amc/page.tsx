"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Plus,
  Wrench,
  Clock,
  ShieldCheck,
  Building2,
  PhoneCall,
  Edit3,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Package,
  Droplets,
  RotateCw,
  Ban,
  FileCheck,
  Zap,
} from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";

type Customer = {
  _id?: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  location?: string;
  city?: string;
  address?: string;
};

type MachineItem = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  nextServiceDue?: string;
  siteName?: string;
  siteAddress?: string;
  customerId?: string;
};

type Technician = {
  _id: string;
  name: string;
  mobile?: string;
  speciality?: string;
};

type Contract = {
  _id: string;
  contractNo?: string;
  status?: string;
  contractType?: "comprehensive" | "non_comprehensive" | "semi_comprehensive";
  billingFrequency?: "monthly" | "quarterly" | "half_yearly" | "yearly" | "one_time";
  amount?: number;
  advanceAmount?: number;
  dueAmount?: number;
  cycleDays?: number;
  visitsIncluded?: number;
  visitsUsed?: number;
  startDate?: string;
  endDate?: string;
  siteAddress?: string;
  buildingType?: "residential" | "commercial" | "hospital" | "industrial" | "mixed";
  contactPerson?: string;
  contactPhone?: string;
  emergencyResponseHours?: number;
  resolutionTargetHours?: number;
  serviceWindow?: string;
  partsIncluded?: "included" | "excluded" | "partial";
  consumablesIncluded?: "included" | "excluded";
  breakdownVisitsIncluded?: string;
  paymentTerms?: string;
  nextVisitDate?: string;
  visitTime?: string;
  autoRenew?: boolean;
  exclusions?: string;
  terminationTerms?: string;
  notes?: string;
  customerId?: Customer;
  machineId?: MachineItem;
  assignedTechnicianId?: Technician;
};

type Scope = "all" | "active" | "ending" | "expired" | "cancelled";

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AM";
}

function customerName(c?: Customer, bn?: boolean) {
  if (!c) return "—";
  return bn && c.nameBn ? c.nameBn : c.name || "—";
}

function machineLabel(m?: Contract["machineId"]) {
  if (!m) return "";
  return [m.brand, m.model, m.serialNo].filter(Boolean).join(" · ");
}

function safeDate(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysFromToday(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((startOfDay(d).getTime() - startOfDay().getTime()) / 86400000);
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function statusLabel(status: string | undefined, bn: boolean) {
  const map: Record<string, [string, string]> = {
    active: ["Active", "সক্রিয়"],
    expired: ["Expired", "মেয়াদ শেষ"],
    cancelled: ["Cancelled", "বাতিল"],
  };
  const row = map[String(status || "")];
  return row ? row[bn ? 1 : 0] : status || "—";
}

function contractTone(row: Contract) {
  if (row.status === "cancelled") return "is-info";
  const days = daysFromToday(row.endDate);
  if (row.status === "expired" || (days != null && days < 0)) return "is-danger";
  if (days != null && days <= 30) return "is-warn";
  return "is-ok";
}

function contractTypeLabel(type: string | undefined, bn: boolean) {
  switch (type) {
    case "comprehensive":
      return bn ? "কম্প্রিহেনসিভ (ফুল পার্টস সহ)" : "Comprehensive (Parts Incl.)";
    case "semi_comprehensive":
      return bn ? "সেমি-কম্প্রিহেনসিভ (আংশিক পার্টস)" : "Semi-Comprehensive";
    case "non_comprehensive":
    default:
      return bn ? "নন-কম্প্রিহেনসিভ (সার্ভিস অনলি)" : "Non-Comprehensive (Service Only)";
  }
}

function partsLabel(val: string | undefined, bn: boolean) {
  switch (val) {
    case "included":
      return bn ? "পার্টস অন্তর্ভুক্ত (Free)" : "Parts Included (Free)";
    case "partial":
      return bn ? "নির্দিষ্ট পার্টস অন্তর্ভুক্ত" : "Partial Parts Included";
    case "excluded":
    default:
      return bn ? "পার্টস আলাদা বিল (Excluded)" : "Parts Excluded (Chargeable)";
  }
}

function consumablesLabel(val: string | undefined, bn: boolean) {
  return val === "excluded"
    ? bn ? "লুব্রিকেন্ট/তৈল আলাদা" : "Consumables Excluded"
    : bn ? "লুব্রিকেন্ট/তৈল ফ্রি (Included)" : "Consumables Included";
}

function billingFrequencyLabel(freq: string | undefined, bn: boolean) {
  switch (freq) {
    case "monthly":
      return bn ? "মাসিক (Monthly)" : "Monthly";
    case "half_yearly":
      return bn ? "অর্ধ-বার্ষিক (Half-Yearly)" : "Half-Yearly";
    case "yearly":
      return bn ? "বার্ষিক (Yearly)" : "Yearly";
    case "one_time":
      return bn ? "এককালীন (One-Time)" : "One-Time";
    case "quarterly":
    default:
      return bn ? "ত্রৈমাসিক (Quarterly)" : "Quarterly";
  }
}

function buildingTypeLabel(type: string | undefined, bn: boolean) {
  switch (type) {
    case "commercial":
      return bn ? "বাণিজ্যিক ভবন" : "Commercial";
    case "hospital":
      return bn ? "হাসপাতাল" : "Hospital";
    case "industrial":
      return bn ? "শিল্প কারখানা" : "Industrial";
    case "mixed":
      return bn ? "মিশ্র ভবন" : "Mixed Use";
    case "residential":
    default:
      return bn ? "আবাসিক ভবন" : "Residential";
  }
}

const INITIAL_FORM = {
  _id: "",
  customerId: "",
  machineId: "",
  assignedTechnicianId: "",
  startDate: "",
  endDate: "",
  cycleDays: "90",
  amount: "",
  advanceAmount: "",
  dueAmount: "",
  visitsIncluded: "4",
  status: "active",
  contractType: "non_comprehensive",
  partsIncluded: "excluded",
  consumablesIncluded: "included",
  breakdownVisitsIncluded: "unlimited",
  emergencyResponseHours: "2",
  resolutionTargetHours: "6",
  serviceWindow: "24/7",
  billingFrequency: "quarterly",
  siteAddress: "",
  buildingType: "residential",
  contactPerson: "",
  contactPhone: "",
  paymentTerms: "কোয়ার্টার শুরুতে অগ্রিম প্রদান (Advance at quarter start)",
  nextVisitDate: "",
  visitTime: "",
  autoRenew: false,
  exclusions: "মেইন পাওয়ার ভোল্টেজ ফল্ট, মোটর রিউইন্ডিং, ক্যাবিনের ভাঙচুর, পানি বা আগুনজনিত ক্ষয়ক্ষতি অন্তর্ভুক্ত নয়।",
  terminationTerms: "যেকোনো পক্ষ ৩০ দিনের লিখিত নোটিশে চুক্তি বাতিল করতে পারবে (30 days prior written notice)।",
  notes: "",
};

export default function AmcContractsPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Contract[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, expired: 0, cancelled: 0, endingSoon: 0, billed: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search = q) => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "200" });
    if (search.trim()) qs.set("q", search.trim());
    try {
      const res = await fetch(`/api/amc?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setRows(Array.isArray(json.data) ? json.data : json.items || []);
      setSummary(json.summary || { total: 0, active: 0, expired: 0, cancelled: 0, endingSoon: 0, billed: 0 });
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "এএমসি লোড হয়নি।" : "Could not load AMC contracts.");
    } finally {
      setLoading(false);
    }
  }, [bn, q]);

  useEffect(() => {
    void load();
    void Promise.all([
      fetch("/api/contacts?type=customer&limit=200").then((r) => r.json()),
      fetch("/api/machines?limit=200").then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
    ]).then(([c, m, t]) => {
      setCustomers(c.data || []);
      setMachines(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m.data || []).map((row: any) => ({
          _id: String(row._id || ""),
          brand: row.brand,
          model: row.model,
          serialNo: row.serialNo,
          machineType: row.machineType,
          siteName: row.siteName,
          siteAddress: row.siteAddress,
          customerId:
            row.customerId && typeof row.customerId === "object"
              ? String(row.customerId._id || "")
              : typeof row.customerId === "string"
                ? row.customerId
                : undefined,
        })),
      );
      setTechnicians(t.data || []);
    });
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const machineOptions = form.customerId
    ? machines.filter((m) => !m.customerId || m.customerId === form.customerId)
    : machines;

  const handleCustomerChange = (cid: string) => {
    const cust = customers.find((c) => c._id === cid);
    const addr = [cust?.address, cust?.location, cust?.city].filter(Boolean).join(", ");
    setForm((prev) => ({
      ...prev,
      customerId: cid,
      machineId: "",
      siteAddress: addr || prev.siteAddress,
      contactPerson: prev.contactPerson || cust?.name || "",
      contactPhone: prev.contactPhone || cust?.mobile || "",
    }));
  };

  const handleMachineChange = (mid: string) => {
    const mach = machines.find((m) => m._id === mid);
    setForm((prev) => ({
      ...prev,
      machineId: mid,
      siteAddress: mach?.siteAddress || mach?.siteName || prev.siteAddress,
    }));
  };

  const startEdit = (row: Contract) => {
    setForm({
      _id: row._id,
      customerId: row.customerId?._id || "",
      machineId: row.machineId?._id || "",
      assignedTechnicianId: row.assignedTechnicianId?._id || "",
      startDate: row.startDate ? row.startDate.slice(0, 10) : "",
      endDate: row.endDate ? row.endDate.slice(0, 10) : "",
      cycleDays: String(row.cycleDays || 90),
      amount: row.amount != null ? String(row.amount) : "",
      advanceAmount: row.advanceAmount != null ? String(row.advanceAmount) : "",
      dueAmount: row.dueAmount != null ? String(row.dueAmount) : "",
      visitsIncluded: String(row.visitsIncluded || 4),
      status: row.status || "active",
      contractType: row.contractType || "non_comprehensive",
      partsIncluded: row.partsIncluded || (row.contractType === "comprehensive" ? "included" : "excluded"),
      consumablesIncluded: row.consumablesIncluded || "included",
      breakdownVisitsIncluded: row.breakdownVisitsIncluded || "unlimited",
      emergencyResponseHours: String(row.emergencyResponseHours || 2),
      resolutionTargetHours: String(row.resolutionTargetHours || 6),
      serviceWindow: row.serviceWindow || "24/7",
      billingFrequency: row.billingFrequency || "quarterly",
      siteAddress: row.siteAddress || "",
      buildingType: row.buildingType || "residential",
      contactPerson: row.contactPerson || "",
      contactPhone: row.contactPhone || "",
      paymentTerms: row.paymentTerms || "",
      nextVisitDate: row.nextVisitDate ? row.nextVisitDate.slice(0, 10) : "",
      visitTime: row.visitTime || "",
      autoRenew: Boolean(row.autoRenew),
      exclusions: row.exclusions || "",
      terminationTerms: row.terminationTerms || "",
      notes: row.notes || "",
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const days = daysFromToday(row.endDate);
      const ended = row.status === "expired" || (days != null && days < 0 && row.status !== "cancelled");
      const ending = row.status === "active" && days != null && days >= 0 && days <= 30;
      if (scope === "active") return row.status === "active" && !ended;
      if (scope === "ending") return ending;
      if (scope === "expired") return ended;
      if (scope === "cancelled") return row.status === "cancelled";
      return true;
    });
  }, [rows, scope]);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All", bn: "সব", n: summary.total || rows.length },
    { id: "active", en: "Active", bn: "সক্রিয়", n: summary.active },
    { id: "ending", en: "Ending 30d", bn: "৩০ দিনে শেষ", n: summary.endingSoon },
    { id: "expired", en: "Expired", bn: "মেয়াদ শেষ", n: summary.expired },
    { id: "cancelled", en: "Cancelled", bn: "বাতিল", n: summary.cancelled },
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError(bn ? "কাস্টমার বাছুন।" : "Pick a customer.");
      return;
    }
    setPending(true);
    setError("");

    const isEditing = Boolean(form._id);
    const url = isEditing ? `/api/amc/${form._id}` : "/api/amc";
    const method = isEditing ? "PUT" : "POST";

    const totalAmt = Number(form.amount || 0);
    const advAmt = Number(form.advanceAmount || 0);
    const dueAmt = form.dueAmount ? Number(form.dueAmount) : Math.max(0, totalAmt - advAmt);

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cycleDays: Number(form.cycleDays),
        amount: totalAmt,
        advanceAmount: advAmt,
        dueAmount: dueAmt,
        visitsIncluded: Number(form.visitsIncluded),
        emergencyResponseHours: Number(form.emergencyResponseHours || 2),
        resolutionTargetHours: Number(form.resolutionTargetHours || 6),
        autoRenew: Boolean(form.autoRenew),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(
        json.error === "missing_customer"
          ? bn
            ? "কাস্টমার বাছুন।"
            : "Pick a customer."
          : bn
            ? "সেভ হয়নি।"
            : "Could not save.",
      );
      return;
    }
    setOpen(false);
    setForm(INITIAL_FORM);
    await load();
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস অপারেশনস ও লিফট ম্যানেজমেন্ট" : "Elevator Service & Maintenance Desk"}
        title={bn ? "এএমসি চুক্তি ও কমপ্লিট স্পেসিফিকেশন" : "AMC Contracts & Complete Specification"}
        subtitle={
          bn
            ? "ক্লায়েন্ট তথ্য, লিফট সরঞ্জাম, এসএলএ, স্পেয়ার পার্টস, কনজিউমেবলস, ভিজিট শিডিউল ও পেমেন্ট চুক্তি।"
            : "Client info, equipment specs, SLA targets, spare parts, consumables, routine visits, and renewal terms."
        }
        stats={[
          { value: summary.active, label: bn ? "সক্রিয়" : "active" },
          { value: summary.endingSoon, label: bn ? "শেষ হচ্ছে" : "ending" },
          { value: moneyShort(summary.billed, locale), label: bn ? "মূল্য" : "value" },
          { value: summary.expired, label: bn ? "মেয়াদ শেষ" : "expired" },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => void load(value), 250);
              }}
              placeholder={bn ? "AMC / কাস্টমার / লিফট / এলাকা" : "AMC / customer / lift / area"}
            />
            <button
              type="button"
              className="gp-btn gp-btn-primary cursor-pointer"
              onClick={() => {
                if (open) {
                  setOpen(false);
                  setForm(INITIAL_FORM);
                } else {
                  setForm(INITIAL_FORM);
                  setOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4" />
              {bn ? (open ? "বন্ধ করুন" : "নতুন এএমসি চুক্তি") : open ? "Close" : "New AMC Contract"}
            </button>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={scope === pill.id ? "on" : ""}
              onClick={() => setScope(pill.id)}
            >
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/services/amc/dispatch" className="gp-btn gp-btn-ghost">
          {bn ? "অটো ডিসপ্যাচ বোর্ড" : "Auto Dispatch"}
        </Link>
        <Link href="/services/schedule" className="gp-btn gp-btn-ghost">
          {bn ? "রুটিন শিডিউল" : "Routine Schedule"}
        </Link>
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {open ? (
          <form onSubmit={onSubmit} className="eq-add-panel amc-new rounded-xl border border-white/10 bg-slate-900/80 p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <b className="text-[1.05rem] font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--gp-primary)]" />
                {form._id
                  ? bn
                    ? "এএমসি চুক্তি সম্পাদনা ও বিবরণ"
                    : "Edit AMC Contract Specification"
                  : bn
                    ? "নতুন এএমসি চুক্তি নিবন্ধন (পূর্ণাঙ্গ বিবরণ)"
                    : "New AMC Contract Registration (Full Specification)"}
              </b>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                onClick={() => {
                  setOpen(false);
                  setForm(INITIAL_FORM);
                }}
              >
                ✕ {bn ? "বন্ধ" : "Close"}
              </button>
            </div>

            <div className="eq-add-fields">
              {/* Section 1: Client Information & Equipment */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-1 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {bn ? "১. ক্লায়েন্ট ও সরঞ্জাম তথ্য (Client & Equipment)" : "1. Client Information & Equipment"}
              </div>

              <Field label={bn ? "ক্লায়েন্ট / কাস্টমার *" : "Client / Customer *"}>
                <select
                  required
                  className="gp-input font-medium"
                  value={form.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                >
                  <option value="">{bn ? "কাস্টমার বাছুন" : "Select Customer"}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.mobile ? `(${c.mobile})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={bn ? "লিফট সরঞ্জাম (Equipment) *" : "Lift Equipment *"}>
                <select
                  className="gp-input font-medium"
                  value={form.machineId}
                  onChange={(e) => handleMachineChange(e.target.value)}
                >
                  <option value="">{bn ? "ঐচ্ছিক বাছুন" : "Optional"}</option>
                  {machineOptions.map((m) => (
                    <option key={m._id} value={m._id}>
                      {[m.brand, m.model, m.serialNo, m.machineType].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={bn ? "সাইট / ভবনের পূর্ণ ঠিকানা" : "Site / Building Address"} className="span-2">
                <input
                  className="gp-input"
                  value={form.siteAddress}
                  placeholder={bn ? "বাড়ি নং, রোড নং, এলাকা (যেমন: প্লট ১২, বনানী, ঢাকা)" : "Building #, Road #, Area"}
                  onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                />
              </Field>

              <Field label={bn ? "কেয়ারটেকার / দায়িত্বপ্রাপ্ত ব্যক্তি" : "Contact Person / Caretaker"}>
                <input
                  className="gp-input"
                  value={form.contactPerson}
                  placeholder={bn ? "নাম" : "Name"}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </Field>

              <Field label={bn ? "যোগাযোগ মোবাইল নম্বর" : "Contact Mobile"}>
                <input
                  className="gp-input"
                  value={form.contactPhone}
                  placeholder="017xxxxxxxx"
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
              </Field>

              {/* Section 2: AMC Period & Type */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {bn ? "২. চুক্তির মেয়াদ ও ধরন (AMC Period & Type)" : "2. AMC Period & Type"}
              </div>

              <Field label={bn ? "এএমসি ধরন (AMC Type) *" : "AMC Type *"}>
                <select
                  className="gp-input font-bold text-[var(--gp-primary-light)]"
                  value={form.contractType}
                  onChange={(e) => {
                    const ct = e.target.value;
                    setForm({
                      ...form,
                      contractType: ct,
                      partsIncluded: ct === "comprehensive" ? "included" : "excluded",
                    });
                  }}
                >
                  <option value="non_comprehensive">
                    {bn ? "নন-কম্প্রিহেনসিভ (শুধুমাত্র সার্ভিস ও রক্ষণাবেক্ষণ)" : "Non-Comprehensive (Service Only)"}
                  </option>
                  <option value="comprehensive">
                    {bn ? "কম্প্রিহেনসিভ (ফুল পার্টস সহ কভারেজ)" : "Comprehensive (Parts Included)"}
                  </option>
                  <option value="semi_comprehensive">
                    {bn ? "সেমি-কম্প্রিহেনসিভ (আংশিক পার্টস সহ)" : "Semi-Comprehensive (Partial Parts)"}
                  </option>
                </select>
              </Field>

              <Field label={bn ? "ভবনের ধরন (Building Type)" : "Building Type"}>
                <select
                  className="gp-input"
                  value={form.buildingType}
                  onChange={(e) => setForm({ ...form, buildingType: e.target.value })}
                >
                  <option value="residential">{bn ? "আবাসিক ভবন (Residential)" : "Residential"}</option>
                  <option value="commercial">{bn ? "বাণিজ্যিক ভবন (Commercial)" : "Commercial"}</option>
                  <option value="hospital">{bn ? "হাসপাতাল (Hospital)" : "Hospital"}</option>
                  <option value="industrial">{bn ? "শিল্প কারখানা (Industrial)" : "Industrial"}</option>
                  <option value="mixed">{bn ? "মিশ্র ব্যবহার (Mixed Use)" : "Mixed Use"}</option>
                </select>
              </Field>

              <Field label={bn ? "শুরুর তারিখ (Start Date) *" : "Start Date *"}>
                <input
                  type="date"
                  className="gp-input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </Field>

              <Field label={bn ? "মেয়াদ শেষের তারিখ (End Date) *" : "End Date *"}>
                <input
                  type="date"
                  className="gp-input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </Field>

              {/* Section 3: Maintenance Schedule & Preventive Servicing */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {bn ? "৩. মেইনটেন্যান্স শিডিউল ও প্রতিরোধমূলক সার্ভিস (Maintenance Schedule & Preventive)" : "3. Maintenance Schedule & Preventive Service"}
              </div>

              <Field label={bn ? "রুটিন সার্ভিস চক্র (Frequency)" : "Maintenance Frequency"}>
                <select
                  className="gp-input"
                  value={form.cycleDays}
                  onChange={(e) => {
                    const days = e.target.value;
                    const defaultVisits = days === "30" ? "12" : days === "60" ? "6" : "4";
                    setForm({ ...form, cycleDays: days, visitsIncluded: defaultVisits });
                  }}
                >
                  <option value="30">{bn ? "মাসিক (Monthly - প্রতি ৩০ দিন)" : "Monthly (Every 30d)"}</option>
                  <option value="60">{bn ? "দ্বি-মাসিক (Bi-Monthly - প্রতি ৬০ দিন)" : "Bi-Monthly (Every 60d)"}</option>
                  <option value="90">{bn ? "ত্রৈমাসিক (Quarterly - প্রতি ৯০ দিন)" : "Quarterly (Every 90d)"}</option>
                  <option value="180">{bn ? "অর্ধ-বার্ষিক (Half-Yearly - ১৮০ দিন)" : "Half-Yearly (Every 180d)"}</option>
                </select>
              </Field>

              <Field label={bn ? "সর্বমোট ভিজিট কোটা (Preventive Visits)" : "Total Visits Quota"}>
                <input
                  type="number"
                  className="gp-input"
                  value={form.visitsIncluded}
                  placeholder="4"
                  onChange={(e) => setForm({ ...form, visitsIncluded: e.target.value })}
                />
              </Field>

              <Field label={bn ? "দায়িত্বপ্রাপ্ত টেকনিশিয়ান" : "Assigned Technician"}>
                <select
                  className="gp-input font-medium"
                  value={form.assignedTechnicianId}
                  onChange={(e) => setForm({ ...form, assignedTechnicianId: e.target.value })}
                >
                  <option value="">{bn ? "টেকনিশিয়ান নির্ধারণ করুন" : "Assign Technician"}</option>
                  {technicians.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} {t.mobile ? `(${t.mobile})` : ""} {t.speciality ? `· ${t.speciality}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={bn ? "পরবর্তী টেকনিশিয়ান ভিজিটের তারিখ" : "Next Visit Date"}>
                <input
                  type="date"
                  className="gp-input font-semibold"
                  value={form.nextVisitDate}
                  onChange={(e) => setForm({ ...form, nextVisitDate: e.target.value })}
                />
              </Field>

              <Field label={bn ? "ভিজিটের সময় / স্লট" : "Visit Time / Slot"}>
                <input
                  className="gp-input"
                  value={form.visitTime}
                  placeholder={bn ? "যেমন: সকাল ১০:৩০ বা ১০:০০ - ১২:০০" : "e.g. 10:30 AM or 10:00 - 12:00"}
                  onChange={(e) => setForm({ ...form, visitTime: e.target.value })}
                />
              </Field>

              <Field label={bn ? "চুক্তি স্ট্যাটাস" : "Contract Status"}>
                <select
                  className="gp-input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">{bn ? "সক্রিয় (Active)" : "Active"}</option>
                  <option value="expired">{bn ? "মেয়াদ শেষ (Expired)" : "Expired"}</option>
                  <option value="cancelled">{bn ? "বাতিল (Cancelled)" : "Cancelled"}</option>
                </select>
              </Field>

              {/* Section 4: Breakdown Service & SLA */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                {bn ? "৪. ব্রেকডাউন সার্ভিস ও এসএলএ (Breakdown Service & SLA)" : "4. Breakdown Service & SLA"}
              </div>

              <Field label={bn ? "ব্রেকডাউন ইমার্জেন্সি কল কোটা" : "Breakdown Calls Quota"}>
                <select
                  className="gp-input"
                  value={form.breakdownVisitsIncluded}
                  onChange={(e) => setForm({ ...form, breakdownVisitsIncluded: e.target.value })}
                >
                  <option value="unlimited">{bn ? "আনলিমিটেড ফ্রি ইমার্জেন্সি কল (Unlimited 24/7 Calls)" : "Unlimited Free Emergency Calls"}</option>
                  <option value="2_per_month">{bn ? "প্রতি মাসে সর্বোচ্চ ২টি ফ্রি কল" : "Max 2 Free Calls/Month"}</option>
                  <option value="chargeable">{bn ? "প্রতি কলের জন্য আলাদা চার্জ (Chargeable)" : "Chargeable per Call"}</option>
                </select>
              </Field>

              <Field label={bn ? "এসএলএ রেসপন্স সময় (Emergency SLA)" : "Response Time Target"}>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className="gp-input"
                  value={form.emergencyResponseHours}
                  placeholder="2"
                  onChange={(e) => setForm({ ...form, emergencyResponseHours: e.target.value })}
                />
              </Field>

              <Field label={bn ? "সমাধানের সময় টার্গেট (Resolution Target)" : "Resolution Target"}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="gp-input"
                  value={form.resolutionTargetHours}
                  placeholder="6"
                  onChange={(e) => setForm({ ...form, resolutionTargetHours: e.target.value })}
                />
              </Field>

              <Field label={bn ? "সার্ভিস উইন্ডো / সময়" : "Service Window"}>
                <input
                  className="gp-input"
                  value={form.serviceWindow}
                  placeholder="24/7 or 9am - 8pm"
                  onChange={(e) => setForm({ ...form, serviceWindow: e.target.value })}
                />
              </Field>

              {/* Section 5: Spare Parts & Consumables */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {bn ? "৫. স্পেয়ার পার্টস ও কনজিউমেবলস (Spare Parts & Consumables)" : "5. Spare Parts & Consumables"}
              </div>

              <Field label={bn ? "স্পেয়ার পার্টস (Spare Parts) *" : "Spare Parts *"}>
                <select
                  className="gp-input font-medium"
                  value={form.partsIncluded}
                  onChange={(e) => setForm({ ...form, partsIncluded: e.target.value })}
                >
                  <option value="excluded">{bn ? "পার্টস বহির্ভূত (Excluded - আলাদা বিল হবে)" : "Parts Excluded (Chargeable)"}</option>
                  <option value="included">{bn ? "পার্টস অন্তর্ভুক্ত (Included - বিনামূল্যে সরবরাহ)" : "Parts Included (Free Replacement)"}</option>
                  <option value="partial">{bn ? "নির্দিষ্ট মাইনর পার্টস অন্তর্ভুক্ত (Partial)" : "Partial Parts Included"}</option>
                </select>
              </Field>

              <Field label={bn ? "কনজিউমেবলস (Consumables - তৈল ও গ্রিজ) *" : "Consumables (Oil, Grease) *"}>
                <select
                  className="gp-input font-medium"
                  value={form.consumablesIncluded}
                  onChange={(e) => setForm({ ...form, consumablesIncluded: e.target.value })}
                >
                  <option value="included">{bn ? "তৈল, গ্রিজ ও লুব্রিকেন্ট অন্তর্ভুক্ত (Included)" : "Consumables Included (Free)"}</option>
                  <option value="excluded">{bn ? "কনজিউমেবলস ক্লায়েন্ট প্রদান করবে (Excluded)" : "Consumables Excluded"}</option>
                </select>
              </Field>

              {/* Section 6: Price, Payment & Renewal */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5" />
                {bn ? "৬. মূল্য, পেমেন্ট ও নবায়ন (Price, Payment & Renewal)" : "6. Price, Payment & Renewal"}
              </div>

              <Field label={bn ? "চুক্তির মোট মূল্য (৳) *" : "Total AMC Price (BDT) *"}>
                <input
                  type="number"
                  className="gp-input font-bold"
                  value={form.amount}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>

              <Field label={bn ? "বিলিং সাইকেল" : "Billing Cycle"}>
                <select
                  className="gp-input"
                  value={form.billingFrequency}
                  onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}
                >
                  <option value="quarterly">{bn ? "ত্রৈমাসিক (Quarterly)" : "Quarterly"}</option>
                  <option value="monthly">{bn ? "মাসিক (Monthly)" : "Monthly"}</option>
                  <option value="half_yearly">{bn ? "অর্ধ-বার্ষিক (Half-Yearly)" : "Half-Yearly"}</option>
                  <option value="yearly">{bn ? "বার্ষিক (Yearly)" : "Yearly"}</option>
                  <option value="one_time">{bn ? "এককালীন (One-Time)" : "One-Time"}</option>
                </select>
              </Field>

              <Field label={bn ? "অগ্রিম পরিশোধিত টাকা (৳)" : "Advance Paid (BDT)"}>
                <input
                  type="number"
                  className="gp-input"
                  value={form.advanceAmount}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
                />
              </Field>

              <Field label={bn ? "বকেয়া টাকা (৳)" : "Due Amount (BDT)"}>
                <input
                  type="number"
                  className="gp-input"
                  value={form.dueAmount}
                  placeholder={
                    form.amount && form.advanceAmount
                      ? String(Math.max(0, Number(form.amount) - Number(form.advanceAmount)))
                      : "0"
                  }
                  onChange={(e) => setForm({ ...form, dueAmount: e.target.value })}
                />
              </Field>

              <Field label={bn ? "পেমেন্ট শর্তাবলী (Payment Terms)" : "Payment Terms"} className="span-2">
                <input
                  className="gp-input"
                  value={form.paymentTerms}
                  placeholder={bn ? "যেমন: কোয়ার্টার শুরুতে অগ্রিম প্রদান, একাউন্ট পেয়ী চেক" : "e.g. Advance at start of quarter, cheque"}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                />
              </Field>

              <div className="span-2 flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="autoRenewCheck"
                  checked={form.autoRenew}
                  onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
                  className="h-4 w-4 rounded accent-[var(--gp-primary)]"
                />
                <label htmlFor="autoRenewCheck" className="text-xs text-slate-200 font-medium cursor-pointer">
                  {bn ? "মেয়াদান্তে স্বয়ংক্রিয় নবায়ন (Auto Renewal before Expiry)" : "Auto-renewal before expiry"}
                </label>
              </div>

              {/* Section 7: Exclusions & Termination */}
              <div className="span-2 text-xs font-bold text-[var(--gp-primary-light)] uppercase tracking-wider mt-3 border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                {bn ? "৭. বহির্ভূত কাজ ও বাতিল শর্ত (Exclusions & Termination)" : "7. Exclusions & Termination"}
              </div>

              <Field label={bn ? "চুক্তির বহির্ভূত কাজ / পার্টস (Exclusions)" : "Exclusions"} className="span-2">
                <textarea
                  rows={2}
                  className="gp-input h-auto py-2 text-xs"
                  value={form.exclusions}
                  placeholder={bn ? "কোন কোন কাজ বা পার্টস AMC এর বাইরে থাকবে..." : "Works and parts outside AMC scope..."}
                  onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
                />
              </Field>

              <Field label={bn ? "চুক্তি বাতিলের শর্তাবলী (Termination Conditions)" : "Termination Conditions"} className="span-2">
                <input
                  className="gp-input text-xs"
                  value={form.terminationTerms}
                  placeholder={bn ? "যেমন: ৩০ দিনের লিখিত নোটিশে চুক্তি বাতিলযোগ্য" : "e.g. 30 days written notice"}
                  onChange={(e) => setForm({ ...form, terminationTerms: e.target.value })}
                />
              </Field>

              <Field label={bn ? "সাধারণ নোট ও বিবরণ" : "General Notes"} className="span-2">
                <textarea
                  rows={2}
                  className="gp-input h-auto py-2 text-xs"
                  value={form.notes}
                  placeholder={bn ? "অন্যান্য প্রয়োজনীয় নির্দেশিকা..." : "Other notes..."}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>

              <div className="span-2 amc-new-actions pt-3 flex items-center gap-2 border-t border-white/10 mt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="gp-btn gp-btn-primary cursor-pointer px-6 font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {pending
                    ? bn
                      ? "সংরক্ষণ হচ্ছে..."
                      : "Saving..."
                    : form._id
                      ? bn
                        ? "চুক্তি আপডেট করুন"
                        : "Update Contract"
                      : bn
                        ? "এএমসি চুক্তি সম্পন্ন করুন"
                        : "Save AMC Contract"}
                </button>
                <button
                  type="button"
                  className="gp-btn cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    setForm(INITIAL_FORM);
                  }}
                >
                  {bn ? "বাতিল" : "Cancel"}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "এএমসি চুক্তি নেই" : "No AMC contracts"}
            message={bn ? "নতুন চুক্তি যোগ করুন, অথবা ফিল্টার সরান।" : "Add a contract, or clear the filters."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((row) => {
            const used = Number(row.visitsUsed || 0);
            const included = Number(row.visitsIncluded || 0);
            const pct = included ? Math.min(100, Math.round((used / included) * 100)) : 0;
            const unit = machineLabel(row.machineId);
            const days = daysFromToday(row.endDate);
            const site = row.siteAddress || [row.customerId?.location, row.customerId?.city].filter(Boolean).join(" · ");
            const isExpanded = expandedId === row._id;

            return (
              <article key={row._id} className={`fu-card ${contractTone(row)} transition-all duration-200 border-l-4`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(customerName(row.customerId, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm font-bold text-white">{row.contractNo || "—"}</strong>
                      <span className={`fu-chip ${contractTone(row)} text-xs`}>
                        {statusLabel(row.status, bn)}
                      </span>
                      {row.contractType && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[0.72rem] font-semibold text-indigo-300 border border-indigo-500/30">
                          <ShieldCheck className="h-3 w-3 text-indigo-400" />
                          {contractTypeLabel(row.contractType, bn)}
                        </span>
                      )}
                      {row.partsIncluded && (
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[0.72rem] font-medium border ${row.partsIncluded === "included" ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                          <Package className="h-3 w-3" />
                          {row.partsIncluded === "included" ? (bn ? "পার্টস ফ্রি" : "Parts Free") : (bn ? "পার্টস আলাদা" : "Parts Excl.")}
                        </span>
                      )}
                      {row.autoRenew && (
                        <span className="inline-flex items-center gap-1 rounded bg-teal-950/40 px-2 py-0.5 text-[0.72rem] font-medium text-teal-300 border border-teal-500/30">
                          <RotateCw className="h-3 w-3" />
                          {bn ? "অটো নবায়ন" : "Auto-Renew"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {row.customerId?._id ? (
                        <Link href={`/contacts/${row.customerId._id}/statement`} className="font-semibold text-white hover:underline">
                          {customerName(row.customerId, bn)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-white">{customerName(row.customerId, bn)}</span>
                      )}
                      {row.customerId?.mobile ? (
                        <a href={`tel:${row.customerId.mobile}`} className="text-slate-400 hover:text-white ml-2 inline-flex items-center gap-1">
                          <PhoneCall className="h-3 w-3 text-emerald-400" />
                          {row.customerId.mobile}
                        </a>
                      ) : null}
                      {row.buildingType && (
                        <span className="ml-2 text-slate-400">· {buildingTypeLabel(row.buildingType, bn)}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <b className="qt-amt text-base">{moneyShort(Number(row.amount || 0), locale)}</b>
                    {row.dueAmount != null && Number(row.dueAmount) > 0 ? (
                      <p className="text-[0.72rem] text-rose-400 font-semibold">
                        {bn ? `বকেয়া: ${moneyShort(Number(row.dueAmount), locale)}` : `Due: ${moneyShort(Number(row.dueAmount), locale)}`}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Assigned Technician & Visit Schedule Banner */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 my-1.5 text-xs text-slate-300">
                  {unit ? (
                    <span className="inline-flex items-center gap-1 text-[var(--gp-primary-light)] font-medium">
                      <Wrench className="h-3.5 w-3.5" />
                      {row.machineId?._id ? (
                        <Link href={`/services/machines/${row.machineId._id}`} className="hover:underline">
                          {unit}
                        </Link>
                      ) : (
                        unit
                      )}
                    </span>
                  ) : null}

                  {row.assignedTechnicianId ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold bg-amber-950/40 px-2.5 py-0.5 rounded-md border border-amber-600/30">
                      <Wrench className="h-3.5 w-3.5 text-amber-400" />
                      {bn ? "টেকনিশিয়ান:" : "Tech:"} {row.assignedTechnicianId.name}
                      {row.assignedTechnicianId.mobile ? (
                        <a href={`tel:${row.assignedTechnicianId.mobile}`} className="hover:text-white underline ml-0.5">
                          ({row.assignedTechnicianId.mobile})
                        </a>
                      ) : null}
                    </span>
                  ) : null}

                  {row.nextVisitDate ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold bg-emerald-950/50 px-2.5 py-0.5 rounded-md border border-emerald-500/40">
                      <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                      {bn ? "ভিজিট তারিখ:" : "Visit Date:"} {safeDate(row.nextVisitDate, locale)}
                      {row.visitTime ? (
                        <span className="text-white ml-1 inline-flex items-center gap-1 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded text-[0.72rem]">
                          <Clock className="h-3 w-3 text-emerald-300" />
                          {row.visitTime}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded text-[0.72rem]">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      {bn ? "ভিজিট শিডিউল নেই" : "No visit set"}
                    </span>
                  )}

                  {row.emergencyResponseHours ? (
                    <span className="inline-flex items-center gap-1 text-sky-300 font-medium bg-sky-950/30 px-2 py-0.5 rounded border border-sky-600/30">
                      <Clock className="h-3 w-3" />
                      SLA: {row.emergencyResponseHours}h ({row.serviceWindow || "24/7"})
                    </span>
                  ) : null}
                </div>

                {site ? (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                    <span className="truncate">{site}</span>
                  </p>
                ) : null}

                {/* Visit Quota Progress Bar */}
                <div className="inst-progress my-1.5">
                  <span className="inst-bar" style={{ ["--pct" as string]: `${pct}%` }}>
                    <i />
                  </span>
                  <em>{bn ? `রুটিন ভিজিট সম্পন্ন: ${used}/${included || 0}` : `Preventive Visits: ${used}/${included || 0}`}</em>
                </div>

                {/* Comprehensive Expandable Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/90 p-3.5 text-xs space-y-3 text-slate-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 border-b border-white/5">
                      {/* Box 1: Coverage & Parts */}
                      <div className="rounded bg-white/[0.03] p-2.5 border border-white/5 space-y-1">
                        <span className="text-[var(--gp-primary-light)] font-bold flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {bn ? "স্পেয়ার পার্টস ও কনজিউমেবলস:" : "Spare Parts & Consumables:"}
                        </span>
                        <p className="text-slate-200">
                          <strong>{bn ? "স্পেয়ার পার্টস: " : "Spare Parts: "}</strong>
                          {partsLabel(row.partsIncluded, bn)}
                        </p>
                        <p className="text-slate-200">
                          <strong>{bn ? "কনজিউমেবলস: " : "Consumables: "}</strong>
                          {consumablesLabel(row.consumablesIncluded, bn)}
                        </p>
                      </div>

                      {/* Box 2: SLA & Breakdown */}
                      <div className="rounded bg-white/[0.03] p-2.5 border border-white/5 space-y-1">
                        <span className="text-sky-300 font-bold flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5" />
                          {bn ? "এসএলএ ও ব্রেকডাউন সার্ভিস:" : "SLA & Breakdown Service:"}
                        </span>
                        <p className="text-slate-200">
                          <strong>{bn ? "রেসপন্স টার্গেট: " : "Response SLA: "}</strong>
                          {row.emergencyResponseHours || 2} {bn ? "ঘণ্টা" : "hours"} ·{" "}
                          <strong>{bn ? "সমাধান: " : "Resolution: "}</strong>
                          {row.resolutionTargetHours || 6} {bn ? "ঘণ্টা" : "hours"}
                        </p>
                        <p className="text-slate-200">
                          <strong>{bn ? "ব্রেকডাউন কল কোটা: " : "Breakdown Calls: "}</strong>
                          {row.breakdownVisitsIncluded === "unlimited"
                            ? bn ? "আনলিমিটেড ফ্রি কল" : "Unlimited Free Calls"
                            : row.breakdownVisitsIncluded || "Standard"}
                        </p>
                      </div>

                      {/* Box 3: Schedule & Routine Visits */}
                      <div className="rounded bg-white/[0.03] p-2.5 border border-white/5 space-y-1">
                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {bn ? "মেইনটেন্যান্স শিডিউল ও ভিজিট:" : "Maintenance Schedule & Visits:"}
                        </span>
                        <p className="text-slate-200">
                          <strong>{bn ? "সার্ভিস সাইকেল: " : "Cycle: "}</strong>
                          {row.cycleDays || 90} {bn ? "দিন পর পর" : "days"} (
                          {billingFrequencyLabel(row.billingFrequency, bn)})
                        </p>
                        <p className="text-slate-200">
                          <strong>{bn ? "নির্ধারিত ভিজিট: " : "Scheduled: "}</strong>
                          {row.nextVisitDate ? `${safeDate(row.nextVisitDate, locale)} (${row.visitTime || "সময় নির্ধারিত নেই"})` : "—"}
                        </p>
                      </div>

                      {/* Box 4: Financials & Payment */}
                      <div className="rounded bg-white/[0.03] p-2.5 border border-white/5 space-y-1">
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <FileCheck className="h-3.5 w-3.5" />
                          {bn ? "মূল্য ও পেমেন্ট শর্ত:" : "AMC Price & Payment:"}
                        </span>
                        <p className="text-slate-200">
                          <strong>{bn ? "মোট মূল্য: " : "Total: "}</strong>
                          {moneyShort(Number(row.amount || 0), locale)} ·{" "}
                          <strong>{bn ? "অগ্রিম: " : "Advance: "}</strong>
                          {moneyShort(Number(row.advanceAmount || 0), locale)} ·{" "}
                          <strong>{bn ? "বকেয়া: " : "Due: "}</strong>
                          {moneyShort(Number(row.dueAmount || 0), locale)}
                        </p>
                        <p className="text-slate-200">
                          <strong>{bn ? "শর্ত: " : "Terms: "}</strong>
                          {row.paymentTerms || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Exclusions & Termination Details */}
                    {row.exclusions || row.terminationTerms || row.notes ? (
                      <div className="space-y-1.5 pt-1 text-slate-300">
                        {row.exclusions ? (
                          <div>
                            <span className="text-rose-400 font-semibold block flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              {bn ? "চুক্তির বহির্ভূত কাজ ও পার্টস (Exclusions):" : "Exclusions:"}
                            </span>
                            <p className="text-slate-300 bg-rose-950/20 p-2 rounded border border-rose-500/20">{row.exclusions}</p>
                          </div>
                        ) : null}

                        {row.terminationTerms ? (
                          <div>
                            <span className="text-amber-400 font-semibold block">
                              {bn ? "চুক্তি বাতিলের শর্ত (Termination):" : "Termination Terms:"}
                            </span>
                            <p className="text-slate-300 bg-white/5 p-2 rounded">{row.terminationTerms}</p>
                          </div>
                        ) : null}

                        {row.notes ? (
                          <div>
                            <span className="text-slate-400 font-semibold block">{bn ? "সাধারণ নোট:" : "Notes:"}</span>
                            <p className="text-slate-300 bg-white/5 p-2 rounded">{row.notes}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Quick Action Links inside Details */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/services/history?customerId=${row.customerId?._id || ""}`}
                        className="gp-btn gp-btn-ghost text-xs py-1 px-2.5 inline-flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5 text-sky-400" />
                        {bn ? "সার্ভিস হিস্ট্রি ও রিপোর্ট" : "Service History & Reports"}
                      </Link>

                      {row.machineId?._id ? (
                        <Link
                          href={`/services/machines/${row.machineId._id}`}
                          className="gp-btn gp-btn-ghost text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        >
                          <Building2 className="h-3.5 w-3.5 text-amber-400" />
                          {bn ? "লিফট মেশিন বিবরণ" : "Lift Machine Profile"}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="fu-card-foot mt-2 flex-wrap gap-2">
                  <p className="fu-meta min-w-0 flex-1">
                    {`${row.cycleDays || 90} ${bn ? "দিন চক্র" : "d cycle"}`}
                    {` · ${safeDate(row.startDate, locale)} → ${safeDate(row.endDate, locale)}`}
                    {days != null && days >= 0 && row.status === "active"
                      ? bn
                        ? ` · ${days} দিন বাকি`
                        : ` · ${days}d left`
                      : ""}
                    {days != null && days < 0 && row.status !== "cancelled"
                      ? bn
                        ? ` · ${Math.abs(days)} দিন পেরিয়েছে`
                        : ` · ${Math.abs(days)}d past`
                      : ""}
                  </p>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      className="fld-act cursor-pointer inline-flex items-center gap-1 text-[0.75rem]"
                      onClick={() => setExpandedId(isExpanded ? null : row._id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          {bn ? "সংক্ষেপ" : "Less"}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          {bn ? "বিস্তারিত চুক্তি" : "Full Specs"}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="fld-act cursor-pointer inline-flex items-center gap-1 text-[0.75rem] text-sky-400 hover:text-sky-300"
                      onClick={() => startEdit(row)}
                      title={bn ? "চুক্তি সম্পাদনা" : "Edit Contract"}
                    >
                      <Edit3 className="h-3 w-3" />
                      {bn ? "এডিট" : "Edit"}
                    </button>

                    {row.machineId?._id ? (
                      <Link className="fld-act" href={`/services/machines/${row.machineId._id}`}>
                        {bn ? "ইউনিট" : "Unit"}
                      </Link>
                    ) : null}

                    <Link
                      className="fld-act text-emerald-400 font-semibold"
                      href={`/services/new${row.customerId?._id ? `?customerId=${row.customerId._id}` : ""}${row.machineId?._id ? `&machineId=${row.machineId._id}` : ""}${row.assignedTechnicianId?._id ? `&technicianId=${row.assignedTechnicianId._id}` : ""}${row.nextVisitDate ? `&scheduledDate=${row.nextVisitDate.slice(0, 10)}` : ""}`}
                    >
                      {bn ? "ভিজিট" : "Visit"}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
