export const EMPLOYEE_WORK_TYPES = [
  { id: "field", en: "Field", bn: "ফিল্ড" },
  { id: "office", en: "Office", bn: "অফিস" },
  { id: "both", en: "Field + office", bn: "ফিল্ড ও অফিস" },
] as const;

export function workTypeLabel(value: string | undefined, bn: boolean) {
  const row = EMPLOYEE_WORK_TYPES.find((item) => item.id === value);
  if (!row) return "";
  return bn ? row.bn : row.en;
}

export function workSpecialistLabel(workType?: string, speciality?: string, bn = false) {
  return [workTypeLabel(workType, bn), String(speciality || "").trim()].filter(Boolean).join(" · ");
}

export function docsCount(row: {
  nidFrontUrl?: string;
  nidBackUrl?: string;
  certificates?: unknown[];
}) {
  return (
    (row.nidFrontUrl ? 1 : 0) +
    (row.nidBackUrl ? 1 : 0) +
    (Array.isArray(row.certificates) ? row.certificates.length : 0)
  );
}
