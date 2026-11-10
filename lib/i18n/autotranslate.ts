import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { log } from "@/lib/log";
import { looksLikeCode } from "./spanish-autofill";

/**
 * English → Spanish for the owner's own website words (photo titles and descriptions, bundle copy, prompt boxes,
 * seasonal offers) when a Spanish field was left empty (owner, Nov 9: "just translate it automatically… if I need
 * to change something specific, I will do it myself").
 *
 * With ANTHROPIC_API_KEY set, one batched request to Claude per save. Without it, or if the request fails or is
 * declined, the English is copied as it is, so the Spanish site never gets stuck on an empty field. Codes and file
 * names ("C225", "IMG_7378") are always copied. Never baby data: only owner-written marketing words are sent.
 */

export const TRANSLATE_MODEL = "claude-opus-5-5";

const SYSTEM = [
  "You translate short texts from the website of Tiny Humans, a newborn and baby photography studio in Miami, from English to Spanish.",
  "Write natural Latin American Spanish as spoken in Miami, warm and simple, addressing parents as tú.",
  "Keep the meaning, tone and roughly the same length. Keep names, the brand name Tiny Humans, prices, numbers, dates, emojis and line breaks exactly as they are.",
  "Return one translation per input, in the same order.",
].join(" ");

const SCHEMA = {
  type: "object",
  properties: { translations: { type: "array", items: { type: "string" } } },
  required: ["translations"],
  additionalProperties: false,
} as const;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 }));

/** Is real translation on (an API key in the environment)? Otherwise empty Spanish fields get the English copied. */
export const translationEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Spanish for each text (same order). Falls back to the English text for anything it can't translate. */
export async function toSpanish(texts: string[]): Promise<string[]> {
  const out = [...texts];
  const todo = [...new Set(texts.filter((t) => t.trim() && !looksLikeCode(t)))];
  if (!todo.length || !translationEnabled()) return out;
  try {
    const response = await getClient().beta.messages.create({
      model: TRANSLATE_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: JSON.stringify(todo) }],
    });
    if (response.stop_reason !== "end_turn") {
      log.warn("autotranslate", "Translation not finished; English copied", { stopReason: response.stop_reason });
      return out;
    }
    const text = response.content.find((b) => b.type === "text");
    const parsed = text?.type === "text" ? (JSON.parse(text.text) as { translations?: unknown }) : null;
    const translations = parsed?.translations;
    if (!Array.isArray(translations) || translations.length !== todo.length || translations.some((t) => typeof t !== "string" || !t.trim())) {
      log.warn("autotranslate", "Unexpected translation shape; English copied", { expected: todo.length });
      return out;
    }
    const map = new Map(todo.map((t, i) => [t, (translations[i] as string).trim()]));
    return texts.map((t) => map.get(t) ?? t);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) log.error("autotranslate", "ANTHROPIC_API_KEY was refused; English copied", { error: err });
    else if (err instanceof Anthropic.RateLimitError) log.warn("autotranslate", "Rate limited; English copied", { error: err });
    else log.error("autotranslate", "Translation failed; English copied", { error: err as Error });
    return out;
  }
}
