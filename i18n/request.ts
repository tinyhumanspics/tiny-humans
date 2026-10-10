import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { appLocale, PUBLIC_LOCALE_HEADER } from "./config";

/**
 * Request-level next-intl configuration. The proxy derives locale from our explicit public route prefix.
 */
export default getRequestConfig(async () => {
  const locale = appLocale((await headers()).get(PUBLIC_LOCALE_HEADER));
  const messages = locale === "es" ? es : en;
  return { locale, messages };
});
