"use client";

/** "Print or save as PDF": the browser's print dialog (Save as PDF on phones and computers). */
export default function PrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
