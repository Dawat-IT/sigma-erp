"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Copy,
  Crosshair,
  ExternalLink,
  Hash,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  UserRound,
  Wrench,
} from "lucide-react";
import { AlertBanner } from "@/components/ui";
import { FieldJobNav } from "@/components/service/FieldJobNav";
import { fetchJson } from "@/lib/fetch-json";
import { writeStoredJob } from "@/lib/field-job";
import { parseLatLng, waLink, type GeoPin } from "@/lib/service-visit";

type Ref = { _id?: string; name?: string; mobile?: string; whatsapp?: string; address?: string; location?: string };
type Machine = { _id?: string; brand?: string; model?: string; serialNo?: string; machineType?: string };
type Job = {
  _id: string;
  jobNo?: string;
  status?: string;
  house?: string;
  location?: string;
  address?: string;
  mobile?: string;
  whatsapp?: string;
  lift?: string;
  issueDescription?: string;
  siteName?: string;
  siteAddress?: string;
  siteLocation?: string;
  lat?: number;
  lng?: number;
  customerId?: string | Ref;
  machineId?: string | Machine;
  technicianId?: string | Ref;
};

function asRef(value?: string | Ref | Machine | null): Ref & Machine {
  if (!value || typeof value === "string") return { _id: value || "" };
  return value;
}

function readGps(): Promise<GeoPin | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function openExternal(url: string) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "C";
}

export default function FieldHousePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", whatsapp: "", address: "", location: "", issue: "", lat: "", lng: "" });

  async function load() {
    const res = await fetchJson<{ data?: Job }>(`/api/services/${id}`);
    if (!res.ok || !res.data?.data) {
      setError(t("common.error"));
      return;
    }
    const next = res.data.data;
    const customer = asRef(next.customerId);
    setJob(next);
    setForm({
      name: next.house || next.siteName || customer.name || "",
      mobile: next.mobile || customer.mobile || "",
      whatsapp: next.whatsapp || customer.whatsapp || "",
      address: next.address || next.siteAddress || customer.address || "",
      location: next.location || next.siteLocation || customer.location || "",
      issue: next.issueDescription || "",
      lat: next.lat != null ? String(next.lat) : "",
      lng: next.lng != null ? String(next.lng) : "",
    });
    setError("");
  }

  useEffect(() => {
    writeStoredJob(id);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error && !job) return <AlertBanner tone="error" message={error} />;
  if (!job) return <p className="text-muted">{t("common.loading")}</p>;

  const customer = asRef(job.customerId);
  const machine = asRef(job.machineId);
  const tech = asRef(job.technicianId);
  const pin = parseLatLng(form.lat, form.lng);
  const maps = pin ? `https://www.google.com/maps?q=${pin.lat},${pin.lng}` : "";
  const lift =
    job.lift || [machine.brand, machine.model, machine.serialNo].filter(Boolean).join(" · ");
  const customerId = customer._id || "";
  const wa = waLink(form.whatsapp || form.mobile);

  function patch<K extends keyof typeof form>(key: K, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function saveSite() {
    setPending(true);
    setError("");
    const res = await fetchJson(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName: form.name,
        siteAddress: form.address,
        siteLocation: form.location,
        issueDescription: form.issue,
        lat: pin?.lat,
        lng: pin?.lng,
        clearPin: !pin,
        contact: {
          name: form.name,
          mobile: form.mobile,
          whatsapp: form.whatsapp,
          address: form.address,
          location: form.location,
        },
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setNotice(bn ? "কাস্টমার সেভ হয়েছে" : "Customer saved");
    await load();
  }

  async function fillHere() {
    const here = await readGps();
    if (!here) {
      setError(bn ? "লোকেশন পাওয়া যায়নি" : "Could not read location");
      return;
    }
    setForm((old) => ({ ...old, lat: String(here.lat), lng: String(here.lng) }));
  }

  async function copyAddress() {
    if (!form.address) return;
    try {
      await navigator.clipboard.writeText(form.address);
      setNotice(bn ? "ঠিকানা কপি হয়েছে" : "Address copied");
    } catch {
      setNotice(bn ? "কপি হয়নি" : "Could not copy");
    }
  }

  const liftName = [machine.brand, machine.model].filter(Boolean).join(" ") || machine.machineType || job.lift || (bn ? "লিফট" : "Lift");
  const serial = machine.serialNo || "—";
  const gpsLabel = pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "—";

  return (
    <div className="gp-desk fld-day fld-sitepage fld-customerpage">
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {notice ? <AlertBanner tone="success" message={notice} onClose={() => setNotice("")} /> : null}

      <section className="fld-hero">
        <div className="fld-ident">
          <span className="fld-ident-avatar">{initials(form.name)}</span>
          <div>
            <p className="fld-hero-kicker">{job.jobNo || t("field.house")}</p>
            <h1>{form.name || (bn ? "কাস্টমার" : "Customer")}</h1>
            <p className="fld-lead">{lift || (bn ? "লিফট নেই" : "No lift linked")}</p>
          </div>
        </div>
        <div className="fld-hero-stats">
          <b>{String(job.status || "—").replace(/_/g, " ")}</b>
          {tech.name ? <b>{tech.name}</b> : null}
          <b>{gpsLabel}</b>
        </div>
      </section>

      <section className="fld-panel">
        <div className="fld-sitebody">
          <div className="fld-sitecol">
            <div className="fld-toolbar">
              {form.mobile ? (
                <a className="fld-cta" href={`tel:${form.mobile}`}>
                  <Phone className="h-4 w-4" />
                  {bn ? "কল" : "Call"}
                </a>
              ) : (
                <button type="button" className="fld-cta" disabled>
                  <Phone className="h-4 w-4" />
                  {bn ? "কল" : "Call"}
                </button>
              )}
              {wa ? (
                <a className="fld-act" href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : (
                <button type="button" className="fld-act" disabled>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
              )}
              {customerId ? (
                <Link className="fld-act" href={`/crm/client-followups/${customerId}`}>
                  {bn ? "ফলো-আপ" : "Follow-up"}
                </Link>
              ) : (
                <button type="button" className="fld-act" disabled>
                  {bn ? "ফলো-আপ" : "Follow-up"}
                </button>
              )}
              <button type="button" className="fld-cta" disabled={pending} onClick={() => void saveSite()}>
                <Save className="h-4 w-4" />
                {t("common.save")}
              </button>
            </div>

            <div className="fld-form">
              <label className="fld-field">
                <span>{bn ? "নাম" : "Name"}</span>
                <input className="gp-input" value={form.name} onChange={(e) => patch("name", e.target.value)} />
              </label>
              <label className="fld-field">
                <span>{bn ? "মোবাইল" : "Mobile"}</span>
                <input className="gp-input" value={form.mobile} onChange={(e) => patch("mobile", e.target.value)} />
              </label>
              <label className="fld-field">
                <span>WhatsApp</span>
                <input className="gp-input" value={form.whatsapp} onChange={(e) => patch("whatsapp", e.target.value)} />
              </label>
              <label className="fld-field">
                <span>{bn ? "এলাকা" : "Location"}</span>
                <input className="gp-input" value={form.location} onChange={(e) => patch("location", e.target.value)} />
              </label>
              <label className="fld-field wide">
                <span>{bn ? "ঠিকানা" : "Address"}</span>
                <input className="gp-input" value={form.address} onChange={(e) => patch("address", e.target.value)} />
              </label>
              <label className="fld-field">
                <span>Lat</span>
                <input className="gp-input" value={form.lat} inputMode="decimal" onChange={(e) => patch("lat", e.target.value)} placeholder="23.8103" />
              </label>
              <label className="fld-field">
                <span>Long</span>
                <input className="gp-input" value={form.lng} inputMode="decimal" onChange={(e) => patch("lng", e.target.value)} placeholder="90.4125" />
              </label>
              <label className="fld-field wide">
                <span>{bn ? "সমস্যা" : "Issue"}</span>
                <input className="gp-input" value={form.issue} onChange={(e) => patch("issue", e.target.value)} />
              </label>
            </div>

            <div className="fld-facts">
              <article className="fld-fact">
                <Hash className="h-4 w-4" />
                <span>{bn ? "জব" : "Job"}</span>
                <strong>{job.jobNo || "—"}</strong>
                <em>{String(job.status || "—").replace(/_/g, " ")}</em>
              </article>
              <article className="fld-fact">
                <Wrench className="h-4 w-4" />
                <span>{bn ? "লিফট" : "Lift"}</span>
                <strong>{liftName}</strong>
                <em>{serial}</em>
              </article>
              <article className="fld-fact">
                <UserRound className="h-4 w-4" />
                <span>{bn ? "টেকনিশিয়ান" : "Technician"}</span>
                <strong>{tech.name || (bn ? "অ্যাসাইন নেই" : "Unassigned")}</strong>
                <em>{tech.mobile || "—"}</em>
              </article>
              <article className="fld-fact">
                <Crosshair className="h-4 w-4" />
                <span>Lat / Long</span>
                <strong>{pin ? pin.lat.toFixed(5) : "—"}</strong>
                <em>{pin ? pin.lng.toFixed(5) : "—"}</em>
              </article>
            </div>
          </div>

          <aside className="fld-mapcard">
            <div className="fld-maphead">
              <MapPin className="h-4 w-4" />
              <div>
                <strong>Lat / Long</strong>
                <small>{gpsLabel}</small>
              </div>
              <div className="fld-mapacts">
                <button type="button" className="fld-cta" disabled={pending} onClick={() => void fillHere()}>
                  <Crosshair className="h-4 w-4" />
                  {bn ? "এখনকার" : "My location"}
                </button>
                {maps ? (
                  <button type="button" className="fld-ico" title="Maps" onClick={() => openExternal(maps)}>
                    <ExternalLink className="h-4 w-4" />
                  </button>
                ) : null}
                {form.address ? (
                  <button type="button" className="fld-ico" title={bn ? "কপি" : "Copy"} onClick={() => void copyAddress()}>
                    <Copy className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="fld-mapwrap">
              <p className="fld-gps">{bn ? "শুধু অক্ষাংশ ও দ্রাঘিমাংশ লিখুন।" : "Enter latitude and longitude only."}</p>
            </div>
          </aside>
        </div>
        <FieldJobNav id={id} />
      </section>
    </div>
  );
}
