"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Pencil } from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";

type Profile = {
  name: string;
  email: string;
  role: string;
  phone: string;
  avatarUrl: string;
};

const empty: Profile = { name: "", email: "", role: "", phone: "", avatarUrl: "" };
const MAX_IMAGE_BYTES = 800_000;

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "ME";
}

function roleLabel(role: string, bn: boolean) {
  const map: Record<string, { bn: string; en: string }> = {
    admin: { bn: "অ্যাডমিন", en: "Admin" },
    manager: { bn: "ম্যানেজার", en: "Manager" },
    accountant: { bn: "অ্যাকাউন্টেন্ট", en: "Accountant" },
    cashier: { bn: "ক্যাশিয়ার", en: "Cashier" },
    viewer: { bn: "ভিউয়ার", en: "Viewer" },
  };
  return map[role] ? (bn ? map[role].bn : map[role].en) : role;
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("invalid_image"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("too_large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(empty);
  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: "", currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta?type=profile");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      const user = json.user || {};
      const rows = Array.isArray(json.data) ? json.data : [];
      const fromRows = (label: string) =>
        String(rows.find((r: { label?: string; value?: string }) => r.label === label)?.value || "");
      const next: Profile = {
        name: String(user.name || fromRows("Name") || ""),
        email: String(user.email || fromRows("Email") || ""),
        role: String(user.role || fromRows("Role") || ""),
        phone: String(user.phone || fromRows("Phone") || ""),
        avatarUrl: String(user.avatarUrl || json.avatarUrl || ""),
      };
      setProfile(next);
      setError("");
    } catch {
      setProfile(empty);
      setError(bn ? "প্রোফাইল লোড হয়নি।" : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit() {
    setForm({
      name: profile.name,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      currentPassword: "",
      newPassword: "",
    });
    setNotice("");
    setError("");
    setOpen(true);
  }

  function failMessage(code: string) {
    if (code === "bad_password") return bn ? "বর্তমান পাসওয়ার্ড ভুল।" : "Current password is wrong.";
    if (code === "weak_password") return bn ? "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।" : "New password must be at least 6 characters.";
    if (code === "name_required") return bn ? "নাম আবশ্যক।" : "Name is required.";
    if (code === "invalid_image") return bn ? "ছবির ফরম্যাট সঠিক নয়।" : "Invalid image format.";
    if (code === "too_large") return bn ? "ছবি ৮০০KB এর কম হতে হবে।" : "Image must be under 800KB.";
    return bn ? "সেভ হয়নি।" : "Could not save.";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(bn ? "নাম আবশ্যক।" : "Name is required.");
      return;
    }
    if (form.newPassword && !form.currentPassword) {
      setError(bn ? "পাসওয়ার্ড বদলাতে বর্তমান পাসওয়ার্ড দিন।" : "Enter the current password to change it.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "profile",
          name: form.name.trim(),
          phone: form.phone.trim(),
          avatarUrl: form.avatarUrl,
          currentPassword: form.currentPassword || undefined,
          newPassword: form.newPassword || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "fail");
      setOpen(false);
      setNotice(bn ? "প্রোফাইল আপডেট হয়েছে।" : "Profile updated.");
      await load();
      router.refresh();
    } catch (err) {
      setError(failMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "অ্যাকাউন্ট" : "Account"}
        title={bn ? "প্রোফাইল" : "Profile"}
        subtitle={bn
          ? "নাম, ফোন, ছবি ও পাসওয়ার্ড — এক স্ক্রিনে এডিট।"
          : "Name, phone, photo and password — edit on one screen."}
        stats={[
          { value: profile.name ? 1 : 0, label: bn ? "অ্যাকাউন্ট" : "account" },
          { value: roleLabel(profile.role, bn) || "—", label: bn ? "রোল" : "role" },
        ]}
        actions={
          <button type="button" className="gp-btn gp-btn-primary" onClick={openEdit} disabled={!profile.email}>
            <Pencil className="h-4 w-4" />
            {bn ? "এডিট" : "Edit"}
          </button>
        }
      />

      <div className="dash-panel fu-toolbar">
        <Link href="/settings" className="gp-btn gp-btn-ghost">{bn ? "সেটিংস" : "Settings"}</Link>
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}
      {notice ? <p className="fu-filter-note">{notice}</p> : null}

      <div className="quote-board">
        {open ? (
          <form onSubmit={onSubmit} className="eq-add-panel amc-new">
            <b>{bn ? "প্রোফাইল এডিট" : "Edit profile"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "নাম" : "Name"}>
                <input
                  className="gp-input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label={bn ? "ফোন" : "Phone"}>
                <input
                  className="gp-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label={bn ? "ইমেইল" : "Email"}>
                <input className="gp-input" value={profile.email} readOnly />
              </Field>
              <Field label={bn ? "রোল" : "Role"}>
                <input className="gp-input" value={roleLabel(profile.role, bn)} readOnly />
              </Field>
              <Field label={bn ? "প্রোফাইল ছবি" : "Profile photo"} className="span-2">
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void readImageFile(file)
                      .then((url) => {
                        setForm((f) => ({ ...f, avatarUrl: url }));
                        setError("");
                      })
                      .catch((err) => setError(failMessage(err instanceof Error ? err.message : "invalid_image")));
                  }}
                />
                {form.avatarUrl ? (
                  <div className="mt-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.avatarUrl} alt="" className="max-h-full max-w-full object-cover" />
                  </div>
                ) : null}
              </Field>
              <Field label={bn ? "বর্তমান পাসওয়ার্ড" : "Current password"}>
                <input
                  type="password"
                  className="gp-input"
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                />
              </Field>
              <Field label={bn ? "নতুন পাসওয়ার্ড" : "New password"}>
                <input
                  type="password"
                  className="gp-input"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  placeholder={bn ? "খালি রাখলে বদলাবে না" : "Leave blank to keep"}
                />
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={() => setOpen(false)}>{bn ? "বাতিল" : "Cancel"}</button>
              <button type="submit" disabled={busy} className="gp-btn gp-btn-primary">
                {busy ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}

        {!loading && !profile.email ? (
          <EmptyState
            title={bn ? "প্রোফাইল নেই" : "No profile"}
            message={bn ? "লগইন করে আবার চেষ্টা করুন।" : "Sign in and try again."}
          />
        ) : null}

        {!loading && profile.email ? (
          <div className="fu-list">
            <article className="fu-card is-ok">
              <div className="fu-card-top">
                {profile.avatarUrl ? (
                  <span className="fu-avatar overflow-hidden p-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span className="fu-avatar">{initials(profile.name)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <strong>{profile.name || (bn ? "নাম নেই" : "No name")}</strong>
                  <p>
                    {profile.email}
                    {profile.phone ? ` · ${profile.phone}` : ""}
                  </p>
                </div>
                <span className="fu-chip is-ok">{roleLabel(profile.role, bn)}</span>
              </div>
              <div className="fu-card-foot">
                <p className="fu-meta">
                  {bn ? "ইমেইল ও রোল অ্যাডমিন পাল্টায়।" : "Email and role are changed by an admin."}
                </p>
                <button type="button" className="fld-act" onClick={openEdit}>{bn ? "এডিট" : "Edit"}</button>
              </div>
            </article>
          </div>
        ) : null}
      </div>
    </div>
  );
}
