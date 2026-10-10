import { notFound } from "next/navigation";

/** Keep unknown Spanish-prefixed addresses inside the localized route tree so its 404 copy is translated. */
export default function SpanishNotFoundRoute(): never {
  notFound();
}
