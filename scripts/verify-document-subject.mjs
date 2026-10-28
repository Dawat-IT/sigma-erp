import { generateSubjectFromItems, resolveDocumentSubject } from "../src/lib/document-subject.ts";

const terms = [
  "Term of validity : 15 days.",
  "Payment: 100% advance for order confirmation OR as per company policy.",
  "Delivery Time: Ready stock item.",
].join("\n");

const mouldItems = [
  { name: "Ejector part design", description: "Ejector parts design and making As per sample" },
  { name: "Seat cover making mould servicing", description: "Injection molding machine servicing" },
];

const motorItems = [
  { name: "DC Motor 12V", description: "DC Motor 6V 12 month warranty" },
  { name: "DC Motor 6V", description: "DC Motor 6V 12 month warranty" },
  { name: "Arduino Uno Kit Clone", description: "DC Motor 6V 12 month warranty" },
];

const cases = [
  {
    name: "mould subject from items",
    got: generateSubjectFromItems(mouldItems),
    pass: (v) => v.includes("Ejector part") && v.includes("Seat cover") && /injection mold/i.test(v),
  },
  {
    name: "terms never used as subject",
    got: resolveDocumentSubject({ stored: terms.replace(/\n/g, " "), terms, note: terms, items: motorItems }),
    pass: (v) => !/term of validity/i.test(v) && !/100% advance/i.test(v) && v.includes("DC Motor 12V"),
  },
  {
    name: "explicit subject kept when not terms",
    got: resolveDocumentSubject({ stored: "Custom spare parts supply.", terms, items: motorItems }),
    pass: (v) => v === "Custom spare parts supply.",
  },
  {
    name: "quotation and bill share helper",
    got: resolveDocumentSubject({ stored: "", terms, items: mouldItems }),
    pass: (v) => v.includes("Ejector part") && !/payment/i.test(v),
  },
];

let failed = 0;
for (const test of cases) {
  const ok = test.pass(test.got);
  console.log(`${ok ? "PASS" : "FAIL"}  ${test.name}`);
  console.log(`       ${test.got}`);
  if (!ok) failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log("SQA subject isolation: all checks passed");
