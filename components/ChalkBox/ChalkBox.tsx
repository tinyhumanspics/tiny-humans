"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { roughRectPath } from "@/lib/chalk/rough";
import styles from "./ChalkBox.module.css";

interface ChalkBoxProps {
  children?: ReactNode;
  className?: string;
  seed?: number;
  wobble?: number;
  strokeWidth?: number;
  /** Any CSS color, ideally a theme variable. */
  color?: string;
  /** Draw a second, fainter pass like real chalk. */
  double?: boolean;
  style?: CSSProperties;
}

/** A container with a hand-drawn chalk border sized to its content. */
export default function ChalkBox({
  children,
  className,
  seed = 1,
  wobble = 3,
  strokeWidth = 2.6,
  color = "var(--chalk-white)",
  double = true,
  style,
}: ChalkBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure stroke lengths so the frame can be redrawn when revealed.
  useEffect(() => {
    svgRef.current?.querySelectorAll("path").forEach((path) => {
      const len = Math.ceil(path.getTotalLength());
      path.style.setProperty("--len", `${len}px`);
      path.style.strokeDasharray = `${len}px ${len}px`;
    });
  }, [size, seed, wobble]);

  return (
    <div ref={ref} className={`${styles.box} ${className ?? ""}`} style={style}>
      {size && size.w > 0 && (
        <svg ref={svgRef} className={`${styles.frame} chalk-grain`} viewBox={`0 0 ${size.w} ${size.h}`} width={size.w} height={size.h} aria-hidden="true" focusable="false">
          <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
            <path className={styles.main} d={roughRectPath(size.w, size.h, seed, wobble)} strokeWidth={strokeWidth} />
            {double && (
              <path className={styles.ghost} d={roughRectPath(size.w, size.h, seed * 31 + 7, wobble * 1.2, 5)} strokeWidth={strokeWidth * 0.6} />
            )}
          </g>
        </svg>
      )}
      {children}
    </div>
  );
}
