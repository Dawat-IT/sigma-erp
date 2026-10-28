"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { applySiteFavicon } from "@/components/SiteFavicon";

type Business = {
  name?: string;
  nameBn?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bin?: string;
  tin?: string;
  currency?: string;
  invoicePrefix?: string;
  logoUrl?: string;
  faviconUrl?: string;
};

type LocationRow = {
  _id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
};

type LocForm = { _id: string; name: string; code: string; address: string; phone: string };

const emptyLoc: LocForm = { _id: "", name: "", code: "", address: "", phone: "" };

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "LC";
}

export default function SettingsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [business, setBusiness] = useState<Business>({});
  const [draft, setDraft] = useState<Business>({});
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingBiz, setEditingBiz] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locOpen, setLocOpen] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locForm, setLocForm] = useState<LocForm>(emptyLoc);

  const loadMeta = useCallback(async () => {
    try {
      const r = await fetch("/api/meta");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      setBusiness(d.business || {});
      setLocations(d.locations || []);
      setError("");
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  function startEditBiz() {
    setDraft(business);
    setNotice("");
    setError("");
    setEditingBiz(true);
  }

  function cancelBiz() {
    setBusiness(draft);
    setEditingBiz(false);
  }

  async function saveBusiness(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "business", ...business }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          j.error === "forbidden"
            ? bn
              ? "সেটিংস পরিবর্তনের অনুমতি নেই।"
              : "No permission to change settings."
            : t("common.error"),
        );
        return;
      }
      setEditingBiz(false);
      setNotice(bn ? "সেটিংস সংরক্ষিত।" : "Settings saved.");
      applySiteFavicon();
      await loadMeta();
    } catch {
      setError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function openAddLoc() {
    setLocForm(emptyLoc);
    setLocOpen(true);
  }

  function openEditLoc(row: LocationRow) {
    setLocForm({
      _id: row._id,
      name: row.name || "",
      code: row.code || "",
      address: row.address || "",
      phone: row.phone || "",
    });
    setLocOpen(true);
  }

  async function saveLocation(e: FormEvent) {
    e.preventDefault();
    setLocBusy(true);
    setError("");
    try {
      const res = await fetch("/api/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "location",
          ...(locForm._id ? { _id: locForm._id } : {}),
          name: locForm.name,
          code: locForm.code,
          address: locForm.address,
          phone: locForm.phone,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          j.error === "forbidden"
            ? bn
              ? "লোকেশন পরিবর্তনের অনুমতি নেই।"
              : "No permission to change locations."
            : t("common.error"),
        );
        return;
      }
      setLocOpen(false);
      setLocForm(emptyLoc);
      setNotice(locForm._id ? (bn ? "লোকেশন আপডেট হয়েছে।" : "Location updated.") : bn ? "লোকেশন যোগ হয়েছে।" : "Location added.");
      await loadMeta();
    } catch {
      setError(t("common.error"));
    } finally {
      setLocBusy(false);
    }
  }

  async function deleteLocation(id: string) {
    if (!confirm(bn ? "লোকেশন মুছবেন?" : "Delete location?")) return;
    await fetch(`/api/meta?locationId=${id}`, { method: "DELETE" });
    setNotice(bn ? "লোকেশন মুছে ফেলা হয়েছে।" : "Location deleted.");
    await loadMeta();
  }

  async function reseed() {
    const ok = confirm(
      bn
        ? "সব পুরনো ডেমো ডেটা মুছে নতুন ডামি ডেটা লোড হবে। চালিয়ে যাবেন?"
        : "This will wipe demo data and reseed. Continue?",
    );
    if (!ok) return;
    setSeeding(true);
    setError("");
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (json.ok) {
        setNotice(
          bn
            ? `সফল! পণ্য ${json.counts?.products}, গ্রাহক ${json.counts?.customers}, বিক্রি ${json.counts?.sales}`
            : `Reseeded: ${json.counts?.products} products, ${json.counts?.sales} sales`,
        );
        await loadMeta();
      } else {
        setError(
          json.error === "forbidden"
            ? bn
              ? "শুধু অ্যাডমিন রিসিড করতে পারে।"
              : "Only admin can reseed."
            : t("common.error"),
        );
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={t("settings.title")}
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        stats={[
          { value: locations.length, label: bn ? "লোকেশন" : "locations" },
          { value: business.currency || "BDT", label: bn ? "মুদ্রা" : "currency" },
        ]}
        actions={
          <>
            <button type="button" className="gp-btn" onClick={startEditBiz} disabled={editingBiz || loading}>
              <Pencil className="h-4 w-4" />
              {bn ? "ব্যবসা এডিট" : "Edit business"}
            </button>
            <button type="button" className="gp-btn gp-btn-primary" onClick={openAddLoc}>
              <Plus className="h-4 w-4" />
              {bn ? "লোকেশন" : "Location"}
            </button>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <Link href="/profile" className="gp-btn gp-btn-ghost">{bn ? "প্রোফাইল" : "Profile"}</Link>
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}
      {notice ? <p className="fu-filter-note">{notice}</p> : null}

      <div className="quote-board">
        {editingBiz ? (
          <form onSubmit={saveBusiness} className="eq-add-panel amc-new">
            <b>{t("settings.business")}</b>
            <div className="eq-add-fields">
              <Field label={t("settings.businessName")}>
                <input
                  className="gp-input"
                  required
                  value={business.name || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))}
                />
              </Field>
              <Field label={t("settings.nameBn")}>
                <input
                  className="gp-input"
                  value={business.nameBn || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, nameBn: e.target.value }))}
                />
              </Field>
              <Field label={t("settings.address")} className="span-2">
                <input
                  className="gp-input"
                  value={business.address || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))}
                />
              </Field>
              <Field label={t("settings.phone")}>
                <input
                  className="gp-input"
                  value={business.phone || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                />
              </Field>
              <Field label={t("settings.email")}>
                <input
                  className="gp-input"
                  type="email"
                  value={business.email || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, email: e.target.value }))}
                />
              </Field>
              <Field label={bn ? "ওয়েবসাইট" : "Website"}>
                <input
                  className="gp-input"
                  value={business.website || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, website: e.target.value }))}
                  placeholder="https://"
                />
              </Field>
              <Field label={t("settings.currency")}>
                <input
                  className="gp-input"
                  value={business.currency || "BDT"}
                  onChange={(e) => setBusiness((b) => ({ ...b, currency: e.target.value }))}
                />
              </Field>
              <Field label={t("invoice.bin")}>
                <input
                  className="gp-input"
                  value={business.bin || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, bin: e.target.value }))}
                />
              </Field>
              <Field label={t("invoice.tin")}>
                <input
                  className="gp-input"
                  value={business.tin || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, tin: e.target.value }))}
                />
              </Field>
              <Field label={bn ? "ইনভয়েস প্রিফিক্স" : "Invoice prefix"}>
                <input
                  className="gp-input"
                  value={business.invoicePrefix || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, invoicePrefix: e.target.value }))}
                />
              </Field>
              <Field label={bn ? "ডকুমেন্ট লোগো" : "Document logo"} className="span-2">
                <input
                  className="gp-input"
                  value={business.logoUrl || ""}
                  onChange={(e) => setBusiness((b) => ({ ...b, logoUrl: e.target.value }))}
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setBusiness((b) => ({ ...b, logoUrl: String(reader.result || "") }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {business.logoUrl ? (
                  <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={business.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {bn
                      ? "আপলোড করলে Quotation, Bill ও Challan-এ ব্যবহার হবে"
                      : "Uploaded logo is used on Quotation, Bill and Challan"}
                  </p>
                )}
              </Field>
              <Field label={bn ? "ফেভিকন" : "Favicon"} className="span-2">
                <input
                  type="file"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/webp,.ico"
                  className="mt-1 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 200_000) {
                      setError(bn ? "ফেভিকন ২০০KB এর কম হতে হবে।" : "Favicon must be under 200KB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setBusiness((b) => ({ ...b, faviconUrl: String(reader.result || "") }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {business.faviconUrl ? (
                  <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={business.faviconUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {bn ? "ব্রাউজার ট্যাবে দেখানো ছোট আইকন" : "Small icon shown in the browser tab"}
                  </p>
                )}
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={cancelBiz}>{t("common.cancel")}</button>
              <button type="submit" className="gp-btn gp-btn-primary" disabled={saving}>
                {saving ? t("app.loading") : t("common.save")}
              </button>
            </div>
          </form>
        ) : loading ? (
          <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p>
        ) : (
          <article className="fu-card is-info">
            <div className="fu-card-top">
              {business.logoUrl ? (
                <span className="fu-avatar overflow-hidden bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={business.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                </span>
              ) : (
                <span className="fu-avatar">{initials(business.nameBn || business.name || "SE")}</span>
              )}
              <div className="min-w-0 flex-1">
                <strong>{(bn && business.nameBn ? business.nameBn : business.name) || t("settings.business")}</strong>
                <p>
                  {business.phone || "—"}
                  {business.email ? ` · ${business.email}` : ""}
                </p>
              </div>
              <span className="fu-chip is-info">{business.currency || "BDT"}</span>
            </div>
            <div className="fu-card-foot">
              <p className="fu-meta">
                {business.address || (bn ? "ঠিকানা নেই" : "No address")}
                {business.bin ? ` · BIN ${business.bin}` : ""}
                {business.invoicePrefix ? ` · ${business.invoicePrefix}` : ""}
              </p>
              <button type="button" className="fld-act" onClick={startEditBiz}>{bn ? "এডিট" : "Edit"}</button>
            </div>
          </article>
        )}

        {loading ? null : locations.length === 0 ? (
          <EmptyState
            title={bn ? "লোকেশন নেই" : "No locations"}
            message={bn ? "গোডাউন বা শাখা যোগ করুন।" : "Add a warehouse or branch."}
          />
        ) : (
          <div className="fu-list">
            {locations.map((l) => (
              <article key={l._id || l.code} className="fu-card is-ok">
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(l.name)}</span>
                  <div className="min-w-0 flex-1">
                    <strong>{l.name}</strong>
                    <p>
                      {l.code}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </p>
                  </div>
                  <span className="fu-chip is-ok">{l.code}</span>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">{l.address || (bn ? "ঠিকানা নেই" : "No address")}</p>
                  <button type="button" className="fld-act" onClick={() => openEditLoc(l)}>{bn ? "এডিট" : "Edit"}</button>
                  <button type="button" className="fld-act" onClick={() => void deleteLocation(l._id)}>{bn ? "মুছুন" : "Delete"}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        <article className="fu-card is-warn">
          <div className="fu-card-top">
            <span className="fu-avatar">DM</span>
            <div className="min-w-0 flex-1">
              <strong>{bn ? "ডেমো ডেটা" : "Demo data"}</strong>
              <p>
                {bn
                  ? "অ্যাডমিন হিসেবে সব পেজে নমুনা ডেটা লোড করতে পারেন।"
                  : "Admin only: wipe and reload sample data for all modules."}
              </p>
            </div>
          </div>
          <div className="fu-card-foot">
            <p className="fu-meta">{bn ? "পুরনো ডেমো মুছে নতুন লোড হবে।" : "This replaces existing demo records."}</p>
            <button type="button" className="fld-act" disabled={seeding} onClick={() => void reseed()}>
              {seeding ? t("app.loading") : bn ? "রিলোড" : "Reload"}
            </button>
          </div>
        </article>
      </div>

      <Modal
        open={locOpen}
        title={locForm._id ? (bn ? "লোকেশন এডিট" : "Edit location") : bn ? "নতুন লোকেশন" : "Add location"}
        onClose={() => setLocOpen(false)}
      >
        <form onSubmit={saveLocation} className="grid gap-3">
          <Field label={bn ? "নাম" : "Name"}>
            <input
              className="gp-input"
              required
              value={locForm.name}
              onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label={bn ? "কোড" : "Code"}>
            <input
              className="gp-input"
              required
              value={locForm.code}
              onChange={(e) => setLocForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label={t("settings.address")}>
            <input
              className="gp-input"
              value={locForm.address}
              onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>
          <Field label={t("settings.phone")}>
            <input
              className="gp-input"
              value={locForm.phone}
              onChange={(e) => setLocForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setLocOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={locBusy}>
              {locBusy ? t("app.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
