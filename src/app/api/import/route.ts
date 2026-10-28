import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Contact, Product, nextSeq } from "@/models";
import { canWrite } from "@/lib/rbac";

function parseCsv(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

function headerIndex(headers: string[], names: string[]) {
  const lower = headers.map((h) => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase().replace(/\s+/g, ""));
    if (i >= 0) return i;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const type = String(body.type || "products");
  const csv = String(body.csv || "");
  if (!csv.trim()) {
    return NextResponse.json({ error: "empty_csv" }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ error: "no_rows" }, { status: 400 });
  }

  const headers = rows[0]!;
  const dataRows = rows.slice(1);
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    if (type === "products") {
      const iName = headerIndex(headers, ["name", "product", "productname"]);
      const iSku = headerIndex(headers, ["sku", "code"]);
      const iSell = headerIndex(headers, ["sellprice", "price", "sell"]);
      const iPurchase = headerIndex(headers, ["purchaseprice", "cost", "purchase"]);
      const iBrand = headerIndex(headers, ["brand"]);
      if (iName < 0) {
        return NextResponse.json(
          { error: "missing_name_column", tip: "CSV needs a name column" },
          { status: 400 },
        );
      }

      for (const row of dataRows) {
        const name = row[iName]?.trim();
        if (!name) {
          skipped += 1;
          continue;
        }
        let sku = iSku >= 0 ? row[iSku]?.trim() : "";
        if (!sku) {
          const seq = await nextSeq("product_sku");
          sku = `SKU-${String(seq).padStart(5, "0")}`;
        }
        const exists = await Product.findOne({ sku }).lean();
        if (exists) {
          skipped += 1;
          continue;
        }
        await Product.create({
          name,
          sku,
          barcode: sku,
          brand: iBrand >= 0 ? row[iBrand] : "",
          sellPrice: Number(iSell >= 0 ? row[iSell] || 0 : 0),
          purchasePrice: Number(iPurchase >= 0 ? row[iPurchase] || 0 : 0),
          unit: "Pcs",
          unitBn: "পিস",
          isActive: true,
          stocks: [],
        });
        created += 1;
      }
    } else if (type === "contacts" || type === "customers" || type === "suppliers") {
      const contactType =
        type === "suppliers" ? "supplier" : type === "customers" ? "customer" : "customer";
      const iName = headerIndex(headers, ["name"]);
      const iMobile = headerIndex(headers, ["mobile", "phone"]);
      const iEmail = headerIndex(headers, ["email"]);
      const iAddress = headerIndex(headers, ["address"]);
      const iLocation = headerIndex(headers, ["location", "area"]);
      const iCity = headerIndex(headers, ["city"]);
      const iContact = headerIndex(headers, ["contactperson", "contact_person", "contact"]);
      const iGroup = headerIndex(headers, ["group"]);
      const iNid = headerIndex(headers, ["nid"]);
      if (iName < 0 || iMobile < 0) {
        return NextResponse.json(
          { error: "missing_columns", tip: "CSV needs name and mobile columns" },
          { status: 400 },
        );
      }
      for (const row of dataRows) {
        const name = row[iName]?.trim();
        const mobile = row[iMobile]?.trim();
        if (!name || !mobile) {
          skipped += 1;
          continue;
        }
        const exists = await Contact.findOne({ mobile }).lean();
        if (exists) {
          skipped += 1;
          continue;
        }
        await Contact.create({
          type: contactType,
          name,
          mobile,
          email: iEmail >= 0 ? row[iEmail] : "",
          address: iAddress >= 0 ? row[iAddress] : "",
          location: iLocation >= 0 ? row[iLocation] : "",
          city: iCity >= 0 ? row[iCity] : "",
          contactPerson: iContact >= 0 ? row[iContact] : "",
          group: iGroup >= 0 ? row[iGroup] : "",
          nid: iNid >= 0 ? String(row[iNid] || "").trim() || undefined : undefined,
          isActive: true,
          balance: 0,
          openingBalance: 0,
        });
        created += 1;
      }
    } else {
      return NextResponse.json({ error: "unknown_type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, created, skipped, errors });
  } catch (err) {
    console.error("POST /api/import", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
