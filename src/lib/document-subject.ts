export type SubjectItem = {
  name?: string;
  description?: string;
};

const TERMS_MARKERS =
  /term of validity|terms?\s*(&|and)?\s*conditions|payment\s*:|delivery\s*(time|area|working)|vat\s*,?\s*tax|100%\s*advance|50%\s*advance|as per company policy|ready stock item|please sign back/i;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanPhrase(value?: string) {
  return String(value || "")
    .replace(/^[-•◆●○▪]+\s*/, "")
    .replace(/\b\d+\s*[-]?\s*month(?:s)?\s*warranty\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeTermsOrNotes(text: string, terms?: string, note?: string) {
  const value = String(text || "").trim();
  if (!value) return true;
  const compact = normalize(value);
  const termsText = normalize(String(terms || ""));
  const noteText = normalize(String(note || ""));
  if (termsText && (compact === termsText || (termsText.length > 24 && compact.includes(termsText.slice(0, 40))))) {
    return true;
  }
  if (noteText && compact === noteText) return true;
  const termLines = String(terms || "")
    .split(/\r?\n/)
    .map((line) => cleanPhrase(line.replace(/^(\d+[.)]\s*|[-•◆●○▪]\s*)/, "")))
    .filter((line) => line.length > 8);
  if (termLines.filter((line) => compact.includes(normalize(line).slice(0, 24))).length >= 2) {
    return true;
  }
  return TERMS_MARKERS.test(value);
}

function phraseFromItem(item: SubjectItem) {
  const name = cleanPhrase(item.name);
  const description = cleanPhrase(item.description);
  if (!name) return description;
  if (!description) return name;
  if (normalize(description) === normalize(name)) return name;
  if (normalize(description).includes(normalize(name))) return name;
  if (normalize(name).includes(normalize(description))) return name;
  return name;
}

function uniquePhrases(items: SubjectItem[]) {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const item of items) {
    const phrase = phraseFromItem(item);
    const key = normalize(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
}

function joinPhrases(phrases: string[]) {
  if (!phrases.length) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

export function generateSubjectFromItems(items: SubjectItem[] = []) {
  const phrases = uniquePhrases(items);
  if (!phrases.length) return "";
  let subject = joinPhrases(phrases);
  const blob = items.map((item) => `${item.name || ""} ${item.description || ""}`).join(" ").toLowerCase();
  if (/injection mold/.test(blob) && !/injection mold/.test(subject.toLowerCase())) {
    subject += " of Injection molding machine";
  }
  if (!/[.!?]$/.test(subject)) subject += ".";
  return subject;
}

export function resolveDocumentSubject(opts: {
  stored?: string | null;
  terms?: string | null;
  note?: string | null;
  items?: SubjectItem[];
}) {
  const stored = String(opts.stored || "").trim();
  const generated = generateSubjectFromItems(opts.items || []);
  if (stored && !looksLikeTermsOrNotes(stored, opts.terms || "", opts.note || "")) {
    return stored;
  }
  return generated;
}
