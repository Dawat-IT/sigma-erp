/**
 * Canonical demo catalog for Sigma Elevator ERP.
 * Product ← ProductSupplier → Contact(supplier) is the source of truth for supplier prices.
 * Product rows come from the company Item List PDF (`docs/Item List-2.pdf`).
 */

import ITEM_LIST from "./item-list-catalog.json";

export const DEMO_ADMIN = {
  email: "admin@royalgroup.bd",
  password: "admin123",
  name: "সিস্টেম অ্যাডমিন",
  phone: "01700000000",
};

/** Local demo aliases only. Production unlocks solely via `admin@sigmaelevator.bd`. */
const LEGACY_ADMIN_ALIASES = [
  "admin@sigmaelevator.bd",
  "admin@ditpharma.bd",
  "admin@greenpharma.bd",
  "admin@nureng.bd",
  "admin@nurengineering.bd",
  "admin",
];

export const DEMO_ADMIN_ALIASES = [DEMO_ADMIN.email, ...LEGACY_ADMIN_ALIASES];

export const DEMO_MANAGER = {
  email: "manager@royalgroup.bd",
  password: "manager123",
  name: "জেনারেল ম্যানেজার",
  phone: "01700000001",
};

const LEGACY_MANAGER_ALIASES = [
  "manager@sigmaelevator.bd",
  "manager",
];

export const DEMO_MANAGER_ALIASES = [DEMO_MANAGER.email, ...LEGACY_MANAGER_ALIASES];

/** Fixed catalog suppliers used on product cards (stable mobiles = stable identity) */
export const CATALOG_SUPPLIERS = [
  {
    name: "Sigma Spares Desk",
    nameBn: "সিগমা স্পেয়ার্স ডেস্ক",
    mobile: "01810000001",
    address: "Dhanmondi HQ, Dhaka",
    city: "Dhaka",
  },
  {
    name: "Lift Parts BD",
    nameBn: "লিফট পার্টস বিডি",
    mobile: "01810000002",
    address: "Tejgaon Industrial Area, Dhaka",
    city: "Dhaka",
  },
  {
    name: "Door & Drive Traders",
    nameBn: "ডোর অ্যান্ড ড্রাইভ ট্রেডার্স",
    mobile: "01810000003",
    address: "Agrabad, Chittagong",
    city: "Chittagong",
  },
] as const;

export const EXTRA_SUPPLIERS = [
  { name: "Wittur-line Import", nameBn: "উইটুর-লাইন ইমপোর্ট", mobile: "01820000011", address: "Motijheel, Dhaka", city: "Dhaka" },
  { name: "Rope & Oil House", nameBn: "রোপ অ্যান্ড অয়েল হাউস", mobile: "01820000012", address: "Sylhet Sadar", city: "Sylhet" },
  { name: "Controller Hub BD", nameBn: "কন্ট্রোলার হাব বিডি", mobile: "01820000013", address: "Rajshahi", city: "Rajshahi" },
  { name: "ARD Battery Store", nameBn: "এআরডি ব্যাটারি স্টোর", mobile: "01820000014", address: "Khulna", city: "Khulna" },
  { name: "COP Fixture Mart", nameBn: "সিওপি ফিক্সচার মার্ট", mobile: "01820000015", address: "Gazipur", city: "Gazipur" },
  { name: "Guide Shoe Supply", nameBn: "গাইড শু সাপ্লাই", mobile: "01820000016", address: "Tongi, Gazipur", city: "Gazipur" },
  { name: "VVVF Drive BD", nameBn: "ভিভিভিএফ ড্রাইভ বিডি", mobile: "01820000017", address: "Bogura", city: "Bogura" },
  { name: "Roller & Door Co.", nameBn: "রোলার অ্যান্ড ডোর কো.", mobile: "01820000018", address: "Comilla", city: "Comilla" },
] as const;

/** Category → preferred alternate supplier name (different per product family) */
export const CATEGORY_ALT_SUPPLIER: Record<string, string> = {
  ARD: "ARD Battery Store",
  COP: "COP Fixture Mart",
  LOP: "COP Fixture Mart",
  Display: "COP Fixture Mart",
  "Push Switch": "COP Fixture Mart",
  Inverter: "VVVF Drive BD",
  "Main Motor": "VVVF Drive BD",
  "Door Operater": "Roller & Door Co.",
  "Door Motor": "Roller & Door Co.",
  "Door Hanger": "Roller & Door Co.",
  "DOOR Panel": "Roller & Door Co.",
  "Cabin Door cam": "Roller & Door Co.",
  "Door Shoe": "Roller & Door Co.",
  Roller: "Roller & Door Co.",
  Transformer: "Controller Hub BD",
  Resistor: "Controller Hub BD",
  CCB: "Controller Hub BD",
  CTB: "Controller Hub BD",
  Uncategorized: "Lift Parts BD",
};

export const LOCATIONS = [
  { name: "Dhanmondi HQ Store", code: "LOC001", address: "Road 5, Dhanmondi, Dhaka", phone: "01711000001" },
  { name: "Mirpur Warehouse", code: "LOC002", address: "Mirpur-10, Dhaka", phone: "01711000002" },
  { name: "Chittagong Branch", code: "LOC003", address: "Agrabad, Chittagong", phone: "01711000003" },
  { name: "Sylhet Outlet", code: "LOC004", address: "Zindabazar, Sylhet", phone: "01711000004" },
  { name: "Rajshahi Depot", code: "LOC005", address: "Shaheb Bazar, Rajshahi", phone: "01711000005" },
  { name: "Uttara Stock Point", code: "LOC006", address: "Sector 7, Uttara, Dhaka", phone: "01711000006" },
] as const;

const CATEGORY_BN: Record<string, string> = {
  ARD: "এআরডি",
  Buffer: "বাফার",
  CCB: "সিসিবি",
  COP: "সিওপি",
  CTB: "সিটিবি",
  "Cabin Door cam": "কেবিন ডোর ক্যাম",
  "Carcuit Braker": "সার্কিট ব্রেকার",
  "DOOR Panel": "ডোর প্যানেল",
  Display: "ডিসপ্লে",
  "Door Hanger": "ডোর হ্যাঙ্গার",
  "Door Motor": "ডোর মোটর",
  "Door Operater": "ডোর অপারেটর",
  "Door Shoe": "ডোর শু",
  Fan: "ফ্যান",
  Inverter: "ইনভার্টার",
  LOP: "এলওপি",
  Magnetic: "ম্যাগনেটিক",
  "Main Motor": "মেইন মোটর",
  "Photo Sensor": "ফটো সেন্সর",
  "Power Supply": "পাওয়ার সাপ্লাই",
  Pully: "পুলি",
  "Push Switch": "পুশ সুইচ",
  Resistor: "রেজিস্টর",
  Roller: "রোলার",
  Rottary: "রোটারি",
  "Safety Gear": "সেফটি গিয়ার",
  Shoe: "শু",
  Speed: "স্পিড",
  Transformer: "ট্রান্সফরমার",
  Uncategorized: "অশ্রেণীবদ্ধ",
};

export type ProductSeed = {
  name: string;
  nameBn: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  unitBn: string;
  purchasePrice: number;
  sellPrice: number;
  wholesalePrice: number;
  quantity: number;
  alertQty: number;
  /** Relative price factors vs purchasePrice for catalog suppliers [0],[1],[2] */
  supplierFactors?: [number, number, number];
};

type ItemListRow = Omit<ProductSeed, "nameBn" | "supplierFactors">;

export const PRODUCTS: ProductSeed[] = (ITEM_LIST as ItemListRow[])
  .slice()
  .sort((a, b) => a.sku.localeCompare(b.sku))
  .map((row) => ({ ...row, nameBn: row.name }));

export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.category)))
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({ name, nameBn: CATEGORY_BN[name] || name }));

export const BRANDS = Array.from(new Set(PRODUCTS.map((p) => p.brand))).sort((a, b) =>
  a.localeCompare(b),
);

export const UNITS = [
  { name: "Piece", shortName: "Pcs" },
  { name: "Set", shortName: "Set" },
  { name: "Box", shortName: "Box" },
  { name: "Pack", shortName: "Pack" },
  { name: "Pair", shortName: "Pair" },
  { name: "Litre", shortName: "L" },
  { name: "Meter", shortName: "m" },
  { name: "Foot", shortName: "ft" },
  { name: "Roll", shortName: "Roll" },
] as const;

export const CUSTOMER_GROUPS = [
  { name: "Retail", discountPercent: 0 },
  { name: "Dealer", discountPercent: 5 },
  { name: "Wholesale", discountPercent: 8 },
  { name: "VIP Campus", discountPercent: 10 },
  { name: "Corporate", discountPercent: 12 },
] as const;

export const ROLES = [
  { name: "Admin", permissions: ["all"] },
  { name: "Manager", permissions: ["pos", "sales", "stock", "purchases", "reports"] },
  { name: "Cashier", permissions: ["pos", "sales"] },
  { name: "Accountant", permissions: ["accounts", "reports"] },
  { name: "Warehouse", permissions: ["stock", "purchases"] },
  { name: "Viewer", permissions: ["reports"] },
] as const;

export const ACCOUNTS = [
  { name: "Main Cash", type: "cash" as const, accountNo: "CASH-01", openingBalance: 50000, balance: 125000 },
  { name: "DBBL Business", type: "bank" as const, accountNo: "DBBL-4421", openingBalance: 200000, balance: 485000 },
  { name: "bKash Merchant", type: "bkash" as const, accountNo: "01700000000", openingBalance: 10000, balance: 42000 },
  { name: "Nagad Business", type: "nagad" as const, accountNo: "01800000000", openingBalance: 8000, balance: 18500 },
  { name: "Rocket Merchant", type: "rocket" as const, accountNo: "01900000000", openingBalance: 5000, balance: 9200 },
] as const;

export const LEDGER_ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", nameBn: "হাতে নগদ", type: "asset" as const },
  { code: "1100", name: "Inventory Asset", nameBn: "ইনভেন্টরি সম্পদ", type: "asset" as const },
  { code: "1200", name: "Accounts Receivable", nameBn: "প্রাপ্য হিসাব", type: "asset" as const },
  { code: "2000", name: "Accounts Payable", nameBn: "প্রদেয় হিসাব", type: "liability" as const },
  { code: "3000", name: "Owner Equity", nameBn: "মালিকানার ইকুইটি", type: "equity" as const },
  { code: "4000", name: "Sales Income", nameBn: "বিক্রয় আয়", type: "income" as const },
  { code: "4100", name: "Service Income", nameBn: "সার্ভিস আয়", type: "income" as const },
  { code: "5000", name: "Cost of Goods Sold", nameBn: "বিক্রীত পণ্যের ব্যয়", type: "expense" as const },
  { code: "5100", name: "Purchase Expense", nameBn: "ক্রয় ব্যয়", type: "expense" as const },
  { code: "5200", name: "Salary Expense", nameBn: "বেতন ব্যয়", type: "expense" as const },
] as const;

export const EXPENSE_CATEGORIES = [
  "Transport",
  "Utility",
  "Salary",
  "Marketing",
  "Maintenance",
  "Office",
  "Rent",
  "Fuel",
  "Internet",
  "Training",
] as const;

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export function offerPrices(
  purchasePrice: number,
  factors: [number, number, number] = [0.92, 1, 1.08],
) {
  return factors.map((f) => Math.max(1, Math.round(purchasePrice * f)));
}
