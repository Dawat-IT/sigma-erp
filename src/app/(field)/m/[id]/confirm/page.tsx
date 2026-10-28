"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

export default function FieldConfirmPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [mock, setMock] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem("fieldJobId", id);
    } catch {
      /* ignore */
    }
    void fetchJson<{ data?: { customerConfirmation?: string; otpVerifiedAt?: string } }>(`/api/services/${id}`).then((res) => {
      if (!res.ok || !res.data?.data) {
        setError(t("common.error"));
        return;
      }
      setName(res.data.data.customerConfirmation || "");
      setVerified(Boolean(res.data.data.otpVerifiedAt));
    });
  }, [id, t]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMsg("");
    const res = await fetchJson(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerConfirmation: name }),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setMsg(t("common.success"));
  }

  async function sendOtp() {
    setPending(true);
    setError("");
    setMsg("");
    const res = await fetchJson<{ mock?: string }>(`/api/services/${id}/otp/send`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setMock(res.data?.mock || "");
    setMsg(bn ? "ওটিপি পাঠানো হয়েছে" : "OTP sent");
  }

  async function verifyOtp() {
    setPending(true);
    setError("");
    setMsg("");
    const res = await fetchJson(`/api/services/${id}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setVerified(true);
    setMsg(t("common.success"));
  }

  return (
    <div className="gp-desk">
      <h1 className="gp-display text-xl font-bold">{bn ? "কাস্টমার কনফার্ম" : "Customer confirm"}</h1>
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {msg ? <AlertBanner tone="success" message={msg} /> : null}
      <form onSubmit={saveName} className="gp-card space-y-3 p-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "কনফার্মেশন নাম / স্বাক্ষর" : "Confirmation name / signature"}</span>
          <input className="gp-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">{pending ? "..." : bn ? "সেভ" : "Save"}</button>
      </form>
      <div className="gp-card space-y-3 p-4">
        <p className="text-sm font-semibold">{verified ? (bn ? "ওটিপি ভেরিফাইড" : "OTP verified") : (bn ? "কাস্টমার ওটিপি" : "Customer OTP")}</p>
        {mock ? <p className="text-xs text-muted">{bn ? "ডেভ কোড" : "Dev code"}: {mock}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="gp-btn" disabled={pending} onClick={() => void sendOtp()}>{bn ? "ওটিপি পাঠান" : "Send OTP"}</button>
          <input className="gp-input w-32" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
          <button type="button" className="gp-btn gp-btn-primary" disabled={pending || code.length !== 6} onClick={() => void verifyOtp()}>{bn ? "ভেরিফাই" : "Verify"}</button>
        </div>
      </div>
    </div>
  );
}
