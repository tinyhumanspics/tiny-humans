import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import type en from "@/messages/en.json";
import Portfolio from "./Portfolio";
import styles from "./Portfolio.module.css";

/** /portfolio: the photos, then one "Check dates" (to /book, where the bundles sit side by side). */
export default function PortfolioPage({ messages, cta, locale }: { messages: typeof en.home.portfolio; cta: string; locale: AppLocale }) {
  return (
    <main id="top">
      <Portfolio messages={messages} locale={locale} />
      <div className={styles.cta}>
        <ChalkButton href={localePath("/book", locale)} variant="solid" seed={31}>
          {cta}
        </ChalkButton>
      </div>
    </main>
  );
}
