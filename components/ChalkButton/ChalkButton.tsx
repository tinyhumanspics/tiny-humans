"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import styles from "./ChalkButton.module.css";

interface ChalkButtonProps {
  children: ReactNode;
  variant?: "solid" | "outline";
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  seed?: number;
  "aria-describedby"?: string;
}

/** Chalk-drawn button. Renders a Next.js <Link> for internal pages, <a> for in-page anchors, otherwise a <button>. */
export default function ChalkButton({ children, variant = "outline", href, onClick, type = "button", disabled, className, seed = 3, ...rest }: ChalkButtonProps) {
  const classes = `${styles.button} ${styles[variant]} ${className ?? ""}`;
  const inner = (
    <ChalkBox
      className={styles.inner}
      seed={seed}
      wobble={1.8}
      strokeWidth={variant === "solid" ? 3 : 2.4}
      color={variant === "solid" ? "var(--sun-yellow)" : "var(--chalk-white)"}
    >
      {variant === "solid" && <span className={styles.fill} aria-hidden="true" />}
      <span className={`${styles.label} chalk-soft`}>{children}</span>
    </ChalkBox>
  );
  if (href && href.startsWith("/")) {
    // internal page: client-side navigation (no intro replay)
    return (
      <Link href={href} className={classes} onClick={onClick} {...rest}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {inner}
    </button>
  );
}
