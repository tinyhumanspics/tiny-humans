/**
 * Portfolio photos + the home page feed.
 * Replace the placeholder files in /public/portfolio with real images
 * (keep width/height accurate for best layout).
 */
import en from "@/messages/en.json";

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
  /** Optional matched copy for Spanish pages; absent copy must never fall back to English there. */
  spanish?: { title: string; alt: string; caption?: string } | null;
}

export const portfolio: PortfolioPhoto[] = [
  { id: "first-week", src: "/portfolio/sleeping-swaddle.jpg", width: 900, height: 1125, alt: "Newborn asleep in a soft swaddle (placeholder)", title: "Swaddled & sleepy", caption: "First week", spanish: { alt: "Recién nacido dormido y envuelto suavemente (foto provisional)", title: "Envuelto y dormidito", caption: "Primera semana" } },
  { id: "tiny-toes", src: "/portfolio/tiny-toes.jpg", width: 1200, height: 800, alt: "Close-up of tiny newborn feet (placeholder)", title: "Ten tiny toes", caption: "Ten tiny toes", spanish: { alt: "Primer plano de los pequeños pies de un recién nacido (foto provisional)", title: "Diez deditos", caption: "Diez deditos" } },
  { id: "basket-nap", src: "/portfolio/basket-nap.jpg", width: 900, height: 1200, alt: "Baby napping in a woven basket (placeholder)", title: "Basket nap", spanish: { alt: "Bebé dormido en una canasta tejida (foto provisional)", title: "Siesta en la canasta" } },
  { id: "mom-and-dad", src: "/portfolio/family-hands.jpg", width: 900, height: 900, alt: "Parents' hands cradling their baby (placeholder)", title: "In mom & dad's hands", caption: "Mom & dad", spanish: { alt: "Las manos de sus padres sostienen al bebé (foto provisional)", title: "En las manos de mamá y papá", caption: "Mamá y papá" } },
  { id: "first-smile", src: "/portfolio/first-smile.jpg", width: 1200, height: 800, alt: "Baby giving a first little smile (placeholder)", title: "First smile", spanish: { alt: "Bebé mostrando una de sus primeras sonrisas (foto provisional)", title: "Primera sonrisa" } },
  { id: "sleepy-sunday", src: "/portfolio/bunny-blanket.jpg", width: 900, height: 1125, alt: "Baby wrapped in a pale blue blanket (placeholder)", title: "Sleepy Sunday", caption: "Sleepy Sunday", spanish: { alt: "Bebé envuelto en una manta azul claro (foto provisional)", title: "Domingo de sueño", caption: "Domingo de sueño" } },
  { id: "tummy-time", src: "/portfolio/tummy-time.jpg", width: 1200, height: 900, alt: "Baby during tummy time on a cream blanket (placeholder)", title: "Tummy time", spanish: { alt: "Bebé boca abajo sobre una manta color crema (foto provisional)", title: "Tiempo boca abajo" } },
  { id: "cloud-wrap", src: "/portfolio/cloud-wrap.jpg", width: 900, height: 900, alt: "Newborn in a sky blue wrap (placeholder)", title: "Sky blue wrap", spanish: { alt: "Recién nacido envuelto en tela azul cielo (foto provisional)", title: "Envuelto en azul cielo" } },
  { id: "six-months", src: "/portfolio/milestone.jpg", width: 900, height: 1200, alt: "Baby sitting up for a milestone photo (placeholder)", title: "Six month milestone", caption: "Six months!", spanish: { alt: "Bebé sentado para una foto de una nueva etapa (foto provisional)", title: "Recuerdo de los seis meses", caption: "¡Seis meses!" } },
];

/** Prompts placed between photo groups on the home page (used in order). */
export const portfolioCtas = en.home.portfolio.prompts;

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
