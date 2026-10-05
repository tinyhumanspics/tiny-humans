import Hero from "@/components/Hero/Hero";
import Portfolio from "@/components/Portfolio/Portfolio";

/** Home: hero + portfolio feed. Booking lives on /book. */
export default function HomePage() {
  return (
    <main id="top">
      <Hero />
      <Portfolio />
    </main>
  );
}
