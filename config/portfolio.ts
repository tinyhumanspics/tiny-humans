/**
 * Portfolio photos + the home page feed.
 * Replace the placeholder files in /public/portfolio with real images
 * (keep width/height accurate for best layout).
 */
export interface PortfolioPhoto {
  /** Stable id, used in booking links (/bundles?inspiration=<id>). */
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Short name shown in the booking when this photo inspired it. */
  title: string;
  caption?: string;
}

export const portfolio: PortfolioPhoto[] = [
  { id: "first-week", src: "/portfolio/sleeping-swaddle.jpg", width: 900, height: 1125, alt: "Newborn asleep in a soft swaddle (placeholder)", title: "Swaddled & sleepy", caption: "First week" },
  { id: "tiny-toes", src: "/portfolio/tiny-toes.jpg", width: 1200, height: 800, alt: "Close-up of tiny newborn feet (placeholder)", title: "Ten tiny toes", caption: "Ten tiny toes" },
  { id: "basket-nap", src: "/portfolio/basket-nap.jpg", width: 900, height: 1200, alt: "Baby napping in a woven basket (placeholder)", title: "Basket nap" },
  { id: "mom-and-dad", src: "/portfolio/family-hands.jpg", width: 900, height: 900, alt: "Parents' hands cradling their baby (placeholder)", title: "In mom & dad's hands", caption: "Mom & dad" },
  { id: "first-smile", src: "/portfolio/first-smile.jpg", width: 1200, height: 800, alt: "Baby giving a first little smile (placeholder)", title: "First smile" },
  { id: "sleepy-sunday", src: "/portfolio/bunny-blanket.jpg", width: 900, height: 1125, alt: "Baby wrapped in a pale blue blanket (placeholder)", title: "Sleepy Sunday", caption: "Sleepy Sunday" },
  { id: "tummy-time", src: "/portfolio/tummy-time.jpg", width: 1200, height: 900, alt: "Baby during tummy time on a cream blanket (placeholder)", title: "Tummy time" },
  { id: "cloud-wrap", src: "/portfolio/cloud-wrap.jpg", width: 900, height: 900, alt: "Newborn in a sky blue wrap (placeholder)", title: "Sky blue wrap" },
  { id: "six-months", src: "/portfolio/milestone.jpg", width: 900, height: 1200, alt: "Baby sitting up for a milestone photo (placeholder)", title: "Six month milestone", caption: "Six months!" },
];

/** Prompts placed between photo groups on the home page (used in order). */
export const portfolioCtas = [
  { title: "Love this one?", text: "We'll plan your session around it." },
  { title: "Picture your family here", text: "Baby, parents and all the little details." },
  { title: "Want a moment like this?", text: "Milestones grow fast. Let's catch this one." },
];

export const portfolioCtaLabel = "Book a memory like this one";

export type FeedBlock =
  | { type: "photos"; photos: PortfolioPhoto[] }
  | { type: "cta"; photo: PortfolioPhoto; title: string; text: string };

/**
 * Builds the home feed from whatever photos are live: groups of three,
 * with up to three "Book a memory like this one" prompts spread evenly
 * through it (always one after the last group).
 */
export function buildPortfolioFeed(photos: PortfolioPhoto[], groupSize = 3): FeedBlock[] {
  const groups: PortfolioPhoto[][] = [];
  for (let i = 0; i < photos.length; i += groupSize) groups.push(photos.slice(i, i + groupSize));
  const ctaCount = Math.min(portfolioCtas.length, groups.length);
  const ctaAfter = new Set(Array.from({ length: ctaCount }, (_, k) => Math.round(((k + 1) * groups.length) / ctaCount) - 1));
  const feed: FeedBlock[] = [];
  let cta = 0;
  groups.forEach((group, g) => {
    feed.push({ type: "photos", photos: group });
    if (ctaAfter.has(g)) {
      feed.push({ type: "cta", photo: group[Math.min(1, group.length - 1)], ...portfolioCtas[cta % portfolioCtas.length] });
      cta += 1;
    }
  });
  return feed;
}
