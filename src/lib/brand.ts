export const BRAND = {
  appName: "Royal Group ERP",
  appNameBn: "রয়েল গ্রুপ ইআরপি",
  company: "Royal Group of Bangladesh",
  companyBn: "রয়েল গ্রুপ অফ বাংলাদেশ",
  tagline: "ERP & POS for elevators, spare parts and technical service",
  taglineBn: "এলিভেটর, স্পেয়ার পার্টস এবং টেকনিক্যাল সার্ভিস এর জন্য ইআরপি ও পস",
  shortTag: "Royal Group",
  shortTagBn: "রয়েল গ্রুপ",
  description:
    "Lightweight bilingual ERP & POS for elevator sales, spare parts, installation and service",
  documentTagline: "OUR FIRST PRIORITY BEST QUALITY & BEST SERVICE.",
  logoMark: "R",
  logoMarkFull: "ROYAL GROUP",
  demoEmail: "admin@royalgroup.bd",
  demoPassword: "admin123",
  demoManagerEmail: "manager@royalgroup.bd",
  demoManagerPassword: "manager123",
  infoEmail: "sigma.ps2007@gmail.com",
  invoicePrefix: "RGL",
  quotationPrefix: "RGL",
} as const;

export function companyLetterhead(name?: string) {
  const v = String(name || "").trim();
  if (!v || /erp|\bpos\b/i.test(v) || /[^\u0000-\u007f]/.test(v)) {
    return "ROYAL ELEVATOR & ENGINEERS COMPANY";
  }
  return v;
}
