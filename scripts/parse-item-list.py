"""Parse docs/Item List-2.pdf into src/lib/item-list-catalog.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs" / "Item List-2.pdf"
OUT = ROOT / "src" / "lib" / "item-list-catalog.json"

HEADER_NOISE = [
    r"ROYAL ELEVATOR & ENGINEERS COMPANY",
    r"House#08, Road#06/A, Sector#04, Uttara, Dhaka-1230",
    r"Mobile: 01711151714",
    r"Email: royalgroupofbangladesh@gmail\.com , Website: royalgroupofbangladesh\.com",
    r", , ,",
    r"ITEM LIST",
    r"Item Name & Code Barcode &",
    r"Warranty",
    r"Stock Purchase",
    r"Price Category &",
    r"Brand",
    r"2/2/26, 2:07 PM Item List",
    r"about:blank \d+/21",
]

UNIT_MAP = {
    "pcs": ("Pcs", "পিস"),
    "set": ("Set", "সেট"),
    "pair": ("Pair", "পেয়ার"),
    "foot": ("ft", "ফুট"),
    "miter": ("m", "মিটার"),
    "meter": ("m", "মিটার"),
    "m": ("m", "মিটার"),
}

CAT_BN = {
    "Main Motor": "মেইন মোটর",
    "Inverter": "ইনভার্টার",
    "Pully": "পুলি",
    "LOP": "এলওপি",
    "COP": "সিওপি",
    "Carcuit Braker": "সার্কিট ব্রেকার",
    "Transformer": "ট্রান্সফরমার",
    "Resistor": "রেজিস্টর",
    "Door Lock": "ডোর লক",
    "Door Operator": "ডোর অপারেটর",
    "Guide Shoe": "গাইড শু",
    "Guide Rail": "গাইড রেল",
    "Governor": "গভর্নর",
    "Encoder": "এনকোডার",
    "Relay": "রিলে",
    "Contactor": "কনট্যাক্টর",
    "Switch": "সুইচ",
    "Cable": "কেবল",
    "Belt": "বেল্ট",
    "Rope": "রোপ",
    "Oil": "অয়েল",
    "Fan": "ফ্যান",
    "Brake": "ব্রেক",
    "Button": "বাটন",
    "Display": "ডিসপ্লে",
    "PCB": "পিসিবি",
    "Controller": "কন্ট্রোলার",
    "ARD": "এআরডি",
    "Battery": "ব্যাটারি",
    "Sensor": "সেন্সর",
    "Magnet": "ম্যাগনেট",
    "Magnatic": "ম্যাগনেট",
    "Intercom": "ইন্টারকম",
    "Light": "লাইট",
    "Roller": "রোলার",
    "Hanger": "হ্যাঙ্গার",
    "Limit Switch": "লিমিট সুইচ",
    "Overload": "ওভারলোড",
    "Photocell": "ফটোসেল",
    "Safety": "সেফটি",
    "Door": "ডোর",
    "Uncategorized": "অশ্রেণীবদ্ধ",
}


def clean_text(raw: str) -> str:
    t = raw.replace("\r", "\n")
    t = t.replace("\u00a0", " ")
    for pat in HEADER_NOISE:
        t = re.sub(pat, "\n", t)
    t = re.sub(r"(?im)^\s*Price\s*$", "", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t.strip()


def money(s: str | None) -> float:
    if not s:
        return 0.0
    return float(s.replace(",", ""))


def join_name(lines: list[str]) -> str:
    parts: list[str] = []
    for line in lines:
        s = line.strip()
        if not s or s == ".":
            continue
        if re.fullmatch(r"IC\d{4}", s):
            continue
        if parts and parts[-1].endswith("-"):
            parts[-1] = parts[-1] + s
        else:
            parts.append(s)
    name = " ".join(parts)
    name = re.sub(r"\s+", " ", name).strip(" ,")
    return name


def split_items(text: str) -> list[tuple[str, str, str]]:
    """Return (preceding_text, sku, following_text) for each IC code."""
    matches = list(re.finditer(r"\b(IC\d{4})\b", text))
    out = []
    for i, m in enumerate(matches):
        start = matches[i - 1].end() if i else 0
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out.append((text[start:m.start()], m.group(1), text[m.end() : end]))
    return out


def parse_body(body: str) -> dict:
    lines = [ln.strip() for ln in body.split("\n") if ln.strip()]
    i = 0

    barcode = ""
    qty = 0
    unit_raw = "pcs"

    # barcode + Main: qty [unit]
    if i < len(lines):
        first = lines[i]
        m = re.match(
            r"^(?P<bc>\.|[0-9]+)\s+Main:\s*(?P<qty>\d+)?\s*(?P<unit>[A-Za-z]+)?$",
            first,
        )
        if m:
            barcode = "" if m.group("bc") == "." else m.group("bc")
            if m.group("qty"):
                qty = int(m.group("qty"))
            if m.group("unit"):
                unit_raw = m.group("unit")
            i += 1
            if not m.group("qty") and i < len(lines):
                m2 = re.match(r"^(?P<qty>\d+)\s*(?P<unit>[A-Za-z]+)?$", lines[i])
                if m2:
                    qty = int(m2.group("qty"))
                    if m2.group("unit"):
                        unit_raw = m2.group("unit")
                    i += 1
        elif first == "." or first.isdigit():
            barcode = "" if first == "." else first
            i += 1

    # qty/unit leftover if "Main:" was on its own next line
    if i < len(lines) and re.match(r"^(pcs|Set|Pair|foot|Miter|Meter)$", lines[i], re.I):
        unit_raw = lines[i]
        i += 1

    purchase = retail = wholesale = 0.0
    # purchase / retail
    if i < len(lines):
        m = re.match(
            r"^(?P<p>[\d,]+\.\d{2})\s*(?:Retail:\s*(?P<r>[\d,]+\.\d{2})?)?$",
            lines[i],
        )
        if m:
            purchase = money(m.group("p"))
            if m.group("r"):
                retail = money(m.group("r"))
            i += 1
            if not m.group("r") and i < len(lines) and lines[i].startswith("Retail:"):
                rm = re.search(r"([\d,]+\.\d{2})", lines[i])
                if rm:
                    retail = money(rm.group(1))
                i += 1
            elif not m.group("r") and i < len(lines) and re.match(r"^[\d,]+\.\d{2}$", lines[i]):
                # "Retail:" was on previous line with no amount
                retail = money(lines[i])
                i += 1

    # If retail still 0, next numeric line after "Retail:"
    if retail == 0 and i < len(lines) and lines[i].startswith("Retail:"):
        rm = re.search(r"([\d,]+\.\d{2})", lines[i])
        if rm:
            retail = money(rm.group(1))
            i += 1
        elif i + 1 < len(lines) and re.match(r"^[\d,]+\.\d{2}$", lines[i + 1]):
            retail = money(lines[i + 1])
            i += 2

    category = ""
    brand = ""
    rest = lines[i:]

    # Wholesale may appear before or after category/brand (page-break shuffle)
    def take_wholesale(seq: list[str]) -> tuple[float, list[str]]:
        for j, ln in enumerate(seq):
            if ln.startswith("Wholesale:"):
                amt = 0.0
                wm = re.search(r"([\d,]+\.\d{2})", ln)
                if wm:
                    amt = money(wm.group(1))
                    return amt, seq[:j] + seq[j + 1 :]
                if j + 1 < len(seq) and re.match(r"^[\d,]+\.\d{2}$", seq[j + 1]):
                    return money(seq[j + 1]), seq[:j] + seq[j + 2 :]
                return 0.0, seq[:j] + seq[j + 1 :]
        return 0.0, seq

    wholesale, rest = take_wholesale(rest)

    # Remaining head is category + brand, tail is next product name
    cat_brand: list[str] = []
    name_lines: list[str] = []
    for ln in rest:
        if len(cat_brand) < 2:
            cat_brand.append(ln)
        else:
            name_lines.append(ln)

    if cat_brand:
        category = "" if cat_brand[0] == "." else cat_brand[0]
    if len(cat_brand) > 1:
        brand = "" if cat_brand[1] == "." else cat_brand[1]

    return {
        "barcode": barcode,
        "qty": qty,
        "unit_raw": unit_raw,
        "purchase": purchase,
        "retail": retail,
        "wholesale": wholesale,
        "category": category,
        "brand": brand,
        "next_name_lines": name_lines,
    }


def normalize_unit(raw: str) -> tuple[str, str]:
    key = (raw or "pcs").strip().lower()
    return UNIT_MAP.get(key, ("Pcs", "পিস"))


def main() -> None:
    reader = PdfReader(str(PDF))
    raw = "\n".join((p.extract_text() or "") for p in reader.pages)
    text = clean_text(raw)
    chunks = split_items(text)
    products = []
    pending_name_lines: list[str] = []

    # First chunk preceding text is the first product name
    if chunks:
        pending_name_lines = [
            ln.strip() for ln in chunks[0][0].split("\n") if ln.strip()
        ]

    problems = []
    for preceding, sku, body in chunks:
        if not pending_name_lines:
            pending_name_lines = [ln.strip() for ln in preceding.split("\n") if ln.strip()]
        name = join_name(pending_name_lines)
        parsed = parse_body(body)
        pending_name_lines = parsed["next_name_lines"]
        unit, unit_bn = normalize_unit(parsed["unit_raw"])
        category = parsed["category"] or "Uncategorized"
        brand = parsed["brand"] or "Generic"
        sell = parsed["retail"] or parsed["wholesale"] or parsed["purchase"]
        qty = parsed["qty"]
        alert = 1 if qty <= 0 else max(1, min(20, max(1, qty // 5) or 1))
        row = {
            "name": name,
            "sku": sku,
            "barcode": parsed["barcode"],
            "category": category,
            "brand": brand,
            "unit": unit,
            "unitBn": unit_bn,
            "purchasePrice": parsed["purchase"],
            "sellPrice": sell,
            "wholesalePrice": parsed["wholesale"] or sell,
            "quantity": qty,
            "alertQty": alert,
        }
        if not name or parsed["purchase"] <= 0:
            problems.append(row)
        products.append(row)

    cats = sorted({p["category"] for p in products})
    brands = sorted({p["brand"] for p in products})
    units = sorted({p["unit"] for p in products})

    OUT.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print("items", len(products), "expected 371")
    print("problems", len(problems))
    for p in problems[:15]:
        print("  BAD", p["sku"], repr(p["name"]), p["purchasePrice"], p["sellPrice"], p["quantity"])
    print("categories", len(cats))
    for c in cats:
        print("  CAT", repr(c))
    print("brands", len(brands))
    for b in brands:
        print("  BRAND", repr(b))
    print("units", units)
    print("sample IC0001", next(p["sku"] + " " + p["name"] + " " + str(p["quantity"]) for p in products if p["sku"] == "IC0001"))
    print("sample IC0384", next(p["sku"] + " " + p["name"] for p in products if p["sku"] == "IC0384"))
    print("sample IC0318", next(p["sku"] + " qty=" + str(p["quantity"]) + " unit=" + p["unit"] for p in products if p["sku"] == "IC0318"))
    print("sample IC0104", next(p["sku"] + " " + str(p["sellPrice"]) for p in products if p["sku"] == "IC0104"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
