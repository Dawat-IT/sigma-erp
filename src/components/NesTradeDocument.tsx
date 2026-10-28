"use client";

import { amountInWords, formatDateBD } from "@/lib/utils";
import { DEFAULT_DOCUMENT_BODY } from "@/lib/default-document-body";
import { resolveDocumentSubject } from "@/lib/document-subject";
import { BRAND, companyLetterhead } from "@/lib/brand";

export type TradeDocKind = "bill" | "quotation" | "challan" | "proposal";

export type TradeItem = {
  name?: string;
  sku?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  qty?: number;
  unitPrice?: number;
  discount?: number;
  lineTotal?: number;
  remarks?: string;
};

export type TradeSale = {
  _id?: string;
  invoiceNo?: string;
  proposalNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  poNo?: string;
  poDate?: string;
  subject?: string;
  documentBody?: string;
  terms?: string;
  currency?: string;
  status?: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  items?: TradeItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  payments?: { method: string; amount: number; paidAt?: string; note?: string }[];
  previousDue?: number;
  customerCompanyName?: string;
  customerContactPerson?: string;
  createdAt?: string;
  note?: string;
  soldByName?: string;
  saleDate?: string;
};

export type TradeBusiness = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
};

export type TradeChallan = {
  shipmentNo?: string;
  shippedDate?: string;
  items?: TradeItem[];
};

function dash(value?: string | number | null) {
  if (value === 0) return "0";
  if (value == null || value === "") return "";
  return String(value);
}

function formatEnDate(value?: string) {
  if (!value) return "";
  return formatDateBD(value, "en");
}

function formatHyphenDate(value?: string | Date) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDhakaTime(value?: string | Date) {
  if (!value) return "10:00 AM";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "10:00 AM";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  });
}

function lineAmount(item: TradeItem) {
  const qty = Number(item.qty || 0);
  const price = Number(item.unitPrice || 0);
  const disc = Number(item.discount || 0);
  const computed = Math.max(0, qty * price - disc);
  const stored = Number(item.lineTotal);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return computed;
}

function taka(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function englishName(name?: string, fallback = "Authorized Signatory") {
  const v = String(name || "").trim();
  if (!v) return fallback;
  if (/[^\u0000-\u007f]/.test(v)) return fallback;
  if (/admin/i.test(v)) return fallback;
  return v;
}

// ------------------------------------------------------------------
// LAYOUT 1: Pad / Challan Layout (Image 1)
// ------------------------------------------------------------------
function PadLayout({
  kind, sale, business, challan, showChrome, docNo, docDate, docTitle, subject, documentBody, terms, items, bizName, bizAddress, signName
}: any) {
  const ITEMS_PER_PAGE = 10;
  const itemPages: TradeItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    itemPages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (!itemPages.length) itemPages.push([]);
  const qtyTotal = items.reduce((a: number, i: any) => a + Number(i.qty || 0), 0);

  return (
    <>
      {itemPages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === itemPages.length - 1;
        const slOffset = pageIdx * ITEMS_PER_PAGE;
        return (
          <article
            key={pageIdx}
            className={`nes-sheet ${showChrome ? "" : " nes-no-chrome"}`}
            style={{ display: 'flex', flexDirection: 'column', color: '#333' }}
          >
            {showChrome ? (
              <div className="nes-watermark" aria-hidden>
                {BRAND.company}
              </div>
            ) : null}

            <header className="flex items-center gap-6 pb-2">
              <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                {business?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="w-[84px] h-[84px] rounded-full border-[3px] border-[#333] flex flex-col items-center justify-center text-xl font-bold bg-[#f1f1f1]">
                    {BRAND.logoMark}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left text-[#333]">
                <h1 className="text-[28px] leading-none font-serif font-black uppercase tracking-tight" style={{ fontFamily: '"Times New Roman", Times, serif', transform: 'scaleY(1.15)', transformOrigin: 'left bottom' }}>
                  {bizName}
                </h1>
                <p className="text-[13.5px] font-bold uppercase tracking-wider mt-2.5">
                  OUR FIRST PRIORITY BEST QUALITY & BEST SERVICE.
                </p>
                <div className="text-[14px] mt-1.5 leading-snug">
                  <p><b>Head Office:</b> {bizAddress || "House # 08 (1st Fl.), Road # 06/A, Sector # 04, Uttara, Dhaka."}</p>
                  <p><b>Phone:</b> {business?.phone || "02-48957715, 01711-15 17 14"}, <b>E-mail:</b> {business?.email || "sigma.ps2007@gmail.com"}</p>
                </div>
              </div>
            </header>

            <div className="flex items-center justify-between mt-2 font-bold text-[15px]">
              <div className="flex items-center gap-2">
                <span>No:</span>
                <span className="w-32 inline-block font-mono text-lg tracking-widest">{docNo}</span>
              </div>
              <div className="bg-[#5a4843] text-white px-5 py-0.5 rounded-full tracking-widest uppercase text-[15px] border-2 border-transparent" style={{ boxShadow: "0 0 0 2px #fff, 0 0 0 4px #5a4843" }}>
                BILL/ CHALLAN
              </div>
              <div className="flex items-center gap-2">
                <span>Date:</span>
                <span className="w-32 inline-block border-b-[1.5px] border-dotted border-gray-400 text-center font-mono">{formatEnDate(docDate)}</span>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-[15px]">
              <div className="flex gap-2 items-end">
                <span className="w-20">Name:</span>
                <div className="flex-1 border-b-[1.5px] border-dotted border-gray-500 pb-0.5">{sale.customerName || "\u00A0"}</div>
              </div>
              <div className="flex gap-2 items-end">
                <span className="w-20">Address:</span>
                <div className="flex-1 border-b-[1.5px] border-dotted border-gray-500 pb-0.5">{sale.customerAddress || "\u00A0"}</div>
              </div>
            </div>

            {pageIdx === 0 && subject ? (
              <div className="mt-3 text-[15px]">
                <b>Subject:</b> {subject}
              </div>
            ) : null}

            {pageIdx === 0 && documentBody.trim() ? (
              <div className="mt-2 text-[15px] whitespace-pre-wrap">
                {documentBody}
              </div>
            ) : null}

            <div className="mt-4 flex-1 flex flex-col border-[1.5px] border-black">
              <table className="w-full text-left border-collapse h-full">
                <thead>
                  <tr className="border-b-[1.5px] border-black text-[15px] font-bold">
                    <th className="border-r-[1.5px] border-black p-2 w-16 text-center">SL.No.</th>
                    <th className="border-r-[1.5px] border-black p-2 text-center">Description</th>
                    <th className="border-r-[1.5px] border-black p-2 w-28 text-center">Quantity</th>
                    <th className="p-2 w-36 text-center">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border-r-[1.5px] border-black p-2 text-center align-top">{slOffset + idx + 1}</td>
                      <td className="border-r-[1.5px] border-black p-2 align-top">
                        <b>{item.name}</b>
                        {item.description && <div>{item.description}</div>}
                      </td>
                      <td className="border-r-[1.5px] border-black p-2 text-center align-top">{item.qty || 0}</td>
                      <td className="p-2 text-right align-top">{taka(lineAmount(item))}</td>
                    </tr>
                  ))}
                  <tr className="h-[99%]">
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td></td>
                  </tr>
                  {isLast && (
                    <tr className="border-t-[1.5px] border-black text-[15px] font-bold">
                      <td colSpan={2} className="border-r-[1.5px] border-black p-2 text-right">TOTAL</td>
                      <td className="border-r-[1.5px] border-black p-2 text-center">{qtyTotal}</td>
                      <td className="p-2 text-right">{taka(sale.grandTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {isLast && (
              <div className="mt-3">
                <div className="flex gap-2 items-end text-[15px]">
                  <span className="">Taka (In Words)</span>
                  <div className="flex-1 border-b-[1.5px] border-dotted border-gray-500 pb-0.5 ml-2 font-bold">{amountInWords(sale.grandTotal || 0, "en")} {sale.grandTotal ? "Only" : ""}</div>
                </div>

                {terms.length > 0 && (
                  <div className="mt-4 text-[13px] leading-snug">
                    <p><b>Terms &amp; Conditions</b></p>
                    {terms.map((line: string) => (
                      <p key={line}>
                        <span className="mr-1">◆</span> {line.replace(/^[-◆]\s*/, "")}
                      </p>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-end mt-20 mb-2 text-[15px]">
                  <div className="w-48 text-center border-t-[1.5px] border-black pt-1">Receivers</div>
                  <div className="w-48 text-center border-t-[1.5px] border-black pt-1">
                    {signName !== "Authorized Signatory" ? (
                      <>
                        <b className="block">{signName}</b>
                        <span>Authorised Signature</span>
                      </>
                    ) : (
                      "Authorised Signature"
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------
// HELPER: Extract image URLs (handles data URLs, newlines, JSON arrays, pipes)
// ------------------------------------------------------------------
export function extractImageUrls(raw?: string): string[] {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // fallback
    }
  }
  if (trimmed.includes("\n")) {
    return trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (trimmed.includes("||")) {
    return trimmed.split("||").map((s) => s.trim()).filter(Boolean);
  }
  return [trimmed];
}

// ------------------------------------------------------------------
// HELPER: Highlight elevator spec text (colors, bold keywords)
// ------------------------------------------------------------------
function FormattedSpecText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);

  return (
    <div className="space-y-0.5">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

        // Custom tags: [red]...[/red], [blue]...[/blue], [purple]...[/purple], [bold]...[/bold], **...**
        // Also auto-detect keywords: Thickness=..., Note:..., FUJI..., etc.
        const elements: React.ReactNode[] = [];
        const regex = /((?:\[red\][\s\S]*?\[\/red\])|(?:\[blue\][\s\S]*?\[\/blue\])|(?:\[purple\][\s\S]*?\[\/purple\])|(?:\*\*[\s\S]*?\*\*)|(?:Thickness\s*=\s*[\d.]+\s*(?:mm|MM)?)|(?:FUJI\s+LOGO\s+ON\s+TOP)|(?:Finger\s+Print\s+Proof|Fingure\s+Print\s+Proof)|(?:With\s+Panasonic\s+Door\s+Inverter\.?)|(?:Cabin\s+Door\s+&\s+GF\s+Door\s+Will\s+be\s+Gold\s+round\s+Design)|(?:NEW\s+MADE\s+ZERO\s+DEGREE\s+ANGLE)|(?:Weight\s+Type)|(?:With\s+New\s+Tension\s+Pully)|(?:CTB-A(?:\s+Original\s+Board\s*&)?)|(?:\bTFT\b)|(?:\bSTEP\b)|(?:Guide\s+rails\s+T89\s*\+\s*TK5A[^\n,]*)|(?:Guide\s+Rail\s+Braket[^\n,]*)|(?:All\s+Button\s+in\s+One\s+Line\([^)]*\)\.?)|(?:As\s+Complete\s+Elevator\s+The\s+Label[\s\S]*?Free)|(?:Hoist\s*way\s*=\s*[^\n,]+)|(?:With\s+Metal\s+Base)|(?:11KW)|(?:NANTONG\s+FUJI\s+ELEVATOR\s+CO\.,?\s*LTD)|(?:CCB\s+Card\.G-9(?:\s*\([^)]*\))?)|(?:CO\s*800\*2100[^\n,]*)|(?:\(BY\s+VERTEX\))|(?:Speed:\s*1\.5\s*MPS)|(?:Note\s*:\s*[^\n,]+))/gi;

        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(trimmed)) !== null) {
          const matchStart = match.index;
          const matchText = match[0];

          if (matchStart > lastIndex) {
            elements.push(trimmed.slice(lastIndex, matchStart));
          }

          if (matchText.startsWith("[red]") && matchText.endsWith("[/red]")) {
            elements.push(<strong key={matchStart} className="text-[#d32f2f] font-bold">{matchText.slice(5, -6)}</strong>);
          } else if (matchText.startsWith("[blue]") && matchText.endsWith("[/blue]")) {
            elements.push(<strong key={matchStart} className="text-[#1976d2] font-bold">{matchText.slice(6, -7)}</strong>);
          } else if (matchText.startsWith("[purple]") && matchText.endsWith("[/purple]")) {
            elements.push(<strong key={matchStart} className="text-[#7b1fa2] font-bold">{matchText.slice(8, -9)}</strong>);
          } else if (matchText.startsWith("**") && matchText.endsWith("**")) {
            elements.push(<strong key={matchStart} className="font-bold">{matchText.slice(2, -2)}</strong>);
          } else if (/Thickness|FUJI LOGO|Print Proof|Panasonic|Gold round|Weight Type|CTB-A|Guide rail|Guide Rail Braket|Motor Bolt|Hoist way|With Metal Base|11KW|NANTONG FUJI|CCB Card|CO 800\*2100/i.test(matchText)) {
            elements.push(<strong key={matchStart} className="text-[#d32f2f] font-bold">{matchText}</strong>);
          } else if (/NEW MADE|Tension Pully|STEP|PU Pulley|BY VERTEX|Speed:\s*1\.5/i.test(matchText)) {
            elements.push(<strong key={matchStart} className="text-[#1976d2] font-bold">{matchText}</strong>);
          } else if (/All Button|Complete Elevator.*Free/i.test(matchText)) {
            elements.push(<strong key={matchStart} className="text-[#7b1fa2] font-bold">{matchText}</strong>);
          } else if (/^Note\s*:/i.test(matchText)) {
            elements.push(<strong key={matchStart} className="text-[#d32f2f] font-bold">{matchText}</strong>);
          } else {
            elements.push(<strong key={matchStart} className="font-bold">{matchText}</strong>);
          }

          lastIndex = matchStart + matchText.length;
        }

        if (lastIndex < trimmed.length) {
          elements.push(trimmed.slice(lastIndex));
        }

        return <div key={lineIdx}>{elements.length ? elements : trimmed}</div>;
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// LAYOUT 3: Elevator Specification Quotation Layout (Matches sample images)
// ------------------------------------------------------------------
function ElevatorQuotationLayout({
  kind, sale, business, showChrome, docNo, docDate, docTitle, subject, documentBody, terms, items, bizName, bizAddress, signName
}: any) {
  const currency = String(sale.currency || "USD").toUpperCase();
  const grandTotal = Number(sale.grandTotal || 0);

  return (
    <article
      className={`nes-sheet elv-quotation-sheet ${showChrome ? "" : " nes-no-chrome"}`}
      style={{ display: "flex", flexDirection: "column", color: "#1a1a1a", minHeight: "297mm", padding: "10mm 12mm" }}
    >
      {showChrome ? (
        <div className="nes-watermark" aria-hidden>
          {BRAND.company}
        </div>
      ) : null}

      {/* Letterhead Header */}
      <header className="border-b-[3px] border-[#29427e] pb-1 mb-2 relative">
        <div className="border-b border-[#29427e] pb-2 flex items-center gap-4">
          <div className="w-[84px] h-[84px] shrink-0 flex items-center justify-center">
            {business?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="w-[84px] h-[84px] rounded-full border-[3px] border-[#29427e] flex flex-col items-center justify-center text-xl font-bold text-[#29427e] bg-white">
                {BRAND.logoMark}
              </span>
            )}
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-[30px] leading-none font-serif font-black uppercase text-[#29427e]" style={{ fontFamily: '"Times New Roman", Times, serif', transform: "scaleY(1.15)", transformOrigin: "center bottom" }}>
              {bizName}
            </h1>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.02em] mt-2 text-[#29427e]">
              ALL KINDS OF LIFT, GENERATOR, SUB-STATION, VOLTAGE STABILIZER, ON LINE - ARD.<br />
              OFF LINE - ARD., SERVICE &amp; MAINTENANCE, SPARE PARTS SUPPLIER.
            </p>
          </div>
        </div>
      </header>

      {/* Title */}
      <div className="text-center my-2">
        <span className="text-xl font-bold uppercase underline tracking-wider decoration-2 underline-offset-4">
          {docTitle || "QUOTATION"}
        </span>
      </div>

      {/* Meta Info */}
      <div className="flex justify-between text-[14px] font-bold mb-3">
        <div>
          Date <span className="ml-8 mr-2">:</span> {formatEnDate(docDate)}
        </div>
        <div>
          Ref. No <span className="ml-2 mr-2">:</span> {docNo}
        </div>
      </div>

      {/* Customer Info */}
      <div className="space-y-1 text-[14px] mb-4">
        <div className="flex gap-2">
          <span className="w-32 font-medium">Customer Name</span>
          <span className="font-bold">: {sale.customerName || "-"}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-32 font-medium">Address</span>
          <span className="font-bold">: {sale.customerAddress || "-"}</span>
        </div>
        {sale.customerMobile ? (
          <div className="flex gap-2">
            <span className="w-32 font-medium">Contact No</span>
            <span className="font-bold">: {sale.customerMobile}</span>
          </div>
        ) : null}
        {sale.attention ? (
          <div className="flex gap-2">
            <span className="w-32 font-medium">Attention</span>
            <span className="font-bold">: {sale.attention}</span>
          </div>
        ) : null}
      </div>

      {/* Subject */}
      {subject ? (
        <div className="mb-3 text-[14px] flex gap-2">
          <u className="font-bold">Subject:</u>
          <span className="font-bold underline">{subject}</span>
        </div>
      ) : null}

      {/* Intro Greeting */}
      {documentBody && documentBody.trim() ? (
        <div className="mb-3 text-[13.5px] whitespace-pre-wrap leading-relaxed">
          {documentBody}
        </div>
      ) : null}

      {/* THE ELEVATOR SPECIFICATION TABLE */}
      <div className="mt-2 flex-1 flex flex-col border-[1.5px] border-black bg-white">
        <table className="elv-quote-table w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white text-[12.5px] font-bold text-center tracking-wide" style={{ backgroundColor: "#000", color: "#fff" }}>
              <th className="border border-black p-2 w-[13%]">GNL CODE</th>
              <th className="border border-black p-2 w-[16%]">Photo</th>
              <th className="border border-black p-2 w-[43%]">DESCRIPTION</th>
              <th className="border border-black p-2 w-[7%]">Quantity</th>
              <th className="border border-black p-2 w-[6%]">Unit</th>
              <th className="border border-black p-2 w-[11%]">Unit Price({currency})</th>
              <th className="border border-black p-2 w-[12%]">Total Price({currency})</th>
            </tr>
          </thead>
          <tbody>
            {/* Project Specification Header Banner Row */}
            <tr className="bg-[#f7f9fa] border-b-[1.5px] border-black font-bold text-center text-[12.5px]">
              <td colSpan={7} className="p-2 border border-black leading-snug">
                <div>( {docNo || sale.referenceNo || "ELV-SPEC"} ) Project Name: {subject || sale.customerName || "ELEVATOR PROJECT"}</div>
              </td>
            </tr>

            {/* Item Rows */}
            {items.map((item: any, idx: number) => {
              const photos = extractImageUrls(item.imageUrl);
              const lineTot = lineAmount(item);
              const isFreeLine = lineTot === 0 && (Number(item.qty || 0) > 0 || /Free/i.test(item.description || item.name || ""));

              return (
                <tr key={idx} className="border-b-[1.5px] border-black hover:bg-slate-50/40">
                  {/* GNL CODE */}
                  <td className="border-r-[1.5px] border-black p-2 text-center align-middle font-bold text-[12px] font-mono">
                    {item.sku || "N/A"}
                  </td>

                  {/* Photo */}
                  <td className="border-r-[1.5px] border-black p-2 text-center align-middle bg-white">
                    {photos.length > 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                        {photos.map((src, photoIdx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={photoIdx}
                            src={src}
                            alt={item.name || "Elevator item"}
                            className="max-h-24 max-w-full rounded object-contain border border-gray-200 shadow-sm"
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>

                  {/* DESCRIPTION */}
                  <td className="border-r-[1.5px] border-black p-2.5 text-left align-middle text-[12px] leading-relaxed text-[#1a1a1a]">
                    {item.name && (!item.description || !item.description.includes(item.name)) ? (
                      <div className="font-bold text-[12.5px] mb-1 text-black">{item.name}</div>
                    ) : null}
                    <FormattedSpecText text={item.description || item.name || ""} />
                  </td>

                  {/* Quantity */}
                  <td className={`border-r-[1.5px] border-black p-2 text-center align-middle font-bold ${isFreeLine ? "text-[#7b1fa2] text-[17px] font-black" : "text-[13px]"}`}>
                    {item.qty || 0}
                  </td>

                  {/* Unit */}
                  <td className={`border-r-[1.5px] border-black p-2 text-center align-middle ${isFreeLine ? "text-[#7b1fa2] text-[17px] font-black" : "text-[12.5px] font-medium"}`}>
                    {item.unit || "Pcs"}
                  </td>

                  {/* Unit Price */}
                  <td className={`border-r-[1.5px] border-black p-2 text-right align-middle text-[12.5px] tabular-nums font-mono ${isFreeLine ? "text-[#7b1fa2] font-bold" : "font-medium"}`}>
                    {Number(item.unitPrice || 0).toFixed(2)}
                  </td>

                  {/* Total Price */}
                  <td className="p-2 text-right align-middle text-[12.5px] tabular-nums font-mono font-bold">
                    {Number(lineTot || 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            <tr className="border-t-[2px] border-black font-bold text-[13px]">
              <td colSpan={5} className="border-0 p-2"></td>
              <td className="border border-black p-2 text-right bg-[#f7f9fa] whitespace-nowrap">
                Total ({currency})
              </td>
              <td className="border border-black p-2 text-right bg-[#f7f9fa] font-mono tabular-nums text-[13.5px]">
                {grandTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pb-8">
        <div className="flex gap-2 items-center text-[14px] font-bold">
          <span>In Words :</span>
          <span className="underline ml-2">
            {amountInWords(grandTotal, "en")} {currency === "USD" ? "Dollars Only." : "Taka Only."}
          </span>
        </div>

        {terms && terms.length > 0 && (
          <div className="mt-5 text-[12.5px] leading-snug">
            <p className="font-bold text-[13px] mb-1">Terms &amp; Conditions :</p>
            {terms.map((line: string) => (
              <p key={line} className="text-[#333]">
                <span className="mr-1 text-black font-bold">◆</span> {line.replace(/^[-◆•]\s*/, "")}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-between items-end mt-16 mb-4 text-[14px]">
          <div className="w-52 text-center border-t-[1.5px] border-black pt-1 font-medium">
            Receiver&apos;s Signature
          </div>
          <div className="w-56 text-center border-t-[1.5px] border-black pt-1">
            <b className="block text-[14px]">For, {bizName}</b>
            <span className="text-[13px] text-gray-700 font-medium">
              {signName !== "Authorized Signatory" ? signName : "Authorized Signatory"}
            </span>
          </div>
        </div>
      </div>

      {/* Office Footer */}
      <footer className="mt-auto pt-2 border-t-[1.5px] border-black grid grid-cols-4 gap-3 text-[9.5px] leading-[1.3] text-[#333]">
        <div>
          <span className="font-bold text-[10.5px]">Head Office:</span> House # 08,<br />
          Road # 06/A, Sector # 04, Uttara<br />
          <b>Web:</b> www.royalgroupofbangladesh.com<br />
          Dhaka. <b>Cell:</b> 01711-15 17 14
        </div>
        <div>
          <span className="font-bold text-[10.5px]">Cox&apos;s Bazar Office:</span> Kobir Guest House<br />
          3rd Floor, Kolatoli, Cox&apos;s Bazar<br />
          <b>E-mail:</b> royalgroupofbangladesh@gmail.com<br />
          <b className="text-[10.5px]">Cell: 01869-70 80 71</b>
        </div>
        <div>
          <span className="font-bold text-[10.5px]">Barishal Office:</span><br />
          Amena Monjil, 01 No, C&amp;B Bridge<br />
          14 no. Word, BCC, Barishal.<br />
          <b>Cell:</b> 01712-20 19 08
        </div>
        <div>
          <span className="font-bold text-[10.5px]">Chittagong Office:</span><br />
          Green Leaf Licha East Nasirabad<br />
          CDA Avenue Chittagong<br />
          <b>Cell:</b> 01712-78 26 30
        </div>
      </footer>
    </article>
  );
}

// ------------------------------------------------------------------
// LAYOUT 2: Letterhead / Bill Layout (Image 2)
// ------------------------------------------------------------------
function LetterheadLayout({
  kind, sale, business, challan, showChrome, docNo, docDate, docTitle, subject, documentBody, terms, items, bizName, bizAddress, signName
}: any) {
  const ITEMS_PER_PAGE = 10;
  const itemPages: TradeItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    itemPages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (!itemPages.length) itemPages.push([]);
  const qtyTotal = items.reduce((a: number, i: any) => a + Number(i.qty || 0), 0);

  return (
    <>
      {itemPages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === itemPages.length - 1;
        const slOffset = pageIdx * ITEMS_PER_PAGE;
        return (
          <article
            key={pageIdx}
            className={`nes-sheet ${showChrome ? "" : " nes-no-chrome"}`}
            style={{ display: 'flex', flexDirection: 'column', color: '#1a1a1a' }}
          >
            {showChrome ? (
              <div className="nes-watermark" aria-hidden>
                {BRAND.company}
              </div>
            ) : null}

            {/* Letterhead Header */}
            <header className="border-b-[3px] border-[#29427e] pb-1 mb-1 relative">
              <div className="border-b border-[#29427e] pb-2 flex items-center gap-4">
                <div className="w-[84px] h-[84px] shrink-0 flex items-center justify-center">
                  {business?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="w-[84px] h-[84px] rounded-full border-[3px] border-[#29427e] flex flex-col items-center justify-center text-xl font-bold text-[#29427e] bg-white">
                      {BRAND.logoMark}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-[32px] leading-none font-serif font-black uppercase text-[#29427e]" style={{ fontFamily: '"Times New Roman", Times, serif', transform: 'scaleY(1.15)', transformOrigin: 'center bottom' }}>
                    {bizName}
                  </h1>
                  <p className="text-[12px] font-bold uppercase tracking-[0.02em] mt-2 text-[#29427e]">
                    ALL KINDS OF LIFT, GENERATOR, SUB-STATION, VOLTAGE STABILIZER, ON LINE - ARD.<br/>
                    OFF LINE - ARD., SERVICE & MAINTENANCE, SPARE PARTS SUPPLIER.
                  </p>
                </div>
              </div>
            </header>

            {/* Title */}
            <div className="text-center mt-3 mb-4">
              <span className="text-xl font-bold uppercase underline tracking-wider decoration-2 underline-offset-4">{docTitle}</span>
            </div>

            {/* Meta Data */}
            <div className="flex justify-between text-[15px] font-bold mb-4">
              <div>
                Date <span className="ml-8 mr-2">:</span> {formatEnDate(docDate)}
              </div>
              <div>
                Ref. No <span className="ml-2 mr-2">:</span> {docNo}
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-1 text-[15px] mb-6">
              <div className="flex gap-2">
                <span className="w-32 font-medium">Customer Name</span>
                <span className="font-bold">: {sale.customerName || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-32 font-medium">Address</span>
                <span className="font-bold">: {sale.customerAddress || "-"}</span>
              </div>
            </div>

            {/* Subject */}
            {pageIdx === 0 && subject ? (
              <div className="mb-4 text-[15px] flex gap-2">
                <u className="font-bold">Subject:</u>
                <span className="font-bold underline">{subject}</span>
              </div>
            ) : null}

            {pageIdx === 0 && documentBody.trim() ? (
              <div className="mb-4 text-[15px] whitespace-pre-wrap">
                {documentBody}
              </div>
            ) : null}

            {/* Table */}
            <div className="mt-2 flex-1 flex flex-col border-[1.5px] border-black">
              <table className="w-full text-left border-collapse h-full">
                <thead>
                  <tr className="border-b-[1.5px] border-black text-[15px] font-bold">
                    <th className="border-r-[1.5px] border-black p-2 w-12 text-center">SL</th>
                    <th className="border-r-[1.5px] border-black p-2 text-center">Description</th>
                    <th className="border-r-[1.5px] border-black p-2 w-28 text-center">Quantity</th>
                    <th className="border-r-[1.5px] border-black p-2 w-28 text-center">Rate</th>
                    <th className="p-2 w-32 text-center">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border-r-[1.5px] border-black p-2 text-center align-top">{slOffset + idx + 1}</td>
                      <td className="border-r-[1.5px] border-black p-2 align-top font-bold">
                        {item.name}
                        {item.description && <div className="font-normal">{item.description}</div>}
                      </td>
                      <td className="border-r-[1.5px] border-black p-2 text-center align-top font-medium">{item.qty || 0} {item.unit || "Pcs"}</td>
                      <td className="border-r-[1.5px] border-black p-2 text-right align-top font-medium">{taka(Number(item.unitPrice || 0))}</td>
                      <td className="p-2 text-right align-top font-medium">{taka(lineAmount(item))}</td>
                    </tr>
                  ))}
                  <tr className="h-[99%]">
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td></td>
                  </tr>
                  {isLast && (
                    <tr className="border-t-[1.5px] border-black text-[15px] font-bold">
                      <td colSpan={3} className="border-r-[1.5px] border-black p-2"></td>
                      <td className="border-r-[1.5px] border-black p-2 text-right">Total</td>
                      <td className="p-2 text-right">{taka(sale.grandTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Signatures */}
            {isLast && (
              <div className="mt-4 pb-12">
                <div className="flex gap-2 items-center text-[15px] font-bold">
                  <span>In Word</span>
                  <span className="underline ml-4">{amountInWords(sale.grandTotal || 0, "en")} {sale.grandTotal ? "Taka Only." : ""}</span>
                </div>

                <div className="mt-8 text-[15px]">
                  <p>Thanking You</p>
                  <p className="font-bold mt-1">For, {BRAND.company || "Royal Elevator & Engineers Co."}</p>
                  <div className="mt-16 text-sm">
                    <p className="font-bold text-[15px]">{signName !== "Authorized Signatory" ? signName : "Engr. Md. Idres Hossain"}</p>
                    <p>Call : 01711-151714</p>
                  </div>
                </div>

                {terms.length > 0 && (
                  <div className="mt-6 text-[13px] leading-snug">
                    <p><b>Terms &amp; Conditions</b></p>
                    {terms.map((line: string) => (
                      <p key={line}>
                        <span className="mr-1">◆</span> {line.replace(/^[-◆]\s*/, "")}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Page Bottom Footer - Always visible on Letterhead format */}
            <footer className="mt-auto pt-3 border-t-[1.5px] border-black grid grid-cols-4 gap-3 text-[10px] leading-[1.3] text-[#333]">
               <div>
                  <span className="font-bold text-[11px]">Head Office:</span> House # 08,<br/>Road # 06/A, Sector # 04, Uttara<br/>
                  <b>Web:</b>www.royalgroupofbangladesh.com<br/>
                  Dhaka. <b>Cell:</b> 01711-15 17 14
               </div>
               <div>
                  <span className="font-bold text-[11px]">Cox's Bazar Office:</span> Kobir Gest House<br/>
                  3 rd Floor, Kolatoli, Cox's Bazar<br/>
                  <b>E-mail:</b> royalgroupofbangladesh@gmail.com<br/>
                  <b className="text-[11px]">Cell:01869-70 80 71</b>
               </div>
               <div>
                  <span className="font-bold text-[11px]">Barishal Office:</span><br/>
                  Amena Monjil, 01 No, C&B Bridge<br/>
                  14 no. Word, BCC, Barishal.<br/>
                  <b>Cell:</b> 01712-20 19 08
               </div>
               <div>
                  <span className="font-bold text-[11px]">Chittagong Office:</span><br/>
                  Green Leaf Licha East Nasirabad<br/>
                  CDA Avenue Chittagong<br/>
                  <b>Cell:</b> 01712-78 26 30
               </div>
            </footer>
          </article>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------
// LAYOUT 4: Local Customer Billing Layout (Images 1 & 2)
// ------------------------------------------------------------------
function LocalBillingLayout({
  mode = "bill",
  sale,
  business,
  showChrome,
  docNo,
  docDate,
  bizName,
  bizAddress,
  items,
}: any) {
  const customerMobile = sale.customerMobile || "-";
  const customerName = sale.customerContactPerson || sale.customerName || "-";
  const companyName = sale.customerCompanyName || (sale.customerContactPerson ? sale.customerName : "") || "-";
  const customerAddress = sale.customerAddress || "Dhaka";

  const subtotal = Number(sale.subtotal || sale.grandTotal || 0);
  const otherCost = Number(sale.shipping || 0) + Number(sale.tax || 0);
  const discount = Number(sale.discount || 0);
  const grandTotal = Number(sale.grandTotal || (subtotal + otherCost - discount));
  const paidAmount = Number(sale.paidAmount || 0);

  const previousDue = Number(sale.previousDue || 0);
  const addDue = Number(sale.dueAmount != null ? sale.dueAmount : Math.max(0, grandTotal - paidAmount));
  const paidDue = 0;
  const totalDue = previousDue + addDue - paidDue;

  const paymentMethod = sale.payments?.[0]?.method
    ? sale.payments.map((p: any) => p.method).join(", ")
    : (sale.note || "bKash");

  const formattedDate = formatHyphenDate(docDate);
  const formattedTime = formatDhakaTime(docDate || sale.createdAt);

  return (
    <article
      className={`nes-sheet local-bill-sheet ${showChrome ? "" : " nes-no-chrome"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        color: "#111827",
        minHeight: "297mm",
        padding: "10mm 12mm",
        backgroundColor: "#ffffff",
        fontFamily: 'Arial, "Segoe UI", sans-serif',
      }}
    >
      {/* Top Header: Avatar & Company Name (Left), Full Address & Contacts (Right) */}
      <header className="flex justify-between items-start pb-2">
        {/* Left: Round Photo on Top + Red Brand Name Below (Exact Image 1/2) */}
        <div className="flex flex-col items-center">
          <div className="w-[68px] h-[68px] rounded-full border-2 border-red-500 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-sm">
            {business?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-red-600">
                {BRAND.logoMark}
              </span>
            )}
          </div>
          <h1 className="text-[24px] font-black tracking-tight text-[#dc2626] leading-tight mt-1 text-center font-sans">
            {bizName}
          </h1>
        </div>

        {/* Right: Address & Contact Details (Exact Image 1/2) */}
        <div className="text-right text-[11.5px] leading-[1.35] text-gray-800 font-medium max-w-sm pt-0.5">
          <div>{bizAddress || "73, Kawran Bazar(1st Floor),Tejgaon,Dhaka-1215."}</div>
          <div>Warehouse: 478, Borua Baganbari, Khilkhet, Dhaka-1229.</div>
          <div>Tel: {business?.phone || "+88 0255012015, Call: 01712903916, 01730474571."}</div>
          <div>Web: {business?.website || "www.capitalliftbd.com,  www.aclelevators.com"}</div>
          <div>Email: {business?.email || "capitalliftbd@gmail.com"}</div>
        </div>
      </header>

      {/* Center Badge: BILL or DUE PAID (Exact Charcoal Pill Badge) */}
      <div className="flex justify-center my-2">
        <span className="bg-[#616161] text-white font-black text-xl px-7 py-1 rounded-[4px] tracking-widest uppercase shadow-sm">
          {mode === "due_paid" ? "DUE PAID" : "BILL"}
        </span>
      </div>

      {/* Meta Information: Customer Info (Left) vs Bill Info (Right) */}
      <div className="grid grid-cols-2 gap-4 text-[13px] text-gray-900 pb-3 pt-1">
        {/* Left: Customer Details */}
        <div className="space-y-0.5 font-bold leading-normal">
          <div>Cell No. : {customerMobile}</div>
          <div>Customer Name : {customerName}</div>
          <div>Company Name : {companyName}</div>
          <div>Address : {customerAddress}</div>
        </div>

        {/* Right: Bill Details (Clean Aligned Column) */}
        <div className="space-y-0.5 font-bold leading-normal flex flex-col items-end">
          <div className="w-52 flex justify-between">
            <span>Bill No. :</span>
            <span className="w-28 text-left">{docNo || "—"}</span>
          </div>
          <div className="w-52 flex justify-between">
            <span>Date:</span>
            <span className="w-28 text-left">{formattedDate}</span>
          </div>
          <div className="w-52 flex justify-between">
            <span>Time:</span>
            <span className="w-28 text-left">{formattedTime || "10:00 AM"}</span>
          </div>
        </div>
      </div>

      {/* Content depending on mode */}
      {mode === "due_paid" ? (
        /* DUE PAID TABLE (IMAGE 2: 4-ROW CENTERED TABLE) */
        <div className="mt-1">
          <table className="w-full border-collapse border border-gray-400 text-[13px] font-bold">
            <tbody>
              <tr className="border-b border-gray-400">
                <td className="w-1/2 p-2 px-4 border-r border-gray-400 text-center bg-[#f2f2f2]">
                  Previous Due
                </td>
                <td className="w-1/2 p-2 px-4 text-center font-mono bg-white">
                  {taka(previousDue || grandTotal)}
                </td>
              </tr>
              <tr className="border-b border-gray-400">
                <td className="p-2 px-4 border-r border-gray-400 text-center bg-[#f2f2f2]">
                  Discount
                </td>
                <td className="p-2 px-4 text-center font-mono bg-white">
                  {taka(discount)}
                </td>
              </tr>
              <tr className="border-b border-gray-400">
                <td className="p-2 px-4 border-r border-gray-400 text-center bg-[#f2f2f2]">
                  paid Due Amount
                </td>
                <td className="p-2 px-4 text-center font-mono bg-white">
                  {taka(paidAmount || grandTotal)}
                </td>
              </tr>
              <tr>
                <td className="p-2 px-4 border-r border-gray-400 text-center bg-[#f2f2f2]">
                  Current Due
                </td>
                <td className="p-2 px-4 text-center font-mono bg-white">
                  {taka(Math.max(0, (previousDue || grandTotal) - (paidAmount || grandTotal) - discount))}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 text-[13px] font-bold text-gray-900">
            <span>Note:&nbsp;&nbsp;</span>
            <span>{sale.note || paymentMethod || "bKash."}</span>
          </div>
        </div>
      ) : (
        /* STANDARD LOCAL BILL TABLE (IMAGE 1: 8-COLUMN CONTINUOUS UNIFIED GRID) */
        <div className="mt-1">
          <table className="w-full border-collapse border border-gray-400 text-[12.5px]">
            <thead>
              <tr className="bg-[#f2f2f2] text-gray-900 font-bold border-b border-gray-400">
                <th className="p-1 px-2 border-r border-gray-400 text-center w-[5%]">#</th>
                <th className="p-1 px-2 border-r border-gray-400 text-center w-[8%]">Code</th>
                <th colSpan={3} className="p-1 px-3 border-r border-gray-400 text-center">Particulars</th>
                <th className="p-1 px-2 border-r border-gray-400 text-center w-[7%]">Unit</th>
                <th className="p-1 px-3 border-r border-gray-400 text-center w-[16%]">Unit Amount</th>
                <th className="p-1 px-3 border-gray-400 text-center w-[16%]">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const lineTot = lineAmount(item);
                return (
                  <tr key={idx} className="border-b border-gray-400 font-bold">
                    <td className="p-1.5 px-2 border-r border-gray-400 text-center">
                      {idx + 1}
                    </td>
                    <td className="p-1.5 px-2 border-r border-gray-400 text-center font-mono">
                      {item.sku || "—"}
                    </td>
                    <td colSpan={3} className="p-1.5 px-3 border-r border-gray-400 text-left font-semibold">
                      <div>{item.name}</div>
                      {item.description && item.description !== item.name ? (
                        <div className="text-xs text-gray-600 font-normal">{item.description}</div>
                      ) : null}
                    </td>
                    <td className="p-1.5 px-2 border-r border-gray-400 text-center font-mono">
                      {item.qty || 0}
                    </td>
                    <td className="p-1.5 px-3 border-r border-gray-400 text-right font-mono">
                      {taka(item.unitPrice)}
                    </td>
                    <td className="p-1.5 px-3 border-gray-400 text-right font-mono">
                      {taka(lineTot)}
                    </td>
                  </tr>
                );
              })}

              {/* DUAL-BOX SUMMARY ROWS: CONTINUOUS UNIFIED GRID MATCHING IMAGE 1 */}
              {/* Row 1: Previous Due & Sub Amount */}
              <tr className="border-b border-gray-400 font-bold">
                <td colSpan={3} rowSpan={5} className="border-r border-b border-gray-400 bg-white"></td>
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-left w-[14%] bg-white">Previous Due</td>
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-right font-mono w-[10%] bg-white">{taka(previousDue)}</td>
                <td colSpan={2} className="p-1.5 px-2.5 border-r border-gray-400 text-left w-[23%] bg-white">Sub Amount</td>
                <td className="p-1.5 px-2.5 text-right font-mono w-[16%] bg-white">{taka(subtotal)}</td>
              </tr>

              {/* Row 2: Add Due & Other Cost */}
              <tr className="border-b border-gray-400 font-bold">
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Add Due</td>
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-right font-mono bg-white">{taka(addDue)}</td>
                <td colSpan={2} className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Other Cost</td>
                <td className="p-1.5 px-2.5 text-right font-mono bg-white">{taka(otherCost)}</td>
              </tr>

              {/* Row 3: Paid Due & Discount */}
              <tr className="border-b border-gray-400 font-bold">
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Paid Due</td>
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-right font-mono bg-white">{taka(paidDue)}</td>
                <td colSpan={2} className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Discount</td>
                <td className="p-1.5 px-2.5 text-right font-mono bg-white">{taka(discount)}</td>
              </tr>

              {/* Row 4: Total Due & Total */}
              <tr className="border-b border-gray-400 font-bold">
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Total Due</td>
                <td className="p-1.5 px-2.5 border-r border-gray-400 text-right font-mono bg-white">{taka(totalDue)}</td>
                <td colSpan={2} className="p-1.5 px-2.5 border-r border-gray-400 text-left bg-white">Total</td>
                <td className="p-1.5 px-2.5 text-right font-mono bg-white">{taka(grandTotal)}</td>
              </tr>

              {/* Row 5: Paid Amount */}
              <tr className="border-b border-gray-400 font-bold">
                <td colSpan={2} className="border-0 bg-white"></td>
                <td colSpan={2} className="p-1.5 px-2.5 border-r border-l border-gray-400 text-left bg-white">Paid Amount</td>
                <td className="p-1.5 px-2.5 text-right font-mono bg-white">{taka(paidAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer Words and Note (Exact Image 1) */}
          <div className="mt-3 text-[13px] font-bold text-gray-900 space-y-2">
            <div>
              <span>In Word:&nbsp;&nbsp;</span>
              <span className="capitalize">{amountInWords(grandTotal, "en")} Taka only.</span>
            </div>
            {sale.note ? (
              <div>
                <span>Note:&nbsp;&nbsp;</span>
                <span>{sale.note}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------------
// MAIN WRAPPER
// ------------------------------------------------------------------
export function NesTradeDocument(props: {
  kind: TradeDocKind;
  sale: TradeSale;
  business?: TradeBusiness | null;
  challan?: TradeChallan | null;
  locationName?: string;
  showChrome?: boolean;
  layout?: "elevator" | "letterhead" | "local" | "company" | "due_paid";
}) {
  const { kind, sale, business, challan, showChrome = true, layout } = props;
  const bizName = companyLetterhead(business?.name);
  const bizAddress = business?.address || "";
  const items = (kind === "challan" && challan?.items?.length ? challan.items : sale.items) || [];
  const docDate = kind === "challan" ? challan?.shippedDate || sale.saleDate : sale.saleDate;
  const terms = (sale.terms || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  
  const signName = englishName(sale.soldByName);

  const docNo = dash(
    kind === "bill"
      ? sale.invoiceNo
      : kind === "challan"
        ? challan?.shipmentNo
        : kind === "proposal"
          ? sale.proposalNo
          : sale.quotationNo
  );

  const docTitle = kind === "bill" ? "BILL" : kind === "challan" ? "CHALLAN" : kind === "proposal" ? "PROPOSAL" : "QUOTATION";

  const subject = resolveDocumentSubject({
    stored: sale.subject,
    terms: sale.terms,
    note: sale.note,
    items,
  });
  
  const documentBody =
    sale.documentBody === undefined || sale.documentBody === null
      ? DEFAULT_DOCUMENT_BODY
      : String(sale.documentBody);

  const layoutProps = {
    ...props,
    showChrome,
    docNo,
    docDate,
    docTitle,
    subject,
    documentBody,
    terms,
    items,
    bizName,
    bizAddress,
    signName
  };

  if (kind === "challan") {
    return <PadLayout {...layoutProps} />;
  }

  if (kind === "quotation" && layout !== "letterhead" && layout !== "company") {
    return <ElevatorQuotationLayout {...layoutProps} />;
  }

  if (kind === "bill") {
    if (layout === "company" || layout === "letterhead") {
      return <LetterheadLayout {...layoutProps} />;
    }
    return <LocalBillingLayout {...layoutProps} mode={layout === "due_paid" ? "due_paid" : "bill"} />;
  }

  return <LetterheadLayout {...layoutProps} />;
}
