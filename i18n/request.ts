import { getRequestConfig } from "next-intl/server";
import en from "@/messages/en.json";
import { defaultLocale } from "./config";

/**
 * Request-level next-intl configuration. English remains the only published language until the Spanish catalog,
 * routes and email journey pass native-speaker review; locale routing will then supply `es` here.
 */
export default getRequestConfig(async () => ({ locale: defaultLocale, messages: en }));
