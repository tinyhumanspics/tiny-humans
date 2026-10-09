"use client";

import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import PinnedPhoto from "@/components/PinnedPhoto/PinnedPhoto";
import PhotoPlaceholder from "@/components/PhotoPlaceholder/PhotoPlaceholder";
import en from "@/messages/en.json";

interface Props {
  group: "about" | "landing";
  index: number;
  placeholderLabel: string;
  ratio: number;
  seed: number;
  sizes: string;
  priority?: boolean;
  tape?: "yellow" | "blue" | "white";
  placeholderMessages?: typeof en.photoPlaceholder;
}

/** An owner-managed photo that keeps its chalk placeholder until a replacement is uploaded. */
export default function SitePhotoSlot({ group, index, placeholderLabel, ratio, seed, sizes, priority, tape, placeholderMessages = en.photoPlaceholder }: Props) {
  const { media } = useSiteSettings();
  const photo = media[group][index];

  return photo ? (
    <PinnedPhoto photo={photo} seed={seed} sizes={sizes} priority={priority} showCaption={false} tape={tape} />
  ) : (
    <PhotoPlaceholder label={placeholderLabel} ratio={ratio} seed={seed} tape={tape} messages={placeholderMessages} />
  );
}
