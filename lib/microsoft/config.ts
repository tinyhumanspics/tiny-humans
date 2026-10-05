import "server-only";

/** Microsoft settings from environment variables (server only, never NEXT_PUBLIC). */
export function microsoftConfig() {
  return {
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    mailbox: process.env.OUTLOOK_MAILBOX || "hello@tinyhumans.photography",
    calendarUser: process.env.OUTLOOK_CALENDAR_USER || process.env.OUTLOOK_MAILBOX || "hello@tinyhumans.photography",
  };
}

export function isMicrosoftConfigured(): boolean {
  const c = microsoftConfig();
  return Boolean(c.tenantId && c.clientId && c.clientSecret);
}
