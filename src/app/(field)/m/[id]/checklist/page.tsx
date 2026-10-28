"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";
import { checklistProgress, type ChecklistRow } from "@/lib/technical-checklists";

export default function FieldChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const res = await fetchJson<{ data?: { checklist?: ChecklistRow[] } }>(`/api/services/${id}`);
    if (!res.ok || !res.data?.data) {
      setError(t("common.error"));
      return;
    }
    setRows(Array.isArray(res.data.data.checklist) ? res.data.data.checklist : []);
    setError("");
  }

  useEffect(() => {
    try {
      sessionStorage.setItem("fieldJobId", id);
    } catch {
      /* ignore */
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setPending(true);
    setError("");
    setMsg("");
    const res = await fetchJson(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: rows }),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || t("common.error"));
      return;
    }
    setMsg(t("common.success"));
  }

  const progress = checklistProgress(rows);

  return (
    <div className="gp-desk">
      <h1 className="gp-display text-xl font-bold">{bn ? "ডিজিটাল চেকলিস্ট" : "Digital checklist"}</h1>
      <p className="text-sm text-muted">{progress.label} ({progress.percent}%)</p>
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {msg ? <AlertBanner tone="success" message={msg} /> : null}
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={`${row.item}-${i}`} className="gp-card flex items-start gap-3 p-3">
            <input
              type="checkbox"
              checked={Boolean(row.done)}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, done: e.target.checked };
                setRows(next);
              }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{row.item}</p>
              <input
                className="mt-1 w-full border-0 bg-transparent text-xs outline-none"
                placeholder={bn ? "নোট" : "Note"}
                value={row.note || ""}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, note: e.target.value };
                  setRows(next);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="text-sm text-muted">{bn ? "এই জবে চেকলিস্ট নেই।" : "No checklist on this job."}</p> : null}
      <button type="button" className="gp-btn gp-btn-primary" disabled={pending} onClick={() => void save()}>
        {pending ? "..." : bn ? "সেভ" : "Save"}
      </button>
    </div>
  );
}
