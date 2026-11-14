"use client";

import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import QuickForm from "./quick/QuickForm";

/** The quick form page (/quick): see quick/QuickForm.tsx. */
export default function Quick(props: { locale: AppLocale; messages: typeof en.quick; bookingMessages: typeof en.bookingFlow }) {
  return <QuickForm {...props} />;
}
