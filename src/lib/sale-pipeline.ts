export const ORDER_STAGES = ["proposal", "quotation", "final"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export function orderStageIndex(status?: string) {
  if (status === "proposal") return 1;
  if (status === "quotation") return 2;
  if (status === "final") return 3;
  return 0;
}

export function isOfferStatus(status?: string) {
  return status === "proposal" || status === "quotation";
}

export const DEFAULT_PROPOSAL_TERMS = [
  "This is a commercial proposal, not a confirmed order.",
  "Validity: 30 days from the proposal date.",
  "A formal quotation / PI will be issued after this proposal is accepted.",
  "Payment, delivery and warranty terms will be stated on the quotation.",
  "VAT, Tax etc.: Excluded unless stated.",
].join("\n");
