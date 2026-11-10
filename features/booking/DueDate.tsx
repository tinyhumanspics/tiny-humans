"use client";

import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import DueDateForm from "./due/DueDateForm";

/** The "Not born yet?" booking page (/due-date): see due/DueDateForm.tsx. */
export default function DueDate(props: { locale: AppLocale; messages: typeof en.dueDate; bookingMessages: typeof en.bookingFlow; pausedMessages: typeof en.bundlesPage.paused }) {
  return <DueDateForm {...props} />;
}
