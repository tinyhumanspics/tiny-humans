import type { Bundle } from "./types";

/**
 * LOCAL DEVELOPMENT / TESTS ONLY. The live bundles are managed in /admin/pricing and stored in Neon (tables `bundles`,
 * `bundle_inclusions`, `bundle_addons`). This copy mirrors them (as of 2026-10-06) so local previews and the CI tests
 * (no database) look like production; it is never used when a database is configured (`getCatalog()`).
 */
export const devBundles: Bundle[] = [
  {
    id: "little-moments",
    name: "Little Moments",
    price: 149,
    duration: "Up to 1 hour",
    durationMinutes: 60,
    people: "Baby only",
    setups: "1 setup",
    photos: "8",
    features: ["Up to 1 hour", "Baby only", "1 setup", "8 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Little Moments",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
  {
    id: "our-little-story",
    name: "Our Little Story",
    price: 249,
    duration: "Up to 2 hours",
    durationMinutes: 120,
    people: "Baby only",
    setups: "2 setups",
    photos: "20",
    features: ["Up to 2 hours", "Baby only", "2 setups", "20 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Our Little Story",
    badge: "Most loved",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
  {
    id: "forever-little",
    name: "Our Family Story",
    price: 399,
    duration: "Up to 3 hours",
    durationMinutes: 180,
    people: "Baby + parents + siblings",
    setups: "3 setups",
    photos: "35",
    features: ["Up to 3 hours", "Baby + parents + siblings", "3 setups", "35 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Our Family Story",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
];
