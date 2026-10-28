"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

export default function FieldReportPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [form, setForm] = useState({ diagnosis: "", resolution: "", nextAction: "", notes: "" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem("fieldJobId", id);
    } catch {
      /* ignore */
    }
    void fetchJson<{ data?: Record<string, string> }>(`/api/services/${id}`).then((res) => {
      if (!res.ok || !res.data?.data) {
        setError(t("common.error"));
        return;
      }
      const job = res.data.data;
      setForm({
        diagnosis: job.diagnosis || "",
        resolution: job.resolution || "",
        nextAction: job.nextAction || "",
        notes: job.notes || "",
      });
    });
  }, [id, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMsg("");
    const res = await fetchJson(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setMsg(t("common.success"));
  }

  return (
    <div className="gp-desk">
      <h1 className="gp-display text-xl font-bold">{bn ? "সার্ভিস রিপোর্ট" : "Service report"}</h1>
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {msg ? <AlertBanner tone="success" message={msg} /> : null}
      <form onSubmit={onSubmit} className="gp-card space-y-3 p-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ডায়াগনোসিস" : "Diagnosis"}</span>
          <textarea className="gp-input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "সমাধান" : "Resolution"}</span>
          <textarea className="gp-input" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "পরবর্তী কাজ" : "Next action"}</span>
          <input className="gp-input" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "নোট" : "Notes"}</span>
          <textarea className="gp-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button type="submit" disabled={pending} className="gp-btn gp-btn-primary">{pending ? "..." : bn ? "সেভ" : "Save"}</button>
      </form>
    </div>
  );
}
