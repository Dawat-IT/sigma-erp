"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Field } from "@/components/ui";
import type { CrudConfig, CrudField } from "@/lib/crud-config";

function fieldValue(row: Record<string, unknown>, key: string) {
  const aliases: Record<string, string[]> = {
    supplierName: ["supplierName", "name"],
    supplierContact: ["supplierContact", "mobile"],
    supplierEmail: ["supplierEmail", "email"],
  };
  for (const k of aliases[key] || [key]) {
    const v = row[k];
    if (v == null || v === "") continue;
    if (typeof v === "object" && v !== null && "_id" in v) {
      return String((v as { _id: unknown })._id);
    }
    if (typeof v === "object") continue;
    return String(v);
  }
  return "";
}

type RelationOption = { _id: string; label: string };

export function CrudForm({
  config,
  initial,
  onSubmit,
  onCancel,
  saving,
  isEdit,
}: {
  config: CrudConfig;
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving?: boolean;
  isEdit?: boolean;
}) {
  const locale = useLocale();
  const [form, setForm] = useState<Record<string, string>>({});
  const [relations, setRelations] = useState<Record<string, RelationOption[]>>({});

  const relationFields = config.fields.filter((f) => f.type === "relation" && f.relation);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of config.fields) {
      next[f.key] = initial ? fieldValue(initial, f.key) : "";
    }
    setForm(next);
  }, [config, initial]);

  useEffect(() => {
    let cancelled = false;
    async function loadRelations() {
      const entries = await Promise.all(
        relationFields.map(async (f) => {
          const api = f.relation!.api;
          try {
            const res = await fetch(api);
            const json = await res.json();
            const rows = (json.data || []) as Record<string, unknown>[];
            const labelField = f.relation!.labelField || "name";
            const subField = f.relation!.subField;
            const options: RelationOption[] = rows.map((row) => {
              const main = String(row[labelField] || row.name || "—");
              const sub = subField && row[subField] ? ` (${row[subField]})` : "";
              return { _id: String(row._id), label: `${main}${sub}` };
            });
            return [f.key, options] as const;
          } catch {
            return [f.key, []] as const;
          }
        }),
      );
      if (!cancelled) {
        setRelations(Object.fromEntries(entries));
      }
    }
    if (relationFields.length) void loadRelations();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resource]);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...config.createDefaults };
    for (const f of config.fields) {
      const raw = form[f.key] ?? "";
      if (isEdit && f.key === "password" && !raw) continue;
      if (f.type === "number") payload[f.key] = raw === "" ? 0 : Number(raw);
      else if (f.type === "date" && raw) payload[f.key] = new Date(raw).toISOString();
      else payload[f.key] = raw;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="gp-form-grid">
      {config.fields.map((f) => {
        if (isEdit && f.key === "password") {
          return (
            <FieldRow
              key={f.key}
              field={{
                ...f,
                required: false,
                labelBn: "নতুন পাসওয়ার্ড (ঐচ্ছিক)",
                labelEn: "New Password (optional)",
              }}
              locale={locale}
              value={form[f.key] || ""}
              onChange={(v) => set(f.key, v)}
            />
          );
        }
        if (f.type === "relation" && f.relation) {
          return (
            <RelationFieldRow
              key={f.key}
              field={f}
              locale={locale}
              value={form[f.key] || ""}
              options={relations[f.key] || []}
              onChange={(v) => set(f.key, v)}
            />
          );
        }
        return (
          <FieldRow
            key={f.key}
            field={f}
            locale={locale}
            value={form[f.key] || ""}
            onChange={(v) => set(f.key, v)}
          />
        );
      })}
      <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="gp-btn gp-btn-ghost min-h-10 px-4" onClick={onCancel} disabled={saving}>
          {locale === "bn" ? "বাতিল" : "Cancel"}
        </button>
        <button type="submit" className="gp-btn gp-btn-primary min-h-10 px-5" disabled={saving}>
          {saving ? "..." : locale === "bn" ? "সংরক্ষণ" : "Save"}
        </button>
      </div>
    </form>
  );
}

function RelationFieldRow({
  field,
  locale,
  value,
  options,
  onChange,
}: {
  field: CrudField;
  locale: string;
  value: string;
  options: RelationOption[];
  onChange: (v: string) => void;
}) {
  const label = locale === "bn" ? field.labelBn : field.labelEn;
  return (
    <Field label={label}>
      <select
        className="gp-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">{locale === "bn" ? "নির্বাচন করুন…" : "Select…"}</option>
        {options.map((o) => (
          <option key={o._id} value={o._id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FieldRow({
  field,
  locale,
  value,
  onChange,
}: {
  field: CrudField;
  locale: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = locale === "bn" ? field.labelBn : field.labelEn;

  if (field.type === "textarea") {
    return (
      <label className="block space-y-1 sm:col-span-2">
        <span className="text-[0.8rem] font-semibold text-muted">{label}</span>
        <textarea
          className="gp-input min-h-[72px] py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </label>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <Field label={label}>
        <select
          className="gp-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {locale === "bn" ? o.labelBn : o.labelEn}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        className="gp-input"
        type={
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : field.type === "email"
                ? "email"
                : "text"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        min={field.type === "number" ? 0 : undefined}
        step={field.type === "number" ? "0.01" : undefined}
      />
    </Field>
  );
}
