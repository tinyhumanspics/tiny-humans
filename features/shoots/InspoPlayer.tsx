"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { shootsApi } from "@/lib/shoots/client";
import { isShortVideoLink, playerOf, type Player } from "@/lib/shoots/players";
import css from "./InspoLightbox.module.css";

/**
 * A pasted video playing inside the viewer (owner, Nov 11: stay in the shoot day sheet): the app's own embed
 * player (Instagram, TikTok, YouTube, Vimeo). Short share links are opened on the server first. A private or
 * removed video says so; the viewer's "Open in …" link is always there.
 */
export default function InspoPlayer({ link, platform, title }: { link: string; platform: string; title: string }) {
  const direct = useMemo(() => playerOf(link), [link]);
  const [expanded, setExpanded] = useState<{ link: string; player: Player | null } | null>(null);

  useEffect(() => {
    if (direct || !isShortVideoLink(link)) return;
    let live = true;
    shootsApi
      .player(link)
      .then((player) => live && setExpanded({ link, player }))
      .catch(() => live && setExpanded({ link, player: null }));
    return () => {
      live = false;
    };
  }, [direct, link]);

  const player = direct ?? (expanded?.link === link ? expanded.player : isShortVideoLink(link) ? undefined : null);
  if (player === undefined) {
    return <p className={css.playerNote} role="status">Opening the video…</p>;
  }
  if (!player) {
    return (
      <div className={css.playerNote}>
        <p>This video can&apos;t play here. It may be private or removed.</p>
        <a className={css.open} href={link} target="_blank" rel="noopener noreferrer">
          Open in {platform} ↗<span className={styles.visuallyHidden}> (opens a new tab)</span>
        </a>
      </div>
    );
  }
  return (
    <iframe
      key={player.src}
      className={cn(css.player, css[player.shape])}
      src={player.src}
      title={`${platform} video${title ? `: ${title}` : ""}`}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
