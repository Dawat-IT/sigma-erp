import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["bn", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bn";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get("NEXT_LOCALE")?.value;
  const locale: Locale = raw === "en" ? "en" : "bn";

  return {
    locale,
    timeZone: "Asia/Dhaka",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
