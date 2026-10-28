/** Billable services on one work order — elevator field ops. */

export type ServiceCatalogItem = {
  code: string;
  name: string;
  nameBn: string;
  unit: "job" | "visit" | "hour" | "pcs";
  unitPrice: number;
  jobKinds?: string[];
};

export const SERVICE_UNITS = [
  { value: "job", label: "Job", labelBn: "জব" },
  { value: "visit", label: "Visit", labelBn: "ভিজিট" },
  { value: "hour", label: "Hour", labelBn: "ঘণ্টা" },
  { value: "pcs", label: "Pcs", labelBn: "পিস" },
] as const;

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { code: "VISIT", name: "Standard site visit", nameBn: "স্ট্যান্ডার্ড সাইট ভিজিট", unit: "visit", unitPrice: 800 },
  { code: "EMERG", name: "Emergency call-out", nameBn: "জরুরি কল-আউট", unit: "visit", unitPrice: 1500, jobKinds: ["emergency"] },
  { code: "PM", name: "Preventive maintenance", nameBn: "প্রিভেন্টিভ মেইনটেন্যান্স", unit: "job", unitPrice: 2500, jobKinds: ["scheduled"] },
  { code: "BD", name: "Breakdown diagnosis & repair", nameBn: "ব্রেকডাউন ডায়াগনোসিস ও মেরামত", unit: "job", unitPrice: 2000, jobKinds: ["complaint", "emergency"] },
  { code: "DOOR", name: "Door operator service", nameBn: "ডোর অপারেটর সার্ভিস", unit: "job", unitPrice: 1800 },
  { code: "BRAKE", name: "Brake inspection & adjustment", nameBn: "ব্রেক ইন্সপেকশন ও অ্যাডজাস্টমেন্ট", unit: "job", unitPrice: 1200 },
  { code: "ARD", name: "ARD rescue test", nameBn: "এআরডি রেসকিউ টেস্ট", unit: "job", unitPrice: 1500 },
  { code: "ROPE", name: "Rope / chain inspection", nameBn: "রোপ / চেইন ইন্সপেকশন", unit: "job", unitPrice: 1000 },
  { code: "CTRL", name: "Controller / VVVF check", nameBn: "কন্ট্রোলার / VVVF চেক", unit: "job", unitPrice: 2200 },
  { code: "GEN", name: "Generator load test", nameBn: "জেনারেটর লোড টেস্ট", unit: "job", unitPrice: 1800 },
  { code: "ESC", name: "Escalator lubrication & check", nameBn: "এস্কেলেটর লুব্রিকেশন ও চেক", unit: "job", unitPrice: 1600 },
  { code: "COMM", name: "Testing & commissioning", nameBn: "টেস্টিং ও কমিশনিং", unit: "job", unitPrice: 5000, jobKinds: ["installation"] },
  { code: "LABOUR", name: "Technician labour", nameBn: "টেকনিশিয়ান লেবার", unit: "hour", unitPrice: 500 },
  { code: "EXTRA", name: "Additional service", nameBn: "অতিরিক্ত সার্ভিস", unit: "job", unitPrice: 0 },
];

export function defaultServiceLines(jobKind?: string): {
  name: string;
  code: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}[] {
  const kind = String(jobKind || "general");
  const codeByKind: Record<string, string> = {
    complaint: "BD",
    scheduled: "PM",
    emergency: "BD",
    installation: "COMM",
  };
  const code = codeByKind[kind];
  if (!code) return [];
  const match = SERVICE_CATALOG.find((row) => row.code === code);
  if (!match) return [];
  return [
    {
      name: match.name,
      code: match.code,
      qty: 1,
      unit: match.unit,
      unitPrice: match.unitPrice,
      lineTotal: match.unitPrice,
    },
  ];
}

export function starterServiceLines(jobKind?: string) {
  const lines = defaultServiceLines(jobKind);
  return lines.length
    ? lines
    : [{ name: "", code: "EXTRA", qty: 1, unit: "job" as const, unitPrice: 0, lineTotal: 0 }];
}

export function defaultVisitCharge(jobKind?: string) {
  return jobKind === "emergency" ? 1500 : 800;
}
