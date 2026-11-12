"use client";

import { useEffect, useState } from "react";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { forgetDueReturn } from "@/lib/due-date/return-path";
import { cn } from "@/lib/cn";
import styles from "./due/DueDate.module.css";

/**
 * "Pay the deposit" for a saved reservation whose payment page closed (owner, Nov 11): asks the server for a fresh
 * Stripe page and goes there. Their details stay as they are; nothing to fill in again.
 */
export function DuePayButton({ r, k, locale, label, paying, failed }: { r: string; k: string; locale: "en" | "es"; label: string; paying: string; failed: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/due-date/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ r, k, locale }) });
      const body = (await res.json().catch(() => null)) as { depositUrl?: string; error?: string } | null;
      if (!res.ok || !body?.depositUrl) throw new Error(body?.error || failed);
      window.location.assign(body.depositUrl);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : failed);
      setBusy(false);
    }
  };
  return (
    <>
      <ChalkButton variant="solid" onClick={pay} disabled={busy} seed={84}>
        {busy ? paying : label}
      </ChalkButton>
      {error && <p className={cn(styles.doneText, "chalk-soft")} role="alert">{error}</p>}
    </>
  );
}

/** A finished (or invalid) reservation page: Back from it shouldn't come here again. */
export function ForgetDueReturn() {
  useEffect(() => forgetDueReturn(), []);
  return null;
}
