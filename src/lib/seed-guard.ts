export function seedBootstrapHeaderOk(headerValue: string | null | undefined) {
  const secret = process.env.SEED_BOOTSTRAP_SECRET?.trim();
  if (!secret) return false;
  return String(headerValue || "") === secret;
}
