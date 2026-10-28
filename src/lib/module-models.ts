import {
  User,
  Role,
  CommissionAgent,
  CustomerGroup,
  Brand,
  Unit,
  Category,
  SellReturn,
  PurchaseReturn,
  Shipment,
  Discount,
  PurchaseRequisition,
  ExpenseCategory,
  NotificationTemplate,
  Project,
  Production,
  Recipe,
  Lead,
  Account,
  StockTransfer,
  StockAdjustment,
  Product,
  Contact,
  Expense,
  Purchase,
  Sale,
} from "@/models";

export type ModuleHandler = {
  model: typeof User;
  search?: string[];
  sort?: string;
  softDelete?: boolean;
  filter?: Record<string, unknown>;
};

export const MODULE_MODEL_MAP: Record<string, ModuleHandler> = {
  users: { model: User as never, search: ["name", "email"] },
  roles: { model: Role as never, search: ["name"] },
  "commission-agents": { model: CommissionAgent as never, search: ["name", "mobile"], softDelete: true },
  "customer-groups": { model: CustomerGroup as never, search: ["name"] },
  brands: { model: Brand as never, search: ["name"] },
  units: { model: Unit as never, search: ["name"] },
  categories: { model: Category as never, search: ["name", "nameBn"], filter: { kind: "product" } },
  "sell-returns": { model: SellReturn as never, sort: "-returnDate", search: ["returnNo", "customerName", "challanNo", "referenceNo", "invoiceNo", "status"] },
  "purchase-returns": { model: PurchaseReturn as never, sort: "-returnDate" },
  shipments: { model: Shipment as never, sort: "-createdAt", search: ["shipmentNo", "customerName", "invoiceNo", "referenceNo"] },
  discounts: { model: Discount as never, search: ["name"], softDelete: true },
  "purchase-requisitions": { model: PurchaseRequisition as never, sort: "-createdAt" },
  "expense-categories": { model: ExpenseCategory as never, search: ["name"], filter: { kind: "expense" } },
  "notification-templates": { model: NotificationTemplate as never, search: ["name"] },
  projects: { model: Project as never, search: ["name"] },
  productions: { model: Production as never, sort: "-productionDate" },
  recipes: { model: Recipe as never },
  leads: { model: Lead as never, search: ["name", "mobile", "email", "company", "product", "ownerName", "source"] },
  accounts: { model: Account as never, search: ["name"], softDelete: true },
  "stock-transfers": { model: StockTransfer as never, sort: "-transferDate" },
  "stock-adjustments": { model: StockAdjustment as never, sort: "-adjustmentDate" },
  products: { model: Product as never, search: ["name", "sku"], softDelete: true },
  customers: { model: Contact as never, search: ["name", "mobile"], softDelete: true },
  suppliers: { model: Contact as never, search: ["name", "mobile"], softDelete: true },
  expenses: { model: Expense as never, sort: "-expenseDate" },
  purchases: { model: Purchase as never, sort: "-purchaseDate" },
  sales: { model: Sale as never, sort: "-saleDate" },
};

export function getModuleHandler(key: string) {
  return MODULE_MODEL_MAP[key];
}
