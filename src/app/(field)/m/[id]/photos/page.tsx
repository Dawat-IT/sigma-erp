"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

const PHOTO_KINDS = ["site", "selfie", "checklist"] as const;
type PhotoKind = (typeof PHOTO_KINDS)[number];

type Photo = { url?: string; kind?: string; at?: string };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export default function FieldPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [kind, setKind] = useState<PhotoKind>("site");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const res = await fetchJson<{ data?: { photos?: Photo[] } }>(`/api/services/${id}`);
    if (!res.ok || !res.data?.data) {
      setError(t("common.error"));
      return;
    }
    setPhotos(Array.isArray(res.data.data.photos) ? res.data.data.photos : []);
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

  async function onFile(file?: File) {
    if (!file) return;
    setPending(true);
    setError("");
    setMsg("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetchJson(`/api/services/${id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, dataUrl }),
      });
      if (!res.ok) throw new Error(res.error || t("common.error"));
      setMsg(t("common.success"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="gp-desk">
      <h1 className="gp-display text-xl font-bold">{bn ? "সাইট ছবি" : "Site photos"}</h1>
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {msg ? <AlertBanner tone="success" message={msg} /> : null}
      <div className="gp-card space-y-3 p-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted">{bn ? "ধরন" : "Kind"}</span>
          <select className="gp-input" value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)}>
            {PHOTO_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={pending}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo, i) => (
          <figure key={`${photo.url}-${i}`} className="gp-card overflow-hidden p-2">
            {photo.url ? <img src={photo.url} alt={photo.kind || "photo"} className="h-36 w-full rounded-lg object-cover" /> : null}
            <figcaption className="mt-1 text-xs text-muted">{photo.kind} {photo.at ? String(photo.at).slice(0, 16) : ""}</figcaption>
          </figure>
        ))}
      </div>
      {!photos.length ? <p className="text-sm text-muted">{bn ? "এখনো ছবি নেই।" : "No photos yet."}</p> : null}
    </div>
  );
}
