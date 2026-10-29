import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB, pruneOrphanCollections, pruneEmptyCollectionsClusterWide } from "@/lib/db";
import { applySessionCookie, createSessionToken, readSession } from "@/lib/auth";
import { ensureDemoAdminUser, ensureDemoManagerUser } from "@/lib/demo-admin";
import { seedBootstrapHeaderOk } from "@/lib/seed-guard";
import {
  ACCOUNTS,
  BRANDS,
  CATALOG_SUPPLIERS,
  CATEGORIES,
  CATEGORY_ALT_SUPPLIER,
  CUSTOMER_GROUPS,
  DEMO_ADMIN,
  EXPENSE_CATEGORIES,
  EXTRA_SUPPLIERS,
  LEDGER_ACCOUNTS,
  LOCATIONS,
  PRODUCTS,
  ROLES,
  UNITS,
  daysAgo,
  offerPrices,
} from "@/lib/seed-data";
import { defaultServiceLines, defaultVisitCharge } from "@/lib/service-catalog";
import { computeServiceTotals } from "@/lib/service-totals";
import { labourHoursFromMinutes, minutesBetween } from "@/lib/service-visit";
import {
  Business,
  Location,
  Category,
  Product,
  ProductSupplier,
  Contact,
  Account,
  LedgerAccount,
  User,
  Sale,
  Purchase,
  Expense,
  Role,
  CustomerGroup,
  Brand,
  Unit,
  SellReturn,
  PurchaseReturn,
  Shipment,
  PurchaseRequisition,
  Lead,
  CrmFollowUp,
  CrmClient,
  Recipe,
  CommissionAgent,
  Discount,
  ExpenseCategory,
  NotificationTemplate,
  Project,
  Production,
  StockTransfer,
  StockAdjustment,
  Counter,
  Machine,
  AmcContract,
  Technician,
  ServiceJob,
  Payslip,
  EmployeeLeave,
  Attendance,
  PaymentLedger,
  CrmDeal,
  CrmCampaign,
  JournalEntry,
  CylinderMovement,
  ActivityLog,
  nextSeq,
} from "@/models";
import { generateDocNo } from "@/lib/utils";
import { computePayrollTotals, currentPeriodKey, periodBounds, periodLabelFromKey, snapshotFromEmployee } from "@/lib/payroll";

async function wipeAllDemoData() {
  const emptyResult = await pruneEmptyCollectionsClusterWide();
  const pruneResult = await pruneOrphanCollections();

  await Promise.all([
    Business.deleteMany({}),
    Location.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    ProductSupplier.deleteMany({}),
    Contact.deleteMany({}),
    Account.deleteMany({}),
    Sale.deleteMany({}),
    Purchase.deleteMany({}),
    Expense.deleteMany({}),
    Role.deleteMany({}),
    CustomerGroup.deleteMany({}),
    Brand.deleteMany({}),
    Unit.deleteMany({}),
    SellReturn.deleteMany({}),
    PurchaseReturn.deleteMany({}),
    Shipment.deleteMany({}),
    PurchaseRequisition.deleteMany({}),
    Lead.deleteMany({}),
    CrmFollowUp.deleteMany({}),
    CrmClient.deleteMany({}),
    Recipe.deleteMany({}),
    CommissionAgent.deleteMany({}),
    Discount.deleteMany({}),
    ExpenseCategory.deleteMany({}),
    NotificationTemplate.deleteMany({}),
    Project.deleteMany({}),
    Production.deleteMany({}),
    StockTransfer.deleteMany({}),
    StockAdjustment.deleteMany({}),
    Counter.deleteMany({}),
    Machine.deleteMany({}),
    AmcContract.deleteMany({}),
    Technician.deleteMany({}),
    ServiceJob.deleteMany({}),
    Payslip.deleteMany({}),
    EmployeeLeave.deleteMany({}),
    Attendance.deleteMany({}),
    PaymentLedger.deleteMany({}),
    CrmDeal.deleteMany({}),
    CrmCampaign.deleteMany({}),
    JournalEntry.deleteMany({}),
    CylinderMovement.deleteMany({}),
    LedgerAccount.deleteMany({}),
    ActivityLog.deleteMany({}),
    User.deleteMany({}),
  ]);

  return {
    pruned: pruneResult.dropped,
    prunedEmpty: emptyResult.dropped,
  };
}


function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type IdDoc = { _id: unknown; name?: string; nameBn?: string; mobile?: string; sku?: string; purchasePrice?: number; sellPrice?: string | number };

/** GET — relation health check / counts (auth required) */
export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await connectDB();
    const [
      products,
      suppliers,
      customers,
      machines,
      technicians,
      serviceJobs,
      amcContracts,
      links,
      purchases,
      sales,
      locations,
      categories,
      business,
      orphanLinks,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Contact.countDocuments({ type: { $in: ["supplier", "both"] }, isActive: true }),
      Contact.countDocuments({ type: { $in: ["customer", "both"] }, isActive: true }),
      Machine.countDocuments({}),
      Technician.countDocuments({}),
      ServiceJob.countDocuments({}),
      AmcContract.countDocuments({}),
      ProductSupplier.countDocuments({ isActive: true }),
      Purchase.countDocuments({}),
      Sale.countDocuments({}),
      Location.countDocuments({ isActive: true }),
      Category.countDocuments({ kind: "product" }),
      Business.findOne().lean(),
      ProductSupplier.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "p",
          },
        },
        {
          $lookup: {
            from: "contacts",
            localField: "supplierId",
            foreignField: "_id",
            as: "s",
          },
        },
        {
          $match: {
            $or: [{ p: { $size: 0 } }, { s: { $size: 0 } }],
          },
        },
        { $count: "n" },
      ]),
    ]);

    const sample = await Product.findOne({ isActive: true }).sort({ sku: 1 }).lean();
    const { attachOffersToProducts } = await import("@/lib/product-suppliers");
    const [withOffers] = sample ? await attachOffersToProducts([sample]) : [null];
    const sampleOffers = withOffers?.supplierOffers || [];

    await Promise.all([
      AmcContract.createIndexes().catch(() => undefined),
      Machine.createIndexes().catch(() => undefined),
      ServiceJob.createIndexes().catch(() => undefined),
      Technician.createIndexes().catch(() => undefined),
    ]);

    const serviceCollections = ["machines", "amccontracts", "servicejobs", "technicians", "counters", "contacts"];
    const db = mongoose.connection.db;
    const listed = db ? await db.listCollections().toArray() : [];
    const existing = new Set(listed.map((c) => c.name));
    const tables: Record<string, { exists: boolean; count: number; indexes: string[] }> = {};
    for (const name of serviceCollections) {
      if (!db || !existing.has(name)) {
        tables[name] = { exists: false, count: 0, indexes: [] };
        continue;
      }
      const col = db.collection(name);
      const [count, indexes] = await Promise.all([col.estimatedDocumentCount(), col.indexes()]);
      tables[name] = { exists: true, count, indexes: indexes.map((idx) => idx.name).filter((name): name is string => Boolean(name)) };
    }

    return NextResponse.json({
      ok: true,
      counts: {
        products,
        suppliers,
        customers,
        machines,
        technicians,
        serviceJobs,
        amcContracts,
        productSupplierLinks: links,
        purchases,
        sales,
        locations,
        categories,
      },
      tables,
      orphanLinks: orphanLinks[0]?.n || 0,
      business: business?.name || null,
      sample: sample
        ? { name: sample.name, sku: sample.sku, offers: sampleOffers }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (String(process.env.NODE_ENV) === "production") {
    return NextResponse.json({ error: "demo_seed_disabled" }, { status: 403 });
  }
  try {
    const session = await readSession();
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);
    const bootstrapOk = seedBootstrapHeaderOk(req.headers.get("x-seed-bootstrap-secret"));

    await connectDB();
    try {
      await Contact.collection.dropIndex("type_1_nid_1");
    } catch {
      /* legacy unique compound index may already be gone */
    }
    try {
      await Contact.collection.dropIndex("nid_1");
    } catch {
      /* rebuilt below with a partial unique filter */
    }
    try {
      await Contact.syncIndexes();
    } catch (err) {
      console.warn("[seed] contact index sync", err);
    }
    try {
      await Contact.collection.dropIndex("type_1_nid_1");
    } catch {
      /* keep suppliers without NID insertable */
    }
    const existing = await Business.findOne();

    if (force) {
      if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else if (!session && !bootstrapOk) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    } else if (!session && bootstrapOk && existing) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (existing && !force) {
      const [productCount, customerCount] = await Promise.all([
        Product.countDocuments(),
        Contact.countDocuments({ type: { $in: ["customer", "both"] } }),
      ]);
      const incompleteDemo =
        process.env.NODE_ENV !== "production" && (productCount < 5 || customerCount < 3);

      if (!incompleteDemo) {
        if (session && process.env.NODE_ENV !== "production") {
          await ensureDemoAdminUser(undefined, { resetPassword: true });
        }
        const oldName = String(existing.name || "");
        const oldNameBn = String(existing.nameBn || "");
        if (/nur engineering/i.test(oldName) || /নূর ইঞ্জিনিয়ারিং/.test(oldNameBn)) {
          existing.name = "Royal Group";
          existing.nameBn = "সিগমা এলিভেটর";
          if (/ditpos|ditpharma|nureng/i.test(String(existing.email || ""))) {
            existing.email = "info@sigmaelevator.bd";
          }
          if (existing.invoicePrefix === "DIT" || existing.invoicePrefix === "NES") {
            existing.invoicePrefix = "SIG";
          }
          await existing.save();
        }
        return NextResponse.json({
          ok: true,
          seeded: false,
          message: "already_seeded",
          tip: "POST { force: true } as admin to wipe and reseed",
        });
      }

      if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    let pruned: string[] = [];
    let prunedEmpty: string[] = [];
    if (force || existing) {
      const wipe = await wipeAllDemoData();
      pruned = wipe.pruned;
      prunedEmpty = wipe.prunedEmpty;
    }

    // ─── Core business ───────────────────────────────────────────
    await Business.create({
      name: "Royal Group",
      nameBn: "সিগমা এলিভেটর",
      address: "House 12, Road 5, Dhanmondi, Dhaka-1205",
      addressBn: "বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা-১২০৫",
      phone: DEMO_ADMIN.phone,
      email: "info@sigmaelevator.bd",
      bin: "000000000-0000",
      tin: "000000000000",
      mushak: "6.3",
      invoicePrefix: "SIG",
      timezone: "Asia/Dhaka",
      fiscalYearStartMonth: 7,
      defaultLocale: "bn",
    });

    const locations = (await Location.insertMany(
      LOCATIONS.map((l) => ({ ...l, isActive: true })),
    )) as unknown as IdDoc[];
    const hq = locations[0]!;

    const cats = (await Category.insertMany(
      CATEGORIES.map((c) => ({ ...c, kind: "product" })),
    )) as unknown as (IdDoc & { name: string })[];
    const catByName = new Map(cats.map((c) => [c.name, c]));

    await Brand.insertMany(BRANDS.map((name) => ({ name })));
    await Unit.insertMany(UNITS.map((u) => ({ ...u })));
    await Role.insertMany(ROLES.map((r) => ({ ...r })));
    await CustomerGroup.insertMany(CUSTOMER_GROUPS.map((g) => ({ ...g })));

    await CommissionAgent.insertMany([
      { name: "Karim Sales Agent", mobile: "01721000001", commissionPercent: 3 },
      { name: "Hasan Campus Agent", mobile: "01721000002", commissionPercent: 4 },
      { name: "Sultana Dealer Agent", mobile: "01721000003", commissionPercent: 5 },
    ]);

    // ─── Suppliers (Contact) ─────────────────────────────────────
    const catalogSuppliers = (await Contact.insertMany(
      CATALOG_SUPPLIERS.map((s) => ({
        type: "supplier" as const,
        name: s.name,
        nameBn: s.nameBn,
        mobile: s.mobile,
        address: s.address,
        city: s.city,
        balance: rand(5000, 80000),
        openingBalance: 0,
        isActive: true,
      })),
    )) as unknown as IdDoc[];

    const extraSuppliers = (await Contact.insertMany(
      EXTRA_SUPPLIERS.map((s) => ({
        type: "supplier" as const,
        name: s.name,
        nameBn: s.nameBn,
        mobile: s.mobile,
        address: s.address,
        city: s.city,
        balance: rand(2000, 40000),
        openingBalance: 0,
        isActive: true,
      })),
    )) as unknown as IdDoc[];
    const allSuppliers = [...catalogSuppliers, ...extraSuppliers];

    // ─── Products + ProductSupplier relation ─────────────────────
    const productRows = PRODUCTS.map((p, idx) => {
      const cat = catByName.get(p.category) || cats[idx % cats.length]!;
      const qty = Math.max(0, Number(p.quantity) || 0);
      const stocks = [
        {
          locationId: hq._id,
          qty,
          batchNo: `MAIN-${p.sku}`,
        },
      ];
      const prices = offerPrices(p.purchasePrice, p.supplierFactors);
      const supplierOffers = catalogSuppliers.map((s, i) => ({
        supplierId: s._id,
        name: s.name,
        nameBn: s.nameBn,
        price: prices[i]!,
      }));

      return {
        name: p.name,
        nameBn: p.nameBn,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        categoryId: cat._id,
        brand: p.brand,
        unit: p.unit || "Pcs",
        unitBn: p.unitBn || "পিস",
        purchasePrice: p.purchasePrice,
        sellPrice: p.sellPrice,
        alertQty: p.alertQty,
        quantity: qty,
        isActive: true,
        supplierOffers,
        stocks,
      };
    });

    const productDocs = (await Product.insertMany(productRows)) as unknown as (IdDoc & {
      purchasePrice: number;
      sellPrice: number;
      sku: string;
      name: string;
    })[];

    // ProductSupplier links:
    // - Every product shares 2 common suppliers (catalog desk + Lift Parts BD)
    // - 3rd supplier differs by product/category
    const linkRows: Record<string, unknown>[] = [];
    const seenPair = new Set<string>();
    const supplierByName = new Map(
      [...catalogSuppliers, ...extraSuppliers].map((s) => [String(s.name), s]),
    );

    function addLink(
      productId: unknown,
      supplier: IdDoc,
      price: number,
      notes?: string,
    ) {
      const key = `${String(productId)}:${String(supplier._id)}`;
      if (seenPair.has(key)) return;
      seenPair.add(key);
      linkRows.push({
        productId,
        supplierId: supplier._id,
        price,
        isActive: true,
        ...(notes ? { notes } : {}),
      });
    }

    for (let i = 0; i < productDocs.length; i++) {
      const p = productDocs[i]!;
      const seed = PRODUCTS[i]!;
      const prices = offerPrices(seed.purchasePrice, seed.supplierFactors);

      const desk = catalogSuppliers[0]!;
      const liftParts = catalogSuppliers[1]!;
      const doorDrive = catalogSuppliers[2]!;

      // Common on almost every product
      addLink(p._id, desk, prices[0]!);
      addLink(p._id, liftParts, prices[1]!);

      // Different 3rd supplier per product
      let third: IdDoc = doorDrive;
      let thirdPrice = prices[2]!;
      let thirdNote = "Catalog alternate";

      if (i % 3 === 1) {
        const altName = CATEGORY_ALT_SUPPLIER[seed.category];
        const alt = altName ? supplierByName.get(altName) : undefined;
        if (alt) {
          third = alt;
          thirdPrice = Math.round(seed.purchasePrice * 0.98);
          thirdNote = `${seed.category} specialist`;
        }
      } else if (i % 3 === 2) {
        third = extraSuppliers[i % extraSuppliers.length]!;
        thirdPrice = Math.round(seed.purchasePrice * 1.05);
        thirdNote = "Product-specific source";
      }
      // i % 3 === 0 → keep Door & Drive Traders

      addLink(p._id, third, thirdPrice, thirdNote);

      // A few products also get a 4th specialty link (shared suppliers across products)
      if (i % 5 === 0) {
        const fourth = extraSuppliers[(i + 2) % extraSuppliers.length]!;
        if (String(fourth._id) !== String(third._id)) {
          addLink(
            p._id,
            fourth,
            Math.round(seed.purchasePrice * 0.96),
            "Secondary specialty",
          );
        }
      }
    }
    await ProductSupplier.insertMany(linkRows);

    // Mirror join table → product.supplierOffers cache (live Contact names)
    const { refreshProductEmbeddedOffers } = await import("@/lib/product-suppliers");
    const offerBatch = 25;
    for (let i = 0; i < productDocs.length; i += offerBatch) {
      await Promise.all(
        productDocs.slice(i, i + offerBatch).map((p) => refreshProductEmbeddedOffers(p._id)),
      );
    }

    // ─── Customers ───────────────────────────────────────────────
    const campusNames = [
      "BUET EEE Lab",
      "DU Robotics Club",
      "AUST Project Lab",
      "RUET Workshop",
      "CUET Maker Space",
      "IUT Tech Club",
      "NSU Innovation Hub",
      "BRACU Hardware Lab",
      "KUET Power Lab",
      "SUST Electronics Club",
    ];
    const houseAreas = [
      { location: "Dhanmondi", address: "House 12, Road 5, Dhanmondi, Dhaka-1205" },
      { location: "Gulshan", address: "House 8, Road 104, Gulshan-2, Dhaka-1212" },
      { location: "Banani", address: "House 22, Road 11, Banani, Dhaka-1213" },
      { location: "Uttara", address: "House 15, Road 7, Sector 4, Uttara, Dhaka-1230" },
      { location: "Mirpur", address: "House 9, Road 3, Mirpur-10, Dhaka-1216" },
      { location: "Mohammadpur", address: "House 18, Road 2, Mohammadpur, Dhaka-1207" },
      { location: "Chittagong", address: "House 5, Khulshi Hills, Chittagong" },
      { location: "Sylhet", address: "House 11, Zindabazar, Sylhet" },
    ];
    const customerDocs = (await Contact.insertMany([
      {
        type: "customer",
        name: "Walk-in Customer",
        nameBn: "নগদ গ্রাহক",
        mobile: "00000000000",
        address: "Counter",
        location: "Dhanmondi HQ",
        balance: 0,
        isActive: true,
      },
      ...campusNames.map((name, i) => {
        const house = houseAreas[i % houseAreas.length]!;
        return {
          type: "customer" as const,
          name,
          nameBn: name,
          mobile: `0173${String(1000000 + i).slice(1)}`,
          email: `lab${i + 1}@campus.bd`,
          location: house.location,
          address: house.address,
          creditLimit: pick([50000, 100000, 200000]),
          balance: i % 3 === 0 ? rand(2000, 35000) : 0,
          group: pick([...CUSTOMER_GROUPS]).name,
          isActive: true,
        };
      }),
      ...Array.from({ length: 20 }, (_, i) => {
        const house = houseAreas[i % houseAreas.length]!;
        return {
          type: "customer" as const,
          name: `Retail Buyer ${i + 1}`,
          nameBn: `রিটেইল ক্রেতা ${i + 1}`,
          mobile: `0174${String(1000000 + i).slice(1)}`,
          location: house.location,
          address: house.address,
          creditLimit: 20000,
          balance: 0,
          isActive: true,
        };
      }),
    ])) as unknown as IdDoc[];

    const employeeSeed = [
      { name: "Rafiq Hasan", nameBn: "রফিক হাসান", mobile: "01750000010", designation: "Lead Technician", department: "Service", basicSalary: 22000, houseRent: 11000, medical: 1500, conveyance: 2500, nid: "1990123456781", fatherName: "Abdul Hasan", gender: "male", bloodGroup: "B+", speciality: "Lift / VVVF" },
      { name: "Sujon Ali", nameBn: "সুজন আলী", mobile: "01750000011", designation: "Service Technician", department: "Service", basicSalary: 18000, houseRent: 9000, medical: 1500, conveyance: 2000, nid: "1988123456782", fatherName: "Kasem Ali", gender: "male", bloodGroup: "O+", speciality: "Door & motor" },
      { name: "Kamal Uddin", nameBn: "কামাল উদ্দিন", mobile: "01750000012", designation: "Service Technician", department: "Service", basicSalary: 18000, houseRent: 9000, medical: 1500, conveyance: 2000, nid: "1992123456783", fatherName: "Nur Uddin", gender: "male", bloodGroup: "A+", speciality: "Controller" },
      { name: "Jashim Mia", nameBn: "জসিম মিয়া", mobile: "01750000013", designation: "Service Technician", department: "Service", basicSalary: 17000, houseRent: 8500, medical: 1200, conveyance: 1800, nid: "1991123456784", fatherName: "Abdul Mia", gender: "male", bloodGroup: "AB+", speciality: "General repair" },
      { name: "Hasan Mahmud", nameBn: "হাসান মাহমুদ", mobile: "01750000014", designation: "Service Technician", department: "Service", basicSalary: 19000, houseRent: 9500, medical: 1500, conveyance: 2000, nid: "1989123456785", fatherName: "Karim Mahmud", gender: "male", bloodGroup: "B+", speciality: "ARD / rescue" },
      { name: "Nurul Islam", nameBn: "নূরুল ইসলাম", mobile: "01750000015", designation: "Service Technician", department: "Service", basicSalary: 18500, houseRent: 9000, medical: 1500, conveyance: 2000, nid: "1993123456786", fatherName: "Shamsul Islam", gender: "male", bloodGroup: "O+", speciality: "Escalator" },
      { name: "Nila Akter", nameBn: "নিলা আক্তার", mobile: "01751000002", designation: "Accountant", department: "Accounts", basicSalary: 25000, houseRent: 12500, medical: 2000, conveyance: 2000, nid: "1994123456787", fatherName: "Abdul Akter", gender: "female", bloodGroup: "A+" },
      { name: "Karim Hossain", nameBn: "করিম হোসেন", mobile: "01751000003", designation: "Sales Executive", department: "Sales", basicSalary: 22000, houseRent: 11000, medical: 1500, conveyance: 2500, nid: "1990123456788", fatherName: "Jamal Hossain", gender: "male", bloodGroup: "B+" },
      { name: "Farhana Islam", nameBn: "ফারহানা ইসলাম", mobile: "01751000004", designation: "HR Officer", department: "HR", basicSalary: 20000, houseRent: 10000, medical: 1500, conveyance: 1500, nid: "1995123456789", fatherName: "Rafiq Islam", gender: "female", bloodGroup: "O+" },
      { name: "Jamal Sheikh", nameBn: "জামাল শেখ", mobile: "01751000005", designation: "Store Keeper", department: "Warehouse", basicSalary: 16000, houseRent: 8000, medical: 1000, conveyance: 1000, nid: "1987123456790", fatherName: "Sattar Sheikh", gender: "male", bloodGroup: "A+" },
      { name: "Sadia Rahman", nameBn: "সাদিয়া রহমান", mobile: "01751000006", designation: "Office Admin", department: "Admin", basicSalary: 18000, houseRent: 9000, medical: 1500, conveyance: 1500, nid: "1996123456791", fatherName: "Habib Rahman", gender: "female", bloodGroup: "AB+" },
      { name: "Tania Begum", nameBn: "তানিয়া বেগম", mobile: "01751000007", designation: "Reception", department: "Admin", basicSalary: 14000, houseRent: 7000, medical: 1000, conveyance: 1000, nid: "1998123456792", fatherName: "Abul Begum", gender: "female", bloodGroup: "B+" },
    ];
    const employeeDocs = (await Contact.insertMany(
      employeeSeed.map((e) => ({
        type: "employee" as const,
        name: e.name,
        nameBn: e.nameBn,
        mobile: e.mobile,
        designation: e.designation,
        department: e.department,
        basicSalary: e.basicSalary,
        houseRent: e.houseRent,
        medical: e.medical,
        conveyance: e.conveyance,
        nid: e.nid,
        workType: e.department === "Service" ? "field" : "office",
        speciality: "speciality" in e ? e.speciality : "",
        fatherName: e.fatherName,
        gender: e.gender,
        bloodGroup: e.bloodGroup,
        motherName: `Mrs. ${e.fatherName.split(" ").slice(-1)[0]}`,
        presentAddress: "Dhanmondi HQ staff quarter",
        permanentAddress: "Dhaka",
        emergencyName: e.fatherName,
        emergencyPhone: "01711999000",
        bankName: "DBBL",
        bankAccount: `101${e.nid.slice(-8)}`,
        dateOfBirth: daysAgo(rand(8000, 14000)),
        joinDate: daysAgo(rand(200, 1800)),
        email: `${e.name.split(" ")[0]!.toLowerCase()}@sigmaelevator.bd`,
        address: "Dhanmondi HQ",
        isActive: true,
      })),
    )) as unknown as (IdDoc & { basicSalary?: number; houseRent?: number; medical?: number; conveyance?: number })[];

    const thisKey = currentPeriodKey();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevKey = currentPeriodKey(prevDate);
    const payrollSlips = [];
    let paySeq = 0;
    for (const periodKey of [prevKey, thisKey]) {
      const bounds = periodBounds(periodKey);
      for (const emp of employeeDocs) {
        paySeq += 1;
        const components = snapshotFromEmployee(emp);
        const totals = computePayrollTotals(components);
        const paid = periodKey === prevKey;
        payrollSlips.push({
          slipNo: generateDocNo("PAY", paySeq),
          employeeId: emp._id,
          employeeName: emp.nameBn || emp.name,
          periodKey,
          periodLabel: periodLabelFromKey(periodKey, "en"),
          periodFrom: bounds.from,
          periodTo: bounds.to,
          ...components,
          allowances: totals.allowances,
          deductions: totals.deductions,
          netPay: totals.netPay,
          status: paid ? "paid" : "draft",
          paymentMethod: "bank",
          paidAt: paid ? bounds.to : undefined,
        });
      }
    }
    await Payslip.insertMany(payrollSlips);
    await Counter.findOneAndUpdate({ key: "payslip" }, { seq: paySeq }, { upsert: true });

    const leaveRows = employeeDocs.slice(0, 8).map((emp, i) => ({
      employeeId: emp._id,
      employeeName: emp.nameBn || emp.name,
      leaveType: (["casual", "sick", "annual", "unpaid"] as const)[i % 4],
      from: daysAgo(8 + i),
      to: daysAgo(6 + i),
      days: 3,
      reason: i % 2 === 0 ? "Family work" : "Fever / rest",
      status: (["approved", "pending", "approved", "rejected"] as const)[i % 4],
    }));
    await EmployeeLeave.insertMany(leaveRows);

    const attendanceRows = [];
    for (let d = 0; d < 10; d++) {
      const day = daysAgo(d);
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const friday = day.getDay() === 5;
      for (const emp of employeeDocs) {
        const punchIn = new Date(day);
        punchIn.setHours(8, rand(0, 25), 0, 0);
        const punchOut = new Date(day);
        punchOut.setHours(17, rand(0, 40), 0, 0);
        attendanceRows.push({
          employeeId: emp._id,
          employeeName: emp.nameBn || emp.name,
          dateKey,
          punchIn: friday ? undefined : punchIn,
          punchOut: friday ? undefined : punchOut,
          minutes: friday ? 0 : Math.round((punchOut.getTime() - punchIn.getTime()) / 60000),
          status: friday ? "holiday" : d === 3 && String(emp.name).includes("Farhana") ? "leave" : "present",
          source: String((emp as { department?: string }).department) === "Service" ? "field" : "office",
        });
      }
    }
    await Attendance.insertMany(attendanceRows);

    // ─── Accounts / users ────────────────────────────────────────
    await Account.insertMany(ACCOUNTS.map((a) => ({ ...a, isActive: true })));
    const ledgerDocs = (await LedgerAccount.insertMany(
      LEDGER_ACCOUNTS.map((a) => ({ ...a, openingBalance: 0, balance: 0, isActive: true })),
    )) as unknown as (IdDoc & { code: string; name: string })[];

    const admin = await ensureDemoAdminUser(hq._id);
    await ensureDemoManagerUser(hq._id);
    const pwd = admin.passwordHash;
    const extraUsers = await User.insertMany([
      {
        name: "Cashier Nila",
        email: "cashier@sigmaelevator.bd",
        passwordHash: pwd,
        role: "cashier",
        phone: "01730000002",
        locale: "bn",
        locationIds: [hq._id],
        isActive: true,
      },
      {
        name: "Accountant Karim",
        email: "accounts@sigmaelevator.bd",
        passwordHash: pwd,
        role: "accountant",
        phone: "01730000003",
        locale: "en",
        locationIds: [hq._id],
        isActive: true,
      },
      {
        name: "Viewer Sadia",
        email: "viewer@sigmaelevator.bd",
        passwordHash: pwd,
        role: "viewer",
        phone: "01730000004",
        locale: "bn",
        locationIds: [hq._id],
        isActive: true,
      },
    ]);

    const cash = ledgerDocs.find((a) => a.code === "1000");
    const salesInc = ledgerDocs.find((a) => a.code === "4000");
    const ar = ledgerDocs.find((a) => a.code === "1200");
    const inv = ledgerDocs.find((a) => a.code === "1100");
    if (cash && salesInc && ar && inv) {
      await JournalEntry.insertMany([
        {
          entryNo: "JE-9001",
          entryDate: daysAgo(12),
          memo: "Opening cash from sales collection",
          status: "posted",
          lines: [
            { accountId: cash._id, accountName: cash.name, debit: 125000, credit: 0 },
            { accountId: salesInc._id, accountName: salesInc.name, debit: 0, credit: 125000 },
          ],
          totalDebit: 125000,
          totalCredit: 125000,
          createdBy: admin._id,
          postedAt: daysAgo(12),
        },
        {
          entryNo: "JE-9002",
          entryDate: daysAgo(5),
          memo: "Receivable against spare parts invoice",
          status: "posted",
          lines: [
            { accountId: ar._id, accountName: ar.name, debit: 45000, credit: 0 },
            { accountId: salesInc._id, accountName: salesInc.name, debit: 0, credit: 45000 },
          ],
          totalDebit: 45000,
          totalCredit: 45000,
          createdBy: admin._id,
          postedAt: daysAgo(5),
        },
        {
          entryNo: "JE-9003",
          entryDate: daysAgo(1),
          memo: "Inventory purchase accrual (draft)",
          status: "draft",
          lines: [
            { accountId: inv._id, accountName: inv.name, debit: 80000, credit: 0 },
            { accountId: cash._id, accountName: cash.name, debit: 0, credit: 80000 },
          ],
          totalDebit: 80000,
          totalCredit: 80000,
          createdBy: admin._id,
        },
      ]);
    }

    // ─── Expenses ────────────────────────────────────────────────
    await ExpenseCategory.insertMany(
      EXPENSE_CATEGORIES.map((name) => ({ name, kind: "expense" })),
    );
    await Expense.insertMany(
      Array.from({ length: 120 }, (_, i) => {
        const category = pick(EXPENSE_CATEGORIES);
        return {
          category,
          title: `${category} — ${pick(["Monthly", "Routine", "Urgent", "Maintenance", "Office"])} #${i + 1}`,
          amount: rand(500, 50000),
          locationId: pick(locations)._id,
          paymentMethod: pick(["cash", "bank", "bkash", "nagad"] as const),
          expenseDate: daysAgo(rand(0, 45)),
          createdBy: admin._id,
        };
      })
    );

    // ─── Purchases (only via ProductSupplier-linked pairs) ────────
    const activeLinks = await ProductSupplier.find({ isActive: true }).lean();
    const linksBySupplier = new Map<string, typeof activeLinks>();
    for (const link of activeLinks) {
      const key = String(link.supplierId);
      const arr = linksBySupplier.get(key) || [];
      arr.push(link);
      linksBySupplier.set(key, arr);
    }

    const purchaseRows = [];
    let poN = 3000;
    for (const supplier of allSuppliers) {
      const links = linksBySupplier.get(String(supplier._id)) || [];
      if (!links.length) continue;
      for (let n = 0; n < 8; n++) {
        const chosen = links.slice(0, Math.min(3, links.length));
        const items = chosen.map((link) => {
          const p = productDocs.find((x) => String(x._id) === String(link.productId))!;
          const qty = rand(8, 40);
          const unitCost = Number(link.price || p.purchasePrice);
          return {
            productId: p._id,
            name: p.name,
            sku: p.sku,
            qty,
            unitCost,
            lineTotal: qty * unitCost,
            batchNo: `IN-${p.sku}-${n + 1}`,
          };
        });
        const subtotal = items.reduce((a, x) => a + x.lineTotal, 0);
        const due = n === 0 ? Math.floor(subtotal * 0.15) : 0;
        poN += 1;
        purchaseRows.push({
          referenceNo: `PO-${poN}`,
          supplierId: supplier._id,
          supplierName: supplier.name,
          locationId: pick(locations)._id,
          status: "received" as const,
          items,
          subtotal,
          grandTotal: subtotal,
          paidAmount: subtotal - due,
          dueAmount: due,
          purchaseDate: daysAgo(rand(5, 80)),
          payments: [{ method: "bank", amount: subtotal - due }],
          createdBy: admin._id,
        });
      }
    }
    await Purchase.insertMany(purchaseRows);

    // ─── Sales ───────────────────────────────────────────────────
    const saleRows = Array.from({ length: 250 }, (_, i) => {
      const cust = pick(customerDocs);
      const items = Array.from({ length: rand(1, 4) }, () => {
        const p = pick(productDocs);
        const qty = rand(1, 8);
        return {
          productId: p._id,
          name: p.name,
          sku: p.sku,
          unit: "Pcs",
          qty,
          unitPrice: p.sellPrice,
          lineTotal: qty * p.sellPrice,
        };
      });
      const subtotal = items.reduce((a, x) => a + x.lineTotal, 0);
      const status = i % 11 === 0 ? "proposal" : i % 10 === 0 ? "quotation" : i % 9 === 0 ? "draft" : "final";
      const due = status === "final" && i % 4 === 0 ? Math.floor(subtotal * 0.2) : 0;
      const paid = status === "final" ? subtotal - due : 0;
      const payments =
        paid > 800 && i % 3 === 0
          ? [
              { method: "cash" as const, amount: Math.floor(paid * 0.6) },
              { method: "bkash" as const, amount: paid - Math.floor(paid * 0.6) },
            ]
          : paid > 0
            ? [{ method: pick(["cash", "bkash", "bank"] as const), amount: paid }]
            : [];
      return {
        invoiceNo:
          status === "draft"
            ? `DIT-D${2000 + i}`
            : status === "quotation" || status === "proposal"
              ? undefined
              : `DIT-${12000 + i}`,
        proposalNo: status === "proposal" ? `PRP2026${String(2000 + i).padStart(5, "0")}` : undefined,
        quotationNo: status === "quotation" ? `SIG2026${String(2000 + i).padStart(5, "0")}` : undefined,
        customerId: cust._id,
        customerName: cust.name,
        customerMobile: cust.mobile,
        locationId: pick(locations)._id,
        status,
        items,
        subtotal,
        grandTotal: subtotal,
        paidAmount: paid,
        dueAmount: due,
        saleDate: daysAgo(rand(0, 70)),
        soldBy: admin._id,
        soldByName: admin.name,
        payments,
      };
    });
    const createdSales = (await Sale.insertMany(saleRows)) as unknown as (IdDoc & {
      status: string;
      customerName?: string;
    })[];
    const finalSales = createdSales.filter((s) => s.status === "final");

    // ─── Returns / shipments / stock ─────────────────────────────
    await SellReturn.insertMany(
      Array.from({ length: 45 }, (_, i) => {
        const sale = pick(finalSales.length ? finalSales : createdSales);
        const p = pick(productDocs);
        const qty = rand(1, 3);
        return {
          returnNo: `SR-${500 + i}`,
          saleId: sale._id,
          customerName: sale.customerName || "Walk-in",
          items: [
            {
              productId: p._id,
              name: p.name,
              qty,
              unitPrice: p.sellPrice,
              lineTotal: qty * p.sellPrice,
            },
          ],
          grandTotal: qty * p.sellPrice,
          returnDate: daysAgo(rand(0, 40)),
        };
      }),
    );

    await PurchaseReturn.insertMany(
      Array.from({ length: 30 }, (_, i) => {
        const supplier = pick(catalogSuppliers);
        const p = pick(productDocs);
        const qty = rand(1, 5);
        return {
          returnNo: `PR-${500 + i}`,
          supplierName: supplier.name,
          items: [
            {
              productId: p._id,
              name: p.name,
              qty,
              unitPrice: p.purchasePrice,
              lineTotal: qty * p.purchasePrice,
            },
          ],
          grandTotal: qty * p.purchasePrice,
          returnDate: daysAgo(rand(0, 50)),
        };
      }),
    );

    await Shipment.insertMany(
      Array.from({ length: 65 }, (_, i) => {
        const sale = pick(createdSales);
        return {
          shipmentNo: `SH-${800 + i}`,
          saleId: sale._id,
          customerName: sale.customerName,
          status: pick(["pending", "shipped", "delivered"] as const),
          shippingAddress: pick(["Dhaka", "Chittagong", "Sylhet"]),
          shippedDate: daysAgo(rand(0, 20)),
        };
      }),
    );

    await PurchaseRequisition.insertMany(
      Array.from({ length: 40 }, (_, i) => {
        const loc = pick(locations);
        return {
          reqNo: `REQ-${600 + i}`,
          locationId: loc._id,
          locationName: loc.name,
          status: pick(["pending", "approved", "ordered"] as const),
          items: Array.from({ length: rand(1, 3) }, () => ({
            productName: pick(productDocs).name,
            qty: rand(20, 100),
          })),
        };
      }),
    );

    await StockTransfer.insertMany(
      Array.from({ length: 12 }, (_, i) => {
        const from = locations[0]!;
        const to = locations[(i % (locations.length - 1)) + 1]!;
        const p = pick(productDocs);
        return {
          transferNo: `ST-${700 + i}`,
          fromLocationId: from._id,
          toLocationId: to._id,
          items: [{ productId: p._id, name: p.name, qty: rand(5, 25) }],
          status: "completed" as const,
          note: "Branch restock",
          transferDate: daysAgo(rand(0, 40)),
          createdBy: admin._id,
        };
      }),
    );

    await StockAdjustment.insertMany(
      Array.from({ length: 10 }, (_, i) => {
        const p = pick(productDocs);
        return {
          adjustmentNo: `SA-${400 + i}`,
          locationId: hq._id,
          items: [
            {
              productId: p._id,
              name: p.name,
              qtyChange: pick([-3, -1, 1, 2, 5]),
              reason: pick(["Damaged", "Found", "Count fix"]),
            },
          ],
          note: "Physical count",
          adjustmentDate: daysAgo(rand(0, 30)),
          createdBy: admin._id,
        };
      }),
    );

    await Discount.insertMany([
      {
        name: "Campus Lab 10%",
        discountType: "percentage",
        value: 10,
        startsAt: daysAgo(30),
        endsAt: daysAgo(-30),
        isActive: true,
      },
      {
        name: "Bulk Kit ৳200 Off",
        discountType: "fixed",
        value: 200,
        startsAt: daysAgo(10),
        endsAt: daysAgo(-20),
        isActive: true,
      },
      {
        name: "Festival 5%",
        discountType: "percentage",
        value: 5,
        startsAt: daysAgo(5),
        endsAt: daysAgo(-15),
        isActive: true,
      },
    ]);

    const leadDocs = await Lead.insertMany(
      Array.from({ length: 70 }, (_, i) => ({
        name: `Prospect House ${i + 1}`,
        mobile: `0194${String(1000000 + i).slice(1)}`,
        email: `prospect${i + 1}@building.bd`,
        company: i % 4 === 0 ? `Heights Ltd ${i + 1}` : "",
        product: pick(["Passenger lift", "Cargo lift", "Spare parts", "Modernization"]),
        source: pick(["phone", "facebook", "referral", "walk-in", "site visit"]),
        lifeStage: pick(["new", "contacted", "qualified", "proposal"]),
        status: pick(["open", "open", "won", "lost"] as const),
        notes: "Elevator inquiry / house visit follow-up",
        nextFollowUp: daysAgo(rand(-5, 15)),
      })),
    );

    const wonLeads = leadDocs.filter((row) => row.status === "won").slice(0, 18);
    const clientDocs = await CrmClient.insertMany(
      wonLeads.map((lead, i) => {
        const house = customerDocs[i + 1];
        return {
          name: lead.name,
          mobile: lead.mobile,
          email: lead.email,
          company: lead.company,
          leadId: lead._id,
          contactId: house?._id,
          notes: "Converted from lead",
          status: i % 8 === 0 ? "inactive" : "active",
        };
      }),
    );
    await Lead.bulkWrite(
      clientDocs
        .filter((row) => row.leadId && row.contactId)
        .map((row) => ({
          updateOne: {
            filter: { _id: row.leadId },
            update: { $set: { customerId: row.contactId } },
          },
        })),
    );

    await CrmFollowUp.insertMany([
      ...leadDocs.slice(0, 24).map((lead, i) => ({
        leadId: lead._id,
        leadName: lead.name,
        kind: "lead" as const,
        scheduledAt: daysAgo(rand(-3, 10)),
        status: pick(["scheduled", "ongoing", "completed", "missed"] as const),
        notes: i % 2 === 0 ? "Call about lift quotation" : "Site visit follow-up",
        conversations:
          i % 4 === 0
            ? [{ at: daysAgo(1), text: "Owner asked for 6-passenger quotation.", userName: "Admin" }]
            : [],
      })),
      ...clientDocs.slice(0, 12).map((client, i) => ({
        leadId: client.leadId,
        leadName: client.name,
        clientId: client._id,
        clientName: client.name,
        houseId: client.contactId,
        kind: "client" as const,
        scheduledAt: daysAgo(rand(-2, 12)),
        status: pick(["scheduled", "ongoing", "completed"] as const),
        notes: i % 2 === 0 ? "AMC / service follow-up" : "Ask for next building",
      })),
      ...customerDocs.flatMap((house) => {
        if (house.name === "Walk-in Customer") return [];
        const rich = house.name === "Retail Buyer 14";
        const script = [
          { days: 118, status: "completed" as const, notes: "First call after install. Owner asked for AMC price.", talk: "Quoted yearly AMC. Will discuss with building committee." },
          { days: 96, status: "completed" as const, notes: "Site visit — machine room, doors, ARD check.", talk: "Door sensor noisy on 3rd floor. Parts noted." },
          { days: 74, status: "completed" as const, notes: "AMC quotation follow-up.", talk: "Committee approved 12-month AMC." },
          { days: 51, status: "completed" as const, notes: "Payment follow-up for last service visit." },
          { days: 29, status: "completed" as const, notes: "Monthly service reminder. Technician assigned." },
          { days: 14, status: "missed" as const, notes: "Called site in-charge. Phone unreachable." },
          { days: 7, status: "completed" as const, notes: "Callback successful. Confirmed next visit window.", talk: "Saturday 10am confirmed with caretaker." },
          { days: -5, status: "scheduled" as const, notes: "Upcoming AMC / monthly service follow-up." },
        ];
        const picks = rich ? script : script.slice(0, 2 + (String(house.name).length % 3));
        return picks.map((row) => ({
          houseId: house._id,
          kind: "client" as const,
          clientName: house.name,
          leadName: house.name,
          scheduledAt: daysAgo(row.days),
          status: row.status,
          notes: row.notes,
          conversations: row.talk ? [{ at: daysAgo(Math.max(0, row.days - 1)), text: row.talk, userName: "Admin" }] : [],
        }));
      }),
    ]);

    const dealStages = ["prospect", "qualified", "proposal", "negotiation", "won", "lost"] as const;
    await CrmDeal.insertMany(
      clientDocs.slice(0, 12).map((client, i) => ({
        title: `${client.name} — ${pick(["Passenger lift", "Cargo lift", "Modernization", "AMC"])}`,
        value: pick([280000, 450000, 620000, 890000, 1250000]),
        stage: dealStages[i % dealStages.length],
        clientId: client._id,
        clientName: client.name,
        leadId: client.leadId,
        leadName: client.name,
        notes: i % 2 === 0 ? "Site survey done. Waiting for BOQ confirm." : "Follow commercial terms.",
      })),
    );

    await CrmCampaign.insertMany([
      {
        name: "Uttara new building drive",
        source: "facebook",
        status: "active",
        startsAt: daysAgo(20),
        endsAt: daysAgo(-20),
        notes: "Facebook + flyer for 6-stop passenger lifts",
      },
      {
        name: "Spare parts wholesale",
        source: "referral",
        status: "active",
        startsAt: daysAgo(40),
        endsAt: daysAgo(-10),
        notes: "Dealer outreach for IC catalog items",
      },
      {
        name: "Dhanmondi modernization",
        source: "site visit",
        status: "paused",
        startsAt: daysAgo(60),
        endsAt: daysAgo(10),
        notes: "Old Sigma/Monarch controller swap",
      },
      {
        name: "Eid service reminder",
        source: "phone",
        status: "draft",
        startsAt: daysAgo(-5),
        endsAt: daysAgo(-25),
        notes: "AMC houses complimentary visit offer",
      },
    ]);

    await CylinderMovement.insertMany(
      Array.from({ length: 14 }, (_, i) => {
        const product = productDocs[i % Math.min(24, productDocs.length)]!;
        const asSupplier = i % 3 === 0;
        const party = asSupplier
          ? allSuppliers[i % allSuppliers.length]!
          : customerDocs[i % customerDocs.length]!;
        const delivered = asSupplier ? 0 : rand(1, 4);
        const received = asSupplier ? rand(2, 8) : i % 4 === 0 ? rand(1, 2) : 0;
        return {
          movementDate: daysAgo(i + 1),
          productId: product._id,
          productName: product.name,
          partyType: asSupplier ? "supplier" : "customer",
          partyId: party._id,
          partyModel: "Contact",
          partyName: party.nameBn || party.name,
          delivered,
          received,
          balance: delivered - received,
          note: asSupplier ? "Returnable packing in from supplier" : "Empty returned from site",
          createdBy: admin._id,
        };
      }),
    );

    const recipeDocs = await Recipe.insertMany(
      Array.from({ length: 8 }, (_, i) => {
        const finished = productDocs[i]!;
        return {
          finishedProductId: finished._id,
          finishedProductName: finished.name,
          outputQty: pick([10, 20, 50]),
          ingredients: [
            {
              productId: productDocs[i + 5]?._id,
              name: productDocs[i + 5]?.name || "Component A",
              qty: rand(2, 10),
            },
            {
              productId: productDocs[i + 8]?._id,
              name: productDocs[i + 8]?.name || "Component B",
              qty: rand(1, 5),
            },
          ],
          wastePercent: 2,
          isActive: true,
        };
      }),
    );

    await Production.insertMany(
      recipeDocs.map((recipe, i) => ({
        productionNo: `PRD-${900 + i}`,
        recipeId: recipe._id,
        productName: recipe.finishedProductName,
        qty: pick([10, 20, 30]),
        productionDate: daysAgo(rand(0, 40)),
      })),
    );

    await Project.insertMany(
      Array.from({ length: 15 }, (_, i) => ({
        name: `Project ${i + 1}: ${pick(["Lab Expansion", "Warehouse Upgrade", "Branch Setup", "Robotics Kit Supply", "IoT Automation"])}`,
        status: pick(["open", "completed"]),
        description: `Project description for project ${i + 1}`,
        dueDate: daysAgo(rand(-60, 60)),
      }))
    );

    await CommissionAgent.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        name: `Agent ${pick(["Hasan", "Jamal", "Rafiq", "Sujon", "Kamal"])} ${i + 1}`,
        email: `agent${i + 1}@sigmaelevator.bd`,
        phone: `0182${String(1000000 + i).slice(1)}`,
        commissionPercent: pick([2, 5, 10, 15]),
        address: pick(["Dhaka", "Sylhet", "Chittagong", "Rajshahi"]),
        isActive: true
      }))
    );

    await Role.insertMany([
      { name: "Super Admin", permissions: ["all"], description: "Full access" },
      { name: "Sales Exec", permissions: ["sales.create", "sales.view"], description: "Only sales access" },
      { name: "Support Agent", permissions: ["service.view", "service.edit"], description: "Service management access" }
    ]);

    const { ActivityLog } = await import("@/models");
    if(ActivityLog) {
      await ActivityLog.insertMany(
        Array.from({ length: 150 }, (_, i) => ({
          userId: admin._id,
          userName: admin.name,
          action: pick(["create", "update", "delete", "login"]),
          entityType: pick(["Sale", "Purchase", "Product", "Contact", "Expense", "ServiceJob"]),
          entityId: admin._id,
          details: `Performed ${pick(["create", "update", "delete", "login"])} operation on ${pick(["Sale", "Purchase", "Product", "Contact", "Expense", "ServiceJob"])}`,
          ipAddress: `192.168.1.${rand(10, 255)}`,
          createdAt: daysAgo(rand(0, 30)),
        }))
      );
    }

    await NotificationTemplate.insertMany([
      {
        name: "Low Stock SMS",
        type: "sms",
        subject: "Low stock",
        body: "{{product}} stock is below alert qty at {{location}}",
      },
      {
        name: "Invoice Email",
        type: "email",
        subject: "Invoice {{invoiceNo}}",
        body: "Dear {{customer}}, your invoice total is {{amount}}.",
      },
      {
        name: "Purchase Due Reminder",
        type: "email",
        subject: "Payment due {{referenceNo}}",
        body: "Supplier {{supplier}} has due amount {{amount}}.",
      },
    ]);

    // ─── Service Management Data ─────────────────────────────────
    const machinesDocs = await Machine.insertMany([
      { customerId: customerDocs[0]._id, brand: "Sigma", model: "Passenger Lift 8P", serialNo: "LIFT-001", machineType: "Lift", nextServiceDue: daysAgo(2), commissionedAt: daysAgo(6) },
      { customerId: customerDocs[1]._id, brand: "Sigma", model: "Passenger Lift 6P", serialNo: "LIFT-002", machineType: "Lift", nextServiceDue: daysAgo(-10), commissionedAt: daysAgo(4) },
      { customerId: customerDocs[2]._id, brand: "Sigma", model: "Generator 250kVA", serialNo: "GEN-103", machineType: "Generator", nextServiceDue: daysAgo(5), purchaseDate: daysAgo(400) },
      { customerId: customerDocs[3]._id, brand: "Sigma", model: "Escalator 30deg", serialNo: "ESC-005", machineType: "Escalator", purchaseDate: daysAgo(200) },
      { customerId: customerDocs[4]._id, brand: "Sigma", model: "Voltage Stabilizer 50kVA", serialNo: "STB-902", machineType: "VoltageStabilizer", nextServiceDue: daysAgo(1), purchaseDate: daysAgo(90) },
    ].map((row, i) => {
      const cust = customerDocs[i] as { name?: string; address?: string; location?: string };
      return {
        ...row,
        siteName: cust?.name,
        siteLocation: cust?.location,
        siteAddress: cust?.address,
      };
    }));

    const amcDocs = [];
    for (const [i, machine] of machinesDocs.slice(0, 3).entries()) {
      const seq = await nextSeq("amc_contract");
      amcDocs.push(
        await AmcContract.create({
          contractNo: generateDocNo("AMC", seq),
          customerId: machine.customerId,
          machineId: machine._id,
          startDate: daysAgo(30),
          endDate: daysAgo(-335),
          cycleDays: 90,
          amount: 48000 + i * 6000,
          visitsIncluded: 4,
          visitsUsed: i,
          status: "active",
          notes: "Preventive AMC",
        }),
      );
    }
    await Promise.all([AmcContract.createIndexes(), Machine.createIndexes(), ServiceJob.createIndexes()]);

    const cashierUser = extraUsers.find((row) => row.email === "cashier@sigmaelevator.bd");
    const fieldEmployees = employeeDocs.slice(0, 6);
    const techsDocs = await Technician.insertMany(
      fieldEmployees.map((emp, i) => ({
        name: emp.name,
        mobile: emp.mobile,
        speciality: employeeSeed[i]?.speciality || "Lift",
        employeeId: emp._id,
        userId: i === 0 ? cashierUser?._id : undefined,
      })),
    );

    const visitMorning = new Date();
    visitMorning.setHours(8, 0, 0, 0);
    const todayVisitCount = techsDocs.length * 4;

    const serviceJobRows = Array.from({ length: 90 }, (_, i) => {
      const cust =
        i === 0 ? customerDocs[0]! : i === 4 ? customerDocs[1]! : pick(customerDocs);
      const todayCrew = i < todayVisitCount;
      const machine = i === 0 ? machinesDocs[0]! : i === 4 ? machinesDocs[1]! : pick(machinesDocs);
      const tech = todayCrew ? techsDocs[Math.floor(i / 4)] : pick(techsDocs);
      const slot = i % 4;
      
      const hasParts = i % 3 !== 0;
      const parts: { productId: unknown; name: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
      
      if (hasParts) {
        const numParts = rand(1, 3);
        for(let j=0; j<numParts; j++) {
           const p = pick(productDocs);
           const qty = rand(1, 3);
           parts.push({
             productId: p._id,
             name: p.name,
             qty: qty,
             unitPrice: p.sellPrice,
             lineTotal: p.sellPrice * qty
           });
        }
      }

      const kinds = ["complaint", "scheduled", "emergency", "installation", "general"] as const;
      const jobKind = kinds[i % kinds.length];
      const discount = i % 5 === 0 ? 100 : 0;
      const visitCharge = defaultVisitCharge(jobKind);
      const serviceLines = defaultServiceLines(jobKind);
      if (i % 2 === 0) {
        const labourQty = rand(1, 4);
        serviceLines.push({
          name: "Technician labour",
          code: "LABOUR",
          qty: labourQty,
          unit: "hour",
          unitPrice: 500,
          lineTotal: labourQty * 500,
        });
      }
      const totals = computeServiceTotals({
        serviceLines,
        parts,
        visitCharge,
        discount,
        tax: 0,
        paidAmount: 0,
      });
      const helper = techsDocs[(Math.floor(i / 4) + 1) % techsDocs.length];
      const crew = todayCrew && slot !== 0 ? [tech._id, helper._id] : [tech._id];
      const complimentary = i === 0 || i === 4;
      const bill = complimentary
        ? computeServiceTotals({
            serviceLines,
            parts,
            visitCharge: 0,
            discount,
            tax: 0,
            paidAmount: 0,
          })
        : totals;
      const isCompleted = i % 2 === 0;
      const status = isCompleted ? "delivered" : pick(["pending", "in_progress", "completed"]);
      const paid = complimentary
        ? 0
        : status === "delivered"
          ? bill.grandTotal
          : i % 3 === 0
            ? Math.floor(bill.grandTotal / 2)
            : 0;
      const due = Math.max(0, bill.grandTotal - paid);
      const payments: { method: "cash" | "bkash"; amount: number }[] = [];
      if (paid > 800 && i % 5 === 0) {
        const first = Math.floor(paid / 2);
        payments.push({ method: "cash", amount: first }, { method: "bkash", amount: paid - first });
      } else if (paid > 0) {
        payments.push({ method: pick(["cash", "bkash"] as const), amount: paid });
      }

      const equipmentType = todayCrew ? "Lift" : pick(["Lift", "Escalator", "Generator", "ARD", "VoltageStabilizer", "SubStation"]);
      const officeStatus =
        jobKind === "general"
          ? status
          : isCompleted
            ? pick(["resolved", "closed"])
            : pick(["reported", "assigned", "in_progress"]);

      const checkedInAt = todayCrew && slot > 0
        ? new Date(visitMorning.getTime() + slot * 2 * 36e5 + (i % 15) * 60000)
        : undefined;
      const checkedOutAt = todayCrew && slot > 1 && checkedInAt
        ? new Date(checkedInAt.getTime() + (50 + (i % 4) * 15) * 60000)
        : undefined;
      const durationMinutes = checkedInAt && checkedOutAt ? minutesBetween(checkedInAt, checkedOutAt) : 0;

      return {
        jobNo: `SJ-${1000 + i}`,
        customerId: cust._id,
        machineId: machine._id,
        technicianId: tech._id,
        technicianIds: crew,
        complimentary,
        jobKind: todayCrew ? "scheduled" : jobKind,
        equipmentType,
        status: todayCrew ? (slot === 3 ? "completed" : slot === 0 ? "assigned" : "in_progress") : officeStatus,
        fieldStatus: todayCrew
          ? (slot === 0 ? "assigned" : slot === 1 ? "on_site" : slot === 3 ? "completed" : "working")
          : undefined,
        priority: pick(["low", "medium", "high", "urgent"]),
        issueDescription: todayCrew
          ? pick(["Monthly lift service", "Door sensor check", "Cabin light + parts", "Brake & safety test"])
          : pick(["Not turning on", "Display broken", "Port damaged", "Software issue", "Overheating", "Motor jammed"]),
        reportedAt: todayCrew ? visitMorning : daysAgo(rand(1, 40)),
        scheduledDate: todayCrew ? visitMorning : daysAgo(rand(0, 14)),
        siteName: (cust as { name?: string }).name,
        siteLocation: (cust as { location?: string }).location,
        siteAddress: (cust as { address?: string }).address,
        checkedInAt,
        checkedOutAt,
        durationMinutes,
        labourHours: labourHoursFromMinutes(durationMinutes),
        visitCharge: bill.visitCharge,
        serviceLines: bill.serviceLines,
        serviceLinesTotal: bill.serviceLinesTotal,
        serviceCharges: bill.serviceCharges,
        parts: bill.parts,
        partsTotal: bill.partsTotal,
        discount: bill.discount,
        tax: 0,
        grandTotal: bill.grandTotal,
        paidAmount: paid,
        dueAmount: due,
        payments,
        receivedDate: daysAgo(rand(1, 40)),
        deliveredDate: status === "delivered" ? daysAgo(rand(0, 10)) : undefined,
        completedAt: isCompleted ? daysAgo(rand(0, 10)) : undefined,
        resolution: isCompleted || (todayCrew && slot === 3) ? "Work completed and tested on site." : "",
        customerConfirmation: isCompleted || (todayCrew && slot === 3) ? "Site in-charge confirmed" : "",
        warrantyDays: status === "delivered" ? pick([0, 15, 30, 90]) : 0,
        notes: complimentary ? "New lift complimentary first service this month" : "Seed dummy service data",
        createdBy: admin._id,
      };
    });
    const createdJobs = await ServiceJob.insertMany(serviceJobRows);
    for (const job of createdJobs) {
      if (job.complimentary && job.machineId) {
        await Machine.updateOne(
          { _id: job.machineId },
          { $set: { complimentaryServiceJobId: job._id, complimentaryPeriodKey: thisKey } },
        );
      }
    }

    const ledgerRows: {
      docType: "sale" | "service";
      docModel: "Sale" | "ServiceJob";
      docId: unknown;
      docNo?: string;
      partyId?: unknown;
      partyName?: string;
      method: string;
      amount: number;
      paidAt: Date;
      createdBy: unknown;
    }[] = [];
    for (const sale of createdSales as unknown as {
      _id: unknown;
      invoiceNo?: string;
      customerId?: unknown;
      customerName?: string;
      saleDate?: Date;
      payments?: { method: string; amount: number }[];
    }[]) {
      for (const p of sale.payments || []) {
        if (Number(p.amount) > 0) {
          ledgerRows.push({
            docType: "sale",
            docModel: "Sale",
            docId: sale._id,
            docNo: sale.invoiceNo,
            partyId: sale.customerId,
            partyName: sale.customerName,
            method: p.method,
            amount: p.amount,
            paidAt: sale.saleDate || new Date(),
            createdBy: admin._id,
          });
        }
      }
    }
    for (const job of createdJobs) {
      for (const p of job.payments || []) {
        if (Number(p.amount) > 0) {
          ledgerRows.push({
            docType: "service",
            docModel: "ServiceJob",
            docId: job._id,
            docNo: job.jobNo,
            partyId: job.customerId,
            partyName: job.siteName,
            method: p.method,
            amount: p.amount,
            paidAt: job.receivedDate || new Date(),
            createdBy: admin._id,
          });
        }
      }
    }
    if (ledgerRows.length) await PaymentLedger.insertMany(ledgerRows);

    // ─── Verify relations ────────────────────────────────────────
    const [
      productCount,
      supplierCount,
      linkCount,
      purchaseCount,
      saleCount,
      productsWithLinks,
      leaveCount,
      attendanceCount,
      followUpCount,
      ledgerCount,
      jobCount,
      dealCount,
      campaignCount,
      journalCount,
      cylinderCount,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Contact.countDocuments({ type: "supplier", isActive: true }),
      ProductSupplier.countDocuments({ isActive: true }),
      Purchase.countDocuments({}),
      Sale.countDocuments({}),
      ProductSupplier.distinct("productId", { isActive: true }),
      EmployeeLeave.countDocuments({}),
      Attendance.countDocuments({}),
      CrmFollowUp.countDocuments({}),
      PaymentLedger.countDocuments({}),
      ServiceJob.countDocuments({}),
      CrmDeal.countDocuments({}),
      CrmCampaign.countDocuments({}),
      JournalEntry.countDocuments({}),
      CylinderMovement.countDocuments({}),
    ]);

    const sample = await Product.findOne({ sku: "IC0001" }).lean();
    const { attachOffersToProducts } = await import("@/lib/product-suppliers");
    const [sampleWithOffers] = sample
      ? await attachOffersToProducts([sample])
      : [null];

    const res = NextResponse.json({
      ok: true,
      seeded: true,
      force: Boolean(force || existing),
      wiped: Boolean(force || existing),
      prunedCollections: pruned.length,
      prunedEmptyCollections: prunedEmpty.length,
      relations: {
        model: "Product ← ProductSupplier → Contact(supplier)",
        productsWithLinks: productsWithLinks.length,
        allProductsLinked: productsWithLinks.length === productCount,
        sampleOffers: sampleWithOffers?.supplierOffers || [],
      },
      counts: {
        products: productCount,
        suppliers: supplierCount,
        productSupplierLinks: linkCount,
        customers: customerDocs.length,
        employees: employeeDocs.length,
        payslips: payrollSlips.length,
        leaves: leaveCount,
        attendance: attendanceCount,
        technicians: techsDocs.length,
        machines: machinesDocs.length,
        amcContracts: amcDocs.length,
        serviceJobs: jobCount,
        complimentaryJobs: createdJobs.filter((j) => j.complimentary).length,
        followUps: followUpCount,
        deals: dealCount,
        campaigns: campaignCount,
        journals: journalCount,
        cylinders: cylinderCount,
        paymentLedger: ledgerCount,
        purchases: purchaseCount,
        sales: saleCount,
        locations: locations.length,
        categories: cats.length,
      },
      admin: DEMO_ADMIN.email,
      tip: "Open /products — cards show live supplier names from ProductSupplier",
      session: session?.email ?? String(admin.email || DEMO_ADMIN.email),
    });
    applySessionCookie(
      res,
      await createSessionToken({
        id: String(admin._id),
        name: String(admin.name || DEMO_ADMIN.name),
        email: String(admin.email || DEMO_ADMIN.email),
        role: String(admin.role || "admin"),
        locale: admin.locale === "en" ? "en" : "bn",
      }),
    );
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    console.error("POST /api/seed", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

