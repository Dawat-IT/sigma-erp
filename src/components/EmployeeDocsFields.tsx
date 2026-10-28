"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field } from "@/components/ui";

export type EmployeeCertificate = { title?: string; url: string; at?: string };
export type EmployeeDocsValue = {
  nidFrontUrl: string;
  nidBackUrl: string;
  certificates: EmployeeCertificate[];
};

const MAX_IMAGE_BYTES = 800_000;

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("invalid"));
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

function Preview({ url, label }: { url: string; label: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-32 w-full object-contain" />
    </a>
  );
}

export function EmployeeDocsFields({
  value,
  onChange,
  employeeId,
  bn,
  disabled,
}: {
  value: EmployeeDocsValue;
  onChange: (next: EmployeeDocsValue) => void;
  employeeId?: string;
  bn: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [certTitle, setCertTitle] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);

  async function persist(kind: "nidFront" | "nidBack" | "certificate", url: string, title?: string) {
    if (!employeeId) return;
    const res = await fetch(`/api/contacts/${employeeId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, url, title }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "fail");
    onChange({
      nidFrontUrl: json.data?.nidFrontUrl || "",
      nidBackUrl: json.data?.nidBackUrl || "",
      certificates: json.data?.certificates || [],
    });
  }

  async function remove(kind: "nidFront" | "nidBack" | "certificate", index?: number) {
    if (employeeId) {
      const qs = new URLSearchParams({ kind });
      if (kind === "certificate" && index != null) qs.set("index", String(index));
      const res = await fetch(`/api/contacts/${employeeId}/documents?${qs}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "fail");
      onChange({
        nidFrontUrl: json.data?.nidFrontUrl || "",
        nidBackUrl: json.data?.nidBackUrl || "",
        certificates: json.data?.certificates || [],
      });
      return;
    }
    if (kind === "nidFront") onChange({ ...value, nidFrontUrl: "" });
    else if (kind === "nidBack") onChange({ ...value, nidBackUrl: "" });
    else onChange({ ...value, certificates: value.certificates.filter((_, i) => i !== index) });
  }

  async function onPick(kind: "nidFront" | "nidBack" | "certificate", file?: File) {
    if (!file || disabled) return;
    setError("");
    setBusy(kind);
    try {
      const dataUrl = await readImageFile(file);
      if (kind === "nidFront") {
        if (employeeId) await persist("nidFront", dataUrl);
        else onChange({ ...value, nidFrontUrl: dataUrl });
      } else if (kind === "nidBack") {
        if (employeeId) await persist("nidBack", dataUrl);
        else onChange({ ...value, nidBackUrl: dataUrl });
      } else {
        const title = certTitle.trim() || (bn ? "সার্টিফিকেট" : "Certificate");
        if (employeeId) await persist("certificate", dataUrl, title);
        else onChange({ ...value, certificates: [...value.certificates, { title, url: dataUrl, at: new Date().toISOString() }] });
        setCertTitle("");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "too_large"
          ? bn
            ? "ছবি ৮০০KB এর কম হতে হবে"
            : "Image must be under 800KB"
          : bn
            ? "শুধু ছবি ফাইল আপলোড করুন"
            : "Please upload an image file",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border border-line bg-[var(--gp-surface-2)] p-3">
      <p className="text-sm font-bold text-[var(--gp-ink)]">
        {bn ? "NID ও সার্টিফিকেট ছবি" : "NID and certificate images"}
      </p>
      <p className="text-xs text-muted">
        {bn ? "JPG/PNG, সর্বোচ্চ ৮০০KB। NID সামনে-পিছনে ও সার্টিফিকেট আপলোড করুন।" : "JPG/PNG, max 800KB. Upload NID front/back and certificates."}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={bn ? "NID সামনে" : "NID front"}>
          <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void onPick("nidFront", file); }} />
          <button type="button" className="gp-btn gp-btn-ghost w-full" disabled={disabled || busy === "nidFront"} onClick={() => frontRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {busy === "nidFront" ? "..." : bn ? "আপলোড" : "Upload"}
          </button>
          <Preview url={value.nidFrontUrl} label="NID front" />
          {value.nidFrontUrl ? (
            <button type="button" className="mt-2 gp-btn gp-btn-ghost min-h-8 px-2 text-xs text-danger" onClick={() => void remove("nidFront")}>
              <Trash2 className="h-3.5 w-3.5" />
              {bn ? "মুছুন" : "Remove"}
            </button>
          ) : null}
        </Field>
        <Field label={bn ? "NID পিছনে" : "NID back"}>
          <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void onPick("nidBack", file); }} />
          <button type="button" className="gp-btn gp-btn-ghost w-full" disabled={disabled || busy === "nidBack"} onClick={() => backRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {busy === "nidBack" ? "..." : bn ? "আপলোড" : "Upload"}
          </button>
          <Preview url={value.nidBackUrl} label="NID back" />
          {value.nidBackUrl ? (
            <button type="button" className="mt-2 gp-btn gp-btn-ghost min-h-8 px-2 text-xs text-danger" onClick={() => void remove("nidBack")}>
              <Trash2 className="h-3.5 w-3.5" />
              {bn ? "মুছুন" : "Remove"}
            </button>
          ) : null}
        </Field>
      </div>
      <Field label={bn ? "সার্টিফিকেট" : "Certificates"}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="gp-input flex-1"
            placeholder={bn ? "নাম — SSC / ট্রেড / অভিজ্ঞতা" : "Title — SSC / trade / experience"}
            value={certTitle}
            onChange={(e) => setCertTitle(e.target.value)}
            disabled={disabled}
          />
          <input ref={certRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void onPick("certificate", file); }} />
          <button type="button" className="gp-btn gp-btn-primary min-h-10" disabled={disabled || busy === "certificate"} onClick={() => certRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {busy === "certificate" ? "..." : bn ? "ছবি যোগ" : "Add image"}
          </button>
        </div>
      </Field>
      {value.certificates.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {value.certificates.map((row, index) => (
            <li key={`${row.url.slice(0, 24)}-${index}`} className="gp-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{row.title || (bn ? "সার্টিফিকেট" : "Certificate")}</p>
                <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs text-danger" onClick={() => void remove("certificate", index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Preview url={row.url} label={row.title || "Certificate"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{bn ? "এখনও কোনো সার্টিফিকেট নেই" : "No certificates yet"}</p>
      )}
    </div>
  );
}
