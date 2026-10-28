"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Crosshair, Plus } from "lucide-react";
import { Field, PageHeader } from "@/components/ui";
import { EQUIPMENT_LINES } from "@/lib/technical-checklists";

type Customer = {
  _id: string;
  name?: string;
  nameBn?: string;
  mobile?: string;
  location?: string;
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

const TYPE_BN: Record<string, string> = {
  Lift: "লিফট",
  Escalator: "এস্কলেটর",
  Generator: "জেনারেটর",
  SubStation: "সাবস্টেশন",
  VoltageStabilizer: "স্টেবিলাইজার",
  ARD: "ARD",
};

const emptyForm = {
  customerId: "",
  brand: "Sigma",
  model: "",
  serialNo: "",
  machineType: "Lift",
  siteName: "",
  siteLocation: "",
  siteAddress: "",
  nextServiceDue: "",
  warrantyExpiryDate: "",
  commissionedAt: "",
  purchaseDate: "",
  notes: "",
  lat: "",
  lng: "",
};

function typeLabel(value: string, bn: boolean) {
  if (bn && TYPE_BN[value]) return TYPE_BN[value];
  return EQUIPMENT_LINES.find((l) => l.value === value)?.label || value;
}

function customerLabel(c: Customer, bn: boolean) {
  const name = bn && c.nameBn ? c.nameBn : c.name || "—";
  return c.mobile ? `${name} · ${c.mobile}` : name;
}

export default function AddEquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const bn = locale === "bn";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custQ, setCustQ] = useState("");
  const [pending, setPending] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const preset = searchParams.get("customerId") || "";
    void fetch("/api/contacts?type=customer&limit=200")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []) as Customer[];
        setCustomers(list);
        if (preset && list.some((c) => c._id === preset)) {
          applyCustomer(preset, list, true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = custQ.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.nameBn, c.mobile, c.location, c.city].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [customers, custQ]);

  const selected = customers.find((c) => c._id === form.customerId);
  const typeMeta = EQUIPMENT_LINES.find((l) => l.value === form.machineType);

  function patch(next: Partial<typeof emptyForm>) {
    setForm((f) => ({ ...f, ...next }));
  }

  function applyCustomer(id: string, list = customers, forceSite = false) {
    const c = list.find((row) => row._id === id);
    setForm((f) => ({
      ...f,
      customerId: id,
      siteName: forceSite || !f.siteName ? (c?.name || f.siteName) : f.siteName,
      siteLocation: forceSite || !f.siteLocation ? (c?.location || c?.city || f.siteLocation) : f.siteLocation,
      siteAddress: forceSite || !f.siteAddress ? (c?.address || f.siteAddress) : f.siteAddress,
      lat: forceSite || !f.lat ? (c?.lat != null ? String(c.lat) : f.lat) : f.lat,
      lng: forceSite || !f.lng ? (c?.lng != null ? String(c.lng) : f.lng) : f.lng,
    }));
  }

  function pinGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(bn ? "জিপিএস পাওয়া যায়নি।" : "GPS is not available.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setGeoBusy(false);
      },
      () => {
        setError(bn ? "লোকেশন নেওয়া যায়নি।" : "Could not read location.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError(bn ? "কাস্টমার বাছুন।" : "Pick a customer.");
      return;
    }
    setPending(true);
    setError("");
    const res = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      const code = String(json.error || "failed");
      setError(
        code === "missing_customer"
          ? bn ? "কাস্টমার বাছুন।" : "Pick a customer."
          : code === "duplicate_serial"
            ? bn ? "এই সিরিয়াল আগে থেকে আছে।" : "That serial number already exists."
            : bn ? "সেভ হয়নি।" : "Could not save.",
      );
      return;
    }
    router.push(`/services/machines/${json.data._id}`);
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "ইকুইপমেন্ট যোগ" : "Add equipment"}
        subtitle={bn
          ? "কাস্টমার, ইউনিট ও সাইট এক স্ক্রিনে — সেভ করলে ডিটেইলস খুলবে।"
          : "Customer, unit and site on one screen — save opens the details."}
        stats={[
          { value: typeLabel(form.machineType, bn), label: bn ? "ধরন" : "type" },
          { value: selected ? (bn && selected.nameBn ? selected.nameBn : selected.name || "—") : "—", label: bn ? "কাস্টমার" : "customer" },
          { value: form.nextServiceDue || "—", label: bn ? "ডিউ" : "next due" },
        ]}
        actions={
          <>
            <Link href="/services/machines" className="gp-btn">{bn ? "তালিকা" : "List"}</Link>
            <button type="submit" form="eq-add-form" disabled={pending} className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </>
        }
      />

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <form id="eq-add-form" onSubmit={onSubmit} className="quote-board eq-add">
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
                  onChange={(e) => applyCustomer(e.target.value)}
                >
                  <option value="">{bn ? "বাছুন" : "Select"}</option>
                  {filtered.map((c) => (
                    <option key={c._id} value={c._id}>{customerLabel(c, bn)}</option>
                  ))}
                </select>
              </Field>
              <div className="span-2 fu-views eq-add-types">
                {EQUIPMENT_LINES.map((line) => (
                  <button
                    key={line.value}
                    type="button"
                    className={form.machineType === line.value ? "on" : ""}
                    onClick={() => patch({ machineType: line.value })}
                  >
                    {typeLabel(line.value, bn)}
                  </button>
                ))}
              </div>
              {typeMeta ? <p className="eq-add-hint span-2">{typeMeta.summary}</p> : null}
              <Field label={bn ? "ব্র্যান্ড" : "Brand"}>
                <input required className="gp-input" value={form.brand} onChange={(e) => patch({ brand: e.target.value })} />
              </Field>
              <Field label={bn ? "মডেল" : "Model"}>
                <input required className="gp-input" value={form.model} onChange={(e) => patch({ model: e.target.value })} />
              </Field>
              <Field label={bn ? "সিরিয়াল" : "Serial"}>
                <input className="gp-input" value={form.serialNo} onChange={(e) => patch({ serialNo: e.target.value })} />
              </Field>
              <Field label={bn ? "কেনার তারিখ" : "Purchase date"}>
                <input type="date" className="gp-input" value={form.purchaseDate} onChange={(e) => patch({ purchaseDate: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="eq-add-panel">
            <b>{bn ? "সাইট ও সার্ভিস" : "Site & service"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "সাইট" : "Site"}>
                <input className="gp-input" value={form.siteName} onChange={(e) => patch({ siteName: e.target.value })} />
              </Field>
              <Field label={bn ? "লোকেশন" : "Location"}>
                <input className="gp-input" value={form.siteLocation} onChange={(e) => patch({ siteLocation: e.target.value })} />
              </Field>
              <Field label={bn ? "ঠিকানা" : "Address"} className="span-2">
                <input className="gp-input" value={form.siteAddress} onChange={(e) => patch({ siteAddress: e.target.value })} />
              </Field>
              <Field label="Lat">
                <input className="gp-input" value={form.lat} onChange={(e) => patch({ lat: e.target.value })} inputMode="decimal" />
              </Field>
              <Field label="Long">
                <div className="eq-add-gps">
                  <input className="gp-input" value={form.lng} onChange={(e) => patch({ lng: e.target.value })} inputMode="decimal" />
                  <button type="button" className="gp-btn" onClick={pinGps} disabled={geoBusy}>
                    <Crosshair className="h-4 w-4" />
                    {geoBusy ? "..." : bn ? "এখনকার" : "Here"}
                  </button>
                </div>
              </Field>
              <Field label={bn ? "পরবর্তী সার্ভিস" : "Next service"}>
                <input type="date" className="gp-input" value={form.nextServiceDue} onChange={(e) => patch({ nextServiceDue: e.target.value })} />
              </Field>
              <Field label={bn ? "ওয়ারেন্টি" : "Warranty"}>
                <input type="date" className="gp-input" value={form.warrantyExpiryDate} onChange={(e) => patch({ warrantyExpiryDate: e.target.value })} />
              </Field>
              <Field label={bn ? "কমিশন" : "Commissioned"}>
                <input type="date" className="gp-input" value={form.commissionedAt} onChange={(e) => patch({ commissionedAt: e.target.value })} />
              </Field>
              <Field label={bn ? "নোট" : "Notes"} className="span-2">
                <textarea className="gp-input eq-add-notes" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
              </Field>
            </div>
          </section>
        </div>

        <article className="fu-card eq-add-preview is-info">
          <div className="fu-card-top">
            <span className="fu-avatar">EQ</span>
            <div className="min-w-0 flex-1">
              <strong>{[form.brand, form.model, form.serialNo].filter(Boolean).join(" · ") || (bn ? "নতুন ইউনিট" : "New unit")}</strong>
              <p>
                {selected ? customerLabel(selected, bn) : bn ? "কাস্টমার বাছুন" : "Pick a customer"}
                {form.siteName || form.siteLocation ? ` · ${[form.siteName, form.siteLocation].filter(Boolean).join(" · ")}` : ""}
              </p>
            </div>
            <span className="fu-chip is-info">{typeLabel(form.machineType, bn)}</span>
          </div>
          <p className="fu-meta">
            {bn ? "ডিউ " : "Due "}
            {form.nextServiceDue || "—"}
            {form.warrantyExpiryDate ? ` · ${bn ? "ওয়ারেন্টি" : "warranty"} ${form.warrantyExpiryDate}` : ""}
            {form.lat && form.lng ? ` · ${form.lat}, ${form.lng}` : ""}
          </p>
          <div className="fu-card-foot eq-foot">
            <p className="fu-meta">{bn ? "সেভ করলে ইউনিট খুলবে।" : "Save opens this unit."}</p>
            <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">
              {pending ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
            </button>
          </div>
        </article>
      </form>
    </div>
  );
}
