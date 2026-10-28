export type ServiceMoneyLine = {
  productId?: string;
  name: string;
  code?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  lineTotal: number;
};

function money(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

export function normalizeServiceLine(it: Partial<ServiceMoneyLine> & Record<string, unknown>): ServiceMoneyLine {
  const qty = Math.max(0, money(it.qty || 0));
  const unitPrice = Math.max(0, money(it.unitPrice || 0));
  const productId = it.productId ? String(it.productId) : undefined;
  return {
    ...(productId ? { productId } : {}),
    name: String(it.name || "").trim(),
    code: it.code ? String(it.code) : undefined,
    qty,
    unit: String(it.unit || "job"),
    unitPrice,
    lineTotal: money(qty * unitPrice),
  };
}

export function computeServiceTotals(input: {
  serviceLines?: unknown[];
  parts?: unknown[];
  visitCharge?: unknown;
  discount?: unknown;
  tax?: unknown;
  paidAmount?: unknown;
  payments?: { amount?: unknown }[];
}) {
  const serviceLines = (input.serviceLines || [])
    .map((row) => normalizeServiceLine(row as ServiceMoneyLine))
    .filter((row) => row.name && row.qty > 0);
  const parts = (input.parts || [])
    .map((row) => normalizeServiceLine(row as ServiceMoneyLine))
    .filter((row) => row.name && row.qty > 0);

  const serviceLinesTotal = money(serviceLines.reduce((sum, row) => sum + row.lineTotal, 0));
  const partsTotal = money(parts.reduce((sum, row) => sum + row.lineTotal, 0));
  const visitCharge = Math.max(0, money(input.visitCharge || 0));
  const serviceCharges = money(visitCharge + serviceLinesTotal);
  const discount = Math.max(0, money(input.discount || 0));
  const tax = Math.max(0, money(input.tax || 0));
  const grandTotal = money(Math.max(0, partsTotal + serviceCharges - discount + tax));
  const paidFromPayments = money(
    (input.payments || []).reduce((sum, p) => sum + money(p.amount), 0),
  );
  const paidAmount = Array.isArray(input.payments)
    ? paidFromPayments
    : Math.max(0, money(input.paidAmount || 0));
  const dueAmount = money(Math.max(0, grandTotal - paidAmount));

  return {
    serviceLines,
    parts,
    visitCharge,
    serviceLinesTotal,
    serviceCharges,
    partsTotal,
    discount,
    tax,
    grandTotal,
    paidAmount,
    dueAmount,
  };
}

export const COMPLETION_GAP_LABELS: Record<string, { en: string; bn: string }> = {
  technician: { en: "Assign a technician", bn: "টেকনিশিয়ান অ্যাসাইন করুন" },
  billing: {
    en: "Add a visit charge, at least one service with quantity, or parts",
    bn: "ভিজিট চার্জ, পরিমাণসহ অন্তত একটি সার্ভিস, অথবা পার্টস যোগ করুন",
  },
  resolution: { en: "Write how the job was resolved", bn: "কাজ কীভাবে সম্পন্ন হয়েছে লিখুন" },
  confirm: { en: "Customer confirmation is required", bn: "গ্রাহকের কনফার্মেশন দরকার" },
  location: { en: "Select a stock location for parts used", bn: "ব্যবহৃত পার্টসের জন্য স্টক লোকেশন বেছে নিন" },
  checkin: { en: "Check in at the customer before completing", bn: "কমপ্লিটের আগে কাস্টমারে চেক-ইন করুন" },
  otp: { en: "Customer OTP is required", bn: "গ্রাহকের ওটিপি দরকার" },
  photo: { en: "Attach a site photo before completing", bn: "কমপ্লিটের আগে সাইটের ছবি দিন" },
  sku: { en: "Every used part needs a product / SKU", bn: "ব্যবহৃত প্রতিটি পার্টসের প্রোডাক্ট / SKU লাগবে" },
};

export function completionGaps(input: {
  technicianId?: unknown;
  technicianIds?: unknown;
  serviceLines?: { qty?: number; name?: string }[];
  parts?: { productId?: unknown; qty?: number; name?: string }[];
  visitCharge?: unknown;
  complimentary?: boolean;
  resolution?: unknown;
  customerConfirmation?: unknown;
  checkedInAt?: unknown;
  otpVerifiedAt?: unknown;
  photos?: { kind?: string; url?: string }[];
  requireOtp?: boolean;
  requirePhoto?: boolean;
}) {
  const gaps: string[] = [];
  const crew = [input.technicianId, ...(Array.isArray(input.technicianIds) ? input.technicianIds : [])]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!crew.length) gaps.push("technician");
  const hasService = (input.serviceLines || []).some((row) => Number(row.qty) > 0 && String(row.name || "").trim());
  const hasParts = (input.parts || []).some((row) => Number(row.qty) > 0);
  const hasVisit = Number(input.visitCharge || 0) > 0;
  if (!hasService && !hasParts && !hasVisit) gaps.push("billing");
  if (!String(input.resolution || "").trim()) gaps.push("resolution");
  if (!String(input.customerConfirmation || "").trim()) gaps.push("confirm");
  if (!input.checkedInAt) gaps.push("checkin");
  if (input.requireOtp && !input.otpVerifiedAt) gaps.push("otp");
  if (input.requirePhoto) {
    const hasSite = (input.photos || []).some((row) => String(row.kind || "site") === "site" && String(row.url || ""));
    if (!hasSite) gaps.push("photo");
  }
  if ((input.parts || []).some((row) => Number(row.qty) > 0 && !row.productId)) gaps.push("sku");
  return gaps;
}
