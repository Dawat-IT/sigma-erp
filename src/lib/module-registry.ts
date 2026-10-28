export type ModuleColumn = {
  key: string;
  labelBn: string;
  labelEn: string;
  format?: "money" | "date" | "number";
};

export type ModuleDef = {
  id: string;
  titleBn: string;
  titleEn: string;
  apiPath: string;
  columns: ModuleColumn[];
  canAdd?: boolean;
  addHref?: string;
  reportType?: "table" | "summary";
};

export const MODULE_REGISTRY: Record<string, ModuleDef> = {
  users: {
    id: "users",
    titleBn: "ব্যবহারকারী",
    titleEn: "Users",
    apiPath: "/api/modules/users",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "email", labelBn: "ইমেইল", labelEn: "Email" },
      { key: "role", labelBn: "ভূমিকা", labelEn: "Role" },
      { key: "phone", labelBn: "ফোন", labelEn: "Phone" },
    ],
  },
  roles: {
    id: "roles",
    titleBn: "ভূমিকা",
    titleEn: "Roles",
    apiPath: "/api/modules/roles",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "permissions", labelBn: "অনুমতি", labelEn: "Permissions" },
    ],
  },
  "commission-agents": {
    id: "commission-agents",
    titleBn: "কমিশন এজেন্ট",
    titleEn: "Commission Agents",
    apiPath: "/api/modules/commission-agents",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
      { key: "commissionPercent", labelBn: "কমিশন %", labelEn: "Commission %" },
    ],
  },
  customers: {
    id: "customers",
    titleBn: "কাস্টমার",
    titleEn: "Customers",
    apiPath: "/api/contacts?type=customer",
    canAdd: true,
    addHref: "/contacts/customers",
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
      { key: "balance", labelBn: "প্রাপ্য (Receivable)", labelEn: "Receivable", format: "money" },
    ],
  },
  suppliers: {
    id: "suppliers",
    titleBn: "সরবরাহকারী",
    titleEn: "Suppliers",
    apiPath: "/api/contacts?type=supplier",
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
      { key: "balance", labelBn: "প্রদেয় (Payable)", labelEn: "Payable", format: "money" },
    ],
  },
  employees: {
    id: "employees",
    titleBn: "কর্মচারী",
    titleEn: "Employees",
    apiPath: "/api/contacts?type=employee",
    canAdd: true,
    addHref: "/contacts/employees",
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
      { key: "designation", labelBn: "পদবি", labelEn: "Designation" },
      { key: "basicSalary", labelBn: "বেসিক", labelEn: "Basic", format: "money" },
      { key: "balance", labelBn: "বর্তমান ব্যালেন্স", labelEn: "Balance", format: "money" },
    ],
  },
  "customer-groups": {
    id: "customer-groups",
    titleBn: "গ্রাহক গ্রুপ",
    titleEn: "Customer Groups",
    apiPath: "/api/modules/customer-groups",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "discountPercent", labelBn: "ছাড় %", labelEn: "Discount %" },
    ],
  },
  products: {
    id: "products",
    titleBn: "পণ্য তালিকা",
    titleEn: "Products",
    apiPath: "/api/products",
    canAdd: true,
    addHref: "/products/add",
    columns: [
      { key: "name", labelBn: "পণ্য", labelEn: "Product" },
      { key: "sku", labelBn: "এসকেইউ", labelEn: "SKU" },
      { key: "sellPrice", labelBn: "বিক্রয় মূল্য", labelEn: "Sell Price", format: "money" },
      { key: "locationQty", labelBn: "স্টক", labelEn: "Stock", format: "number" },
    ],
  },
  purchases: {
    id: "purchases",
    titleBn: "ক্রয় তালিকা",
    titleEn: "Purchases",
    apiPath: "/api/purchases",
    canAdd: true,
    addHref: "/purchases/add",
    columns: [
      { key: "referenceNo", labelBn: "রেফারেন্স", labelEn: "Reference" },
      { key: "supplierName", labelBn: "সরবরাহকারী", labelEn: "Supplier" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
      { key: "purchaseDate", labelBn: "তারিখ", labelEn: "Date", format: "date" },
    ],
  },
  sales: {
    id: "sales",
    titleBn: "সব বিক্রি",
    titleEn: "All Sales",
    apiPath: "/api/sales",
    canAdd: true,
    addHref: "/pos",
    columns: [
      { key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
      { key: "saleDate", labelBn: "তারিখ", labelEn: "Date", format: "date" },
    ],
  },
  "sales-drafts": {
    id: "sales-drafts",
    titleBn: "খসড়া বিক্রি",
    titleEn: "Draft Sales",
    apiPath: "/api/sales?status=draft",
    columns: [
      { key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
    ],
  },
  "sales-quotes": {
    id: "sales-quotes",
    titleBn: "কোটেশন",
    titleEn: "Quotations",
    apiPath: "/api/sales?status=quotation",
    columns: [
      { key: "quotationNo", labelBn: "কোটেশন নং", labelEn: "Quotation No" },
      { key: "referenceNo", labelBn: "রেফারেন্স", labelEn: "Ref. No" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
    ],
  },
  "sales-proposals": {
    id: "sales-proposals",
    titleBn: "প্রস্তাবনা",
    titleEn: "Proposals",
    apiPath: "/api/sales?status=proposal",
    columns: [
      { key: "proposalNo", labelBn: "প্রস্তাবনা নং", labelEn: "Proposal No" },
      { key: "referenceNo", labelBn: "রেফারেন্স", labelEn: "Ref. No" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
    ],
  },
  "sell-returns": {
    id: "sell-returns",
    titleBn: "বিক্রি ফেরত",
    titleEn: "Sell Return List",
    apiPath: "/api/modules/sell-returns",
    canAdd: true,
    addHref: "/sales/returns/add",
    columns: [
      { key: "challanNo", labelBn: "চালান নং", labelEn: "Challan No" },
      { key: "returnDate", labelBn: "তারিখ", labelEn: "Date", format: "date" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "referenceNo", labelBn: "রেফারেন্স নং", labelEn: "Reference No" },
      { key: "invoiceNo", labelBn: "ইনভয়েস নং", labelEn: "Invoice No" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  "purchase-returns": {
    id: "purchase-returns",
    titleBn: "ক্রয় ফেরত",
    titleEn: "Purchase Returns",
    apiPath: "/api/modules/purchase-returns",
    columns: [
      { key: "returnNo", labelBn: "রিটার্ন নং", labelEn: "Return No" },
      { key: "supplierName", labelBn: "সরবরাহকারী", labelEn: "Supplier" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
    ],
  },
  shipments: {
    id: "shipments",
    titleBn: "শিপমেন্ট",
    titleEn: "Shipments",
    apiPath: "/api/modules/shipments",
    columns: [
      { key: "shipmentNo", labelBn: "শিপমেন্ট নং", labelEn: "Shipment No" },
      { key: "customerName", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  discounts: {
    id: "discounts",
    titleBn: "ছাড়",
    titleEn: "Discounts",
    apiPath: "/api/modules/discounts",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "discountType", labelBn: "ধরন", labelEn: "Type" },
      { key: "value", labelBn: "মান", labelEn: "Value" },
    ],
  },
  "purchase-requisition": {
    id: "purchase-requisition",
    titleBn: "ক্রয় চাহিদা",
    titleEn: "Purchase Requisition",
    apiPath: "/api/modules/purchase-requisitions",
    canAdd: true,
    columns: [
      { key: "reqNo", labelBn: "চাহিদা নং", labelEn: "Req No" },
      { key: "locationName", labelBn: "লোকেশন", labelEn: "Location" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  "stock-transfers": {
    id: "stock-transfers",
    titleBn: "স্টক স্থানান্তর",
    titleEn: "Stock Transfers",
    apiPath: "/api/modules/stock-transfers",
    canAdd: true,
    addHref: "/stock/transfers/add",
    columns: [
      { key: "transferNo", labelBn: "ট্রান্সফার নং", labelEn: "Transfer No" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
      { key: "transferDate", labelBn: "তারিখ", labelEn: "Date", format: "date" },
    ],
  },
  "stock-adjustments": {
    id: "stock-adjustments",
    titleBn: "স্টক সমন্বয়",
    titleEn: "Stock Adjustments",
    apiPath: "/api/modules/stock-adjustments",
    canAdd: true,
    addHref: "/stock/adjustments/add",
    columns: [
      { key: "adjustmentNo", labelBn: "সমন্বয় নং", labelEn: "Adjustment No" },
      { key: "note", labelBn: "নোট", labelEn: "Note" },
      { key: "adjustmentDate", labelBn: "তারিখ", labelEn: "Date", format: "date" },
    ],
  },
  expenses: {
    id: "expenses",
    titleBn: "খরচ",
    titleEn: "Expenses",
    apiPath: "/api/expenses",
    canAdd: true,
    addHref: "/expenses/add",
    columns: [
      { key: "category", labelBn: "ক্যাটাগরি", labelEn: "Category" },
      { key: "title", labelBn: "বিবরণ", labelEn: "Title" },
      { key: "amount", labelBn: "পরিমাণ", labelEn: "Amount", format: "money" },
    ],
  },
  "expense-categories": {
    id: "expense-categories",
    titleBn: "খরচের ক্যাটাগরি",
    titleEn: "Expense Categories",
    apiPath: "/api/modules/expense-categories",
    canAdd: true,
    columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }],
  },
  accounts: {
    id: "accounts",
    titleBn: "পেমেন্ট অ্যাকাউন্ট",
    titleEn: "Payment Accounts",
    apiPath: "/api/modules/accounts",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "type", labelBn: "ধরন", labelEn: "Type" },
      { key: "balance", labelBn: "ব্যালেন্স", labelEn: "Balance", format: "money" },
    ],
  },
  "mfg-recipes": {
    id: "mfg-recipes",
    titleBn: "রেসিপি",
    titleEn: "Recipes",
    apiPath: "/api/modules/recipes",
    canAdd: true,
    columns: [
      { key: "finishedProductName", labelBn: "পণ্য", labelEn: "Product" },
      { key: "outputQty", labelBn: "আউটপুট", labelEn: "Output" },
    ],
  },
  "mfg-production": {
    id: "mfg-production",
    titleBn: "উৎপাদন",
    titleEn: "Production",
    apiPath: "/api/modules/productions",
    canAdd: true,
    columns: [
      { key: "productionNo", labelBn: "প্রোডাকশন নং", labelEn: "Production No" },
      { key: "productName", labelBn: "পণ্য", labelEn: "Product" },
      { key: "qty", labelBn: "পরিমাণ", labelEn: "Qty" },
    ],
  },
  "crm-leads": {
    id: "crm-leads",
    titleBn: "লিড",
    titleEn: "Leads",
    apiPath: "/api/crm/leads",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  "notification-templates": {
    id: "notification-templates",
    titleBn: "নোটিফিকেশন টেমপ্লেট",
    titleEn: "Notification Templates",
    apiPath: "/api/modules/notification-templates",
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "type", labelBn: "ধরন", labelEn: "Type" },
    ],
  },
  categories: {
    id: "categories",
    titleBn: "ক্যাটাগরি",
    titleEn: "Categories",
    apiPath: "/api/modules/categories",
    canAdd: true,
    columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }],
  },
  brands: {
    id: "brands",
    titleBn: "ব্র্যান্ড",
    titleEn: "Brands",
    apiPath: "/api/modules/brands",
    canAdd: true,
    columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }],
  },
  units: {
    id: "units",
    titleBn: "একক",
    titleEn: "Units",
    apiPath: "/api/modules/units",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "shortName", labelBn: "সংক্ষিপ্ত", labelEn: "Short" },
    ],
  },
  project: {
    id: "project",
    titleBn: "প্রজেক্ট",
    titleEn: "Projects",
    apiPath: "/api/modules/projects",
    canAdd: true,
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  services: {
    id: "services",
    titleBn: "সার্ভিস রেকর্ড",
    titleEn: "Service records",
    apiPath: "/api/services",
    canAdd: true,
    addHref: "/services/new",
    columns: [
      { key: "jobNo", labelBn: "জব নং", labelEn: "Job No" },
      { key: "issueDescription", labelBn: "সমস্যা", labelEn: "Issue" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
      { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" },
    ],
  },
  "technical-service": {
    id: "technical-service",
    titleBn: "টেকনিক্যাল সার্ভিস",
    titleEn: "Technical service",
    apiPath: "/api/services?jobKind=complaint,scheduled,emergency",
    canAdd: true,
    addHref: "/services/technical/new",
    columns: [
      { key: "jobNo", labelBn: "জব নং", labelEn: "Job No" },
      { key: "issueDescription", labelBn: "সমস্যা", labelEn: "Issue" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  "project-install": {
    id: "project-install",
    titleBn: "প্রজেক্ট ও ইনস্টলেশন",
    titleEn: "Project & Installation",
    apiPath: "/api/services?jobKind=installation",
    canAdd: true,
    addHref: "/services/projects/new",
    columns: [
      { key: "jobNo", labelBn: "জব নং", labelEn: "Job No" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  machines: {
    id: "machines",
    titleBn: "মেশিন",
    titleEn: "Machines",
    apiPath: "/api/machines",
    canAdd: true,
    columns: [
      { key: "customerId", labelBn: "গ্রাহক", labelEn: "Customer" },
      { key: "brand", labelBn: "ব্র্যান্ড", labelEn: "Brand" },
      { key: "model", labelBn: "মডেল", labelEn: "Model" },
      { key: "serialNo", labelBn: "সিরিয়াল নং", labelEn: "Serial No" },
    ],
  },
  technicians: {
    id: "technicians",
    titleBn: "টেকনিশিয়ান",
    titleEn: "Technicians",
    apiPath: "/api/technicians",
    canAdd: true,
    addHref: "/services/technicians",
    columns: [
      { key: "name", labelBn: "নাম", labelEn: "Name" },
      { key: "mobile", labelBn: "মোবাইল", labelEn: "Mobile" },
    ],
  },
  payroll: {
    id: "payroll",
    titleBn: "পে-রোল",
    titleEn: "Payroll",
    apiPath: "/api/payroll",
    canAdd: true,
    addHref: "/hr/payroll",
    columns: [
      { key: "periodKey", labelBn: "মাস", labelEn: "Month" },
      { key: "netPay", labelBn: "নেট", labelEn: "Net", format: "money" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
  payslips: {
    id: "payslips",
    titleBn: "পেস্লিপ",
    titleEn: "Payslips",
    apiPath: "/api/payslips",
    canAdd: true,
    addHref: "/contacts/payslips",
    columns: [
      { key: "slipNo", labelBn: "নং", labelEn: "No" },
      { key: "employeeName", labelBn: "কর্মচারী", labelEn: "Employee" },
      { key: "netPay", labelBn: "নেট", labelEn: "Net", format: "money" },
      { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" },
    ],
  },
};

// Report modules share report API
const REPORT_IDS = [
  "report-profit-loss",
  "report-purchase-sell",
  "report-tax",
  "report-customer-supplier",
  "report-customer-groups",
  "report-stock",
  "report-stock-adjustment",
  "report-trending",
  "report-items",
  "report-product-purchase",
  "report-product-sell",
  "report-purchase-payment",
  "report-sell-payment",
  "report-expense",
  "report-register",
  "report-sales-rep",
  "report-activity-log",
  "report-service",
  "mfg-report",
  "balance-sheet",
  "trial-balance",
  "cash-flow",
  "account-report",
  "crm-reports",
];

for (const id of REPORT_IDS) {
  if (!MODULE_REGISTRY[id]) {
    MODULE_REGISTRY[id] = {
      id,
      titleBn: id.replace(/report-/, "").replace(/-/g, " "),
      titleEn: id.replace(/report-/, "").replace(/-/g, " "),
      apiPath: `/api/reports/${id.replace(/^report-/, "")}`,
      reportType: "summary",
      columns: [
        { key: "label", labelBn: "বিবরণ", labelEn: "Description" },
        { key: "value", labelBn: "মান", labelEn: "Value", format: "money" },
      ],
    };
  }
}

export function getModule(id: string): ModuleDef | undefined {
  return MODULE_REGISTRY[id];
}

const STUB_MODULES: ModuleDef[] = [
  { id: "import-contacts", titleBn: "যোগাযোগ ইমপোর্ট", titleEn: "Import Contacts", apiPath: "/api/contacts?type=customer", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "products-add", titleBn: "নতুন পণ্য", titleEn: "Add Product", apiPath: "/api/products", canAdd: true, addHref: "/products", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "products-price", titleBn: "মূল্য আপডেট", titleEn: "Update Price", apiPath: "/api/products", columns: [{ key: "name", labelBn: "পণ্য", labelEn: "Product" }, { key: "sellPrice", labelBn: "মূল্য", labelEn: "Price", format: "money" }] },
  { id: "products-labels", titleBn: "লেবেল প্রিন্ট", titleEn: "Print Labels", apiPath: "/api/products", columns: [{ key: "name", labelBn: "পণ্য", labelEn: "Product" }, { key: "sku", labelBn: "এসকেইউ", labelEn: "SKU" }] },
  { id: "variations", titleBn: "ভ্যারিয়েশন", titleEn: "Variations", apiPath: "/api/products", columns: [{ key: "name", labelBn: "পণ্য", labelEn: "Product" }] },
  { id: "products-import", titleBn: "পণ্য ইমপোর্ট", titleEn: "Import Products", apiPath: "/api/products", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "opening-stock", titleBn: "প্রারম্ভিক স্টক", titleEn: "Opening Stock", apiPath: "/api/products", columns: [{ key: "name", labelBn: "পণ্য", labelEn: "Product" }, { key: "locationQty", labelBn: "স্টক", labelEn: "Stock", format: "number" }] },
  { id: "price-groups", titleBn: "মূল্য গ্রুপ", titleEn: "Price Groups", apiPath: "/api/modules/customer-groups", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "warranties", titleBn: "ওয়ারেন্টি", titleEn: "Warranties", apiPath: "/api/products", columns: [{ key: "name", labelBn: "পণ্য", labelEn: "Product" }] },
  { id: "mfg-settings", titleBn: "উৎপাদন সেটিংস", titleEn: "Mfg Settings", apiPath: "/api/meta", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
  { id: "purchases-add", titleBn: "নতুন ক্রয়", titleEn: "Add Purchase", apiPath: "/api/purchases", canAdd: true, addHref: "/purchases", columns: [{ key: "referenceNo", labelBn: "রেফারেন্স", labelEn: "Reference" }] },
  { id: "sales-add", titleBn: "নতুন বিক্রি", titleEn: "Add Sale", apiPath: "/api/sales", canAdd: true, addHref: "/pos", columns: [{ key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" }] },
  { id: "pos-list", titleBn: "পিওএস তালিকা", titleEn: "POS List", apiPath: "/api/sales?status=final", columns: [{ key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" }, { key: "grandTotal", labelBn: "মোট", labelEn: "Total", format: "money" }] },
  { id: "sales-draft-add", titleBn: "খসড়া যোগ", titleEn: "Add Draft", apiPath: "/api/sales?status=draft", canAdd: true, addHref: "/pos", columns: [{ key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" }] },
  { id: "sales-quote-add", titleBn: "কোটেশন যোগ", titleEn: "Add Quotation", apiPath: "/api/sales?status=quotation", canAdd: true, addHref: "/pos?mode=quotation", columns: [{ key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" }] },
  { id: "sales-proposal-add", titleBn: "প্রস্তাবনা যোগ", titleEn: "Add Proposal", apiPath: "/api/sales?status=proposal", canAdd: true, addHref: "/pos?mode=proposal", columns: [{ key: "proposalNo", labelBn: "প্রস্তাবনা", labelEn: "Proposal" }] },
  { id: "import-sales", titleBn: "বিক্রি ইমপোর্ট", titleEn: "Import Sales", apiPath: "/api/sales", columns: [{ key: "invoiceNo", labelBn: "ইনভয়েস", labelEn: "Invoice" }] },
  { id: "stock-transfers-add", titleBn: "নতুন স্থানান্তর", titleEn: "Add Transfer", apiPath: "/api/modules/stock-transfers", canAdd: true, addHref: "/stock/transfers", columns: [{ key: "transferNo", labelBn: "নং", labelEn: "No" }] },
  { id: "stock-adjustments-add", titleBn: "নতুন সমন্বয়", titleEn: "Add Adjustment", apiPath: "/api/modules/stock-adjustments", canAdd: true, addHref: "/stock/adjustments", columns: [{ key: "adjustmentNo", labelBn: "নং", labelEn: "No" }] },
  { id: "expenses-add", titleBn: "খরচ যোগ", titleEn: "Add Expense", apiPath: "/api/expenses", canAdd: true, addHref: "/expenses", columns: [{ key: "title", labelBn: "বিবরণ", labelEn: "Title" }] },
  { id: "settings-locations", titleBn: "লোকেশন", titleEn: "Locations", apiPath: "/api/meta?type=locations", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }, { key: "code", labelBn: "কোড", labelEn: "Code" }] },
  { id: "settings-invoices", titleBn: "ইনভয়েস সেটিংস", titleEn: "Invoice Settings", apiPath: "/api/meta?type=business", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
  { id: "settings-barcodes", titleBn: "বারকোড সেটিংস", titleEn: "Barcode Settings", apiPath: "/api/meta", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }] },
  { id: "settings-printers", titleBn: "প্রিন্টার", titleEn: "Printers", apiPath: "/api/meta", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }] },
  { id: "settings-tax", titleBn: "কর হার", titleEn: "Tax Rates", apiPath: "/api/meta?type=business", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
  { id: "settings-subscription", titleBn: "সাবস্ক্রিপশন", titleEn: "Subscription", apiPath: "/api/meta", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
  { id: "settings-business", titleBn: "ব্যবসায়িক সেটিংস", titleEn: "Business Settings", apiPath: "/api/meta?type=business", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
  { id: "crm-dashboard", titleBn: "সিআরএম ড্যাশবোর্ড", titleEn: "CRM Dashboard", apiPath: "/api/crm/summary", columns: [{ key: "name", labelBn: "লিড", labelEn: "Lead" }, { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" }] },
  { id: "crm-followups", titleBn: "ফলো-আপ", titleEn: "Follow-ups", apiPath: "/api/crm/followups", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }, { key: "status", labelBn: "স্ট্যাটাস", labelEn: "Status" }] },
  { id: "crm-campaigns", titleBn: "ক্যাম্পেইন", titleEn: "Campaigns", apiPath: "/api/crm/campaigns", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "crm-clients", titleBn: "ক্লায়েন্ট", titleEn: "Clients", apiPath: "/api/crm/clients", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "crm-deals", titleBn: "ডিল পাইপলাইন", titleEn: "Deals Pipeline", apiPath: "/api/crm/deals", columns: [{ key: "title", labelBn: "ডিল", labelEn: "Deal" }] },
  { id: "crm-proposals", titleBn: "প্রস্তাবনা", titleEn: "Proposals", apiPath: "/api/modules/leads", columns: [{ key: "name", labelBn: "নাম", labelEn: "Name" }] },
  { id: "crm-settings", titleBn: "সিআরএম সেটিংস", titleEn: "CRM Settings", apiPath: "/api/meta", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Description" }] },
  { id: "calendar", titleBn: "ক্যালেন্ডার", titleEn: "Calendar", apiPath: "/api/meta?type=calendar", columns: [{ key: "label", labelBn: "ইভেন্ট", labelEn: "Event" }, { key: "value", labelBn: "তারিখ", labelEn: "Date" }] },
  { id: "profile", titleBn: "প্রোফাইল", titleEn: "Profile", apiPath: "/api/meta?type=profile", columns: [{ key: "label", labelBn: "বিবরণ", labelEn: "Field" }, { key: "value", labelBn: "মান", labelEn: "Value" }] },
];

for (const m of STUB_MODULES) {
  if (!MODULE_REGISTRY[m.id]) MODULE_REGISTRY[m.id] = m;
}
