"use client";

import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import PinnedPhoto from "@/components/PinnedPhoto/PinnedPhoto";
import PhotoPlaceholder from "@/components/PhotoPlaceholder/PhotoPlaceholder";

interface Props {
  group: "about" | "landing";
  index: number;
  placeholderLabel: string;
  ratio: number;
  seed: number;
  sizes: string;
  priority?: boolean;
  tape?: "yellow" | "blue" | "white";
}

/** An owner-managed photo that keeps its chalk placeholder until a replacement is uploaded. */
export default function SitePhotoSlot({ group, index, placeholderLabel, ratio, seed, sizes, priority, tape }: Props) {
  const { media } = useSiteSettings();
  const photo = media[group][index];

  return photo ? (
    <PinnedPhoto photo={photo} seed={seed} sizes={sizes} priority={priority} showCaption={false} tape={tape} />
  ) : (
    <PhotoPlaceholder label={placeholderLabel} ratio={ratio} seed={seed} tape={tape} />
  );
}
