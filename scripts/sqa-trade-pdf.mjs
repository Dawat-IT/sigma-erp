import { buildTradePdf } from "../src/lib/nes-trade-pdf.ts";

const terms = "Term of validity : 15 days.\nPayment: 100% advance for order confirmation OR as per company policy.\nDelivery Time: Ready stock item.";
const items = [
  { name: "DC Motor 12V", description: "DC Motor 6V 12 month warranty", qty: 17, unitPrice: 250, lineTotal: 4250 },
  { name: "DC Motor 6V", description: "DC Motor 6V 12 month warranty", qty: 16, unitPrice: 180, lineTotal: 2880 },
  { name: "Arduino Uno Kit Clone", description: "DC Motor 6V 12 month warranty", qty: 17, unitPrice: 1150, lineTotal: 19550 },
];
const sale = {
  invoiceNo: "DIT-2026-00009",
  quotationNo: "NES2026000125",
  referenceNo: "NES2026000125",
  salesOrderNo: "SO-2026-00009",
  subject: terms.replace(/\n/g, " "),
  terms,
  note: terms,
  documentBody: "Dear Sir,\nThank you for your valued inquiry.",
  customerName: "SK Pharma",
  customerMobile: "01733917395",
  customerAddress: "Tongi, Gazipur-1710",
  items,
  grandTotal: 26680,
  paidAmount: 0,
  dueAmount: 26680,
  saleDate: "2026-09-19",
};

function pdfText(doc) {
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

let failed = 0;
for (const kind of ["quotation", "bill", "challan"]) {
  for (const headerFooter of [true, false]) {
    const doc = await buildTradePdf({
      kind,
      sale,
      challanNo: "DC-2026-00009",
      challanItems: items,
      headerFooter,
      business: {
        name: "Sigma Elevator",
        address: "House#43-44, Road-1, Block-B, Mirpur-1, Dhaka-1216",
        phone: "01700000000",
        email: "info@example.com",
      },
    });
    const text = pdfText(doc);
    const label = `${kind} hf=${headerFooter ? 1 : 0}`;
    const hasBadSubject = /Subject:\s*Term of validity/i.test(text);
    const hasGoodSubject = /Subject:\s*DC Motor 12V/i.test(text);
    const hasTermsSection = /Terms & Conditions/i.test(text);
    const hasHeaderBrand = /Sigma Elevator/.test(text);
    if (hasBadSubject) {
      console.log(`FAIL  ${label} terms leaked into Subject`);
      failed += 1;
    } else if (!hasGoodSubject) {
      console.log(`FAIL  ${label} missing item-based Subject`);
      failed += 1;
    } else if (!hasTermsSection) {
      console.log(`FAIL  ${label} missing Terms section`);
      failed += 1;
    } else if (headerFooter && !hasHeaderBrand) {
      console.log(`FAIL  ${label} missing visible header brand`);
      failed += 1;
    } else {
      console.log(`PASS  ${label} pages=${doc.getNumberOfPages()} subject isolated, terms present`);
    }
  }
}

if (failed) process.exit(1);
console.log("SQA trade PDFs: all checks passed");
