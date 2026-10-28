export type PaymentStatus = "paid" | "partial" | "due";

export function roundMoney(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function calcDueAmount(grandTotal: number, paidAmount: number) {
  return roundMoney(Math.max(0, roundMoney(grandTotal) - roundMoney(paidAmount)));
}

/** Invoice Total − Total Paid = Due. Status follows that balance. */
export function paymentStatusFromAmounts(
  grandTotal: number,
  paidAmount: number,
): PaymentStatus {
  const due = calcDueAmount(grandTotal, paidAmount);
  const paid = roundMoney(paidAmount);
  if (due <= 0) return "paid";
  if (paid > 0) return "partial";
  return "due";
}

export function paymentStatusBadgeClass(status: PaymentStatus) {
  if (status === "paid") return "gp-badge gp-badge-success";
  if (status === "partial") return "gp-badge gp-badge-warn";
  return "gp-badge gp-badge-danger";
}
