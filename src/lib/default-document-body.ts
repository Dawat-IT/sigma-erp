const COMPANY_PLACEHOLDER = "[COMPANY_NAME]";
const QUOTATION_FOR_RE = /We are submitting Quotation for .+?\./;
const PROPOSAL_FOR_RE = /We are submitting a commercial proposal for .+?\./;

export function defaultDocumentBody(companyName = "") {
  const name = companyName.trim() || COMPANY_PLACEHOLDER;
  return [
    "Dear Sir,",
    `Thank you for your valued inquiry. We are submitting Quotation for ${name}.`,
    "Royal Group of Bangladesh is a professional elevator company providing passenger lifts, cargo lifts, spare parts, installation, modernization and technical support across Bangladesh.",
    "We continuously supply elevator systems, spare parts and after-sales service to commercial buildings, factories, hospitals and residential projects.",
  ].join("\n");
}

export function defaultProposalBody(companyName = "") {
  const name = companyName.trim() || COMPANY_PLACEHOLDER;
  return [
    "Dear Sir,",
    `Thank you for your valued inquiry. We are submitting a commercial proposal for ${name}.`,
    "This proposal outlines the lift / spare-parts scope. After you accept it we will issue a priced quotation / PI, then confirm the new order.",
    "Royal Group of Bangladesh is a professional elevator company providing passenger lifts, cargo lifts, spare parts, installation, modernization and technical support across Bangladesh.",
  ].join("\n");
}

export const DEFAULT_DOCUMENT_BODY = defaultDocumentBody();
export const DEFAULT_PROPOSAL_BODY = defaultProposalBody();

/** Replace only the company name in the "Quotation for …" / proposal sentence. */
export function withQuotationCompanyName(body: string, companyName: string) {
  const name = companyName.trim();
  if (!name) return body;
  if (PROPOSAL_FOR_RE.test(body)) {
    return body.replace(PROPOSAL_FOR_RE, `We are submitting a commercial proposal for ${name}.`);
  }
  if (!QUOTATION_FOR_RE.test(body)) return body;
  return body.replace(QUOTATION_FOR_RE, `We are submitting Quotation for ${name}.`);
}

