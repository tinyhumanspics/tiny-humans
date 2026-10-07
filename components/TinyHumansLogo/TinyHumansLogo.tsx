"use client";

import { useId, type CSSProperties } from "react";
import { LOGO_LAYER_ORDER, type LogoAsset } from "@/config/logo/types";
import styles from "./TinyHumansLogo.module.css";
import { cn } from "@/lib/cn";

export type LogoDrawState = "hidden" | "drawing" | "drawn";

interface Props {
  logo: LogoAsset;
  state: LogoDrawState;
  className?: string;
}

/**
 * A Tiny Humans logo (any theme), revealed through animated chalk-stroke masks.
 * Order: sun, rays, cloud, seasonal decorations, lettering.
 * In the "drawn" state it is simply the finished logo.
 */
export default function TinyHumansLogo({ logo, state, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const { width: w, height: h, dust } = logo.drawing;
  const layers = LOGO_LAYER_ORDER.filter((l) => logo.layers[l] && logo.drawing.layers[l]?.length);
  const dustDots = Array.from({ length: 9 }, (_, i) => [dust.x0 + ((dust.x1 - dust.x0) * i) / 8, dust.y + (i % 3) * 5]);
  return (
    <svg className={cn(styles.logo, className)} viewBox={`0 0 ${w} ${h}`} data-state={state} role="img" aria-label={logo.alt}>
      <defs>
        {layers.map((layer) => (
          <mask key={layer} id={`${uid}-${layer}`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
            <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
              {logo.drawing.layers[layer]!.map((s) => (
                <path
                  key={s.id}
                  className={styles.stroke}
                  d={s.d}
                  strokeWidth={s.width}
                  style={
                    {
                      "--from": `${s.length + s.width * 2}px`,
                      strokeDasharray: `${s.length}px ${s.length + s.width * 4}px`,
                      animationDelay: `${s.start}s`,
                      animationDuration: `${s.duration}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </g>
          </mask>
        ))}
      </defs>
      {layers.map((layer) => (
        <image key={layer} href={logo.layers[layer]} x="0" y="0" width={w} height={h} mask={`url(#${uid}-${layer})`} />
      ))}
      <g className={styles.dust} aria-hidden="true">
        {dustDots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2 + (i % 3)} style={{ animationDelay: `${2.0 + (i % 5) * 0.08}s` }} />
        ))}
      </g>
    </svg>
  );
}
