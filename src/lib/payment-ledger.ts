import { PaymentLedger } from "@/models";
import { calcDueAmount, roundMoney } from "@/lib/sale-finance";

const METHODS = ["cash", "card", "bkash", "nagad", "rocket", "cheque", "bank", "credit"] as const;

export function parsePaymentMethod(value: unknown, fallback = "cash") {
  const method = String(value || fallback);
  return METHODS.includes(method as (typeof METHODS)[number]) ? method : "";
}

export async function recordLedgerPayment(input: {
  docType: "sale" | "service" | "purchase";
  docId: unknown;
  docNo?: string;
  partyId?: unknown;
  partyName?: string;
  method: string;
  amount: number;
  reference?: string;
  note?: string;
  paidAt?: Date;
  createdBy?: string;
}) {
  await PaymentLedger.create({
    docType: input.docType,
    docModel: input.docType === "service" ? "ServiceJob" : input.docType === "purchase" ? "Purchase" : "Sale",
    docId: input.docId,
    docNo: input.docNo,
    partyId: input.partyId || undefined,
    partyName: input.partyName,
    method: input.method,
    amount: roundMoney(input.amount),
    reference: input.reference,
    note: input.note,
    paidAt: input.paidAt || new Date(),
    createdBy: input.createdBy || undefined,
  });
}

export function applyPaymentOnDoc(
  doc: {
    payments?: { method?: string; amount?: number; reference?: string; note?: string; paidAt?: Date }[];
    paidAmount?: number;
    dueAmount?: number;
    grandTotal?: number;
  },
  input: { method: string; amount: number; reference?: string; note?: string; paidAt?: Date },
) {
  const amount = roundMoney(input.amount);
  if (!Array.isArray(doc.payments)) doc.payments = [];
  doc.payments.push({
    method: input.method,
    amount,
    reference: input.reference,
    note: input.note,
    paidAt: input.paidAt || new Date(),
  });
  doc.paidAmount = roundMoney(Number(doc.paidAmount || 0) + amount);
  doc.dueAmount = calcDueAmount(doc.grandTotal || 0, doc.paidAmount);
  return amount;
}

export { METHODS as PAYMENT_METHODS };
