/** Shared supplier label helpers (safe for client + server). */

export function isGenericSupplierLabel(value?: string | null) {
  const v = String(value || "").trim();
  if (!v) return true;
  return /^Supplier\s*[1-3]$/i.test(v) || /^সরবরাহকারী\s*[১২৩123]$/.test(v);
}

/** Prefer live Contact name; skip stale generic Bangla placeholders like সরবরাহকারী ১ */
export function displaySupplierLabel(
  offer: { name?: string; nameBn?: string },
  locale: string,
) {
  const name = String(offer.name || "").trim();
  const nameBn = String(offer.nameBn || "").trim();
  if (locale === "bn") {
    if (nameBn && !isGenericSupplierLabel(nameBn)) return nameBn;
    if (name) return name;
    return nameBn || "—";
  }
  if (name && !isGenericSupplierLabel(name)) return name;
  if (nameBn && !isGenericSupplierLabel(nameBn)) return nameBn;
  return name || nameBn || "—";
}
