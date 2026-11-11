import type { ReactNode } from "react";
import type { WaiverSnapshot } from "@/lib/waiver/text";
import css from "./Waiver.module.css";

/**
 * The cream "paper" of the photo and video release, drawn from a text snapshot: the signing screen builds the
 * snapshot from the current wording, the signed copy shows the one stored with the signature. `choices` and
 * `you` are the parts that differ (tick boxes vs ✓/✗).
 */
export default function WaiverPaper({ snapshot, choices, firstName, you }: { snapshot: WaiverSnapshot; choices: ReactNode; firstName: ReactNode; you: ReactNode }) {
  return (
    <article className={css.paper} lang={snapshot.language}>
      <p className={css.paperBrand}>Tiny Humans</p>
      <h1 className={css.paperTitle}>{snapshot.title}</h1>
      <p>{snapshot.intro}</p>
      <p className={css.paperFacts}>{snapshot.facts}</p>

      <h2 className={css.paperH}>{snapshot.whereHeading}</h2>
      {choices}

      {snapshot.firstName && (
        <>
          <h2 className={css.paperH}>{snapshot.firstName.heading}</h2>
          {firstName}
        </>
      )}

      <h2 className={css.paperH}>{snapshot.promisesHeading}</h2>
      <ul className={css.paperList}>
        {snapshot.promises.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <h2 className={css.paperH}>{snapshot.fineHeading}</h2>
      <p className={css.paperFine}>{snapshot.fine}</p>

      <h2 className={css.paperH}>{snapshot.youHeading}</h2>
      {you}
    </article>
  );
}

/** A choice on the signed copy: ✓ for yes, ✗ for no (with the words, so it reads without the marks). */
export function Mark({ on, children, lang = "en" }: { on: boolean; children: ReactNode; lang?: "en" | "es" }) {
  const [yes, no] = lang === "es" ? ["Sí: ", "No: "] : ["Yes: ", "No: "];
  return (
    <li className={on ? css.choiceOn : css.choiceOff}>
      <span className={css.mark} aria-hidden="true">{on ? "✓" : "✗"}</span>
      <span>
        <span className={css.srOnly}>{on ? yes : no}</span>
        {children}
      </span>
    </li>
  );
}
