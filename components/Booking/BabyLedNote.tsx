import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/Reveal/Reveal";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";
import type en from "@/messages/en.json";

/** "Our sessions are baby-led…" Shown above the booking form and on the review step. */
export default function BabyLedNote({ messages, compact = false, multiple = false }: { messages: typeof en.bookingFlow.babyLed; compact?: boolean; multiple?: boolean }) {
  const text = multiple ? messages.many : messages.one;
  if (compact) {
    return (
      <p className={cn(styles.babyLedCompact, "chalk-soft")}>
        <ChalkDoodle name="heart" size={22} color="var(--accent-2)" strokeWidth={3} />
        <span>{text}</span>
      </p>
    );
  }
  return (
    <Reveal className={styles.babyLedWrap}>
      <BoardDoodles area="note" />
      <ChalkBox className={styles.babyLed} seed={611} wobble={2.4} strokeWidth={2.4} color="var(--cloud-blue)" double={false}>
        <ChalkDoodle name="heart" size={34} color="var(--accent-2)" strokeWidth={3} className={styles.babyLedIcon} />
        <p className="chalk-soft">{text}</p>
      </ChalkBox>
    </Reveal>
  );
}
