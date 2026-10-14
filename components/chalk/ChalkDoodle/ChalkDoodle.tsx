import type { CSSProperties } from "react";

import { doodleShapes, type DoodleShape } from "./shapes";
import { cn } from "@/lib/cn";

export type { DoodleShape };

interface ChalkDoodleProps {
  name: DoodleShape;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  fill?: string;
  /** Stretch to fill its box instead of keeping proportions. */
  stretch?: boolean;
  /** Normalize path lengths so the doodle can be chalk-drawn with CSS. */
  drawable?: boolean;
  /**
   * Chalk grain mask on this doodle. Turn off when a parent already applies
   * one (fewer masks = smoother scrolling).
   */
  grain?: boolean;
}

/** Small hand-drawn chalk illustration. Decorative by default. */
export default function ChalkDoodle({ name, size = 28, color = "currentColor", strokeWidth = 3, className, style, fill = "none", stretch = false, drawable = false, grain = true }: ChalkDoodleProps) {
  const shape = doodleShapes[name];
  const [, , vw, vh] = shape.viewBox.split(" ").map(Number);
  const width = typeof size === "number" ? size : size;
  const height = typeof size === "number" ? (size * vh) / vw : undefined;
  return (
    <svg
      className={cn(grain ? "chalk-grain " : "", className)}
      style={style}
      viewBox={shape.viewBox}
      width={width}
      height={height}
      preserveAspectRatio={stretch ? "none" : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <g fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {shape.paths.map((d, i) => (
          <path key={i} d={d} pathLength={drawable ? 1 : undefined} />
        ))}
      </g>
    </svg>
  );
}
