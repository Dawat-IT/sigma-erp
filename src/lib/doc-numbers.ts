import { Business, Sale, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import { DEFAULT_PROPOSAL_TERMS } from "@/lib/sale-pipeline";
export { DEFAULT_PROPOSAL_TERMS };

function currentYear() {
  return new Date().getFullYear();
}

/** SIG + YEAR + 5-digit sequence, unique per year (atomic counter). */
export async function nextQuotationNo() {
  const year = currentYear();
  const seq = await nextSeq(`sig_qtn_${year}`);
  return `SIG${year}${String(seq).padStart(5, "0")}`;
}

/** PRP + YEAR + 5-digit sequence for commercial proposals. */
export async function nextProposalNo() {
  const year = currentYear();
  const seq = await nextSeq(`sig_prp_${year}`);
  return `PRP${year}${String(seq).padStart(5, "0")}`;
}

/** SIG + YEAR + 6-digit sequence starting at 101 → SIG2026000101. */
export async function nextReferenceNo() {
  const year = currentYear();
  const seq = await nextSeq(`sig_ref_${year}`, 100);
  return `SIG${year}${String(seq).padStart(6, "0")}`;
}

export async function nextSalesOrderNo() {
  return generateDocNo("SO", await nextSeq("sales_order"));
}

export async function nextInvoiceNo() {
  const business = await Business.findOne().lean();
  return generateDocNo(business?.invoicePrefix || "INV", await nextSeq("sale"));
}

export async function nextChallanNo() {
  return generateDocNo("DC", await nextSeq("shipment"));
}

let saleIndexesReady = false;

/** Quotations omit Bill No; sparse unique indexes allow that without colliding on null. */
export async function ensureSaleNumberIndexes() {
  if (saleIndexesReady) return;
  try {
    const indexes = await Sale.collection.indexes();
    const inv = indexes.find((i) => i.key && (i.key as { invoiceNo?: number }).invoiceNo === 1);
    if (inv?.name && !inv.sparse) {
      await Sale.collection.dropIndex(inv.name);
    }
    const qtn = indexes.find((i) => i.key && (i.key as { quotationNo?: number }).quotationNo === 1);
    if (qtn?.name && (qtn as { partialFilterExpression?: { status?: string } }).partialFilterExpression?.status !== "quotation") {
      await Sale.collection.dropIndex(qtn.name);
    }
    const ref = indexes.find((i) => i.key && (i.key as { referenceNo?: number }).referenceNo === 1);
    if (ref?.name && !ref.partialFilterExpression) {
      await Sale.collection.dropIndex(ref.name);
    }
  } catch {
    /* first boot / missing collection */
  }
  try {
    await Sale.collection.createIndex({ invoiceNo: 1 }, { unique: true, sparse: true });
    await Sale.collection.createIndex({ proposalNo: 1 }, { unique: true, sparse: true });
    await Sale.collection.createIndex(
      { quotationNo: 1 },
      { unique: true, sparse: true, partialFilterExpression: { status: "quotation" } },
    );
    await Sale.collection.createIndex({ salesOrderNo: 1 }, { unique: true, sparse: true });
    await Sale.collection.createIndex(
      { referenceNo: 1 },
      { unique: true, sparse: true, partialFilterExpression: { sourceQuotationId: { $exists: false } } },
    );
  } catch {
    /* already exists */
  }
  saleIndexesReady = true;
}

export const DEFAULT_QUOTATION_TERMS = [
  "Term of validity: 15 days.",
  "Payment: 100% advance for order confirmation OR as per company policy.",
  "Delivery area: Items delivered from stock area in Dhaka (customer's own arrangement).",
  "Delivery Time: Ready stock item.",
  "VAT, Tax etc.: Excluded.",
  "Please sign back to us if you confirm this P.I / Quotation.",
].join("\n");
